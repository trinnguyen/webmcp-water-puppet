# AI Water Puppet Director - Implementation Plan

## 1. Module Breakdown

### `src/main.ts`
- **Purpose:** Application entry point. Initializes the app, sets up WebMCP or fallback, and boots the rendering loop.
- **Key Signatures:**
  - `async function initApp(): Promise<void>`
  - `function bootRenderLoop(): void`
- **Responsibilities:** Bootstrapping the app. Does NOT contain scene logic or tool definitions.
- **Dependencies:** `scene.ts`, `tools.ts`, `ui.ts`

### `src/scene.ts`
- **Purpose:** Configures Three.js environment (camera, lights, renderer, water plane).
- **Key Signatures:**
  - `function initScene(canvas: HTMLCanvasElement): { scene: Scene, camera: Camera, renderer: WebGLRenderer }`
  - `function renderFrame(): void`
- **Responsibilities:** Environment and rendering loop. Does NOT manage puppet instances directly.
- **Dependencies:** `three`

### `src/puppet.ts`
- **Purpose:** Handles the creation and visual updates of 3D puppet sprites and their sticks.
- **Key Signatures:**
  - `function createPuppet(state: PuppetState): Object3D`
  - `function updatePuppetVisuals(puppet: Object3D, state: PuppetState): void`
- **Responsibilities:** 3D representation of puppets. Does NOT store global application state.
- **Dependencies:** `three`, `state.ts`

### `src/tools.ts`
- **Purpose:** Defines and registers WebMCP tools, exposing app capabilities to the agent.
- **Key Signatures:**
  - `async function registerTools(signal: AbortSignal): Promise<void>`
  - `function exposeFallbackTools(): void`
- **Responsibilities:** Interfacing with `document.modelContext`. Does NOT execute animations directly (relies on state/animation modules).
- **Dependencies:** `state.ts`, `animation.ts`, `audio.ts`

### `src/state.ts`
- **Purpose:** Manages the source of truth (app state) and `localStorage` persistence.
- **Key Signatures:**
  - `function getActiveShow(): ShowState`
  - `function addPuppet(state: PuppetState): void`
  - `function queueMove(move: MoveAction): void`
  - `function saveShow(name: string): void`
- **Responsibilities:** Data logic and persistence. Does NOT render UI or 3D graphics.
- **Dependencies:** None

### `src/animation.ts`
- **Purpose:** Orchestrates GSAP animations based on the move queue.
- **Key Signatures:**
  - `function processMoveQueue(): void`
  - `function executeAction(puppetObj: Object3D, action: ActionType, targetObj?: Object3D): Promise<void>`
- **Responsibilities:** Timing and tweening. Incorporates "Funny-Hook" logic (e.g., Tangled Strings). Does NOT manage Three.js scene setup.
- **Dependencies:** `gsap`, `scene.ts` (for fetching objects), `state.ts`

### `src/audio.ts`
- **Purpose:** Manages HTML5 Audio playback for BGM and sound effects.
- **Key Signatures:**
  - `async function initAudio(): Promise<void>`
  - `function playBGM(track: string): void`
  - `function playSFX(sfxName: string): void`
- **Responsibilities:** Audio playback and mute state. Does NOT interact with the DOM directly.
- **Dependencies:** None

### `src/ui.ts`
- **Purpose:** Manages the simple DOM overlay (mute button, show name, saved shows drawer).
- **Key Signatures:**
  - `function setupUI(onEnterStage: () => void): void`
  - `function updateUIState(appState: AppState): void`
- **Responsibilities:** DOM manipulation for 2D UI. Does NOT handle 3D canvas events.
- **Dependencies:** `state.ts`, `audio.ts`

### `index.html`
- **Purpose:** Main HTML file containing the canvas and UI overlay containers.
- **Responsibilities:** Structure and asset loading.
- **Dependencies:** `src/main.ts`

### `package.json`
- **Purpose:** NPM dependencies and scripts.

### `vite.config.ts`
- **Purpose:** Vite bundler configuration (setting base path for GitHub Pages).

### `tsconfig.json`
- **Purpose:** TypeScript compiler configuration for browser environment.


## 2. WebMCP Tool Registration

