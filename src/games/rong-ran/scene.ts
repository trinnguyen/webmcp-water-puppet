import { gsap } from 'gsap';
import {
  Speed,
  RongRanState,
  CHANT_LINES,
  createInitialState,
  startRound,
  advanceChant,
  answer,
  startChase,
  nextRound,
} from './rules';
import { playSFX } from '../../audio';
import { reducedMotion } from '../../motion';
import { getWebMCPStatus, showToast } from '../../ui';

export interface RongRanSaveData {
  roundsSurvived: number;
  totalCatches: number;
  bestStreak: number;
}

const STORAGE_KEY = 'san_choi_rong_ran';

let state: RongRanState = createInitialState(6);
let rootEl: HTMLElement | null = null;
let gsapCtx: gsap.Context | null = null;
let bubbleTimer: number | null = null;

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

function loadSaveData(): RongRanSaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          roundsSurvived: typeof parsed.roundsSurvived === 'number' ? parsed.roundsSurvived : 0,
          totalCatches: typeof parsed.totalCatches === 'number' ? parsed.totalCatches : 0,
          bestStreak: typeof parsed.bestStreak === 'number' ? parsed.bestStreak : 0,
        };
      }
    }
  } catch {
    /* ignore parse error */
  }
  return { roundsSurvived: 0, totalCatches: 0, bestStreak: 0 };
}

function saveState(s: RongRanState): void {
  const data = loadSaveData();
  data.roundsSurvived = Math.max(data.roundsSurvived, s.roundsSurvived);
  data.totalCatches = Math.max(data.totalCatches, s.totalCatches);
  data.bestStreak = Math.max(data.bestStreak, s.roundsSurvived);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
}

export function getRongRanState(): RongRanState {
  return state;
}

/* ================== DRIVE FUNCTIONS ================== */

export function driveStart(length?: number, isAgent = false): RongRanState {
  state = startRound(state, length);
  playSFX('coin');

  if (isAgent) {
    void (async () => {
      animateDragonEntrance();
      showChantVisual(state.chantLine);
    })().catch(() => {});
  } else {
    animateDragonEntrance();
    showChantVisual(state.chantLine);
  }

  renderScene(state);
  return state;
}

export function driveAdvanceChant(isAgent = false): RongRanState {
  state = advanceChant(state);
  playSFX('coin');

  if (isAgent) {
    void (async () => {
      animateChantBeat();
      showChantVisual(state.chantLine);
    })().catch(() => {});
  } else {
    animateChantBeat();
    showChantVisual(state.chantLine);
  }

  renderScene(state);
  return state;
}

export function driveAnswer(ans: 'Có' | 'Không', isAgent = false): RongRanState {
  state = answer(state, ans);
  if (ans === 'Có') {
    playSFX('capture');
  } else {
    playSFX('sneeze');
  }

  const replyText = ans === 'Có'
    ? 'Có nhà! Tha hồ mà đuổi! Đuổi khúc đuôi!'
    : 'Không có nhà! Thầy thuốc đi chợ rồi!';

  if (isAgent) {
    void (async () => {
      showDoctorSpeech(replyText);
    })().catch(() => {});
  } else {
    showDoctorSpeech(replyText);
  }

  renderScene(state);
  return state;
}

export function driveChase(speed: Speed, isAgent = false): RongRanState {
  state = startChase(state, speed);
  saveState(state);

  if (isAgent) {
    void (async () => {
      animateChaseVisual(speed, state.chaseResult);
    })().catch(() => {});
  } else {
    animateChaseVisual(speed, state.chaseResult);
  }

  renderScene(state);
  return state;
}

export function driveNextRound(isAgent = false): RongRanState {
  state = nextRound(state);
  saveState(state);
  playSFX('coin');

  if (isAgent) {
    void (async () => {
      animateDragonEntrance();
      showChantVisual(state.chantLine);
    })().catch(() => {});
  } else {
    animateDragonEntrance();
    showChantVisual(state.chantLine);
  }

  renderScene(state);
  return state;
}

/* ================== VISUAL ANIMATIONS ================== */

