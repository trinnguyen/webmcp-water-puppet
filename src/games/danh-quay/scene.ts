import { gsap } from 'gsap';
import {
  Power,
  Trick,
  DanhQuayState,
  createInitialState,
  start,
  whip,
  performTrick,
  finish,
} from './rules';
import { playSFX } from '../../audio';
import { reducedMotion } from '../../motion';
import { getWebMCPStatus, showToast } from '../../ui';

export interface DanhQuaySaveData {
  longestSpinRecord: number;
  totalTricks: number;
}

const STORAGE_KEY = 'san_choi_danh_quay';

function loadSaveData(): DanhQuaySaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          longestSpinRecord: typeof parsed.longestSpinRecord === 'number' ? parsed.longestSpinRecord : 0,
          totalTricks: typeof parsed.totalTricks === 'number' ? parsed.totalTricks : 0,
        };
      }
    }
  } catch {
    /* ignore storage error */
  }
  return { longestSpinRecord: 0, totalTricks: 0 };
}

function saveState(s: DanhQuayState): void {
  const data = loadSaveData();
  data.longestSpinRecord = Math.max(data.longestSpinRecord, s.longestSpinRecord, s.score);
  data.totalTricks = Math.max(data.totalTricks, s.tricksLanded);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
}

let state: DanhQuayState = createInitialState(loadSaveData().longestSpinRecord);
let rootEl: HTMLElement | null = null;
let gsapCtx: gsap.Context | null = null;
let spinTween: gsap.core.Tween | null = null;

function safeGsapTo(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
  return gsapCtx ? gsapCtx.add(() => gsap.to(target, vars)) : gsap.to(target, vars);
}

function safeGsapFromTo(
  target: gsap.TweenTarget,
  fromVars: gsap.TweenVars,
  toVars: gsap.TweenVars
): gsap.core.Tween {
  return gsapCtx ? gsapCtx.add(() => gsap.fromTo(target, fromVars, toVars)) : gsap.fromTo(target, fromVars, toVars);
}

export function getDanhQuayState(): DanhQuayState {
  return state;
}

/* ================== DRIVE FUNCTIONS ================== */

export function driveStart(isAgent = false): DanhQuayState {
  state = start(state);
  saveState(state);
  playSFX('coin');

  if (isAgent) {
    void (async () => {
      animateStartVisual();
    })().catch(() => {});
  } else {
    animateStartVisual();
  }

  renderScene(state);
  return state;
}

export function driveWhip(
  power: Power,
  isAgent = false
): { state: DanhQuayState; wobblePenalty: boolean; flewOff: boolean; message: string } {
  const result = whip(state, power);
  state = result.nextState;
  saveState(state);

  if (isAgent) {
    void (async () => {
      animateWhipVisual(power, result.wobblePenalty, result.flewOff);
    })().catch(() => {});
  } else {
    animateWhipVisual(power, result.wobblePenalty, result.flewOff);
  }

  renderScene(state);
  return {
    state,
    wobblePenalty: result.wobblePenalty,
    flewOff: result.flewOff,
    message: result.message,
  };
}

export function driveTrick(
  trick: Trick,
  isAgent = false
): {
  state: DanhQuayState;
  trickSuccess: boolean;
  dizzy: boolean;
  fallen: boolean;
  message: string;
} {
  const result = performTrick(state, trick);
  state = result.nextState;
  saveState(state);

  if (isAgent) {
    void (async () => {
      animateTrickVisual(trick, result.trickSuccess, result.dizzy, result.fallen);
    })().catch(() => {});
  } else {
    animateTrickVisual(trick, result.trickSuccess, result.dizzy, result.fallen);
  }

  renderScene(state);
  return {
    state,
    trickSuccess: result.trickSuccess,
    dizzy: result.dizzy,
    fallen: result.fallen,
    message: result.message,
  };
}

export function driveFinish(isAgent = false): {
  state: DanhQuayState;
  finalScore: number;
  longestSpinRecord: number;
  message: string;
} {
  const result = finish(state);
  state = result.nextState;
  saveState(state);

  if (isAgent) {
    void (async () => {
      animateFinishVisual();
    })().catch(() => {});
  } else {
    animateFinishVisual();
  }

  renderScene(state);
  return {
    state,
    finalScore: result.finalScore,
    longestSpinRecord: result.longestSpinRecord,
    message: result.message,
  };
}

/* ================== VISUAL ANIMATIONS ================== */

