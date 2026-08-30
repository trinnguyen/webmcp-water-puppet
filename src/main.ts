import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';

import { initWebMCP, cleanupWebMCP } from './webmcp';
import { renderHub, loadLedger } from './hub';
import { initAudio, playBGM, playSFX } from './audio';
import { setupUI, updateWebMCPStatus, decorateCorners } from './ui';
import { reducedMotion } from './motion';

function renderPennants(): void {
  const host = document.getElementById('gate-pennants');
  if (!host) return;
  const colors = ['#C63B2A', '#F0A828', '#3F7D4E', '#C63B2A', '#F0A828', '#3F7D4E'];
  host.innerHTML = '';
  for (const color of colors) {
    const flag = document.createElement('span');
    flag.style.cssText =
      `width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-top:22px solid ${color};display:inline-block;`;
    host.appendChild(flag);
  }
}

function isReturningUser(): boolean {
  try {
    return localStorage.getItem('san_choi_ledger') !== null;
  } catch {
    return false;
  }
}

async function initApp() {
  renderPennants();
  decorateCorners();
  loadLedger();
  setupUI();

  if (reducedMotion()) {
    document.body.classList.add('reduce-motion');
  }

  const gate = document.getElementById('gate')!;
  const gateBtn = document.getElementById('gate-btn')!;
  const subtitle = document.getElementById('gate-subtitle')!;

  if (isReturningUser()) {
    subtitle.textContent = 'Chào mừng trở lại!';
  }

  gateBtn.addEventListener('click', async () => {
    gate.classList.add('hidden');
    await initAudio();
    playBGM('dan_bau');
    playSFX('splash');
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      renderHub(gameContainer);
    }
  });

  await initWebMCP();

  window.addEventListener('beforeunload', () => {
    cleanupWebMCP();
  });

  window.addEventListener('webmcp-status-change', ((e: CustomEvent) => {
    const detail = e.detail;
    updateWebMCPStatus(
      detail === 'online' ? 'online' : 'offline',
      detail === 'online' ? 'Online' : 'Fallback'
    );
  }) as EventListener);
}

initApp();