### Registration Pattern & Template
We use the verified `document.modelContext.registerTool` API.
```typescript
import { Tool } from 'webmcp-types';

export async function registerSpawnPuppet(signal: AbortSignal) {
  const spawnTool: Tool = {
    name: "spawn_puppet",
    description: "Adds a puppet to the water stage at given coordinates (-10 to 10).",
    inputSchema: {
      type: "object",
      properties: {
        character: { type: "string", enum: ["teu", "dragon", "farmer", "fish"] },
        id: { type: "string" },
        x: { type: "number" },
        z: { type: "number" }
      },
      required: ["character", "id", "x", "z"]
    },
    execute: async (input: any) => {
      // Validate input, update state, trigger visual creation
      const { character, id, x, z } = input;
      addPuppet({ character, id, x, z });
      return JSON.stringify({ status: "success", message: `Spawned ${character} at ${x},${z}` });
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false }
  };
  
  await document.modelContext.registerTool(spawnTool, { signal });
}
```

### Graceful Fallback
If WebMCP is not available, expose tools to `window` for dev testing.
```typescript
declare global {
  interface Window {
    __debugTools: Record<string, (input: any) => Promise<string>>;
  }
}

export function initTools() {
  // All tool execute functions (shared between WebMCP and fallback)
  const toolExecutors = {
    list_cast: async () => JSON.stringify({
      characters: ['teu', 'dragon', 'farmer', 'fish'],
      descriptions: { teu: 'Chú Tễu - The Jester', dragon: 'Rồng', farmer: 'Nông Dân', fish: 'Cá' }
    }),
    spawn_puppet: async (input: any) => {
      addPuppet(input);
      return JSON.stringify({ status: 'ok', spawned: input.id });
    },
    choreograph_move: async (input: any) => {
      queueMove(input);
      return JSON.stringify({ status: 'queued', move: input.action });
    },
    set_music: async (input: any) => {
      playBGM(input.track);
      return JSON.stringify({ status: 'playing', track: input.track });
    },
    save_show: async (input: any) => {
      saveShow(input.showName);
      return JSON.stringify({ status: 'saved', name: input.showName });
    },
  };

  if (typeof document.modelContext !== 'undefined') {
    console.log('[WebMCP] ✅ Context detected. Registering 5 tools...');
    const controller = new AbortController();
    registerAllTools(controller.signal, toolExecutors);

    // Listen for tool visibility changes from the agent
    document.modelContext.addEventListener('toolchange', (e) => {
      console.log('[WebMCP] Tool change event:', e);
    });

    // Store controller for potential cleanup
    (window as any).__webmcpController = controller;
  } else {
    console.warn('[WebMCP] ❌ Not available. Exposing window.__debugTools for DevTools.');
    console.info('[WebMCP] Usage: __debugTools.spawn_puppet({character:"teu", id:"t1", x:0, z:0})');
    window.__debugTools = toolExecutors;
  }
}
```

### Unregistration
```typescript
// To cleanly unregister all tools (e.g., on page unload):
function cleanupTools() {
  const controller = (window as any).__webmcpController;
  if (controller) controller.abort(); // AbortController unregisters all tools
}
window.addEventListener('beforeunload', cleanupTools);
```

## 3. Data Flow

### Complete Pipeline
```
Agent (ChatGPT) ──tool call──▶ tools.ts execute()
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              spawn_puppet    choreograph_move   save_show
                    │               │               │
                    ▼               ▼               ▼
              state.ts          state.ts         state.ts
              addPuppet()       queueMove()      saveShow()
                    │               │            (→ localStorage)
                    │               │               │
           ┌── HOOK CHECK ──┐  ┌── HOOK CHECK ──┐  └─ HOOK: Applause
           │  Fish Panic?    │  │  Tễu 4th Wall? │    Break (all wave)
           │  (dragon near   │  │  (>5 unsaved   │
           │   fish → flee)  │  │   moves?)      │
           └────────┬────────┘  └────────┬───────┘
                    ▼                    ▼
              puppet.ts          animation.ts
              createPuppet()     processMoveQueue()
                    │                    │
                    │           ┌── HOOK CHECK ──┐
                    │           │  Dragon Sneeze? │
                    │           │  Tangled String?│
                    │           │  Sleepy Farmer? │
                    │           └────────┬───────┘
                    ▼                    ▼
              scene.ts           GSAP Timeline
              (add to scene)     (tween puppet meshes)
                    │                    │
                    └────────┬───────────┘
                             ▼
                      renderer.render()
                      (Three.js frame loop)
```

