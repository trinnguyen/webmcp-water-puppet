# 🎭 Đạo Diễn Múa Rối Nước (The AI Water Puppet Director)

This is an entry for the OpenAI WebMCP Challenge. It is an interactive, agent-native web application that allows an AI Agent (like ChatGPT) to direct a traditional Vietnamese Water Puppet (Múa Rối Nước) show!

## 🌟 Concept

Water puppetry is a unique Vietnamese folk art dating back to the 11th century. This app brings it to the modern AI era. You converse with an AI agent, and it uses WebMCP tools to spawn puppets, choreograph movements, set the music, and save the show. 

## 🛠️ Tech Stack

- **Vite** + **TypeScript**
- **Three.js** (for 3D scene and 2D sprite billboarding)
- **GSAP** (for complex choreographies and easing)
- **WebMCP** (native `document.modelContext.registerTool` API)
- No backend required! Everything persists in `localStorage`.

## ⚙️ How the WebMCP Tools Work

The app registers 5 tools directly with the LLM via `document.modelContext.registerTool`:
1. `list_cast`: Asks the stage what characters are available.
2. `spawn_puppet`: Places a puppet on the 3D water plane at specific X/Z coordinates.
3. `choreograph_move`: Queues an animation (splash, spin, jump, chase, wave).
4. `set_music`: Changes the background track.
5. `save_show`: Saves the show to LocalStorage and triggers an "Applause" hook.

We strictly follow the new WebMCP specifications:
- We pass a schema using the standard JSON Schema structure (`inputSchema`).
- Tools execute asynchronously and return strings.
- Graceful Unregistration via `AbortController.signal`.
- **Fallback Mode:** If you run this in a regular browser (outside of ChatGPT desktop app), tools are exposed globally at `window.__debugTools` for DevTools testing.

## 🚀 How to Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173`.
4. (Optional) Open DevTools Console and type `__debugTools.spawn_puppet({ character: 'teu', id: 't1', x: 0, z: 0 })` to see it in action without an AI!

## 🤡 Funny Hooks (Agent Interactions)
The app is built to playfully respond to the agent's actions:
- **Tễu's 4th Wall:** Queue more than 5 moves without saving, and Tễu will interrupt!
- **Fish Panic:** Spawning a Dragon near a Fish makes the Fish swim away.
- **Dragon Sneeze:** 10% chance a Dragon's splash results in a sneeze.
- **Sleepy Farmer:** Leave the farmer idle for 10 seconds, and he falls asleep in the water.

## 📜 License
MIT License. See `LICENSE` for details.
