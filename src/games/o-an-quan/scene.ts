import { gsap } from 'gsap';
import {
  OAQBoard,
  createBoard,
  isValidMove,
  executeMove,
  getScore,
  boardToJSON,
} from './rules';
import { playSFX } from '../../audio';
import { reducedMotion } from '../../motion';

let board: OAQBoard = createBoard();
let rootEl: HTMLElement | null = null;
let gsapCtx: gsap.Context | null = null;
let clickEnabled = true;
const pitEls: HTMLElement[] = new Array(12);

let score1El: HTMLElement | null = null;
let score2El: HTMLElement | null = null;
let turnEl: HTMLElement | null = null;

const CIRC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function nextInCirc(i: number): number {
  return CIRC[(CIRC.indexOf(i) + 1) % CIRC.length];
}

function loadSavedState(): OAQBoard {
  try {
    const raw = localStorage.getItem('san_choi_oaq');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        Array.isArray(parsed.pits) &&
        parsed.pits.length === 12 &&
        Array.isArray(parsed.captured) &&
        parsed.captured.length === 2 &&
        (parsed.currentPlayer === 1 || parsed.currentPlayer === 2)
      ) {
        return parsed as OAQBoard;
      }
    }
  } catch {
    // Fall back to default board on parse error
  }
  return createBoard();
}

function saveState(): void {
  try {
    localStorage.setItem('san_choi_oaq', boardToJSON(board));
  } catch {
    // Ignore storage errors
  }
}

function computeSowingTrace(
  startBoard: OAQBoard,
  pitIndex: number
): { path: number[]; counts: number[]; capturedPits: number[] } {
  const tempPits = [...startBoard.pits];
  const path: number[] = [];
  const counts: number[] = [];
  const capturedPits: number[] = [];

  let seeds = tempPits[pitIndex];
  tempPits[pitIndex] = 0;
  let pos = pitIndex;

  while (seeds > 0) {
    pos = nextInCirc(pos);
    tempPits[pos] += 1;
    seeds -= 1;
    path.push(pos);
    counts.push(tempPits[pos]);
  }

  while (true) {
    const isSmall = (pos >= 0 && pos <= 4) || (pos >= 6 && pos <= 10);
    if (isSmall && tempPits[pos] > 1) {
      seeds = tempPits[pos];
      tempPits[pos] = 0;
      while (seeds > 0) {
        pos = nextInCirc(pos);
        tempPits[pos] += 1;
        seeds -= 1;
        path.push(pos);
        counts.push(tempPits[pos]);
      }
    } else {
      break;
    }
  }

  const land = pos;
  const nextPit = nextInCirc(land);
  const isNextSmall =
    (nextPit >= 0 && nextPit <= 4) || (nextPit >= 6 && nextPit <= 10);

  if (isNextSmall && tempPits[nextPit] === 0) {
    let capturePos = nextInCirc(nextPit);
    while (true) {
      const srcIsSmall =
        (capturePos >= 0 && capturePos <= 4) ||
        (capturePos >= 6 && capturePos <= 10);
      if (srcIsSmall && tempPits[capturePos] > 0) {
        capturedPits.push(capturePos);
        tempPits[capturePos] = 0;
        const nn = nextInCirc(capturePos);
        const nnIsSmall = (nn >= 0 && nn <= 4) || (nn >= 6 && nn <= 10);
        if (nnIsSmall && tempPits[nn] === 0) {
          capturePos = nextInCirc(nn);
          continue;
        }
        break;
      } else {
        break;
      }
    }
  }

  return { path, counts, capturedPits };
}

function renderPitSeeds(pitEl: HTMLElement, count: number): void {
  pitEl.innerHTML = '';

  const countBadge = document.createElement('span');
  countBadge.className = 'oaq-pit-count';
  countBadge.textContent = String(count);
  pitEl.appendChild(countBadge);

  const seedsContainer = document.createElement('div');
  seedsContainer.className = 'oaq-seeds-wrap';

  const displayCount = Math.min(count, 20);
  for (let i = 0; i < displayCount; i++) {
    const seed = document.createElement('div');
    seed.className = 'o-seed';
    seedsContainer.appendChild(seed);
  }

  if (count > 20) {
    const more = document.createElement('span');
    more.className = 'oaq-seeds-more';
    more.textContent = `+${count - 20}`;
    seedsContainer.appendChild(more);
  }

  pitEl.appendChild(seedsContainer);
}

