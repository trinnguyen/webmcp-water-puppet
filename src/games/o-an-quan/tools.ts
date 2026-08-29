import { GameToolDef } from '../../types';
import { getBoard, resetBoard, driveMove } from './scene';
import { getScore } from './rules';

export const oaqTools: GameToolDef[] = [
  {
    name: 'o_an_quan_new_game',
    description:
      'Resets the Ô ăn quan board to starting position. 5 small pits per side, 2 quan pits, 5 seeds per small pit, 10 seeds per quan.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      resetBoard();
      const b = getBoard();
      return JSON.stringify({
        status: 'ok',
        message: 'New game started',
        board: {
          pits: b.pits,
          currentPlayer: b.currentPlayer,
          captured: b.captured,
          gameStatus: b.status,
          winner: b.winner,
        },
      });
    },
  },
  {
    name: 'o_an_quan_pick_bin',
    description:
      "Scoops seeds from a pit and distributes counter-clockwise. Only valid for the current player's non-empty small pits (0-4 for P1, 6-10 for P2).",
    inputSchema: {
      type: 'object',
      properties: {
        bin: {
          type: 'number',
          description: 'Pit index (0-4 for Player 1, 6-10 for Player 2)',
        },
      },
      required: ['bin'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: any) => {
      try {
        const board = await driveMove(input.bin, true);
        return JSON.stringify({
          status: 'ok',
          message: `Moved from bin ${input.bin}`,
          board: {
            pits: board.pits,
            currentPlayer: board.currentPlayer,
            captured: board.captured,
            gameStatus: board.status,
            winner: board.winner,
          },
        });
      } catch (e: any) {
        const b = getBoard();
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Invalid move',
          board: {
            pits: b.pits,
            currentPlayer: b.currentPlayer,
            captured: b.captured,
            gameStatus: b.status,
            winner: b.winner,
          },
        });
      }
    },
  },
  {
    name: 'o_an_quan_state',
    description:
      'Returns the current board state: pits, captured seeds, current player, and game status.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => {
      const b = getBoard();
      return JSON.stringify({
        status: 'ok',
        board: {
          pits: b.pits,
          currentPlayer: b.currentPlayer,
          captured: b.captured,
          gameStatus: b.status,
          winner: b.winner,
        },
      });
    },
  },
  {
    name: 'o_an_quan_score',
    description:
      'Returns current scores (captured seeds) for both players.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => {
      const b = getBoard();
      const s = getScore(b);
      return JSON.stringify({
        status: 'ok',
        score: {
          player1: s.p1,
          player2: s.p2,
        },
        leader: s.p1 > s.p2 ? 'player1' : s.p2 > s.p1 ? 'player2' : 'tied',
      });
    },
  },
];
