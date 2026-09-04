/**
 * Pure state model and transition rules for "Sơn Tinh's Smart Home" (Nhà Sơn Tinh chống Thủy Tinh).
 * Contains pure functions and immutable state transitions: no DOM, no timers.
 */

export type DefenseType = 'dirt' | 'rock' | 'magic_net';
export type GiftAnimal = 'voi_9_nga' | 'ga_9_cua' | 'ngua_thep' | 'roi_that';

export interface SonTinhState {
  waterLevel: number; // 0 to 100 (rising each turn)
  mountainHeight: number; // 0 to 100
  threat: number; // 0 to 100 (based on waterLevel vs mountainHeight)
  points: number; // defense budget
  inventory: GiftAnimal[]; // summoned wedding gifts
  turn: number;
  floodWavesSurvived: number;
  submerged: boolean;
}

export interface SonTinhPersistentState {
  lifetimeBestWaves: number;
  currentRun: SonTinhState;
  messages: string[]; // Thủy Tinh's angry texts
}

export const SAVE_KEY = 'san_choi_son_tinh';

export const DEFENSE_COSTS: Record<DefenseType, number> = {
  dirt: 10,
  rock: 25,
  magic_net: 50,
};

export const DEFENSE_HEIGHT: Record<DefenseType, number> = {
  dirt: 5,
  rock: 10,
  magic_net: 15,
};

export const GIFT_EFFECTS: Record<GiftAnimal, { points: number; description: string }> = {
  voi_9_nga: { points: 15, description: '9-tusk elephant buffs defense +15' },
  ga_9_cua: { points: 10, description: '9-spur rooster buffs defense +10' },
  ngua_thep: { points: 20, description: 'Iron horse buffs defense +20' },
  roi_that: { points: 5, description: 'Magic whip buffs defense +5' },
};

export const DEFENSE_NAMES: Record<DefenseType, { vi: string; en: string; emoji: string }> = {
  dirt: { vi: 'Đất bồi', en: 'Alluvial Dirt', emoji: '🪵' },
  rock: { vi: 'Đá tảng', en: 'Mountain Rock', emoji: '🪨' },
  magic_net: { vi: 'Lưới phép', en: 'Magic Flood Net', emoji: '🕸️' },
};

export const GIFT_NAMES: Record<GiftAnimal, { vi: string; en: string; emoji: string }> = {
  voi_9_nga: { vi: 'Voi chín ngà', en: '9-Tusk Elephant', emoji: '🐘' },
  ga_9_cua: { vi: 'Gà chín cựa', en: '9-Spur Rooster', emoji: '🐓' },
  ngua_thep: { vi: 'Ngựa chín hồng mao', en: 'Iron / Red-Mane Horse', emoji: '🐎' },
  roi_that: { vi: 'Roi thần', en: 'Magic Whip', emoji: '🪄' },
};

export const THUY_TINH_MESSAGES: string[] = [
  'Sao chặn sóng của tui?? 😡',
  'Thủy Tinh nổi giận, dâng nước cao hơn! 🌊',
  'Mày tưởng mày giỏi lắm hả Sơn Tinh? 😤',
  'Sóng thần cấp 5 đây! 💀',
  'Ha ha, nước sẽ cuốn trôi nhà mày!',
  'Lũ này mày không đỡ nổi đâu!',
  'Đi mời Rồng Vàng đi con ạ! 🐉',
  'Sơn Tinh ơi, vợ mày về nhà tao chơi nè! 😜',
  'Cố lên, sắp ngập rồi!',
  'Một trận sóng thần nữa là tan hoang!',
];

export interface SonTinhChangeEvent {
  action: 'deploy_defense' | 'summon_gift' | 'advance_turn' | 'end_season' | 'reset' | 'load';
  effect?: 'raised' | 'no_points' | 'summoned' | 'submerged' | 'survived';
  state: SonTinhPersistentState;
  message?: string;
  isTool?: boolean;
  extra?: unknown;
}

export type SonTinhChangeListener = (event: SonTinhChangeEvent) => void;

const listeners: Set<SonTinhChangeListener> = new Set();

