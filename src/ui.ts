import { gsap } from 'gsap';
import { toggleMute, getMuteState, playBGM } from './audio';
import { reducedMotion, setReducedMotion } from './motion';

const CORNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M3 3 h19 a9 9 0 0 1 7 7 v19" stroke-width="3"/><path d="M3 9 h13 a3 3 0 0 1 6 6 v14" stroke-width="1.5"/><circle cx="3" cy="3" r="2.6" fill="currentColor" stroke="none"/></svg>`;

let toastTimeout: number | null = null;
let backBtn: HTMLButtonElement | null = null;
let turnBanner: HTMLDivElement | null = null;
let sheetRoot: HTMLElement | null = null;
let currentTrackSetting = 'dan_bau';
let cornerObserver: MutationObserver | null = null;

function getSheetRoot(): HTMLElement {
  if (!sheetRoot) {
    sheetRoot = document.getElementById('sheet-root') || document.body;
  }
  return sheetRoot;
}

/** Injects the Đông Hồ corner ornament SVG into any un-decorated `.dh-corner`. */
export function decorateCorners(scope?: ParentNode): void {
  const root: ParentNode = scope ?? document;
  const corners = root.querySelectorAll('.dh-corner:not([data-decorated])');
  corners.forEach((el) => {
    el.innerHTML = CORNER_SVG;
    el.setAttribute('data-decorated', 'true');
  });
}

function syncSoundToggles(): void {
  const muted = getMuteState();
  document
    .querySelectorAll<HTMLElement>('[data-sound-toggle]')
    .forEach((btn) => {
      btn.textContent = muted ? '🔇' : '🔊';
    });
}

/** Creates a sound toggle button wired to the shared mute state. */
export function makeSoundToggle(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'icon-btn';
  btn.setAttribute('data-sound-toggle', '');
  btn.title = 'Tắt/Bật âm thanh';
  btn.setAttribute('aria-label', 'Tắt/Bật âm thanh');
  btn.addEventListener('click', () => {
    toggleMute();
    syncSoundToggles();
  });
  syncSoundToggles();
  return btn;
}

/** Creates a settings (gear) button that opens the settings sheet. */
export function makeSettingsButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'icon-btn';
  btn.textContent = '⚙';
  btn.title = 'Cài đặt';
  btn.setAttribute('aria-label', 'Cài đặt');
  btn.addEventListener('click', () => showSettingsSheet());
  return btn;
}

function buildScrim(onClose: () => void): HTMLElement {
  const scrim = document.createElement('div');
  scrim.className = 'sheet-scrim';
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) onClose();
  });
  return scrim;
}

export function closeSheets(): void {
  const root = getSheetRoot();
  root.querySelectorAll('.sheet-scrim').forEach((el) => el.remove());
}

