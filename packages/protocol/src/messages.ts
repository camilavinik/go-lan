import type { Color, IllegalReason } from '@go-lan/rules';
import { z } from 'zod';
import type { GameSnapshot } from './snapshot.js';

export const GAME_CODE_LENGTH = 6;
export const MAX_NICK_LENGTH = 20;

const pointSchema = z.object({
  x: z.number().int().min(0).max(18),
  y: z.number().int().min(0).max(18),
});

const nickSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(MAX_NICK_LENGTH));

const codeSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(z.string().length(GAME_CODE_LENGTH));

const boardSizeSchema = z.union([z.literal(9), z.literal(13), z.literal(19)]);

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create'),
    nick: nickSchema,
    boardSize: boardSizeSchema,
    komi: z.number().min(-100).max(100).optional(),
    color: z.enum(['black', 'white', 'random']).optional(),
  }),
  z.object({ type: z.literal('join'), code: codeSchema, nick: nickSchema }),
  z.object({ type: z.literal('rejoin'), code: codeSchema, token: z.string().min(1).max(100) }),
  z.object({ type: z.literal('play'), point: pointSchema }),
  z.object({ type: z.literal('pass') }),
  z.object({ type: z.literal('resign') }),
  z.object({ type: z.literal('toggleDead'), point: pointSchema }),
  z.object({ type: z.literal('confirmScore') }),
  z.object({ type: z.literal('resumeGame') }),
  z.object({ type: z.literal('undoRequest') }),
  z.object({ type: z.literal('undoRespond'), accept: z.boolean() }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

/** Reasons the server can turn a request down, on top of the rules engine's own. */
export type ProtocolRejection =
  | 'invalid-message'
  | 'unknown-game'
  | 'game-full'
  | 'not-in-a-game'
  | 'unknown-token'
  | 'spectators-cannot-play'
  | 'nothing-to-undo'
  | 'no-pending-undo'
  | 'undo-not-yours';

export type RejectionReason = IllegalReason | ProtocolRejection;

export type ServerMessage =
  | {
      type: 'welcome';
      token: string;
      /** null when this connection is watching rather than playing. */
      color: Color | null;
      snapshot: GameSnapshot;
    }
  | { type: 'snapshot'; snapshot: GameSnapshot }
  | { type: 'rejected'; reason: RejectionReason; message: string };

const REJECTION_MESSAGES: Record<RejectionReason, string> = {
  'wrong-phase': 'That is not possible at this point in the game.',
  'not-your-turn': 'It is not your turn.',
  'out-of-bounds': 'That point is off the board.',
  occupied: 'There is already a stone there.',
  suicide: 'That stone would have no liberties, so it is not allowed.',
  ko: 'Ko: you cannot take that stone back straight away. Play elsewhere first.',
  'invalid-message': 'The server did not understand that request.',
  'unknown-game': 'No game with that code. It may have ended or the server restarted.',
  'game-full': 'That game already has two players.',
  'not-in-a-game': 'You are not in a game.',
  'unknown-token': 'That seat is no longer available.',
  'spectators-cannot-play': 'You are watching this game, not playing it.',
  'nothing-to-undo': 'There is no move to take back.',
  'no-pending-undo': 'Nobody has asked to take back a move.',
  'undo-not-yours': 'Only your opponent can answer that request.',
};

export function describeRejection(reason: RejectionReason): string {
  return REJECTION_MESSAGES[reason];
}
