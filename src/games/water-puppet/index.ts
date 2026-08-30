import type { GameDef } from '../../types';
import { buildWaterPuppetScene, destroyWaterPuppetScene } from './scene';

export const waterPuppetDef: GameDef = {
  id: 'water-puppet',
  name: 'Múa rối nước',
  nameEn: 'Water Puppet Theatre',
  emoji: '🎭',
  minPlayers: 1,
  maxPlayers: 1,
  description: 'Sân khấu rối nước dân gian bên hồ nước mùa lễ hội. Sắp ra mắt — ngắm thử cảnh nước và các nhân vật rối.',
  buildScene: buildWaterPuppetScene,
  destroyScene: destroyWaterPuppetScene,
  tools: [],
  saveKey: '',
};