function screenShake(): void {
  if (!rootEl || reducedMotion()) return;
  safeGsapTo(rootEl, {
    x: () => (Math.random() - 0.5) * 16,
    y: () => (Math.random() - 0.5) * 16,
    duration: 0.05,
    repeat: 8,
    yoyo: true,
    ease: 'none',
    onComplete: () => {
      if (rootEl) {
        rootEl.style.transform = 'none';
      }
    },
  });
}

function updateSpinSpeed(energy: number, status: string): void {
  if (!rootEl) return;
  const topSpinner = rootEl.querySelector('.dq-top-spinner') as HTMLElement;
  if (!topSpinner) return;

  if (reducedMotion()) {
    if (spinTween) {
      spinTween.pause();
    }
    return;
  }

  if (!spinTween) {
    spinTween = safeGsapTo(topSpinner, {
      rotation: 360,
      repeat: -1,
      duration: 1,
      ease: 'none',
    });
  }

  if (status === 'spinning' && energy > 0) {
    spinTween.play();
    const targetScale = Math.max(0.5, (energy / 100) * 4.5);
    spinTween.timeScale(targetScale);
  } else {
    spinTween.timeScale(0);
    spinTween.pause();
  }
}

function animateStartVisual(): void {
  if (!rootEl) return;
  const topWrapper = rootEl.querySelector('.dq-top-wrapper') as HTMLElement;
  const topShadow = rootEl.querySelector('.dq-top-shadow') as HTMLElement;
  const dizzyFace = rootEl.querySelector('.dq-dizzy-face') as HTMLElement;
  if (dizzyFace) dizzyFace.style.display = 'none';

  if (reducedMotion()) {
    if (topWrapper) {
      gsap.set(topWrapper, { x: 0, y: 0, rotationZ: 0, scale: 1, opacity: 1 });
    }
    if (topShadow) {
      gsap.set(topShadow, { scale: 1, opacity: 0.4 });
    }
    return;
  }

  if (topWrapper) {
    safeGsapFromTo(
      topWrapper,
      { y: -140, scale: 0.6, rotationZ: -20, opacity: 0 },
      { y: 0, scale: 1, rotationZ: 0, opacity: 1, duration: 0.5, ease: 'bounce.out' }
    );
  }
  if (topShadow) {
    safeGsapFromTo(
      topShadow,
      { scale: 0.2, opacity: 0.1 },
      { scale: 1, opacity: 0.4, duration: 0.5, ease: 'bounce.out' }
    );
  }
}

function animateWhipVisual(power: Power, wobblePenalty: boolean, flewOff: boolean): void {
  if (!rootEl) return;
  const topWrapper = rootEl.querySelector('.dq-top-wrapper') as HTMLElement;
  const whipEl = rootEl.querySelector('.dq-whip-anim') as HTMLElement;
  const sparkEl = rootEl.querySelector('.dq-spark') as HTMLElement;

  const whipScale = power === 'manh' ? 1.35 : power === 'vua' ? 1.0 : 0.75;

  if (reducedMotion()) {
    if (flewOff) {
      playSFX('splash');
      if (topWrapper) gsap.set(topWrapper, { opacity: 0 });
      showToast('VĂNG MẤT RỒI! Con quay bay thẳng lên lồng đèn sân đình! 🏮💥');
    } else if (wobblePenalty) {
      playSFX('sneeze');
      showToast('Úi chao! Quất quá mạnh làm quay loạng choạng! 😵');
    } else {
      playSFX('capture');
    }
    return;
  }

  playSFX('capture');

  // Whip slash
  if (whipEl) {
    safeGsapFromTo(
      whipEl,
      { opacity: 1, scaleX: 0.4 * whipScale, scaleY: 0.6 * whipScale, rotation: -40, x: -70, y: 40 },
      {
        opacity: 0,
        scaleX: 1.2 * whipScale,
        scaleY: whipScale,
        rotation: 25,
        x: 30,
        y: -20,
        duration: power === 'manh' ? 0.14 : 0.18,
        ease: 'power3.in',
      }
    );
  }

  // Spark flash
  if (sparkEl) {
    safeGsapFromTo(
      sparkEl,
      { opacity: 1, scale: 0.3 },
      { opacity: 0, scale: 1.5, duration: 0.2, ease: 'power2.out' }
    );
  }

  if (flewOff) {
    playSFX('splash');
    if (topWrapper) {
      safeGsapTo(topWrapper, {
        x: 800,
        y: -450,
        rotation: 720,
        scale: 0.2,
        duration: 0.65,
        ease: 'power2.out',
        onComplete: () => {
          screenShake();
          showToast('VĂNG MẤT RỒI! Con quay bay thẳng lên lồng đèn sân đình! 🏮💥');
        },
      });
    }
  } else if (wobblePenalty) {
    playSFX('sneeze');
    if (topWrapper) {
      safeGsapTo(topWrapper, {
        rotationZ: 18,
        x: 10,
        duration: 0.08,
        repeat: 7,
        yoyo: true,
        ease: 'sine.inOut',
        onComplete: () => {
          showToast('Úi chao! Quất quá mạnh làm quay loạng choạng! 😵');
        },
      });
    }
  } else {
    // Normal strike pulse
    if (topWrapper) {
      safeGsapTo(topWrapper, {
        scale: 1.1,
        yoyo: true,
        repeat: 1,
        duration: 0.08,
        ease: 'power1.out',
      });
    }
  }
}

