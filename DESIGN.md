# Đạo Diễn Múa Rối Nước (The AI Water Puppet Director)
**Visual & UX Design Specification**

---

## 1. Mobile-First Landscape Layout

The app is built strictly for landscape mobile usage to maximize the 3D stage area, giving kids a "puppet theater" view.

### Responsive Behavior & Touch Constraints
- **Orientation:** Landscape-first. If portrait is detected, a full-screen CSS overlay appears: *"Vui lòng xoay ngang màn hình nhé! 🔄 (Please rotate your phone!)"*
- **Touch Targets:** Absolute minimum of 44px by 44px for kids' fingers. 16px spacing between interactive elements.
- **DOM Overlay:** The Three.js canvas sits fixed at `z-index: 1`. The UI layer is `absolute` positioned at `z-index: 10` on top of the WebGL canvas, utilizing standard flexbox/grid for HUD elements.

### ASCII Wireframes

**(a) Startup / Unmute Gate Screen**
```text
+-------------------------------------------------------------+
|                                                             |
|                   🏮 ĐẠO DIỄN MÚA RỐI NƯỚC 🏮               |
|                                                             |
|                [ Bắt đầu & Bật tiếng 🔊 ]                   |
|                   (Unmute & Enter Stage)                    |
|                                                             |
+-------------------------------------------------------------+
```

**(b) Main Stage View**
```text
+-------------------------------------------------------------+
| [Mute 🔊]  [Show: The Magic Carp]             [⭐ Saved]    |
|                                                             |
|                           (  DRAGON  )                      |
|                               | |                           |
|      ( TỄU )                  | |                           |
|        | |                    | |                           |
| ~~~~~~~~~~~~~~~~~~~~~~~ WATER SURFACE ~~~~~~~~~~~~~~~~~~~~~ |
|                                                             |
+-------------------------------------------------------------+
```

**(c) Saved-Shows Drawer Open**
```text
+-------------------------------------------------------------+
|                               | 📂 Các Vở Kịch Đã Lưu       |
|                               | -------------------------   |
|         (BLURRED              | [▶] The Magic Carp        |
|          STAGE                | [▶] Tễu and the Farmer    |
|          BEHIND)              | [▶] Dragon's Sneeze       |
|                               |                             |
|                               |                  [ Đóng ]   |
+-------------------------------------------------------------+
```

---

## 2. Color Palette

The palette is inspired by traditional Vietnamese lacquer paintings, water puppet theaters (Thủy Đình), and vibrant folk toys, optimized for bright mobile screens.

| Category | Color Name | Hex Value | Usage / Notes |
| :--- | :--- | :--- | :--- |
| **Water Blues** | Deep Pond | `#004B87` | Base water color (depth) |
| | Ripple Blue | `#0077C8` | Water surface highlights |
| | Splashed Foam | `#E0F2FE` | Particle color for splashing effects |
| **Wood Browns** | Wet Wood | `#4A2E15` | Submerged puppet sticks |
| | Stage Frame | `#8B5A2B` | UI borders, wooden accents |
| **Folk-Art** | Lacquer Red | `#C92A2A` | Primary accent, lanterns, Tễu's lips |
| | Imperial Yellow| `#FFD700` | Dragon scales, stars, highlights |
| | Rice Green | `#2E8B57` | Farmer accents, lily pads |
| **UI Colors** | Overlay BG | `#000000B3` | 70% opacity black for drawer / gate |
| | UI Text | `#FFFFFF` | Primary readable text |
| | UI Button | `#D9381E` | Play/Action buttons |
| **Char Accents**| Tễu Peach | `#FFCBA4` | Tễu's skin tone |
| | Fish Silver | `#E0E0E0` | Carp base color |

---

## 3. Typography

All typography must support Vietnamese diacritics natively so characters like `ă, â, đ, ê, ô, ơ, ư` and tone marks render beautifully without fallback font-shifting.

- **Primary Font Recommendation:** **Be Vietnam Pro** (Google Fonts). It's explicitly designed for the language.
- **Font Stack:** `'Be Vietnam Pro', 'Segoe UI', Arial, sans-serif`
- **Size Scale (based on 16px root):**
  - Title/Gate Heading: `2.0rem` (32px) - bold, slight text-shadow
  - Drawer Headings: `1.25rem` (20px) - semi-bold
  - Body/Buttons: `1.125rem` (18px) - medium
  - Puppet Labels (3D Sprite text): `1.0rem` (16px) - bold, white with black outline.

