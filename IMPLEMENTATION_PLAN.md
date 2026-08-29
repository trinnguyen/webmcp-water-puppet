# 🎮 Sân Chơi — Implementation Plan

> **Target:** Refactor the water-puppet scaffold into a multi-game Vietnamese games hub with rich WebMCP tool surface.
> **Deadline:** Sep 4 03:00 GMT+7. **Approach:** file-by-file, ordered, no ambiguity.

---

## 0. Triage: What to DELETE, KEEP, and MODIFY

### DELETE (remove files entirely)
| File | Reason |
|---|---|
| `src/puppet.ts` | Water-puppet character factory — replaced by per-game scene modules |
| `src/animation.ts` | Water-puppet choreography (splash/spin/chase/wave/jump) — replaced by per-game animations in each `scene.ts` |
| `src/scene.ts` | Water-stage Three.js scene (water plane, lights) — replaced by `src/hub.ts` + per-game `scene.ts` |
| `src/state.ts` | Water-puppet `ShowState` / `PuppetState` / `MoveAction` — replaced by per-game state in each `rules.ts` + global hub state |
| `src/tools.ts` | Old flat 5-tool registration — replaced by `src/webmcp.ts` + per-game `tools.ts` |

### KEEP (reuse as-is or with minor edits)
| File | Notes |
|---|---|
| `src/audio.ts` | Keep the `initAudio`, `toggleMute`, `playBGM`, `playSFX`, `getMuteState` exports. **Modify**: add new SFX keys for game sounds (capture chime, dice roll, etc.) and accept a `tracks` record for per-game BGM. |
| `src/ui.ts` | Keep `updateWebMCPStatus`. **Gut** the saved-shows drawer code and replace with hub card grid + in-game overlay (back-to-hub, turn banner). Keep `setupUI` signature concept but rewrite the body. |
| `make_audio.py` | Keep. **Extend** with new sound synthesis: `capture.wav` (ô ăn quan seed capture chime), `dice_roll.wav` (bầu cua tumble), `win_chime.wav` (generic victory). |
| `index.html` | Keep CSS variables, gate structure, orientation hint, lantern decorations, status badge. **Rewrite** text/titles to "Sân Chơi" branding. Remove water-stage-specific DOM (`#sky`, `#moon`, `#stars-container`, `.lantern` decorations are optional — keep for visual flair). Replace `#canvas-container` with `#game-container`. Rename `#gate-title` content. |
| `vite.config.ts` | Keep as-is (`base: './'`). |
| `package.json` | Rename `name` to `"san-choi"`. Dependencies unchanged (three, gsap, typescript, vite). |
| `tsconfig.json` | Keep as-is. |

---

## 1. New File: `src/types.ts` — Shared Type Declarations

**Purpose:** Single source of truth for interfaces shared across hub, WebMCP, and games.

```typescript
// ─── WebMCP Types ───
export interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: any) => Promise<string> | string;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
}

export interface ModelContext {
  registerTool: (tool: WebMCPTool, opts?: { signal?: AbortSignal }) => Promise<unknown>;
  addEventListener: (type: string, listener: (event: any) => void) => void;
}

declare global {
  interface Window {
    __debugTools: Record<string, (input: any) => string | Promise<string>>;
    __webmcpController?: AbortController;
  }
  interface Document {
    modelContext?: ModelContext;
  }
}

// ─── Game Registry Types ───
export interface GameToolDef {
  name: string;           // namespaced, e.g. "o_an_quan_pick_bin"
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: any) => Promise<string>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
}

export interface GameDef {
  id: string;             // "o-an-quan", "bau-cua"
  name: string;           // "Ô ăn quan"
  nameEn: string;         // "Vietnamese Mancala"
  emoji: string;          // "🪨"
  minPlayers: number;
  maxPlayers: number;
  description: string;    // shown on hub card AND fed to agent context
  buildScene: (container: HTMLElement) => void;
  destroyScene: () => void;
  tools: GameToolDef[];
  saveKey: string;        // localStorage key prefix
}
```

> [!IMPORTANT]
> The `GameToolDef` shape **must** match the `WebMCPTool` interface exactly (same fields as `document.modelContext.registerTool` expects). The only difference is the `execute` return type is explicitly `Promise<string>` — all tool executors must return JSON strings.

---

## 2. New File: `src/games/index.ts` — Game Registry

**Purpose:** Exports the `games` array. Single import point for all game definitions.

**Key exports:**
```typescript
import { GameDef } from '../types';
import { oAnQuanDef } from './o-an-quan/index';
import { bauCuaDef } from './bau-cua/index';

export const games: GameDef[] = [oAnQuanDef, bauCuaDef];

export function getGameById(id: string): GameDef | undefined {
  return games.find(g => g.id === id);
}
```

Each game subdirectory has its own `index.ts` barrel that assembles the `GameDef`.

---

## 3. New File: `src/webmcp.ts` — Single Choke-Point Tool Registration

**Purpose:** The ONLY file that touches `document.modelContext.registerTool`. Registers all game tools + global tools. Provides the `__debugTools` fallback.

**Responsibilities:**
1. Import `games` from `./games/index`.
2. Import global tool definitions (defined inline in this file).
3. Collect all `GameToolDef[]` from every registered game.
4. For each tool: call `document.modelContext.registerTool(tool, { signal })`.
5. Fallback: if `document.modelContext` is `undefined`, populate `window.__debugTools` with every tool's `execute` keyed by `name`.
6. Export `initWebMCP()` (async, called once from `main.ts`) and `cleanupWebMCP()`.