function animateDragonEntrance(): void {
  if (!rootEl || reducedMotion()) return;
  const segments = rootEl.querySelectorAll('.rr-segment');
  if (!segments.length) return;

  safeGsapFromTo(
    segments,
    { scale: 0, opacity: 0, y: 20 },
    { scale: 1, opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'back.out(1.5)' }
  );
}

function animateChantBeat(): void {
  if (!rootEl || reducedMotion()) return;
  const chain = rootEl.querySelector('.rr-chain');
  if (!chain) return;

  safeGsapTo(chain, {
    y: -8,
    duration: 0.15,
    yoyo: true,
    repeat: 1,
    ease: 'power1.out',
  });
}

function showDoctorSpeech(text: string): void {
  if (!rootEl) return;
  const bubble = rootEl.querySelector('.rr-doctor-bubble') as HTMLElement;
  if (!bubble) return;

  bubble.textContent = text;
  bubble.style.display = 'block';

  if (!reducedMotion()) {
    safeGsapFromTo(
      bubble,
      { opacity: 0, y: 10, scale: 0.8 },
      { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'back.out(1.6)' }
    );
  }

  if (bubbleTimer !== null) {
    window.clearTimeout(bubbleTimer);
  }
  bubbleTimer = window.setTimeout(() => {
    if (bubble) {
      if (!reducedMotion()) {
        safeGsapTo(bubble, {
          opacity: 0,
          y: -5,
          duration: 0.2,
          onComplete: () => {
            bubble.style.display = 'none';
          },
        });
      } else {
        bubble.style.display = 'none';
      }
    }
  }, 3500);
}

function showChantVisual(chantIndex: number): void {
  if (!rootEl) return;
  const lineEls = rootEl.querySelectorAll('.rr-chant-line');
  lineEls.forEach((el, idx) => {
    if (idx === chantIndex) {
      el.classList.add('active');
      if (!reducedMotion()) {
        safeGsapFromTo(el, { scale: 0.95 }, { scale: 1.05, duration: 0.2, ease: 'back.out(2)' });
      }
    } else {
      el.classList.remove('active');
    }
  });
}

function animateChaseVisual(speed: Speed, result: 'caught' | 'escaped' | null): void {
  if (!rootEl) return;
  const doctorEl = rootEl.querySelector('.rr-doctor-card') as HTMLElement;
  const tailEl = rootEl.querySelector('.rr-segment.tail') as HTMLElement;
  const headEl = rootEl.querySelector('.rr-segment.head') as HTMLElement;
  const segments = rootEl.querySelectorAll('.rr-segment');

  if (reducedMotion()) {
    if (result === 'caught') {
      playSFX('sneeze');
      playSFX('capture');
      if (tailEl) tailEl.style.transform = 'scale(0)';
      showToast('Thầy thuốc đã bắt được khúc đuôi!');
    } else {
      playSFX('win_chime');
      showToast('Rồng rắn đã thoát hiểm thành công!');
    }
    return;
  }

  playSFX('dice_roll');

  const duration = speed === 'nhanh' ? 0.6 : speed === 'vua' ? 1.0 : 1.6;

  // 1. Dragon Snake weaves to evade
  safeGsapTo(headEl, {
    x: -30,
    y: -25,
    duration: duration * 0.4,
    yoyo: true,
    repeat: 1,
    ease: 'sine.inOut',
  });

  // Segment follow-up weave with stagger
  safeGsapTo(segments, {
    x: (i) => Math.sin(i * 0.6) * 20,
    duration: duration * 0.5,
    stagger: 0.06,
    yoyo: true,
    repeat: 1,
    ease: 'power1.inOut',
  });

  // 2. Doctor dashes toward tail
  if (doctorEl && tailEl) {
    const doctorRect = doctorEl.getBoundingClientRect();
    const tailRect = tailEl.getBoundingClientRect();
    const deltaX = (tailRect.left + tailRect.width / 2) - (doctorRect.left + doctorRect.width / 2);
    const deltaY = (tailRect.top + tailRect.height / 2) - (doctorRect.top + doctorRect.height / 2);

    const targetX = deltaX * 0.85;
    const targetY = deltaY * 0.85;

    safeGsapTo(doctorEl, {
      x: targetX,
      y: targetY,
      duration,
      ease: 'power2.inOut',
      onComplete: () => {
        // Resolve visual outcome
        if (result === 'caught') {
          playSFX('sneeze');
          playSFX('capture');

          // Tail deflates on catch
          safeGsapTo(tailEl, {
            scale: 0,
            duration: 0.5,
            ease: 'back.in(1.7)',
          });

          // Doctor victory bounce
          safeGsapTo(doctorEl, {
            y: targetY - 20,
            yoyo: true,
            repeat: 3,
            duration: 0.18,
            ease: 'power1.inOut',
            onComplete: () => {
              safeGsapTo(doctorEl, { x: 0, y: 0, duration: 0.4, delay: 0.5 });
              showToast('Thầy thuốc đã bắt được khúc đuôi!');
            },
          });
        } else {
          // Escaped! Tail celebrates, doctor wobbles
          playSFX('win_chime');

          safeGsapTo(tailEl, {
            scale: 1.25,
            yoyo: true,
            repeat: 2,
            duration: 0.25,
            ease: 'back.out(2)',
          });

          safeGsapTo(doctorEl, {
            rotation: 15,
            yoyo: true,
            repeat: 4,
            duration: 0.12,
            ease: 'power1.inOut',
            onComplete: () => {
              safeGsapTo(doctorEl, { x: 0, y: 0, rotation: 0, duration: 0.4, delay: 0.4 });
              showToast('Rồng rắn đã luồn lách thoát khỏi thầy thuốc!');
            },
          });
        }
      },
    });
  }
}

