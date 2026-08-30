# Sân Chơi — Redesign Spec (Implementation-Ready)

**Scope:** presentation, interaction, and visual system only. All game rules, WebMCP tool
surfaces, state persistence, and audio plumbing stay untouched (§6).
**Target:** live at sanchoi.pages.dev; Vite + TS + gsap + three.js; no backend.

---

## 0. Current-State Audit (what exists today)

| Area | Today | Problem this redesign fixes |
| :--- | :--- | :--- |
| Shell | Near-black `#0a0a12` bg, dark glassmorphism panels, gold accents | Reads as generic dark SaaS / sterile AI demo, cold for kids |
| Gate | Dark radial gradient, landscape-biased | Portrait phones get an orientation-lock overlay (`#orientation-hint`) |
| Hub | Card grid over sunset sky, `rgba(10,10,18,.85)` cards | Cards blend into dark bg; weak hierarchy; emoji-only art |
| Ô ăn quan | Brown board, cream pits — decent | Mismatched fonts (`Segoe UI`), no celebration state, no onboarding |
| Bầu cua | Dark radial `#2e1c14` casino feel | Casino-dark mood; needs festival warmth; symbols are emoji-only |
| Water-puppet director | Only `prototype.html` + legacy SVGs (`public/assets/puppets/*`) | Not in hub; restore as third experience |
| Settings | Mute button only | No music picker, no motion/accessibility surface |
| Motion | GSAP everywhere, no `prefers-reduced-motion` handling | Accessibility gap |

Screens to ship: **Gate → Hub → Game Shell (×3 games) → Settings/Sound sheet → per-game
How-to-play sheet → Result celebration overlay.**

---

## 1. Design Intent + Audience

**Audience.** Vietnamese children (~5–12) playing with family; bilingual labels (Việt first,
English second). Secondary audience: WebMCP Challenge judges viewing on desktop — the app
must read as culturally specific and crafted, not as a template.

**Intent.**
- **Warm daylight festival, not dark stage.** Move from "night theater" to a village
  courtyard at festival time (sân đình ngày hội): paper cream, vermilion, marigold, bamboo.
- **Đông Hồ painting as the art anchor.** Colors come from real Đông Hồ pigment names
  (giấy điệp, son, hoa hòe, lá tre) — culturally accurate, naturally kid-warm.
- **Kid-friendly ≠ crude.** Rounded, chunky, tactile "wooden toy" feel; no cartoon gore,
  no neon, no casino cues (bầu cua is a family Tết game — points are "điểm thưởng").
- **Calm.** One warm background, generous spacing, at most one ambient motion per region.
- **Portrait-first on phones, comfortable on desktop.** The current landscape lock is
  removed; every screen works 360×640 portrait up to 1920 wide.

**Anti-goals.** Dark SaaS glass panels; purple/blue AI gradients; pure `#000`/`#FFF`
surfaces; cold gray shadows; emoji-as-art where an illustration can exist later
(emoji remain the sanctioned placeholder, §7).

---

## 2. Visual Design System

### 2.1 Color tokens (hex + role)

CSS custom properties on `:root` (rename existing ones in `index.html`; keep old names as
deprecated aliases for one release so nothing breaks mid-migration).

