import type { GameDef } from '../../types';
import { buildBauCuaScene, destroyBauCuaScene } from './scene';
import { bauCuaTools } from './tools';

export const bauCuaDef: GameDef = {
  id: 'bau-cua',
  name: 'Bầu cua tôm cá',
  nameEn: 'Gourd-Crab-Shrimp-Fish',
  emoji: '🦀',
  minPlayers: 1,
  maxPlayers: 6,
  description: 'The classic Vietnamese Tết dice game! Bet fake points on 6 animal symbols, roll 3 dice, and win 1x/2x/3x your stake based on how many dice match.',
  buildScene: buildBauCuaScene,
  destroyScene: destroyBauCuaScene,
  tools: bauCuaTools,
  saveKey: 'san_choi_baucua',
};
