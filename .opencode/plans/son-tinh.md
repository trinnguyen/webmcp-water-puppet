IMPLEMENTATION SPECIFICATION FOR "Sơn Tinh's Smart Home" (AUT-39)
==================================================================

1. `src/games/son-tinh/rules.ts` (Pure State & Logic)
------------------------------------------------------
This file will contain ONLY deterministic, pure functions with no DOM/timer logic.

### Types & State Models
```typescript
export type DefenseType = 'dirt' | 'rock' | 'magic_net';
export type GiftAnimal = 'voi_9_nga' | 'ga_9_cua' | 'ngua_thep' | 'roi_that';

export interface SonTinhState {
  waterLevel: number;       // 0 to 100 (rising each turn)
  mountainHeight: number;   // 0 to 100
  threat: number;           // 0 to 100 (based on waterLevel vs mountainHeight)
  points: number;           // defense budget
  inventory: GiftAnimal[];  // summoned wedding gifts
  turn: number;
  floodWavesSurvived: number;
  submerged: boolean;
}

export interface SonTinhPersistentState {
  lifetimeBestWaves: number;
  currentRun: SonTinhState;
  messages: string[];  // Thủy Tinh's angry texts
}
```

### Constants
```typescript
export const SAVE_KEY = 'san_choi_son_tinh';

export const DEFENSE_COSTS: Record<DefenseType, number> = {
  dirt: 10,
  rock: 25,
  magic_net: 50,
};

export const DEFENSE_HEIGHT: Record<DefenseType, number> = {
  dirt: 5,
  rock: 10,
  magic_net: 15,
};

export const GIFT_EFFECTS: Record<GiftAnimal, { points: number; description: string }> = {
  voi_9_nga: { points: 15, description: '9-tusk elephant buffs defense +15' },
  ga_9_cua: { points: 10, description: '9-spur rooster buffs defense +10' },
  ngua_thep: { points: 20, description: 'Iron horse buffs defense +20' },
  roi_that: { points: 5, description: 'Magic whip buffs defense +5' },
};

export const THUY_TINH_MESSAGES: string[] = [
  'Sao chặn sóng của tui?? 😡',
  'Thủy Tinh nổi giận, dâng nước cao hơn! 🌊',
  'Mày tưởng mày giỏi lắm hả Sơn Tinh? 😤',
  'Sóng thần cấp 5 đây! 💀',
  'Ha ha, nước sẽ cuốn trôi nhà mày!',
  'Lũ này mày không đỡ nổi đâu!',
  'Đi mời Rồng Vàng đi con ạ! 🐉',
  'Sơn Tinh ơi, vợ mày về nhà tao chơi nè! 😜',
  'Cố lên, sắp ngập rồi!',
  'Một trận sóng thần nữa là tan hoang!',
];
```

### State Transitions (Functions)

`createInitialRunState(): SonTinhState` — mountainHeight=50, waterLevel=0, threat=0, points=50, turn=0, submerged=false.

`createInitialPersistentState(): SonTinhPersistentState` — currentRun from above, lifetimeBestWaves=0, messages=[].

`advanceTurn(state): { state, newMessage }` — waterLevel += 10-20 (randomless? deterministic: +15 per turn). threat = waterLevel - mountainHeight (min 0). If threat >= 50 and no points for defense, submerged=true. Push a new message from THUY_TINH_MESSAGES.

`deployDefense(state, type: DefenseType, heightIncrease: number): { state, message, effect }` — Deduct points. mountainHeight += DEFENSE_HEIGHT[type] * heightIncrease. Return effect 'raised' | 'no_points'.

`summonGift(state, animal: GiftAnimal): { state, message }` — Add animal to inventory. Add GIFT_EFFECTS[animal].points to points. Funny message about the wedding gift.

`readMessages(state): string[]` — Return current messages array.

`endSeason(state): { state, score, message }` — If submerged: funny defeat. Else: survive = floodWavesSurvived+1, update lifetimeBestWaves. New season starts (reset but keep lifetime).

2. Scene Plan (`src/games/son-tinh/scene.ts`)
-----------------------------------------------
Three.js voxel diorama (BoxGeometry stacks).