/* ================== DOM BUILD & RENDER ================== */

export function buildRongRanScene(container: HTMLElement): void {
  destroyRongRanScene();

  rootEl = document.createElement('div');
  rootEl.className = 'rr-root';

  const styleEl = document.createElement('style');
  styleEl.id = 'rr-style';
  styleEl.textContent = `
    .rr-root {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 520px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: var(--font-body);
      user-select: none;
      background: radial-gradient(circle at 50% 30%, #fffbf0 0%, #f7ecd2 60%, #eedbba 100%);
      color: var(--ink);
    }
    .rr-hud {
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
    .rr-hud > * { pointer-events: auto; }
    .rr-title-badge {
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
    .rr-scores {
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
    .rr-agent-dot {
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
    .rr-agent-dot .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--leaf);
    }
    .rr-agent-dot .status-dot.offline { background: var(--marigold); }

    /* Playground */
    .rr-yard {
      position: relative;
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 50px 16px 140px 16px;
    }
    .rr-courtyard-bg {
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
    .rr-clouds {
      position: absolute;
      top: 15%;
      left: 8%;
      font-size: 2.5rem;
      opacity: 0.35;
      pointer-events: none;
      animation: rr-cloud-float 20s ease-in-out infinite alternate;
    }
    @keyframes rr-cloud-float {
      from { transform: translateX(0); }
      to { transform: translateX(80px); }
    }

    /* Chant display bar */
    .rr-chant-board {
      z-index: 5;
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid var(--lacquer);
      border-radius: var(--r-lg);
      padding: 10px 18px;
      box-shadow: var(--shadow-toy);
      max-width: 500px;
      width: 90%;
      text-align: center;
      margin-bottom: 24px;
    }
    .rr-chant-title {
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--lacquer-deep);
      margin-bottom: 4px;
    }
    .rr-chant-line {
      font-family: var(--font-display);
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--ink-soft);
      padding: 2px 0;
      transition: color 0.2s, transform 0.2s;
    }
    .rr-chant-line.active {
      color: var(--lacquer-deep);
      font-weight: 900;
      transform: scale(1.04);
    }

    /* Arena containing dragon snake and doctor */
    .rr-arena {
      position: relative;
      width: 100%;
      max-width: 800px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      z-index: 6;
      padding: 10px;
    }

    /* Dragon snake chain */
    .rr-chain-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .rr-chain {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.6);
      border: 2px dashed rgba(184, 51, 42, 0.3);
      border-radius: var(--r-xl);
    }
    .rr-segment {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 50px;
      height: 60px;
      background: white;
      border: 2px solid var(--wood);
      border-radius: 12px;
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.08);
      position: relative;
      transition: transform 0.15s ease;
    }
    .rr-segment.head {
      border-color: #D48806;
      background: #FFFBE6;
      transform: scale(1.08);
      z-index: 2;
    }
    .rr-segment.tail {
      border-color: var(--lacquer);
      background: #FFF1F0;
      transform: scale(1.05);
      z-index: 2;
    }
    .rr-segment-emoji {
      font-size: 1.6rem;
      line-height: 1;
    }
    .rr-segment-label {
      font-size: 0.62rem;
      font-weight: 800;
      color: var(--ink-soft);
      margin-top: 3px;
    }
    .rr-segment.head .rr-segment-label { color: #D48806; }
    .rr-segment.tail .rr-segment-label { color: var(--lacquer); }

    /* Doctor Card */
    .rr-doctor-area {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 130px;
      flex-shrink: 0;
    }
    .rr-doctor-bubble {
      display: none;
      position: absolute;
      bottom: calc(100% + 10px);
      right: 0;
      background: white;
      border: 2px solid var(--lacquer-deep);
      border-radius: var(--r-lg);
      padding: 6px 12px;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--lacquer-deep);
      box-shadow: var(--shadow-toy);
      white-space: nowrap;
      z-index: 20;
    }
    .rr-doctor-bubble::after {
      content: '';
      position: absolute;
      top: 100%;
      right: 40px;
      border-width: 6px;
      border-style: solid;
      border-color: var(--lacquer-deep) transparent transparent transparent;
    }
    .rr-doctor-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 80px;
      height: 90px;
      background: #F6FFED;
      border: 3px solid #389E0D;
      border-radius: 16px;
      box-shadow: var(--shadow-toy);
      cursor: pointer;
    }
    .rr-doctor-emoji {
      font-size: 2.2rem;
      line-height: 1;
    }
    .rr-doctor-label {
      font-size: 0.72rem;
      font-weight: 800;
      color: #389E0D;
      margin-top: 4px;
    }

    /* Bottom dock controls */
    .rr-dock {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.96);
      border-top: 2px solid var(--wood);
      box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom)) 16px;
      z-index: 15;
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: center;
    }
    .rr-dock-prompt {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--ink);
      text-align: center;
    }
    .rr-dock-btns {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
      width: 100%;
      max-width: 600px;
    }
    .rr-btn {
      font-family: var(--font-display);
      font-size: 0.85rem;
      font-weight: 700;
      padding: 8px 16px;
      border-radius: var(--r-pill);
      border: 2px solid var(--wood);
      background: white;
      color: var(--ink);
      cursor: pointer;
      box-shadow: var(--shadow-toy);
      transition: transform 0.1s, background 0.15s;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .rr-btn:hover {
      transform: translateY(-2px);
      background: #FFFBF0;
    }
    .rr-btn:active {
      transform: translateY(1px);
    }
    .rr-btn.primary {
      background: var(--lacquer);
      border-color: var(--lacquer-deep);
      color: white;
    }
    .rr-btn.primary:hover {
      background: var(--lacquer-deep);
    }
    .rr-btn.success {
      background: #52C41A;
      border-color: #389E0D;
      color: white;
    }
    .rr-btn.danger {
      background: #FF4D4F;
      border-color: #CF1322;
      color: white;
    }

    /* Result overlay */
    .rr-result-overlay {
      position: absolute;
      inset: 0;
      background: rgba(43, 27, 23, 0.6);
      backdrop-filter: blur(4px);
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .rr-result-card {
      background: white;
      border: 3px solid var(--lacquer-deep);
      border-radius: var(--r-xl);
      padding: 24px;
      max-width: 380px;
      width: 100%;
      text-align: center;
      box-shadow: var(--shadow-lg);
    }
    .rr-result-icon {
      font-size: 3rem;
      margin-bottom: 8px;
    }
    .rr-result-title {
      font-family: var(--font-display);
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--lacquer-deep);
      margin-bottom: 8px;
    }
    .rr-result-desc {
      font-size: 0.9rem;
      color: var(--ink-soft);
      line-height: 1.4;
      margin-bottom: 16px;
    }

    @media (max-width: 600px) {
      .rr-arena { flex-direction: column; gap: 12px; }
      .rr-doctor-area { width: auto; }
      .rr-segment { width: 44px; height: 54px; }
      .rr-segment-emoji { font-size: 1.3rem; }
    }
  `;
  rootEl.appendChild(styleEl);

  // HUD
  const hud = document.createElement('div');
  hud.className = 'rr-hud';

  const titleBadge = document.createElement('div');
  titleBadge.className = 'rr-title-badge';
  titleBadge.innerHTML = `<span>🐉</span><span>Rồng Rắn Lên Mây</span>`;
  hud.appendChild(titleBadge);

  const scoresBox = document.createElement('div');
  scoresBox.className = 'rr-scores';
  scoresBox.innerHTML = `
    <span class="rr-round-val">Vòng ${state.round}</span>
    <span>|</span>
    <span class="rr-survived-val">🛡️ ${state.roundsSurvived}</span>
    <span>|</span>
    <span class="rr-catches-val">🎯 ${state.totalCatches}</span>
  `;
  hud.appendChild(scoresBox);

  const status = getWebMCPStatus();
  const agentDot = document.createElement('div');
  agentDot.className = 'rr-agent-dot';
  agentDot.innerHTML = `
    <span class="status-dot ${status.status === 'online' ? '' : 'offline'}"></span>
    <span>Agent</span>
  `;
  hud.appendChild(agentDot);

  rootEl.appendChild(hud);

  // Playground
  const yard = document.createElement('div');
  yard.className = 'rr-yard';

  const bg = document.createElement('div');
  bg.className = 'rr-courtyard-bg';
  yard.appendChild(bg);

  const clouds = document.createElement('div');
  clouds.className = 'rr-clouds';
  clouds.textContent = '☁️ ☁️';
  yard.appendChild(clouds);

  // Chant Board
  const chantBoard = document.createElement('div');
  chantBoard.className = 'rr-chant-board';
  chantBoard.innerHTML = `
    <div class="rr-chant-title">Đồng dao truyền thống</div>
    <div class="rr-chant-line active">${CHANT_LINES[0]}</div>
  `;
  yard.appendChild(chantBoard);

  // Arena
  const arena = document.createElement('div');
  arena.className = 'rr-arena';

  const chainWrap = document.createElement('div');
  chainWrap.className = 'rr-chain-wrap';
  const chainEl = document.createElement('div');
  chainEl.className = 'rr-chain';
  chainWrap.appendChild(chainEl);
  arena.appendChild(chainWrap);

  const doctorArea = document.createElement('div');
  doctorArea.className = 'rr-doctor-area';
  doctorArea.innerHTML = `
    <div class="rr-doctor-bubble"></div>
    <div class="rr-doctor-card">
      <div class="rr-doctor-emoji">${state.doctorAsset}</div>
      <div class="rr-doctor-label">Thầy thuốc</div>
    </div>
  `;
  arena.appendChild(doctorArea);

  yard.appendChild(arena);
  rootEl.appendChild(yard);

  // Dock
  const dock = document.createElement('div');
  dock.className = 'rr-dock';
  rootEl.appendChild(dock);

  gsapCtx = gsap.context(() => {}, rootEl);
  container.appendChild(rootEl);

  renderScene(state);
}