**Global tools defined here (4 tools):**

### `list_games`
```
name: "list_games"
description: "Returns available traditional Vietnamese games with descriptions and player counts."
inputSchema: { type: "object", properties: {} }
annotations: { readOnlyHint: true, untrustedContentHint: false }
execute: () => JSON.stringify({
  status: "ok",
  games: games.map(g => ({
    id: g.id, name: g.name, nameEn: g.nameEn,
    players: `${g.minPlayers}-${g.maxPlayers}`,
    description: g.description
  }))
})
```

### `start_game`
```
name: "start_game"
description: "Launches a game by ID. Loads its scene and activates its tools."
inputSchema: {
  type: "object",
  properties: {
    game: { type: "string", enum: ["o-an-quan", "bau-cua"], description: "Game ID" }
  },
  required: ["game"]
}
annotations: { readOnlyHint: false, untrustedContentHint: false }
execute: (input) => {
  // 1. Find game in registry
  // 2. Call destroyScene() on current game (if any)
  // 3. Call game.buildScene(document.getElementById('game-container'))
  // 4. Update hub state (currentGameId)
  // 5. Return JSON: { status: "ok", game: id, message: "..." }
}
```

### `set_music`
```
name: "set_music"
description: "Changes background music track."
inputSchema: {
  type: "object",
  properties: {
    track: { type: "string", enum: ["dan_bau", "gong", "festive", "silent"] }
  },
  required: ["track"]
}
annotations: { readOnlyHint: false, untrustedContentHint: false }
execute: (input) => { playBGM(input.track); return JSON.stringify({ status: "ok", track: input.track }); }
```

### `save_progress`
```
name: "save_progress"
description: "Saves the current game's state to localStorage."
inputSchema: {
  type: "object",
  properties: {
    note: { type: "string", description: "Optional note/label for the save" }
  }
}
annotations: { readOnlyHint: false, untrustedContentHint: false }
execute: (input) => {
  // 1. Read currentGameId from hub state
  // 2. Get the game's rules module state
  // 3. localStorage.setItem(game.saveKey, JSON.stringify(state))
  // 4. Update global ledger (games played count)
  // Return JSON: { status: "ok", game: id, savedAt: ISO timestamp }
}
```

> [!WARNING]
> **WebMCP gotcha — `registerTool` is async and can reject.** Wrap each call in try/catch. If registration fails for one tool, log it and continue registering the rest — don't let one failure kill the whole surface.

> [!WARNING]
> **WebMCP gotcha — AbortController.** Create ONE `AbortController` for all registrations. Store on `window.__webmcpController`. On `beforeunload`, call `controller.abort()` to cleanly deregister. If you create per-tool controllers, aborting them individually is error-prone.

> [!WARNING]
> **WebMCP gotcha — `execute` must return a string.** Not an object. Always `JSON.stringify(...)`. The Chrome 150+ WebMCP surface passes the raw string to the model. Returning an object silently fails or is cast to `"[object Object]"`.

**`__debugTools` fallback pattern:**
```typescript
if (typeof document.modelContext === 'undefined') {
  console.warn('[WebMCP] Not available — exposing window.__debugTools');
  window.__debugTools = {};
  for (const tool of allTools) {
    window.__debugTools[tool.name] = tool.execute;
  }
  // Usage: window.__debugTools.o_an_quan_state({})
}
```

---

## 4. New File: `src/hub.ts` — Hub Launcher Screen

**Purpose:** Renders the game selection card grid. Manages hub-level state (which game is active, navigation).

**Key exports:**
```typescript
export interface HubState {
  currentGameId: string | null;
  gamesPlayedLedger: Record<string, number>; // { "o-an-quan": 3, "bau-cua": 1 }
}

export const hubState: HubState;

export function renderHub(container: HTMLElement): void;
  // Creates card grid from games registry
  // Each card: emoji + name + nameEn + description + "Chơi / Play" button
  // On card click: calls startGame(gameId)

export function startGame(gameId: string): string;
  // 1. hubState.currentGameId = gameId
  // 2. Hide hub cards, show game container
  // 3. game.buildScene(container)
  // 4. Return JSON status string (for use by the start_game tool)

export function returnToHub(): void;
  // 1. game.destroyScene()
  // 2. hubState.currentGameId = null
  // 3. Show hub cards, hide game container

export function loadLedger(): void;
  // Read from localStorage key "san_choi_ledger"

export function saveLedger(): void;
  // Write to localStorage key "san_choi_ledger"
```

**DOM it creates** (inside `#game-container` or a new `#hub-grid`):
```html
<div id="hub-grid">
  <div class="game-card" data-game="o-an-quan">
    <div class="card-emoji">🪨</div>
    <div class="card-name">Ô ăn quan</div>
    <div class="card-name-en">Vietnamese Mancala</div>
    <div class="card-desc">Strategic pit-and-seed game...</div>
    <button class="card-play-btn">Chơi / Play</button>
  </div>
  <!-- repeat for bau-cua -->
</div>
```

Styling: reuse CSS variables from `index.html` (`.game-card` uses `--overlay-bg`, `--folk-gold` border, etc.).

---

## 5. Modified File: `src/main.ts` — Entry Point (Rewritten)

