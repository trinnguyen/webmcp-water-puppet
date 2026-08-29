# BUILD SPEC: Sân Chơi — Traditional Vietnamese Games, Directed by AI

**Former project codename:** water-puppet (re-scoped 2026-08-29).
**New concept:** a WebMCP agent-native web app that lets an AI agent (ChatGPT desktop in-app browser) host classic **trò chơi dân gian** (traditional Vietnamese folk games) for kids — choosing the game, setting up, and acting as the game master.

---

## 1. THESIS (why this wins the WebMCP Challenge)

The old single-puppet-stage idea had a thin WebMCP surface (5 tools, one scene).
Sân Chơi fixes that with a **hub of full games**, each exposing a rich, turn-based,
agent-driveable tool surface. Judges weight **WebMCP Leverage** + **Execution** equally:

- **Leverage:** every game has its own `registerTool` namespace → 3 games × 6–8 tools
  each = a genuinely non-trivial, working WebMCP integration (not a demo stub).
- **Execution:** each game is fully playable, animated (GSAP/Three.js), and persists
  to `localStorage` — runnable end to end with zero backend. Perfect for a 5-day build.

**Agent role = "Game Master" (Người Xướng Trò).** The agent doesn't play — it *hosts*:
it setups the board, rolls dice, calls the play-by-play, keeps score, and manages
turn order. Kids press one button to make their move.

---

## 2. TECH STACK & DEPLOYMENT

- **Core:** Vanilla TypeScript + Vite (static, no backend). Kept from original spec.
- **Rendering:** Three.js for 3D game scenes + GSAP for UI/choreography tweening.
  (Games also render fine as 2D canvas/DOM — Three.js stays where it earns its keep.)
- **Storage:** `localStorage` per-game saves + a global "games played" ledger.
- **Hosting:** decided separately by Tri (NOT GitHub Pages — see §12). Static build = drop-in anywhere (Netlify, Vercel, Cloudflare, S3).
- **WebMCP:** `document.modelContext.registerTool` (Chrome 150+ surface). Serverless.

---

## 3. REPO STRUCTURE (game-hub architecture)

```text
├── index.html                # Hub welcome screen
├── src/
│   ├── main.ts               # Entry: hub bootstrap + WebMCP init + fallback
│   ├── hub.ts                # Game launcher screen (cards grid)
│   ├── webmcp.ts             # Tool registration wrapper (single choke point)
│   ├── games/
│   │   ├── index.ts          # registry: { id, name, sceneBuilder, tools[] }
│   │   ├── o-an-quan/        # Ô ăn quan — mancala/strategy
│   │   │   ├── scene.ts
│   │   │   ├── rules.ts      # pure game logic (testable, no DOM)
│   │   │   └── tools.ts      # WebMCP tool defs + executors
│   │   ├── bau-cua/          # Bầu cua tôm cá — dice/guessing
│   │   │   ├── scene.ts
│   │   │   ├── rules.ts
│   │   │   └── tools.ts
│   │   └── rong-ran/         # Rồng rắn lên mây — chase/fun
│   │       ├── scene.ts
│   │       ├── rules.ts
│   │       └── tools.ts
│   ├── ui.ts                 # shared overlay/toast components
│   └── audio.ts              # synth + playback (reuse existing make_audio.py)
├── public/assets/…
├── vite.config.ts            # base path configurable per host
└── package.json
```

Games register *their* tools in `games/<g>/tools.ts`; `webmcp.ts` imports the
registry and registers **all** tools under namespaced names (see §5).

---

## 4. GAME REGISTRY / HUB MODEL

```typescript
interface GameDef {
  id: string;                 // "o-an-quan", "bau-cua", "rong-ran"
  name: string;               // Vietnamese display name
  nameEn: string;
  minPlayers: number; maxPlayers: number;
  description: string;        // shown on hub card + fed to agent
  buildScene: (container: HTMLElement) => void;
  tools: WebMCPToolGroup[];   // this game's WebMCP tools
  saveKey: string;            // localStorage namespace
}
```

Hub = `state.games: GameDef[]` in `games/index.ts`. `main.ts` renders the card grid,
then the agent (via a `start_game` tool) picks one and its scene loads.

---

## 5. WEBMCP TOOL NAMESPACING

