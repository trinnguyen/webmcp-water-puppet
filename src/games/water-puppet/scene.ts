import { gsap } from 'gsap';
import {
  ShowState,
  TALES,
  getTaleById,
  createInitialState,
  startShow,
  spawnPuppet,
  movePuppet,
  setPuppetAction,
  triggerEffect,
  boostApplause,
  finishShow,
  getShowRating,
  ShowRating,
} from './rules';
import { playSFX } from '../../audio';
import { reducedMotion } from '../../motion';
import { getWebMCPStatus } from '../../ui';

export interface WaterPuppetSaveData {
  highestApplause: Record<string, number>;
}

let state: ShowState = createInitialState();
let rootEl: HTMLElement | null = null;
let gsapCtx: gsap.Context | null = null;
let rippleTimer: number | null = null;
let speechTimer: number | null = null;
let selectedPuppetId: string | null = null;

const TEU_LINES = [
  'Đạo diễn ơi, rối tay em mỏi rồi!',
  'Cảnh này đẹp quá, đúng không nào?',
  'Khán giả vỗ tay thật to lên nhé!',
  'Bớ bà con, xem tích hay chuyện lạ đây!',
  'Nước xanh thăm thẳm, rồng múa cá bơi!',
];

function loadSaveData(): WaterPuppetSaveData {
  try {
    const raw = localStorage.getItem('san_choi_water_puppet');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.highestApplause &&
        typeof parsed.highestApplause === 'object'
      ) {
        return parsed as WaterPuppetSaveData;
      }
    }
  } catch {
    // Ignore parse error
  }
  return { highestApplause: {} };
}