function animateTrickVisual(
  trick: Trick,
  trickSuccess: boolean,
  dizzy: boolean,
  fallen: boolean
): void {
  if (!rootEl) return;
  const topWrapper = rootEl.querySelector('.dq-top-wrapper') as HTMLElement;
  const topShadow = rootEl.querySelector('.dq-top-shadow') as HTMLElement;
  const dizzyFace = rootEl.querySelector('.dq-dizzy-face') as HTMLElement;

  if (reducedMotion()) {
    if (fallen) {
      playSFX('sneeze');
      if (topWrapper) gsap.set(topWrapper, { rotationZ: 90, y: 30 });
      showToast('Hụt hơi rồi! Không đủ năng lượng khiến con quay ngã gục! 🍂');
    } else if (dizzy) {
      playSFX('sneeze');
      if (dizzyFace) dizzyFace.style.display = 'block';
      if (topWrapper) gsap.set(topWrapper, { rotationZ: 35 });
      showToast('Con quay chóng mặt hoa mắt xin nghỉ ngơi! 😵‍💫');
    } else if (trickSuccess) {
      playSFX('win_chime');
      showToast('Kỹ thuật xuất sắc! Tràng pháo tay giòn giã! 👏✨');
    }
    return;
  }

  if (fallen) {
    playSFX('sneeze');
    if (topWrapper) {
      safeGsapTo(topWrapper, {
        rotationZ: 85,
        y: 35,
        duration: 0.45,
        ease: 'bounce.out',
        onComplete: () => {
          showToast('Hụt hơi rồi! Không đủ năng lượng khiến con quay ngã gục! 🍂');
        },
      });
    }
    return;
  }

  if (trickSuccess) {
    playSFX('win_chime');

    const trickDuration = trick === 'bay_cao' ? 0.8 : trick === 'nguoi_duc' ? 0.6 : 0.7;

    if (topWrapper) {
      if (trick === 'bay_cao') {
        safeGsapTo(topWrapper, {
          y: -140,
          scale: 1.5,
          rotationY: 360,
          duration: trickDuration * 0.6,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
        });
      } else if (trick === 'nguoi_duc') {
        safeGsapTo(topWrapper, {
          y: -70,
          scale: 1.35,
          rotationY: 360,
          duration: trickDuration * 0.5,
          ease: 'power1.out',
          yoyo: true,
          repeat: 1,
        });
      } else {
        // qua_gam
        safeGsapTo(topWrapper, {
          x: 75,
          y: -30,
          scale: 1.3,
          rotationZ: 360,
          duration: trickDuration * 0.5,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: 1,
        });
      }
    }

    if (topShadow) {
      safeGsapTo(topShadow, {
        scale: 0.35,
        opacity: 0.15,
        duration: trickDuration * 0.5,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out',
      });
    }

    if (dizzy) {
      safeGsapTo(topWrapper, {
        delay: trickDuration + 0.1,
        rotationZ: 40,
        x: 10,
        duration: 0.8,
        ease: 'power2.out',
        onComplete: () => {
          playSFX('sneeze');
          if (dizzyFace) dizzyFace.style.display = 'block';
          showToast('Con quay chóng mặt hoa mắt! 5 kỹ thuật liên hoàn xin dừng nghỉ! 😵‍💫');
        },
      });
    } else {
      showToast('Kỹ thuật xuất sắc! Tràng pháo tay giòn giã! 👏✨');
    }
  }
}

function animateFinishVisual(): void {
  if (!rootEl) return;
  const topWrapper = rootEl.querySelector('.dq-top-wrapper') as HTMLElement;
  playSFX('win_chime');

  if (reducedMotion()) {
    if (topWrapper) gsap.set(topWrapper, { rotationZ: 15 });
    showToast(`Đã dừng quay! Điểm số: ${state.score}. 🏆`);
    return;
  }

  if (topWrapper) {
    safeGsapTo(topWrapper, {
      rotationZ: 20,
      duration: 0.7,
      ease: 'power2.out',
      onComplete: () => {
        showToast(`Đã dừng quay! Điểm số: ${state.score}. 🏆`);
      },
    });
  }
}

