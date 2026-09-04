import type { GameDef } from '../types';
import { oAnQuanDef } from './o-an-quan';
import { bauCuaDef } from './bau-cua';
import { waterPuppetDef } from './water-puppet';
import { giaNguaDef } from './gia-ngua';
import { rongRanDef } from './rong-ran';
import { banhChungDef } from './banh-chung';

export const games: GameDef[] = [oAnQuanDef, bauCuaDef, waterPuppetDef, giaNguaDef, rongRanDef, banhChungDef];

export function getGameById(id: string): GameDef | undefined {
  return games.find((g) => g.id === id);
}
