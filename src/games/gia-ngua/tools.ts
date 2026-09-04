import type { GameToolDef } from '../../types';
import type { FoodType, GearItem } from './rules';
import {
  getGiaNguaState,
  driveFeed,
  driveEquip,
  driveTestFire,
  driveReset,
} from './rules';

export const tools: GameToolDef[] = [
  {
    name: 'gia_ngua_inspect',
    description: "Inspect the Iron Horse's current size, armor, hunger, and gear.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => {
      const state = getGiaNguaState();
      return JSON.stringify({
        status: 'ok',
        showState: state,
      });
    },
  },
  {
    name: 'gia_ngua_feed',
    description: 'Feed the horse. "com_ca" grows it; "pizza"/"nuoc_ngot" makes it spit smoke.',
    inputSchema: {
      type: 'object',
      properties: {
        food: {
          type: 'string',
          enum: ['com_ca', 'pizza', 'nuoc_ngot'],
          description: "Food type: 'com_ca' (cơm cà), 'pizza', or 'nuoc_ngot' (nước ngọt)",
        },
      },
      required: ['food'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { food: FoodType }) => {
      try {
        if (!input || !['com_ca', 'pizza', 'nuoc_ngot'].includes(input.food)) {
          return JSON.stringify({
            status: 'error',
            message: `Món ăn không hợp lệ: '${input?.food}'. Hãy chọn 'com_ca', 'pizza' hoặc 'nuoc_ngot'.`,
          });
        }
        const res = driveFeed(input.food, true);
        return JSON.stringify({
          status: 'ok',
          message: res.message,
          effect: res.effect,
          showState: res.state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi cho ngựa ăn',
        });
      }
    },
  },
  {
    name: 'gia_ngua_equip',
    description: 'Equip gear: bamboo_whip, iron_armor, iron_hat, iron_sword.',
    inputSchema: {
      type: 'object',
      properties: {
        item: {
          type: 'string',
          enum: ['bamboo_whip', 'iron_armor', 'iron_hat', 'iron_sword'],
          description: "Gear item: 'bamboo_whip' (roi tre), 'iron_armor' (giáp sắt), 'iron_hat' (mũ sắt), or 'iron_sword' (kiếm sắt)",
        },
      },
      required: ['item'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { item: GearItem }) => {
      try {
        if (
          !input ||
          !['bamboo_whip', 'iron_armor', 'iron_hat', 'iron_sword'].includes(input.item)
        ) {
          return JSON.stringify({
            status: 'error',
            message: `Trang bị không hợp lệ: '${input?.item}'. Hãy chọn 'bamboo_whip', 'iron_armor', 'iron_hat' hoặc 'iron_sword'.`,
          });
        }
        const res = driveEquip(input.item, true);
        return JSON.stringify({
          status: 'ok',
          message: res.message,
          effect: res.effect,
          showState: res.state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi trang bị cho ngựa',
        });
      }
    },
  },
  {
    name: 'gia_ngua_test_fire',
    description: 'Test fire breath (clamp duration 1-10s).',
    inputSchema: {
      type: 'object',
      properties: {
        duration_seconds: {
          type: 'number',
          minimum: 1,
          maximum: 10,
          description: 'Duration of fire breath in seconds (1 to 10)',
        },
      },
      required: ['duration_seconds'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { duration_seconds: number }) => {
      try {
        const raw = typeof input?.duration_seconds === 'number' ? input.duration_seconds : 3;
        const clamped = Math.min(10, Math.max(1, Math.round(raw)));
        const res = driveTestFire(clamped, true);
        return JSON.stringify({
          status: 'ok',
          message: res.message,
          effect: 'fire',
          showState: res.state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi thử phun lửa',
        });
      }
    },
  },
  {
    name: 'gia_ngua_state',
    description: 'Read full JSON state.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => {
      const state = getGiaNguaState();
      return JSON.stringify({
        status: 'ok',
        state,
      });
    },
  },
  {
    name: 'gia_ngua_reset',
    description: 'Reset run, keeps lifetime best size.',
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
          message: 'Đã thiết lập lại trạng thái ban đầu của Ngựa Sắt.',
          showState: state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi thiết lập lại',
        });
      }
    },
  },
];
