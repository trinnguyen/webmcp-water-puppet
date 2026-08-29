import type { WebMCPTool } from './types';
import { games, getGameById } from './games';
import { startGame, hubState } from './hub';
import { playBGM } from './audio';

const globalTools: WebMCPTool[] = [
  {
    name: 'list_games',
    description: 'List all available folk games in Sân Chơi with player counts and descriptions',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: () => {
      return JSON.stringify({
        status: 'ok',
        games: games.map((g) => ({
          id: g.id,
          name: g.name,
          nameEn: g.nameEn,
          players: `${g.minPlayers}-${g.maxPlayers}`,
          description: g.description,
        })),
      });
    },
  },
  {
    name: 'start_game',
    description: 'Start a game by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        game: {
          type: 'string',
          enum: games.map((g) => g.id),
          description: 'Game ID',
        },
      },
      required: ['game'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (input: { game: string }) => {
      const result = startGame(input.game);
      return result;
    },
  },
  {
    name: 'set_music',
    description: 'Control background folk music tracks',
    inputSchema: {
      type: 'object',
      properties: {
        track: {
          type: 'string',
          enum: ['dan_bau', 'festive', 'gong', 'silent'],
        },
      },
      required: ['track'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: (input: { track: string }) => {
      playBGM(input.track);
      return JSON.stringify({ status: 'ok', track: input.track });
    },
  },
  {
    name: 'save_progress',
    description: 'Save progress and session note for the currently active game',
    inputSchema: {
      type: 'object',
      properties: {
        note: {
          type: 'string',
        },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: { note?: string }) => {
      const gameId = hubState.currentGameId;
      if (!gameId) {
        return JSON.stringify({ status: 'error', message: 'No active game to save' });
      }
      const note = input?.note || '';
      const at = new Date().toISOString();
      try {
        localStorage.setItem(
          'san_choi_last_save',
          JSON.stringify({ game: gameId, note, at })
        );
      } catch (e) {
        console.warn('[WebMCP] Failed to save san_choi_last_save:', e);
      }
      return JSON.stringify({
        status: 'ok',
        game: gameId,
        savedAt: at,
        note,
      });
    },
  },
];

const allTools: WebMCPTool[] = globalTools.concat(...games.map((g) => g.tools));

let unsavedActionCount = 0;

export async function initWebMCP(): Promise<void> {
  // Wrap all tools to track unsaved actions
  const wrappedTools = allTools.map((tool) => {
    const originalExecute = tool.execute;
    return {
      ...tool,
      execute: async (input: any) => {
        if (tool.name === 'save_progress') {
          unsavedActionCount = 0;
        } else {
          unsavedActionCount++;
          if (unsavedActionCount > 5) {
            import('./ui').then(m => m.showToast('Người xướng trò bị rối!'));
            // Keep at 6 until they save, or reset? Let's reset so they get annoyed again if they keep going
            unsavedActionCount = 0;
          }
        }
        return originalExecute(input);
      }
    };
  });

  if (typeof document.modelContext !== 'undefined') {
    const controller = new AbortController();
    window.__webmcpController = controller;
    for (const tool of wrappedTools) {
      try {
        await document.modelContext.registerTool(tool, { signal: controller.signal });
      } catch (err) {
        console.warn('[WebMCP] failed to register', tool.name, err);
      }
    }
    window.dispatchEvent(new CustomEvent('webmcp-status-change', { detail: 'online' }));
  } else {
    console.warn('[WebMCP] Not available — exposing window.__debugTools');
    window.__debugTools = {};
    for (const tool of wrappedTools) {
      window.__debugTools[tool.name] = tool.execute;
    }
    window.dispatchEvent(new CustomEvent('webmcp-status-change', { detail: 'offline' }));
  }
}

export function cleanupWebMCP(): void {
  if (window.__webmcpController) {
    window.__webmcpController.abort();
    window.__webmcpController = undefined;
  }
}

export { getGameById };