function renderScene(s: RongRanState): void {
  if (!rootEl) return;

  // 1. Update HUD
  const roundEl = rootEl.querySelector('.rr-round-val');
  if (roundEl) roundEl.textContent = `Vòng ${s.round}`;
  const survivedEl = rootEl.querySelector('.rr-survived-val');
  if (survivedEl) survivedEl.textContent = `🛡️ ${s.roundsSurvived}`;
  const catchesEl = rootEl.querySelector('.rr-catches-val');
  if (catchesEl) catchesEl.textContent = `🎯 ${s.totalCatches}`;

  // 2. Update Chant Board
  const chantBoard = rootEl.querySelector('.rr-chant-board');
  if (chantBoard) {
    chantBoard.innerHTML = `
      <div class="rr-chant-title">Đồng dao truyền thống (Câu ${s.chantLine + 1}/4)</div>
      <div class="rr-chant-line active">${CHANT_LINES[s.chantLine] || CHANT_LINES[0]}</div>
    `;
  }

  // 3. Update Doctor
  const docEmoji = rootEl.querySelector('.rr-doctor-emoji');
  if (docEmoji) docEmoji.textContent = s.doctorAsset;

  // 4. Update Chain Segments
  const chainEl = rootEl.querySelector('.rr-chain');
  if (chainEl) {
    chainEl.innerHTML = '';
    s.chain.forEach((seg, i) => {
      const segEl = document.createElement('div');
      const isHead = seg.id === 'head';
      const isTail = seg.id === 'tail';
      segEl.className = `rr-segment ${isHead ? 'head' : ''} ${isTail ? 'tail' : ''}`;
      segEl.setAttribute('data-id', seg.id);

      const label = isHead ? 'Đầu' : isTail ? 'Đuôi' : `K.${i}`;
      segEl.innerHTML = `
        <div class="rr-segment-emoji">${seg.asset}</div>
        <div class="rr-segment-label">${label}</div>
      `;
      chainEl.appendChild(segEl);
    });
  }

  // 5. Update Dock Controls
  const dock = rootEl.querySelector('.rr-dock') as HTMLElement;
  if (dock) {
    renderDockControls(dock, s);
  }

  // 6. Overlays
  rootEl.querySelectorAll('.rr-result-overlay').forEach((el) => el.remove());
  if (s.phase === 'resolved' && s.chaseResult) {
    renderResultOverlay(s);
  }
}