---

## 4. 3D Scene Composition

- **Camera Setup:** Fixed PerspectiveCamera. 
  - `position: (0, 8, 15)`
  - `lookAt: (0, 0, 0)` 
  - Result: roughly a 30° downward angle gazing upon the water, matching a real audience's view at a Thủy Đình.
- **Water Plane:** Custom shader or Three.js `Water` object at `y = 0`. Uses a subtle normal map for ripples. Reflection color blends from sky ambient light.
- **Sky / Backdrop:** A gradient background simulating a warm Vietnamese village evening (sunset). Deep orange `#FF7E5F` fading up into twilight purple `#FEB47B`. 
- **Lighting:**
  - `AmbientLight`: Warm yellowish-white (`#FFF3E0`), intensity `0.6`.
  - `DirectionalLight`: Positioned at `(-10, 10, 5)` representing the setting sun. Casts soft shadows onto the water surface.
- **Accents:** 2 or 3 glowing red paper lanterns (`Sprite` or simple `Mesh` with `PointLight`) flanking the top corners of the stage to frame the view.

---

## 5. Puppet Art Direction

Each puppet is mounted on a hidden underwater mechanism. Visually, they are 2D Sprites (billboards) attached to a 3D cylindrical wooden stick (`#4A2E15`, radius `0.1`, length `3.0`, starting from the bottom of the sprite and pointing downwards into the water).

### Chú Tễu (The Jester)
- **Appearance:** Plump, bare-chested boy with a pinkish complexion, hair tied in two side buns. Wears a red loincloth. Big smiling face.
- **Cultural Ref:** The iconic host and commentator of water puppetry. Represents peasant optimism.
- **Shapes:** Round peach circles for body/head, red crescent for smile, black circles for hair buns.
- **Emoji Fallback:** 👦🏻 / 🎭 

### Rồng (The Dragon)
- **Appearance:** Sinuous, majestic but cute (kid-friendly). Yellow and red scales. Big eyes, long whiskers.
- **Cultural Ref:** Symbol of power, nobility, and the bringer of rain for crops.
- **Shapes:** Wavy yellow rectangle (body), red triangles (spikes), big white circle eyes.
- **Emoji Fallback:** 🐉

### Nông dân (The Farmer)
- **Appearance:** Tan skin, wearing traditional brown clothes (áo nâu) and a conical hat (nón lá).
- **Cultural Ref:** The backbone of agricultural society; represents daily village life.
- **Shapes:** Triangle (conical hat), brown rectangle (torso), simple line arms.
- **Emoji Fallback:** 🧑‍🌾

### Cá (The Fish/Carp)
- **Appearance:** Fat, silvery-orange carp with distinct scales and a wide tail.
- **Cultural Ref:** Represents food, prosperity, and the legend of the carp transforming into a dragon.
- **Shapes:** Oval orange body, triangle tail fin, silver dot scales.
- **Emoji Fallback:** 🐟

---

## 6. Animation Feel

Motion must be exaggerated, buoyant, and cartoonish. Because these are "puppets," their movements should feel slightly snappy but constrained by water resistance.

### GSAP Ease Presets & Timing

| Action | GSAP Ease | Duration | Visual Detail |
| :--- | :--- | :--- | :--- |
| **Splash** | `elastic.out(1, 0.3)` | 0.8s | Plunges down Y by -1.0, springs back. Triggers particle foam. |
| **Spin** | `back.inOut(1.7)` | 1.0s | Rotates Y axis 360° (or slightly tilts on Z to look wobbly). |
| **Chase** | `power2.inOut` | 1.5s | Smooth translation across X/Z plane to target. |
| **Wave** | `sine.inOut` | 0.6s | Z-axis rotation back and forth (-15° to 15°), repeating 2-3x. |
| **Jump** | `circ.out` (up), `bounce.out` (down) | 1.2s | High Y arc (+2.5). Hangs in air briefly, crashes down into water. |

**Funny-Hook Animations:**
- **Tễu's entrance:** Slides in from the far right edge super fast, overshoots his mark, and tilts 45° before righting himself (`back.out(2)`).
- **Tangled strings:** Rapid, erratic shaking on X and Z axis (`RoughEase` or random fast oscillations) while moving very slowly.

