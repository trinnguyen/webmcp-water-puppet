Here is the implementation-ready spec for Linear AUT-38, as requested:

# Linear AUT-38: Gióng's Iron Garage - Technical Spec

## 1. Types & State (`src/games/gia-ngua/rules.ts`)

### TypeScript Types
```typescript
export type FoodType = 'com_ca' | 'pizza' | 'nuoc_ngot';
export type GearItem = 'bamboo_whip' | 'iron_armor' | 'iron_hat' | 'iron_sword';

export interface GiaNguaState {
  sizeStage: number;    // 0 to 5
  armorLevel: number;   // 0 (none) to 1 (iron_armor equipped)
  hunger: number;       // 0 (starving) to 100 (full)
  gear: GearItem[];
}

export interface GiaNguaPersistentState {
  lifetimeBestSize: number;
  currentRun: GiaNguaState;
}
```

### `rules.ts` Signatures & Transition Semantics
State is pure and synchronous. No DOM, no timers.

`export function getGiaNguaState(): GiaNguaPersistentState;`
`export function loadState(): void;`
`export function saveState(): void;`

`export function driveFeed(food: FoodType, isTool: boolean = false): { state: GiaNguaPersistentState, message: string, effect: 'grow' | 'spit_smoke' | 'overfed' }`
- **Semantics**: 
  - If `food` is "pizza" or "nuoc_ngot": `hunger` unchanged. Return effect `spit_smoke` and funny message (e.g., "Ngựa sắt nhổ ra, xịt khói yếu ớt!").
  - If `food` is "com_ca": `hunger += 30`.
    - If `hunger > 100`: Cap at 100. Return effect `overfed` (smoke belch).
    - If `sizeStage < 5` and not overfed, increment `sizeStage`. Update `lifetimeBestSize` if `sizeStage > lifetimeBestSize`. Return effect `grow`.
  - Save state. Return snapshot.

`export function driveEquip(item: GearItem, isTool: boolean = false): { state: GiaNguaPersistentState, message: string, effect: 'equip' | 'already_wearing' | 'victory_dance' }`
- **Semantics**:
  - `hunger -= 10` (clamp min 0).
  - If `gear.includes(item)`: Return effect `already_wearing` with funny message (e.g., "Ngựa đang mặc cái này rồi!").
  - Else: Push `item` to `gear`. If `item === 'iron_armor'`, `armorLevel = 1`.
  - If `gear.length === 4` and `sizeStage === 5`: Return effect `victory_dance`.
  - Save state. Return snapshot.

`export function driveTestFire(duration: number, isTool: boolean = false): { state: GiaNguaPersistentState, message: string, effect: 'fire' }`
- **Semantics**:
  - `hunger -= (10 * duration)` (clamp min 0).
  - Save state. Return snapshot with effect `fire`.

`export function driveReset(): GiaNguaPersistentState`
- **Semantics**: Reset `currentRun` to `sizeStage: 0, armorLevel: 0, hunger: 0, gear: []`. Keep `lifetimeBestSize`. Save.

*Growth Ladder Scale Factors:*
- Size 0: 1.0 (Foal)
- Size 1: 1.2
- Size 2: 1.5
- Size 3: 1.9
- Size 4: 2.4
- Size 5: 3.0 (Legend)

## 2. Scene Plan (`src/games/gia-ngua/scene.ts`)
- **Lifecycle**:
  - `buildScene(container)`: Create Three.js WebGLRenderer, Scene, PerspectiveCamera. Add basic ambient/directional light. Build `horseGroup` (dark grey procedural boxes/cylinders for torso, legs, neck, head). Create `snoutPoint` (Object3D) inside the head mesh. Create `backAnchor`, `headAnchor`, `mouthAnchor`. Start `requestAnimationFrame` strictly for rendering `renderer.render(scene, camera)` and particle updates.
  - `destroyScene()`: Dispose geometries, materials, renderer. Cancel rAF.
- **Mesh Attachments**: When `driveEquip` triggers, instantiate basic Three.js primitives (e.g., ConeGeometry for hat, BoxGeometry for armor) and `add()` them to the respective anchors. Remove existing if resetting.
- **Particle Emitter**: On `fire` effect, use `THREE.Points` with a `THREE.BufferGeometry` and `THREE.PointsMaterial`. In the render loop, update the Y/Z positions of vertices to simulate a burst from `snoutPoint`, resetting them after a lifetime.
- **GSAP Fire-and-forget**: In the scene's event listener for state changes, trigger `gsap.to(horseGroup.scale, { x: target, y: target, z: target, duration: 1 })`. **CRITICAL**: Use `void gsap.to(...).catch(...)` and ensure we never `await` this in any tool execution path (reference prior fixes d42114e and 89db2f5). Check `if (reducedMotion()) { horseGroup.scale.set(...) } else { gsap.to(...) }`.

## 3. Tools Table (`src/games/gia-ngua/tools.ts`)

