/**
 * Pure state model for Múa rối nước (Water Puppet Theatre).
 * Contains pure functions and immutable state transitions only: no DOM, no timers.
 */

export interface PuppetState {
  id: string;
  name: string;
  assetType: 'svg' | 'emoji';
  assetId: string;
  x: number;
  y: number;
  visible: boolean;
  action: string | null;
}

export interface ShowState {
  status: 'idle' | 'playing' | 'finished';
  currentTale: string | null;
  applause: number; // 0 to 100
  puppets: Record<string, PuppetState>;
  weather: 'clear' | 'rain';
  stageEffects: string[];
}

export interface TaleCharacter {
  id: string;
  name: string;
  asset: string;
  role: string;
  defaultX: number;
}

export interface Tale {
  id: string;
  title: string;
  titleEn: string;
  synopsis: string;
  cast: TaleCharacter[];
  recommendedEffects: string[];
}

export const TALES: Tale[] = [
  {
    id: 'coc-kien-troi',
    title: 'Cóc kiện Trời',
    titleEn: 'Toad Sues Heaven',
    synopsis: 'Hạn hán kéo dài, Cóc cùng các bạn muông thú lên thiên đình đòi mưa cứu muôn loài.',
    cast: [
      { id: 'coc', name: 'Chú Cóc', asset: '🐸', role: 'Dũng sĩ đòi mưa', defaultX: 25 },
      { id: 'cua', name: 'Bác Cua', asset: '🦀', role: 'Đồng minh kẹp càng', defaultX: 45 },
      { id: 'ong-troi', name: 'Ngọc Hoàng', asset: '👑', role: 'Vua trời ban mưa', defaultX: 75 },
    ],
    recommendedEffects: ['splash', 'rain', 'fireworks'],
  },
  {
    id: 'tam-cam',
    title: 'Tấm Cám',
    titleEn: 'Tam & Cam',
    synopsis: 'Câu chuyện cô Tấm hiền lành nuôi bống bên giếng nước và ước mơ hạnh phúc ngày hội làng.',
    cast: [
      { id: 'tam', name: 'Cô Tấm', asset: '🌸', role: 'Cô gái hiền hậu', defaultX: 25 },
      { id: 'ca-bong', name: 'Cá Bống', asset: 'fish', role: 'Bạn nhỏ dưới giếng', defaultX: 50 },
      { id: 'but', name: 'Ông Bụt', asset: '🧙‍♂️', role: 'Vị tiên ban phép lành', defaultX: 75 },
    ],
    recommendedEffects: ['splash', 'dance', 'fireworks'],
  },
  {
    id: 'rong-ca',
    title: 'Rồng & Cá',
    titleEn: 'Dragon & Carp',
    synopsis: 'Cá chép vượt Vũ Môn hóa rồng phun mưa phước lành, chú Tễu xướng khúc hoan ca.',
    cast: [
      { id: 'teu', name: 'Chú Tễu', asset: 'teu', role: 'Người xướng trò rộn rã', defaultX: 18 },
      { id: 'ca-chep', name: 'Cá Chép', asset: 'fish', role: 'Cá chép vượt Vũ Môn', defaultX: 45 },
      { id: 'rong', name: 'Rồng Vàng', asset: 'dragon', role: 'Thần rồng bay lượn', defaultX: 72 },
      { id: 'nong-dan', name: 'Nông Dân', asset: 'farmer', role: 'Dân làng mừng hội', defaultX: 86 },
    ],
    recommendedEffects: ['splash', 'dance', 'rain', 'fireworks'],
  },
];

const KNOWN_SVGS = new Set(['teu', 'dragon', 'fish', 'farmer']);

export function getTaleById(id: string): Tale | undefined {
  return TALES.find((t) => t.id === id);
}

export function resolveAsset(asset: string): { assetType: 'svg' | 'emoji'; assetId: string } {
  const clean = asset.trim().toLowerCase();
  if (KNOWN_SVGS.has(clean)) {
    return { assetType: 'svg', assetId: clean };
  }
  return { assetType: 'emoji', assetId: asset.trim() };
}

