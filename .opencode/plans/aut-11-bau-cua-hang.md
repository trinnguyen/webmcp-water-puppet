# AUT-11 — Bầu cua agent tools hang when rAF is throttled (Implementation-Ready Plan)

**Bug (Linear AUT-11):** `bau_cua_roll` and `bau_cua_resolve` hang forever when
`requestAnimationFrame` is throttled (headless browser, backgrounded tab, laptop lid
closed) and `prefers-reduced-motion` is NOT set.

**Root cause:**
- `src/games/bau-cua/tools.ts:58` — `bau_cua_roll` does `await rollBauCuaDice()`.
- `src/games/bau-cua/tools.ts:88` — `bau_cua_resolve` does `await resolveBauCua()`.
- `src/games/bau-cua/scene.ts:375` — `rollBauCuaDice` does `await animateDiceRoll(...)`
  (GSAP tween; its `onComplete` only fires on gsap ticker ticks driven by rAF).
- `src/games/bau-cua/scene.ts:402-404` — `resolveBauCua` does
  `await animateWinnings(net)` / `await animateLoss(-net)` (same rAF dependency).

When rAF never fires, those promises never settle, so the agent-facing tool call never
returns. (Under `reducedMotion()` the dice path resolves synchronously today, which is
why the hang only reproduces without reduced motion.)

