import type { GameDef } from '../../types';
import { buildOAQScene, destroyOAQScene } from './scene';
import { oaqTools } from './tools';

export const oAnQuanDef: GameDef = {
  id: 'o-an-quan',
  name: 'Ô ăn quan',
  nameEn: 'Vietnamese Mancala',
  emoji: '🪨',
  minPlayers: 2,
  maxPlayers: 2,
  description: "A classic Vietnamese strategy game. Two players take turns scooping seeds and capturing opponents' pits. The player with the most seeds wins!",
  buildScene: buildOAQScene,
  destroyScene: destroyOAQScene,
  tools: oaqTools,
  saveKey: 'san_choi_oaq',
};