**New responsibilities:**
1. Import `initWebMCP` from `./webmcp`.
2. Import `renderHub` from `./hub`.
3. Import `initAudio` from `./audio`.
4. Import `setupUI` from `./ui`.
5. **No Three.js scene init at top level** — that's per-game now.

**New flow:**
```typescript
async function initApp() {
  // 1. Setup UI (gate button, mute toggle, WebMCP status badge)
  setupUI();

  // 2. Gate button click handler: unlock audio, dismiss gate, render hub
  const gateBtn = document.getElementById('gate-btn')!;
  gateBtn.addEventListener('click', async () => {
    document.getElementById('gate')!.classList.add('hidden');
    await initAudio();
    renderHub(document.getElementById('game-container')!);
  });

  // 3. Register all WebMCP tools (global + all games)
  await initWebMCP();

  // 4. Listen for webmcp-status-change events
  window.addEventListener('webmcp-status-change', ((e: CustomEvent) => {
    updateWebMCPStatus(e.detail, ...);
  }) as EventListener);
}

initApp();
```

**What's removed:** All puppet-specific logic (farmer idle timer, clearStage, reconstructShow, ToolExecutors wiring).

---

## 6. Modified File: `src/ui.ts` — Shared UI Components

**Keep:** `updateWebMCPStatus()`, `updateShowName()` (rename to `updateGameName()`).

**Remove:** `renderSavedShows()`, `getPuppetEmoji()`, saved-shows drawer logic.

**Add:**
```typescript
export function setupUI(): void;
  // Wire up: mute button, WebMCP status badge
  // No gate handler here (that's in main.ts now)

export function showToast(message: string, duration?: number): void;
  // Slide-in toast notification (reuse #teu-popup pattern)
  // Used for funny-hooks, error messages, announcements

export function updateGameName(name: string): void;
  // Updates #show-name text to current game name

export function showBackButton(onClick: () => void): void;
  // Shows a "← Sân Chơi" back-to-hub button in top-left

export function hideBackButton(): void;

export function showTurnBanner(text: string): void;
  // Animated turn indicator ("Lượt của bạn! / Your turn!")

export function hideTurnBanner(): void;
```

---

## 7. Modified File: `src/audio.ts` — Audio (Extend)

**Keep all existing code.** Add:

```typescript
// New SFX entries — files will be generated by make_audio.py
const sfxElements: Record<string, HTMLAudioElement> = {
  splash: new Audio('assets/audio/splash.wav'),
  sneeze: new Audio('assets/audio/sneeze.wav'),
  capture: new Audio('assets/audio/capture.wav'),      // NEW: ô ăn quan capture chime
  dice_roll: new Audio('assets/audio/dice_roll.wav'),   // NEW: bầu cua dice tumble
  win_chime: new Audio('assets/audio/win_chime.wav'),   // NEW: victory fanfare
  coin: new Audio('assets/audio/coin.wav'),             // NEW: points gained
};

// New BGM tracks
export function playBGM(track: string) {
  // Support multiple tracks: "dan_bau" (existing bgm.mp3), "festive", "gong", "silent"
  const trackMap: Record<string, string> = {
    dan_bau: 'assets/audio/bgm.mp3',
    festive: 'assets/audio/festive.mp3',
    gong: 'assets/audio/gong.mp3',
  };
  // ... (same play logic as before, just with track lookup)
}
```

---

## 8. Modified File: `index.html` — Re-skin for Sân Chơi

**Changes (surgical, keep CSS/structure):**