**Fix pattern to mirror:** git commit `d42114e` ("Fix o-an-quan agent moves hanging on
throttled animation") — `driveMove(pitIndex, isAgent)` in
`src/games/o-an-quan/scene.ts:337-421`: mutate game state synchronously first, then
`if (isAgent) { void animate...().then(...).catch(() => {}) } else { await animate...() }`.
Tools call with `isAgent = true` (`src/games/o-an-quan/tools.ts:45`); the human click
handler calls with `false` (`src/games/o-an-quan/scene.ts:426`).

**Scope guardrails:**
- DO NOT modify `src/games/bau-cua/rules.ts` (pure game state; `rollDice` /
  `resolveBets` already do all state transitions synchronously — that is what makes the
  immediate return possible).
- DO NOT change any tool name, `inputSchema`, `annotations`, or JSON return shape in
  `src/games/bau-cua/tools.ts` (WebMCP surface is frozen per SPEC §6 / redesign §6).
- Only `src/games/bau-cua/scene.ts` and `src/games/bau-cua/tools.ts` are edited.

---

## 1. Design decision

**Immediate state return + detached (fire-and-forget) animation for the agent path;
awaited animation kept for the human path.**

Both exported scene entry points gain an `isAgent: boolean = false` parameter, exactly
mirroring o-an-quan's `driveMove(pitIndex, isAgent)`:

1. **State first, synchronously.** `rollDice(state)` / `resolveBets(state)` (pure,
   synchronous rules functions) run before anything visual. `saveState()` and
   `updateBauCuaView(state)` also run synchronously so DOM pills/badges reflect the new
   state immediately. The returned `BauCuaState` is therefore complete and correct at
   the moment the function returns.
2. **Agent path (`isAgent === true`):** every GSAP/animation promise is started but
   never awaited — `void animateX(...).catch(() => {})` — so a throttled/paused rAF can
   never block the tool's `execute()` from returning JSON. The triple shake
   (`gsap.fromTo(rootEl, ...)`) and the triple toast are likewise fired without awaiting
   (toast via `void import('../../ui').then(...)`, the same fire-and-forget import style
   already used in `src/webmcp.ts:120`). The agent branch contains **zero `await`
   expressions**, so `execute()` settles on the next microtask.
3. **Human path (`isAgent === false`, the default):** behavior is byte-for-byte the same
   as today — `await animateDiceRoll(...)` then triple effects, and
   `await animateWinnings/Loss(...)` — so the clicked round keeps its visual continuity
   (dice settle before the payout badge flies).
4. **Functions stay `async` returning `Promise<BauCuaState>`** (they do not become
   synchronous functions). This keeps the o-an-quan mirror exact (`driveMove` is also
   still `async` and still `await`ed in tools), avoids touching any other call site, and
   means `tools.ts` only adds the `true` argument. The promises simply resolve
   immediately (nothing awaited inside on the agent branch).
5. **`isRolling` must flip `true → false` synchronously in the same tick on the agent
   path** (set before `rollDice`, cleared right after the detached animation is kicked
   off, exactly as the current code clears it after the await). Do NOT hold `isRolling`
   until the detached animation completes: with throttled rAF it would stay `true`
   forever, and `placeBauCuaBet`/`rollBauCuaDice` both check `isRolling` — that would
   turn the hang into a permanent agent deadlock on the next round. Between roll and
   resolve the `state.status === 'rolled'` guard already prevents re-bet/re-roll, so no
   functional gap is created by clearing it early.
6. **Accepted edge case (same as the o-an-quan fix):** if the agent rolls and resolves
   rapidly while the detached dice animation is still playing, a later human roll can
   start a second `animateDiceRoll` on the same meshes; GSAP runs both tweens and both
   `onComplete`s fire (last tween visually dominates). This is cosmetic, cannot hang,
   and is the identical trade-off accepted in `d42114e` (there `clickEnabled` is also
   restored in `finally` before the detached sowing animation finishes). No extra
   guarding is added.

---

## 2. Exact per-file changes

### 2.1 `src/games/bau-cua/scene.ts`

Two exported functions change signature (add optional trailing `isAgent` param, default
`false` — so all existing un-flagged call sites keep human behavior). No other function
changes: `animateDiceRoll`, `animateWinnings`, `animateLoss` keep their exact bodies and
`Promise<void>` signatures (they are the awaited-or-detached units); `getBauCuaState`,
`resetBauCua`, `placeBauCuaBet`, `buildBauCuaScene`, `destroyBauCuaScene`,
`updateBauCuaView` are untouched.

#### 2.1.1 `rollBauCuaDice` (currently lines 366-392)

Replace the whole function with:

```ts
export async function rollBauCuaDice(isAgent: boolean = false): Promise<BauCuaState> {
  if (state.status !== 'betting' || state.bets.length === 0 || isRolling) {
    return state;
  }
  isRolling = true;
  state = rollDice(state);
  updateBauCuaView(state);

  if (state.lastRoll) {
    const roll = state.lastRoll;
    const isTriple = roll[0] === roll[1] && roll[1] === roll[2];

    if (isAgent) {
      // Agent rolls must never hang on animation: run it fire-and-forget so a
      // throttled/paused rAF (headless or backgrounded tab) can't block the
      // tool call from returning the state.
      void animateDiceRoll(roll).catch(() => {
        // Best-effort animation; ignore failures.
      });
      if (isTriple) {
        if (rootEl && !reducedMotion()) {
          gsap.fromTo(rootEl,
            { x: -20, y: -20 },
            { x: 20, y: 20, duration: 0.05, yoyo: true, repeat: 10, clearProps: 'x,y' }
          );
        }
        void import('../../ui').then(({ showToast }) => showToast('XỐC! BA CON!'));
      }
    } else {
      await animateDiceRoll(roll);

      // Check for triple
      if (isTriple) {
        if (rootEl && !reducedMotion()) {
          gsap.fromTo(rootEl,
            { x: -20, y: -20 },
            { x: 20, y: 20, duration: 0.05, yoyo: true, repeat: 10, clearProps: 'x,y' }
          );
        }
        const { showToast } = await import('../../ui');
        showToast('XỐC! BA CON!');
      }
    }
  }

  isRolling = false;
  return state;
}
```

Notes on what changed vs. the current body:
- Signature: `()` → `(isAgent: boolean = false)`.
- `state.lastRoll` is captured into `const roll` and the triple check hoisted into
  `const isTriple` so both branches use the same values (identical semantics).
- Agent branch: `animateDiceRoll` is detached with `void ... .catch(() => {})` (mirrors
  `d42114e`; `animateDiceRoll` never actually rejects, the catch is defensive parity);
  triple shake stays fire-and-forget (it already was — it is not awaited today); triple
  toast becomes `void import(...).then(...)` so the agent branch has no `await` at all.
- Human branch: identical to today — `await animateDiceRoll(roll)`, then triple shake +
  `await import('../../ui')` toast.
- `isRolling = false` stays synchronous at the end of the function for both branches
  (see design decision §1.5 — do not move it into the detached promise chain).
- The dice-internal triple ribbon text + shake inside `animateDiceRoll` itself
  (scene.ts:317-341) is untouched; on the agent path it simply plays best-effort
  whenever rAF runs.

#### 2.1.2 `resolveBauCua` (currently lines 394-423)

Replace the whole function with:

```ts
export async function resolveBauCua(isAgent: boolean = false): Promise<BauCuaState> {
  if (state.status !== 'rolled') return state;

  const before = state.playerPoints;
  state = resolveBets(state);
  const net = state.playerPoints - before;

  if (isAgent) {
    // Agent resolves must never hang on animation: run it fire-and-forget so a
    // throttled/paused rAF (headless or backgrounded tab) can't block the
    // tool call from returning the state.
    if (net > 0) {
      void animateWinnings(net).catch(() => {
        // Best-effort animation; ignore failures.
      });
    } else if (net < 0) {
      void animateLoss(-net).catch(() => {
        // Best-effort animation; ignore failures.
      });
    }
  } else {
    if (net > 0) {
      await animateWinnings(net);
    } else if (net < 0) {
      await animateLoss(-net);
    }
  }

  import('../../hub').then(h => h.markGameCompleted('bau-cua'));

  saveState();
  updateBauCuaView(state);

  if (resultEl) {
    resultEl.className = 'bau-result' + (net > 0 ? ' win' : '');
    resultEl.textContent =
      net > 0
        ? `🎉 Thắng +${net} điểm!`
        : net < 0
          ? `Suýt nữa thì thắng! Mất ${-net} điểm`
          : '🤝 Hòa điểm';
  }

  return state;
}
```

Notes:
- Signature: `()` → `(isAgent: boolean = false)`.
- State transition (`resolveBets`), `markGameCompleted` (already fire-and-forget today),
  `saveState()`, `updateBauCuaView`, and the `resultEl` banner are unchanged and all
  synchronous, so they execute before the return in both branches.
- Agent branch: `animateWinnings`/`animateLoss` detached with `void ... .catch(() => {})`
  (both promises only ever resolve; catch is defensive parity with `d42114e`).
- Human branch: identical to today (`await` the win/loss badge before continuing).

#### 2.1.3 Human roll button handler (scene.ts:884-894) — NO CHANGE

The handler near the end of `buildBauCuaScene` stays exactly as-is:

```ts
rollBtn.addEventListener('click', async () => {
  if (state.status !== 'betting' || state.bets.length === 0 || isRolling) {
    return;
  }
  await rollBauCuaDice();
  await resolveBauCua();
});
```

Because `isAgent` defaults to `false`, the clicked path still awaits the dice tumble and
then the payout/loss badge — visual continuity preserved. Do not pass a second argument
here.

### 2.2 `src/games/bau-cua/tools.ts`

Two one-token changes; nothing else (names, descriptions, schemas, annotations, JSON
shapes all unchanged):

- Line 58, in `bau_cua_roll.execute`:
  - Before: `const s = await rollBauCuaDice();`
  - After:  `const s = await rollBauCuaDice(true);`
- Line 88, in `bau_cua_resolve.execute`:
  - Before: `const s = await resolveBauCua();`
  - After:  `const s = await resolveBauCua(true);`

The `await`s remain valid (functions are still `async`) but now settle immediately
because the agent branch awaits nothing. `bau_cua_place_bet` and `bau_cua_state` are
already animation-free — untouched.

### 2.3 Files explicitly NOT changed

- `src/games/bau-cua/rules.ts` — pure game state (task requirement).
- `src/games/o-an-quan/*` — reference only.
- `src/webmcp.ts`, `src/types.ts`, `src/motion.ts`, `src/audio.ts`, `src/ui.ts`,
  `src/hub.ts` — no changes needed.

---

## 3. Verification

### 3.1 Build

```sh
npm run build
```

`npm run build` is `tsc && vite build` (package.json). Must exit 0 with no diagnostics.
tsconfig is `strict` + `noUnusedLocals` + `noUnusedParameters`; the new `isAgent`
parameter is used in both functions, so no unused-parameter errors are expected. No new
imports are introduced (`gsap`, `reducedMotion`, `THREE`, rules imports all already
present in scene.ts).

### 3.2 Agent path under throttled rAF (the bug condition)

The repo has no test runner, so verify via the built-in `window.__debugTools` fallback
(`src/webmcp.ts:142-147` exposes every tool executor when `document.modelContext` is
absent — always true in plain headless Chrome).

Deterministic repro that does not depend on headless rAF heuristics — stub rAF so it
never fires (exact equivalent of a fully throttled/backgrounded tab), with
`prefers-reduced-motion` OFF (default — do not enable reduced-motion emulation):

1. `npm run build && npm run preview` (or `npm run dev`).
2. Open the served URL in a browser/CDP session and run in the page console (or via
   `Runtime.evaluate`) — stub BEFORE starting the game so no gsap ticker ever ticks:

```js
window.requestAnimationFrame = () => 0; // simulate fully throttled rAF

const timeout = (p, ms) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error('TOOL HUNG')), ms)),
]);

console.log(await window.__debugTools.start_game({ game: 'bau-cua' }));
console.log(await window.__debugTools.bau_cua_place_bet({ symbol: 'bau', points: 5 }));
console.log(await timeout(window.__debugTools.bau_cua_roll({}), 3000));
console.log(await timeout(window.__debugTools.bau_cua_resolve({}), 3000));
console.log(await window.__debugTools.bau_cua_state({}));
```

**Pass criteria:**
- `bau_cua_roll` resolves well within 3s with `{"status":"ok","roll":[...3 symbols],"counts":{...},"message":"..."}`.
- `bau_cua_resolve` resolves well within 3s with `{"status":"ok","netGain":N,"totalPoints":N,"roundNumber":2,"message":"..."}`.
- `bau_cua_state` shows `gameStatus:"betting"`, `lastRoll:null`, `roundNumber:2` (round
  advanced — proves state transitioned fully despite animations never ticking).
- No `TOOL HUNG` rejection. (Running the same sequence against the pre-fix code hangs
  both tool calls — this is the regression being fixed.)
- Repeat the roll/resolve pair 2-3 more times to confirm `isRolling` never sticks
  (each subsequent `bau_cua_place_bet` + `bau_cua_roll` must succeed).

### 3.3 Reduced-motion sanity (must not regress)

Run the same §3.2 sequence with reduced motion forced
(`chrome --headless --force-prefers-reduced-motion` or DevTools → Rendering → Emulate
CSS prefers-reduced-motion: reduce), without the rAF stub. Both tools must still return
immediately with the same JSON shapes (this path resolved before the fix and must keep
working).

### 3.4 Human path regression (visual)

With `npm run dev` in a visible browser, reduced motion off, no rAF stub:
1. Enter Bầu cua, place a bet with a symbol tile, click "🎲 Lắc Xúc Xắc".
2. Confirm the original choreography is intact: dice tumble and settle first, then the
   result banner updates and the floating `+N`/`-N` badge plays (i.e. the click path
   still awaits animations in order), and the roll button is disabled during the roll.
3. Confirm a triple still shows the shake + "XỐC! BA CON!" toast.

### 3.5 Commit hygiene (for the build agent)

Stage only `src/games/bau-cua/scene.ts` and `src/games/bau-cua/tools.ts`. Suggested
message mirroring the reference commit: `Fix bau-cua agent tools hanging on throttled animation`.