/* ================== DOM BUILD & RENDER ================== */

export function buildDanhQuayScene(container: HTMLElement): void {
  destroyDanhQuayScene();

  state = createInitialState(loadSaveData().longestSpinRecord);

  rootEl = document.createElement('div');
  rootEl.className = 'dq-root';

  const styleEl = document.createElement('style');
  styleEl.id = 'dq-style';
  styleEl.textContent = `
    .dq-root {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 520px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: var(--font-body);
      user-select: none;
      background: radial-gradient(circle at 50% 35%, #fffbf0 0%, #f7ecd2 60%, #eedbba 100%);
      color: var(--ink);
    }
    .dq-hud {
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
    .dq-hud > * { pointer-events: auto; }
    .dq-title-badge {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 0.95rem;
      background: rgba(255, 255, 255, 0.92);
      color: var(--lacquer-deep);
      padding: 4px 14px;
      border-radius: var(--r-pill);
      border: 2px solid var(--wood);
      box-shadow: var(--shadow-toy);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dq-energy-hud {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: rgba(255, 255, 255, 0.92);
      padding: 4px 14px;
      border-radius: var(--r-lg);
      border: 2px solid var(--wood);
      box-shadow: var(--shadow-toy);
      min-width: 140px;
    }
    .dq-energy-label {
      font-size: 0.72rem;
      font-weight: 800;
      color: var(--lacquer-deep);
      margin-bottom: 2px;
    }
    .dq-energy-track {
      width: 100%;
      height: 8px;
      background: #e8d7be;
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid var(--wood);
    }
    .dq-energy-bar {
      height: 100%;
      width: 30%;
      background: #52c41a;
      transition: width 0.2s ease, background-color 0.2s ease;
    }
    .dq-scores {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.92);
      padding: 4px 12px;
      border-radius: var(--r-pill);
      border: 2px solid var(--wood);
      box-shadow: var(--shadow-toy);
      font-weight: 700;
      font-size: 0.85rem;
    }
    .dq-agent-dot {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: var(--r-pill);
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid var(--wood);
      font-size: 0.72rem;
      font-weight: 600;
    }
    .dq-agent-dot .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--leaf);
    }
    .dq-agent-dot .status-dot.offline { background: var(--marigold); }

    /* Playground Yard */
    .dq-yard {
      position: relative;
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 16px 140px 16px;
    }
    .dq-courtyard-bg {
      position: absolute;
      inset: 0;
      background-image:
        radial-gradient(var(--wood-light) 1px, transparent 1px),
        radial-gradient(var(--wood-light) 1px, transparent 1px);
      background-size: 32px 32px;
      background-position: 0 0, 16px 16px;
      opacity: 0.25;
      pointer-events: none;
    }
    .dq-lanterns {
      position: absolute;
      top: 12%;
      left: 6%;
      right: 6%;
      display: flex;
      justify-content: space-between;
      font-size: 1.8rem;
      opacity: 0.7;
      pointer-events: none;
    }

    /* Spinning Ring Arena */
    .dq-arena-disc {
      position: relative;
      width: 320px;
      height: 320px;
      border-radius: 50%;
      background: radial-gradient(circle, #fcf4e4 0%, #ebd7b7 70%, #cbb18a 100%);
      border: 6px solid #8B4513;
      box-shadow:
        inset 0 4px 12px rgba(0,0,0,0.15),
        0 10px 24px rgba(0,0,0,0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
    }
    .dq-arena-ring {
      position: absolute;
      border-radius: 50%;
      border: 2px dashed rgba(139, 69, 19, 0.35);
    }
    .dq-arena-ring.outer { width: 260px; height: 260px; }
    .dq-arena-ring.mid { width: 180px; height: 180px; }
    .dq-arena-ring.inner { width: 100px; height: 100px; }

    /* Central Top Assembly */
    .dq-top-assembly {
      position: relative;
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      perspective: 800px;
    }
    .dq-top-shadow {
      position: absolute;
      bottom: -15px;
      width: 70px;
      height: 20px;
      border-radius: 50%;
      background: rgba(43, 27, 23, 0.4);
      filter: blur(4px);
      z-index: 1;
      transform-origin: center;
    }
    .dq-top-wrapper {
      position: relative;
      width: 90px;
      height: 90px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      transform-origin: center bottom;
    }
    .dq-top-spinner {
      position: relative;
      width: 90px;
      height: 90px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform-origin: center center;
    }
    .dq-dizzy-face {
      position: absolute;
      top: -24px;
      font-size: 2.2rem;
      display: none;
      z-index: 15;
    }
    .dq-whip-anim {
      position: absolute;
      left: 10px;
      bottom: 20px;
      font-size: 2.6rem;
      opacity: 0;
      pointer-events: none;
      z-index: 20;
    }
    .dq-spark {
      position: absolute;
      font-size: 1.8rem;
      opacity: 0;
      pointer-events: none;
      z-index: 21;
    }

    /* Status toast banner inside arena */
    .dq-status-toast {
      position: absolute;
      top: 15px;
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid var(--lacquer-deep);
      border-radius: var(--r-pill);
      padding: 4px 16px;
      font-size: 0.85rem;
      font-weight: 800;
      color: var(--lacquer-deep);
      box-shadow: var(--shadow-toy);
      z-index: 8;
    }

    /* Dock Controls */
    .dq-dock {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.96);
      border-top: 2px solid var(--wood);
      box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
      padding: 10px 16px calc(12px + env(safe-area-inset-bottom)) 16px;
      z-index: 15;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
    }
    .dq-dock-prompt {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--ink);
      text-align: center;
    }
    .dq-dock-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      width: 100%;
      max-width: 680px;
    }
    .dq-dock-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: center;
      width: 100%;
    }
    .dq-btn {
      font-family: var(--font-display);
      font-size: 0.82rem;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: var(--r-pill);
      border: 2px solid var(--wood);
      background: white;
      color: var(--ink);
      cursor: pointer;
      box-shadow: var(--shadow-toy);
      transition: transform 0.1s, background 0.15s;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .dq-btn:hover {
      transform: translateY(-2px);
      background: #FFFBF0;
    }
    .dq-btn:active {
      transform: translateY(1px);
    }
    .dq-btn.primary {
      background: var(--lacquer);
      border-color: var(--lacquer-deep);
      color: white;
    }
    .dq-btn.primary:hover {
      background: var(--lacquer-deep);
    }
    .dq-btn.accent {
      background: #D48806;
      border-color: #874D00;
      color: white;
    }
    .dq-btn.success {
      background: #52C41A;
      border-color: #389E0D;
      color: white;
    }
    .dq-btn.danger {
      background: #FF4D4F;
      border-color: #CF1322;
      color: white;
    }

    /* Result overlay */
    .dq-result-overlay {
      position: absolute;
      inset: 0;
      background: rgba(43, 27, 23, 0.65);
      backdrop-filter: blur(4px);
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .dq-result-card {
      background: white;
      border: 3px solid var(--lacquer-deep);
      border-radius: var(--r-xl);
      padding: 24px;
      max-width: 380px;
      width: 100%;
      text-align: center;
      box-shadow: var(--shadow-lg);
    }
    .dq-result-icon {
      font-size: 3rem;
      margin-bottom: 8px;
    }
    .dq-result-title {
      font-family: var(--font-display);
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--lacquer-deep);
      margin-bottom: 8px;
    }
    .dq-result-desc {
      font-size: 0.9rem;
      color: var(--ink-soft);
      line-height: 1.4;
      margin-bottom: 16px;
    }

    @media (max-width: 600px) {
      .dq-arena-disc { width: 270px; height: 270px; }
      .dq-top-assembly { width: 100px; height: 100px; }
      .dq-scores { font-size: 0.75rem; }
    }
  `;
  rootEl.appendChild(styleEl);

  // HUD
  const hud = document.createElement('div');
  hud.className = 'dq-hud';

  const titleBadge = document.createElement('div');
  titleBadge.className = 'dq-title-badge';
  titleBadge.innerHTML = `<span>🌀</span><span>Đánh Quay</span>`;
  hud.appendChild(titleBadge);

  const energyHud = document.createElement('div');
  energyHud.className = 'dq-energy-hud';
  energyHud.innerHTML = `
    <div class="dq-energy-label">⚡ Năng lượng: <span class="dq-energy-val">${state.energy}</span>/100</div>
    <div class="dq-energy-track">
      <div class="dq-energy-bar" style="width: ${state.energy}%;"></div>
    </div>
  `;
  hud.appendChild(energyHud);

  const scoresBox = document.createElement('div');
  scoresBox.className = 'dq-scores';
  scoresBox.innerHTML = `
    <span class="dq-score-val">⏱️ ${state.score}s</span>
    <span>|</span>
    <span class="dq-tricks-val">✨ ${state.tricksLanded}</span>
    <span>|</span>
    <span class="dq-record-val">🏆 ${state.longestSpinRecord}s</span>
  `;
  hud.appendChild(scoresBox);

  const status = getWebMCPStatus();
  const agentDot = document.createElement('div');
  agentDot.className = 'dq-agent-dot';
  agentDot.innerHTML = `
    <span class="status-dot ${status.status === 'online' ? '' : 'offline'}"></span>
    <span>Agent</span>
  `;
  hud.appendChild(agentDot);

  rootEl.appendChild(hud);

  // Yard
  const yard = document.createElement('div');
  yard.className = 'dq-yard';

  const bg = document.createElement('div');
  bg.className = 'dq-courtyard-bg';
  yard.appendChild(bg);

  const lanterns = document.createElement('div');
  lanterns.className = 'dq-lanterns';
  lanterns.innerHTML = `<span>🏮</span><span>🏮</span><span>🏮</span>`;
  yard.appendChild(lanterns);

  // Status toast inside arena
  const statusToast = document.createElement('div');
  statusToast.className = 'dq-status-toast';
  statusToast.textContent = 'Sẵn sàng quất quay!';
  yard.appendChild(statusToast);

  // Arena Disc
  const arenaDisc = document.createElement('div');
  arenaDisc.className = 'dq-arena-disc';

  const ringOuter = document.createElement('div');
  ringOuter.className = 'dq-arena-ring outer';
  arenaDisc.appendChild(ringOuter);

  const ringMid = document.createElement('div');
  ringMid.className = 'dq-arena-ring mid';
  arenaDisc.appendChild(ringMid);

  const ringInner = document.createElement('div');
  ringInner.className = 'dq-arena-ring inner';
  arenaDisc.appendChild(ringInner);

  // Top Assembly
  const topAssembly = document.createElement('div');
  topAssembly.className = 'dq-top-assembly';

  const topShadow = document.createElement('div');
  topShadow.className = 'dq-top-shadow';
  topAssembly.appendChild(topShadow);

  const topWrapper = document.createElement('div');
  topWrapper.className = 'dq-top-wrapper';

  const topSpinner = document.createElement('div');
  topSpinner.className = 'dq-top-spinner';
  // Procedural SVG Spinning Top with traditional Vietnamese lacquer & wood bands
  topSpinner.innerHTML = `
    <svg width="90" height="90" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Outer wooden rim -->
      <circle cx="50" cy="50" r="46" fill="#8B4513" stroke="#5c241c" stroke-width="4"/>
      <!-- Gold inlay band -->
      <circle cx="50" cy="50" r="38" fill="#D48806" stroke="#b8332a" stroke-width="3"/>
      <!-- Crimson lacquer band -->
      <circle cx="50" cy="50" r="30" fill="#b8332a" stroke="#f7ecd2" stroke-width="2"/>
      <!-- Inner ivory disk -->
      <circle cx="50" cy="50" r="22" fill="#FFFBF0" stroke="#8B4513" stroke-width="2"/>
      <!-- Spiral pattern indicating rotation -->
      <path d="M50 50 Q65 35 50 20 Q30 35 50 50 Z" fill="#b8332a" opacity="0.85"/>
      <path d="M50 50 Q35 65 50 80 Q70 65 50 50 Z" fill="#D48806" opacity="0.85"/>
      <path d="M50 50 Q35 35 20 50 Q35 70 50 50 Z" fill="#52C41A" opacity="0.75"/>
      <path d="M50 50 Q65 65 80 50 Q65 30 50 50 Z" fill="#1890FF" opacity="0.75"/>
      <!-- Center Spindle Peg -->
      <circle cx="50" cy="50" r="8" fill="#2B1B17" stroke="#FFD700" stroke-width="2"/>
      <circle cx="50" cy="50" r="3" fill="#FFFBF0"/>
    </svg>
  `;
  topWrapper.appendChild(topSpinner);

  const dizzyFace = document.createElement('div');
  dizzyFace.className = 'dq-dizzy-face';
  dizzyFace.textContent = '😵‍💫';
  topWrapper.appendChild(dizzyFace);

  topAssembly.appendChild(topWrapper);

  const whipAnim = document.createElement('div');
  whipAnim.className = 'dq-whip-anim';
  whipAnim.textContent = '🎋';
  topAssembly.appendChild(whipAnim);

  const spark = document.createElement('div');
  spark.className = 'dq-spark';
  spark.textContent = '✨';
  topAssembly.appendChild(spark);

  arenaDisc.appendChild(topAssembly);
  yard.appendChild(arenaDisc);
  rootEl.appendChild(yard);

  // Dock
  const dock = document.createElement('div');
  dock.className = 'dq-dock';
  rootEl.appendChild(dock);

  gsapCtx = gsap.context(() => {}, rootEl);
  container.appendChild(rootEl);

  renderScene(state);
}

