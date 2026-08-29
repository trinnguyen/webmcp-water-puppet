import * as THREE from 'three';
import { gsap } from 'gsap';
import {
  BauCuaSymbol,
  SYMBOLS,
  SYMBOL_NAMES,
  BauCuaState,
  createBauCuaGame,
  placeBet,
  rollDice,
  resolveBets,
} from './rules';
import { playSFX } from '../../audio';

let state: BauCuaState = createBauCuaGame();
let rootEl: HTMLElement | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let frameId = 0;
let diceMeshes: THREE.Mesh[] = [];
let gsapCtx: gsap.Context | null = null;
let resizeObserver: ResizeObserver | null = null;

let pointsEl: HTMLElement | null = null;
let roundEl: HTMLElement | null = null;
let resultEl: HTMLElement | null = null;
let rollBtn: HTMLButtonElement | null = null;
const betBadges = new Map<BauCuaSymbol, HTMLElement>();
const symButtons = new Map<BauCuaSymbol, HTMLElement>();
let stakeButtons: HTMLButtonElement[] = [];
let currentStake = 10;
let isRolling = false;

function loadSavedState(): BauCuaState {
  try {
    const raw = localStorage.getItem('san_choi_baucua');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.playerPoints === 'number' &&
        Array.isArray(parsed.bets) &&
        typeof parsed.roundNumber === 'number' &&
        parsed.roundNumber > 0 &&
        (parsed.status === 'betting' ||
          parsed.status === 'rolled' ||
          parsed.status === 'resolved')
      ) {
        return parsed as BauCuaState;
      }
    }
  } catch {
    // Fall back to new game on parse error
  }
  return createBauCuaGame();
}

