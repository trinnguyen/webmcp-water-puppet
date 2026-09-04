import type { GameDef } from '../../types';
import { buildDanhQuayScene, destroyDanhQuayScene } from './scene';
import { danhQuayTools } from './tools';

export const danhQuayDef: GameDef = {
  id: 'danh-quay',
  name: 'Đánh quay',
  nameEn: 'Spinning Top',
  emoji: '🌀',
  minPlayers: 1,
  maxPlayers: 1,
  description: 'Trò chơi đánh quay truyền thống. Quất roi để duy trì năng lượng, biểu diễn kỹ năng và ghi điểm!',
  buildScene: buildDanhQuayScene,
  destroyScene: destroyDanhQuayScene,
  tools: danhQuayTools,
  saveKey: 'san_choi_danh_quay',
};