/* ============ SETTINGS SHEET (§3.8) ============ */
export function showSettingsSheet(): void {
  closeSheets();

  const scrim = buildScrim(() => closeSheets());

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <h2>Cài đặt</h2>
    <div class="sheet-sub">Âm thanh, chuyển động và dữ liệu của bạn.</div>
    <div class="sheet-section">
      <div class="sheet-label">Âm nhạc</div>
      <div id="settings-music"></div>
    </div>
    <div class="sheet-section">
      <div class="sheet-label">Hiệu ứng</div>
      <label class="toggle-row">
        <span>Tiếng hiệu ứng</span>
        <input type="checkbox" id="settings-sfx">
      </label>
    </div>
    <div class="sheet-section">
      <div class="sheet-label">Chuyển động</div>
      <label class="toggle-row">
        <span>Giảm chuyển động</span>
        <input type="checkbox" id="settings-motion">
      </label>
    </div>
    <div class="sheet-section">
      <div class="sheet-label">Dữ liệu</div>
      <button class="btn btn-ghost" id="settings-clear" style="width:100%;">🗑 Xóa tiến trình</button>
    </div>
    <div class="sheet-actions">
      <button class="btn" id="settings-done">Xong</button>
    </div>
  `;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'icon-btn sheet-close';
  closeBtn.textContent = '✕';
  closeBtn.title = 'Đóng';
  closeBtn.addEventListener('click', () => closeSheets());
  sheet.appendChild(closeBtn);

  scrim.appendChild(sheet);
  getSheetRoot().appendChild(scrim);

  // Music radio list
  const musicHost = sheet.querySelector('#settings-music')!;
  const tracks: Array<{ id: string; label: string }> = [
    { id: 'dan_bau', label: 'Đàn bầu' },
    { id: 'festive', label: 'Lễ hội' },
    { id: 'gong', label: 'Cồng chiêng' },
    { id: 'silent', label: 'Tắt nhạc' },
  ];
  const radios: HTMLInputElement[] = [];
  for (const t of tracks) {
    const row = document.createElement('label');
    row.className = 'radio-row';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'settings-music-track';
    input.value = t.id;
    input.checked = currentTrackSetting === t.id;
    const span = document.createElement('span');
    span.textContent = t.label;
    row.appendChild(input);
    row.appendChild(span);
    row.addEventListener('click', () => {
      input.checked = true;
      currentTrackSetting = t.id;
      playBGM(t.id);
      updateRadioSelection();
    });
    musicHost.appendChild(row);
    radios.push(input);
  }
  function updateRadioSelection() {
    for (const r of radios) {
      r.closest('.radio-row')?.classList.toggle('selected', r.checked);
    }
  }
  updateRadioSelection();

  // SFX toggle (maps to the shared toggleMute)
  const sfxInput = sheet.querySelector('#settings-sfx') as HTMLInputElement;
  sfxInput.checked = getMuteState();
  sfxInput.addEventListener('change', () => {
    toggleMute();
    syncSoundToggles();
  });

  // Reduced motion toggle
  const motionInput = sheet.querySelector('#settings-motion') as HTMLInputElement;
  motionInput.checked = reducedMotion();
  motionInput.addEventListener('change', () => setReducedMotion(motionInput.checked));

  // Clear progress
  const clearBtn = sheet.querySelector('#settings-clear')!;
  clearBtn.addEventListener('click', () => {
    const ok = window.confirm('Xóa toàn bộ tiến trình chơi? Hành động này không thể hoàn tác.');
    if (!ok) return;
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('san_choi_')) keys.push(key);
      }
      for (const key of keys) localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    closeSheets();
    showToast('Đã xóa tiến trình!');
  });

  sheet.querySelector('#settings-done')!.addEventListener('click', () => closeSheets());

  // Entrance
  if (reducedMotion()) {
    scrim.style.opacity = '0';
    gsap.to(scrim, { opacity: 1, duration: 0.2, ease: 'power2.out' });
  } else {
    gsap.from(sheet, { y: 80, opacity: 0, duration: 0.5, ease: 'power2.out' });
  }
}

/* ============ HOW-TO SHEET (§3.9) ============ */
interface HowToStep { vi: string; en: string; }

const HOW_TO: Record<string, HowToStep[]> = {
  'o-an-quan': [
    { vi: 'Chọn một ô có hạt của bạn.', en: 'Pick one of your non-empty pits.' },
    { vi: 'Rải hạt ngược chiều kim đồng hồ.', en: 'Sow the seeds counter-clockwise, one per pit.' },
    { vi: 'Ăn hạt khi hạt rơi cạnh ô trống.', en: 'Capture seeds when they land next to an empty pit.' },
  ],
  'bau-cua': [
    { vi: 'Đặt điểm cược vào các con vật.', en: 'Bet points on the animal tiles.' },
    { vi: 'Nhấn Lắc để tung 3 con xúc xắc.', en: 'Tap Roll to tumble 3 dice.' },
    { vi: 'Nhận điểm thưởng theo số xúc xắc trùng.', en: 'Win points for each matching die.' },
  ],
};

export function hasSeenHowTo(gameId: string): boolean {
  try {
    return localStorage.getItem(`san_choi_seen_${gameId}`) === 'true';
  } catch {
    return true;
  }
}

export function maybeShowHowTo(gameId: string): void {
  if (hasSeenHowTo(gameId)) return;
  const steps = HOW_TO[gameId];
  if (!steps) return;
  showHowToSheet(gameId, steps);
}

export function showHowToSheet(gameId: string, steps: HowToStep[]): void {
  closeSheets();

  const scrim = buildScrim(() => closeSheets());

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  const stepHtml = steps
    .map(
      (s, i) => `
      <div class="how-step">
        <div class="how-num">${i + 1}</div>
        <div class="how-text">
          <span class="vi">${s.vi}</span>
          <span class="en">${s.en}</span>
        </div>
      </div>`
    )
    .join('');

  sheet.innerHTML = `
    <h2>Cách chơi</h2>
    <div class="sheet-sub">Chỉ vài bước là quen ngay!</div>
    ${stepHtml}
    <div class="sheet-actions">
      <button class="btn" id="how-play">Chơi luôn!</button>
    </div>
  `;
  scrim.appendChild(sheet);
  getSheetRoot().appendChild(scrim);

  sheet.querySelector('#how-play')!.addEventListener('click', () => {
    try {
      localStorage.setItem(`san_choi_seen_${gameId}`, 'true');
    } catch {
      /* ignore */
    }
    closeSheets();
  });

  if (reducedMotion()) {
    scrim.style.opacity = '0';
    gsap.to(scrim, { opacity: 1, duration: 0.2, ease: 'power2.out' });
  } else {
    gsap.from(sheet, { y: 80, opacity: 0, duration: 0.5, ease: 'power2.out' });
  }
}

/* ============ RESULT OVERLAY (§4) ============ */
export interface ResultOptions {
  title: string;
  sub?: string;
  win?: boolean;
  onReplay?: () => void;
  onHome?: () => void;
}

export function showResultOverlay(opts: ResultOptions): void {
  const overlay = document.createElement('div');
  overlay.className = 'result-overlay';

  const card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = `
    <div class="result-title${opts.win ? ' win' : ''}">${opts.title}</div>
    ${opts.sub ? `<div class="result-sub">${opts.sub}</div>` : ''}
    <div class="result-actions">
      ${opts.onReplay ? '<button class="btn" data-action="replay">Chơi lại</button>' : ''}
      ${opts.onHome ? '<button class="btn btn-ghost" data-action="home">Về trang chủ</button>' : ''}
    </div>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  card.querySelector('[data-action="replay"]')?.addEventListener('click', () => {
    overlay.remove();
    opts.onReplay?.();
  });
  card.querySelector('[data-action="home"]')?.addEventListener('click', () => {
    overlay.remove();
    opts.onHome?.();
  });

  if (opts.win) {
    confetti();
  }

  if (reducedMotion()) {
    overlay.style.opacity = '0';
    gsap.to(overlay, { opacity: 1, duration: 0.2, ease: 'power2.out' });
  } else {
    gsap.from(card, { scale: 0.85, y: 24, opacity: 0, duration: 0.5, ease: 'back.out(1.4)' });
  }
}

