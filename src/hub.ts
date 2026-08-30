import type { GameDef } from './types';
import { games } from './games';
import {
  makeSoundToggle,
  makeSettingsButton,
  showBackButton,
  hideBackButton,
  hideTopBar,
  updateGameName,
  maybeShowHowTo,
  hideTurnBanner,
  closeSheets,
  getWebMCPStatus,
} from './ui';

export interface HubState {
  currentGameId: string | null;
  gamesPlayedLedger: Record<string, number>;
}

export const hubState: HubState = {
  currentGameId: null,
  gamesPlayedLedger: {},
};

let hubContainer: HTMLElement | null = null;

export function loadLedger(): void {
  try {
    const raw = localStorage.getItem('san_choi_ledger');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        hubState.gamesPlayedLedger = parsed;
        return;
      }
    }
  } catch (e) {
    console.warn('Failed to load san_choi_ledger:', e);
  }
  hubState.gamesPlayedLedger = {};
}

export function saveLedger(): void {
  try {
    localStorage.setItem(
      'san_choi_ledger',
      JSON.stringify(Object.assign({}, hubState.gamesPlayedLedger))
    );
  } catch (e) {
    console.warn('Failed to save san_choi_ledger:', e);
  }
}

export function getHubState(): HubState {
  return hubState;
}

function injectHubStyle(): void {
  if (document.getElementById('hub-style')) return;
  const styleEl = document.createElement('style');
  styleEl.id = 'hub-style';
  styleEl.textContent = `
    .hub-root {
      display: flex;
      flex-direction: column;
      min-height: 100%;
      padding-bottom: env(safe-area-inset-bottom);
      box-sizing: border-box;
    }
    .hub-header {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      padding-top: calc(12px + env(safe-area-inset-top));
      background: var(--paper);
      background-image: var(--speckle);
      border-bottom: 2px solid var(--wood);
    }
    .hub-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.3rem;
      color: var(--lacquer);
      line-height: 1.2;
    }
    .hub-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .hub-greeting {
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 1.2rem;
      color: var(--ink);
      text-align: center;
      padding: 20px 16px 4px;
      line-height: 1.3;
    }
    .hub-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      width: 100%;
      max-width: 1040px;
      margin: 0 auto;
      padding: 20px 16px 32px;
      box-sizing: border-box;
    }
    @media (min-width: 600px) {
      .hub-grid { grid-template-columns: repeat(2, 1fr); gap: 24px; }
    }
    @media (min-width: 1024px) {
      .hub-grid { grid-template-columns: repeat(3, 1fr); }
    }
    .game-card {
      position: relative;
      background: var(--paper-bright);
      border: 2px solid var(--wood);
      border-radius: var(--r-card);
      padding: 18px 16px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      color: var(--ink);
      box-shadow: var(--shadow-paper);
      cursor: pointer;
      transition: transform var(--dur-std) ease, box-shadow var(--dur-std) ease;
    }
    .game-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-float);
    }
    .game-card:active {
      transform: translateY(-1px);
    }
    .hub-illustration {
      width: 100%;
      aspect-ratio: 4 / 3;
      border-radius: var(--r-btn);
      background: var(--paper-deep);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3.4rem;
      margin-bottom: 14px;
      border: 2px solid var(--paper-deep);
    }
    .hub-name {
      font-family: var(--font-display);
      font-size: 1.375rem;
      font-weight: 800;
      color: var(--ink);
      line-height: 1.25;
    }
    .hub-name-en {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--ink-soft);
      margin-bottom: 10px;
      line-height: 1.3;
    }
    .hub-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .hub-chip {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--ink);
      background: var(--paper-deep);
      border: 2px solid var(--wood);
      padding: 2px 10px;
      border-radius: var(--r-pill);
      line-height: 1.4;
    }
    .hub-stamp {
      position: absolute;
      top: 12px;
      right: 10px;
      transform: rotate(10deg);
      background: var(--lacquer);
      color: #FFF8EC;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 0.7rem;
      padding: 3px 10px;
      border: 2px dashed rgba(255,248,236,0.7);
      border-radius: 6px;
      box-shadow: var(--shadow-toy);
      z-index: 2;
    }
    .hub-ribbon {
      position: absolute;
      top: 14px;
      left: -30px;
      transform: rotate(-35deg);
      background: var(--marigold);
      color: var(--ink);
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 0.7rem;
      padding: 3px 30px;
      box-shadow: var(--shadow-toy);
      z-index: 2;
    }
    .hub-play {
      width: 100%;
      padding: 11px 16px;
      font-size: 1.05rem;
      font-weight: 800;
      font-family: var(--font-display);
      color: #FFF8EC;
      background: var(--lacquer);
      border: 2px solid var(--lacquer-deep);
      border-radius: var(--r-btn);
      cursor: pointer;
      box-shadow: var(--shadow-toy);
      transition: transform var(--dur-micro) ease, background var(--dur-micro) ease, box-shadow var(--dur-micro) ease;
    }
    .hub-play:hover { background: var(--lacquer-bright); }
    .hub-play:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--wood-deep); }
    .hub-footer {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 20px 16px 24px;
      border-top: 2px solid var(--wood);
      background: var(--paper);
      background-image: var(--speckle);
    }
    .hub-webmcp {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--ink-soft);
      background: var(--paper-bright);
      border: 2px solid var(--wood);
      padding: 4px 12px;
      border-radius: var(--r-pill);
      line-height: 1.4;
    }
    .hub-credit {
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--ink-soft);
    }
  `;
  document.head.appendChild(styleEl);
}

