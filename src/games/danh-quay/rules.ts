/**
 * Pure state model and deterministic game logic for "Đánh quay" (AUT-42).
 * Contains ONLY deterministic, pure functions with no DOM, timers, or probability.
 */

export type Power = 'nhe' | 'vua' | 'manh';
export type Trick = 'nguoi_duc' | 'bay_cao' | 'qua_gam';
export type TopStatus = 'idle' | 'spinning' | 'fallen' | 'flew_off' | 'dizzy';

export interface DanhQuayState {
  status: TopStatus;
  energy: number; // 0 to 100
  score: number;  // represents seconds spun
  wobbling: boolean;
  tricksLanded: number;
  consecutiveTricks: number;
  longestSpinRecord: number;
}

export const BASE_DECAY = 5;
export const TRICK_COST = 40;

export const POWER_BOOST: Record<Power, number> = {
  nhe: 5,
  vua: 12,
  manh: 22,
};

export function cloneState(state: DanhQuayState): DanhQuayState {
  return {
    ...state,
  };
}

export function createInitialState(record = 0): DanhQuayState {
  return {
    status: 'idle',
    energy: 0,
    score: 0,
    wobbling: false,
    tricksLanded: 0,
    consecutiveTricks: 0,
    longestSpinRecord: record,
  };
}

export function start(state: DanhQuayState): DanhQuayState {
  const next = cloneState(state);
  next.status = 'spinning';
  next.energy = 30;
  next.score = 0;
  next.wobbling = false;
  next.tricksLanded = 0;
  next.consecutiveTricks = 0;
  return next;
}

export interface WhipResult {
  nextState: DanhQuayState;
  wobblePenalty: boolean;
  flewOff: boolean;
  message: string;
}

export function whip(state: DanhQuayState, power: Power): WhipResult {
  const next = cloneState(state);

  if (next.status !== 'spinning') {
    return {
      nextState: next,
      wobblePenalty: false,
      flewOff: false,
      message: `Con quay hiện không quay (trạng thái: ${next.status}). Hãy bắt đầu lại lượt chơi mới!`,
    };
  }

  // 1. Applies base energy decay
  let energy = Math.max(0, next.energy - BASE_DECAY);

  // 2. Adds energy (nhe: +5, vua: +12, manh: +22)
  const boost = POWER_BOOST[power] ?? 5;
  energy += boost;

  let wobblePenalty = false;
  let flewOff = false;
  let message = '';

  // 3. Hook: If energy > 100, top is overwhipped. status = 'flew_off', energy = 0
  if (energy > 100) {
    next.status = 'flew_off';
    next.energy = 0;
    next.wobbling = false;
    flewOff = true;
    message = 'Quất quá mạnh! Con quay vượt quá 100 năng lượng và văng tít ra ngoài sân!';
  } else if (power === 'manh' && energy >= 80) {
    // 4. Risk: If power === 'manh' and energy >= 80 (near-max), top wobbling = true and applies energy penalty (-20)
    wobblePenalty = true;
    next.wobbling = true;
    next.energy = Math.max(0, energy - 20);
    if (next.energy <= 0) {
      next.status = 'fallen';
      message = 'Quất mạnh khi năng lượng chạm đỉnh! Con quay loạng choạng ngã lăn ra đất!';
    } else {
      message = `Quất mạnh ở mức năng lượng cao! Con quay loạng choạng mất 20 năng lượng (còn ${next.energy})!`;
    }
  } else {
    // Normal whip success
    next.wobbling = false;
    next.energy = Math.min(100, energy);
    const powerVi = power === 'nhe' ? 'nhẹ (+5)' : power === 'vua' ? 'vừa (+12)' : 'mạnh (+22)';
    message = `Quất roi ${powerVi} chuẩn xác! Năng lượng hiện tại: ${next.energy}.`;
  }

  // Resets consecutiveTricks = 0. Increments score by 1
  next.consecutiveTricks = 0;
  next.score += 1;

  if (next.score > next.longestSpinRecord) {
    next.longestSpinRecord = next.score;
  }

  return {
    nextState: next,
    wobblePenalty,
    flewOff,
    message,
  };
}

export interface TrickResult {
  nextState: DanhQuayState;
  trickSuccess: boolean;
  dizzy: boolean;
  fallen: boolean;
  message: string;
}

export function performTrick(state: DanhQuayState, trick: Trick): TrickResult {
  const next = cloneState(state);

  if (next.status !== 'spinning') {
    return {
      nextState: next,
      trickSuccess: false,
      dizzy: false,
      fallen: false,
      message: `Con quay hiện không quay (trạng thái: ${next.status}). Hãy bắt đầu lại lượt chơi mới!`,
    };
  }

  // Applies base energy decay
  const currentEnergy = Math.max(0, next.energy - BASE_DECAY);

  const trickNames: Record<Trick, string> = {
    nguoi_duc: 'Ngựa đực',
    bay_cao: 'Bay cao',
    qua_gam: 'Qua gầm',
  };
  const trickNameVi = trickNames[trick] || trick;

  // If energy < 40: Trick fails. Top falls over (status = 'fallen', energy = 0)
  if (currentEnergy < TRICK_COST) {
    next.status = 'fallen';
    next.energy = 0;
    next.wobbling = false;
    if (next.score > next.longestSpinRecord) {
      next.longestSpinRecord = next.score;
    }
    return {
      nextState: next,
      trickSuccess: false,
      dizzy: false,
      fallen: true,
      message: `Không đủ năng lượng thực hiện kỹ thuật '${trickNameVi}' (${currentEnergy} < 40)! Con quay đã ngã đổ!`,
    };
  }

  // Else: Trick succeeds. energy -= 40, tricksLanded += 1, consecutiveTricks += 1, score += 5 (applause points)
  next.energy = currentEnergy - TRICK_COST;
  next.tricksLanded += 1;
  next.consecutiveTricks += 1;
  next.score += 5;
  next.wobbling = false;

  let dizzy = false;
  let message = `Biểu diễn kỹ thuật '${trickNameVi}' thành công rực rỡ! Khán giả vỗ tay tán thưởng (+5 điểm)!`;

  // Hook: If consecutiveTricks >= 5, top gets dizzy and rests (status = 'dizzy', energy = 0)
  if (next.consecutiveTricks >= 5) {
    next.status = 'dizzy';
    next.energy = 0;
    dizzy = true;
    message = `Biểu diễn kỹ thuật '${trickNameVi}' thành công, nhưng 5 cú liên tiếp khiến con quay chóng mặt hoa mắt xin nghỉ ngơi!`;
  }

  if (next.score > next.longestSpinRecord) {
    next.longestSpinRecord = next.score;
  }

  return {
    nextState: next,
    trickSuccess: true,
    dizzy,
    fallen: false,
    message,
  };
}

export interface FinishResult {
  nextState: DanhQuayState;
  finalScore: number;
  longestSpinRecord: number;
  message: string;
}

export function finish(state: DanhQuayState): FinishResult {
  const next = cloneState(state);
  next.status = 'idle';
  next.energy = 0;
  next.wobbling = false;
  if (next.score > next.longestSpinRecord) {
    next.longestSpinRecord = next.score;
  }
  return {
    nextState: next,
    finalScore: next.score,
    longestSpinRecord: next.longestSpinRecord,
    message: `Đã thu dây kết thúc lượt chơi! Điểm số đạt được: ${next.score} giây quay. Kỷ lục: ${next.longestSpinRecord}.`,
  };
}