| Token | Hex | Role |
| :--- | :--- | :--- |
| `--paper` | `#F7EFDC` | App background (giấy điệp paper cream) |
| `--paper-bright` | `#FDF8EC` | Card / modal surfaces |
| `--paper-deep` | `#EDDFC3` | Inset/recessed areas (board mat, wells) |
| `--ink` | `#2E2A26` | Primary text, outlines (bamboo-ash black, never pure #000) |
| `--ink-soft` | `#6E5F4B` | Secondary text, captions |
| `--lacquer` | `#C63B2A` | Primary action (son vermilion) |
| `--lacquer-bright` | `#D94A38` | Hover |
| `--lacquer-deep` | `#A52F21` | Pressed / active |
| `--marigold` | `#F0A828` | Highlight, badges, quan pit glow (hoa hòe yellow) |
| `--marigold-bright` | `#FFC94D` | Celebration, win accents |
| `--leaf` | `#3F7D4E` | Success, valid-move affordance, "your turn" |
| `--pond` | `#2C8596` | Water scenes (bầu cua arena frame, puppet stage water) |
| `--pond-deep` | `#14555F` | Water depth, focus ring |
| `--wood` | `#8A5A33` | Board frames, borders |
| `--wood-deep` | `#59371F` | Button bottom-edges, deep borders |
| `--scrim` | `rgba(47, 38, 28, 0.55)` | Modal/drawer scrim (warm, not blue-black) |
| `--error` | `#B42318` | Invalid feedback only (never for decoration) |

Rules:
- Body text is always `--ink` on paper tones (contrast ≥ 10:1). Button labels are
  `#FFF8EC` on `--lacquer` (≥ 4.5:1 at 18px bold).
- Warm shadows only: tint with `--wood-deep`, never neutral gray/blue
  (e.g. `rgba(89, 55, 31, 0.18)`).
- Night elements (stars, lanterns) survive only as small accents on the Gate, on warm
  indigo `#2B2440` — never as the app background.

### 2.2 Typography

Self-hostable, OFL-licensed, full Vietnamese diacritic coverage:

| Use | Font | Weights | Notes |
| :--- | :--- | :--- | :--- |
| Display: titles, banners, big buttons, scores | **Baloo 2** | 600, 800 | Rounded, chunky, kid-warm, complete `viet` subset |
| Body/UI: descriptions, labels, dialogs | **Be Vietnam Pro** | 400, 600, 700 | Designed for Vietnamese; keeps current choice |

- Self-host via `@fontsource/baloo-2` + `@fontsource/be-vietnam-pro` (woff2, `viet`
  subset) — removes the Google Fonts CDN dependency in `index.html`.
- Stacks: `--font-display: 'Baloo 2', 'Be Vietnam Pro', system-ui, sans-serif;`
  `--font-body: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif;`
- Scale (16px root): display `2rem/800`, screen title `1.375rem/700`, body `1rem/400`,
  caption `0.8125rem/600`. Buttons/labels minimum `1.125rem` ("kid mode" default).
- Diacritics: never set `line-height < 1.25` on Vietnamese text; never `text-transform:
  uppercase` body Vietnamese (tone marks clip); caps allowed only on short Latin labels.
- Replace the `'Segoe UI'` overrides inside both scene files with `var(--font-body)`.

### 2.3 Spacing, radius, shadow

- Space scale (4px): `4 / 8 / 12 / 16 / 24 / 32 / 48`. Component gaps: 8 within groups,
  16 between groups, 24 between sections. Touch targets ≥ 44×44px, ≥ 8px apart.
- Radius tokens: `--r-pill: 999px` (chips, stakes), `--r-btn: 14px`, `--r-card: 20px`,
  `--r-board: 28px`, pits circular. Optional organic wobble for seeds/stones:
  `border-radius: 48% 52% 50% 50% / 52% 48% 52% 48%`.
- Shadow tokens:
  - `--shadow-paper: 0 2px 0 rgba(89,55,31,.12), 0 8px 24px rgba(89,55,31,.14)` (cards)
  - `--shadow-toy: 0 3px 0 var(--wood-deep)` (buttons — tactile wooden-toy edge; on
    `:active` translateY(2px) and edge becomes `0 1px 0`)
  - `--shadow-float: 0 12px 32px rgba(89,55,31,.22)` (modals, celebration)
- Borders: 2px `--wood` on interactive surfaces; decorative frames use the Đông Hồ
  corner-ornament SVG (§7) instead of drop shadows.

### 2.4 Motion (GSAP) rules

Tokens: `--dur-micro: .15s`, `--dur-std: .3s`, `--dur-scene: .5s`, `--dur-celebrate: .9s`.

| Interaction | Ease | Duration |
| :--- | :--- | :--- |
| Button/chip press | CSS transform only | micro |
| Screen/scene enter | `power2.out` | scene |
| Playful entrances (Tễu toast, banners) | `back.out(1.6)` | scene |
| Seed hops (ô ăn quan sowing) | `power1.inOut` (keep current) | per-hop, keep current cap |
| Dice tumble | keep current `power3.out` | keep current |
| Win celebration | `back.out(1.4)` + stagger 0.05 | celebrate |
| Loss feedback | `power2.out`, single soft dip | std |

Rules:
- One ambient loop per region max (lantern sway ≤ 2°, water shimmer). No pulsing text.
- **`prefers-reduced-motion: reduce`:** add `src/motion.ts` exporting
  `reducedMotion()` + a gsap `matchMedia` wrapper. Under reduce: gate slides become
  opacity fades ≤ 0.2s; seed hops and dice tumbles collapse to crossfade + final-state
  snap; screen shake ("XỐC! BA CON!") and confetti are skipped entirely; ambient loops
  off. All existing trigger code paths keep firing — only the tween changes.
- Never block input on animation: keep the existing `clickEnabled` guards as-is.

### 2.5 Art direction: folk-game motifs

- **Frame everything like a festival poster:** 2px wood borders + Đông Hồ corner
  ornaments on boards, mats, and modals.
- **Ô ăn quan:** wooden tray (khay gỗ) look — `--wood` frame, `--paper-deep` recessed
  pits, seeds as brown stones; quan pits glow `--marigold` (the mandarin is precious).
- **Bầu cua:** festival mat (chiếu) instead of casino felt — warm woven texture via CSS
  repeating-gradient on `--paper-deep`; betting tiles as paper cards; dice stay 3D but
  faces use cream `#FFF8EC` with wood border (retexture `dieTexture()` colors only).
- **Water puppet stage:** keep the sunset water idea but warmer; water = `--pond` →
  `--pond-deep` gradient; puppets use existing SVGs; red lanterns + bamboo frame.
- **Iconography:** trống cơm (drum) for sound, lá cờ đuôi nheo (pennant flags) string as
  divider motif, hoa văn corner scrolls for frames. Emoji remain the interim icons.

---

## 3. Layout & Site Structure

Breakpoints: **P** portrait phone (< 600px), **T** 600–1023px, **D** ≥ 1024px.
Remove the portrait orientation-lock entirely (`#orientation-hint` block in
`index.html`); portrait is a first-class layout.

### 3.1 Screen order

`Gate → Hub → (Game Shell ⇄ Settings sheet / How-to sheet / Result overlay) → Hub`

### 3.2 Gate (startup / audio unlock)

```text
P (portrait phone)                    D (desktop)
+----------------------+      +----------------------------------------+
|  * pennant flags *   |      |          * pennant flags *             |
|                      |      |                                        |
|    [lantern]         |      |     SÂN CHƠI            (centered,     |
|      SÂN CHƠI        |      |     Trò chơi dân gian    max-w 560px)  |
|  Trò chơi dân gian   |      |     [ big red: Vào Chơi 🔊 ]           |
|  ------------------  |      |     footer: WebMCP Challenge ...       |
|  [ Vào Chơi 🔊 ]     |      +----------------------------------------+
|  footer              |
+----------------------+
```
- Background: `--paper` with subtle giấy điệp speckle (§7); Đông Hồ frame around content.
- Title in Baloo 2 800 `--lacquer`; subtitle `--ink-soft`; button = primary component.
- Returning users: same screen, subtitle swaps to "Chào mừng trở lại!" (keep the tap-to-
  unlock requirement — do not auto-skip the gate).
- Gate exit: slide up `--dur-scene` (fade under reduced motion), then hub fades in.

### 3.3 Hub (home)

Section order (top → bottom):
1. **Header bar** (48px): logo mark + "Sân Chơi" (Baloo 2) left; right = sound toggle +
   settings (gear) icon buttons.
2. **Greeting strip:** "Chọn một trò chơi dân gian nhé!" + small Tễu illustration/emoji.
3. **Game cards grid:** 1 col (P), 2 col (T), 3 col (D); max-width 1040px centered.
4. **Footer:** WebMCP status pill + "Made in Việt Nam" credit.

```text
P: card = [illustration 4:3] / name (vi, Baloo 2 1.375rem) / sub (en) /
   [players chip] [Đã chơi ×2 stamp] / [Chơi ngay →] full-width button
D: same card, 3-up grid; hover lifts card (--shadow-float)
```
- Card surface `--paper-bright`, 2px `--wood` border, `--r-card`, `--shadow-paper`.
- "Played ×N" renders as a tilted red stamp (seal) — reuse `san_choi_ledger` data as-is.
- WebMCP pill: green dot "WebMCP: Online" / amber "Fallback" — same logic, restyled
  (paper chip, not dark glass).

### 3.4 Game shell (shared by all 3 games)

```text
+--------------------------------------------------------------+
| [←]  Ô ĂN QUAN            [turn/status banner]      [🔊] [⚙] |  top bar 56px
+--------------------------------------------------------------+
|                                                              |
|                     PLAY AREA (scene)                        |
|                                                              |
+--------------------------------------------------------------+
|  [action bar: context buttons — new game / roll / save]      |  bottom, P only
+--------------------------------------------------------------+
```
- Top bar: back button (icon-btn), game title (Baloo 2), centered turn/status banner
  slot (existing `showTurnBanner` target), sound + settings icons.
- P: play area fills between bars; action bar pinned bottom (thumb zone).
  D: play area centered, max-width 960px, decorative frame; action bar inline under it.
- Scene container keeps its contract: `buildScene(container)` / `destroyScene()` —
  the shell only changes surrounding chrome and injected `<style>` contents.

### 3.5 Ô ăn quan screen

Keep the classic layout (quan ends + 2 rows of 5) — it is culturally correct:

```text
+----------------------------------------------------------+
|  [Người 2 chip + score]                                  |
|  +------+  [p2][p2][p2][p2][p2]  +------+               |
|  | QUAN |                          | QUAN |               |
|  +------+  [p1][p1][p1][p1][p1]  +------+               |
|  [Người 1 chip + score]                                  |
|  [🔄 Ván mới]                                            |
+----------------------------------------------------------+
```
- Board sits on a wooden tray: `--wood` frame 4px, `--paper-deep` inner mat, Đông Hồ
  corners. Board width `min(94vw, 680px)`; pits keep `aspect-ratio: 1` so portrait
  phones scale cleanly (current layout already flexes — only restyle, no re-layout).
- Active player's row: soft `--marigold` wash + 2px `--marigold` ring (replaces yellow
  `rgba(255,235,59,.2)`). Opponent/empty pits: `data-disabled` → 60% saturation, no
  hover, cursor default.
