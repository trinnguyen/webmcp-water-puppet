import { loadShows, loadShowByName, state } from './state';
import { toggleMute, getMuteState, initAudio, playBGM } from './audio';

export function setupUI(onEnterStage: () => void, onPlaySavedShow: () => void) {
  const gate = document.getElementById('gate')!;
  const gateBtn = document.getElementById('gate-btn')!;
  const muteBtn = document.getElementById('mute-btn')!;
  const drawerTab = document.getElementById('drawer-tab')!;
  const drawer = document.getElementById('saved-drawer')!;
  const showsList = document.getElementById('shows-list')!;
  
  // Set initial mute button state
  muteBtn.textContent = getMuteState() ? '🔇' : '🔊';

  gateBtn.addEventListener('click', async () => {
    gate.classList.add('hidden');
    await initAudio();
    if (state.activeShow.music !== 'silent') {
      playBGM(state.activeShow.music || 'bgm');
    }
    onEnterStage();
  });

  muteBtn.addEventListener('click', () => {
    const isMuted = toggleMute();
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
  });

  let drawerOpen = false;
  drawerTab.addEventListener('click', () => {
    drawerOpen = !drawerOpen;
    drawer.classList.toggle('open', drawerOpen);
    if (drawerOpen) {
      drawerTab.style.bottom = '160px';
      renderSavedShows(showsList, () => {
        drawerOpen = false;
        drawer.classList.remove('open');
        drawerTab.style.bottom = '0';
        onPlaySavedShow();
      });
    } else {
      drawerTab.style.bottom = '0';
    }
  });
}

function renderSavedShows(container: HTMLElement, onSelect: () => void) {
  loadShows();
  container.innerHTML = '';
  
  const shows = Object.keys(state.savedShows);
  if (shows.length === 0) {
    container.innerHTML = '<p style="font-size: 0.8rem; color: #888;">Chưa có vở diễn nào được lưu.</p>';
    return;
  }

  shows.forEach(name => {
    const show = state.savedShows[name];
    const card = document.createElement('div');
    card.className = 'show-card';
    card.innerHTML = `
      <div class="card-title">${show.name}</div>
      <div class="card-meta">${show.cast.length} puppets · ${show.moves.length} moves</div>
      <div class="card-puppets">${show.cast.map(p => getPuppetEmoji(p.character)).join('')}</div>
    `;
    card.addEventListener('click', () => {
      loadShowByName(name);
      updateShowName(name);
      onSelect();
    });
    container.appendChild(card);
  });
}

function getPuppetEmoji(char: string) {
  switch (char) {
    case 'teu': return '🎭';
    case 'dragon': return '🐉';
    case 'farmer': return '👨‍🌾';
    case 'fish': return '🐟';
    default: return '❓';
  }
}

export function updateShowName(name: string) {
  const showNameEl = document.getElementById('show-name');
  if (showNameEl) {
    showNameEl.textContent = `🎬 ${name}`;
  }
}

export function updateWebMCPStatus(status: 'online' | 'offline', text: string = '') {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  if (dot && txt) {
    dot.className = `status-dot ${status}`;
    txt.textContent = `WebMCP: ${text || (status === 'online' ? 'Online' : 'Offline')}`;
  }
}
