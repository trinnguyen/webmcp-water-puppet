import { GameToolDef } from '../../types';
import {
  getBauCuaState,
  placeBauCuaBet,
  rollBauCuaDice,
  resolveBauCua,
} from './scene';
import { SYMBOL_NAMES } from './rules';

export const bauCuaTools: GameToolDef[] = [
  {
    name: 'bau_cua_place_bet',
    description:
      'Places a bet on a symbol for the current round. Can place multiple bets on different symbols. Requires the current stake.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          enum: ['bau', 'cua', 'tom', 'ca', 'ga', 'huou'],
          description: 'Symbol to bet on',
        },
        points: {
          type: 'number',
          description: 'Number of points to wager (fake points, kid-safe)',
        },
      },
      required: ['symbol', 'points'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input: any) => {
      try {
        const s = placeBauCuaBet(input.symbol, input.points);
        const remaining =
          s.playerPoints - s.bets.reduce((sum, b) => sum + b.points, 0);
        return JSON.stringify({
          status: 'ok',
          message: `Bet ${input.points} points on ${SYMBOL_NAMES[input.symbol as keyof typeof SYMBOL_NAMES].vi}`,
          currentBets: s.bets,
          remainingPoints: remaining,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Invalid bet',
        });
      }
    },
  },
  {
    name: 'bau_cua_roll',
    description:
      'Rolls 3 dice. Must have at least one bet placed. Returns the symbols that appeared.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      try {
        const s = await rollBauCuaDice(true);
        if (!s.lastRoll)
          return JSON.stringify({
            status: 'error',
            message: 'Place at least one bet before rolling',
          });
        const counts: Record<string, number> = {};
        for (const sym of s.lastRoll) counts[sym] = (counts[sym] || 0) + 1;
        return JSON.stringify({
          status: 'ok',
          roll: s.lastRoll,
          counts,
          message: s.lastRoll.map((x) => SYMBOL_NAMES[x].vi).join(' — '),
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Cannot roll now',
        });
      }
    },
  },
  {
    name: 'bau_cua_resolve',
    description:
      'Settles all bets against the current roll. Returns winnings/losses and updates points.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      try {
        const s = await resolveBauCua(true);
        const last = s.roundHistory[s.roundHistory.length - 1];
        const netGain = last ? last.netGain : 0;
        return JSON.stringify({
          status: 'ok',
          netGain,
          totalPoints: s.playerPoints,
          roundNumber: s.roundNumber,
          message:
            netGain >= 0
              ? `Won ${netGain} points!`
              : `Lost ${-netGain} points`,
        });
      } catch (e: any) {
        return JSON.stringify({
          status: 'error',
          message: (e && e.message) || 'Cannot resolve now',
        });
      }
    },
  },
  {
    name: 'bau_cua_state',
    description:
      'Returns current game state: points, active bets, last roll, round number.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => {
      const s = getBauCuaState();
      return JSON.stringify({
        status: 'ok',
        playerPoints: s.playerPoints,
        bets: s.bets,
        lastRoll: s.lastRoll,
        roundNumber: s.roundNumber,
        gameStatus: s.status,
      });
    },
  },
];

