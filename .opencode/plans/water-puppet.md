# Múa rối nước (Water Puppet Theatre) - Implementation Spec

## 1. Game Loop Concept
**Target:** Kids 5-12 playing with family, or driven entirely by an AI agent acting as "Người Xướng Trò" (Game Master).
- **Setup:** Start a show by selecting a folk tale (`Tale`). Recommended: *Cóc kiện Trời* (Toad sues Heaven), *Tấm Cám*, *Rồng & Cá* (Dragon & Carp) — each modeled as a short scene sequence.
- **Core Loop:**
  - The GM (agent or player UI) spawns puppets on the pond stage.
  - Puppets perform actions: move, jump, emerge, splash, or dragon dance.
  - Special effects trigger (splash, fireworks, rain) accompanied by SFX.
  - **Applause Meter (Điểm vỗ tay):** The audience reacts dynamically. The score increases based on dramatic actions (e.g., splashing water, dragon dance).
- **Conclusion:** The show concludes. The final applause score determines the rating, ending with a final applause/win sound and score screen.

## 2. Pure State Model (`rules.ts`)
No DOM dependencies. All functions are pure state transitions.
- **State Types:**
  ```typescript
  type PuppetState = { id: string, name: string, assetType: 'svg' | 'emoji', assetId: string, x: number, y: number, visible: boolean, action: string | null };
  type ShowState = {
    status: 'idle' | 'playing' | 'finished';
    currentTale: string | null;
    applause: number; // 0 to 100
    puppets: Record<string, PuppetState>;
    weather: 'clear' | 'rain';
    stageEffects: string[];
  };
  ```
- **Transitions:**
  - `startShow(taleId: string): ShowState` -> resets state.
  - `spawnPuppet(state, id, ...): ShowState` -> sets `visible: true`, resets `x, y`.
  - `movePuppet(state, id, targetX): ShowState`
  - `setPuppetAction(state, id, action): ShowState` (actions: 'jump', 'dance', 'hide')
  - `triggerEffect(state, effect): ShowState` -> adds effect, calculates applause boost.
  - `boostApplause(state, amount): ShowState`
  - `finishShow(state): ShowState` -> sets status to finished.
- **Persistence Shape:**
  - Under `saveKey: 'san_choi_water_puppet'`.
  - Shape: `{ highestApplause: Record<string, number> }` (tracks best score per tale).

## 3. Scene & Visuals (`scene.ts`)
- **Reuse:** The existing sunset sky, shimmering water (`wp-water`, `wp-sky`), lanterns, ripple animation, and `PUPPETS` (`teu`, `dragon`, `fish`, `farmer`).
- **DOM Animation:** GSAP handles translations. The existing CSS structure is preserved, but puppet elements are dynamically created/destroyed or updated based on `ShowState`.
- **Reduced-Motion:** Check `reducedMotion()` from `src/motion.ts`. If true, GSAP tweens use `duration: 0` and CSS continuous animations are disabled via media query (already in existing CSS).
- **State Subscription:** The UI and WebMCP tools call a mutator (e.g., `driveAction`). This synchronously updates the pure state and returns immediately. A separate renderer function (`renderScene(state)`) is called to fire-and-forget the GSAP tweens. **Critically, the tool execute() must NOT await the GSAP timeline.**

## 4. WebMCP Tool Surface (`tools.ts`)
The showcase of the game. 9 tools designed to give the agent full leverage over the stage.
Every mutating tool follows the hang-proof pattern: return state immediately, visual updates are asynchronous.

1. `water_puppet_list_tales`
   - **Description:** Lists available tales to perform and their cast.
   - **Input:** `{}`
   - **Execute:** Returns static list of tales. (readOnlyHint: true)
2. `water_puppet_start_show`
   - **Description:** Starts a new puppet show for a specific tale.
   - **Input:** `{ taleId: string }`
3. `water_puppet_show_state`
   - **Description:** Gets current stage status, puppet positions, and applause meter.
   - **Input:** `{}`
   - **Execute:** Returns `ShowState`. (readOnlyHint: true)
4. `water_puppet_spawn_puppet`
   - **Description:** Makes a puppet emerge from the water.
   - **Input:** `{ puppetId: string, name: string, asset: string, x: number }` (asset can be 'teu', 'dragon', or any emoji)
5. `water_puppet_move_puppet`
   - **Description:** Moves a puppet across the stage.
   - **Input:** `{ puppetId: string, targetX: number }`
6. `water_puppet_puppet_action`
   - **Description:** Triggers a puppet action (e.g., 'jump', 'dance', 'dive').
   - **Input:** `{ puppetId: string, actionType: string }`
7. `water_puppet_trigger_effect`
   - **Description:** Triggers a stage effect (e.g., 'splash', 'rain') and SFX. Dramatically boosts applause.
   - **Input:** `{ effectName: string }`
8. `water_puppet_speak`
   - **Description:** Puppet or Narrator speaks a line to the audience.
   - **Input:** `{ speaker: string, message: string }`
9. `water_puppet_finish_show`
   - **Description:** Ends the show, reveals the final applause score rating, and saves progress.
   - **Input:** `{}`

## 5. Integration Checklist
- [ ] **`src/hub.ts`**: Remove the `comingSoon = g.id === 'water-puppet'` ribbon lock; enable click-through.
- [ ] **`src/games/water-puppet/index.ts`**: Import `tools.ts`, populate `GameDef.tools`, set `saveKey: 'san_choi_water_puppet'`.
- [ ] **`src/ui.ts` / Game Shell**: Add Vietnamese how-to modal content for water-puppet (e.g., (1) Chọn vở kịch, (2) Điều khiển rối, (3) Lấy điểm vỗ tay).
- [ ] **Other Games**: Zero changes to `o-an-quan` or `bau-cua`.

## 6. Acceptance Criteria
- [ ] `npm run build` succeeds (green build, no TS errors).
- [ ] Playable by a kid via UI action buttons AND driveable by a WebMCP agent.
- [ ] Tools return JSON immediately under reduced-motion AND under throttled rAF without hanging.
- [ ] Live-verifiable on sanchoi.pages.dev.

## 7. Asset Policy
- **Visuals:** Text-only (SVG/CSS/emoji). Use existing SVGs (`teu`, `dragon`, `fish`, `farmer`). NO new binary assets. New characters use Emoji.
- **Audio:** Reuse `src/audio.ts` sounds. 
  - `splash` (water emergence/jumps)
  - `win_chime` (applause milestones / show finish)
  - `dice_roll` (rumbling moves / dragon dance)
  - `sneeze` (comic relief)
  - `coin` (minor applause up)
  - NO new audio files.
