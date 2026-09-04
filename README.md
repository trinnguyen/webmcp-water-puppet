# 🏮 Sân Chơi — Vietnamese Folk Games Hub (Directed by AI)

This is an entry for the OpenAI WebMCP Challenge. It is an interactive, agent-native web application that allows an AI Agent (like ChatGPT) to act as the **Game Master (Người Xướng Trò)** and host traditional Vietnamese folk games (*trò chơi dân gian*)!

## 🌟 Concept

Traditional Vietnamese folk games have brought villages and families together for centuries. **Sân Chơi** ("The Playground") reimagines this rich cultural heritage for the modern AI era. Instead of simple chatbots or static mini-games, Sân Chơi provides a unified, interactive folk playground where an AI agent can direct performances, manage game boards, roll dice, track scores, and entertain players using native WebMCP tools.

The hub features **eight classic Vietnamese folk games**:

1. **Ô ăn quan (Vietnamese Mancala):** A centuries-old strategy board game played on a traditional board with 10 small pits (*dân*) and 2 semicircular mandarin pits (*quan*). Players take turns scooping seeds and sowing them along the board to capture opponents' pieces.
2. **Bầu cua tôm cá (Vietnamese Dice / Gourd-Crab-Shrimp-Fish):** The iconic Lunar New Year (*Tết*) dice game. Players wager kid-safe points across six iconic folk symbols (Gourd, Crab, Shrimp, Fish, Rooster, Deer) while 3 dice roll under a shaking plate.
3. **Múa rối nước (Water Puppet Folk Theatre):** Vietnam's 11th-century water stage theatrical art (*thủy đình*). The agent takes the director's chair: choosing tales (*Cóc kiện trời*, *Tấm Cám*, *Rồng cá*), commanding puppets like Chú Tễu, dragon, fish, and farmer, triggering theatrical weather and pyrotechnics, and winning over the crowd to maximize the applause score!
4. **Gióng's Iron Garage (Gara Ngựa Sắt):** Feed the iron horse, dodge invaders, defend the village — rooted in the legend of Thánh Gióng.
5. **Rồng rắn lên mây (Dragon Snake):** The classic children's chase game — the dragon's head protects its tail from the hawk.
6. **Đánh quay (Spinning Top):** Traditional spinning top game.
7. **Sơn Tinh Smart Home:** Flood-defense game based on the Sơn Tinh - Thủy Tinh legend.
8. **Bánh Chưng Physics Packer:** Stack sticky rice cakes in this physics-based puzzle.

## 🛠️ Tech Stack

- **Vite** + **TypeScript**
- **Three.js** (for 3D water puppet theater scene and sprite billboarding)
- **GSAP** (for fluid board animations, dice shaking, seed sowing, and choreographies)
- **WebMCP** (native `document.modelContext.registerTool` API)
- **Web Audio API** (synthesized folk instruments: Đàn Bầu, festive drums, village gongs, water splashes, and chimes)
- **Zero backend!** Fully client-side with persistent state in `localStorage`.

## ⚙️ How the WebMCP Tools Work

The app registers its tools directly with the LLM via `document.modelContext.registerTool`:

We strictly follow the WebMCP specifications:
- **Standard Schema:** Every tool passes a schema using the standard JSON Schema structure (`inputSchema`), including tool descriptions and parameter definitions.
- **Asynchronous Execution:** Tools execute asynchronously and return structured JSON strings.
- **Annotations:** Tools provide metadata hints (such as `readOnlyHint` and `untrustedContentHint`).
- **Graceful Unregistration:** Tool lifecycles are tied to `AbortController.signal` for clean teardown upon navigation or unmount.
- **Fallback Mode:** If run in a standard browser (outside of ChatGPT desktop or WebMCP-enabled environments), tools are exposed globally at `window.__debugTools` for DevTools testing and manual automation.

## 🛡️ Hang-Proof Agent Tools

When an AI agent interacts with web apps (especially inside headless environments, backgrounded tabs, or automated evaluation loops), the browser typically throttles or suspends `requestAnimationFrame` (rAF) and DOM/GSAP animations.

In conventional web implementations, awaiting UI animations causes agent tool calls to hang indefinitely or timeout. Sân Chơi solves this with **hang-proof agent tools**:
- Agent tool invocations are flagged (`isAgent: true`).
- Core game state, rules resolution, and calculations complete immediately and return JSON state directly to the model.
- Visual animations (dice rolling, seed distribution, puppet gestures, win effects) run in the background via fire-and-forget promises (`void animate().catch(...)`).
- This guarantees agents never hang waiting for animations to finish, while human spectators still enjoy smooth, rich visual feedback.

## 🧰 WebMCP Tools Reference (26 Tools Total)

Sân Chơi provides **26 WebMCP tools** across the hub and individual games (4 hub-level + 4 Ô ăn quan + 4 Bầu cua + 9 Múa rối nước + 5 Đánh quay):

### 1. Hub & System Tools (4 tools)
| Tool | Description |
| --- | --- |
| `list_games` | Lists all available folk games in Sân Chơi with player counts, rules, and descriptions. |
| `start_game` | Launches or switches to a game by ID (`o-an-quan`, `bau-cua`, `water-puppet`). |
| `set_music` | Controls background folk music tracks (`dan_bau`, `festive`, `gong`, `silent`). |
| `save_progress` | Saves active game session state and optional progress notes to `localStorage`. |