- Score chips: paper pill with stone icon + count in Baloo 2; count-up tween on capture.
- Turn banner uses shared shell slot: "Lượt: Người 1" with leaf-green dot.

### 3.6 Bầu cua screen

```text
P (stacked)                          D
+----------------------+      +-----------------------------+
| [Điểm: 100][Vòng: 1] |      |  dice arena (3D) |  mat 3×2  |
|   dice arena (3D)    |      |  result banner   |  stakes   |
|   result banner      |      |  stakes + [Lắc!] |  [Lắc!]   |
|   mat 3×2            |      +-----------------------------+
|   stakes [🧹][Lắc!]  |
+----------------------+
```
- Root background: festival mat (`--paper-deep` woven repeating-gradient), **not** the
  current dark radial. Three.js canvas keeps `alpha: true` over the mat.
- Dice face retexture (colors only in `dieTexture()`): bg `#FFF8EC`, border `--wood`.
- Betting tiles: paper cards, symbol emoji 2rem + Vietnamese name; bet badge = red
  stamped chip top-right with points.
- Result banner: win `--marigold-bright` wash, lose `--ink-soft` on paper (gentle),
  triple = full-width "XỐC! BA CON!" festival ribbon.
- Points/round pills restyled as paper chips; keep exact DOM hooks
  (`[data-role="points"]`, `[data-role="round"]`).

