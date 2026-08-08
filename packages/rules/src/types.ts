export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export type Stone = typeof EMPTY | typeof BLACK | typeof WHITE;

export type Color = 'black' | 'white';

/** Sizes offered by the app. 9x9 for learning, 19x19 is the tournament board. */
export type BoardSize = 9 | 13 | 19;

export type Point = { x: number; y: number };

export type GamePhase = 'playing' | 'marking' | 'finished';

export type Move =
  | { type: 'play'; point: Point }
  | { type: 'pass' }
  | { type: 'resign' };

export type MoveRecord = {
  color: Color;
  move: Move;
  /** Stones captured by this move, for the running capture counters. */
  captured: number;
};

export type IllegalReason =
  | 'wrong-phase'
  | 'not-your-turn'
  | 'out-of-bounds'
  | 'occupied'
  | 'suicide'
  | 'ko';

export type GameResult =
  | {
      type: 'score';
      black: number;
      white: number;
      winner: Color;
      margin: number;
    }
  | { type: 'resignation'; winner: Color };

export type GameState = {
  boardSize: number;
  komi: number;
  board: Int8Array;
  turn: Color;
  captures: { black: number; white: number };
  /** Intersection the opponent may not retake on their next move, or null. */
  koPoint: Point | null;
  passesInARow: number;
  phase: GamePhase;
  moves: MoveRecord[];
  /** Marking phase: one flag per intersection, true when the stone is agreed dead. */
  dead: boolean[];
  confirmed: { black: boolean; white: boolean };
  result: GameResult | null;
};

export type MoveOutcome =
  | { ok: true; state: GameState }
  | { ok: false; reason: IllegalReason };

export function opponent(color: Color): Color {
  return color === 'black' ? 'white' : 'black';
}

export function stoneOf(color: Color): Stone {
  return color === 'black' ? BLACK : WHITE;
}

export function colorOf(stone: Stone): Color | null {
  if (stone === BLACK) return 'black';
  if (stone === WHITE) return 'white';
  return null;
}

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}