export function onSonTinhChange(listener: SonTinhChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyChange(event: SonTinhChangeEvent): void {
  for (const l of listeners) {
    try {
      l(event);
    } catch (e) {
      console.error('[SonTinh] Listener error:', e);
    }
  }
}

export function createInitialRunState(): SonTinhState {
  return {
    mountainHeight: 50,
    waterLevel: 0,
    threat: 0,
    points: 50,
    inventory: [],
    turn: 0,
    floodWavesSurvived: 0,
    submerged: false,
  };
}

export function createInitialPersistentState(): SonTinhPersistentState {
  return {
    lifetimeBestWaves: 0,
    currentRun: createInitialRunState(),
    messages: [],
  };
}

export function cloneState(state: SonTinhState): SonTinhState {
  return {
    waterLevel: state.waterLevel,
    mountainHeight: state.mountainHeight,
    threat: state.threat,
    points: state.points,
    inventory: [...state.inventory],
    turn: state.turn,
    floodWavesSurvived: state.floodWavesSurvived,
    submerged: state.submerged,
  };
}

export function clonePersistentState(state: SonTinhPersistentState): SonTinhPersistentState {
  return {
    lifetimeBestWaves: state.lifetimeBestWaves,
    currentRun: cloneState(state.currentRun),
    messages: [...state.messages],
  };
}

let currentState: SonTinhPersistentState = createInitialPersistentState();

export function loadState(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.lifetimeBestWaves === 'number' &&
          parsed.currentRun &&
          typeof parsed.currentRun === 'object'
        ) {
          const run = parsed.currentRun;
          const validAnimals: GiftAnimal[] = Array.isArray(run.inventory)
            ? run.inventory.filter((a: string) =>
                ['voi_9_nga', 'ga_9_cua', 'ngua_thep', 'roi_that'].includes(a)
              )
            : [];
          const validMessages: string[] = Array.isArray(parsed.messages)
            ? parsed.messages.filter((m: unknown) => typeof m === 'string')
            : [];

          currentState = {
            lifetimeBestWaves: Math.max(0, Math.floor(parsed.lifetimeBestWaves)),
            messages: validMessages.slice(-20),
            currentRun: {
              waterLevel: Math.max(0, Math.min(100, Math.floor(run.waterLevel || 0))),
              mountainHeight: Math.max(0, Math.min(100, Math.floor(run.mountainHeight || 50))),
              threat: Math.max(0, Math.min(100, Math.floor(run.threat || 0))),
              points: Math.max(0, Math.floor(run.points ?? 50)),
              inventory: validAnimals,
              turn: Math.max(0, Math.floor(run.turn || 0)),
              floodWavesSurvived: Math.max(0, Math.floor(run.floodWavesSurvived || 0)),
              submerged: Boolean(run.submerged),
            },
          };
          if (currentState.currentRun.floodWavesSurvived > currentState.lifetimeBestWaves) {
            currentState.lifetimeBestWaves = currentState.currentRun.floodWavesSurvived;
          }
          return;
        }
      }
    }
  } catch (e) {
    console.warn('[SonTinh] Failed to load state from localStorage:', e);
  }
  currentState = createInitialPersistentState();
}

export function saveState(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAVE_KEY, JSON.stringify(currentState));
    }
  } catch (e) {
    console.warn('[SonTinh] Failed to save state to localStorage:', e);
  }
}

export function getSonTinhState(): SonTinhPersistentState {
  return clonePersistentState(currentState);
}

/**
 * Pure helper to compute threat and check submerged status.
 */
function updateThreatAndSubmerged(run: SonTinhState): void {
  const diff = run.waterLevel - run.mountainHeight;
  run.threat = Math.max(0, Math.min(100, diff));
  if (run.threat >= 50 && run.points < 10) {
    run.submerged = true;
  }
}

/**
 * Deterministic turn progression: rises water by 15, recalculates threat,
 * and pushes a new angry message from Thủy Tinh.
 */
export function advanceTurn(isTool = false): {
  state: SonTinhPersistentState;
  newMessage: string;
} {
  const current = currentState.currentRun;
  current.turn += 1;
  current.waterLevel = Math.min(100, current.waterLevel + 15);
  updateThreatAndSubmerged(current);

  const msgIndex = (current.turn - 1) % THUY_TINH_MESSAGES.length;
  const newMessage = THUY_TINH_MESSAGES[msgIndex];
  currentState.messages.push(newMessage);
  if (currentState.messages.length > 20) {
    currentState.messages.shift();
  }

  saveState();
  const snapshot = getSonTinhState();
  notifyChange({
    action: 'advance_turn',
    effect: current.submerged ? 'submerged' : undefined,
    state: snapshot,
    message: newMessage,
    isTool,
  });

  return { state: snapshot, newMessage };
}

/**
 * Spend points raising the voxel mountain.
 * Triggers turn progression as Thủy Tinh retaliates.
 */
