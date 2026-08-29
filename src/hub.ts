import type { GameDef } from './types';
import { games } from './games';

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

export function renderHub(container: HTMLElement): void {
  hubContainer = container;
  loadLedger();
  container.innerHTML = '';

  if (!document.getElementById('hub-style')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'hub-style';
    styleEl.textContent = `
      .hub-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
        width: 100%;
        max-width: 960px;
        margin: 0 auto;
        padding: 24px;
        box-sizing: border-box;
        position: relative;
        z-index: 10;
      }
      .game-card {
        background: var(--overlay-bg, rgba(10, 10, 18, 0.85));
        border: 2px solid var(--folk-gold, #FFD54F);
        border-radius: 16px;
        padding: 24px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        color: var(--text-primary, #FFFDE7);
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
        transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        cursor: pointer;
        position: relative;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      .game-card:hover {
        transform: translateY(-6px);
        box-shadow: 0 10px 32px rgba(255, 213, 79, 0.35);
        border-color: #FFFDE7;
      }
      .hub-badge {
        position: absolute;
        top: 12px;
        right: 12px;
        background: var(--folk-red, #C62828);
        color: #FFF;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 12px;
        border: 1px solid var(--folk-gold, #FFD54F);
      }
      .hub-emoji {
        font-size: 3.5rem;
        margin-bottom: 8px;
        line-height: 1;
      }
      .hub-name {
        font-size: 1.35rem;
        font-weight: 800;
        color: var(--folk-gold, #FFD54F);
        margin-bottom: 2px;
      }
      .hub-name-en {
        font-size: 0.85rem;
        color: var(--text-secondary, #B8E8F0);
        margin-bottom: 8px;
      }
      .hub-meta {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--folk-gold, #FFD54F);
        background: rgba(255, 213, 79, 0.15);
        padding: 3px 10px;
        border-radius: 8px;
        margin-bottom: 12px;
      }
      .hub-desc {
        font-size: 0.85rem;
        line-height: 1.45;
        color: var(--text-primary, #FFFDE7);
        margin-bottom: 18px;
        flex: 1;
      }
      .hub-play {
        padding: 10px 24px;
        font-size: 0.95rem;
        font-weight: 700;
        font-family: inherit;
        color: var(--text-primary, #FFFDE7);
        background: var(--btn-primary, #C62828);
        border: 2px solid var(--folk-gold, #FFD54F);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 14px rgba(198, 40, 40, 0.4);
      }
      .hub-play:hover {
        background: var(--btn-hover, #E53935);
        transform: scale(1.04);
      }
    `;
    document.head.appendChild(styleEl);
  }

  const gridEl = document.createElement('div');
  gridEl.id = 'hub-grid';
  gridEl.className = 'hub-grid';

  for (const g of games) {
    const cardEl = document.createElement('div');
    cardEl.className = 'game-card';
    cardEl.setAttribute('data-game-id', g.id);

    const playedCount = hubState.gamesPlayedLedger[g.id] || 0;
    const badgeHtml = playedCount > 0 ? `<div class="hub-badge">Played ${playedCount}</div>` : '';

    cardEl.innerHTML = `
      ${badgeHtml}
      <div class="hub-emoji">${g.emoji}</div>
      <div class="hub-name">${g.name}</div>
      <div class="hub-name-en">${g.nameEn}</div>
      <div class="hub-meta">${g.minPlayers}-${g.maxPlayers} players</div>
      <div class="hub-desc">${g.description}</div>
      <button class="hub-play">Chơi / Play</button>
    `.trim();

    cardEl.addEventListener('click', () => {
      startGame(g.id);
    });

    gridEl.appendChild(cardEl);
  }

  container.appendChild(gridEl);
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
