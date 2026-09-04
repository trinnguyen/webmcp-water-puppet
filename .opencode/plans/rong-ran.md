IMPLEMENTATION SPECIFICATION FOR "Rồng rắn lên mây" (AUT-41)
============================================================

1. `src/games/rong-ran/rules.ts` (Pure State & Logic)
------------------------------------------------------
This file will contain ONLY deterministic, pure functions with no DOM/timer logic.

### Types & State Models
```typescript
export type Phase = 'idle' | 'chanting' | 'awaiting_answer' | 'chasing' | 'resolved';
export type Speed = 'cham' | 'vua' | 'nhanh';

export interface ChainSegment {
  id: string;      // e.g., "head", "body-1", "tail"
  asset: string;   // emoji string
}

export interface RongRanState {
  phase: Phase;
  round: number;
  length: number;  // 4 to 12
  chain: ChainSegment[];
  doctorAsset: string;
  chantLine: number; // 0 to 3, tracks progress of the chant
  doctorAnswer: 'Có' | 'Không' | null;
  chaseSpeed: Speed | null;
  chaseResult: 'caught' | 'escaped' | null;
  roundsSurvived: number;
  totalCatches: number;
}
```

### Deterministic Chase Resolution (Probability-Free)
A pure function `resolveChase(length: number, speed: Speed): 'caught' | 'escaped'` that strictly determines the outcome:
- `cham` (slow): Always `'escaped'`. The doctor is too slow.
- `vua` (medium): Returns `'caught'` if `length >= 9` (a long snake is too clumsy to dodge). Returns `'escaped'` otherwise.
- `nhanh` (fast): Returns `'caught'` if `length >= 6`. Returns `'escaped'` otherwise.

### State Transitions (Functions)
- `createInitialState()`
- `startRound(state, length)`
- `advanceChant(state)`
- `answer(state, answer)`
- `startChase(state, speed)` (resolves outcome immediately using `resolveChase`)
- `nextRound(state)`:
   - If `'escaped'`, increment `roundsSurvived`. Roles remain.
   - If `'caught'`, increment `totalCatches`. The caught tail segment becomes the new doctor, the old doctor joins the head of the chain. Chain `length` decreases by 1 (if it drops below 4, reset to starting length).


2. `src/games/rong-ran/tools.ts`
--------------------------------
Tools exposed to WebMCP. State changes trigger synchronous `drive*` functions which modify state immediately, and emit async visuals (fire-and-forget).

| Name | LLM-facing description | inputSchema | Return JSON shape | readOnlyHint |
|:-----|:-----------------------|:------------|:------------------|:-------------|
| `rong_ran_start` | Spawns a new dragon chain of given length and initiates the chant: "Rồng rắn lên mây..." | `{ length: number (4-12) }` | `{ status, message, chant, state }` | false |
| `rong_ran_answer`| Call-and-response dialogue with the doctor ("Có không?" -> "Không?" or "Có") | `{ answer: string ("Có"\|"Không") }` | `{ status, message, doctorReply, phase, state }` | false |
| `rong_ran_chase` | Start the chase with a specific speed. Resolves deterministically based on speed vs length. | `{ speed: string ("cham"\|"vua"\|"nhanh") }` | `{ status, message, result, state }` | false |
| `rong_ran_state` | Read current game state, score, chain length, phase | `{}` | `{ state }` | true |
| `rong_ran_next_round`| Setup the next round. Caught kid becomes doctor. Score is rounds survived | `{}` | `{ status, message, round, state }` | false |


3. `src/games/rong-ran/scene.ts` (Visual Architecture)
------------------------------------------------------
- **Architecture**: DOM-based rendering using standard HTML/CSS.
- **Dragon Weave**: Use GSAP to animate the head's movement around the screen. Follow-up body segments update via delayed triggers (e.g. `gsap.to` with `stagger: 0.1` or updating to head's previous path coords).
- **Doctor Dash**: The doctor element uses a direct `gsap.to(..., { x, y, duration })` toward the tail element's computed coordinates.
- **Deflate-on-catch Animation**:
  - If caught: Tail scales down to 0 (`gsap.to(tailEl, { scale: 0, duration: 0.5 })`), playing squeak SFX (`playSFX('sneeze')`). The doctor element does a short victory bounce (`yoyo: true`).
- **Reduced Motion**: Respect `reducedMotion()` by collapsing animations (bypassing tweens directly to final positions).
- **Async Pattern**: All animations (`void animateChase().catch()`) run async, fire-and-forget in the agent path, separate from the immediate tool return.


4. `src/games/rong-ran/index.ts`
--------------------------------
```typescript
import type { GameDef } from '../../types';
import { buildRongRanScene, destroyRongRanScene } from './scene';
import { rongRanTools } from './tools';

export const rongRanDef: GameDef = {
  id: 'rong-ran',
  name: 'Rồng rắn lên mây',
  nameEn: 'Dragon Snake',
  emoji: '🐉',
  minPlayers: 1,
  maxPlayers: 1,
  description: 'Trò chơi đồng dao đuổi bắt. Thầy thuốc đuổi bắt khúc đuôi của rồng rắn dài thoòng lọng!',
  buildScene: buildRongRanScene,
  destroyScene: destroyRongRanScene,
  tools: rongRanTools,
  saveKey: 'san_choi_rong_ran',
};
```


5. Shared Files Modifications (Minimal Edits)
---------------------------------------------
**File: `src/games/index.ts`**
- *Import at top*: `import { rongRanDef } from './rong-ran';`
- *Update array*: `export const games: GameDef[] = [oAnQuanDef, bauCuaDef, waterPuppetDef, giaNguaDef, rongRanDef];`

**File: `src/ui.ts`**
- *At the `HOW_TO` constant declaration (around line 211)*, insert:
```typescript
  'rong-ran': [
    { vi: 'Dàn rồng rắn', en: 'Spawn a chain of 4-12 kids.' },
    { vi: 'Hỏi đáp', en: 'Chant and ask the doctor.' },
    { vi: 'Đuổi bắt', en: 'The doctor chases the tail at different speeds!' },
  ],
```