1. **Title:** `<title>🎮 Sân Chơi — Trò Chơi Dân Gian Việt Nam</title>`
2. **Gate title:** `🎮 Sân Chơi` / subtitle: `Trò chơi dân gian AI — Hãy để AI làm người xướng trò!` / `AI Game Master for traditional Vietnamese games`
3. **Gate chars:** `🪨🦀🎲🐉`
4. **Gate button:** `🔊 Vào Sân — Enter`
5. **Replace `#canvas-container`** with `<div id="game-container"></div>` (same CSS: `position: absolute; inset: 0; z-index: 1;`)
6. **`#show-name`:** initial text = `🎮 Chọn trò chơi`
7. **`#drawer-tab` + `#saved-drawer`:** Remove entirely (no saved-shows drawer in the hub; each game saves independently)
8. **`#teu-popup`:** Rename conceptually to a generic toast — keep the DOM, change default text to `"Người xướng trò nói..."` / `"The Game Master says..."`
9. **Footer:** `Sân Chơi · WebMCP Challenge 2026 · Made with ❤️ in Việt Nam`
10. **Keep:** All CSS custom properties, `.icon-btn`, `#webmcp-status`, orientation hint, lanterns, sky/moon (they're nice ambient — games render inside `#game-container` on top).

---

## 9. Game 1: Ô ăn quan (Vietnamese Mancala)

### 9a. `src/games/o-an-quan/rules.ts` — Pure Game Logic

**Purpose:** Zero DOM/rendering dependencies. Fully unit-testable. Manages board state and move execution.

**Board model:**
```
Index layout (array of 12 elements):
  [0..4]  = Player 1's 5 small pits (left-to-right from P1's perspective)
  [5]     = Quan (mandarin) pit — right end
  [6..10] = Player 2's 5 small pits (left-to-right from P2's perspective, = right-to-left visually)
  [11]    = Quan (mandarin) pit — left end

  Visual layout:
       [11]  [10] [9] [8] [7] [6]  [5]
        Q2    ←  Player 2's side  →   Q1
        Q2    ←  Player 1's side  →   Q1
             [0] [1] [2] [3] [4]
```

**Types:**
```typescript
export interface OAQBoard {
  pits: number[];        // length 12: seeds in each pit
  captured: [number, number]; // [P1 captured seeds, P2 captured seeds]
  currentPlayer: 1 | 2;
  status: 'playing' | 'finished';
  winner: 0 | 1 | 2;    // 0 = draw
}
```

**Key functions:**
```typescript
export function createBoard(): OAQBoard;
  // pits[0..4] = 5 each, pits[5] = 10, pits[6..10] = 5 each, pits[11] = 10
  // captured = [0, 0], currentPlayer = 1, status = 'playing', winner = 0

export function getPlayerPits(player: 1 | 2): number[];
  // P1 = indices [0..4], P2 = indices [6..10]

export function isValidMove(board: OAQBoard, pitIndex: number): boolean;
  // Must be in player's own pits, must have seeds > 0

export function executeMove(board: OAQBoard, pitIndex: number): OAQBoard;
  // 1. Validate pitIndex is in current player's range and non-empty
  // 2. Scoop all seeds from pit
  // 3. Drop one seed counter-clockwise (direction based on player choice — for v1: always counter-clockwise from the picked pit)
  // 4. After last seed dropped:
  //    a. If next pit is empty AND the pit after that has seeds → CAPTURE the pit-after-that's seeds into current player's captured pile. Continue checking: if the NEXT-next pit is also empty, and the one after THAT has seeds, capture again. Stop when the chain breaks.
  //    b. If next pit is a quan → turn ends safely (no capture)
  //    c. If next pit has seeds → scoop and continue distributing (this is the "relay" rule)
  // 5. Switch currentPlayer
  // 6. Check end conditions

export function checkEndCondition(board: OAQBoard): OAQBoard;
  // End if:
  // - Both quan (pits[5] and pits[11]) are 0 (captured)
  // - Current player has no seeds in any of their small pits (can't move)
  // When ending: remaining seeds in each player's small pits go to that player's captured pile
  // Winner = player with more captured seeds. 1 quan equivalent = 10 seeds.

export function getScore(board: OAQBoard): { p1: number; p2: number };
  // Returns captured seed counts

export function boardToJSON(board: OAQBoard): string;
  // Serializes full state for tool return
```

> [!NOTE]
> **Capture rule detail:** After the last seed is placed, look at the NEXT pit in the sowing direction. If it's empty (0 seeds) and it's a small pit, check the pit AFTER that. If that pit has seeds, capture those seeds. Then check: is the NEXT pit after the captured one also empty? If so, capture the one after that too. This chain continues until you hit a non-empty pit, a quan, or the end. If the next pit after the last seed is a quan (index 5 or 11), no capture happens regardless.

> [!IMPORTANT]
> **Relay rule:** If the last seed lands in a pit that ALREADY has seeds (and it's not a quan), scoop up ALL seeds from that pit and continue sowing. This relay continues until the last seed lands in an empty pit (triggering capture check) or a quan (turn ends).

### 9b. `src/games/o-an-quan/scene.ts` — Board Rendering

**Purpose:** Renders the Ô ăn quan board using Three.js (top-down 2D-ish view) or DOM. Animates seed movements with GSAP.

**Approach:** Use a **2D DOM/Canvas overlay** inside `#game-container`. Three.js is optional here (spec says "keep it optional"). Prefer DOM for speed of implementation — use styled `<div>`s for pits and small circles/dots for seeds.

**Key exports:**
```typescript
import { OAQBoard } from './rules';

export function buildOAQScene(container: HTMLElement): void;
  // Creates the board DOM:
  //   - 12 pit elements (circular divs), arranged in 2 rows + 2 end ovals
  //   - Seed dots inside each pit (count-based)
  //   - Score display for each player
  //   - Turn indicator
  //   - Pit click handlers (for human player interaction)

export function updateBoardView(board: OAQBoard): void;
  // Re-renders seed counts in all pits, scores, turn indicator
  // Animate seed transitions with GSAP (seeds fly from pit to pit)

export function animateCapture(fromPit: number, toPlayer: 1 | 2, seedCount: number): Promise<void>;
  // GSAP animation: seeds fly from captured pit to player's score area
  // Play 'capture' SFX

export function animateSowing(pitSequence: number[], seedCounts: number[]): Promise<void>;
  // GSAP staggered animation: seeds drop one by one into sequential pits

export function destroyOAQScene(): void;
  // Remove all DOM elements, kill GSAP tweens
```

**Pit click integration:** When a human clicks a pit, it calls the `executeMove` from `rules.ts` directly (local play). The agent can also call `o_an_quan_pick_bin` tool to make moves.

### 9c. `src/games/o-an-quan/tools.ts` — WebMCP Tool Definitions

**4 tools, all namespaced with `o_an_quan_` prefix:**

#### `o_an_quan_new_game`
```typescript
{
  name: "o_an_quan_new_game",
  description: "Resets the Ô ăn quan board to starting position. 5 small pits per side, 2 quan pits, 5 seeds per small pit, 10 seeds per quan.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  execute: async () => {
    board = createBoard();
    updateBoardView(board);
    return JSON.stringify({
      status: "ok",
      message: "New game started",
      board: { pits: board.pits, currentPlayer: board.currentPlayer, captured: board.captured }
    });
  }
}
```

#### `o_an_quan_pick_bin`
```typescript
{
  name: "o_an_quan_pick_bin",
  description: "Scoops seeds from a pit and distributes counter-clockwise. Only valid for the current player's non-empty small pits (0-4 for P1, 6-10 for P2).",
  inputSchema: {
    type: "object",
    properties: {
      bin: { type: "number", description: "Pit index (0-4 for Player 1, 6-10 for Player 2)" }
    },
    required: ["bin"]
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  execute: async (input) => {
    if (!isValidMove(board, input.bin)) {
      return JSON.stringify({ status: "error", message: "Invalid move: pit is empty or not yours" });
    }
    board = executeMove(board, input.bin);
    await animateSowing(...); // animate the move
    updateBoardView(board);
    return JSON.stringify({
      status: "ok",
      board: { pits: board.pits, currentPlayer: board.currentPlayer, captured: board.captured, status: board.status, winner: board.winner }
    });
  }
}
```

#### `o_an_quan_state`
```typescript
{
  name: "o_an_quan_state",
  description: "Returns the current board state: pits, captured seeds, current player, and game status.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  execute: async () => {
    return JSON.stringify({
      status: "ok",
      board: { pits: board.pits, currentPlayer: board.currentPlayer, captured: board.captured, gameStatus: board.status, winner: board.winner }
    });
  }
}
```

#### `o_an_quan_score`
```typescript
{
  name: "o_an_quan_score",
  description: "Returns current scores (captured seeds) for both players.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  execute: async () => {
    const score = getScore(board);
    return JSON.stringify({
      status: "ok",
      score: { player1: score.p1, player2: score.p2 },
      leader: score.p1 > score.p2 ? "player1" : score.p2 > score.p1 ? "player2" : "tied"
    });
  }
}
```

### 9d. `src/games/o-an-quan/index.ts` — GameDef Barrel

```typescript
import { GameDef } from '../../types';
import { buildOAQScene, destroyOAQScene } from './scene';
import { oaqTools } from './tools';

export const oAnQuanDef: GameDef = {
  id: 'o-an-quan',
  name: 'Ô ăn quan',
  nameEn: 'Vietnamese Mancala',
  emoji: '🪨',
  minPlayers: 2,
  maxPlayers: 2,
  description: 'A classic Vietnamese strategy game. Two players take turns scooping seeds and capturing opponents\' pits. The player with the most seeds wins!',
  buildScene: buildOAQScene,
  destroyScene: destroyOAQScene,
  tools: oaqTools,
  saveKey: 'san_choi_oaq',
};
```

---

## 10. Game 2: Bầu cua tôm cá (Dice Betting)

### 10a. `src/games/bau-cua/rules.ts` — Pure Game Logic

**Types:**
```typescript
export type BauCuaSymbol = 'bau' | 'cua' | 'tom' | 'ca' | 'ga' | 'huou';

export const SYMBOLS: BauCuaSymbol[] = ['bau', 'cua', 'tom', 'ca', 'ga', 'huou'];

export const SYMBOL_NAMES: Record<BauCuaSymbol, { vi: string; en: string; emoji: string }> = {
  bau:  { vi: 'Bầu',  en: 'Gourd',   emoji: '🍐' },
  cua:  { vi: 'Cua',  en: 'Crab',    emoji: '🦀' },
  tom:  { vi: 'Tôm',  en: 'Shrimp',  emoji: '🦐' },
  ca:   { vi: 'Cá',   en: 'Fish',    emoji: '🐟' },
  ga:   { vi: 'Gà',   en: 'Chicken', emoji: '🐔' },
  huou: { vi: 'Hươu', en: 'Deer',    emoji: '🦌' },
};

export interface Bet {
  symbol: BauCuaSymbol;
  points: number;
}

export interface BauCuaState {
  playerPoints: number;
  bets: Bet[];             // current round's bets (placed before roll)
  lastRoll: BauCuaSymbol[] | null;  // 3 dice results
  roundHistory: Array<{
    bets: Bet[];
    roll: BauCuaSymbol[];
    netGain: number;
  }>;
  roundNumber: number;
  status: 'betting' | 'rolled' | 'resolved';
}
```

**Key functions:**
```typescript
export function createBauCuaGame(startingPoints?: number): BauCuaState;
  // Default 100 points, no bets, round 1, status 'betting'

export function placeBet(state: BauCuaState, symbol: BauCuaSymbol, points: number): BauCuaState;
  // Validate: status must be 'betting', points > 0, points <= playerPoints minus already-bet total
  // Add bet to bets array

export function rollDice(state: BauCuaState): BauCuaState;
  // Validate: status must be 'betting' and bets.length > 0
  // Roll 3 random symbols
  // Set status = 'rolled'
  // Return state with lastRoll set

export function resolveBets(state: BauCuaState): BauCuaState;
  // Validate: status must be 'rolled'
  // For each bet:
  //   count = how many dice show the bet's symbol
  //   if count == 0: lose the stake (deduct from playerPoints)
  //   if count >= 1: win (stake * count) net gain (keep original stake + winnings)
  // Push to roundHistory
  // Clear bets, increment roundNumber, set status = 'betting'
  // Return updated state

export function getBauCuaScore(state: BauCuaState): { points: number; roundNumber: number };
```

### 10b. `src/games/bau-cua/scene.ts` — Dice & Betting Mat Rendering

**Approach:** Use **Three.js** here — the dice are the showcase for 3D (spec says "Three.js earns its place here"). Render 3 dice cubes with symbol textures on faces. GSAP tumble animation on roll.

**Key exports:**
```typescript
export function buildBauCuaScene(container: HTMLElement): void;
  // 1. Create Three.js scene with 3 dice (cubes with symbol face textures)
  // 2. Betting mat: 6 symbol buttons (DOM overlay on top of canvas)
  //    Each button shows emoji + Vietnamese name + bet input
  // 3. Points display, round counter
  // 4. "Roll" button (big, kid-friendly)
  // 5. Wire up camera, lights, renderer

export function animateDiceRoll(results: BauCuaSymbol[]): Promise<void>;
  // GSAP: dice tumble randomly for 1.5s, then settle on correct faces
  // Play 'dice_roll' SFX
  // If all 3 same → screen shake + "XỐC! BA CON!" toast

export function updateBauCuaView(state: BauCuaState): void;
  // Update points display, bet indicators, dice faces

export function animateWinnings(amount: number): Promise<void>;
  // GSAP: coins/points fly to player's score
  // Play 'coin' SFX

export function animateLoss(amount: number): Promise<void>;
  // GSAP: points fade away with sad wobble

export function destroyBauCuaScene(): void;
```

**Dice face mapping:** Each die is a cube. The 6 faces map to the 6 symbols. Use either:
- Canvas-drawn textures (draw emoji onto canvas, use as `CanvasTexture`)
- Or simple colored faces with text overlays

### 10c. `src/games/bau-cua/tools.ts` — WebMCP Tool Definitions

**4 tools:**

#### `bau_cua_place_bet`
```typescript
{
  name: "bau_cua_place_bet",
  description: "Places a bet on a symbol for the current round. Can place multiple bets on different symbols.",
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string", enum: ["bau", "cua", "tom", "ca", "ga", "huou"], description: "Symbol to bet on" },
      points: { type: "number", description: "Number of points to wager (fake points, kid-safe)" }
    },
    required: ["symbol", "points"]
  },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  execute: async (input) => {
    state = placeBet(state, input.symbol, input.points);
    updateBauCuaView(state);
    return JSON.stringify({
      status: "ok",
      message: `Bet ${input.points} points on ${SYMBOL_NAMES[input.symbol].vi}`,
      currentBets: state.bets,
      remainingPoints: state.playerPoints - state.bets.reduce((s, b) => s + b.points, 0)
    });
  }
}
```

#### `bau_cua_roll`
```typescript
{
  name: "bau_cua_roll",
  description: "Rolls 3 dice. Must have at least one bet placed. Returns the symbols that appeared.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  execute: async () => {
    state = rollDice(state);
    await animateDiceRoll(state.lastRoll!);
    const counts: Record<string, number> = {};
    for (const s of state.lastRoll!) counts[s] = (counts[s] || 0) + 1;
    return JSON.stringify({
      status: "ok",
      roll: state.lastRoll,
      counts,
      message: state.lastRoll!.map(s => SYMBOL_NAMES[s].vi).join(' — ')
    });
  }
}
```

#### `bau_cua_resolve`
```typescript
{
  name: "bau_cua_resolve",
  description: "Settles all bets against the current roll. Returns winnings/losses and updates points.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  execute: async () => {
    const prevPoints = state.playerPoints;
    state = resolveBets(state);
    const netGain = state.playerPoints - prevPoints;
    updateBauCuaView(state);
    if (netGain > 0) await animateWinnings(netGain);
    else if (netGain < 0) await animateLoss(-netGain);
    return JSON.stringify({
      status: "ok",
      netGain,
      totalPoints: state.playerPoints,
      roundNumber: state.roundNumber,
      message: netGain >= 0 ? `Won ${netGain} points!` : `Lost ${-netGain} points`
    });
  }
}
```

#### `bau_cua_state`
```typescript
{
  name: "bau_cua_state",
  description: "Returns current game state: points, active bets, last roll, round number.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  execute: async () => {
    return JSON.stringify({
      status: "ok",
      playerPoints: state.playerPoints,
      bets: state.bets,
      lastRoll: state.lastRoll,
      roundNumber: state.roundNumber,
      gameStatus: state.status
    });
  }
}
```

### 10d. `src/games/bau-cua/index.ts` — GameDef Barrel

```typescript
import { GameDef } from '../../types';
import { buildBauCuaScene, destroyBauCuaScene } from './scene';
import { bauCuaTools } from './tools';

export const bauCuaDef: GameDef = {
  id: 'bau-cua',
  name: 'Bầu cua tôm cá',
  nameEn: 'Gourd-Crab-Shrimp-Fish',
  emoji: '🦀',
  minPlayers: 1,
  maxPlayers: 6,
  description: 'The classic Vietnamese Tết dice game! Bet fake points on 6 animal symbols, roll 3 dice, and win 1×/2×/3× your stake based on how many dice match.',
  buildScene: buildBauCuaScene,
  destroyScene: destroyBauCuaScene,
  tools: bauCuaTools,
  saveKey: 'san_choi_baucua',
};
```

---

## 11. localStorage Persistence Strategy

**Per-game saves** use `game.saveKey`:
```typescript
// In each game's tools.ts or rules.ts:
function saveGameState(state: GameState): void {
  localStorage.setItem(saveKey, JSON.stringify(state));
}
function loadGameState(): GameState | null {
  const data = localStorage.getItem(saveKey);
  return data ? JSON.parse(data) : null;
}
```

**Global ledger** at key `"san_choi_ledger"`:
```typescript
interface GlobalLedger {
  gamesPlayed: Record<string, number>;  // { "o-an-quan": 5, "bau-cua": 3 }
  totalSessions: number;
  lastPlayed: string; // ISO timestamp
}
```

The `save_progress` global tool saves the *current game's* state via its `saveKey`, and increments the ledger.

---

## 12. Funny-Hook Integration Points

Each hook is implemented inline in the relevant `scene.ts` or `tools.ts`:

| Hook | Trigger | Location | Effect |
|---|---|---|---|
| Ô quan grumble | Agent picks a losing move | `o-an-quan/tools.ts` `o_an_quan_pick_bin` execute | Stone wobbles, toast: `"Ô quan nói: đừng hấp tấp!"` |
| Triple symbol | All 3 dice show same symbol | `bau-cua/scene.ts` `animateDiceRoll` | Screen shake + toast: `"XỐC! BA CON!"` |
| Unsaved actions | Agent queues >5 tool calls without `save_progress` | `webmcp.ts` (counter in a wrapper) | Toast: `"Người xướng trò bị rối"` |

---

## 13. `make_audio.py` Extensions

Add new sound synthesis functions after the existing ones:

```python
# capture.wav — bright pentatonic arpeggio chime (Ô ăn quan capture)
# dice_roll.wav — rattling percussive noise (0.8s)
# win_chime.wav — ascending major triad fanfare
# coin.wav — short metallic ping
# festive.mp3 — upbeat pentatonic loop for bầu cua
# gong.mp3 — single gong hit + reverb tail, loopable
```

Output to `public/assets/audio/`. Same pure-stdlib synthesis approach.

---

## 14. Final File Tree

```
├── index.html                    # MODIFIED: Sân Chơi branding
├── src/
│   ├── main.ts                   # REWRITTEN: hub bootstrap + WebMCP init
│   ├── types.ts                  # NEW: shared interfaces
│   ├── hub.ts                    # NEW: game launcher card grid
│   ├── webmcp.ts                 # NEW: single choke-point registration
│   ├── ui.ts                     # MODIFIED: shared overlays/toasts
│   ├── audio.ts                  # MODIFIED: extended SFX/BGM
│   ├── games/
│   │   ├── index.ts              # NEW: game registry
│   │   ├── o-an-quan/
│   │   │   ├── index.ts          # NEW: GameDef barrel
│   │   │   ├── rules.ts          # NEW: pure mancala logic
│   │   │   ├── scene.ts          # NEW: board rendering + GSAP
│   │   │   └── tools.ts          # NEW: 4 WebMCP tools
│   │   └── bau-cua/
│   │       ├── index.ts          # NEW: GameDef barrel
│   │       ├── rules.ts          # NEW: pure dice/betting logic
│   │       ├── scene.ts          # NEW: 3D dice + betting mat
│   │       └── tools.ts          # NEW: 4 WebMCP tools
├── public/assets/
│   ├── audio/                    # EXTENDED: new SFX/BGM files
│   └── puppets/                  # KEEP (may reuse SVGs as decorations)
├── make_audio.py                 # EXTENDED: new sound generators
├── vite.config.ts                # UNCHANGED
├── package.json                  # name → "san-choi"
└── tsconfig.json                 # UNCHANGED
```

**DELETED files:**
- `src/puppet.ts`
- `src/animation.ts`
- `src/scene.ts`
- `src/state.ts`
- `src/tools.ts`

---

## 15. WebMCP Gotchas Checklist

> [!CAUTION]
> 1. **`execute()` MUST return `string`, not object.** Always `JSON.stringify(...)`. Returning an object → `"[object Object]"` in the model's context.
> 2. **`registerTool` is async.** Await each call. Some implementations may reject if the tool name collides — use unique namespaced names.
> 3. **Single `AbortController` for all tools.** Create one in `webmcp.ts`, pass its `signal` to every `registerTool`. On page unload, `.abort()` once.
> 4. **`document.modelContext` may appear late.** Check on DOMContentLoaded AND after a short delay. The Chrome WebMCP surface can inject `modelContext` asynchronously.
> 5. **Tool names must be `[a-z0-9_]+`.** No hyphens, no uppercase. `o_an_quan_pick_bin` ✅, `o-an-quan-pick-bin` ❌.
> 6. **`inputSchema` must be JSON Schema draft-compatible.** Use `type: "object"`, `properties`, `required`. Don't use TypeScript types here — use plain JSON Schema.
> 7. **`annotations.readOnlyHint`** — set `true` for read-only tools (`*_state`, `*_score`, `list_games`), `false` for mutating tools. This is a signal to the model about side effects.
> 8. **Tool count limit.** Chrome 150 may silently cap at ~50 tools. With 4+4+4 game tools + 4 global = 16 total, we're well under.

---

## 16. Ordered Task List

Execute these tasks in order. Each task is a discrete unit of work.

1. **Create `src/types.ts`** — shared `WebMCPTool`, `ModelContext`, `GameDef`, `GameToolDef` interfaces + global type augmentations (`Window.__debugTools`, `Document.modelContext`).

2. **Create `src/games/` directory structure** — create empty files: `src/games/index.ts`, `src/games/o-an-quan/index.ts`, `src/games/o-an-quan/rules.ts`, `src/games/o-an-quan/scene.ts`, `src/games/o-an-quan/tools.ts`, `src/games/bau-cua/index.ts`, `src/games/bau-cua/rules.ts`, `src/games/bau-cua/scene.ts`, `src/games/bau-cua/tools.ts`.

3. **Implement `src/games/o-an-quan/rules.ts`** — pure game logic: `createBoard`, `isValidMove`, `executeMove` (with relay + capture chain), `checkEndCondition`, `getScore`, `boardToJSON`. No imports except types.

4. **Implement `src/games/o-an-quan/scene.ts`** — DOM-based board rendering inside `#game-container`. 12 pit `<div>`s arranged in 2 rows + 2 end ovals. Seed dots. Click handlers. GSAP sowing + capture animations. `buildOAQScene`, `updateBoardView`, `animateCapture`, `animateSowing`, `destroyOAQScene`.

5. **Implement `src/games/o-an-quan/tools.ts`** — define and export `oaqTools: GameToolDef[]` array with 4 tools: `o_an_quan_new_game`, `o_an_quan_pick_bin`, `o_an_quan_state`, `o_an_quan_score`. Each `execute` calls rules functions and returns JSON string.

6. **Implement `src/games/o-an-quan/index.ts`** — assemble and export `oAnQuanDef: GameDef`.

7. **Implement `src/games/bau-cua/rules.ts`** — pure game logic: `createBauCuaGame`, `placeBet`, `rollDice`, `resolveBets`, `getBauCuaScore`. Types: `BauCuaSymbol`, `Bet`, `BauCuaState`.

8. **Implement `src/games/bau-cua/scene.ts`** — Three.js scene with 3 dice cubes (canvas-drawn symbol textures on faces). DOM overlay betting mat with 6 symbol buttons. GSAP dice tumble animation. Points display. `buildBauCuaScene`, `animateDiceRoll`, `updateBauCuaView`, `animateWinnings`, `destroyBauCuaScene`.

9. **Implement `src/games/bau-cua/tools.ts`** — define and export `bauCuaTools: GameToolDef[]` array with 4 tools: `bau_cua_place_bet`, `bau_cua_roll`, `bau_cua_resolve`, `bau_cua_state`.

10. **Implement `src/games/bau-cua/index.ts`** — assemble and export `bauCuaDef: GameDef`.

11. **Implement `src/games/index.ts`** — import both game defs, export `games` array and `getGameById` helper.

12. **Implement `src/hub.ts`** — `HubState`, `renderHub` (card grid), `startGame`, `returnToHub`, `loadLedger`, `saveLedger`.

13. **Implement `src/webmcp.ts`** — `initWebMCP` (register all game tools + 4 global tools via `document.modelContext.registerTool` or `__debugTools` fallback), `cleanupWebMCP`. Single `AbortController`. Global tools: `list_games`, `start_game`, `set_music`, `save_progress`.

14. **Rewrite `src/main.ts`** — import `initWebMCP`, `renderHub`, `initAudio`, `setupUI`. Gate click → audio init + render hub. Call `initWebMCP()`. Remove all puppet-specific code.

15. **Modify `src/ui.ts`** — remove saved-shows drawer code. Add `showToast`, `showBackButton`, `hideBackButton`, `showTurnBanner`, `hideTurnBanner`. Keep `updateWebMCPStatus`.

16. **Modify `src/audio.ts`** — add new SFX keys (`capture`, `dice_roll`, `win_chime`, `coin`). Extend `playBGM` to support multiple named tracks via a lookup map.

17. **Modify `index.html`** — rebrand to Sân Chơi (title, gate text, gate chars, footer). Replace `#canvas-container` with `#game-container`. Remove `#saved-drawer` + `#drawer-tab`. Update `#teu-popup` default text.

18. **Update `package.json`** — rename `name` to `"san-choi"`.

19. **Delete old files** — remove `src/puppet.ts`, `src/animation.ts`, `src/scene.ts` (old water scene), `src/state.ts` (old puppet state), `src/tools.ts` (old flat tools).

20. **Extend `make_audio.py`** — add synthesis for `capture.wav`, `dice_roll.wav`, `win_chime.wav`, `coin.wav`. Run it to generate new audio assets into `public/assets/audio/`.

21. **Build & smoke test** — run `npm run build` to verify TypeScript compiles. Run `npm run dev` and test: gate → hub → start Ô ăn quan → play a few moves → back to hub → start Bầu cua → place bet → roll → resolve. Test `window.__debugTools` in DevTools console.

22. **Wire up funny-hooks** — add the "ô quan grumble" wobble in `o-an-quan/tools.ts`, the "XỐC! BA CON!" triple-symbol screen shake in `bau-cua/scene.ts`, and the "người xướng trò bị rối" unsaved-actions counter in `webmcp.ts`.

23. **localStorage persistence** — verify `save_progress` tool writes to correct `saveKey`. Verify loading saved state on `buildScene`. Test the global ledger increments on game start.

24. **Final QA pass** — exercise every tool via `window.__debugTools` in DevTools. Verify all 12 game tools + 4 global tools = 16 total are registered or exposed. Confirm all `execute()` returns are valid JSON strings. Check no console errors on page load.
