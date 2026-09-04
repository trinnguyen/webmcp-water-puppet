/**
 * Pure state model and deterministic game logic for "Bánh Chưng" (AUT-40).
 * Contains ONLY deterministic, pure functions with no DOM, timers, or probability.
 */

export type Ingredient = 'nep' | 'dau_xanh' | 'thit_mo';

export interface DropItem {
  id: string;
  type: Ingredient;
  mass_kg: number;
}

export interface BanhChungState {
  status: 'packing' | 'perfect' | 'failed' | 'exploded';
  items: DropItem[];
  totalMass: number;
  nepMass: number;
  dauMass: number;
  thitMass: number;
}

export interface BanhChungPersistentState {
  lifetimeWins: number;
  lifetimeTries: number;
  bestRatioScore: number | null; // lower is better (sum of absolute % errors)
  currentRun: BanhChungState;
}

export const SAVE_KEY = 'san_choi_banh_chung';
export const MAX_CAPACITY_KG = 10;
export const TARGET_RATIO = { nep: 0.5, dau_xanh: 0.25, thit_mo: 0.25 };
export const RATIO_TOLERANCE = 0.1;

export const INGREDIENT_NAMES: Record<Ingredient, { vi: string; en: string; emoji: string }> = {
  nep: { vi: 'Gạo nếp', en: 'Glutinous Rice', emoji: '🍚' },
  dau_xanh: { vi: 'Đậu xanh', en: 'Mung Bean', emoji: '🟡' },
  thit_mo: { vi: 'Thịt mỡ', en: 'Pork Belly', emoji: '🥩' },
};

export interface BanhChungChangeEvent {
  action: 'drop' | 'fold_and_boil' | 'reset' | 'load';
  effect?: 'drop' | 'giant_cube_explosion' | 'win_gold_hat' | 'explosion' | 'fail';
  state: BanhChungPersistentState;
  message?: string;
  isTool?: boolean;
  extra?: unknown;
}

export type BanhChungChangeListener = (event: BanhChungChangeEvent) => void;

const listeners: Set<BanhChungChangeListener> = new Set();

export function onBanhChungChange(listener: BanhChungChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyChange(event: BanhChungChangeEvent): void {
  for (const l of listeners) {
    try {
      l(event);
    } catch (e) {
      console.error('[BanhChung] Listener error:', e);
    }
  }
}

export function createInitialRunState(): BanhChungState {
  return {
    status: 'packing',
    items: [],
    totalMass: 0,
    nepMass: 0,
    dauMass: 0,
    thitMass: 0,
  };
}

export function createInitialPersistentState(): BanhChungPersistentState {
  return {
    lifetimeWins: 0,
    lifetimeTries: 0,
    bestRatioScore: null,
    currentRun: createInitialRunState(),
  };
}

export function cloneRunState(state: BanhChungState): BanhChungState {
  return {
    ...state,
    items: state.items.map((it) => ({ ...it })),
  };
}

export function clonePersistentState(state: BanhChungPersistentState): BanhChungPersistentState {
  return {
    ...state,
    currentRun: cloneRunState(state.currentRun),
  };
}

let currentState: BanhChungPersistentState = createInitialPersistentState();

export function loadState(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const run = parsed.currentRun;
          const validItems: DropItem[] = Array.isArray(run?.items)
            ? run.items.filter(
                (it: any) =>
                  it &&
                  typeof it.id === 'string' &&
                  ['nep', 'dau_xanh', 'thit_mo'].includes(it.type) &&
                  typeof it.mass_kg === 'number'
              )
            : [];
          const validStatus = ['packing', 'perfect', 'failed', 'exploded'].includes(run?.status)
            ? run.status
            : 'packing';

          currentState = {
            lifetimeWins: typeof parsed.lifetimeWins === 'number' ? Math.max(0, parsed.lifetimeWins) : 0,
            lifetimeTries: typeof parsed.lifetimeTries === 'number' ? Math.max(0, parsed.lifetimeTries) : 0,
            bestRatioScore: typeof parsed.bestRatioScore === 'number' ? parsed.bestRatioScore : null,
            currentRun: {
              status: validStatus,
              items: validItems,
              totalMass: typeof run?.totalMass === 'number' ? run.totalMass : 0,
              nepMass: typeof run?.nepMass === 'number' ? run.nepMass : 0,
              dauMass: typeof run?.dauMass === 'number' ? run.dauMass : 0,
              thitMass: typeof run?.thitMass === 'number' ? run.thitMass : 0,
            },
          };
          return;
        }
      }
    }
  } catch (e) {
    console.warn('[BanhChung] Failed to load state from localStorage:', e);
  }
  currentState = createInitialPersistentState();
}

