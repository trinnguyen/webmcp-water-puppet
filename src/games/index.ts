import type { GameDef } from '../types';
import { oAnQuanDef } from './o-an-quan';
import { bauCuaDef } from './bau-cua';
import { waterPuppetDef } from './water-puppet';

export const games: GameDef[] = [oAnQuanDef, bauCuaDef, waterPuppetDef];

export function getGameById(id: string): GameDef | undefined {
  return games.find((g) => g.id === id);
}