function renderDockControls(dock: HTMLElement, s: RongRanState): void {
  dock.innerHTML = '';

  const prompt = document.createElement('div');
  prompt.className = 'rr-dock-prompt';
  dock.appendChild(prompt);

  const btnsWrap = document.createElement('div');
  btnsWrap.className = 'rr-dock-btns';
  dock.appendChild(btnsWrap);

  if (s.phase === 'idle') {
    prompt.textContent = `Dàn đội hình rồng rắn (${s.length} người) chuẩn bị đi tìm thầy thuốc:`;

    const lenDec = document.createElement('button');
    lenDec.className = 'rr-btn';
    lenDec.textContent = '➖ 1 khúc';
    lenDec.disabled = s.length <= 4;
    lenDec.addEventListener('click', () => driveStart(s.length - 1));
    btnsWrap.appendChild(lenDec);

    const startBtn = document.createElement('button');
    startBtn.className = 'rr-btn primary';
    startBtn.textContent = `🚀 Bắt đầu (${s.length} người)`;
    startBtn.addEventListener('click', () => driveStart(s.length));
    btnsWrap.appendChild(startBtn);

    const lenInc = document.createElement('button');
    lenInc.className = 'rr-btn';
    lenInc.textContent = '➕ 1 khúc';
    lenInc.disabled = s.length >= 12;
    lenInc.addEventListener('click', () => driveStart(s.length + 1));
    btnsWrap.appendChild(lenInc);
  } else if (s.phase === 'chanting') {
    prompt.textContent = `Đoàn rồng rắn đang hát đồng dao: "${CHANT_LINES[s.chantLine]}"`;

    const chantBtn = document.createElement('button');
    chantBtn.className = 'rr-btn primary';
    chantBtn.textContent = '🎵 Hát tiếp';
    chantBtn.addEventListener('click', () => driveAdvanceChant());
    btnsWrap.appendChild(chantBtn);

    const askBtn = document.createElement('button');
    askBtn.className = 'rr-btn';
    askBtn.textContent = '⏩ Hỏi thầy thuốc';
    askBtn.addEventListener('click', () => {
      // Fast-forward chant to awaiting_answer
      state.chantLine = 3;
      state.phase = 'awaiting_answer';
      renderScene(state);
    });
    btnsWrap.appendChild(askBtn);
  } else if (s.phase === 'awaiting_answer') {
    prompt.textContent = 'Thầy thuốc có nhà hay không? Chọn câu trả lời:';

    const coBtn = document.createElement('button');
    coBtn.className = 'rr-btn success';
    coBtn.textContent = '🏠 Có nhà! (Bắt đầu đuổi bắt)';
    coBtn.addEventListener('click', () => driveAnswer('Có'));
    btnsWrap.appendChild(coBtn);

    const khongBtn = document.createElement('button');
    khongBtn.className = 'rr-btn danger';
    khongBtn.textContent = '🚪 Đi vắng! (Hát lại từ đầu)';
    khongBtn.addEventListener('click', () => driveAnswer('Không'));
    btnsWrap.appendChild(khongBtn);
  } else if (s.phase === 'chasing') {
    prompt.textContent = 'Thầy thuốc đuổi bắt khúc đuôi! Chọn tốc độ rượt đuổi:';

    const chamBtn = document.createElement('button');
    chamBtn.className = 'rr-btn';
    chamBtn.textContent = '🚶 Chậm (cham) [Thoát chắc]';
    chamBtn.addEventListener('click', () => driveChase('cham'));
    btnsWrap.appendChild(chamBtn);

    const vuaBtn = document.createElement('button');
    vuaBtn.className = 'rr-btn primary';
    vuaBtn.textContent = '🏃 Vừa (vua) [Bắt nếu dài ≥ 9]';
    vuaBtn.addEventListener('click', () => driveChase('vua'));
    btnsWrap.appendChild(vuaBtn);

    const nhanhBtn = document.createElement('button');
    nhanhBtn.className = 'rr-btn danger';
    nhanhBtn.textContent = '⚡ Nhanh (nhanh) [Bắt nếu dài ≥ 6]';
    nhanhBtn.addEventListener('click', () => driveChase('nhanh'));
    btnsWrap.appendChild(nhanhBtn);
  } else if (s.phase === 'resolved') {
    prompt.textContent = s.chaseResult === 'caught'
      ? 'Khúc đuôi đã bị bắt! Đuôi chuyển vai làm thầy thuốc mới.'
      : 'Rồng rắn đã thoát hiểm thành công!';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'rr-btn primary';
    nextBtn.textContent = '▶️ Vòng tiếp theo';
    nextBtn.addEventListener('click', () => driveNextRound());
    btnsWrap.appendChild(nextBtn);

    const restartBtn = document.createElement('button');
    restartBtn.className = 'rr-btn';
    restartBtn.textContent = '🔄 Đặt lại rồng rắn';
    restartBtn.addEventListener('click', () => driveStart(s.startingLength || 6));
    btnsWrap.appendChild(restartBtn);
  }
}

