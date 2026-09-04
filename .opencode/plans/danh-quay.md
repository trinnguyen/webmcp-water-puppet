IMPLEMENTATION SPECIFICATION FOR "Đánh quay" (AUT-42)
======================================================

1. `src/games/danh-quay/rules.ts` (Pure State & Logic)
------------------------------------------------------
This file will contain ONLY deterministic, pure functions with no DOM/timer logic.

### Types & State Models
```typescript
export type Power = 'nhe' | 'vua' | 'manh';
export type Trick = 'nguoi_duc' | 'bay_cao' | 'qua_gam';
export type TopStatus = 'idle' | 'spinning' | 'fallen' | 'flew_off' | 'dizzy';

export interface DanhQuayState {
  status: TopStatus;
  energy: number; // 0 to 100
  score: number;  // represents seconds spun
  wobbling: boolean;
  tricksLanded: number;
  consecutiveTricks: number;
  longestSpinRecord: number;
}
```

### Deterministic Resolution (Probability-Free)
A pure turn logic applies a base decay (e.g., -5 energy per turn) and then resolves the action.

### State Transitions (Functions)
- `createInitialState(record: number): DanhQuayState`
- `start(state)`: Sets `status = 'spinning'`, `energy = 30`, reset score/tricks.
- `whip(state, power: Power)`:
  - Applies base energy decay.
  - Adds energy (`nhe`: +5, `vua`: +12, `manh`: +22).
  - Risk: If `power === 'manh'` and `energy >= 80` (near-max), top `wobbling = true` and applies an energy penalty (e.g. -20).
  - Hook: If `energy > 100`, top is overwhipped. `status = 'flew_off'`, `energy = 0`.
  - Resets `consecutiveTricks = 0`. Increments `score` by 1.
- `performTrick(state, trick: Trick)`:
  - Applies base energy decay.
  - If `energy < 40`: Trick fails. Top falls over (`status = 'fallen'`, `energy = 0`).
  - Else: Trick succeeds. `energy -= 40`, `tricksLanded += 1`, `consecutiveTricks += 1`, `score += 5` (applause points).
  - Hook: If `consecutiveTricks >= 5`, top gets dizzy and rests (`status = 'dizzy'`, `energy = 0`).
- `finish(state)`: Spins down (`status = 'idle'`). Updates `longestSpinRecord` if `score > longestSpinRecord`. Returns final score.


2. `src/games/danh-quay/tools.ts`
---------------------------------
Tools exposed to WebMCP. State changes trigger synchronous `drive*` functions which modify state immediately, and emit async visuals (fire-and-forget).

| Name | LLM-facing description | inputSchema | Return JSON shape | readOnlyHint |
|:-----|:-----------------------|:------------|:------------------|:-------------|
| `danh_quay_start` | Spawns a new spinning top with 30 initial energy. | `{}` | `{ status, message, state }` | false |
| `danh_quay_whip` | Whip the top to add energy. Power can be nhe (+5), vua (+12), manh (+22). Manh on near-max energy causes wobble. Overwhipping >100 causes fly-off. | `{ power: string ("nhe"\|"vua"\|"manh") }` | `{ status, message, state, wobblePenalty, flewOff }` | false |
| `danh_quay_trick` | Perform a trick (nguoi_duc, bay_cao, qua_gam) costing 40 energy for applause points. 5 tricks in a row causes dizzy cooldown. Failing energy causes fall. | `{ trick: string ("nguoi_duc"\|"bay_cao"\|"qua_gam") }` | `{ status, message, state, trickSuccess, dizzy, fallen }` | false |
| `danh_quay_state` | Read current top state: energy, wobble, tricks landed, and score (seconds spun). | `{}` | `{ state }` | true |
| `danh_quay_finish` | Stop spinning and end the game. Saves final score and longest-spin record. | `{}` | `{ status, message, finalScore, longestSpinRecord, state }` | false |


3. `src/games/danh-quay/scene.ts` (Visual Architecture)
-------------------------------------------------------
- **Architecture**: DOM-based rendering using standard HTML/CSS and GSAP.
- **Top Rendering & Spin**: A central top element (e.g., using emoji 🌀 or 🪀 styled as a top) continuously rotating via CSS or GSAP. Speed of rotation is visually mapped to `state.energy`.
- **Whip Animation**: A whip element visually strikes the top (`gsap.to`), playing a whip sound (`playSFX`).
- **Trick Slow-mo**: If trick succeeds, `gsap.to` scales up the top in 3D (`scale: 1.5, rotationY: 360`) and slows down the time visually using GSAP timescale or duration adjustments, playing applause SFX.
- **Wobble**: If wobbling, apply a rapid oscillating rotation (`x/y` shake) to the top, showing a "funny toast" notification.
- **Flies-off**: If overwhipped, `gsap.to` shoots the top off-screen (`x: 1000, y: -500`), and triggers `screenShake()` to simulate knocking the hub lanterns. Play crash SFX.
- **Dizzy Cooldown**: If dizzy, top shows spiral eyes (emoji change or overlay) and slowly wobbles to a halt.
- **Reduced Motion**: Respect `reducedMotion()` by skipping slow-mo 3D transforms, screen shakes, and fast spins, just snapping to final states.
- **Async Pattern**: All animations (e.g., `void animateWhip().catch()`, `void animateTrick().catch()`) run async, fire-and-forget, separate from the immediate tool return, ensuring <3s resolution.


4. `src/games/danh-quay/index.ts`
---------------------------------
```typescript
import type { GameDef } from '../../types';
import { buildDanhQuayScene, destroyDanhQuayScene } from './scene';
import { danhQuayTools } from './tools';

export const danhQuayDef: GameDef = {
  id: 'danh-quay',
  name: 'Đánh quay',
  nameEn: 'Spinning Top',
  emoji: '🌀',
  minPlayers: 1,
  maxPlayers: 1,
  description: 'Trò chơi đánh quay truyền thống. Quất roi để duy trì năng lượng, biểu diễn kỹ năng và ghi điểm!',
  buildScene: buildDanhQuayScene,
  destroyScene: destroyDanhQuayScene,
  tools: danhQuayTools,
  saveKey: 'san_choi_danh_quay',
};
```


5. Shared Files Modifications (Minimal Edits)
---------------------------------------------
**File: `src/games/index.ts`**
- *Import at top*: `import { danhQuayDef } from './danh-quay';`
- *Update array*: `export const games: GameDef[] = [oAnQuanDef, bauCuaDef, waterPuppetDef, giaNguaDef, rongRanDef, danhQuayDef];`

**File: `src/ui.ts`**
- *At the `HOW_TO` constant declaration (around line 211)*, insert:
```typescript
  'danh-quay': [
    { vi: 'Bắt đầu', en: 'Start spinning the top.' },
    { vi: 'Quất roi', en: 'Whip to add energy. Watch out for overwhipping!' },
    { vi: 'Biểu diễn', en: 'Perform tricks for applause, but it costs energy.' },
  ],
```

**File: `README.md`**
- *Update WebMCP tool reference table* to include `danh_quay_start`, `danh_quay_whip`, `danh_quay_trick`, `danh_quay_state`, and `danh_quay_finish`.