function renderScene(s: DanhQuayState): void {
  if (!rootEl) return;

  // 1. Update HUD
  const energyVal = rootEl.querySelector('.dq-energy-val');
  if (energyVal) energyVal.textContent = `${s.energy}`;
  const energyBar = rootEl.querySelector('.dq-energy-bar') as HTMLElement;
  if (energyBar) {
    energyBar.style.width = `${s.energy}%`;
    if (s.energy >= 80) {
      energyBar.style.backgroundColor = '#fa8c16'; // Warning zone (wobble/overwhip danger)
    } else if (s.energy >= 35) {
      energyBar.style.backgroundColor = '#52c41a'; // Good zone
    } else {
      energyBar.style.backgroundColor = '#ff4d4f'; // Danger low
    }
  }

  const scoreVal = rootEl.querySelector('.dq-score-val');
  if (scoreVal) scoreVal.textContent = `⏱️ ${s.score}s`;
  const tricksVal = rootEl.querySelector('.dq-tricks-val');
  if (tricksVal) tricksVal.textContent = `✨ ${s.tricksLanded}`;
  const recordVal = rootEl.querySelector('.dq-record-val');
  if (recordVal) recordVal.textContent = `🏆 ${s.longestSpinRecord}s`;

  // 2. Update status toast in arena
  const statusToast = rootEl.querySelector('.dq-status-toast');
  if (statusToast) {
    if (s.status === 'spinning') {
      if (s.wobbling) {
        statusToast.textContent = '⚠️ Con quay đang loạng choạng!';
      } else if (s.consecutiveTricks > 0) {
        statusToast.textContent = `✨ Kỹ thuật liên tiếp: ${s.consecutiveTricks}/5!`;
      } else {
        statusToast.textContent = `🌀 Đang quay tít (NL: ${s.energy}/100)`;
      }
    } else if (s.status === 'fallen') {
      statusToast.textContent = '🍂 Con quay đã đổ!';
    } else if (s.status === 'flew_off') {
      statusToast.textContent = '🏮 Văng trúng lồng đèn!';
    } else if (s.status === 'dizzy') {
      statusToast.textContent = '😵‍💫 Chóng mặt xin nghỉ!';
    } else {
      statusToast.textContent = 'Sẵn sàng quất quay!';
    }
  }

  // 3. Update spin animation
  updateSpinSpeed(s.energy, s.status);

  // 4. Update Dock Controls
  const dock = rootEl.querySelector('.dq-dock') as HTMLElement;
  if (dock) {
    renderDockControls(dock, s);
  }

  // 5. Overlays
  rootEl.querySelectorAll('.dq-result-overlay').forEach((el) => el.remove());
  if (s.status === 'fallen' || s.status === 'flew_off' || s.status === 'dizzy') {
    renderResultOverlay(s);
  }
}