export function deployDefense(
  type: DefenseType,
  heightIncrease: number,
  isTool = false
): {
  state: SonTinhPersistentState;
  message: string;
  effect: 'raised' | 'no_points';
} {
  const current = currentState.currentRun;
  const clampedIncrease = Math.max(1, Math.min(5, Math.floor(heightIncrease || 1)));
  const cost = DEFENSE_COSTS[type] * clampedIncrease;

  if (current.points < cost) {
    const snapshot = getSonTinhState();
    const msg = `Không đủ điểm để xây ${DEFENSE_NAMES[type]?.vi || type}! Cần ${cost} điểm nhưng chỉ có ${current.points} điểm.`;
    notifyChange({
      action: 'deploy_defense',
      effect: 'no_points',
      state: snapshot,
      message: msg,
      isTool,
      extra: { type, heightIncrease: clampedIncrease },
    });
    return { state: snapshot, message: msg, effect: 'no_points' };
  }

  // Deduct points and raise mountain
  current.points -= cost;
  const addedHeight = DEFENSE_HEIGHT[type] * clampedIncrease;
  current.mountainHeight = Math.min(100, current.mountainHeight + addedHeight);

  // Thủy Tinh reacts: advance turn (water level +15)
  current.turn += 1;
  current.waterLevel = Math.min(100, current.waterLevel + 15);
  updateThreatAndSubmerged(current);

  const msgIndex = (current.turn - 1) % THUY_TINH_MESSAGES.length;
  const thuyTinhMsg = THUY_TINH_MESSAGES[msgIndex];
  currentState.messages.push(thuyTinhMsg);
  if (currentState.messages.length > 20) {
    currentState.messages.shift();
  }

  saveState();
  const snapshot = getSonTinhState();
  const message = `Đã đắp ${clampedIncrease} tầng ${DEFENSE_NAMES[type]?.vi || type} (+${addedHeight}m chiều cao)! Thủy Tinh lập tức dâng nước đáp trả (+15m): "${thuyTinhMsg}"`;

  notifyChange({
    action: 'deploy_defense',
    effect: 'raised',
    state: snapshot,
    message,
    isTool,
    extra: { type, heightIncrease: clampedIncrease, addedHeight, thuyTinhMsg },
  });

  return { state: snapshot, message, effect: 'raised' };
}

/**
 * Summon wedding-gift animal buff: voi_9_nga, ga_9_cua, ngua_thep, roi_that.
 */
export function summonGift(
  animal: GiftAnimal,
  isTool = false
): {
  state: SonTinhPersistentState;
  message: string;
} {
  const current = currentState.currentRun;
  const gift = GIFT_EFFECTS[animal];
  const nameVi = GIFT_NAMES[animal]?.vi || animal;

  let message = '';
  if (current.inventory.includes(animal)) {
    current.points += gift.points;
    message = `${nameVi} tiếp tục tiếp viện năng lượng thần tốc! Nhận thêm +${gift.points} điểm công đức chống lũ!`;
  } else {
    current.inventory.push(animal);
    current.points += gift.points;
    message = `Triệu hồi thành công ${nameVi}! ${gift.description} (+${gift.points} điểm)!`;
  }

  saveState();
  const snapshot = getSonTinhState();
  notifyChange({
    action: 'summon_gift',
    effect: 'summoned',
    state: snapshot,
    message,
    isTool,
    extra: { animal, buff: gift.points },
  });

  return { state: snapshot, message };
}

/**
 * Return current messages array.
 */
export function readMessages(): string[] {
  return [...currentState.messages];
}

/**
 * End the current flood season.
 * If submerged (or water level > mountain height): funny defeat.
 * Otherwise: survive wave, update records, and prepare next season run.
 */
export function endSeason(isTool = false): {
  state: SonTinhPersistentState;
  score: number;
  message: string;
} {
  const current = currentState.currentRun;
  const isSubmerged = current.submerged || current.waterLevel > current.mountainHeight;

  let score = 0;
  let message = '';
  let effect: 'submerged' | 'survived' = 'survived';

  if (isSubmerged) {
    effect = 'submerged';
    score = 0;
    message = `Sóng thần Thủy Tinh đã nhấn chìm nhà Sơn Tinh (Nước: ${current.waterLevel}m > Núi: ${current.mountainHeight}m)! Mỵ Nương phải đi xuồng ba lá! Hãy thử sức lại mùa tới!`;
    // Reset run on defeat
    currentState.currentRun = createInitialRunState();
  } else {
    effect = 'survived';
    const survived = current.floodWavesSurvived + 1;
    if (survived > currentState.lifetimeBestWaves) {
      currentState.lifetimeBestWaves = survived;
    }
    score = survived * 100 + current.mountainHeight * 2 - current.waterLevel + current.points;
    message = `SƠN TINH TOÀN THẮNG! Nước dâng bao nhiêu núi cao bấy nhiêu. Vượt qua đợt lũ thứ ${survived}! Tổng điểm: ${score}.`;

    // Start next wave season with fresh mountain & water, carrying over streak
    currentState.currentRun = {
      ...createInitialRunState(),
      floodWavesSurvived: survived,
      points: 50 + survived * 10,
    };
  }

  saveState();
  const snapshot = getSonTinhState();
  notifyChange({
    action: 'end_season',
    effect,
    state: snapshot,
    message,
    isTool,
    extra: { score, isSubmerged },
  });

  return { state: snapshot, score, message };
}

/**
 * Reset run, keeps lifetime best waves.
 */
export function driveReset(): SonTinhPersistentState {
  currentState.currentRun = createInitialRunState();
  currentState.messages = [];
  saveState();
  const snapshot = getSonTinhState();
  notifyChange({
    action: 'reset',
    state: snapshot,
    message: 'Đã thiết lập lại trạng thái ban đầu của Sơn Tinh. Kỷ lục mùa lũ vẫn được lưu giữ!',
  });
  return snapshot;
}

// Initial state load
loadState();