### Hook Intercept Points (Detail)
1. **On `spawn_puppet`:** After `addPuppet()`, scan all Fish puppets. If any Fish is within 3 units of the new Dragon, immediately queue a flee animation for that Fish (bypassing the normal queue).
2. **On `choreograph_move`:** Increment `unsavedMoveCount` in state. If count > 5, trigger Tễu 4th wall slide-in.
3. **During `executeAction(splash)` for Dragon:** Roll `Math.random() < 0.1`. If true, replace splash particles with red flash + sneeze SFX.
4. **On tool execution error:** Catch in `execute()`, trigger `tangledStrings()` in animation.ts (all puppets shake + freeze).
5. **On `save_show`:** Reset `unsavedMoveCount`. Trigger Applause Break (all puppets wave).
6. **Idle timer:** `setInterval` in animation.ts checks Farmer's last-command timestamp. If >10s, sink + Zzz.

## 4. Day-by-Day Implementation Schedule

### Day 1: Foundation & 3D Environment (Aug 29)
- **Modules:** `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/scene.ts`
- **Functions to write:**
  - `initScene(canvas): { scene, camera, renderer, water }`
  - `startRenderLoop(scene, camera, renderer, water): void`
  - `main.ts`: entry point that gets canvas from DOM and calls initScene
- **Acceptance Criteria:**
  - [ ] `npm run dev` starts Vite on localhost:5173
  - [ ] Full-screen canvas renders the Three.js Water plane with animated ripples
  - [ ] Camera is angled ~30° down at (0, 8, 15) looking at origin
  - [ ] Directional + ambient lights visible on water reflections
  - [ ] `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))` is set
  - [ ] Window resize handler updates camera aspect ratio + renderer size
- **Risk:** Water shader may fail on older mobile GPUs — have a flat blue `MeshStandardMaterial` fallback ready

### Day 2: Puppets & State (Aug 30)
- **Modules:** `src/state.ts`, `src/puppet.ts`, `src/tools.ts` (fallback only)
- **Functions to write:**
  - `state.ts`: `getState()`, `addPuppet()`, `removePuppet()`, `queueMove()`, `saveShow()`, `loadShows()`, all type definitions
  - `puppet.ts`: `createPuppet(state): Group` (sprite + stick cylinder), `getPuppetById(id): Group | null`
  - `tools.ts`: `initTools()` with full `window.__debugTools` fallback
- **Acceptance Criteria:**
  - [ ] Open DevTools, run: `__debugTools.spawn_puppet({character:'teu', id:'t1', x:0, z:0})`
  - [ ] See Tễu sprite appear on water surface with brown stick extending below
  - [ ] Run: `__debugTools.spawn_puppet({character:'dragon', id:'d1', x:5, z:-3})`
  - [ ] Dragon appears at correct position — both puppets billboard toward camera
  - [ ] Run: `__debugTools.list_cast()` — returns JSON with 4 characters
  - [ ] Console shows `[WebMCP] ❌ Not available. Exposing window.__debugTools`
  - [ ] Spawning 16th puppet is rejected (cap at 15)
- **Risk:** Sprite sizing relative to world units — test at multiple viewport sizes

### Day 3: Animation & Funny Hooks (Aug 31)
- **Modules:** `src/animation.ts` (primary), hook logic in `src/state.ts`
- **Functions to write:**
  - `animation.ts`: `processMoveQueue()`, `executeAction(puppet, action, target?)`, `tangledStrings()`, `fishPanic(fishObj)`, `teuFourthWall()`
  - Individual tween builders: `splashTween()`, `spinTween()`, `chaseTween()`, `waveTween()`, `jumpTween()`
- **Acceptance Criteria:**
  - [ ] `__debugTools.choreograph_move({id:'t1', action:'splash'})` — Tễu bounces up/down with elastic ease
  - [ ] `__debugTools.choreograph_move({id:'t1', action:'spin'})` — Tễu rotates 360°
  - [ ] `__debugTools.choreograph_move({id:'t1', action:'chase', targetId:'d1'})` — Tễu slides to Dragon's position
  - [ ] `__debugTools.choreograph_move({id:'t1', action:'chase', targetId:'nonexistent'})` — triggers Tangled Strings (all puppets jiggle)
  - [ ] Queue 6 moves without saving → Tễu 4th wall popup appears
  - [ ] Spawn fish at (0,0), then spawn dragon at (1,0) → Fish Panic auto-triggers
  - [ ] Queue dragon splash 10+ times → eventually triggers Dragon Sneeze (10% chance)