function renderDockControls(dock: HTMLElement, s: DanhQuayState): void {
  dock.innerHTML = '';

  const prompt = document.createElement('div');
  prompt.className = 'dq-dock-prompt';
  dock.appendChild(prompt);

  const group = document.createElement('div');
  group.className = 'dq-dock-group';
  dock.appendChild(group);

  if (s.status !== 'spinning') {
    prompt.textContent = s.status === 'idle'
      ? 'Nhấn Bắt đầu để quấn dây và thả con quay vào sân:'
      : 'Con quay đã dừng! Hãy bắt đầu một lượt chơi mới:';

    const row = document.createElement('div');
    row.className = 'dq-dock-row';

    const startBtn = document.createElement('button');
    startBtn.className = 'dq-btn primary';
    startBtn.textContent = '🚀 Bắt đầu quay (30 NL)';
    startBtn.addEventListener('click', () => driveStart(false));
    row.appendChild(startBtn);

    group.appendChild(row);
  } else {
    prompt.textContent = 'Quất roi để nạp năng lượng, hoặc biểu diễn kỹ thuật (tốn 40 NL):';

    // Whip row
    const whipRow = document.createElement('div');
    whipRow.className = 'dq-dock-row';

    const nheBtn = document.createElement('button');
    nheBtn.className = 'dq-btn';
    nheBtn.textContent = '🌾 Quất nhẹ (+5)';
    nheBtn.addEventListener('click', () => driveWhip('nhe', false));
    whipRow.appendChild(nheBtn);

    const vuaBtn = document.createElement('button');
    vuaBtn.className = 'dq-btn primary';
    vuaBtn.textContent = '⚡ Quất vừa (+12)';
    vuaBtn.addEventListener('click', () => driveWhip('vua', false));
    whipRow.appendChild(vuaBtn);

    const manhBtn = document.createElement('button');
    manhBtn.className = 'dq-btn accent';
    manhBtn.textContent = '💥 Quất mạnh (+22)';
    manhBtn.title = 'Nguy hiểm khi năng lượng cao!';
    manhBtn.addEventListener('click', () => driveWhip('manh', false));
    whipRow.appendChild(manhBtn);

    group.appendChild(whipRow);

    // Trick row
    const trickRow = document.createElement('div');
    trickRow.className = 'dq-dock-row';

    const nguoiDucBtn = document.createElement('button');
    nguoiDucBtn.className = 'dq-btn';
    nguoiDucBtn.textContent = '🎠 Ngựa đực (-40)';
    nguoiDucBtn.addEventListener('click', () => driveTrick('nguoi_duc', false));
    trickRow.appendChild(nguoiDucBtn);

    const bayCaoBtn = document.createElement('button');
    bayCaoBtn.className = 'dq-btn';
    bayCaoBtn.textContent = '🦅 Bay cao (-40)';
    bayCaoBtn.addEventListener('click', () => driveTrick('bay_cao', false));
    trickRow.appendChild(bayCaoBtn);

    const quaGamBtn = document.createElement('button');
    quaGamBtn.className = 'dq-btn';
    quaGamBtn.textContent = '🌉 Qua gầm (-40)';
    quaGamBtn.addEventListener('click', () => driveTrick('qua_gam', false));
    trickRow.appendChild(quaGamBtn);

    const finishBtn = document.createElement('button');
    finishBtn.className = 'dq-btn danger';
    finishBtn.textContent = '⏹️ Dừng quay';
    finishBtn.addEventListener('click', () => driveFinish(false));
    trickRow.appendChild(finishBtn);

    group.appendChild(trickRow);
  }
}