Keep the flat `document.modelContext` surface but namespace by game so the agent
knows domain context and the schema stays shallow:

```
o_an_quan_new_game        # reset board
o_an_quan_pick_bin        # { bin: number } -> scoop & drop, returns board JSON
o_an_quan_state           # read current board
o_an_quan_score           # who's winning
bau_cua_roll              # 3 dice, returns { symbols: [...], counts: {...} }
bau_cua_place_bet         # { symbol, points } (fake points only)
bau_cua_resolve           # settle bets, announce outcome
rong_ran_start            # { length } spawn dragon-snake
rong_ran_chase            # { speed } move the snake; doctor tries to catch tail
rong_ran_turn             # change direction / emit "thầy thuốc" chant
```

**Global tools** (any game):
```
start_game       # { game: "o-an-quan" | "bau-cua" | "rong-ran" } -> load scene
list_games       # enum of available games + player counts
set_music        # { track } ambient BGM (reuse
save_progress    # { note } save game state to localStorage
```

All `execute(input)` return a **JSON string** (`{ status, message, board?, ... }`)
so the agent gets structured state back. This is a deliberate "WebMCP Leverage"
signal — the tool surface returns live game state, not static strings.

---

## 6. GAME 1 — Ô ăn quan (Vietnamese mancala)   [TIER 1, core]

The flagship: purely strategic, turn-based, ideal WebMCP fit.

- **Board:** 1 row? No — classic layout = 5 small pits ("dân") per side + 2 big
  "quan" (mandarin) pits at the ends (10 dân + 2 quan). Alternative 6-pit variants exist; standardize on **5 pits + 2 quan** in v1.
- **Setup:** each small pit = 5 seeds; each quan = 10 seeds (2 quan). Player owns
  the 5 pits on their side.
- **Move (`o_an_quan_pick_bin {bin}`):** player picks a pit on their side; seeds are
  scooped and **deposited one per pit counter-clockwise**. If the last seed lands in
  an empty small pit on the player's side, the player **captures** the seeds in the
  pit directly opposite. Landing in a quan is a safe way to end a move.
- **Capture rules:** capture the opposite pit's seeds into your score pile. If a
  captured pit itself had seeds, keep going; if none, the run ends.
- **Win:** when both quan are captured or a player can't move on their turn, the
  player with more captured seeds wins. 1 quan = 10 seeds (or 5, house rule — pick 10).
- **Agent surface:** agent *reads* state and *calls* picks on the child's behalf, or
  suggests moves ("Try bin 3! Your capture run wins you 4 seeds").
- **UI:** top-down 2D board, seeds as little stones, GSAP splash on capture, subtle
  Three.js if we want a tilted 3D board — keep it optional.
- **Pure logic in `rules.ts`** returning `{ board, captured, winner? }` → unit-testable
  and drives both img and the 3D scene.

---

## 7. GAME 2 — Bầu cua tôm cá (dice betting)   [TIER 1, core]

Tết's iconic dice game, molecule-swapped to be kid-safe.

- **6 symbols:** bầu (gourd) · cua (crab) · tôm (shrimp) · cá (fish) · gà (chicken) · hươu/nai (deer).
- **Setup:** player + agent each get a pile of **fake points** (e.g. 100). Three dice.
- **Bet (`bau_cua_place_bet { symbol, points }`):** stake fake points on 1+ symbols.
- **Roll (`bau_cua_roll`):** 3 dice land; payouts = count-of-symbol on the dice
  (appears on 1 die = 1×, 2 dice = 2×, 3 dice = 3× your stake). No match = lose stake.
- **Turn loop:** bet → roll → resolve → switch who deals. Agent rolls and calls
  the reveal with fanfare ("Bầu! Bầu! Cua!" — classic xướng).
- **UI:** 3D dice tumble (Three.js earns its place here), a betting mat, points
  counters, GSAP coin/point animation.
- **Edge:** no real-money framing anywhere; it's "giải thưởng" (prize points).

---

## 8. GAME 3 — Rồng rắn lên mây (dragon-snake to the clouds)   [STRETCH]

Chase/sing game. Highest animation payoff, lighter on turn-based logic — good
"wow" demo but lower WebMCP leverage than Games 1–2, so it's stretch.

