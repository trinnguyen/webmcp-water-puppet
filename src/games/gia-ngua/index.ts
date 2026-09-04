import { buildScene, destroyScene } from './scene';
import { tools } from './tools';
import type { GameDef } from '../../types';

export const giaNguaDef: GameDef = {
  id: 'gia-ngua',
  name: 'Gara Ngựa Sắt',
  nameEn: "Gióng's Iron Garage",
  emoji: '🐎',
  minPlayers: 1,
  maxPlayers: 1,
  description: 'Giúp Thánh Gióng nuôi và nâng cấp Ngựa Sắt (Help Gióng feed and upgrade his Iron Horse).',
  buildScene,
  destroyScene,
  tools,
  saveKey: 'san_choi_gia_ngua',
};
