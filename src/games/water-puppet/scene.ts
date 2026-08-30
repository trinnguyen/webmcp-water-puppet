import { gsap } from 'gsap';
import { reducedMotion } from '../../motion';
import { getWebMCPStatus } from '../../ui';

let rootEl: HTMLElement | null = null;
let gsapCtx: gsap.Context | null = null;
let rippleTimer: number | null = null;
let toastTimer: number | null = null;

const PUPPETS = [
  { id: 'teu', name: 'Chú Tễu', color: '#E53935' },
  { id: 'dragon', name: 'Rồng', color: '#F0A828' },
  { id: 'fish', name: 'Cá', color: '#2C8596' },
  { id: 'farmer', name: 'Nông dân', color: '#3F7D4E' },
];

const TEU_LINES = [
  'Đạo diễn ơi, rối tay em mỏi rồi!',
  'Cảnh này đẹp quá, đúng không nào?',
  'Sắp ra mắt rồi, hãy chờ nhé!',
];

function addRipple(): void {
  if (!rootEl || reducedMotion()) return;
  const water = rootEl.querySelector('.wp-water');
  if (!water) return;
  const ripple = document.createElement('div');
  ripple.className = 'wp-ripple';
  ripple.style.left = Math.random() * 80 + 10 + '%';
  ripple.style.top = Math.random() * 50 + 20 + '%';
  ripple.style.width = ripple.style.height = 18 + Math.random() * 14 + 'px';
  water.appendChild(ripple);
  window.setTimeout(() => ripple.remove(), 4000);
}

async function showTeuLine(): Promise<void> {
  const { showToast } = await import('../../ui');
  showToast(TEU_LINES[Math.floor(Math.random() * TEU_LINES.length)], 3200);
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
      min-height: 480px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: var(--font-body);
      user-select: none;
    }
    .wp-sky {
      flex: 1;
      background: linear-gradient(180deg,
        #3a2b4e 0%, #6b3a6e 30%, #c0524e 55%, #e8854a 75%, #f4b860 100%);
      position: relative;
    }
    .wp-water {
      position: relative;
      height: 42%;
      background: linear-gradient(180deg, var(--pond) 0%, var(--pond-deep) 100%);
      overflow: hidden;
    }
    .wp-water::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(90deg,
        transparent 0%, rgba(255,255,255,0.07) 25%, transparent 50%);
      background-size: 200% 100%;
      animation: wp-shimmer 6s linear infinite;
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
    }
    @keyframes wp-ripple-expand {
      0% { transform: scale(0); opacity: 0.6; }
      100% { transform: scale(8); opacity: 0; }
    }
    .wp-lantern {
      position: absolute;
      top: 6%;
      font-size: 1.6rem;
      animation: wp-sway 3s ease-in-out infinite alternate;
      transform-origin: top center;
    }
    @keyframes wp-sway {
      from { transform: rotate(-2deg); }
      to { transform: rotate(2deg); }
    }
    .wp-stage {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: flex-end;
      justify-content: space-around;
      padding: 0 8% 22%;
    }
    .wp-puppet {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 72px;
      animation: wp-bob 2.5s ease-in-out infinite alternate;
    }
    @keyframes wp-bob {
      from { transform: translateY(0); }
      to { transform: translateY(-8px); }
    }
    .wp-puppet img {
      width: 60px;
      height: 60px;
      filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));
    }
    .wp-stick {
      width: 3px;
      height: 34px;
      background: linear-gradient(180deg, var(--wood), var(--wood-deep));
      border-radius: 1px;
    }
    .wp-name {
      font-size: 0.62rem;
      font-weight: 700;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0,0,0,0.7);
      white-space: nowrap;
    }
    .wp-ribbon {
      position: absolute;
      top: 12px;
      right: -34px;
      transform: rotate(38deg);
      background: var(--lacquer);
      color: #FFF8EC;
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 0.75rem;
      padding: 4px 40px;
      box-shadow: var(--shadow-toy);
      z-index: 5;
    }
    .wp-note {
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--paper-bright);
      border: 2px solid var(--wood);
      border-radius: var(--r-pill);
      color: var(--ink-soft);
      font-size: 0.8rem;
      font-weight: 600;
      padding: 6px 16px;
      z-index: 5;
    }
    .wp-agent {
      position: absolute;
      top: calc(60px + env(safe-area-inset-top));
      right: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--ink);
      background: var(--paper-bright);
      border: 2px solid var(--wood);
      padding: 4px 12px;
      border-radius: var(--r-pill);
      z-index: 6;
    }
    .wp-agent .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--leaf);
    }
    .wp-agent .status-dot.offline { background: var(--marigold); }
    @media (prefers-reduced-motion: reduce) {
      .wp-water::after, .wp-lantern, .wp-puppet { animation: none; }
    }
  `;
  rootEl.appendChild(styleEl);

  const sky = document.createElement('div');
  sky.className = 'wp-sky';

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

  const water = document.createElement('div');
  water.className = 'wp-water';

  const stage = document.createElement('div');
  stage.className = 'wp-stage';
  for (let i = 0; i < PUPPETS.length; i++) {
    const p = PUPPETS[i];
    const puppet = document.createElement('div');
    puppet.className = 'wp-puppet';
    puppet.style.animationDelay = (i * 0.4) + 's';
    const img = document.createElement('img');
    img.src = `assets/puppets/${p.id}.svg`;
    img.alt = p.name;
    img.draggable = false;
    const stick = document.createElement('div');
    stick.className = 'wp-stick';
    const name = document.createElement('div');
    name.className = 'wp-name';
    name.textContent = p.name;
    puppet.appendChild(img);
    puppet.appendChild(stick);
    puppet.appendChild(name);
    stage.appendChild(puppet);
  }
  water.appendChild(stage);
  rootEl.appendChild(water);

  const ribbon = document.createElement('div');
  ribbon.className = 'wp-ribbon';
  ribbon.textContent = 'Sắp ra mắt';
  rootEl.appendChild(ribbon);

  const note = document.createElement('div');
  note.className = 'wp-note';
  note.textContent = 'Chế độ xem thử — Coming soon';
  rootEl.appendChild(note);

  const agent = document.createElement('div');
  agent.className = 'wp-agent';
  agent.setAttribute('data-role', 'webmcp-pill');
  const agentStatus = getWebMCPStatus();
  agent.innerHTML = `<span class="status-dot ${agentStatus.status === 'online' ? '' : 'offline'}"></span><span class="pill-text">WebMCP: ${agentStatus.text}</span>`;
  rootEl.appendChild(agent);

  gsapCtx = gsap.context(() => {}, rootEl);

  container.appendChild(rootEl);

  if (!reducedMotion()) {
    rippleTimer = window.setInterval(addRipple, 900);
    toastTimer = window.setTimeout(() => {
      void showTeuLine();
      toastTimer = window.setInterval(() => void showTeuLine(), 8000);
    }, 2500);
  }
}

export function destroyWaterPuppetScene(): void {
  if (rippleTimer !== null) {
    window.clearInterval(rippleTimer);
    rippleTimer = null;
  }
  if (toastTimer !== null) {
    window.clearInterval(toastTimer);
    toastTimer = null;
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
}
