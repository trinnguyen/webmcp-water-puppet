import type { GameDef } from '../types';
import { oAnQuanDef } from './o-an-quan';
import { bauCuaDef } from './bau-cua';
import { waterPuppetDef } from './water-puppet';
import { giaNguaDef } from './gia-ngua';
import { rongRanDef } from './rong-ran';
import { sonTinhDef } from './son-tinh';
import { banhChungDef } from './banh-chung';
import { danhQuayDef } from './danh-quay';

export const games: GameDef[] = [oAnQuanDef, bauCuaDef, waterPuppetDef, giaNguaDef, rongRanDef, sonTinhDef, banhChungDef, danhQuayDef];

export function getGameById(id: string): GameDef | undefined {
  return games.find((g) => g.id === id);
}