function saveState(): void {
  try {
    localStorage.setItem('san_choi_baucua', JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Creates a canvas texture for a given Bầu Cua symbol emoji on a dice face.
 */
function dieTexture(symbol: BauCuaSymbol): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fff8e1';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = '#d7ccc8';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 122, 122);

    ctx.font =
      '72px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SYMBOL_NAMES[symbol].emoji, 64, 66);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Builds a 3D die mesh with all 6 Bầu Cua symbol face materials.
 * Face order:
 *  0: +X -> 'bau'
 *  1: -X -> 'cua'
 *  2: +Y -> 'tom'
 *  3: -Y -> 'ca'
 *  4: +Z -> 'ga'
 *  5: -Z -> 'huou'
 */
function buildDie(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(0.85, 0.85, 0.85);
  const materials = SYMBOLS.map(
    (sym) =>
      new THREE.MeshStandardMaterial({
        map: dieTexture(sym),
        roughness: 0.35,
        metalness: 0.05,
      })
  );

  return new THREE.Mesh(geometry, materials);
}

/**
 * Calculates target rotation to orient the die with the specified symbol face facing upwards (+Y).
 */
function getTargetRotation(symbol: BauCuaSymbol): {
  x: number;
  y: number;
  z: number;
} {
  switch (symbol) {
    case 'bau': // Face 0 (+X) -> rotate +Z by PI/2
      return { x: 0, y: 0, z: Math.PI / 2 };
    case 'cua': // Face 1 (-X) -> rotate -Z by PI/2
      return { x: 0, y: 0, z: -Math.PI / 2 };
    case 'tom': // Face 2 (+Y) -> already top face
      return { x: 0, y: 0, z: 0 };
    case 'ca': // Face 3 (-Y) -> rotate X by PI
      return { x: Math.PI, y: 0, z: 0 };
    case 'ga': // Face 4 (+Z) -> rotate -X by PI/2
      return { x: -Math.PI / 2, y: 0, z: 0 };
    case 'huou': // Face 5 (-Z) -> rotate +X by PI/2
      return { x: Math.PI / 2, y: 0, z: 0 };
  }
}

function updateBauCuaView(view: BauCuaState): void {
  if (pointsEl) {
    pointsEl.textContent = String(view.playerPoints);
  }
  if (roundEl) {
    roundEl.textContent = String(view.roundNumber);
  }

  const totalStaked = view.bets.reduce((sum, b) => sum + b.points, 0);

  for (const sym of SYMBOLS) {
    const badge = betBadges.get(sym);
    const btn = symButtons.get(sym);
    const bet = view.bets.find((b) => b.symbol === sym);

    if (badge) {
      if (bet && bet.points > 0) {
        badge.textContent = `${bet.points}`;
        badge.style.display = 'block';
      } else {
        badge.textContent = '';
        badge.style.display = 'none';
      }
    }

    if (btn) {
      if (bet && bet.points > 0) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }

  for (const btn of stakeButtons) {
    const stakeVal = Number(btn.getAttribute('data-stake'));
    btn.classList.toggle('active', stakeVal === currentStake);
  }

  if (rollBtn) {
    if (view.status === 'betting' && view.bets.length > 0 && !isRolling) {
      rollBtn.removeAttribute('disabled');
    } else {
      rollBtn.setAttribute('disabled', 'true');
    }
  }

  if (resultEl && !isRolling) {
    if (view.status === 'betting') {
      if (totalStaked > 0) {
        resultEl.textContent = `Đã cược: ${totalStaked} điểm. Nhấn Lắc!`;
      } else {
        resultEl.textContent = 'Đặt cược vào các ô rồi bấm Lắc!';
      }
    }
  }
}

function animateWinnings(amount: number): Promise<void> {
  return new Promise<void>((resolve) => {
    playSFX('coin');
    if (!rootEl) {
      resolve();
      return;
    }
    const badge = document.createElement('div');
    badge.className = 'bau-floating-win';
    badge.textContent = `+${amount}`;
    rootEl.appendChild(badge);

    gsap.fromTo(
      badge,
      { y: 0, opacity: 1, scale: 0.8 },
      {
        y: -60,
        opacity: 0,
        scale: 1.4,
        duration: 0.9,
        ease: 'power2.out',
        onComplete: () => {
          badge.remove();
          resolve();
        },
      }
    );
  });
}

function animateLoss(amount: number): Promise<void> {
  return new Promise<void>((resolve) => {
    playSFX('sneeze');
    if (!rootEl) {
      resolve();
      return;
    }
    const badge = document.createElement('div');
    badge.className = 'bau-floating-loss';
    badge.textContent = `-${amount}`;
    rootEl.appendChild(badge);

    gsap.fromTo(
      badge,
      { y: 0, opacity: 1, scale: 0.8 },
      {
        y: 45,
        opacity: 0,
        scale: 1.2,
        duration: 0.8,
        ease: 'power2.in',
        onComplete: () => {
          badge.remove();
          resolve();
        },
      }
    );
  });
}

function animateDiceRoll(results: BauCuaSymbol[]): Promise<void> {
  return new Promise<void>((resolve) => {
    playSFX('dice_roll');

    const promises = diceMeshes.map((mesh, i) => {
      return new Promise<void>((dieResolve) => {
        const targetRot = getTargetRotation(results[i]);
        const extraX = (2 + Math.floor(Math.random() * 2)) * Math.PI * 2;
        const extraY = (2 + Math.floor(Math.random() * 2)) * Math.PI * 2;
        const extraZ = (2 + Math.floor(Math.random() * 2)) * Math.PI * 2;

        const peakY = 0.85 + Math.random() * 0.3;

        gsap.to(mesh.position, {
          y: peakY,
          duration: 0.45,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            mesh.position.y = 0;
          },
        });

        gsap.to(mesh.rotation, {
          x: targetRot.x + extraX,
          y: targetRot.y + extraY,
          z: targetRot.z + extraZ,
          duration: 1.0 + i * 0.1,
          ease: 'power3.out',
          onComplete: () => {
            mesh.rotation.x = targetRot.x;
            mesh.rotation.y = targetRot.y;
            mesh.rotation.z = targetRot.z;
            dieResolve();
          },
        });
      });
    });

    void Promise.all(promises).then(() => {
      if (results[0] === results[1] && results[1] === results[2]) {
        if (resultEl) {
          resultEl.textContent = '🎉 XỐC! BA CON! 🎉';
        }
        if (rootEl) {
          gsap.fromTo(
            rootEl,
            { x: -10 },
            {
              x: 10,
              duration: 0.05,
              repeat: 7,
              yoyo: true,
              onComplete: () => {
                if (rootEl) {
                  gsap.set(rootEl, { x: 0 });
                }
              },
            }
          );
        }
      }
      resolve();
    });
  });
}

export function getBauCuaState(): BauCuaState {
  return state;
}

export function resetBauCua(): void {
  state = createBauCuaGame();
  saveState();
  updateBauCuaView(state);
}

export function placeBauCuaBet(
  symbol: BauCuaSymbol,
  points: number
): BauCuaState {
  if (state.status !== 'betting' || isRolling) return state;
  state = placeBet(state, symbol, points);
  saveState();
  updateBauCuaView(state);
  return state;
}

export async function rollBauCuaDice(): Promise<BauCuaState> {
  if (state.status !== 'betting' || state.bets.length === 0 || isRolling) {
    return state;
  }
  isRolling = true;
  state = rollDice(state);
  updateBauCuaView(state);

  if (state.lastRoll) {
    await animateDiceRoll(state.lastRoll);
  }

  isRolling = false;
  return state;
}

export async function resolveBauCua(): Promise<BauCuaState> {
  if (state.status !== 'rolled') return state;

  const before = state.playerPoints;
  state = resolveBets(state);
  const net = state.playerPoints - before;

  if (net > 0) {
    await animateWinnings(net);
  } else if (net < 0) {
    await animateLoss(-net);
  }

  if (resultEl) {
    resultEl.textContent =
      net > 0
        ? `🎉 Thắng +${net} điểm!`
        : net < 0
          ? `😢 Mất ${-net} điểm`
          : '🤝 Hòa điểm';
  }

  saveState();
  updateBauCuaView(state);
  return state;
}

export function buildBauCuaScene(container: HTMLElement): void {
  destroyBauCuaScene();

  state = loadSavedState();
  isRolling = false;

  rootEl = document.createElement('div');
  rootEl.className = 'bau-root';

  const styleEl = document.createElement('style');
  styleEl.id = 'bau-cua-style';
  styleEl.textContent = `
    .bau-root {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      height: 100%;
      min-height: 520px;
      padding: 0.75rem;
      box-sizing: border-box;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff8e1;
      user-select: none;
      position: relative;
      overflow: hidden;
      background: radial-gradient(circle at center, #2e1c14 0%, #150c08 100%);
    }
    .bau-canvas {
      position: relative;
      width: 100%;
      height: 50%;
      min-height: 240px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bau-top {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 1.5rem;
      align-items: center;
      justify-content: center;
      padding: 0.45rem 1.4rem;
      background: rgba(0, 0, 0, 0.55);
      border: 1px solid rgba(255, 213, 79, 0.35);
      border-radius: 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(6px);
      z-index: 10;
      font-size: 0.95rem;
      font-weight: 600;
    }
    .bau-pill {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .bau-points-val, .bau-round-val {
      color: #ffd54f;
      font-weight: 700;
      font-size: 1.1rem;
    }
    .bau-controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.65rem;
      width: 100%;
      max-width: 580px;
      z-index: 10;
    }
    .bau-result {
      font-size: 1.05rem;
      font-weight: 700;
      color: #ffd54f;
      min-height: 1.3em;
      text-align: center;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
    }
    .bau-mat {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 0.5rem;
      width: 100%;
    }
    .bau-sym-btn {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #4e342e;
      border: 2px solid #bcaaa4;
      border-radius: 14px;
      padding: 0.6rem 0.4rem;
      cursor: pointer;
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
      color: #fff8e1;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
    }
    .bau-sym-btn:hover {
      background: #5d4037;
      border-color: #ffd54f;
      transform: translateY(-2px);
    }
    .bau-sym-btn:active {
      transform: translateY(1px);
    }
    .bau-sym-btn.active {
      border-color: #4caf50;
      background: #3e2723;
      box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
    }
    .bau-sym-emoji {
      font-size: 1.85rem;
      line-height: 1;
      margin-bottom: 2px;
    }
    .bau-sym-name {
      font-size: 0.85rem;
      font-weight: 600;
    }
    .bau-bet-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      background: #ffd54f;
      color: #212121;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
      display: none;
      border: 1px solid #fff;
    }
    .bau-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .bau-stake {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .bau-stake-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #d7ccc8;
      margin-right: 2px;
    }
    .bau-stake-btn {
      padding: 0.35rem 0.65rem;
      border-radius: 12px;
      background: #3e2723;
      border: 1px solid #8d6e63;
      color: #d7ccc8;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .bau-stake-btn:hover {
      background: #4e342e;
    }
    .bau-stake-btn.active {
      background: #ffd54f;
      color: #212121;
      border-color: #ffecb3;
      box-shadow: 0 0 8px rgba(255, 213, 79, 0.4);
    }
    .bau-btn-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .bau-clear-btn {
      padding: 0.55rem 0.9rem;
      border-radius: 14px;
      background: #37474f;
      border: 1px solid #78909c;
      color: #eceff1;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
    }
    .bau-clear-btn:hover {
      background: #455a64;
      transform: translateY(-1px);
    }
    .bau-clear-btn:active {
      transform: translateY(1px);
    }
    .bau-roll {
      padding: 0.6rem 1.6rem;
      font-size: 1.05rem;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
      border: 2px solid #ffd54f;
      border-radius: 20px;
      cursor: pointer;
      box-shadow: 0 4px 10px rgba(183, 28, 28, 0.5);
      transition: all 0.15s ease;
    }
    .bau-roll:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba(183, 28, 28, 0.7);
    }
    .bau-roll:active:not(:disabled) {
      transform: translateY(1px);
    }
    .bau-roll:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    .bau-floating-win {
      position: absolute;
      top: 35%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 2.4rem;
      font-weight: 800;
      color: #ffd54f;
      text-shadow: 0 0 14px rgba(255, 213, 79, 0.8), 0 2px 6px rgba(0,0,0,0.8);
      pointer-events: none;
      z-index: 100;
    }
    .bau-floating-loss {
      position: absolute;
      top: 35%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 2.2rem;
      font-weight: 800;
      color: #ef5350;
      text-shadow: 0 0 14px rgba(239, 83, 80, 0.8), 0 2px 6px rgba(0,0,0,0.8);
      pointer-events: none;
      z-index: 100;
    }
  `;
  rootEl.appendChild(styleEl);

  // Top info overlay
  const topEl = document.createElement('div');
  topEl.className = 'bau-top';
  topEl.innerHTML = `
    <div class="bau-pill">🎯 Điểm: <span class="bau-points-val" data-role="points">${state.playerPoints}</span></div>
    <div class="bau-pill">🎲 Vòng: <span class="bau-round-val" data-role="round">${state.roundNumber}</span></div>
  `;
  pointsEl = topEl.querySelector('[data-role="points"]');
  roundEl = topEl.querySelector('[data-role="round"]');
  rootEl.appendChild(topEl);

  // Canvas area
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'bau-canvas';
  rootEl.appendChild(canvasWrap);

  // Three.js setup
  scene = new THREE.Scene();
  const initialWidth = container.clientWidth || 600;
  const initialHeight = Math.max(260, Math.floor(container.clientHeight * 0.5));

  camera = new THREE.PerspectiveCamera(
    45,
    initialWidth / initialHeight,
    0.1,
    100
  );
  camera.position.set(0, 2.4, 4.4);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(initialWidth, initialHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  canvasWrap.appendChild(renderer.domElement);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xfff3e0, 1.2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
  dirLight.position.set(3, 6, 4);
  scene.add(dirLight);

  const pointLight = new THREE.PointLight(0xffd54f, 0.6, 10);
  pointLight.position.set(0, 2, 2);
  scene.add(pointLight);

  // 3 Dice meshes
  diceMeshes = [];
  const positions = [-1.3, 0, 1.3];
  for (let i = 0; i < 3; i++) {
    const die = buildDie();
    die.position.set(positions[i], 0, 0);
    scene.add(die);
    diceMeshes.push(die);
  }

  // Render loop
  function renderLoop() {
    if (!renderer || !scene || !camera) return;
    if (state.status === 'betting' && !isRolling) {
      for (let i = 0; i < diceMeshes.length; i++) {
        diceMeshes[i].rotation.y += 0.003 * (i % 2 === 0 ? 1 : -1);
      }
    }
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(renderLoop);
  }
  frameId = requestAnimationFrame(renderLoop);

  // ResizeObserver for canvas
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      if (w > 0 && h > 0 && renderer && camera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    }
  });
  resizeObserver.observe(canvasWrap);

  // Controls UI
  const controlsEl = document.createElement('div');
  controlsEl.className = 'bau-controls';

  resultEl = document.createElement('div');
  resultEl.className = 'bau-result';
  resultEl.textContent = 'Đặt cược vào các ô rồi bấm Lắc!';
  controlsEl.appendChild(resultEl);

  // 6 symbol buttons grid
  const matEl = document.createElement('div');
  matEl.className = 'bau-mat';
  betBadges.clear();
  symButtons.clear();

  for (const sym of SYMBOLS) {
    const btn = document.createElement('button');
    btn.className = 'bau-sym-btn';
    btn.setAttribute('data-sym', sym);

    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'bau-sym-emoji';
    emojiSpan.textContent = SYMBOL_NAMES[sym].emoji;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'bau-sym-name';
    nameSpan.textContent = SYMBOL_NAMES[sym].vi;

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'bau-bet-badge';

    btn.appendChild(emojiSpan);
    btn.appendChild(nameSpan);
    btn.appendChild(badgeSpan);

    btn.addEventListener('click', () => {
      placeBauCuaBet(sym, currentStake);
    });

    betBadges.set(sym, badgeSpan);
    symButtons.set(sym, btn);
    matEl.appendChild(btn);
  }
  controlsEl.appendChild(matEl);

  // Bottom action bar
  const actionsEl = document.createElement('div');
  actionsEl.className = 'bau-actions';

  // Stake selector
  const stakeEl = document.createElement('div');
  stakeEl.className = 'bau-stake';
  const stakeLabel = document.createElement('span');
  stakeLabel.className = 'bau-stake-label';
  stakeLabel.textContent = 'Cược:';
  stakeEl.appendChild(stakeLabel);

  stakeButtons = [];
  const stakes = [5, 10, 20];
  for (const val of stakes) {
    const sBtn = document.createElement('button');
    sBtn.className = `bau-stake-btn ${val === currentStake ? 'active' : ''}`;
    sBtn.setAttribute('data-stake', String(val));
    sBtn.textContent = `${val}`;
    sBtn.addEventListener('click', () => {
      currentStake = val;
      updateBauCuaView(state);
    });
    stakeButtons.push(sBtn);
    stakeEl.appendChild(sBtn);
  }
  actionsEl.appendChild(stakeEl);

  // Action buttons
  const btnGroup = document.createElement('div');
  btnGroup.className = 'bau-btn-group';

  const clearBtn = document.createElement('button');
  clearBtn.className = 'bau-clear-btn';
  clearBtn.textContent = '🧹 Xóa cược';
  clearBtn.addEventListener('click', () => {
    if (state.status !== 'betting' || isRolling) return;
    state.bets = [];
    saveState();
    updateBauCuaView(state);
  });
  btnGroup.appendChild(clearBtn);

  rollBtn = document.createElement('button');
  rollBtn.className = 'bau-roll';
  rollBtn.textContent = '🎲 Lắc Xúc Xắc';
  rollBtn.addEventListener('click', async () => {
    if (state.status !== 'betting' || state.bets.length === 0 || isRolling) {
      return;
    }
    await rollBauCuaDice();
    await resolveBauCua();
  });
  btnGroup.appendChild(rollBtn);

  actionsEl.appendChild(btnGroup);
  controlsEl.appendChild(actionsEl);
  rootEl.appendChild(controlsEl);

  gsapCtx = gsap.context(() => {}, rootEl);

  updateBauCuaView(state);
  container.appendChild(rootEl);
}

export function destroyBauCuaScene(): void {
  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (gsapCtx) {
    gsapCtx.revert();
    gsapCtx = null;
  }
  if (diceMeshes.length > 0) {
    for (const mesh of diceMeshes) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        for (const mat of mesh.material) {
          const stdMat = mat as THREE.MeshStandardMaterial;
          if (stdMat.map) {
            stdMat.map.dispose();
          }
          stdMat.dispose();
        }
      }
    }
    diceMeshes = [];
  }
  if (renderer) {
    renderer.dispose();
    if (renderer.domElement && renderer.domElement.parentElement) {
      renderer.domElement.remove();
    }
    renderer = null;
  }
  scene = null;
  camera = null;

  if (rootEl) {
    const styleEl = document.getElementById('bau-cua-style');
    if (styleEl) {
      styleEl.remove();
    }
    rootEl.remove();
    rootEl = null;
  }

  pointsEl = null;
  roundEl = null;
  resultEl = null;
  rollBtn = null;
  betBadges.clear();
  symButtons.clear();
  stakeButtons = [];
  isRolling = false;
}
