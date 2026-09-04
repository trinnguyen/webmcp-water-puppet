import type { GameDef } from '../../types';
import { buildRongRanScene, destroyRongRanScene } from './scene';
import { rongRanTools } from './tools';

export const rongRanDef: GameDef = {
  id: 'rong-ran',
  name: 'Rồng rắn lên mây',
  nameEn: 'Dragon Snake',
  emoji: '🐉',
  minPlayers: 1,
  maxPlayers: 1,
  description: 'Trò chơi đồng dao đuổi bắt. Thầy thuốc đuổi bắt khúc đuôi của rồng rắn dài thoòng lọng!',
  buildScene: buildRongRanScene,
  destroyScene: destroyRongRanScene,
  tools: rongRanTools,
  saveKey: 'san_choi_rong_ran',
};