| Name | Description for LLM | Input Schema JSON | Return JSON Shape | readOnlyHint |
|---|---|---|---|---|
| `gia_ngua_inspect` | Inspect the Iron Horse's current size, armor, hunger, and gear. | `{ type: 'object', properties: {} }` | `{ status: 'ok', showState: GiaNguaPersistentState }` | `true` |
| `gia_ngua_feed` | Feed the horse. "com_ca" grows it; "pizza"/"nuoc_ngot" makes it spit smoke. | `{ type: 'object', properties: { food: { type: 'string', enum: ['com_ca', 'pizza', 'nuoc_ngot'] } }, required: ['food'] }` | `{ status: 'ok', message: string, effect: string, showState: GiaNguaPersistentState }` | `false` |
| `gia_ngua_equip` | Equip gear: bamboo_whip, iron_armor, iron_hat, iron_sword. | `{ type: 'object', properties: { item: { type: 'string', enum: ['bamboo_whip', 'iron_armor', 'iron_hat', 'iron_sword'] } }, required: ['item'] }` | `{ status: 'ok'|'error', message: string, effect: string, showState: GiaNguaPersistentState }` | `false` |
| `gia_ngua_test_fire` | Test fire breath (clamp duration 1-10s). | `{ type: 'object', properties: { duration_seconds: { type: 'number', minimum: 1, maximum: 10 } }, required: ['duration_seconds'] }` | `{ status: 'ok', message: string, effect: 'fire', showState: GiaNguaPersistentState }` | `false` |
| `gia_ngua_state` | Read full JSON state. | `{ type: 'object', properties: {} }` | `{ status: 'ok', state: GiaNguaPersistentState }` | `true` |
| `gia_ngua_reset` | Reset run, keeps lifetime best size. | `{ type: 'object', properties: {} }` | `{ status: 'ok', message: string, showState: GiaNguaPersistentState }` | `false` |

## 4. `index.ts` GameDef (`src/games/gia-ngua/index.ts`)
```typescript
import { buildScene, destroyScene } from './scene';
import { tools } from './tools';
import type { GameDef } from '../../types';

export const giaNguaDef: GameDef = {
  id: 'gia-ngua',
  name: 'Gara Ngựa Sắt',
  nameEn: "Gióng's Iron Garage",
  emoji: '🐎',
  minPlayers: 1,
  maxPlayers: 1,
  description: 'Giúp Thánh Gióng nuôi và nâng cấp Ngựa Sắt (Help Gióng feed and upgrade his Iron Horse).',
  buildScene,
  destroyScene,
  tools,
  saveKey: 'san_choi_gia_ngua'
};
```

## 5. UI and Shared Integrations
- **`src/games/index.ts`**: Import `giaNguaDef` and add it to the `games` array.
- **`src/ui.ts`**: Add the `HOW_TO` entry:
  ```typescript
  'gia-ngua': [
    { vi: 'Cho ngựa ăn cơm cà để lớn nhanh.', en: 'Feed the horse "com_ca" to make it grow.' },
    { vi: 'Trang bị áo giáp và vũ khí cho ngựa.', en: 'Equip the horse with iron armor and weapons.' },
    { vi: 'Phun lửa thử nghiệm sức mạnh.', en: 'Test its power by breathing fire.' },
  ],
  ```
- **Hub/WebMCP (`src/webmcp.ts` & `src/hub.ts`)**: No modifications needed. The choke point automatically registers `GameDef.tools` upon loading the hub card.
- **Audio (`src/audio.ts`)**: No modifications needed. Re-use existing keys (e.g., `playSFX('sneeze')` for smoke belch, `playSFX('win_chime')` for victory dance).

## 6. Acceptance Checks
1. **Code Structure**: Follows AUT-9 pattern exactly (rules/scene/tools separation).
2. **Build**: `npm run build` succeeds with zero TS or lint errors.
3. **Runtime Load**: Game opens from Hub in <3s. `buildScene` creates WebGL context without errors.
4. **Tool Execution (Hang-Proof)**: CDP stubbed-rAF smoke test passes. `gia_ngua_feed` and `gia_ngua_equip` return immediate JSON (<100ms) with no unresolved GSAP Promises.
5. **Mechanics**:
   - Feeding `pizza` returns `spit_smoke` effect without growth.
   - Feeding `com_ca` increments `sizeStage` (caps at 5) and visually scales the horse.
   - Overfeeding triggers `smoke belch` (toast).
   - Fully upgraded + size 5 triggers `victory dance jiggle`.
6. **Persistence**: Refreshing the page keeps the current `sizeStage` and `gear` via `localStorage` ('san_choi_gia_ngua').
7. **Motion Override**: Check `reducedMotion()` usage in `scene.ts`; when enabled, scale transforms snap immediately instead of animating.

## 7. Shared File Risks & Minimal Edits
- `src/games/index.ts`: **Low Risk**. Minimal edit: import game and push to `games` array (2 lines).
- `src/ui.ts`: **Low Risk**. Minimal edit: insert `'gia-ngua'` key into `HOW_TO` constant (5 lines).
- `src/audio.ts` & `src/webmcp.ts`: **Zero Risk**. Do not touch. Reuse existing keys entirely.