### 3.7 Water-puppet director view (restore as third hub card)

Today only `prototype.html` + assets exist. Restore as game id `water-puppet` using the
prototype's CSS water/sky (recolored to §2 tokens) and existing puppet SVGs:

```text
+-------------------------------------------------------------+
| [←] 🎭 MÚA RỐI NƯỚC        [agent status pill]     [🔊][⚙] |
|   ~~~~~~~~~ water surface, puppet SVGs on sticks ~~~~~~~~~   |
|   [Tễu] [Rồng] [Cá] [Nông dân]   (billboard sprites)        |
|   toast slot (Tễu 4th-wall lines)                            |
+-------------------------------------------------------------+
```
- Agent-driven via WebMCP (its tools follow the same `GameToolDef` pattern when built;
  until then the card shows "Sắp ra mắt — coming soon" ribbon and is tappable into a
  demo mode reusing `prototype.html` behavior). This spec does not define new tools.
- Water: `--pond`→`--pond-deep` gradient + existing ripple animation; sky stays warm
  sunset; lanterns as accents.

### 3.8 Settings / Sound sheet

Bottom sheet (P) / centered modal (D), opened from gear icon in hub header or game shell:
1. **Âm nhạc:** radio list of the 3 existing tracks + Tắt (maps to `playBGM('dan_bau' |
   'festive' | 'gong' | 'silent')` — no new audio API).
