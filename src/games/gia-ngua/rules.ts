/**
 * Pure state model and transition rules for Gióng's Iron Garage (Gara Ngựa Sắt).
 * Contains pure functions and immutable state transitions: no DOM, no timers.
 */

export type FoodType = 'com_ca' | 'pizza' | 'nuoc_ngot';
export type GearItem = 'bamboo_whip' | 'iron_armor' | 'iron_hat' | 'iron_sword';

export interface GiaNguaState {
  sizeStage: number;    // 0 to 5
  armorLevel: number;   // 0 (none) to 1 (iron_armor equipped)
  hunger: number;       // 0 (starving) to 100 (full)
  gear: GearItem[];
}

export interface GiaNguaPersistentState {
  lifetimeBestSize: number;
  currentRun: GiaNguaState;
}

export const SAVE_KEY = 'san_choi_gia_ngua';

export const SCALE_FACTORS: Record<number, number> = {
  0: 1.0,
  1: 1.2,
  2: 1.5,
  3: 1.9,
  4: 2.4,
  5: 3.0,
};

export const SIZE_STAGE_NAMES: Record<number, { vi: string; en: string }> = {
  0: { vi: 'Ngựa con', en: 'Foal' },
  1: { vi: 'Ngựa choai', en: 'Colt' },
  2: { vi: 'Ngựa trưởng thành', en: 'Steed' },
  3: { vi: 'Ngựa chiến', en: 'Warhorse' },
  4: { vi: 'Thiết mã dũng mãnh', en: 'Mighty Iron Horse' },
  5: { vi: 'Chiến mã thần thoại', en: 'Legendary Steed' },
};

export const GEAR_NAMES: Record<GearItem, { vi: string; en: string; emoji: string }> = {
  bamboo_whip: { vi: 'Roi tre', en: 'Bamboo Whip', emoji: '🎋' },
  iron_armor: { vi: 'Giáp sắt', en: 'Iron Armor', emoji: '🛡️' },
  iron_hat: { vi: 'Mũ sắt', en: 'Iron Helmet', emoji: '🪖' },
  iron_sword: { vi: 'Kiếm sắt', en: 'Iron Sword', emoji: '⚔️' },
};

export const FOOD_NAMES: Record<FoodType, { vi: string; en: string; emoji: string }> = {
  com_ca: { vi: 'Cơm cà', en: 'Rice & Eggplant', emoji: '🍚' },
  pizza: { vi: 'Bánh Pizza', en: 'Pizza', emoji: '🍕' },
  nuoc_ngot: { vi: 'Nước ngọt', en: 'Soda', emoji: '🥤' },
};

export interface GiaNguaChangeEvent {
  action: 'feed' | 'equip' | 'test_fire' | 'reset' | 'load';
  effect?: 'grow' | 'spit_smoke' | 'overfed' | 'equip' | 'already_wearing' | 'victory_dance' | 'fire';
  state: GiaNguaPersistentState;
  message?: string;
  isTool?: boolean;
  extra?: unknown;
}

export type GiaNguaChangeListener = (event: GiaNguaChangeEvent) => void;

const listeners: Set<GiaNguaChangeListener> = new Set();

export function onGiaNguaChange(listener: GiaNguaChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyChange(event: GiaNguaChangeEvent): void {
  for (const l of listeners) {
    try {
      l(event);
    } catch (e) {
      console.error('[GiaNgua] Listener error:', e);
    }
  }
}

export function createInitialRunState(): GiaNguaState {
  return {
    sizeStage: 0,
    armorLevel: 0,
    hunger: 0,
    gear: [],
  };
}

export function createInitialPersistentState(): GiaNguaPersistentState {
  return {
    lifetimeBestSize: 0,
    currentRun: createInitialRunState(),
  };
}

export function cloneState(state: GiaNguaState): GiaNguaState {
  return {
    sizeStage: state.sizeStage,
    armorLevel: state.armorLevel,
    hunger: state.hunger,
    gear: [...state.gear],
  };
}

export function clonePersistentState(state: GiaNguaPersistentState): GiaNguaPersistentState {
  return {
    lifetimeBestSize: state.lifetimeBestSize,
    currentRun: cloneState(state.currentRun),
  };
}

let currentState: GiaNguaPersistentState = createInitialPersistentState();

export function loadState(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.lifetimeBestSize === 'number' &&
          parsed.currentRun &&
          typeof parsed.currentRun === 'object'
        ) {
          const run = parsed.currentRun;
          const validGear: GearItem[] = Array.isArray(run.gear)
            ? run.gear.filter((g: string) =>
                ['bamboo_whip', 'iron_armor', 'iron_hat', 'iron_sword'].includes(g)
              )
            : [];
          currentState = {
            lifetimeBestSize: Math.max(0, Math.min(5, Math.floor(parsed.lifetimeBestSize))),
            currentRun: {
              sizeStage: Math.max(0, Math.min(5, Math.floor(run.sizeStage || 0))),
              armorLevel: validGear.includes('iron_armor') ? 1 : 0,
              hunger: Math.max(0, Math.min(100, Math.floor(run.hunger || 0))),
              gear: validGear,
            },
          };
          if (currentState.currentRun.sizeStage > currentState.lifetimeBestSize) {
            currentState.lifetimeBestSize = currentState.currentRun.sizeStage;
          }
          return;
        }
      }
    }
  } catch (e) {
    console.warn('[GiaNgua] Failed to load state from localStorage:', e);
  }
  currentState = createInitialPersistentState();
}

