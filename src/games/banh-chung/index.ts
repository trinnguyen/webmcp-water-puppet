import type { GameDef } from '../../types';
import { buildBanhChungScene, destroyBanhChungScene } from './scene';
import { banhChungTools } from './tools';

export const banhChungDef: GameDef = {
  id: 'banh-chung',
  name: 'Bánh chưng',
  nameEn: 'Sticky Rice Cake',
  emoji: '🟩',
  minPlayers: 1,
  maxPlayers: 1,
  description: 'Gói bánh chưng siêu tốc! Chọn đúng tỷ lệ nếp, đậu, thịt để có chiếc bánh hoàn hảo.',
  buildScene: buildBanhChungScene,
  destroyScene: destroyBanhChungScene,
  tools: banhChungTools,
  saveKey: 'san_choi_banh_chung',
};
