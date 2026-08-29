# BUILD SPEC: The AI Water Puppet Director (Đạo Diễn Múa Rối Nước)

## 1. TECH STACK & DEPLOYMENT
- **Core:** Vanilla TypeScript + Vite. 
  - *Rationale:* 5-day deadline means zero time for boilerplate. React/Next.js DOM-sync overhead is useless for a canvas-first 3D app. Vite is fast, outputs static files, works perfectly for solo devs.
- **3D Engine:** Three.js (npm). 
  - *Rationale:* Built-in water shaders. Billboarding 2D sprites is trivial. 
- **Animation:** GSAP. 
  - *Rationale:* Writing manual `requestAnimationFrame` tweens is a time sink. GSAP handles sequential timelines cleanly.
- **Storage:** `localStorage`. 
  - *Rationale:* No backend required. Fits the free constraint perfectly.
- **Deployment:** GitHub Pages. 
  - *Rationale:* Free, zero config with Vite base path, easy CI/CD.

## 2. REPO / FILE STRUCTURE
Keep it flat, pragmatic.
```text
├── public/
│   ├── assets/
│   │   ├── puppets/ (teu.png, dragon.png, farmer.png, fish.png)
│   │   ├── audio/ (bgm.mp3, splash.wav, sneeze.wav)
│   │   └── textures/ (waternormals.jpg)
├── src/
│   ├── main.ts         # Entry, WebMCP init, fallback logic
│   ├── scene.ts        # Three.js setup (lights, camera, water)
│   ├── puppet.ts       # Sprite billboarding, stick geometry
│   ├── tools.ts        # WebMCP schemas and tool registration
│   ├── state.ts        # localStorage read/write, TS types
│   ├── animation.ts    # GSAP queue orchestration
│   ├── audio.ts        # HTMLAudio wrapper
│   └── ui.ts           # Simple DOM overlay
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 3. WEBMCP TOOL DEFINITIONS
Assuming the `document.modelContext.registerTool({name, description, inputSchema, execute})` signature. 

```json
// Tool: list_cast
{
  "name": "list_cast",
  "description": "Returns available traditional Vietnamese water puppet characters.",
  "inputSchema": { "type": "object", "properties": {} }
}

// Tool: spawn_puppet
{
  "name": "spawn_puppet",
  "description": "Adds a puppet to the water stage at given coordinates (-10 to 10).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "character": { "type": "string", "enum": ["teu", "dragon", "farmer", "fish"] },
      "id": { "type": "string", "description": "Unique ID for this puppet instance" },
      "x": { "type": "number", "description": "Left/Right position (-10 to 10)" },
      "z": { "type": "number", "description": "Depth position (-10 to 10)" }
    },
    "required": ["character", "id", "x", "z"]
  }
}

// Tool: choreograph_move
{
  "name": "choreograph_move",
  "description": "Queues an action for a specific puppet on stage.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "action": { "type": "string", "enum": ["splash", "spin", "chase", "wave", "jump"] },
      "targetId": { "type": "string", "description": "Required only if action is 'chase'" }
    },
    "required": ["id", "action"]
  }
}

// Tool: set_music
{
  "name": "set_music",
  "description": "Plays traditional background music.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "track": { "type": "string", "enum": ["dan_bau", "gong", "silent"] }
    },
    "required": ["track"]
  }
}

// Tool: save_show
{
  "name": "save_show",
  "description": "Saves current stage setup and move queue to local storage.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "showName": { "type": "string" }
    },
    "required": ["showName"]
  }
}
```

## 4. STATE MODEL
Direct mutations in memory for speed, serialize on `save_show`.

```typescript
type Character = 'teu' | 'dragon' | 'farmer' | 'fish';
type ActionType = 'splash' | 'spin' | 'chase' | 'wave' | 'jump';

interface PuppetState {
  id: string;
  character: Character;
  x: number;
  z: number;
}

interface MoveAction {
  id: string;
  action: ActionType;
  targetId?: string; // Used for 'chase'
}

interface ShowState {
  name: string;
  music: string;
  cast: PuppetState[];
  moves: MoveAction[]; // The choreography queue
}

