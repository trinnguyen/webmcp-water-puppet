import { buildScene, destroyScene } from './scene';
import { tools } from './tools';
import type { GameDef } from '../../types';

export const sonTinhDef: GameDef = {
  id: 'son-tinh',
  name: 'Nhà Sơn Tinh chống Thủy Tinh',
  nameEn: "Sơn Tinh's Smart Home",
  emoji: '🏔️',
  minPlayers: 1,
  maxPlayers: 1,
  description: 'Giúp Sơn Tinh dùng phép thuật chống lũ lụt từ Thủy Tinh (Help Sơn Tinh defend against Thủy Tinh\'s floods).',
  buildScene,
  destroyScene,
  tools,
  saveKey: 'san_choi_son_tinh',
};
