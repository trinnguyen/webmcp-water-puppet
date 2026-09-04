import type { GameToolDef } from '../../types';
import {
  TALES,
  getTaleById,
} from './rules';
import {
  getShowState,
  driveStartShow,
  driveSpawnPuppet,
  driveMovePuppet,
  drivePuppetAction,
  driveTriggerEffect,
  driveSpeak,
  driveFinishShow,
} from './scene';

export const waterPuppetTools: GameToolDef[] = [
  {
    name: 'water_puppet_list_tales',
    description: 'Lists available tales to perform and their cast.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => {
      return JSON.stringify({
        status: 'ok',
        tales: TALES.map((t) => ({
          id: t.id,
          title: t.title,
          titleEn: t.titleEn,
          synopsis: t.synopsis,
          cast: t.cast,
          recommendedEffects: t.recommendedEffects,
        })),
      });
    },
  },
  {
    name: 'water_puppet_start_show',
    description: 'Starts a new puppet show for a specific tale.',
    inputSchema: {
      type: 'object',
      properties: {
        taleId: {
          type: 'string',
          description: "ID of the tale to perform ('coc-kien-troi', 'tam-cam', 'rong-ca')",
        },
      },
      required: ['taleId'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { taleId: string }) => {
      try {
        const tale = getTaleById(input.taleId);
        if (!tale) {
          return JSON.stringify({
            status: 'error',
            message: `Unknown taleId: '${input.taleId}'. Use water_puppet_list_tales to see available tales.`,
          });
        }
        const s = driveStartShow(input.taleId, true);
        return JSON.stringify({
          status: 'ok',
          message: `Bắt đầu vở diễn: ${tale.title}`,
          tale: {
            id: tale.id,
            title: tale.title,
            synopsis: tale.synopsis,
            cast: tale.cast,
          },
          showState: s,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Failed to start show',
        });
      }
    },
  },
  {
    name: 'water_puppet_show_state',
    description: 'Gets current stage status, puppet positions, and applause meter.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => {
      const s = getShowState();
      return JSON.stringify({
        status: 'ok',
        stageStatus: s.status,
        applause: s.applause,
        puppets: s.puppets,
        weather: s.weather,
        currentTale: s.currentTale,
        stageEffects: s.stageEffects,
        showState: s,
      });
    },
  },
  {
    name: 'water_puppet_spawn_puppet',
    description: 'Makes a puppet emerge from the water.',
    inputSchema: {
      type: 'object',
      properties: {
        puppetId: {
          type: 'string',
          description: 'Unique identifier for the puppet',
        },
        name: {
          type: 'string',
          description: 'Display name of the puppet',
        },
        asset: {
          type: 'string',
          description: "Asset name ('teu', 'dragon', 'fish', 'farmer') or any emoji (e.g. '🐸', '🌸', '👑')",
        },
        x: {
          type: 'number',
          description: 'Horizontal position on stage (0 to 100 percentage)',
        },
      },
      required: ['puppetId', 'name', 'asset', 'x'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { puppetId: string; name: string; asset: string; x: number }) => {
      try {
        const s = driveSpawnPuppet(
          {
            puppetId: input.puppetId,
            name: input.name,
            asset: input.asset,
            x: typeof input.x === 'number' ? input.x : 50,
          },
          true
        );
        return JSON.stringify({
          status: 'ok',
          message: `Rối '${input.name}' đã xuất hiện trên mặt nước`,
          puppet: s.puppets[input.puppetId],
          applause: s.applause,
          showState: s,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Failed to spawn puppet',
        });
      }
    },
  },
  {
    name: 'water_puppet_move_puppet',
    description: 'Moves a puppet across the stage.',
    inputSchema: {
      type: 'object',
      properties: {
        puppetId: {
          type: 'string',
          description: 'ID of the puppet to move',
        },
        targetX: {
          type: 'number',
          description: 'Target horizontal position (0 to 100 percentage)',
        },
      },
      required: ['puppetId', 'targetX'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { puppetId: string; targetX: number }) => {
      try {
        const current = getShowState();
        if (!current.puppets[input.puppetId]) {
          return JSON.stringify({
            status: 'error',
            message: `Puppet '${input.puppetId}' not found on stage. Call water_puppet_spawn_puppet first.`,
          });
        }
        const s = driveMovePuppet(input.puppetId, input.targetX, true);
        return JSON.stringify({
          status: 'ok',
          message: `Rối '${s.puppets[input.puppetId]?.name || input.puppetId}' đã di chuyển đến ${input.targetX}%`,
          puppet: s.puppets[input.puppetId],
          applause: s.applause,
          showState: s,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Failed to move puppet',
        });
      }
    },
  },
  {
    name: 'water_puppet_puppet_action',
    description: "Triggers a puppet action (e.g., 'jump', 'dance', 'dive').",
    inputSchema: {
      type: 'object',
      properties: {
        puppetId: {
          type: 'string',
          description: 'ID of the puppet to perform the action',
        },
        actionType: {
          type: 'string',
          description: "Action type: 'jump', 'dance', 'dive', 'emerge', 'splash'",
        },
      },
      required: ['puppetId', 'actionType'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { puppetId: string; actionType: string }) => {
      try {
        const current = getShowState();
        if (!current.puppets[input.puppetId]) {
          return JSON.stringify({
            status: 'error',
            message: `Puppet '${input.puppetId}' not found on stage. Call water_puppet_spawn_puppet first.`,
          });
        }
        const s = drivePuppetAction(input.puppetId, input.actionType, true);
        return JSON.stringify({
          status: 'ok',
          message: `Rối '${s.puppets[input.puppetId]?.name || input.puppetId}' thực hiện động tác: ${input.actionType}`,
          action: input.actionType,
          puppet: s.puppets[input.puppetId],
          applause: s.applause,
          showState: s,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Failed to trigger puppet action',
        });
      }
    },
  },
  {
    name: 'water_puppet_trigger_effect',
    description: 'Triggers a stage effect (e.g., splash, rain, fireworks) and SFX. Dramatically boosts applause.',
    inputSchema: {
      type: 'object',
      properties: {
        effectName: {
          type: 'string',
          description: "Name of stage effect: 'splash', 'rain', 'clear', 'fireworks', 'dance'",
        },
      },
      required: ['effectName'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { effectName: string }) => {
      try {
        const s = driveTriggerEffect(input.effectName, true);
        return JSON.stringify({
          status: 'ok',
          message: `Hiệu ứng sân khấu: ${input.effectName}`,
          effect: input.effectName,
          applause: s.applause,
          weather: s.weather,
          showState: s,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Failed to trigger stage effect',
        });
      }
    },
  },
  {
    name: 'water_puppet_speak',
    description: 'Puppet or Narrator speaks a line to the audience.',
    inputSchema: {
      type: 'object',
      properties: {
        speaker: {
          type: 'string',
          description: 'Name or ID of the speaker (e.g. "Chú Tễu", "Người Xướng Trò", "Cô Tấm")',
        },
        message: {
          type: 'string',
          description: 'The spoken dialogue or narration',
        },
      },
      required: ['speaker', 'message'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { speaker: string; message: string }) => {
      try {
        const s = driveSpeak(input.speaker, input.message, true);
        return JSON.stringify({
          status: 'ok',
          speaker: input.speaker,
          message: input.message,
          applause: s.applause,
          showState: s,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Failed to speak',
        });
      }
    },
  },
  {
    name: 'water_puppet_finish_show',
    description: 'Ends the show, reveals the final applause score rating, and saves progress.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      try {
        const res = driveFinishShow(true);
        return JSON.stringify({
          status: 'ok',
          message: 'Vở diễn kết thúc trong tràng pháo tay rộn rã!',
          finalApplause: res.state.applause,
          rating: res.rating,
          bestScore: res.bestScore,
          isNewRecord: res.isNewRecord,
          showState: res.state,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Failed to finish show',
        });
      }
    },
  },
];