export function saveState(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAVE_KEY, JSON.stringify(currentState));
    }
  } catch (e) {
    console.warn('[BanhChung] Failed to save state to localStorage:', e);
  }
}

export function getBanhChungState(): BanhChungPersistentState {
  return clonePersistentState(currentState);
}

export function getBanhChungAnalysis(state: BanhChungState) {
  const total = state.totalMass;
  const nPct = total > 0 ? state.nepMass / total : 0;
  const dPct = total > 0 ? state.dauMass / total : 0;
  const tPct = total > 0 ? state.thitMass / total : 0;
  const error =
    total > 0
      ? Math.abs(nPct - TARGET_RATIO.nep) +
        Math.abs(dPct - TARGET_RATIO.dau_xanh) +
        Math.abs(tPct - TARGET_RATIO.thit_mo)
      : null;
  const isBalanced =
    total > 0 &&
    Math.abs(nPct - TARGET_RATIO.nep) <= RATIO_TOLERANCE &&
    Math.abs(dPct - TARGET_RATIO.dau_xanh) <= RATIO_TOLERANCE &&
    Math.abs(tPct - TARGET_RATIO.thit_mo) <= RATIO_TOLERANCE &&
    total <= MAX_CAPACITY_KG;

  return {
    status: state.status,
    totalMassKg: total,
    maxCapacityKg: MAX_CAPACITY_KG,
    isOverfilled: total > MAX_CAPACITY_KG,
    nepMassKg: state.nepMass,
    dauMassKg: state.dauMass,
    thitMassKg: state.thitMass,
    percentages: {
      nep: Math.round(nPct * 1000) / 10,
      dau_xanh: Math.round(dPct * 1000) / 10,
      thit_mo: Math.round(tPct * 1000) / 10,
    },
    targetPercentages: {
      nep: 50,
      dau_xanh: 25,
      thit_mo: 25,
    },
    tolerance: '±10%',
    isBalanced,
    ratioScore: error !== null ? Math.round(error * 10000) / 10000 : null,
  };
}

export function driveDropIngredient(
  type: Ingredient,
  mass_kg: number,
  isTool: boolean = false
): {
  state: BanhChungPersistentState;
  message: string;
  effect: 'drop' | 'giant_cube_explosion';
} {
  const validTypes: Ingredient[] = ['nep', 'dau_xanh', 'thit_mo'];
  if (!validTypes.includes(type)) {
    throw new Error(`Nguyên liệu không hợp lệ: '${type}'. Hãy chọn 'nep', 'dau_xanh' hoặc 'thit_mo'.`);
  }

  const rawMass = typeof mass_kg === 'number' && !isNaN(mass_kg) ? mass_kg : 1;
  const clampedMass = Math.round(Math.max(0.1, Math.min(100, rawMass)) * 10) / 10;

  // If previous run was completed or exploded, start fresh. If failed, allow adjusting.
  if (currentState.currentRun.status === 'perfect' || currentState.currentRun.status === 'exploded') {
    currentState.currentRun = createInitialRunState();
  } else if (currentState.currentRun.status === 'failed') {
    currentState.currentRun.status = 'packing';
  }

  const current = currentState.currentRun;
  const item: DropItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    mass_kg: clampedMass,
  };
  current.items.push(item);

  if (type === 'nep') {
    current.nepMass = Math.round((current.nepMass + clampedMass) * 100) / 100;
  } else if (type === 'dau_xanh') {
    current.dauMass = Math.round((current.dauMass + clampedMass) * 100) / 100;
  } else if (type === 'thit_mo') {
    current.thitMass = Math.round((current.thitMass + clampedMass) * 100) / 100;
  }
  current.totalMass = Math.round((current.nepMass + current.dauMass + current.thitMass) * 100) / 100;

  // Funny Hook: 100kg thit_mo -> explosion
  if (type === 'thit_mo' && clampedMass >= 100) {
    current.status = 'exploded';
    const message = 'Trời ơi! 100kg thịt mỡ rơi thẳng vào lá dong! Quá nhiều cholesterol làm nổ tung cả nồi bánh!';
    saveState();
    const snapshot = getBanhChungState();
    notifyChange({
      action: 'drop',
      effect: 'giant_cube_explosion',
      state: snapshot,
      message,
      isTool,
      extra: { item, clampedMass },
    });
    return { state: snapshot, message, effect: 'giant_cube_explosion' };
  }

  current.status = 'packing';
  const nameVi = INGREDIENT_NAMES[type].vi;
  const message = `Đã thêm ${clampedMass}kg ${nameVi} vào khuôn. Tổng khối lượng: ${current.totalMass}kg.`;
  saveState();
  const snapshot = getBanhChungState();
  notifyChange({
    action: 'drop',
    effect: 'drop',
    state: snapshot,
    message,
    isTool,
    extra: { item, clampedMass },
  });
  return { state: snapshot, message, effect: 'drop' };
}

