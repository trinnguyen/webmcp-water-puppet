import type { GameToolDef } from '../../types';
import type { DefenseType, GiftAnimal } from './rules';
import {
  getSonTinhState,
  deployDefense,
  summonGift,
  readMessages,
  endSeason,
  driveReset,
} from './rules';

export const tools: GameToolDef[] = [
  {
    name: 'son_tinh_status',
    description: 'Current water level, mountain height, threat, points, inventory.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => {
      try {
        const state = getSonTinhState();
        return JSON.stringify({
          status: 'ok',
          showState: state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi kiểm tra trạng thái Sơn Tinh',
        });
      }
    },
  },
  {
    name: 'son_tinh_deploy_defense',
    description:
      'Spend points raising the voxel mountain. Types: dirt (cheap/low), rock (pricey/strong), magic_net (rare/multiplier).',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['dirt', 'rock', 'magic_net'],
          description: "Defense type: 'dirt' (+5m, 10pts), 'rock' (+10m, 25pts), or 'magic_net' (+15m, 50pts)",
        },
        height_increase: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          description: 'Number of layers to build (1 to 5)',
        },
      },
      required: ['type', 'height_increase'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { type: DefenseType; height_increase: number }) => {
      try {
        if (!input || !['dirt', 'rock', 'magic_net'].includes(input.type)) {
          return JSON.stringify({
            status: 'error',
            message: `Loại phòng thủ không hợp lệ: '${input?.type}'. Hãy chọn 'dirt', 'rock' hoặc 'magic_net'.`,
          });
        }
        const heightInc =
          typeof input.height_increase === 'number'
            ? Math.max(1, Math.min(5, Math.floor(input.height_increase)))
            : 1;

        const res = deployDefense(input.type, heightInc, true);
        return JSON.stringify({
          status: res.effect === 'no_points' ? 'error' : 'ok',
          message: res.message,
          effect: res.effect,
          showState: res.state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi xây dựng phòng tuyến',
        });
      }
    },
  },
  {
    name: 'son_tinh_summon_gift',
    description:
      'Summon wedding-gift animal buff: voi_9_nga, ga_9_cua, ngua_thep, roi_that.',
    inputSchema: {
      type: 'object',
      properties: {
        animal: {
          type: 'string',
          enum: ['voi_9_nga', 'ga_9_cua', 'ngua_thep', 'roi_that'],
          description: "Wedding gift animal: 'voi_9_nga' (+15), 'ga_9_cua' (+10), 'ngua_thep' (+20), 'roi_that' (+5)",
        },
      },
      required: ['animal'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { animal: GiftAnimal }) => {
      try {
        if (
          !input ||
          !['voi_9_nga', 'ga_9_cua', 'ngua_thep', 'roi_that'].includes(input.animal)
        ) {
          return JSON.stringify({
            status: 'error',
            message: `Lễ vật không hợp lệ: '${input?.animal}'. Hãy chọn 'voi_9_nga', 'ga_9_cua', 'ngua_thep' hoặc 'roi_that'.`,
          });
        }
        const res = summonGift(input.animal, true);
        return JSON.stringify({
          status: 'ok',
          message: res.message,
          showState: res.state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi triệu hồi lễ vật',
        });
      }
    },
  },
  {
    name: 'son_tinh_read_messages',
    description: "Read Thủy Tinh's angry texts.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => {
      try {
        const messages = readMessages();
        return JSON.stringify({
          status: 'ok',
          messages,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi đọc tin nhắn của Thủy Tinh',
        });
      }
    },
  },
  {
    name: 'son_tinh_end_season',
    description:
      'End the current flood season. Survive waves → score. Submerged → funny defeat.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      try {
        const res = endSeason(true);
        return JSON.stringify({
          status: 'ok',
          message: res.message,
          score: res.score,
          showState: res.state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi kết thúc mùa lũ',
        });
      }
    },
  },
  {
    name: 'son_tinh_reset',
    description: 'Reset current flood run, keeps lifetime best waves.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      try {
        const state = driveReset();
        return JSON.stringify({
          status: 'ok',
          message: 'Đã thiết lập lại mùa lũ của Sơn Tinh.',
          showState: state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi đặt lại trạng thái',
        });
      }
    },
  },
];
