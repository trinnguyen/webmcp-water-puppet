import type { GameToolDef } from '../../types';
import type { Ingredient } from './rules';
import {
  getBanhChungState,
  getBanhChungAnalysis,
  driveDropIngredient,
  driveFoldAndBoil,
  driveReset,
} from './rules';
import { triggerSceneEffect } from './scene';

export const banhChungTools: GameToolDef[] = [
  {
    name: 'banh_chung_analyze',
    description: 'Read current % of each ingredient in bounds + fill level and total mass.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => {
      const state = getBanhChungState();
      const analysis = getBanhChungAnalysis(state.currentRun);
      return JSON.stringify({
        status: 'ok',
        state,
        analysis,
      });
    },
  },
  {
    name: 'banh_chung_drop_ingredient',
    description: 'Spawns physical bodies above the box. Mass clamped per call 0.1-100kg.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['nep', 'dau_xanh', 'thit_mo'],
          description: "Ingredient type: 'nep' (gạo nếp), 'dau_xanh' (đậu xanh), or 'thit_mo' (thịt mỡ)",
        },
        mass_kg: {
          type: 'number',
          minimum: 0.1,
          maximum: 100,
          description: 'Mass in kilograms to add (clamped between 0.1 and 100 kg)',
        },
      },
      required: ['type', 'mass_kg'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { type: Ingredient; mass_kg: number }) => {
      try {
        if (!input || !['nep', 'dau_xanh', 'thit_mo'].includes(input.type)) {
          return JSON.stringify({
            status: 'error',
            message: `Nguyên liệu không hợp lệ: '${input?.type}'. Vui lòng chọn 'nep', 'dau_xanh' hoặc 'thit_mo'.`,
          });
        }
        const rawMass = typeof input.mass_kg === 'number' ? input.mass_kg : 1;
        const res = driveDropIngredient(input.type, rawMass, true);

        // Visual layer: fire-and-forget async animation
        void triggerSceneEffect(res.effect, {
          type: input.type,
          mass_kg: rawMass,
        }).catch(() => {});

        return JSON.stringify({
          status: 'ok',
          message: res.message,
          effect: res.effect,
          state: res.state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi thả nguyên liệu vào khuôn',
        });
      }
    },
  },
  {
    name: 'banh_chung_fold_and_boil',
    description: 'Evaluates current ingredients vs target ratio. Win if within 10% tolerance. Fails if overfilled.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      try {
        const res = driveFoldAndBoil(true);

        // Visual layer: fire-and-forget async animation
        void triggerSceneEffect(res.effect).catch(() => {});

        return JSON.stringify({
          status: 'ok',
          message: res.message,
          effect: res.effect,
          state: res.state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi gói và luộc bánh chưng',
        });
      }
    },
  },
  {
    name: 'banh_chung_reset',
    description: 'Clears the box for a new try, keeps lifetime stats.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      try {
        const state = driveReset();

        // Visual layer: fire-and-forget async animation
        void triggerSceneEffect('reset').catch(() => {});

        return JSON.stringify({
          status: 'ok',
          message: 'Đã dọn sạch khuôn bánh chưng để gói chiếc mới.',
          state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi làm lại khuôn bánh',
        });
      }
    },
  },
];
