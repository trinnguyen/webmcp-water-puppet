import type { GameToolDef } from '../../types';
import type { Power, Trick } from './rules';
import {
  getDanhQuayState,
  driveStart,
  driveWhip,
  driveTrick,
  driveFinish,
} from './scene';

export const danhQuayTools: GameToolDef[] = [
  {
    name: 'danh_quay_start',
    description: 'Spawns a new spinning top with 30 initial energy.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      try {
        const s = driveStart(true);
        return JSON.stringify({
          status: 'ok',
          message: 'Đã bắt đầu quay! Con quay có 30 năng lượng ban đầu.',
          state: s,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi bắt đầu đánh quay',
        });
      }
    },
  },
  {
    name: 'danh_quay_whip',
    description:
      'Whip the top to add energy. Power can be nhe (+5), vua (+12), manh (+22). Manh on near-max energy causes wobble. Overwhipping >100 causes fly-off.',
    inputSchema: {
      type: 'object',
      properties: {
        power: {
          type: 'string',
          enum: ['nhe', 'vua', 'manh'],
          description: "Whip power: 'nhe' (+5), 'vua' (+12), or 'manh' (+22)",
        },
      },
      required: ['power'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { power: Power }) => {
      try {
        if (!input || !['nhe', 'vua', 'manh'].includes(input.power)) {
          return JSON.stringify({
            status: 'error',
            message: `Lực quất không hợp lệ: '${input?.power}'. Hãy chọn 'nhe', 'vua' hoặc 'manh'.`,
          });
        }
        const res = driveWhip(input.power, true);
        return JSON.stringify({
          status: 'ok',
          message: res.message,
          state: res.state,
          wobblePenalty: res.wobblePenalty,
          flewOff: res.flewOff,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi quất quay',
        });
      }
    },
  },
  {
    name: 'danh_quay_trick',
    description:
      'Perform a trick (nguoi_duc, bay_cao, qua_gam) costing 40 energy for applause points. 5 tricks in a row causes dizzy cooldown. Failing energy causes fall.',
    inputSchema: {
      type: 'object',
      properties: {
        trick: {
          type: 'string',
          enum: ['nguoi_duc', 'bay_cao', 'qua_gam'],
          description: "Trick type: 'nguoi_duc', 'bay_cao', or 'qua_gam'",
        },
      },
      required: ['trick'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { trick: Trick }) => {
      try {
        if (!input || !['nguoi_duc', 'bay_cao', 'qua_gam'].includes(input.trick)) {
          return JSON.stringify({
            status: 'error',
            message: `Kỹ thuật không hợp lệ: '${input?.trick}'. Hãy chọn 'nguoi_duc', 'bay_cao' hoặc 'qua_gam'.`,
          });
        }
        const res = driveTrick(input.trick, true);
        return JSON.stringify({
          status: 'ok',
          message: res.message,
          state: res.state,
          trickSuccess: res.trickSuccess,
          dizzy: res.dizzy,
          fallen: res.fallen,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi biểu diễn kỹ thuật',
        });
      }
    },
  },
  {
    name: 'danh_quay_state',
    description:
      'Read current top state: energy, wobble, tricks landed, and score (seconds spun).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => {
      const state = getDanhQuayState();
      return JSON.stringify({
        state,
      });
    },
  },
  {
    name: 'danh_quay_finish',
    description:
      'Stop spinning and end the game. Saves final score and longest-spin record.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      try {
        const res = driveFinish(true);
        return JSON.stringify({
          status: 'ok',
          message: res.message,
          finalScore: res.finalScore,
          longestSpinRecord: res.longestSpinRecord,
          state: res.state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi kết thúc trò chơi',
        });
      }
    },
  },
];