function renderResultOverlay(s: RongRanState): void {
  if (!rootEl) return;
  const overlay = document.createElement('div');
  overlay.className = 'rr-result-overlay';

  const isCaught = s.chaseResult === 'caught';
  const card = document.createElement('div');
  card.className = 'rr-result-card';
  card.innerHTML = `
    <div class="rr-result-icon">${isCaught ? '🎯' : '🎉'}</div>
    <div class="rr-result-title">${isCaught ? 'Đuôi Đã Bị Bắt!' : 'Thoát Hiểm Thành Công!'}</div>
    <div class="rr-result-desc">
      ${isCaught
        ? `Thầy thuốc đã chộp được khúc đuôi! Khúc đuôi trở thành thầy thuốc vòng tiếp theo, còn thầy thuốc cũ gia nhập đầu rồng rắn.`
        : `Rồng rắn luồn lách tài tình! Thầy thuốc không thể chạm tới khúc đuôi.`}
    </div>
    <div style="display:flex; justify-content:center; gap:8px;">
      <button class="rr-btn primary" id="rr-next-round-btn">▶️ Tiếp tục vòng ${s.round + 1}</button>
    </div>
  `;

  card.querySelector('#rr-next-round-btn')?.addEventListener('click', () => {
    overlay.remove();
    driveNextRound();
  });

  overlay.appendChild(card);
  rootEl.appendChild(overlay);
}

export function destroyRongRanScene(): void {
  if (bubbleTimer !== null) {
    window.clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }
  if (gsapCtx) {
    gsapCtx.revert();
    gsapCtx = null;
  }
  if (rootEl) {
    const styleEl = document.getElementById('rr-style');
    if (styleEl) styleEl.remove();
    rootEl.remove();
    rootEl = null;
  }
  state = createInitialState(6);
}