// Global runtime state
interface AppState {
  activeShow: ShowState;
  savedShows: Record<string, ShowState>;
}
```

## 5. 3D SCENE SPEC
- **Water Plane:** `three/examples/jsm/objects/Water.js`. Flat plane geometry + normal map (`waternormals.jpg`). Beautiful, cheap on GPU.
- **Puppets:** `THREE.Sprite` with transparent PNGs (1024x1024 max). Free billboarding (always faces camera), looks like a flat 2D wooden puppet.
- **The Stick:** `THREE.CylinderGeometry`, color dark brown, attached below the sprite extending below the water plane to sell the illusion.
- **Lighting:** One `DirectionalLight` (spotlight) + `AmbientLight`.
- **Camera:** `PerspectiveCamera`, fixed angled down ~30 degrees looking at `(0,0,0)`. No user orbit controls to keep the stage illusion.
- **Performance Budget:** 
  - `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))` for mid-range phones.
  - Hard cap at 15 puppets. 
  - Water segments kept to 128x128.

## 6. ANIMATION SYSTEM
- **Queue Loop:** Agent pushes moves. GSAP timeline executes them sequentially.
- **Tweens:**
  - `splash`: Quick Y-axis up/down + trigger 3D particle burst (simple geometry) at base.
  - `spin`: Tween `rotation.y` 360 degrees.
  - `chase`: Tween X/Z coordinates to `targetId` coordinates over 1.5s.
  - `wave`: Ping-pong rotation on Z-axis.
  - `jump`: Parabolic arc on Y-axis.
- **Conflict Handling:** If `chase` target doesn't exist, kill tween and trigger "Tangled Strings" hook.

## 7. AUDIO
- Native HTML5 Audio. Avoid heavy libraries. 
- **Assets:** CC0 Đàn Bầu or folk samples. 
- **Mute Policy:** iOS/Chrome requires user interaction. UI overlay must have a giant "Unmute & Enter Stage" button at startup.

## 8. UI/UX
- Full-screen canvas. Mobile-first landscape orientation.
- Minimalist DOM overlay (absolute positioning, `pointer-events: none` where applicable).
- Top-left: Mute toggle, Current Show Name.
- Bottom: Drawer for "Saved Shows". 
- Agent interaction happens in the native browser/client interface (e.g., ChatGPT desktop).

## 9. FUNNY-HOOK SPEC
Cheap to build, high ROI for judging.
1. **Tễu's 4th Wall:** If agent queues > 5 moves without saving, Chú Tễu slides in from the screen edge: *"Đạo diễn ơi, rối tay em mỏi rồi!"* (Director, my arms are tired!).
2. **Tangled Strings:** If tool execution errors (e.g., bad target), puppets jiggle erratically and freeze. Console: `String tangled. Reboot.`
3. **Fish Panic:** If Dragon spawns within 3 units of Fish, Fish overrides queue, splashes, and flees to the edge.
4. **Dragon Sneeze:** 10% chance when Dragon splashes, it plays a sneeze audio and flashes red instead of splashing water.

## 10. TESTING & DEMO PLAN
- **QA Checklist:** Expose `window.debugTools` to manually call `spawn_puppet` and `choreograph_move` from DevTools to verify 3D/GSAP logic independently of WebMCP.
- **Devpost Video Script (2 mins):**
  - [0:00] Show empty stage, open Agent chat.
  - [0:15] Prompt: "Make Tễu introduce a dragon. Dragon chases fish."
  - [0:30] Screen shows tools firing; puppets pop up and animate.
  - [1:15] Trigger the "Fish Panic" hook.
  - [1:45] Agent saves show. Refresh page, click "Play Saved Show" to prove localStorage persistence.

## 11. 5-DAY MILESTONES
*(Aug 29 - Sep 3. Hard deadline 1pm PT)*
- **Day 1:** Scaffolding. Vite, Three.js water shader, sprite billboarding.
- **Day 2:** WebMCP Bridge. Register tools. Build fallback debug tools in DevTools.
- **Day 3:** Animation & State. Wire GSAP queue. Implement splash, chase, jump. Hook up localStorage.
- **Day 4:** Audio, Hooks & Polish. Add HTML overlay, audio toggles, Tễu/Fish jokes.
- **Day 5:** QA & Demo. Fix mobile layout, record video, write README, deploy to GitHub Pages.
- **Buffer (Sep 3 Morning):** Final sanity checks. Ship it.

## 12. RISKS & MITIGATIONS
- **WebMCP API Uncertainty:** Draft APIs shift. *Mitigation:* Abstract tool registration into a single wrapper function.
- **Asset Loading:** High-res PNGs crash old phones. *Mitigation:* Compress all sprites to 512x512.
- **Scope Creep:** *Mitigation:* Strict 4 character / 5 action limit. Zero physics simulation.

---

## 13. UNKNOWNS TO VERIFY (First 2 Hours Checklist)
1. [ ] **API Surface:** Verify if `document.modelContext.registerTool` or `navigator.webmcp.registerTool` is the correct signature in the target client.
2. [ ] **Origin Trials:** Does the API require a Chrome Origin Trial flag or specific flags to be enabled?
3. [ ] **Execution Context:** Does the `execute()` callback run directly in the main thread (DOM access allowed) or in an isolated worker?
4. [ ] **Security Context:** Must the site be served over HTTPS / localhost to register tools? (GitHub Pages handles HTTPS, but good to know for local dev).
5. [ ] **Schema Format:** Does `inputSchema` exactly mirror JSON Schema draft-07?
6. [ ] **Tool Return Types:** Does `execute()` need to return a string, JSON, or a Promise resolving to a specific format?
7. [ ] **Agent UI:** How does the user actually prompt the agent? (Is the chat panel injected by the browser, or do I need to build a custom UI hooking into an LLM endpoint?)
8. [ ] **Rate Limits:** Are there rate limits on how fast the agent can call `choreograph_move`? 
9. [ ] **Three.js Water:** Verify `Water.js` renders correctly on a mobile browser without shader compilation errors.
10. [ ] **Autoplay Audio:** Confirm AudioContext unlocking via a single click anywhere on the `<body>` works reliably on iOS Safari.

---

## 14. VERIFIED (2026-08-28) — WebMCP API surface + Challenge rules

### API surface (answers to the "first 2 hours" checklist)
1. **`document.modelContext.registerTool(tool, {signal})` is correct.** `navigator.modelContext` was **deprecated in Chrome 150** in favor of `document.modelContext` — ignore older tutorials using `navigator.webmcp`.
2. **Chrome origin trial exists** (Chrome 149+, "Intent to Experiment"). BUT the challenge's supported path: **ChatGPT desktop app in-app browser supports WebMCP by default** — no token needed. Alternative: Chrome with origin trial flag.
3. **execute() runs as normal async JS in the page context** (main thread, DOM access allowed). Signature: `execute: async (input) => string`.
4. **HTTPS required** (secure context) — GitHub Pages is fine. Localhost works for dev.
5. **inputSchema = JSON Schema** (`type: "object", properties, required`).
6. **execute() returns a string** (e.g. ``return `Added to-do: ${text}` ``) — can be a JSON string for structured results.
7. **Agent UI is the ChatGPT desktop in-app browser** — the page only registers tools; the chat panel lives in the app. Page can listen for `document.modelContext.addEventListener("toolchange", ...)`.
8. **Tool object also supports `annotations: { readOnlyHint, untrustedContentHint }`.** Unregister via `AbortController` (Chrome 153+: unregister without breaking in-flight executions).
9. **Cross-origin iframes:** tool registration disabled by default; delegate with Permissions Policy `allow="tools"` + `exposedTo` array.
10. **TS typings:** `webmcp-types` npm package. **Testing without ChatGPT:** Codex CLI has WebMCP integration (codex.danielvaughan.com article) — use it to exercise tools headlessly.

Example (verbatim from Chrome docs):
```js
const addTodoTool = {
  name: "addTodo",
  description: "Add a new item to the to-do list",
  inputSchema: { type: "object", properties: { text: { type: "string" } } },
  execute: async ({ text }) => `Added to-do: ${text}`,
  annotations: { readOnlyHint: false, untrustedContentHint: true },
};
const controller = new AbortController();
await document.modelContext.registerTool(addTodoTool, { signal: controller.signal });
```

### Challenge rules (webmcp.devpost.com/rules)
- **Registration & Submission:** Aug 25, 2026 11:00 PT → **Sep 3, 2026 13:00 PT (= Sep 4 03:00 GMT+7)**. Judging Sep 4–21, winners ~Sep 23.
- **Eligibility:** individuals at age of majority, resident of an OpenAI-API-supported country (Vietnam OK — fully accessible tier per 2026 Asia tracker; verify at registration). Excluded: Brazil, China, HK, Quebec, Russia, Cuba, Iran, North Korea, Syria, Venezuela + OFAC-listed.
- **Submission requirements:** public repo (GitHub/GitLab/Bitbucket) with ALL source + assets + instructions; **open-source license file visible in repo About section**; **working demo URL** (login creds if private); brief explanation of WebMCP implementation; original work.
- **Access to WebMCP:** ChatGPT desktop app (in-app browser supports WebMCP by default) — this is the judging/demo environment.
- **Judging:** WebMCP Leverage + Execution, equally weighted, judges' sole discretion.
