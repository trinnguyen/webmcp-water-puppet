/**
 * Pure Bầu Cua Tôm Cá (Gourd-Crab-Shrimp-Fish-Chicken-Deer) dice game logic.
 * Follows strict immutability with deep-cloning on all state transitions.
 */

export type BauCuaSymbol = 'bau' | 'cua' | 'tom' | 'ca' | 'ga' | 'huou';

export const SYMBOLS: BauCuaSymbol[] = ['bau', 'cua', 'tom', 'ca', 'ga', 'huou'];

export const SYMBOL_NAMES: Record<BauCuaSymbol, { vi: string; en: string; emoji: string }> = {
  bau:  { vi: 'Bầu', en: 'Gourd', emoji: '🍐' },
  cua:  { vi: 'Cua', en: 'Crab', emoji: '🦀' },
  tom:  { vi: 'Tôm', en: 'Shrimp', emoji: '🦐' },
  ca:   { vi: 'Cá', en: 'Fish', emoji: '🐟' },
  ga:   { vi: 'Gà', en: 'Chicken', emoji: '🐔' },
  huou: { vi: 'Hươu', en: 'Deer', emoji: '🦌' },
};

export interface Bet {
  symbol: BauCuaSymbol;
  points: number;
}

export interface BauCuaState {
  playerPoints: number;
  bets: Bet[];
  lastRoll: BauCuaSymbol[] | null;
  roundHistory: Array<{ bets: Bet[]; roll: BauCuaSymbol[]; netGain: number }>;
  roundNumber: number;
  status: 'betting' | 'rolled' | 'resolved';
}

/**
 * Deep-clones the game state to ensure pure immutability.
 */
function cloneState(state: BauCuaState): BauCuaState {
  return {
    playerPoints: state.playerPoints,
    bets: state.bets.map(b => ({ ...b })),
    lastRoll: state.lastRoll ? [...state.lastRoll] : null,
    roundHistory: state.roundHistory.map(h => ({
      bets: h.bets.map(b => ({ ...b })),
      roll: [...h.roll],
      netGain: h.netGain,
    })),
    roundNumber: state.roundNumber,
    status: state.status,
  };
}

/**
 * Creates a new Bầu Cua game state with optional initial points.
 */
export function createBauCuaGame(startingPoints?: number): BauCuaState {
  return {
    playerPoints: startingPoints ?? 100,
    bets: [],
    lastRoll: null,
    roundHistory: [],
    roundNumber: 1,
    status: 'betting',
  };
}

/**
 * Places or increments a bet on a chosen symbol within available point limits.
 */
export function placeBet(state: BauCuaState, symbol: BauCuaSymbol, points: number): BauCuaState {
  const s = cloneState(state);
  if (s.status !== 'betting') return s;
  if (!Number.isInteger(points) || points <= 0) return s;
  const staked = s.bets.reduce((sum, b) => sum + b.points, 0);
  if (points > s.playerPoints - staked) return s;
  const existing = s.bets.find(b => b.symbol === symbol);
  if (existing) {
    existing.points += points;
  } else {
    s.bets.push({ symbol, points });
  }
  return s;
}

/**
 * Rolls 3 dice with Bầu Cua symbols if in betting state with active bets.
 */
export function rollDice(state: BauCuaState): BauCuaState {
  const s = cloneState(state);
  if (s.status !== 'betting' || s.bets.length === 0) return s;
  const roll: BauCuaSymbol[] = [0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  s.lastRoll = roll;
  s.status = 'rolled';
  return s;
}

/**
 * Resolves payout/loss for placed bets based on the dice outcome and updates round history.
 */
export function resolveBets(state: BauCuaState): BauCuaState {
  const s = cloneState(state);
  if (s.status !== 'rolled' || !s.lastRoll) return s;
  const before = s.playerPoints;
  for (const bet of s.bets) {
    const count = s.lastRoll.filter(x => x === bet.symbol).length;
    if (count === 0) {
      s.playerPoints = Math.max(0, s.playerPoints - bet.points);
    } else {
      s.playerPoints = Math.max(0, s.playerPoints + bet.points * count);
    }
  }
  const netGain = s.playerPoints - before;
  s.roundHistory.push({
    bets: state.bets.map(b => ({ ...b })),
    roll: [...s.lastRoll],
    netGain,
  });
  s.bets = [];
  s.lastRoll = null;
  s.roundNumber += 1;
  s.status = 'betting';
  return s;
}

/**
 * Returns current player points and round count.
 */
export function getBauCuaScore(state: BauCuaState): { points: number; roundNumber: number } {
  return { points: state.playerPoints, roundNumber: state.roundNumber };
}