export function driveFoldAndBoil(
  isTool: boolean = false
): {
  state: BanhChungPersistentState;
  message: string;
  effect: 'win_gold_hat' | 'explosion' | 'fail';
} {
  currentState.lifetimeTries += 1;
  const current = currentState.currentRun;

  if (current.totalMass <= 0) {
    current.status = 'failed';
    const effect = 'fail' as const;
    const message = 'Chưa có nguyên liệu nào trong lá dong! Hãy cho gạo nếp, đậu xanh và thịt mỡ vào khuôn trước khi gói.';
    saveState();
    const snapshot = getBanhChungState();
    notifyChange({ action: 'fold_and_boil', effect, state: snapshot, message, isTool });
    return { state: snapshot, message, effect };
  }

  if (current.totalMass > MAX_CAPACITY_KG) {
    current.status = 'exploded';
    const effect = 'explosion' as const;
    const message = `Bánh chưng quá đầy (${current.totalMass}kg vượt quá sức chứa ${MAX_CAPACITY_KG}kg)! Lá dong bị rách toạc và bánh nổ tung!`;
    saveState();
    const snapshot = getBanhChungState();
    notifyChange({ action: 'fold_and_boil', effect, state: snapshot, message, isTool });
    return { state: snapshot, message, effect };
  }

  const nPct = current.nepMass / current.totalMass;
  const dPct = current.dauMass / current.totalMass;
  const tPct = current.thitMass / current.totalMass;
  const error =
    Math.abs(nPct - TARGET_RATIO.nep) +
    Math.abs(dPct - TARGET_RATIO.dau_xanh) +
    Math.abs(tPct - TARGET_RATIO.thit_mo);

  const isWin =
    Math.abs(nPct - TARGET_RATIO.nep) <= RATIO_TOLERANCE &&
    Math.abs(dPct - TARGET_RATIO.dau_xanh) <= RATIO_TOLERANCE &&
    Math.abs(tPct - TARGET_RATIO.thit_mo) <= RATIO_TOLERANCE;

  if (isWin) {
    current.status = 'perfect';
    currentState.lifetimeWins += 1;
    const roundedScore = Math.round(error * 10000) / 10000;
    if (currentState.bestRatioScore === null || roundedScore < currentState.bestRatioScore) {
      currentState.bestRatioScore = roundedScore;
    }
    const effect = 'win_gold_hat' as const;
    const message = `Bánh chưng vuông vức hoàn hảo! Tỷ lệ nếp ${(nPct * 100).toFixed(1)}%, đậu ${(dPct * 100).toFixed(1)}%, thịt ${(tPct * 100).toFixed(1)}% đạt chuẩn Lang Liêu! Bạn nhận được Mũ Vàng Vua Hùng!`;
    saveState();
    const snapshot = getBanhChungState();
    notifyChange({ action: 'fold_and_boil', effect, state: snapshot, message, isTool });
    return { state: snapshot, message, effect };
  }

  current.status = 'failed';
  const effect = 'fail' as const;
  const message = `Bánh chưng chưa đạt chuẩn Lang Liêu! Tỷ lệ hiện tại: Nếp ${(nPct * 100).toFixed(1)}% (chuẩn 50%±10%), Đậu ${(dPct * 100).toFixed(1)}% (chuẩn 25%±10%), Thịt ${(tPct * 100).toFixed(1)}% (chuẩn 25%±10%). Hãy dọn lại hoặc thêm nguyên liệu để cân bằng!`;
  saveState();
  const snapshot = getBanhChungState();
  notifyChange({ action: 'fold_and_boil', effect, state: snapshot, message, isTool });
  return { state: snapshot, message, effect };
}

export function driveReset(): BanhChungPersistentState {
  currentState.currentRun = createInitialRunState();
  saveState();
  const snapshot = getBanhChungState();
  notifyChange({
    action: 'reset',
    state: snapshot,
    message: 'Đã dọn sạch khuôn bánh chưng để gói chiếc mới. Các chỉ số kỷ lục vẫn được giữ nguyên!',
  });
  return snapshot;
}

// Initial state load
loadState();
