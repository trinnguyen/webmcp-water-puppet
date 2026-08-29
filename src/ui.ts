import { toggleMute, getMuteState } from './audio';

let toastTimeout: number | null = null;
let backBtn: HTMLButtonElement | null = null;
let turnBanner: HTMLDivElement | null = null;

export function setupUI(): void {
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.textContent = getMuteState() ? '🔇' : '🔊';
    muteBtn.addEventListener('click', () => {
      const isMuted = toggleMute();
      muteBtn.textContent = isMuted ? '🔇' : '🔊';
    });
  }

  const showNameEl = document.getElementById('show-name');
  if (showNameEl) {
    showNameEl.textContent = '🎮 Chọn trò chơi';
  }
}

export function updateWebMCPStatus(status: 'online' | 'offline', text: string = ''): void {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  if (dot) {
    dot.className = `status-dot ${status === 'online' ? '' : 'offline'}`;
  }
  if (txt) {
    txt.textContent = `WebMCP: ${text || (status === 'online' ? 'Online' : 'Offline')}`;
  }
}

export function updateGameName(name: string): void {
  const el = document.getElementById('show-name');
  if (el) {
    el.textContent = `🎮 ${name}`;
  }
}

export function showToast(message: string, duration: number = 2500): void {
  const popup = document.getElementById('teu-popup');
  if (!popup) {
    console.warn('[ui] toast', message);
    return;
  }

  const speech = popup.querySelector('.teu-speech');
  if (speech) {
    speech.textContent = message;
  }

  if (toastTimeout !== null) {
    window.clearTimeout(toastTimeout);
  }

  popup.classList.add('show');
  toastTimeout = window.setTimeout(() => {
    popup.classList.remove('show');
    toastTimeout = null;
  }, duration);
}

export function showBackButton(onClick: () => void): void {
  const topControls = document.getElementById('top-controls');
  if (!topControls) return;

  if (!backBtn) {
    backBtn = document.getElementById('back-btn') as HTMLButtonElement | null;
  }

  if (!backBtn) {
    backBtn = document.createElement('button');
    backBtn.className = 'icon-btn';
    backBtn.id = 'back-btn';
    backBtn.textContent = '←';
    topControls.prepend(backBtn);
  }

  backBtn.onclick = () => {
    onClick();
  };
}

export function hideBackButton(): void {
  if (backBtn) {
    backBtn.remove();
    backBtn = null;
  } else {
    const el = document.getElementById('back-btn');
    if (el) el.remove();
  }
}

export function showTurnBanner(text: string): void {
  if (!turnBanner) {
    turnBanner = document.getElementById('turn-banner') as HTMLDivElement | null;
  }

  if (!turnBanner) {
    turnBanner = document.createElement('div');
    turnBanner.id = 'turn-banner';
    turnBanner.style.position = 'fixed';
    turnBanner.style.top = '60px';
    turnBanner.style.left = '50%';
    turnBanner.style.transform = 'translateX(-50%)';
    turnBanner.style.background = 'rgba(10, 10, 18, 0.85)';
    turnBanner.style.color = '#FFD54F';
    turnBanner.style.padding = '8px 16px';
    turnBanner.style.borderRadius = '10px';
    turnBanner.style.zIndex = '60';
    turnBanner.style.fontWeight = '600';
    turnBanner.style.fontSize = '0.9rem';
    turnBanner.style.pointerEvents = 'none';
    turnBanner.style.backdropFilter = 'blur(8px)';
    document.body.appendChild(turnBanner);
  }

  turnBanner.textContent = text;
}

export function hideTurnBanner(): void {
  if (turnBanner) {
    turnBanner.remove();
    turnBanner = null;
  } else {
    const el = document.getElementById('turn-banner');
    if (el) el.remove();
  }
}