function saveScore(
  taleId: string,
  score: number
): { bestScore: number; isNewRecord: boolean } {
  const data = loadSaveData();
  const currentBest = data.highestApplause[taleId] ?? 0;
  const isNewRecord = score > currentBest;
  const bestScore = Math.max(currentBest, score);
  data.highestApplause[taleId] = bestScore;
  try {
    localStorage.setItem('san_choi_water_puppet', JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
  return { bestScore, isNewRecord };
}

export function getShowState(): ShowState {
  return state;
}

function addRipple(): void {
  if (!rootEl || reducedMotion()) return;
  const water = rootEl.querySelector('.wp-water');
  if (!water) return;
  const ripple = document.createElement('div');
  ripple.className = 'wp-ripple';
  ripple.style.left = Math.random() * 80 + 10 + '%';
  ripple.style.top = Math.random() * 40 + 20 + '%';
  ripple.style.width = ripple.style.height = 18 + Math.random() * 14 + 'px';
  water.appendChild(ripple);
  window.setTimeout(() => ripple.remove(), 4000);
}

function triggerSplashVisual(xPercent: number): void {
  if (!rootEl || reducedMotion()) return;
  const water = rootEl.querySelector('.wp-water');
  if (!water) return;

  for (let i = 0; i < 6; i++) {
    const drop = document.createElement('div');
    drop.className = 'wp-splash-drop';
    drop.style.left = xPercent + '%';
    drop.style.top = '30%';
    water.appendChild(drop);

    const angle = (Math.PI / 6) * (i + 1);
    const distance = 25 + Math.random() * 35;
    const dx = Math.cos(angle) * distance * (i % 2 === 0 ? 1 : -1);
    const dy = -Math.sin(angle) * distance - 15;

    gsap.to(drop, {
      x: dx,
      y: dy,
      opacity: 0,
      scale: 0.5,
      duration: 0.6,
      ease: 'power2.out',
      onComplete: () => drop.remove(),
    });
  }
}

function triggerFireworksVisual(): void {
  if (!rootEl || reducedMotion()) return;
  const sky = rootEl.querySelector('.wp-sky');
  if (!sky) return;

  const colors = ['#FFD54F', '#FF5722', '#E91E63', '#4CAF50', '#00E5FF'];
  const originX = 20 + Math.random() * 60;
  const originY = 20 + Math.random() * 40;

  for (let i = 0; i < 16; i++) {
    const spark = document.createElement('div');
    spark.className = 'wp-spark';
    spark.style.left = originX + '%';
    spark.style.top = originY + '%';
    spark.style.backgroundColor = colors[i % colors.length];
    sky.appendChild(spark);

    const angle = (Math.PI * 2 * i) / 16;
    const distance = 40 + Math.random() * 40;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;

    gsap.to(spark, {
      x: dx,
      y: dy,
      opacity: 0,
      scale: 0.3,
      duration: 0.8 + Math.random() * 0.4,
      ease: 'power2.out',
      onComplete: () => spark.remove(),
    });
  }
}

function animatePuppetActionVisual(puppetId: string, actionType: string): void {
  if (!rootEl) return;
  const puppetEl = rootEl.querySelector(`[data-puppet-id="${puppetId}"]`) as HTMLElement;
  if (!puppetEl) return;

  if (reducedMotion()) {
    return;
  }

  const clean = actionType.toLowerCase().trim();
  if (clean === 'jump' || clean === 'splash') {
    gsap.fromTo(
      puppetEl,
      { y: 0 },
      {
        y: -45,
        duration: 0.35,
        yoyo: true,
        repeat: 1,
        ease: 'power1.out',
        clearProps: 'y',
      }
    );
  } else if (clean === 'dance' || clean === 'dragon-dance') {
    gsap.fromTo(
      puppetEl,
      { rotation: -12, y: 0 },
      {
        rotation: 12,
        y: -15,
        duration: 0.16,
        yoyo: true,
        repeat: 5,
        ease: 'power1.inOut',
        clearProps: 'rotation,y',
      }
    );
  } else if (clean === 'dive' || clean === 'hide') {
    gsap.to(puppetEl, {
      y: 45,
      opacity: 0.25,
      duration: 0.4,
      ease: 'power2.in',
    });
  } else if (clean === 'emerge' || clean === 'show') {
    gsap.fromTo(
      puppetEl,
      { y: 45, opacity: 0.25 },
      {
        y: 0,
        opacity: 1,
        duration: 0.45,
        ease: 'back.out(1.5)',
        clearProps: 'y,opacity',
      }
    );
  }
}

export function driveStartShow(taleId: string, _isAgent: boolean = false): ShowState {
  state = startShow(taleId);
  selectedPuppetId = null;
  playSFX('splash');

  // Auto spawn first puppet of tale if human starting
  const tale = getTaleById(taleId);
  if (tale && tale.cast.length > 0) {
    const first = tale.cast[0];
    state = spawnPuppet(state, first.id, first.name, first.asset, first.defaultX);
    selectedPuppetId = first.id;
  }

  renderWP(state);
  return state;
}

export function driveSpawnPuppet(
  input: { puppetId: string; name: string; asset: string; x: number },
  isAgent: boolean = false
): ShowState {
  state = spawnPuppet(state, input.puppetId, input.name, input.asset, input.x);
  selectedPuppetId = input.puppetId;
  playSFX('splash');

  if (isAgent) {
    void (async () => {
      triggerSplashVisual(input.x);
      animatePuppetActionVisual(input.puppetId, 'emerge');
    })().catch(() => {});
  } else {
    triggerSplashVisual(input.x);
    animatePuppetActionVisual(input.puppetId, 'emerge');
  }

  renderWP(state);
  return state;
}

export function driveMovePuppet(
  puppetId: string,
  targetX: number,
  isAgent: boolean = false
): ShowState {
  state = movePuppet(state, puppetId, targetX);
  selectedPuppetId = puppetId;
  playSFX('coin');

  renderWP(state);

  if (rootEl && !reducedMotion()) {
    const puppetEl = rootEl.querySelector(`[data-puppet-id="${puppetId}"]`) as HTMLElement;
    if (puppetEl) {
      if (isAgent) {
        void (async () => {
          gsap.to(puppetEl, { left: `${state.puppets[puppetId]?.x ?? targetX}%`, duration: 0.4 });
        })().catch(() => {});
      } else {
        gsap.to(puppetEl, { left: `${state.puppets[puppetId]?.x ?? targetX}%`, duration: 0.4 });
      }
    }
  }

  return state;
}

export function drivePuppetAction(
  puppetId: string,
  actionType: string,
  isAgent: boolean = false
): ShowState {
  state = setPuppetAction(state, puppetId, actionType);
  selectedPuppetId = puppetId;

  const clean = actionType.toLowerCase().trim();
  if (clean === 'dance' || clean === 'dragon-dance') {
    playSFX('dice_roll');
  } else if (clean === 'jump' || clean === 'splash' || clean === 'dive' || clean === 'emerge') {
    playSFX('splash');
  } else {
    playSFX('coin');
  }

  const p = state.puppets[puppetId];
  if (p && (clean === 'jump' || clean === 'splash')) {
    triggerSplashVisual(p.x);
  }

  if (isAgent) {
    void (async () => {
      animatePuppetActionVisual(puppetId, actionType);
    })().catch(() => {});
  } else {
    animatePuppetActionVisual(puppetId, actionType);
  }

  renderWP(state);
  return state;
}

export function driveTriggerEffect(effectName: string, isAgent: boolean = false): ShowState {
  state = triggerEffect(state, effectName);
  const clean = effectName.toLowerCase().trim();

  if (clean === 'fireworks') {
    playSFX('win_chime');
    if (isAgent) {
      void (async () => triggerFireworksVisual())().catch(() => {});
    } else {
      triggerFireworksVisual();
    }
  } else if (clean === 'rain') {
    playSFX('splash');
  } else if (clean === 'splash') {
    playSFX('splash');
    const x = selectedPuppetId && state.puppets[selectedPuppetId]
      ? state.puppets[selectedPuppetId].x
      : 50;
    if (isAgent) {
      void (async () => triggerSplashVisual(x))().catch(() => {});
    } else {
      triggerSplashVisual(x);
    }
  } else {
    playSFX('dice_roll');
  }

  renderWP(state);
  return state;
}

export function driveSpeak(
  speaker: string,
  message: string,
  isAgent: boolean = false
): ShowState {
  state = boostApplause(state, 4);

  const cleanSpeaker = speaker.toLowerCase();
  if (cleanSpeaker.includes('tễu') || cleanSpeaker.includes('teu')) {
    playSFX('sneeze');
  } else {
    playSFX('coin');
  }

  if (isAgent) {
    void (async () => showSpeechBubble(speaker, message))().catch(() => {});
  } else {
    showSpeechBubble(speaker, message);
  }

  renderWP(state);
  return state;
}

export function driveFinishShow(isAgent: boolean = false): {
  state: ShowState;
  rating: ShowRating;
  bestScore: number;
  isNewRecord: boolean;
} {
  state = finishShow(state);
  const rating = getShowRating(state.applause);
  const taleId = state.currentTale || 'unknown';
  const { bestScore, isNewRecord } = saveScore(taleId, state.applause);

  playSFX('win_chime');

  import('../../hub')
    .then((h) => h.markGameCompleted('water-puppet'))
    .catch(() => {});

  if (isAgent) {
    void (async () => triggerFireworksVisual())().catch(() => {});
  } else {
    triggerFireworksVisual();
  }

  renderWP(state);
  return { state, rating, bestScore, isNewRecord };
}

function showSpeechBubble(speaker: string, message: string): void {
  if (!rootEl) return;
  let bubble = rootEl.querySelector('.wp-speech-bubble') as HTMLElement;
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.className = 'wp-speech-bubble';
    rootEl.appendChild(bubble);
  }

  bubble.innerHTML = `
    <div class="wp-speech-speaker">🗣️ ${speaker}</div>
    <div class="wp-speech-msg">"${message}"</div>
  `;
  bubble.style.display = 'block';

  // Position above selected puppet or stage center
  let leftPercent = 50;
  if (selectedPuppetId && state.puppets[selectedPuppetId]) {
    leftPercent = state.puppets[selectedPuppetId].x;
  }
  bubble.style.left = `clamp(18%, ${leftPercent}%, 82%)`;

  if (!reducedMotion()) {
    gsap.fromTo(
      bubble,
      { y: 15, opacity: 0, scale: 0.8 },
      { y: 0, opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(1.7)' }
    );
  }

  if (speechTimer !== null) {
    window.clearTimeout(speechTimer);
  }
  speechTimer = window.setTimeout(() => {
    if (bubble && !reducedMotion()) {
      gsap.to(bubble, {
        opacity: 0,
        y: -10,
        duration: 0.3,
        onComplete: () => {
          bubble.style.display = 'none';
        },
      });
    } else if (bubble) {
      bubble.style.display = 'none';
    }
  }, 4000);
}

export function buildWaterPuppetScene(container: HTMLElement): void {
  destroyWaterPuppetScene();

  rootEl = document.createElement('div');
  rootEl.className = 'wp-root';

  const styleEl = document.createElement('style');
  styleEl.id = 'wp-style';
  styleEl.textContent = `
    .wp-root {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 520px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: var(--font-body);
      user-select: none;
      background: var(--paper);
    }
    .wp-hud {
      position: absolute;
      top: calc(8px + env(safe-area-inset-top));
      left: 12px;
      right: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      z-index: 10;
      pointer-events: none;
    }
    .wp-hud > * { pointer-events: auto; }
    .wp-tale-badge {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 0.85rem;
      background: rgba(255, 248, 236, 0.95);
      color: var(--lacquer-deep);
      padding: 4px 12px;
      border-radius: var(--r-pill);
      border: 2px solid var(--wood);
      box-shadow: var(--shadow-toy);
      max-width: 180px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .wp-applause-container {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 248, 236, 0.95);
      border: 2px solid var(--wood);
      padding: 4px 12px;
      border-radius: var(--r-pill);
      box-shadow: var(--shadow-toy);
    }
    .wp-applause-label {
      font-size: 0.85rem;
      font-weight: 800;
      font-family: var(--font-display);
      color: var(--ink);
    }
    .wp-applause-track {
      width: 90px;
      height: 10px;
      background: var(--paper-deep);
      border: 1px solid var(--wood);
      border-radius: var(--r-pill);
      overflow: hidden;
    }
    .wp-applause-fill {
      height: 100%;
      background: linear-gradient(90deg, #F0A828 0%, #E53935 100%);
      width: 0%;
      transition: width 0.3s ease;
      border-radius: var(--r-pill);
    }
    .wp-applause-val {
      font-size: 0.75rem;
      font-weight: 800;
      color: var(--lacquer-deep);
      min-width: 28px;
      text-align: right;
    }
    .wp-agent {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--ink);
      background: rgba(255, 248, 236, 0.95);
      border: 2px solid var(--wood);
      padding: 4px 10px;
      border-radius: var(--r-pill);
      box-shadow: var(--shadow-toy);
    }
    .wp-agent .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--leaf);
    }
    .wp-agent .status-dot.offline { background: var(--marigold); }
    .wp-sky {
      flex: 1;
      background: linear-gradient(180deg,
        #3a2b4e 0%, #6b3a6e 30%, #c0524e 55%, #e8854a 75%, #f4b860 100%);
      position: relative;
      overflow: hidden;
    }
    .wp-water {
      position: relative;
      height: 48%;
      background: linear-gradient(180deg, var(--pond) 0%, var(--pond-deep) 100%);
      overflow: hidden;
      border-top: 2px solid rgba(255, 255, 255, 0.2);
    }
    .wp-water::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(90deg,
        transparent 0%, rgba(255,255,255,0.08) 25%, transparent 50%);
      background-size: 200% 100%;
      animation: wp-shimmer 6s linear infinite;
      pointer-events: none;
    }
    @keyframes wp-shimmer {
      from { background-position: 200% 0; }
      to { background-position: -200% 0; }
    }
    .wp-ripple {
      position: absolute;
      border-radius: 50%;
      border: 1.5px solid rgba(255,255,255,0.6);
      opacity: 0;
      animation: wp-ripple-expand 4s ease-out forwards;
      pointer-events: none;
    }
    @keyframes wp-ripple-expand {
      0% { transform: scale(0); opacity: 0.6; }
      100% { transform: scale(8); opacity: 0; }
    }
    .wp-splash-drop {
      position: absolute;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #E0F7FA;
      pointer-events: none;
      z-index: 15;
    }
    .wp-spark {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 15;
      box-shadow: 0 0 6px rgba(255,255,255,0.8);
    }
    .wp-lantern {
      position: absolute;
      top: 14%;
      font-size: 1.8rem;
      animation: wp-sway 3s ease-in-out infinite alternate;
      transform-origin: top center;
      pointer-events: none;
    }
    @keyframes wp-sway {
      from { transform: rotate(-3deg); }
      to { transform: rotate(3deg); }
    }
    .wp-rain {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        105deg,
        rgba(255,255,255,0.15) 0,
        rgba(255,255,255,0.15) 1px,
        transparent 2px,
        transparent 28px
      );
      animation: wp-rain-fall 0.4s linear infinite;
      z-index: 4;
      display: none;
    }
    .wp-rain.active { display: block; }
    @keyframes wp-rain-fall {
      0% { background-position: 0 0; }
      100% { background-position: -20px 100px; }
    }
    .wp-stage {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .wp-puppet {
      position: absolute;
      bottom: 24%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 76px;
      cursor: pointer;
      pointer-events: auto;
      transition: filter 0.2s ease, transform 0.2s ease;
      animation: wp-bob 2.5s ease-in-out infinite alternate;
      z-index: 8;
    }
    @keyframes wp-bob {
      from { transform: translateX(-50%) translateY(0); }
      to { transform: translateX(-50%) translateY(-7px); }
    }
    .wp-puppet.selected {
      filter: drop-shadow(0 0 8px #FFD54F);
    }
    .wp-puppet.selected .wp-name {
      background: var(--marigold);
      color: var(--ink);
      font-weight: 800;
    }
    .wp-puppet img {
      width: 60px;
      height: 60px;
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));
      pointer-events: none;
    }
    .wp-puppet-emoji {
      font-size: 3.2rem;
      line-height: 1;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));
      pointer-events: none;
    }
    .wp-stick {
      width: 4px;
      height: 38px;
      background: linear-gradient(180deg, var(--wood), var(--wood-deep));
      border-radius: 1px;
      pointer-events: none;
    }
    .wp-name {
      font-size: 0.65rem;
      font-weight: 700;
      color: #fff;
      background: rgba(0, 0, 0, 0.6);
      padding: 1px 6px;
      border-radius: 6px;
      margin-top: 2px;
      white-space: nowrap;
      pointer-events: none;
    }
    .wp-speech-bubble {
      position: absolute;
      top: 52px;
      transform: translateX(-50%);
      background: #FFF8EC;
      border: 2px solid var(--wood);
      border-radius: 14px;
      padding: 8px 14px;
      box-shadow: var(--shadow-toy);
      z-index: 25;
      max-width: 280px;
      display: none;
      pointer-events: none;
    }
    .wp-speech-bubble::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      border-width: 8px 8px 0;
      border-style: solid;
      border-color: #FFF8EC transparent;
      display: block;
      width: 0;
    }
    .wp-speech-speaker {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 0.72rem;
      color: var(--lacquer);
      margin-bottom: 2px;
    }
    .wp-speech-msg {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--ink);
      line-height: 1.25;
    }
    .wp-dock {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(255, 248, 236, 0.96);
      border-top: 2px solid var(--wood);
      box-shadow: 0 -4px 12px rgba(0,0,0,0.12);
      padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
      z-index: 12;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .wp-dock-row {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 2px;
    }
    .wp-dock-row::-webkit-scrollbar { display: none; }
    .wp-dock-label {
      font-size: 0.7rem;
      font-weight: 800;
      font-family: var(--font-display);
      color: var(--ink-soft);
      white-space: nowrap;
      min-width: 58px;
    }
    .wp-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--paper-bright);
      color: var(--ink);
      border: 1.5px solid var(--wood);
      border-radius: var(--r-btn);
      padding: 5px 10px;
      font-family: var(--font-display);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: transform var(--dur-micro) ease, background var(--dur-micro) ease;
    }
    .wp-btn:hover { background: var(--paper-deep); }
    .wp-btn:active { transform: translateY(2px); }
    .wp-btn.active {
      background: var(--marigold);
      border-color: var(--wood-deep);
    }
    .wp-btn.primary {
      background: var(--lacquer);
      color: #FFF8EC;
      border-color: var(--lacquer-deep);
    }
    .wp-btn.primary:hover { background: var(--lacquer-bright); }
    .wp-overlay {
      position: absolute;
      inset: 0;
      background: rgba(30, 20, 15, 0.75);
      backdrop-filter: blur(3px);
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
    }
    .wp-card {
      background: var(--paper-bright);
      border: 2px solid var(--wood);
      border-radius: var(--r-card);
      box-shadow: var(--shadow-paper);
      padding: 20px;
      width: 100%;
      max-width: 440px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 12px;
    }
    .wp-card-title {
      font-family: var(--font-display);
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--lacquer);
    }
    .wp-tales-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      width: 100%;
    }
    .wp-tale-item {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--paper);
      border: 1.5px solid var(--wood);
      border-radius: var(--r-btn);
      padding: 10px 14px;
      cursor: pointer;
      text-align: left;
      transition: transform var(--dur-micro) ease, background var(--dur-micro) ease;
    }
    .wp-tale-item:hover {
      background: var(--paper-deep);
      transform: translateY(-2px);
    }
    .wp-tale-icon { font-size: 1.8rem; }
    .wp-tale-meta { flex: 1; }
    .wp-tale-name {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 0.95rem;
      color: var(--ink);
    }
    .wp-tale-synopsis {
      font-size: 0.75rem;
      color: var(--ink-soft);
      line-height: 1.25;
    }
    .wp-result-stars {
      font-size: 2.2rem;
      letter-spacing: 4px;
    }
    .wp-result-score {
      font-family: var(--font-display);
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--ink);
    }
    .wp-result-record {
      font-size: 0.85rem;
      color: var(--ink-soft);
      font-weight: 600;
    }
    @media (prefers-reduced-motion: reduce) {
      .wp-water::after, .wp-lantern, .wp-puppet, .wp-rain { animation: none !important; }
    }
  `;
  rootEl.appendChild(styleEl);

  // HUD
  const hud = document.createElement('div');
  hud.className = 'wp-hud';

  const taleBadge = document.createElement('div');
  taleBadge.className = 'wp-tale-badge';
  taleBadge.textContent = '🎭 Vở kịch';
  hud.appendChild(taleBadge);

  const applauseBox = document.createElement('div');
  applauseBox.className = 'wp-applause-container';
  applauseBox.innerHTML = `
    <span class="wp-applause-label">👏</span>
    <div class="wp-applause-track"><div class="wp-applause-fill"></div></div>
    <span class="wp-applause-val">0</span>
  `;
  hud.appendChild(applauseBox);

  const agentPill = document.createElement('div');
  agentPill.className = 'wp-agent';
  agentPill.setAttribute('data-role', 'webmcp-pill');
  const agentStatus = getWebMCPStatus();
  agentPill.innerHTML = `<span class="status-dot ${agentStatus.status === 'online' ? '' : 'offline'}"></span><span class="pill-text">WebMCP: ${agentStatus.text}</span>`;
  hud.appendChild(agentPill);

  rootEl.appendChild(hud);

  // Sky
  const sky = document.createElement('div');
  sky.className = 'wp-sky';

  const rain = document.createElement('div');
  rain.className = 'wp-rain';
  sky.appendChild(rain);

  const lantern1 = document.createElement('div');
  lantern1.className = 'wp-lantern';
  lantern1.style.left = '8%';
  lantern1.textContent = '🏮';
  sky.appendChild(lantern1);

  const lantern2 = document.createElement('div');
  lantern2.className = 'wp-lantern';
  lantern2.style.right = '10%';
  lantern2.style.animationDelay = '1.2s';
  lantern2.textContent = '🏮';
  sky.appendChild(lantern2);

  rootEl.appendChild(sky);

  // Water
  const water = document.createElement('div');
  water.className = 'wp-water';

  const stage = document.createElement('div');
  stage.className = 'wp-stage';
  water.appendChild(stage);
  rootEl.appendChild(water);

  // Dock
  const dock = document.createElement('div');
  dock.className = 'wp-dock';
  rootEl.appendChild(dock);

  gsapCtx = gsap.context(() => {}, rootEl);
  container.appendChild(rootEl);

  if (!reducedMotion()) {
    rippleTimer = window.setInterval(addRipple, 900);
  }

  // Initial render
  renderWP(state);
}

function renderWP(s: ShowState): void {
  if (!rootEl) return;

  // 1. Update HUD
  const taleBadge = rootEl.querySelector('.wp-tale-badge');
  if (taleBadge) {
    if (s.currentTale) {
      const tale = getTaleById(s.currentTale);
      taleBadge.textContent = tale ? `🎭 ${tale.title}` : '🎭 Đang diễn';
    } else {
      taleBadge.textContent = '🎭 Chọn vở kịch';
    }
  }

  const fillEl = rootEl.querySelector('.wp-applause-fill') as HTMLElement;
  const valEl = rootEl.querySelector('.wp-applause-val');
  if (fillEl && valEl) {
    fillEl.style.width = `${s.applause}%`;
    valEl.textContent = `${s.applause}`;
  }

  // 2. Weather
  const rainEl = rootEl.querySelector('.wp-rain');
  if (rainEl) {
    rainEl.classList.toggle('active', s.weather === 'rain');
  }

  // 3. Stage Puppets
  const stage = rootEl.querySelector('.wp-stage');
  if (stage) {
    const existingIds = new Set(Object.keys(s.puppets));

    // Remove puppets no longer in state
    stage.querySelectorAll('.wp-puppet').forEach((el) => {
      const pid = el.getAttribute('data-puppet-id');
      if (pid && !existingIds.has(pid)) {
        el.remove();
      }
    });

    // Add or update puppets
    for (const p of Object.values(s.puppets)) {
      let puppetEl = stage.querySelector(`[data-puppet-id="${p.id}"]`) as HTMLElement;
      if (!puppetEl) {
        puppetEl = document.createElement('div');
        puppetEl.className = 'wp-puppet';
        puppetEl.setAttribute('data-puppet-id', p.id);

        if (p.assetType === 'svg') {
          const img = document.createElement('img');
          img.src = `assets/puppets/${p.assetId}.svg`;
          img.alt = p.name;
          img.draggable = false;
          puppetEl.appendChild(img);
        } else {
          const emoji = document.createElement('div');
          emoji.className = 'wp-puppet-emoji';
          emoji.textContent = p.assetId;
          puppetEl.appendChild(emoji);
        }

        const stick = document.createElement('div');
        stick.className = 'wp-stick';
        puppetEl.appendChild(stick);

        const name = document.createElement('div');
        name.className = 'wp-name';
        name.textContent = p.name;
        puppetEl.appendChild(name);

        puppetEl.addEventListener('click', () => {
          selectedPuppetId = p.id;
          drivePuppetAction(p.id, 'jump');
        });

        stage.appendChild(puppetEl);
      }

      puppetEl.style.left = `${p.x}%`;
      puppetEl.classList.toggle('selected', p.id === selectedPuppetId);
      if (!p.visible) {
        puppetEl.style.opacity = '0.2';
      } else {
        puppetEl.style.opacity = '1';
      }
    }
  }

  // 4. Overlays & Dock
  // Remove existing overlays
  rootEl.querySelectorAll('.wp-overlay').forEach((el) => el.remove());

  const dock = rootEl.querySelector('.wp-dock') as HTMLElement;

  if (s.status === 'idle') {
    if (dock) dock.style.display = 'none';
    renderTaleSelectionModal();
  } else if (s.status === 'finished') {
    if (dock) dock.style.display = 'none';
    renderResultOverlay();
  } else {
    if (dock) {
      dock.style.display = 'flex';
      renderDockControls(dock);
    }
  }
}

function renderTaleSelectionModal(): void {
  if (!rootEl) return;
  const overlay = document.createElement('div');
  overlay.className = 'wp-overlay';

  const card = document.createElement('div');
  card.className = 'wp-card';
  card.innerHTML = `
    <div class="wp-card-title">🎭 Múa Rối Nước Dân Gian</div>
    <div style="font-size:0.85rem; color:var(--ink-soft); margin-bottom:4px;">
      Chọn một tích trò kinh điển để mở màn đêm diễn bên hồ nước:
    </div>
    <div class="wp-tales-grid"></div>
  `;

  const grid = card.querySelector('.wp-tales-grid')!;
  const icons: Record<string, string> = {
    'coc-kien-troi': '🐸',
    'tam-cam': '🌸',
    'rong-ca': '🐉',
  };

  for (const tale of TALES) {
    const item = document.createElement('div');
    item.className = 'wp-tale-item';
    item.innerHTML = `
      <div class="wp-tale-icon">${icons[tale.id] || '🎭'}</div>
      <div class="wp-tale-meta">
        <div class="wp-tale-name">${tale.title}</div>
        <div class="wp-tale-synopsis">${tale.synopsis}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      driveStartShow(tale.id);
    });
    grid.appendChild(item);
  }

  overlay.appendChild(card);
  rootEl.appendChild(overlay);
}

function renderResultOverlay(): void {
  if (!rootEl) return;
  const overlay = document.createElement('div');
  overlay.className = 'wp-overlay';

  const taleId = state.currentTale || '';
  const saveData = loadSaveData();
  const best = saveData.highestApplause[taleId] ?? state.applause;
  const rating = getShowRating(state.applause);

  const card = document.createElement('div');
  card.className = 'wp-card';
  card.innerHTML = `
    <div class="wp-card-title">🎉 HẠ MÀN THÀNH CÔNG 🎉</div>
    <div class="wp-result-stars">${rating.badge}</div>
    <div class="wp-result-score">${rating.labelVi}</div>
    <div style="font-size:1.1rem; font-weight:800; color:var(--lacquer); margin:4px 0;">
      Điểm vỗ tay: ${state.applause} / 100
    </div>
    <div class="wp-result-record">🏆 Kỷ lục vở này: ${best} điểm</div>
    <div style="display:flex; gap:10px; width:100%; margin-top:8px;">
      <button class="wp-btn primary" id="wp-replay" style="flex:1; justify-content:center; padding:10px;">
        Diễn lại vở này 🔄
      </button>
      <button class="wp-btn" id="wp-pick-other" style="flex:1; justify-content:center; padding:10px;">
        Chọn vở khác 📜
      </button>
    </div>
  `;

  card.querySelector('#wp-replay')?.addEventListener('click', () => {
    if (taleId) driveStartShow(taleId);
    else driveStartShow('rong-ca');
  });

  card.querySelector('#wp-pick-other')?.addEventListener('click', () => {
    state = createInitialState();
    renderWP(state);
  });

  overlay.appendChild(card);
  rootEl.appendChild(overlay);
}

function renderDockControls(dock: HTMLElement): void {
  dock.innerHTML = '';
  const currentTale = state.currentTale ? getTaleById(state.currentTale) : null;

  // Row 1: Cast
  const castRow = document.createElement('div');
  castRow.className = 'wp-dock-row';
  castRow.innerHTML = `<span class="wp-dock-label">Nhân vật:</span>`;

  if (currentTale) {
    for (const c of currentTale.cast) {
      const isSpawned = !!state.puppets[c.id];
      const isSelected = selectedPuppetId === c.id;

      const btn = document.createElement('button');
      btn.className = `wp-btn ${isSelected ? 'active' : ''}`;
      btn.innerHTML = `${c.asset.length <= 2 ? c.asset : '🎭'} ${c.name} ${isSpawned ? '✓' : '+'}`;
      btn.title = `${c.role} (Vị trí mặc định: ${c.defaultX}%)`;
      btn.addEventListener('click', () => {
        if (!isSpawned) {
          driveSpawnPuppet({ puppetId: c.id, name: c.name, asset: c.asset, x: c.defaultX });
        } else {
          selectedPuppetId = c.id;
          drivePuppetAction(c.id, 'jump');
        }
      });
      castRow.appendChild(btn);
    }
  }
  dock.appendChild(castRow);

  // Row 2: Puppet Actions
  const activePuppet = selectedPuppetId ? state.puppets[selectedPuppetId] : null;
  const actionRow = document.createElement('div');
  actionRow.className = 'wp-dock-row';
  actionRow.innerHTML = `<span class="wp-dock-label">${activePuppet ? activePuppet.name : 'Động tác'}:</span>`;

  const jumpBtn = document.createElement('button');
  jumpBtn.className = 'wp-btn';
  jumpBtn.textContent = '🌊 Nhảy nước';
  jumpBtn.addEventListener('click', () => {
    if (selectedPuppetId) drivePuppetAction(selectedPuppetId, 'jump');
  });
  actionRow.appendChild(jumpBtn);

  const danceBtn = document.createElement('button');
  danceBtn.className = 'wp-btn';
  danceBtn.textContent = '💃 Múa rối';
  danceBtn.addEventListener('click', () => {
    if (selectedPuppetId) drivePuppetAction(selectedPuppetId, 'dance');
  });
  actionRow.appendChild(danceBtn);

  const diveBtn = document.createElement('button');
  diveBtn.className = 'wp-btn';
  diveBtn.textContent = activePuppet && !activePuppet.visible ? '🏊 Nổi lên' : '🏊 Lặn xuống';
  diveBtn.addEventListener('click', () => {
    if (selectedPuppetId) {
      const isHidden = activePuppet && !activePuppet.visible;
      drivePuppetAction(selectedPuppetId, isHidden ? 'emerge' : 'dive');
    }
  });
  actionRow.appendChild(diveBtn);

  const leftBtn = document.createElement('button');
  leftBtn.className = 'wp-btn';
  leftBtn.textContent = '⬅️ Sang trái';
  leftBtn.addEventListener('click', () => {
    if (selectedPuppetId && activePuppet) {
      driveMovePuppet(selectedPuppetId, activePuppet.x - 12);
    }
  });
  actionRow.appendChild(leftBtn);

  const rightBtn = document.createElement('button');
  rightBtn.className = 'wp-btn';
  rightBtn.textContent = '➡️ Sang phải';
  rightBtn.addEventListener('click', () => {
    if (selectedPuppetId && activePuppet) {
      driveMovePuppet(selectedPuppetId, activePuppet.x + 12);
    }
  });
  actionRow.appendChild(rightBtn);

  dock.appendChild(actionRow);

  // Row 3: Stage Effects & Finish
  const fxRow = document.createElement('div');
  fxRow.className = 'wp-dock-row';
  fxRow.innerHTML = `<span class="wp-dock-label">Hiệu ứng:</span>`;

  const splashBtn = document.createElement('button');
  splashBtn.className = 'wp-btn';
  splashBtn.textContent = '💦 Té nước';
  splashBtn.addEventListener('click', () => driveTriggerEffect('splash'));
  fxRow.appendChild(splashBtn);

  const rainBtn = document.createElement('button');
  rainBtn.className = `wp-btn ${state.weather === 'rain' ? 'active' : ''}`;
  rainBtn.textContent = state.weather === 'rain' ? '☀️ Tạnh mưa' : '🌧️ Làm mưa';
  rainBtn.addEventListener('click', () =>
    driveTriggerEffect(state.weather === 'rain' ? 'clear' : 'rain')
  );
  fxRow.appendChild(rainBtn);

  const fireBtn = document.createElement('button');
  fireBtn.className = 'wp-btn';
  fireBtn.textContent = '🎆 Pháo hoa';
  fireBtn.addEventListener('click', () => driveTriggerEffect('fireworks'));
  fxRow.appendChild(fireBtn);

  const teuBtn = document.createElement('button');
  teuBtn.className = 'wp-btn';
  teuBtn.textContent = '🗣️ Xướng trò';
  teuBtn.addEventListener('click', () => {
    const line = TEU_LINES[Math.floor(Math.random() * TEU_LINES.length)];
    driveSpeak('Chú Tễu', line);
  });
  fxRow.appendChild(teuBtn);

  const finishBtn = document.createElement('button');
  finishBtn.className = 'wp-btn primary';
  finishBtn.style.marginLeft = 'auto';
  finishBtn.textContent = '🏁 Hạ màn';
  finishBtn.addEventListener('click', () => driveFinishShow());
  fxRow.appendChild(finishBtn);

  dock.appendChild(fxRow);
}

export function destroyWaterPuppetScene(): void {
  if (rippleTimer !== null) {
    window.clearInterval(rippleTimer);
    rippleTimer = null;
  }
  if (speechTimer !== null) {
    window.clearTimeout(speechTimer);
    speechTimer = null;
  }
  if (gsapCtx) {
    gsapCtx.revert();
    gsapCtx = null;
  }
  if (rootEl) {
    const styleEl = document.getElementById('wp-style');
    if (styleEl) styleEl.remove();
    rootEl.remove();
    rootEl = null;
  }
  state = createInitialState();
  selectedPuppetId = null;
}