---

## 7. Funny-Hook Trigger Table

| Hook Name | Trigger Condition | On-Screen Behavior | Dialogue (Vietnamese) | Dialogue (English) | Implementation Cost |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Tễu's 4th Wall** | Agent queues >5 moves without calling `save_show` | Tễu slides in from screen edge, waves frantically at camera | "Đạo diễn ơi, rối tay em mỏi rồi!" | "Director, my arms are tired!" | Low (counter in state.ts + slide tween) |
| **2. Tangled Strings** | Tool execution error (e.g., `chase` with invalid `targetId`) | All puppets jiggle erratically and freeze; console logs `String tangled. Reboot.` | "Á á! Kẹt dây rồi! Cứu Tễu với!" | "Ah! Strings tangled! Help Tễu!" | Low (error handler + shake ease) |
| **3. Fish Panic** | Dragon spawns within **3 units** of any Fish puppet | Fish overrides queue, splashes, and flees to stage edge (-10 or 10) | "Úi chà! Rồng tới, cá vọt lẹ!" | "Yikes! Dragon incoming — swim away!" | Low (distance check on spawn + jump-flee tween) |
| **4. Dragon Sneeze** | **10% random chance** when Dragon executes `splash` | Sneeze SFX plays, Dragon flashes red instead of normal splash particle | "Hắt xì! Rồng bị cảm rồi!" | "Achoo! Dragon caught a cold!" | Low (RNG check + color tween + audio) |
| **5. Sleepy Farmer** | Farmer receives no commands for >10s while on stage | Farmer sinks 0.5 units into water, "Zzz" emoji floats up from head | "Khò khò... lúa tốt quá..." | "Zzz... the crops are so good..." | Low (idle timer + Y-shift + DOM emoji) |
| **6. Applause Break** | Agent calls `save_show` successfully | All puppets on stage simultaneously do a `wave`, crowd-laugh SFX plays | "Cảm ơn khán giả! 👏" | "Thank you, audience! 👏" | Low (reuse wave animation + SFX) |

---

## 8. Audio Sourcing Guide

- **Background Music (BGM):** Needs a cheerful, instrumental folk loop. 
  - **Search Terms:** "Đàn bầu CC0", "Vietnamese traditional bamboo flute royalty free", "Water drum beat".
  - **Sources:** FreeSound.org, Pixabay Audio (filter by public domain / CC0).
- **SFX Needed:**
  - *Splash:* Heavy water plunge (wav).
  - *Wood knock:* Two wooden blocks hitting (represents puppet sticks clacking).
  - *Gong/Drum:* "Tùng tùng" drum beat for entrances.
  - *Crowd:* Kids giggling/laughing (short 2s clip).
- **Licensing/Format:** strictly CC0. Convert BGM to `.mp3` (smaller size), SFX to `.mp3` or `.wav`.
- **Mute Policy & iOS Unlock:**
  - AudioContext in browsers (especially iOS) requires a user gesture to start.
  - The "Unmute & Enter Stage" button runs `AudioContext.resume()`.
  - Global mute state is saved to `localStorage.getItem('waterPuppetMuted')` to respect preferences across reloads.

---

## 9. Startup UX Flow

1. **Initial Load (Gate Screen):** Page finishes loading assets. A colorful HTML div covers the screen showing the app title and the "Unmute & Enter Stage" (Bắt đầu) button.
2. **Gesture & Unlock:** User taps the button. `AudioContext` is unlocked. Background music fades in over 2 seconds. The gate slides up (CSS `transform: translateY(-100%)`).
3. **Orientation Check:** If the device is held vertically, a dark overlay with a rotating phone animation prompts the user to switch to landscape.
4. **Stage Entry:** The 3D scene fades from black. The water ripples softly. Empty stage.
5. **The Show Begins:** The AI Agent begins streaming commands (or the debug panel is used). A gong sounds, and Tễu slides into view to introduce the show.
6. **Returning Users:** If `localStorage` indicates they've visited and accepted audio, the Gate Screen is still shown but stylized as a "Theater Curtain", ensuring we always get the tap to unlock the AudioContext safely. 
7. **Saved Shows Drawer:** A small tab at the bottom right. Tapping it slides up a semi-transparent dark drawer listing past shows (saved in IndexedDB/localStorage). Tapping a show clears the stage and replays the stored command timeline.