export function cloneState(state: ShowState): ShowState {
  return {
    status: state.status,
    currentTale: state.currentTale,
    applause: state.applause,
    puppets: Object.fromEntries(
      Object.entries(state.puppets).map(([k, v]) => [k, { ...v }])
    ),
    weather: state.weather,
    stageEffects: [...state.stageEffects],
  };
}

export function createInitialState(): ShowState {
  return {
    status: 'idle',
    currentTale: null,
    applause: 0,
    puppets: {},
    weather: 'clear',
    stageEffects: [],
  };
}

export function startShow(taleId: string): ShowState {
  return {
    status: 'playing',
    currentTale: taleId,
    applause: 15,
    puppets: {},
    weather: 'clear',
    stageEffects: [],
  };
}

export function boostApplause(state: ShowState, amount: number): ShowState {
  const next = cloneState(state);
  next.applause = Math.max(0, Math.min(100, next.applause + amount));
  return next;
}

export function spawnPuppet(
  state: ShowState,
  id: string,
  name: string,
  asset: string,
  x: number
): ShowState {
  const next = cloneState(state);
  const { assetType, assetId } = resolveAsset(asset);
  const clampedX = Math.max(5, Math.min(95, Math.round(x)));
  next.puppets[id] = {
    id,
    name,
    assetType,
    assetId,
    x: clampedX,
    y: 0,
    visible: true,
    action: 'emerge',
  };
  return boostApplause(next, 6);
}

export function movePuppet(state: ShowState, id: string, targetX: number): ShowState {
  const next = cloneState(state);
  const puppet = next.puppets[id];
  if (!puppet) return next;
  const clampedX = Math.max(5, Math.min(95, Math.round(targetX)));
  puppet.x = clampedX;
  puppet.action = 'move';
  return boostApplause(next, 3);
}

export function setPuppetAction(
  state: ShowState,
  id: string,
  action: string
): ShowState {
  const next = cloneState(state);
  const puppet = next.puppets[id];
  if (!puppet) return next;
  puppet.action = action;
  if (action === 'hide' || action === 'dive') {
    puppet.visible = false;
  } else if (action === 'emerge' || action === 'show') {
    puppet.visible = true;
  }

  let boost = 6;
  if (action === 'dance' || action === 'dragon-dance') boost = 12;
  else if (action === 'jump' || action === 'splash') boost = 9;
  return boostApplause(next, boost);
}

export function triggerEffect(state: ShowState, effect: string): ShowState {
  const next = cloneState(state);
  const cleanEffect = effect.toLowerCase().trim();
  if (cleanEffect === 'rain') {
    next.weather = 'rain';
  } else if (cleanEffect === 'clear') {
    next.weather = 'clear';
  }
  next.stageEffects = [...next.stageEffects.slice(-4), cleanEffect];

  let boost = 8;
  if (cleanEffect === 'fireworks') boost = 15;
  else if (cleanEffect === 'rain') boost = 12;
  else if (cleanEffect === 'splash') boost = 10;
  else if (cleanEffect === 'dance' || cleanEffect === 'dragon-dance') boost = 12;
  return boostApplause(next, boost);
}

export function finishShow(state: ShowState): ShowState {
  const next = cloneState(state);
  next.status = 'finished';
  return next;
}

export interface ShowRating {
  stars: number;
  labelVi: string;
  badge: string;
}

export function getShowRating(applause: number): ShowRating {
  if (applause >= 80) {
    return { stars: 3, labelVi: 'Xuất sắc! Đại hoan hô!', badge: '⭐⭐⭐' };
  } else if (applause >= 50) {
    return { stars: 2, labelVi: 'Rất hay! Vỗ tay rộn rã!', badge: '⭐⭐' };
  } else if (applause >= 20) {
    return { stars: 1, labelVi: 'Hay lắm! Khán giả thích thú!', badge: '⭐' };
  } else {
    return { stars: 0, labelVi: 'Đáng yêu! Khán giả reo vui!', badge: '👏' };
  }
}
