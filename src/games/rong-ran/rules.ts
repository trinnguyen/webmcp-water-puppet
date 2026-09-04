/**
 * Pure state model and deterministic game logic for "Rồng rắn lên mây" (AUT-41).
 * Contains ONLY deterministic, pure functions with no DOM, timers, or probability.
 */

export type Phase = 'idle' | 'chanting' | 'awaiting_answer' | 'chasing' | 'resolved';
export type Speed = 'cham' | 'vua' | 'nhanh';

export interface ChainSegment {
  id: string;      // e.g., "head", "body-1", "tail"
  asset: string;   // emoji string
}

export interface RongRanState {
  phase: Phase;
  round: number;
  length: number;  // 4 to 12
  chain: ChainSegment[];
  doctorAsset: string;
  chantLine: number; // 0 to 3, tracks progress of the chant
  doctorAnswer: 'Có' | 'Không' | null;
  chaseSpeed: Speed | null;
  chaseResult: 'caught' | 'escaped' | null;
  roundsSurvived: number;
  totalCatches: number;
  startingLength?: number;
}

export const CHANT_LINES = [
  'Rồng rắn lên mây',
  'Có cây lúc lắc',
  'Có nhà thưa gia',
  'Thầy thuốc có nhà hay không?',
];

export const KID_EMOJIS = ['🧒', '👧', '👦', '👶', '🧑', '🧒', '👧', '👦'];

export function buildChain(length: number, headAsset = '🐲', tailAsset = '🏃'): ChainSegment[] {
  const clampedLen = Math.max(4, Math.min(12, Math.round(length)));
  const segments: ChainSegment[] = [];

  // Head segment
  segments.push({
    id: 'head',
    asset: headAsset,
  });

  // Body segments
  for (let i = 1; i < clampedLen - 1; i++) {
    segments.push({
      id: `body-${i}`,
      asset: KID_EMOJIS[(i - 1) % KID_EMOJIS.length],
    });
  }

  // Tail segment
  segments.push({
    id: 'tail',
    asset: tailAsset,
  });

  return segments;
}

export function cloneState(state: RongRanState): RongRanState {
  return {
    ...state,
    chain: state.chain.map((s) => ({ ...s })),
  };
}

export function createInitialState(length = 6): RongRanState {
  const len = Math.max(4, Math.min(12, Math.round(length)));
  return {
    phase: 'idle',
    round: 1,
    length: len,
    startingLength: len,
    chain: buildChain(len),
    doctorAsset: '👨‍⚕️',
    chantLine: 0,
    doctorAnswer: null,
    chaseSpeed: null,
    chaseResult: null,
    roundsSurvived: 0,
    totalCatches: 0,
  };
}

/**
 * Deterministic Chase Resolution (Probability-Free)
 * Strictly determines the outcome based on length and speed:
 * - cham (slow): Always 'escaped'. The doctor is too slow.
 * - vua (medium): Returns 'caught' if length >= 9. Returns 'escaped' otherwise.
 * - nhanh (fast): Returns 'caught' if length >= 6. Returns 'escaped' otherwise.
 */
export function resolveChase(length: number, speed: Speed): 'caught' | 'escaped' {
  if (speed === 'cham') {
    return 'escaped';
  }
  if (speed === 'vua') {
    return length >= 9 ? 'caught' : 'escaped';
  }
  if (speed === 'nhanh') {
    return length >= 6 ? 'caught' : 'escaped';
  }
  return 'escaped';
}

export function startRound(state: RongRanState, length?: number): RongRanState {
  const next = cloneState(state);
  const len = length !== undefined ? Math.max(4, Math.min(12, Math.round(length))) : next.length;
  next.length = len;
  next.startingLength = length !== undefined ? len : (next.startingLength ?? len);

  const headAsset = next.chain[0]?.asset || '🐲';
  const tailAsset = next.chain[next.chain.length - 1]?.asset || '🏃';
  next.chain = buildChain(len, headAsset, tailAsset);

  next.phase = 'chanting';
  next.chantLine = 0;
  next.doctorAnswer = null;
  next.chaseSpeed = null;
  next.chaseResult = null;
  return next;
}

export function advanceChant(state: RongRanState): RongRanState {
  const next = cloneState(state);
  if (next.phase !== 'chanting' && next.phase !== 'idle') {
    return next;
  }
  if (next.chantLine < 3) {
    next.chantLine = next.chantLine + 1;
  }
  if (next.chantLine === 3) {
    next.phase = 'awaiting_answer';
  } else {
    next.phase = 'chanting';
  }
  return next;
}

export function answer(state: RongRanState, answerStr: 'Có' | 'Không'): RongRanState {
  const next = cloneState(state);
  const isCo = answerStr.trim().toLowerCase().startsWith('c');
  const normalized: 'Có' | 'Không' = isCo ? 'Có' : 'Không';
  next.doctorAnswer = normalized;

  if (normalized === 'Có') {
    next.phase = 'chasing';
  } else {
    // Thầy thuốc không có nhà -> rồng rắn lại hát tiếp từ đầu
    next.phase = 'chanting';
    next.chantLine = 0;
  }
  return next;
}

export function startChase(state: RongRanState, speed: Speed): RongRanState {
  const next = cloneState(state);
  const result = resolveChase(next.length, speed);
  next.chaseSpeed = speed;
  next.chaseResult = result;
  next.phase = 'resolved';
  return next;
}

export function nextRound(state: RongRanState): RongRanState {
  const next = cloneState(state);
  next.round = next.round + 1;
  next.chantLine = 0;
  next.doctorAnswer = null;
  next.chaseSpeed = null;
  next.phase = 'chanting';

  if (state.chaseResult === 'caught') {
    next.totalCatches = next.totalCatches + 1;
    const oldDoctorAsset = state.doctorAsset;
    const caughtTail = state.chain[state.chain.length - 1];
    const newDoctorAsset = caughtTail ? caughtTail.asset : '👨‍⚕️';
    next.doctorAsset = newDoctorAsset;

    // Chain length decreases by 1 (if drops below 4, reset to starting length)
    const baseStartingLen = state.startingLength ?? 6;
    let newLen = state.length - 1;
    if (newLen < 4) {
      newLen = baseStartingLen;
    }
    next.length = newLen;

    // The caught tail segment becomes the new doctor, the old doctor joins the head of the chain.
    const newSegments: ChainSegment[] = [];
    newSegments.push({ id: 'head', asset: oldDoctorAsset });
    for (let i = 1; i < newLen - 1; i++) {
      const prevAsset = state.chain[i - 1]?.asset || KID_EMOJIS[(i - 1) % KID_EMOJIS.length];
      newSegments.push({ id: `body-${i}`, asset: prevAsset });
    }
    const tailAsset = (newLen - 1 < state.chain.length - 1)
      ? state.chain[newLen - 1].asset
      : '🏃';
    newSegments.push({ id: 'tail', asset: tailAsset });
    next.chain = newSegments;
  } else {
    // If 'escaped', increment roundsSurvived. Roles remain.
    next.roundsSurvived = next.roundsSurvived + 1;
  }

  next.chaseResult = null;
  return next;
}