- **buildScene(container)**: Create renderer, scene, camera. Build voxel mountain (stacked BoxGeometry cubes, green/brown). Build water plane (translucent blue plane, rises with waterLevel). Add ambient + directional lights. rAF loop for rendering.
- **destroyScene()**: Dispose geometries, materials, renderer. Cancel rAF.
- **Animations**: When mountain height changes, GSAP scale the voxel stack or add/remove boxes. When water rises, GSAP move water plane up. Use `reducedMotion()` check.
- **Messages**: Show Thủy Tinh messages as floating text toasts.

3. Tools Table (`src/games/son-tinh/tools.ts`)

| Name | Description | Input Schema | Return JSON Shape | readOnlyHint |
|---|---|---|---|---|
| `son_tinh_status` | Current water level, mountain height, threat, points, inventory | `{ type: 'object', properties: {} }` | `{ status: 'ok', showState: SonTinhPersistentState }` | true |
| `son_tinh_deploy_defense` | Spend points raising the voxel mountain. Types: dirt (cheap/low), rock (pricey/strong), magic_net (rare/multiplier) | `{ type: 'object', properties: { type: { type: 'string', enum: ['dirt','rock','magic_net'] }, height_increase: { type: 'number', minimum: 1, maximum: 5 } }, required: ['type', 'height_increase'] }` | `{ status: 'ok'|'error', message: string, effect: string, showState: SonTinhPersistentState }` | false |
| `son_tinh_summon_gift` | Summon wedding-gift animal buff: voi_9_nga, ga_9_cua, ngua_thep, roi_that | `{ type: 'object', properties: { animal: { type: 'string', enum: ['voi_9_nga','ga_9_cua','ngua_thep','roi_that'] } }, required: ['animal'] }` | `{ status: 'ok', message: string, showState: SonTinhPersistentState }` | false |
| `son_tinh_read_messages` | Read Thủy Tinh's angry texts | `{ type: 'object', properties: {} }` | `{ status: 'ok', messages: string[] }` | true |
| `son_tinh_end_season` | End the current flood season. Survive waves → score. Submerged → funny defeat. | `{ type: 'object', properties: {} }` | `{ status: 'ok', message: string, score: number, showState: SonTinhPersistentState }` | false |

4. `index.ts` GameDef (`src/games/son-tinh/index.ts`)
```typescript
import { buildScene, destroyScene } from './scene';
import { tools } from './tools';
import type { GameDef } from '../../types';

export const sonTinhDef: GameDef = {
  id: 'son-tinh',
  name: 'Nhà Sơn Tinh chống Thủy Tinh',
  nameEn: "Sơn Tinh's Smart Home",
  emoji: '🏔️',
  minPlayers: 1,
  maxPlayers: 1,
  description: 'Giúp Sơn Tinh dùng phép thuật chống lũ lụt từ Thủy Tinh (Help Sơn Tinh defend against Thủy Tinh\'s floods).',
  buildScene,
  destroyScene,
  tools,
  saveKey: 'san_choi_son_tinh',
};
```

5. UI and Shared Integrations
- **`src/games/index.ts`**: Import `sonTinhDef` and add to `games` array.
- **`src/ui.ts`**: Add `HOW_TO` entry for 'son-tinh':
  ```typescript
  'son-tinh': [
    { vi: 'Dùng điểm xây đê chống lũ.', en: 'Use points to build flood defenses.' },
    { vi: 'Triệu hồi quà cưới trợ giúp.', en: 'Summon wedding gifts for buffs.' },
    { vi: 'Đọc tin nhắn của Thủy Tinh.', en: 'Read Thủy Tinh\'s angry texts.' },
    { vi: 'Kết thúc mùa lũ để tính điểm.', en: 'End the flood season to score.' },
  ],
  ```
- **Hub/WebMCP**: No modifications needed (auto-registers via GameDef.tools).

6. Acceptance Checks
1. Code Structure: Follows AUT-38 pattern exactly (rules/scene/tools/index separation).
2. Build: `npm run build` succeeds with zero TS/lint errors.
3. Runtime: Game opens from Hub in <3s.
4. Tool Execution: All tools return <100ms (no await on animations).
5. Mechanics: Deploy defense raises mountain; water rises each turn; summon adds points; end_season scores or defeats.
6. Persistence: Reload keeps state via localStorage.
7. Motion Override: `reducedMotion()` check in scene.ts.
