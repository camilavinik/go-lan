import { parseAsciiBoard } from './ascii.js';
import { DEFAULT_KOMI } from './game.js';
import type { BoardSize, Color, GameState, Point } from './types.js';

export type AsciiGameOptions = {
  turn?: Color;
  komi?: number;
  koPoint?: Point | null;
};

/**
 * Builds a game already in a given position, so a test can show the board it
 * cares about instead of playing twenty moves to reach it.
 */
export function gameFromAscii(rows: string[], options: AsciiGameOptions = {}): GameState {
  const { board, size } = parseAsciiBoard(rows);
  return {
    boardSize: size as BoardSize,
    komi: options.komi ?? DEFAULT_KOMI,
    board,
    turn: options.turn ?? 'black',
    captures: { black: 0, white: 0 },
    koPoint: options.koPoint ?? null,
    passesInARow: 0,
    phase: 'playing',
    moves: [],
    dead: new Array(size * size).fill(false),
    confirmed: { black: false, white: false },
    result: null,
  };
}

/** Shorthand for the point at column x, row y, both zero based. */
export function at(x: number, y: number): Point {
  return { x, y };
}