### 2. Ô ăn quan — Mancala (4 tools)
| Tool | Description | Key Parameters |
| --- | --- | --- |
| `o_an_quan_new_game` | Resets the Ô ăn quan board to the starting 5x2 grid + 2 mandarin pits. | — |
| `o_an_quan_pick_bin` | Scoops seeds from a player's pit and sows them counter-clockwise. | `bin` (0–4 for P1, 6–10 for P2) |
| `o_an_quan_state` | Returns pits, captured seeds, current turn, and victory status. | — |
| `o_an_quan_score` | Returns current captured seed counts and leading player. | — |

### 3. Bầu cua tôm cá — Dice (4 tools)
| Tool | Description | Key Parameters |
| --- | --- | --- |
| `bau_cua_place_bet` | Wagers kid-safe points on one of the 6 folk symbols. | `symbol` (`bau`, `cua`, `tom`, `ca`, `ga`, `huou`), `points` |
| `bau_cua_roll` | Shakes and rolls the 3 dice under the bowl, returning symbols. | — |
| `bau_cua_resolve` | Settles all bets against the roll, updating score and payout history. | — |
| `bau_cua_state` | Returns player points, active bets, last roll, and round number. | — |

### 4. Múa rối nước — Water Puppetry (9 tools)
| Tool | Description | Key Parameters |
| --- | --- | --- |
| `water_puppet_list_tales` | Lists playable traditional tales (*Cóc kiện trời*, *Tấm Cám*, *Rồng cá*). | — |
| `water_puppet_start_show` | Commences a stage performance for a selected tale. | `taleId` (`coc-kien-troi`, `tam-cam`, `rong-ca`) |
| `water_puppet_show_state` | Returns stage status, active puppets, weather, and applause score. | — |
| `water_puppet_spawn_puppet` | Emerges a puppet from the water at specific stage coordinates. | `puppetId`, `name`, `asset` (`teu`, `dragon`, `fish`, `farmer`, emoji), `x` (0–100%) |
| `water_puppet_move_puppet` | Glides a puppet across the water stage. | `puppetId`, `targetX` (0–100%) |
| `water_puppet_puppet_action` | Triggers character movements (`jump`, `dance`, `dive`, `emerge`, `splash`). | `puppetId`, `actionType` (`jump`, `dance`, `dive`, `emerge`, `splash`) |
| `water_puppet_trigger_effect` | Triggers stage pyrotechnics & effects (`splash`, `rain`, `clear`, `fireworks`). | `effectName` |
| `water_puppet_speak` | Displays narrator or puppet spoken dialogue lines to the audience. | `speaker`, `message` |
| `water_puppet_finish_show` | Concludes the performance, calculates rating, and saves score. | — |

### 5. Đánh quay — Spinning Top (5 tools)
| Tool | Description | Key Parameters |
| --- | --- | --- |
| `danh_quay_start` | Spawns a new spinning top with 30 initial energy. | — |
| `danh_quay_whip` | Whip the top to add energy (nhe +5, vua +12, manh +22). | `power` (`nhe`, `vua`, `manh`) |
| `danh_quay_trick` | Perform a trick costing 40 energy for applause points. | `trick` (`nguoi_duc`, `bay_cao`, `qua_gam`) |
| `danh_quay_state` | Read current top state: energy, wobble, tricks landed, and score. | — |
| `danh_quay_finish` | Stop spinning and end the game. Saves final score and record. | — |

## 🚀 How to Run Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Open in browser:**
   Navigate to `http://localhost:5173`.

5. **Test tools via DevTools (Fallback Mode):**
   Open the browser DevTools Console and execute any tool via `window.__debugTools`:
   ```javascript
   // List all games
   __debugTools.list_games();

   // Start Ô ăn quan
   __debugTools.start_game({ game: 'o-an-quan' });

   // Make a move in Ô ăn quan
   __debugTools.o_an_quan_pick_bin({ bin: 0 });

   // Or direct a water puppet show
   __debugTools.start_game({ game: 'water-puppet' });
   __debugTools.water_puppet_spawn_puppet({ puppetId: 't1', name: 'Chú Tễu', asset: 'teu', x: 50 });
   __debugTools.water_puppet_puppet_action({ puppetId: 't1', actionType: 'dance' });
   ```

## 🤡 Funny Hooks & Agent Interactions

The app is built to playfully respond to the agent's decisions in real time:
- **Flustered Game Master ("Người xướng trò bị rối!"):** If an agent executes more than 5 consecutive actions without saving progress (`save_progress`), the game master gets flustered and reminds them to save!
- **Tễu's Critique ("Bước cờ yếu quá, Tễu chê!"):** In Ô ăn quan, if an agent makes a zero-capture move, the pit shakes indignantly as Chú Tễu teases the play.
- **Triple Roll Frenzy ("XỐC! BA CON!"):** Rolling three matching dice in Bầu cua triggers festive screen shake and celebratory toasts.
- **Stage Drama & Applause Meter:** In Múa rối nước, timing dramatic effects (fireworks, storm rain) with puppet actions boosts the audience applause meter toward high score ratings.

## 📜 License

MIT License. See `LICENSE` for details.