2. **Hiệu ứng:** SFX mute toggle (same `toggleMute()`; split BGM/SFX display only).
3. **Chuyển động:** "Giảm chuyển động" toggle → sets the same flag `motion.ts` reads
   (defaults from `matchMedia('(prefers-reduced-motion: reduce)')`, user override wins,
   persisted to `localStorage.san_choi_motion`).
4. **Dữ liệu:** "Xóa tiến trình" (clears `san_choi_*` keys after confirm dialog).

### 3.9 Onboarding (per-game How-to sheet)

- First entry into each game (flag `san_choi_seen_<gameId>` in localStorage) shows a
  3-step illustrated bottom sheet: e.g. ô ăn quan = (1) chọn ô của bạn, (2) rải hạt
  ngược chiều kim đồng hồ, (3) ăn hạt khi rơi cạnh ô trống. Bilingual one-liners.
- One button: "Chơi luôn!" — dismisses and sets the flag. No multi-step tour, no coach
  marks over the board.

---

## 4. Components + States

| Component | States |
| :--- | :--- |
| **Button** (primary/secondary/ghost/icon) | idle · hover (`--lacquer-bright`) · pressed (translateY 2px, edge shrinks) · focus-visible (2px `--pond-deep` ring, offset 2) · disabled (50% sat, no shadow-edge) · loading (dice rolling: label swap, no spinner library) |
| **GameCard** | idle · hover/pressed lift · badge "Played ×N" · coming-soon ribbon (water puppet until built) |
| **Pit (ô dân)** | idle · hoverable (current player only, `--marigold` ring) · scooping (during sowing anim) · disabled (empty or opponent: `data-disabled`, desaturated) · capture-flash (leaf-green ring 0.4s) |
| **Quan pit** | idle (marigold glow) · empty (paper-deep, no glow) — never clickable |
| **Seed** | resting (in pit) · flying (`.oaq-flying-seed`, recolor to `--wood-deep` stone) · captured (flies to score chip) |
| **Score chip** | idle · count-up bump on change · leading state (marigold ring on leader) |
| **BetTile** | idle · selected (bet placed: badge + `--leaf` border) · winning (marigold pulse once) · losing (brief 80% dim) · disabled (during roll) |
| **Stake chip** | idle · active (marigold fill, ink text) · disabled when insufficient points |
| **Dice (3D)** | idle slow-spin · rolling · settled (face up) — timing unchanged |
| **Turn/status banner** | hidden · shown (paper chip, slides down `back.out(1.6)`) |
| **Toast (Tễu)** | hidden · shown (slide-in left, Tễu face, auto-hide; keep `showToast` API) |
| **Sheet/Modal** | closed · open (scrim `--scrim`, panel `--shadow-float`) · closing |
| **Result overlay** | win: "Thắng rồi! 🎉" Baloo 2 2rem + paper-flower confetti + [Chơi lại][Về trang chủ]; lose: gentle "Suýt nữa thì thắng!" + same actions; draw: "Hòa rồi!" — no harsh failure styling |
| **WebMCP pill** | online (leaf dot) · fallback (marigold dot, "Fallback") |
| **Sound toggle** | on 🔊 / muted 🔇 (existing behavior) |

Celebration confetti: 24 DOM petals (red/marigold/green paper rects), GSAP stagger fall,
removed after 1.2s; skipped under reduced motion. Reuses no external lib.

---

## 5. Interaction Details Worth Calling Out

- **No input blocking:** keep `clickEnabled` / `isRolling` guards exactly as today.
- **Agent-driven moves:** when a WebMCP tool drives a move, the same animations play;
  add a small "🤖" chip in the turn banner text only (logic unchanged).
- **Funny hooks re-skinned, same triggers:**
  - `>5` unsaved actions → toast text stays "Người xướng trò bị rối!" (Tễu face).
  - Ô ăn quan weak agent move → pit grumble wiggle + toast (keep).
  - Bầu cua triple → ribbon + shake (shake off under reduced motion).
- **Safe areas:** keep `viewport-fit=cover`; add `env(safe-area-inset-*)` padding to top
  bar and bottom action bar.

---

## 6. What Stays Untouched (explicit non-goals)