export function renderHub(container: HTMLElement): void {
  hubContainer = container;
  loadLedger();
  container.innerHTML = '';

  hideBackButton();
  hideTopBar();
  hideTurnBanner();
  closeSheets();
  document.querySelectorAll('.result-overlay').forEach((el) => el.remove());

  injectHubStyle();

  const rootEl = document.createElement('div');
  rootEl.className = 'hub-root';

  // Header bar
  const header = document.createElement('header');
  header.className = 'hub-header';

  const logo = document.createElement('div');
  logo.className = 'hub-logo';
  logo.innerHTML = '🏮 <span>Sân Chơi</span>';

  const actions = document.createElement('div');
  actions.className = 'hub-header-actions';
  actions.appendChild(makeSoundToggle());
  actions.appendChild(makeSettingsButton());

  header.appendChild(logo);
  header.appendChild(actions);
  rootEl.appendChild(header);

  // Greeting
  const greeting = document.createElement('div');
  greeting.className = 'hub-greeting';
  greeting.innerHTML = 'Chọn một trò chơi dân gian nhé! <span aria-hidden="true">🎭</span>';
  rootEl.appendChild(greeting);

  // Grid
  const gridEl = document.createElement('div');
  gridEl.className = 'hub-grid';

  for (const g of games) {
    gridEl.appendChild(buildCard(g));
  }

  rootEl.appendChild(gridEl);

  // Footer
  const footer = document.createElement('footer');
  footer.className = 'hub-footer';
  const status = getWebMCPStatus();
  const pill = document.createElement('div');
  pill.className = 'hub-webmcp';
  pill.setAttribute('data-role', 'webmcp-pill');
  pill.innerHTML = `<span class="status-dot ${status.status === 'online' ? '' : 'offline'}"></span><span class="pill-text">WebMCP: ${status.text}</span>`;
  const credit = document.createElement('div');
  credit.className = 'hub-credit';
  credit.textContent = 'Made in Việt Nam ❤️';
  footer.appendChild(pill);
  footer.appendChild(credit);
  rootEl.appendChild(footer);

  container.appendChild(rootEl);
}

function buildCard(g: GameDef): HTMLElement {
  const cardEl = document.createElement('div');
  cardEl.className = 'game-card';
  cardEl.setAttribute('data-game-id', g.id);

  const playedCount = hubState.gamesPlayedLedger[g.id] || 0;
  const comingSoon = g.id === 'water-puppet';
  const stampHtml =
    playedCount > 0 ? `<div class="hub-stamp">Đã chơi ×${playedCount}</div>` : '';
  const ribbonHtml = comingSoon ? `<div class="hub-ribbon">Sắp ra mắt</div>` : '';

  cardEl.innerHTML = `
    ${stampHtml}
    ${ribbonHtml}
    <div class="hub-illustration">${g.emoji}</div>
    <div class="hub-name">${g.name}</div>
    <div class="hub-name-en">${g.nameEn}</div>
    <div class="hub-meta">
      <span class="hub-chip">${g.minPlayers}-${g.maxPlayers} người</span>
    </div>
    <button class="hub-play">Chơi ngay →</button>
  `.trim();

  cardEl.addEventListener('click', () => {
    startGame(g.id);
  });

  return cardEl;
}

export function startGame(gameId: string): string {
  const game = games.find((g: GameDef) => g.id === gameId);
  if (!game) {
    return JSON.stringify({ status: 'error', message: 'Unknown game: ' + gameId });
  }

  hubState.currentGameId = gameId;
  window.dispatchEvent(new CustomEvent('game-start', { detail: { gameId } }));

  const container = hubContainer || document.getElementById('game-container');
  if (container) {
    container.innerHTML = '';
    game.buildScene(container);
  }

  window.dispatchEvent(new CustomEvent('hub-hidden'));

  updateGameName(game.name);
  showBackButton(() => returnToHub());
  hideTurnBanner();
  maybeShowHowTo(gameId);

  return JSON.stringify({ status: 'ok', game: gameId });
}

export function markGameCompleted(gameId: string): void {
  hubState.gamesPlayedLedger[gameId] = (hubState.gamesPlayedLedger[gameId] || 0) + 1;
  saveLedger();
}

export function returnToHub(): void {
  if (hubState.currentGameId) {
    const currentGame = games.find((g: GameDef) => g.id === hubState.currentGameId);
    if (currentGame && typeof currentGame.destroyScene === 'function') {
      currentGame.destroyScene();
    }
  }
  hubState.currentGameId = null;
  window.dispatchEvent(new CustomEvent('hub-shown'));

  const container = hubContainer || document.getElementById('game-container');
  if (container) {
    container.innerHTML = '';
    renderHub(container);
  }
}
