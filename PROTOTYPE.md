# PROTOTYPE.md — Static UI Shell Prototype

## Purpose

A single self-contained HTML file (`prototype.html`) that renders the complete UI shell of the Water Puppet Director app **without** Three.js or any external dependencies. This lets us validate the visual design, layout, color palette, overlay positioning, and interaction patterns before committing to 3D implementation.

## What the Prototype Shows

| Element | Implementation | Status |
|---------|---------------|--------|
| Water stage area | CSS gradient + animated ripple effect | ✅ Visual only |
| Sky/backdrop | CSS radial gradient (warm sunset) | ✅ Visual only |
| Startup gate | Full-screen overlay with "Unmute & Enter Stage" button | ✅ Interactive |
| Mute toggle | Top-left icon button | ✅ Interactive |
| Show name display | Top-left text label | ✅ Static |
| Saved-shows drawer | Bottom slide-up panel | ✅ Interactive |
| Orientation hint | Portrait-mode overlay (CSS media query) | ✅ Responsive |
| Puppet placeholders | CSS-drawn colored circles with character names | ✅ Static |
| Lantern accents | CSS-drawn decorative elements | ✅ Static |

## What the Prototype Does NOT Show

- Three.js 3D rendering (water shader, sprites, sticks)
- GSAP animations
- WebMCP tool registration
- localStorage persistence
- Audio playback
- Actual puppet movement

## Tech Details

- **Single file:** `prototype.html` — no external CSS, JS, or images
- **Zero dependencies:** Pure HTML + CSS + vanilla JS
- **Mobile-first:** Designed for landscape on mid-range phones
- **Vietnamese text:** Uses proper diacritics, Be Vietnam Pro font from Google Fonts CDN (graceful fallback to system)

## Interactive Elements

1. **Startup Gate:** Click "🎭 Mở Màn — Enter Stage" to dismiss the gate overlay
2. **Mute Toggle:** Click the 🔊/🔇 button to toggle mute state (visual only, no audio)
3. **Saved Shows Drawer:** Click "📜 Vở Diễn" tab at bottom to slide open; click a show card or the tab again to close
4. **Puppet Hover:** Hover/tap puppet placeholders to see name tooltip
5. **Orientation:** Rotate phone to portrait to see the landscape hint overlay

## How to Review

```bash
# Open directly in browser
open prototype.html

# Or serve locally
python3 -m http.server 8080
# Then open http://localhost:8080/prototype.html
```

### Review Checklist

- [ ] Gate overlay covers full screen, button is large and centered
- [ ] After dismissing gate, stage area fills viewport
- [ ] Water area has visible animated ripple/shimmer effect
- [ ] Sky gradient feels warm (sunset Vietnamese evening)
- [ ] Mute button is easily tappable (≥44px), top-left corner
- [ ] Show name is readable against backdrop
- [ ] Saved-shows drawer slides up smoothly from bottom
- [ ] Drawer shows 2-3 placeholder show cards
- [ ] In portrait orientation, a rotation hint appears
- [ ] Colors match the design palette (water blues, wood browns, folk-art reds)
- [ ] Vietnamese text renders with proper diacritics
- [ ] Layout works on 360×640 through 1920×1080 viewports

## File

→ [`prototype.html`](file:///home/tri/work-mx/webmcp-water-puppet/prototype.html)