function renderResultOverlay(s: DanhQuayState): void {
  if (!rootEl) return;
  const overlay = document.createElement('div');
  overlay.className = 'dq-result-overlay';

  const card = document.createElement('div');
  card.className = 'dq-result-card';

  let icon = '🏆';
  let title = 'Kết Thúc Lượt Quay!';
  let desc = `Con quay đã quay được ${s.score} giây và hoàn thành ${s.tricksLanded} kỹ thuật! Kỷ lục: ${s.longestSpinRecord} giây.`;

  if (s.status === 'flew_off') {
    icon = '🏮';
    title = 'Văng Trúng Lồng Đèn!';
    desc = `Lực quất quá mạnh khiến con quay bay vút lên nóc đình, làm rung rinh dàn lồng đèn! Điểm số: ${s.score} giây.`;
  } else if (s.status === 'dizzy') {
    icon = '😵‍💫';
    title = 'Con Quay Hoa Mắt!';
    desc = `Thực hiện 5 kỹ thuật liên tiếp khiến con quay hoa mắt chóng mặt và ngả lưng nghỉ ngơi! Điểm số: ${s.score} giây.`;
  } else if (s.status === 'fallen') {
    icon = '🍂';
    title = 'Con Quay Ngã Đổ!';
    desc = `Hết năng lượng hoặc cú đánh bất cẩn làm con quay mất thăng bằng ngã ra sân gạch. Điểm số: ${s.score} giây.`;
  }

  card.innerHTML = `
    <div class="dq-result-icon">${icon}</div>
    <div class="dq-result-title">${title}</div>
    <div class="dq-result-desc">${desc}</div>
    <div style="display:flex; justify-content:center; gap:8px;">
      <button class="dq-btn primary" id="dq-restart-btn">🔄 Chơi lại lượt mới</button>
    </div>
  `;

  card.querySelector('#dq-restart-btn')?.addEventListener('click', () => {
    overlay.remove();
    driveStart(false);
  });

  overlay.appendChild(card);
  rootEl.appendChild(overlay);
}

export function destroyDanhQuayScene(): void {
  if (spinTween) {
    spinTween.kill();
    spinTween = null;
  }
  if (gsapCtx) {
    gsapCtx.revert();
    gsapCtx = null;
  }
  if (rootEl) {
    const styleEl = document.getElementById('dq-style');
    if (styleEl) styleEl.remove();
    rootEl.remove();
    rootEl = null;
  }
  state = createInitialState(loadSaveData().longestSpinRecord);
}