export function updateBoardView(currentBoard: OAQBoard): void {
  for (let i = 0; i < 12; i++) {
    const pitEl = pitEls[i];
    if (pitEl) {
      renderPitSeeds(pitEl, currentBoard.pits[i]);
      if (i === 5 || i === 11) {
        pitEl.setAttribute('data-empty', currentBoard.pits[i] === 0 ? 'true' : 'false');
      }
      if (
        (i >= 0 && i <= 4 && currentBoard.currentPlayer === 1) ||
        (i >= 6 && i <= 10 && currentBoard.currentPlayer === 2)
      ) {
        pitEl.removeAttribute('data-disabled');
      } else {
        pitEl.setAttribute('data-disabled', 'true');
      }
    }
  }

  const scores = getScore(currentBoard);
  if (score1El) {
    score1El.textContent = String(scores.p1);
  }
  if (score2El) {
    score2El.textContent = String(scores.p2);
  }

  if (turnEl) {
    if (currentBoard.status === 'finished') {
      if (currentBoard.winner === 1) {
        turnEl.textContent = 'Kết thúc! Người 1 thắng';
      } else if (currentBoard.winner === 2) {
        turnEl.textContent = 'Kết thúc! Người 2 thắng';
      } else {
        turnEl.textContent = 'Kết thúc! Hòa';
      }
    } else {
      turnEl.textContent =
        currentBoard.currentPlayer === 1
          ? 'Lượt: Người chơi 1'
          : 'Lượt: Người chơi 2';
    }
  }

  const row1 = rootEl?.querySelector('.oaq-row-1');
  const row2 = rootEl?.querySelector('.oaq-row-2');
  if (row1 && row2) {
    if (currentBoard.status === 'playing') {
      row1.classList.toggle('active', currentBoard.currentPlayer === 1);
      row2.classList.toggle('active', currentBoard.currentPlayer === 2);
    } else {
      row1.classList.remove('active');
      row2.classList.remove('active');
    }
  }
}

export function animateSowing(
  pitSequence: number[],
  _seedCounts: number[]
): Promise<void> {
  return new Promise((resolve) => {
    if (!rootEl || pitSequence.length === 0 || reducedMotion()) {
      resolve();
      return;
    }

    const rootRect = rootEl.getBoundingClientRect();
    const flyingSeed = document.createElement('div');
    flyingSeed.className = 'oaq-flying-seed';
    rootEl.appendChild(flyingSeed);

    const firstPitEl = pitEls[pitSequence[0]];
    if (firstPitEl) {
      const pRect = firstPitEl.getBoundingClientRect();
      const startX = pRect.left + pRect.width / 2 - rootRect.left - 6;
      const startY = pRect.top + pRect.height / 2 - rootRect.top - 6;
      gsap.set(flyingSeed, { x: startX, y: startY, opacity: 1, scale: 1 });
    }

    const hopDuration = Math.max(0.04, Math.min(0.12, 1.2 / pitSequence.length));
    const tl = gsap.timeline({
      onComplete: () => {
        flyingSeed.remove();
        resolve();
      },
    });

    for (let i = 0; i < pitSequence.length; i++) {
      const pitIdx = pitSequence[i];
      const pitEl = pitEls[pitIdx];
      if (!pitEl) continue;

      const pRect = pitEl.getBoundingClientRect();
      const targetX = pRect.left + pRect.width / 2 - rootRect.left - 6;
      const targetY = pRect.top + pRect.height / 2 - rootRect.top - 6;

      tl.to(flyingSeed, {
        x: targetX,
        y: targetY,
        duration: hopDuration,
        ease: 'power1.inOut',
      });
    }
  });
}

export function animateCapture(
  fromPit: number,
  toPlayer: 1 | 2,
  seedCount: number
): Promise<void> {
  return new Promise((resolve) => {
    if (!rootEl || reducedMotion()) {
      playSFX('capture');
      resolve();
      return;
    }

    const rootRect = rootEl.getBoundingClientRect();
    const sourceEl = pitEls[fromPit];
    const targetScoreEl = toPlayer === 1 ? score1El : score2El;

    if (!sourceEl || !targetScoreEl) {
      playSFX('capture');
      resolve();
      return;
    }

    const sRect = sourceEl.getBoundingClientRect();
    const tRect = targetScoreEl.getBoundingClientRect();

    const startX = sRect.left + sRect.width / 2 - rootRect.left - 6;
    const startY = sRect.top + sRect.height / 2 - rootRect.top - 6;
    const targetX = tRect.left + tRect.width / 2 - rootRect.left - 6;
    const targetY = tRect.top + tRect.height / 2 - rootRect.top - 6;

    const clumpCount = Math.min(Math.max(seedCount, 1), 6);
    const clumpSeeds: HTMLElement[] = [];

    for (let i = 0; i < clumpCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'oaq-flying-seed';
      rootEl.appendChild(dot);
      clumpSeeds.push(dot);
      const offsetX = (Math.random() - 0.5) * 16;
      const offsetY = (Math.random() - 0.5) * 16;
      gsap.set(dot, {
        x: startX + offsetX,
        y: startY + offsetY,
        opacity: 1,
        scale: 1,
      });
    }

    gsap.to(clumpSeeds, {
      x: targetX,
      y: targetY,
      duration: 0.45,
      stagger: 0.04,
      ease: 'power2.inOut',
      onComplete: () => {
        for (const dot of clumpSeeds) {
          dot.remove();
        }
        playSFX('capture');
        resolve();
      },
    });
  });
}

