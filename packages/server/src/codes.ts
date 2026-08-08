import { randomInt } from 'node:crypto';
import { GAME_CODE_LENGTH } from '@go-lan/protocol';

/**
 * No I, L, O, 0 or 1: these codes get read out loud across a room, and those
 * are the characters people get wrong.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateGameCode(): string {
  let code = '';
  for (let i = 0; i < GAME_CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export function generateUniqueGameCode(isTaken: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = generateGameCode();
    if (!isTaken(code)) return code;
  }
  throw new Error('Could not find a free game code');
}