/* ============ CONFETTI (§4) ============ */
export function confetti(): void {
  if (reducedMotion()) return;
  const colors = ['#C63B2A', '#F0A828', '#3F7D4E', '#FFC94D', '#D94A38'];
  const petals: HTMLElement[] = [];
  for (let i = 0; i < 24; i++) {
    const petal = document.createElement('div');
    petal.className = 'confetti-petal';
    petal.style.left = Math.random() * 100 + 'vw';
    petal.style.background = colors[Math.floor(Math.random() * colors.length)];
    document.body.appendChild(petal);
    petals.push(petal);
  }
  gsap.to(petals, {
    y: window.innerHeight + 40,
    rotation: () => Math.random() * 360 - 180,
    x: () => (Math.random() - 0.5) * 160,
    duration: 1.2,
    ease: 'power1.in',
    stagger: 0.05,
    onComplete: () => {
      for (const p of petals) p.remove();
    },
  });
}

/* ============ CHROME ============ */
export function setupUI(): void {
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.setAttribute('data-sound-toggle', '');
    muteBtn.addEventListener('click', () => {
      toggleMute();
      syncSoundToggles();
    });
  }

  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => showSettingsSheet());
  }

  const showNameEl = document.getElementById('show-name');
  if (showNameEl) {
    showNameEl.textContent = '';
  }

  syncSoundToggles();
  decorateCorners();
  setWebMCPStatusVisible(false);

  // Auto-decorate Đông Hồ corners whenever new ones appear in the DOM.
  if (!cornerObserver) {
    cornerObserver = new MutationObserver(() => decorateCorners());
    cornerObserver.observe(document.body, { childList: true, subtree: true });
  }
}

let lastWebMCPStatus: 'online' | 'offline' = 'offline';
let lastWebMCPText = 'Fallback';

export function getWebMCPStatus(): { status: 'online' | 'offline'; text: string } {
  return { status: lastWebMCPStatus, text: lastWebMCPText };
}

export function updateWebMCPStatus(status: 'online' | 'offline', text: string = ''): void {
  lastWebMCPStatus = status;
  lastWebMCPText = text || (status === 'online' ? 'Online' : 'Fallback');

  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  if (dot) {
    dot.className = `status-dot ${status === 'online' ? '' : 'offline'}`;
  }
  if (txt) {
    txt.textContent = `WebMCP: ${lastWebMCPText}`;
  }

  // Hub footer pill (data-role) mirrors the same state.
  const pills = document.querySelectorAll<HTMLElement>('[data-role="webmcp-pill"]');
  pills.forEach((pill) => {
    const dotEl = pill.querySelector('.status-dot');
    const txtEl = pill.querySelector('.pill-text');
    if (dotEl) dotEl.className = `status-dot ${status === 'online' ? '' : 'offline'}`;
    if (txtEl) txtEl.textContent = `WebMCP: ${lastWebMCPText}`;
  });
}

export function setWebMCPStatusVisible(visible: boolean): void {
  const el = document.getElementById('webmcp-status');
  if (el) el.style.display = visible ? 'flex' : 'none';
}

export function updateGameName(name: string): void {
  const el = document.getElementById('show-name');
  if (el) {
    el.textContent = name;
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
  backBtn.style.display = 'flex';
  backBtn.onclick = () => {
    onClick();
  };

  topControls.classList.add('visible');
}

export function hideBackButton(): void {
  if (backBtn) {
    backBtn.style.display = 'none';
  } else {
    const el = document.getElementById('back-btn');
    if (el) el.style.display = 'none';
  }
}

export function hideTopBar(): void {
  const topControls = document.getElementById('top-controls');
  if (topControls) topControls.classList.remove('visible');
}

export function showTurnBanner(text: string): void {
  if (!turnBanner) {
    turnBanner = document.getElementById('turn-banner') as HTMLDivElement | null;
  }

  if (!turnBanner) {
    turnBanner = document.createElement('div');
    turnBanner.id = 'turn-banner';
    turnBanner.className = 'turn-banner';
    document.body.appendChild(turnBanner);
  }

  turnBanner.innerHTML = '<span class="turn-dot"></span>' + text;
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