export function getBoard(): OAQBoard {
  return board;
}

export function resetBoard(): void {
  board = createBoard();
  saveState();
  updateBoardView(board);
}

export async function driveMove(pitIndex: number, isAgent: boolean = false): Promise<OAQBoard> {
  if (!clickEnabled) {
    throw new Error('Busy');
  }
  if (!isValidMove(board, pitIndex)) {
    throw new Error('Invalid move: pit is empty or not yours');
  }

  clickEnabled = false;
  try {
    const oldBoard = board;
    const mover = oldBoard.currentPlayer;
    const trace = computeSowingTrace(oldBoard, pitIndex);

    board = executeMove(board, pitIndex);

    await animateSowing(trace.path, trace.counts);

    const oldScore = mover === 1 ? oldBoard.captured[0] : oldBoard.captured[1];
    const newScore = mover === 1 ? board.captured[0] : board.captured[1];
    const gained = newScore - oldScore;

    if (gained > 0) {
      const fromPit =
        trace.capturedPits.length > 0 ? trace.capturedPits[0] : pitIndex;
      await animateCapture(fromPit, mover, gained);
    } else if (isAgent) {
      // Weak move grumble
      const targetPit = pitEls[pitIndex];
      if (targetPit && !reducedMotion()) {
        gsap.fromTo(targetPit, { rotation: -10 }, { rotation: 10, yoyo: true, repeat: 5, duration: 0.1, clearProps: 'rotation' });
      }
      const { showToast } = await import('../../ui');
      showToast('Bước cờ yếu quá, Tễu chê!');
    }

    updateBoardView(board);
    saveState();

    if (isAgent && turnEl && board.status === 'playing') {
      turnEl.textContent += ' 🤖';
    }
    
    if (oldBoard.status === 'playing' && board.status === 'finished') {
      import('../../hub').then(h => h.markGameCompleted('o-an-quan'));
      const { showResultOverlay } = await import('../../ui');
      const scores = getScore(board);
      const title =
        board.winner === 1
          ? 'Người 1 thắng! 🎉'
          : board.winner === 2
            ? 'Người 2 thắng! 🎉'
            : 'Hòa rồi!';
      showResultOverlay({
        title,
        sub: `Điểm: ${scores.p1} — ${scores.p2}`,
        win: board.winner !== 0,
        onReplay: () => resetBoard(),
        onHome: () => {
          import('../../hub').then(h => h.returnToHub());
        },
      });
    }

    return board;
  } finally {
    clickEnabled = true;
  }
}

async function handlePitClick(pitIndex: number): Promise<void> {
  if (!clickEnabled || !isValidMove(board, pitIndex)) return;
  try {
    await driveMove(pitIndex, false);
  } catch {
    // ignore
  }
}