Do **not** modify during the redesign:

1. **Game rules:** `src/games/o-an-quan/rules.ts`, `src/games/bau-cua/rules.ts` —
   board shape (5+2 quan), relay sowing, capture chain, payouts (1×/2×/3×), all pure
   functions and their signatures.
2. **WebMCP surface:** `src/webmcp.ts` (registration, abort, fallback, unsaved-action
   counter), all `tools.ts` names/schemas/JSON return shapes, `src/types.ts`.
3. **Persistence:** localStorage keys `san_choi_ledger`, `san_choi_oaq`,
   `san_choi_baucua`, `san_choi_last_save`, `waterPuppetMuted` (new keys only:
   `san_choi_seen_*`, `san_choi_motion`).
4. **Audio plumbing:** `src/audio.ts` API (`initAudio/playBGM/playSFX/toggleMute/
   getMuteState`), track ids, file paths under `public/assets/audio/`.
5. **Scene lifecycle:** `GameDef.buildScene(container)` / `destroyScene()` contract,
   hub events (`game-start`, `hub-hidden`, `hub-shown`, `webmcp-status-change`),
   `markGameCompleted` ledger behavior.
6. **Animation timing logic** in scenes (sowing trace, hop duration cap, dice rotation
   math, capture clump) — only eases/colors/DOM classes around them may change.

The redesign edits: `index.html` (CSS tokens + chrome), `src/hub.ts` card markup/styles,
`src/ui.ts` chrome helpers, both `scene.ts` files' injected `<style>` blocks + class
names, and adds `src/motion.ts` + assets (§7).

---

## 7. Asset & Requirement List

| Asset | Spec | Source / placeholder |
| :--- | :--- | :--- |
| Font: Baloo 2 (600, 800) | woff2, `viet` subset | `@fontsource/baloo-2` (OFL) — self-hosted |
| Font: Be Vietnam Pro (400, 600, 700) | woff2, `viet` subset | `@fontsource/be-vietnam-pro` (OFL) — replaces Google Fonts `<link>` |
| Paper speckle texture | inline SVG feTurbulence data-URI, ~1KB | Generate (no binary file) |
| Đông Hồ corner ornament | single SVG, currentColor, used at 4 rotations | Hand-draw simple hoa văn scroll; placeholder: 2px double border |
| Pennant flag divider (cờ đuôi nheo) | SVG string of triangles | Hand-draw; placeholder: none (skip) |
| Game card illustrations ×3 | flat SVG, ≤ 8KB each, §2 palette | Phase 1 placeholder: emoji on paper-deep roundel (current emoji 🪨🦀🎭); phase 2: commissioned/Inkscape Đông Hồ-style SVGs |
| Water-puppet sprites | reuse `public/assets/puppets/{teu,dragon,farmer,fish}.svg` | Existing |
| Water normal map | reuse `public/assets/textures/waternormals.jpg` | Existing |
| Favicon | lantern or trống cơm SVG, 32/192/512 | Hand-draw; placeholder: 🏮 emoji-in-SVG |
| Audio | existing 3 BGM + 6 SFX unchanged | Existing (`make_audio.py` synth, CC0) |
| New SFX (optional) | wood-block "tock" (button press), soft gong (result) | Synthesize via existing `make_audio.py`; skip if out of time |
| Confetti petals | DOM rects, no asset | Code-only |

**Build/config changes:** add fontsource deps; no new runtime libs (confetti/toasts are
hand-rolled GSAP). `vite.config.ts` unchanged.

---

## 8. Migration Checklist (order of work)

1. Add fonts (fontsource) + define §2 tokens in `index.html`; alias old vars.
2. Restyle Gate + remove orientation lock; verify portrait 360×640 → desktop 1920.
3. Add `src/motion.ts` (reduced-motion helper) and wire into existing gsap call sites.
4. Restyle hub cards + header/footer chrome (`src/hub.ts`, `src/ui.ts`).
5. Restyle ô ăn quan injected styles (classes/DOM hooks unchanged).
6. Restyle bầu cua injected styles + dice face colors (no logic changes).
7. Settings sheet + How-to sheets + result overlay components.
8. Water-puppet card (coming-soon → demo mode from prototype.html assets).
9. Pass: contrast check, 44px targets, `prefers-reduced-motion` walkthrough,
   Vietnamese diacritics at every size, `npm run build` clean.