export function saveState(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAVE_KEY, JSON.stringify(currentState));
    }
  } catch (e) {
    console.warn('[GiaNgua] Failed to save state to localStorage:', e);
  }
}

export function getGiaNguaState(): GiaNguaPersistentState {
  return clonePersistentState(currentState);
}

export function driveFeed(
  food: FoodType,
  isTool: boolean = false
): {
  state: GiaNguaPersistentState;
  message: string;
  effect: 'grow' | 'spit_smoke' | 'overfed';
} {
  const current = currentState.currentRun;

  if (food === 'pizza' || food === 'nuoc_ngot') {
    const message =
      food === 'pizza'
        ? 'Ngựa sắt nhổ phì pizza ra, xịt khói yếu ớt! Ngựa chỉ thích ăn cơm cà thôi!'
        : 'Ngựa sắt phun phì phì ra khói! Ngựa không uống nước ngọt, chỉ lớn nhờ cơm cà!';
    const effect: 'spit_smoke' = 'spit_smoke';
    const snapshot = getGiaNguaState();
    notifyChange({
      action: 'feed',
      effect,
      state: snapshot,
      message,
      isTool,
      extra: { food },
    });
    return { state: snapshot, message, effect };
  }

  // food === 'com_ca'
  current.hunger += 30;
  let effect: 'grow' | 'overfed' = 'grow';
  let message = '';

  if (current.hunger > 100) {
    current.hunger = 100;
    effect = 'overfed';
    message = 'Ợ... Ngựa sắt no nê quá mức rồi, ợ ra một luồng khói khét lẹt!';
  } else {
    if (current.sizeStage < 5) {
      current.sizeStage += 1;
      if (current.sizeStage > currentState.lifetimeBestSize) {
        currentState.lifetimeBestSize = current.sizeStage;
      }
      const stageName = SIZE_STAGE_NAMES[current.sizeStage]?.vi || `Cấp ${current.sizeStage}`;
      message = `Ngựa sắt ăn cơm cà ngon lành và lớn vụt lên! (${stageName} - ${current.sizeStage}/5)`;
    } else {
      message = 'Ngựa sắt đã đạt kích thước cực đại (Cấp 5/5 - Chiến mã thần thoại)!';
    }
  }

  saveState();
  const snapshot = getGiaNguaState();
  notifyChange({
    action: 'feed',
    effect,
    state: snapshot,
    message,
    isTool,
    extra: { food },
  });
  return { state: snapshot, message, effect };
}

export function driveEquip(
  item: GearItem,
  isTool: boolean = false
): {
  state: GiaNguaPersistentState;
  message: string;
  effect: 'equip' | 'already_wearing' | 'victory_dance';
} {
  const current = currentState.currentRun;
  current.hunger = Math.max(0, current.hunger - 10);

  if (current.gear.includes(item)) {
    const message = `Ngựa đang mặc cái này rồi!`;
    const effect: 'already_wearing' = 'already_wearing';
    saveState();
    const snapshot = getGiaNguaState();
    notifyChange({
      action: 'equip',
      effect,
      state: snapshot,
      message,
      isTool,
      extra: { item },
    });
    return { state: snapshot, message, effect };
  }

  current.gear.push(item);
  if (item === 'iron_armor') {
    current.armorLevel = 1;
  }

  let effect: 'equip' | 'victory_dance' = 'equip';
  let message = `Đã trang bị ${GEAR_NAMES[item]?.vi || item} cho Ngựa Sắt!`;

  if (current.gear.length === 4 && current.sizeStage === 5) {
    effect = 'victory_dance';
    message =
      'THẦN MÃ ĐÃ HOÀN TẤT! Ngựa sắt trang bị đủ 4 món thần khí và đạt kích thước tối đa, nhảy múa hoan ca sẵn sàng xuất trận!';
  }

  saveState();
  const snapshot = getGiaNguaState();
  notifyChange({
    action: 'equip',
    effect,
    state: snapshot,
    message,
    isTool,
    extra: { item },
  });
  return { state: snapshot, message, effect };
}

export function driveTestFire(
  duration: number,
  isTool: boolean = false
): {
  state: GiaNguaPersistentState;
  message: string;
  effect: 'fire';
} {
  const current = currentState.currentRun;
  const clampedDuration = Math.min(10, Math.max(1, Math.round(duration || 1)));
  current.hunger = Math.max(0, current.hunger - 10 * clampedDuration);

  saveState();
  const effect: 'fire' = 'fire';
  const message = `Ngựa sắt gầm vang trời đất, phun lửa rực cháy suốt ${clampedDuration} giây!`;
  const snapshot = getGiaNguaState();
  notifyChange({
    action: 'test_fire',
    effect,
    state: snapshot,
    message,
    isTool,
    extra: { duration: clampedDuration },
  });
  return { state: snapshot, message, effect };
}

export function driveReset(): GiaNguaPersistentState {
  currentState.currentRun = createInitialRunState();
  saveState();
  const snapshot = getGiaNguaState();
  notifyChange({
    action: 'reset',
    state: snapshot,
    message: 'Đã thiết lập lại trạng thái ban đầu của Ngựa Sắt. Kỷ lục lớn nhất vẫn được lưu giữ!',
  });
  return snapshot;
}

// Initial state load
loadState();