- **Risk:** GSAP timeline conflicts when multiple tweens target same object — use `gsap.killTweensOf(target)` before new tween

### Day 4: WebMCP, Audio & UI (Sep 1)
- **Modules:** `src/tools.ts` (WebMCP path), `src/audio.ts`, `src/ui.ts`
- **Functions to write:**
  - `tools.ts`: `registerAllTools(signal, executors)` — register all 5 tools with `document.modelContext`
  - `audio.ts`: `initAudio()`, `playBGM(track)`, `playSFX(name)`, `toggleMute()`, `isMuted(): boolean`
  - `ui.ts`: `setupUI(callbacks)`, `showGate()`, `hideGate()`, `updateShowName()`, `renderSavedShows()`, `showDrawer()`, `hideDrawer()`
- **Acceptance Criteria:**
  - [ ] Startup gate appears on load with "🔊 Mở Màn" button
  - [ ] Clicking button dismisses gate, unlocks AudioContext, starts BGM
  - [ ] Mute button toggles audio; state persists in localStorage
  - [ ] `__debugTools.set_music({track:'dan_bau'})` plays background music
  - [ ] `__debugTools.set_music({track:'silent'})` stops music
  - [ ] `__debugTools.save_show({showName:'Test Show'})` saves to localStorage
  - [ ] Saved shows appear in bottom drawer; clicking one loads it
  - [ ] In ChatGPT desktop app: tools register successfully (verify via `document.modelContext` check)
  - [ ] Portrait orientation shows rotation hint
- **Risk:** iOS AudioContext quirks — test on Safari; ensure gate click runs `audioContext.resume()`

### Day 5: Polish, QA & Deploy (Sep 2–3)
- **Modules:** All modules (bug fixes), `.github/workflows/deploy.yml`, `README.md`
- **Tasks:**
  - Fix mobile layout issues (safe area insets, notch handling)
  - Add sky gradient backdrop behind water (warm sunset)
  - Add lantern accent sprites (2-3 paper lanterns framing the stage)
  - Performance profiling on mid-range phone (target 30fps minimum)
  - Write README with screenshots, setup instructions, WebMCP explanation
  - Record 2-minute Devpost demo video
  - Deploy to GitHub Pages via Actions
  - Add `LICENSE` file (MIT or Apache 2.0) visible in repo
- **Acceptance Criteria:**
  - [ ] App loads on GitHub Pages URL
  - [ ] Full demo flow works: gate → spawn → animate → save → reload → replay
  - [ ] All 6 funny hooks verified working
  - [ ] Runs at ≥30fps on a mid-range phone (e.g., Pixel 6a, Samsung A54)
  - [ ] Video recorded and uploaded to Devpost
  - [ ] README has: setup instructions, screenshot, WebMCP implementation explanation
  - [ ] Open-source license file present in repo root

## 5. npm Dependencies

- `three` (^0.160.0): Core 3D engine. Essential for Water shaders and Sprite billboarding.
- `@types/three` (^0.160.0): TS definitions for Three.js.
- `gsap` (^3.12.0): Animation orchestrator. Replaces tedious `requestAnimationFrame` interpolation.
- `typescript` (^5.3.0): Language core.
- `vite` (^5.0.0): Fast dev server and static bundler. Perfect for zero-backend apps.
- `webmcp-types` (latest): Provides typings for `document.modelContext` and tool structures.

## 6. Build & Deploy

### `vite.config.ts`
Set the base path to match the GitHub repo name for Pages deployment.
```typescript
import { defineConfig } from 'vite';
export default defineConfig({
  base: '/webmcp-water-puppet/'
});
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### GitHub Actions (`.github/workflows/deploy.yml`)
Standard Vite -> GH Pages workflow:
```yaml
name: Deploy WebMCP App
on:
  push:
    branches: [ main ]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run build
      - uses: actions/upload-pages-artifact@v2
        with:
          path: './dist'
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v2
```

### Local Dev Commands
- `npm run dev`: Starts local server (Vite).
- `npm run build`: Compiles TS and bundles assets into `dist/`.
- `npm run preview`: Serves the production build locally.