export function buildOAQScene(container: HTMLElement): void {
  destroyOAQScene();

  clickEnabled = true;
  board = loadSavedState();

  rootEl = document.createElement('div');
  rootEl.className = 'oaq-root';

  const styleEl = document.createElement('style');
  styleEl.id = 'oaq-style';
  styleEl.textContent = `
    .oaq-root {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 480px;
      padding: 5rem 1.25rem 1.25rem;
      box-sizing: border-box;
      font-family: var(--font-body);
      color: var(--ink);
      user-select: none;
      position: relative;
    }
    .oaq-turn {
      font-family: var(--font-display);
      font-size: 1.1rem;
      font-weight: 800;
      margin-bottom: 1rem;
      padding: 0.5rem 1.4rem;
      background: var(--paper-bright);
      border: 2px solid var(--wood);
      border-radius: var(--r-pill);
      box-shadow: var(--shadow-paper);
      color: var(--ink);
      line-height: 1.3;
    }
    .oaq-turn::before {
      content: '';
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--leaf);
      margin-right: 6px;
      vertical-align: middle;
    }
    .oaq-board {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      background: var(--paper-deep);
      padding: 1.25rem;
      border-radius: var(--r-board);
      box-shadow: inset 0 2px 8px rgba(89,55,31,0.25), var(--shadow-paper);
      border: 4px solid var(--wood);
      max-width: 680px;
      width: min(94vw, 680px);
      box-sizing: border-box;
      position: relative;
    }
    .oaq-score {
      font-family: var(--font-display);
      font-size: 1.05rem;
      font-weight: 800;
      color: var(--ink);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      line-height: 1.3;
    }
    .oaq-score-val {
      display: inline-block;
      min-width: 2.2rem;
      padding: 0.2rem 0.6rem;
      background: var(--paper-bright);
      border: 2px solid var(--wood);
      color: var(--ink);
      border-radius: var(--r-pill);
      text-align: center;
      font-weight: 800;
      box-shadow: 0 2px 0 var(--wood);
    }
    .oaq-play-area {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      width: 100%;
    }
    .oaq-seed-pits {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      flex: 1;
    }
    .oaq-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.5rem;
      padding: 0.5rem;
      border-radius: 16px;
      background: rgba(89,55,31,0.08);
      transition: background var(--dur-std), box-shadow var(--dur-std);
    }
    .oaq-row.active {
      background: rgba(240,168,40,0.22);
      box-shadow: 0 0 0 2px var(--marigold);
    }
    .o-pit {
      background: var(--paper-bright);
      border: 2px solid var(--wood);
      border-radius: 50%;
      aspect-ratio: 1 / 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
      box-shadow: inset 0 3px 6px rgba(89,55,31,0.3);
      transition: transform var(--dur-micro), border-color var(--dur-micro);
    }
    .o-pit:hover:not(.oaq-quan):not([data-disabled="true"]) {
      transform: scale(1.05);
      border-color: var(--marigold);
      box-shadow: inset 0 3px 6px rgba(89,55,31,0.3), 0 0 0 2px var(--marigold);
    }
    .o-pit[data-disabled="true"] {
      cursor: default;
      filter: saturate(0.6);
    }
    .o-pit.oaq-quan {
      width: 80px;
      height: 150px;
      border-radius: 40px;
      background: var(--marigold);
      border: 3px solid var(--wood);
      cursor: default;
      box-shadow: inset 0 4px 8px rgba(89,55,31,0.25), 0 0 12px rgba(240,168,40,0.5);
    }
    .o-pit.oaq-quan[data-empty="true"] {
      background: var(--paper-deep);
      box-shadow: inset 0 4px 8px rgba(89,55,31,0.25);
    }
    .oaq-pit-count {
      position: absolute;
      top: 4px;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--ink);
      background: rgba(253,248,236,0.85);
      padding: 1px 5px;
      border-radius: 8px;
    }
    .oaq-seeds-wrap {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 2px;
      width: 70%;
      height: 60%;
      overflow: hidden;
    }
    .o-seed {
      width: 8px;
      height: 8px;
      border-radius: 48% 52% 50% 50% / 52% 48% 52% 48%;
      background: var(--wood-deep);
      box-shadow: 1px 1px 2px rgba(89,55,31,0.4);
    }
    .oaq-quan .o-seed {
      background: var(--lacquer);
      width: 10px;
      height: 10px;
    }
    .oaq-seeds-more {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--wood-deep);
    }
    .oaq-actions {
      margin-top: 1rem;
    }
    .oaq-new {
      padding: 0.6rem 1.6rem;
      font-size: 1.05rem;
      font-weight: 800;
      font-family: var(--font-display);
      color: #FFF8EC;
      background: var(--lacquer);
      border: 2px solid var(--lacquer-deep);
      border-radius: var(--r-btn);
      cursor: pointer;
      box-shadow: var(--shadow-toy);
      transition: background var(--dur-micro), transform var(--dur-micro), box-shadow var(--dur-micro);
    }
    .oaq-new:hover {
      background: var(--lacquer-bright);
    }
    .oaq-new:active {
      transform: translateY(2px);
      box-shadow: 0 1px 0 var(--wood-deep);
    }
    .oaq-flying-seed {
      position: absolute;
      width: 12px;
      height: 12px;
      border-radius: 48% 52% 50% 50% / 52% 48% 52% 48%;
      background: var(--wood-deep);
      box-shadow: 0 1px 3px rgba(89,55,31,0.5);
      pointer-events: none;
      z-index: 1000;
    }
  `;
  rootEl.appendChild(styleEl);

  turnEl = document.createElement('div');
  turnEl.className = 'oaq-turn';
  turnEl.setAttribute('data-role', 'turn');
  turnEl.textContent = 'Lượt: Người chơi 1';
  rootEl.appendChild(turnEl);

  const boardEl = document.createElement('div');
  boardEl.className = 'oaq-board';

  for (const pos of ['tl', 'tr', 'br', 'bl']) {
    const corner = document.createElement('div');
    corner.className = `dh-corner ${pos}`;
    boardEl.appendChild(corner);
  }

  const score2Container = document.createElement('div');
  score2Container.className = 'oaq-score oaq-score-2';
  score2Container.innerHTML =
    'Người 2: <span class="oaq-score-val" data-role="score2">0</span>';
  score2El = score2Container.querySelector('[data-role="score2"]');
  boardEl.appendChild(score2Container);

  const playAreaEl = document.createElement('div');
  playAreaEl.className = 'oaq-play-area';

  const quanLeftEl = document.createElement('div');
  quanLeftEl.className = 'o-pit oaq-quan';
  quanLeftEl.setAttribute('data-pit', '11');
  pitEls[11] = quanLeftEl;
  playAreaEl.appendChild(quanLeftEl);

  const seedPitsContainer = document.createElement('div');
  seedPitsContainer.className = 'oaq-seed-pits';

  const row2El = document.createElement('div');
  row2El.className = 'oaq-row oaq-row-2';
  const p2Indices = [10, 9, 8, 7, 6];
  for (const idx of p2Indices) {
    const pit = document.createElement('div');
    pit.className = 'o-pit';
    pit.setAttribute('data-pit', String(idx));
    pit.addEventListener('click', () => {
      void handlePitClick(idx);
    });
    pitEls[idx] = pit;
    row2El.appendChild(pit);
  }
  seedPitsContainer.appendChild(row2El);

  const row1El = document.createElement('div');
  row1El.className = 'oaq-row oaq-row-1';
  const p1Indices = [0, 1, 2, 3, 4];
  for (const idx of p1Indices) {
    const pit = document.createElement('div');
    pit.className = 'o-pit';
    pit.setAttribute('data-pit', String(idx));
    pit.addEventListener('click', () => {
      void handlePitClick(idx);
    });
    pitEls[idx] = pit;
    row1El.appendChild(pit);
  }
  seedPitsContainer.appendChild(row1El);

  playAreaEl.appendChild(seedPitsContainer);

  const quanRightEl = document.createElement('div');
  quanRightEl.className = 'o-pit oaq-quan';
  quanRightEl.setAttribute('data-pit', '5');
  pitEls[5] = quanRightEl;
  playAreaEl.appendChild(quanRightEl);

  boardEl.appendChild(playAreaEl);

  const score1Container = document.createElement('div');
  score1Container.className = 'oaq-score oaq-score-1';
  score1Container.innerHTML =
    'Người 1: <span class="oaq-score-val" data-role="score1">0</span>';
  score1El = score1Container.querySelector('[data-role="score1"]');
  boardEl.appendChild(score1Container);

  rootEl.appendChild(boardEl);

  const actionsEl = document.createElement('div');
  actionsEl.className = 'oaq-actions';
  const newBtn = document.createElement('button');
  newBtn.className = 'oaq-new';
  newBtn.textContent = '🔄 Chơi mới';
  newBtn.addEventListener('click', () => {
    if (!clickEnabled && board.status === 'playing') return;
    board = createBoard();
    saveState();
    updateBoardView(board);
  });
  actionsEl.appendChild(newBtn);
  rootEl.appendChild(actionsEl);

  gsapCtx = gsap.context(() => {}, rootEl);

  updateBoardView(board);
  container.appendChild(rootEl);
}

export function destroyOAQScene(): void {
  if (gsapCtx) {
    gsapCtx.revert();
    gsapCtx = null;
  }
  if (rootEl) {
    const styleEl = document.getElementById('oaq-style');
    if (styleEl) {
      styleEl.remove();
    }
    rootEl.remove();
    rootEl = null;
  }
  for (let i = 0; i < pitEls.length; i++) {
    pitEls[i] = null as unknown as HTMLElement;
  }
  score1El = null;
  score2El = null;
  turnEl = null;
  clickEnabled = true;
}