- **Setup (`rong_ran_start { length }`):** spawn a snaking "dragon" (chain of
  segments — the kids) and a "thầy thuốc" (doctor) marker at the head.
- **Chant:** `rong_ran_start`/`rong_ran_chase` print the verse:
  *"Rồng rắn lên mây — Có cây núc nác..."*
- **Chase (`rong_ran_chase { speed }`):** doctor chases the tail; snake weaves.
  Catch the tail = doctor wins, next round.
- **UI:** snaky joints tweened with GSAP along a path; toon style.
- **Agent surface:** thin (start/chase/turn). Good for video but not a judging anchor.

---

## 9. AUDIO (reuse existing work)

- Keep `src/audio.ts` + `make_audio.py`.
- Add per-game jingles: Ô ăn quan win chime, bầu cua reveal roll swell, rồng rắn chant.
- All synthesized/CC0; no heavy audio libs. Autoplay unlock via the "Enter" button.

---

## 10. UI / UX

- Hub: full-screen card grid (mobile-first landscape), each game card = icon + name +
  min/max players. Tap a card OR an agent can `start_game`.
- In-game overlay: top corner = current game name + turn banner; bottom = back-to-hub.
- "Kid mode": large buttons, big friendly fonts, Vietnamese + English labels.
- Agent interaction lives in the ChatGPT desktop in-app browser; the page just
  registers tools + renders results. Fallback `window.__debugTools` for dev/QA.
- Full-screen canvas per scene; minimal DOM chrome (pointer-events none).

---

## 11. FUNNY-HOOKS (kept, per-game)

- **Ô ăn quan:** agent suggests a losing move → a stone "grumbles" and wobbles; banner
  *"Ô quan nói: đừng hấp tấp!"* (the mandarin says: don't be hasty!).
- **Bầu cua:** roll shows all 3 same symbols → screen shake + *"XỐC! BA CON!"*.
- **Rồng rắn:** tail caught → doctor does a little victory dance, snake deflates.
- **Global:** agent queues many actions without saving → "Người xướng trò bị rối" toast.

---

## 12. HOSTING (DECISION PENDING — not GitHub Pages)

Tri said Pages is out; host decision comes later. Vite static output is portable:
- Netlify/Vercel: zero config, free.
- Cloudflare Pages: free, easy with existing Cloudflare access.
- S3/CloudFront or a cheap VPS.
`vite.config.ts` already flexible; set `base` to match final host. Keep the deploy
workflow off until hosting is chosen.

---

## 13. MILESTONES (re-scoped; deadline Sep 3 13:00 PT = Sep 4 03:00 GMT+7)

Today is Aug 29 (~day 1 of the original 5-day plan). Re-scope counts from now:
- **Day 1 (today):** hub scaffold + `webmcp.ts` namespacing + game registry.
- **Day 2:** Ô ăn quan — `rules.ts` (pure, tested) + board scene + tools.
- **Day 3:** Bầu cua — dice scene + betting + resolve + tools.
- **Day 4:** Rồng rắn (stretch) + audio jingles + funny-hooks + polish.
- **Day 5:** QA (DevTools `__debugTools` walkthrough), video, README, pick host, deploy.
- **Buffer:** Sep 3 morning final sanity check. Ship.

---

## 14. RISKS & MITIGATIONS

- **Identifier mismatch / rename:** decide repo+package name before Day 2 (see memo).
- **Ô ăn quan rule variants:** standardize the 5-pit + 2-quan layout and document the
  exact capture rule in `rules.ts` + README so judges see a correct, complete game.
- **Bầu cua rules ambiguity:** lock the payout table (1×/2×/3×) and document it.
- **WebMCP API drift:** single choke point (`webmcp.ts`) — swap surface in one file.
- **Scope:** 3 games max; Ô ăn quan + Bầu cua are the must-ship core, Rồng rắn is stretch.
- **No backend:** everything localStorage; no auth, no leaderboard cross-session.

---

## 15. UNKNOWNS TO RE-VERIFY (fast)

1. Repo/package rename — confirm with Tri before Day 2.
2. Final host (affects `vite base` + deploy workflow).
3. Whether agent should drive most moves vs. kids click themselves — affects tool
   "read" helpers. Default: agent hosts + kids click; agent can also move on request.