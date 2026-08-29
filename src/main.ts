import { initWebMCP, cleanupWebMCP } from './webmcp';
import { renderHub, loadLedger } from './hub';
import { initAudio, playBGM } from './audio';
import { setupUI, updateWebMCPStatus } from './ui';

async function initApp() {
  loadLedger();

  setupUI();

  const gate = document.getElementById('gate')!;
  const gateBtn = document.getElementById('gate-btn')!;
  gateBtn.addEventListener('click', async () => {
    gate.classList.add('hidden');
    await initAudio();
    playBGM('dan_bau');
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
    updateWebMCPStatus(detail === 'online' ? 'online' : 'offline', detail === 'online' ? 'Online' : 'Fallback (__debugTools)');
  }) as EventListener);
}

initApp();

