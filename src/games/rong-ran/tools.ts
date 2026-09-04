import type { GameToolDef } from '../../types';
import { Speed, CHANT_LINES } from './rules';
import {
  getRongRanState,
  driveStart,
  driveAnswer,
  driveChase,
  driveNextRound,
} from './scene';

export const rongRanTools: GameToolDef[] = [
  {
    name: 'rong_ran_start',
    description: 'Spawns a new dragon chain of given length and initiates the chant: "Rồng rắn lên mây..."',
    inputSchema: {
      type: 'object',
      properties: {
        length: {
          type: 'number',
          minimum: 4,
          maximum: 12,
          description: 'Length of dragon chain (4 to 12 kids)',
        },
      },
      required: ['length'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { length: number }) => {
      try {
        const rawLen = typeof input?.length === 'number' ? input.length : 6;
        const clamped = Math.max(4, Math.min(12, Math.round(rawLen)));
        const s = driveStart(clamped, true);
        const chant = CHANT_LINES.join('\n');
        return JSON.stringify({
          status: 'ok',
          message: `Đã xếp hàng rồng rắn ${clamped} người! Khởi xướng câu đồng dao: "${CHANT_LINES[0]}..."`,
          chant,
          state: s,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi bắt đầu rồng rắn',
        });
      }
    },
  },
  {
    name: 'rong_ran_answer',
    description: 'Call-and-response dialogue with the doctor ("Có không?" -> "Không?" or "Có")',
    inputSchema: {
      type: 'object',
      properties: {
        answer: {
          type: 'string',
          enum: ['Có', 'Không', 'co', 'khong'],
          description: "Doctor answer: 'Có' (doctor is home) or 'Không' (doctor is away)",
        },
      },
      required: ['answer'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { answer: string }) => {
      try {
        const ansRaw = String(input?.answer || '').trim().toLowerCase();
        if (!ansRaw || (!ansRaw.includes('c') && !ansRaw.includes('kh'))) {
          return JSON.stringify({
            status: 'error',
            message: "Câu trả lời không hợp lệ. Vui lòng chọn 'Có' hoặc 'Không'.",
          });
        }
        const isCo = ansRaw.startsWith('c') || ansRaw === 'có' || ansRaw === 'co';
        const chosen: 'Có' | 'Không' = isCo ? 'Có' : 'Không';
        const s = driveAnswer(chosen, true);
        const doctorReply = chosen === 'Có'
          ? 'Thầy thuốc có nhà! Tha hồ mà đuổi! Đuổi khúc nào? Đuổi khúc đuôi!'
          : 'Thầy thuốc đi chợ rồi, không có nhà!';
        return JSON.stringify({
          status: 'ok',
          message: `Thầy thuốc đáp: "${doctorReply}"`,
          doctorReply,
          phase: s.phase,
          state: s,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi đối đáp với thầy thuốc',
        });
      }
    },
  },
  {
    name: 'rong_ran_chase',
    description: 'Start the chase with a specific speed. Resolves deterministically based on speed vs length.',
    inputSchema: {
      type: 'object',
      properties: {
        speed: {
          type: 'string',
          enum: ['cham', 'vua', 'nhanh'],
          description: "Chase speed: 'cham' (slow), 'vua' (medium), or 'nhanh' (fast)",
        },
      },
      required: ['speed'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { speed: Speed }) => {
      try {
        if (!input || !['cham', 'vua', 'nhanh'].includes(input.speed)) {
          return JSON.stringify({
            status: 'error',
            message: `Tốc độ không hợp lệ: '${input?.speed}'. Hãy chọn 'cham', 'vua' hoặc 'nhanh'.`,
          });
        }
        const s = driveChase(input.speed, true);
        const message = s.chaseResult === 'caught'
          ? `Thầy thuốc với tốc độ '${input.speed}' đã bắt được khúc đuôi của rồng rắn (độ dài ${s.length})!`
          : `Rồng rắn nhanh nhẹn luồn lách, thầy thuốc với tốc độ '${input.speed}' không bắt được khúc đuôi!`;
        return JSON.stringify({
          status: 'ok',
          message,
          result: s.chaseResult,
          state: s,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi thầy thuốc đuổi bắt rồng rắn',
        });
      }
    },
  },
  {
    name: 'rong_ran_state',
    description: 'Read current game state, score, chain length, phase',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => {
      const state = getRongRanState();
      return JSON.stringify({
        state,
      });
    },
  },
  {
    name: 'rong_ran_next_round',
    description: 'Setup the next round. Caught kid becomes doctor. Score is rounds survived',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      try {
        const s = driveNextRound(true);
        const message = s.totalCatches > 0
          ? `Bắt đầu vòng ${s.round}! Khúc đuôi vừa bị bắt đã đổi vai làm thầy thuốc!`
          : `Bắt đầu vòng ${s.round}! Rồng rắn tiếp tục giữ vững đội hình!`;
        return JSON.stringify({
          status: 'ok',
          message,
          round: s.round,
          state: s,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Lỗi khi chuyển sang vòng tiếp theo',
        });
      }
    },
  },
];
