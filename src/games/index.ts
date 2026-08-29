import type { GameDef } from '../types';
import { oAnQuanDef } from './o-an-quan';
import { bauCuaDef } from './bau-cua';

export const games: GameDef[] = [oAnQuanDef, bauCuaDef];

export function getGameById(id: string): GameDef | undefined {
  return games.find((g) => g.id === id);
}
