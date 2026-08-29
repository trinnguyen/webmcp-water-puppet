export interface OAQBoard {
  pits: number[];              // length 12
  captured: [number, number];  // [P1, P2]
  currentPlayer: 1 | 2;
  status: 'playing' | 'finished';
  winner: 0 | 1 | 2;           // 0 = draw
}

const CIRC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function nextInCirc(i: number): number {
  return CIRC[(CIRC.indexOf(i) + 1) % CIRC.length];
}

export function createBoard(): OAQBoard {
  return {
    pits: [5, 5, 5, 5, 5, 10, 5, 5, 5, 5, 5, 10],
    captured: [0, 0],
    currentPlayer: 1,
    status: 'playing',
    winner: 0,
  };
}

export function getPlayerPits(player: 1 | 2): number[] {
  return player === 1 ? [0, 1, 2, 3, 4] : [6, 7, 8, 9, 10];
}

export function isValidMove(board: OAQBoard, pitIndex: number): boolean {
  if (board.status !== 'playing') {
    return false;
  }
  const validPits = getPlayerPits(board.currentPlayer);
  return validPits.includes(pitIndex) && board.pits[pitIndex] > 0;
}

export function executeMove(board: OAQBoard, pitIndex: number): OAQBoard {
  if (!isValidMove(board, pitIndex)) {
    return {
      pits: [...board.pits],
      captured: [board.captured[0], board.captured[1]],
      currentPlayer: board.currentPlayer,
      status: board.status,
      winner: board.winner,
    };
  }

  const b: OAQBoard = {
    pits: [...board.pits],
    captured: [board.captured[0], board.captured[1]],
    currentPlayer: board.currentPlayer,
    status: board.status,
    winner: board.winner,
  };

  // Scoop seeds
  let seeds = b.pits[pitIndex];
  b.pits[pitIndex] = 0;
  let pos = pitIndex;

  // Initial sowing
  while (seeds > 0) {
    pos = nextInCirc(pos);
    b.pits[pos] += 1;
    seeds -= 1;
  }

  // Relay sowing
  while (true) {
    const isSmall = (pos >= 0 && pos <= 4) || (pos >= 6 && pos <= 10);
    if (isSmall && b.pits[pos] > 1) {
      seeds = b.pits[pos];
      b.pits[pos] = 0;
      while (seeds > 0) {
        pos = nextInCirc(pos);
        b.pits[pos] += 1;
        seeds -= 1;
      }
    } else {
      break;
    }
  }

  // Capture check
  const land = pos;
  const nextPit = nextInCirc(land);
  const isNextSmall = (nextPit >= 0 && nextPit <= 4) || (nextPit >= 6 && nextPit <= 10);
  if (isNextSmall && b.pits[nextPit] === 0) {
    let capturePos = nextInCirc(nextPit);
    while (true) {
      const srcIsSmall = (capturePos >= 0 && capturePos <= 4) || (capturePos >= 6 && capturePos <= 10);
      if (srcIsSmall && b.pits[capturePos] > 0) {
        b.captured[b.currentPlayer === 1 ? 0 : 1] += b.pits[capturePos];
        b.pits[capturePos] = 0;
        const nn = nextInCirc(capturePos);
        const nnIsSmall = (nn >= 0 && nn <= 4) || (nn >= 6 && nn <= 10);
        if (nnIsSmall && b.pits[nn] === 0) {
          capturePos = nextInCirc(nn);
          continue;
        }
        break;
      } else {
        break;
      }
    }
  }

  // Switch player
  b.currentPlayer = b.currentPlayer === 1 ? 2 : 1;
  return checkEndCondition(b);
}

export function checkEndCondition(board: OAQBoard): OAQBoard {
  const b: OAQBoard = {
    pits: [...board.pits],
    captured: [board.captured[0], board.captured[1]],
    currentPlayer: board.currentPlayer,
    status: board.status,
    winner: board.winner,
  };

  const bothQuanGone = b.pits[5] === 0 && b.pits[11] === 0;
  const p1Small = [0, 1, 2, 3, 4];
  const p2Small = [6, 7, 8, 9, 10];
  const currentPits = b.currentPlayer === 1 ? p1Small : p2Small;
  const noMoves = currentPits.every((i) => b.pits[i] === 0);

  if (bothQuanGone || noMoves) {
    for (const i of p1Small) {
      if (b.pits[i] > 0) {
        b.captured[0] += b.pits[i];
        b.pits[i] = 0;
      }
    }
    for (const i of p2Small) {
      if (b.pits[i] > 0) {
        b.captured[1] += b.pits[i];
        b.pits[i] = 0;
      }
    }
    b.status = 'finished';
    b.winner = b.captured[0] > b.captured[1] ? 1 : b.captured[1] > b.captured[0] ? 2 : 0;
  }

  return b;
}

export function getScore(board: OAQBoard): { p1: number; p2: number } {
  return { p1: board.captured[0], p2: board.captured[1] };
}

export function boardToJSON(board: OAQBoard): string {
  return JSON.stringify(board);
}

