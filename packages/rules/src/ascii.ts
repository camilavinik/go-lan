import { BLACK, EMPTY, WHITE, type Stone } from './types.js';

const CHAR_BY_STONE: Record<Stone, string> = {
  [EMPTY]: '.',
  [BLACK]: 'X',
  [WHITE]: 'O',
};

const STONE_BY_CHAR: Record<string, Stone> = {
  '.': EMPTY,
  X: BLACK,
  O: WHITE,
};

/**
 * Reads a board drawn as text, so tests can show the position instead of
 * describing it. Whitespace inside a row is ignored.
 *
 *   parseAsciiBoard([
 *     '.XO',
 *     'XOO',
 *     '...',
 *   ])
 */
export function parseAsciiBoard(rows: string[]): { board: Int8Array; size: number } {
  const cleaned = rows.map((row) => row.replace(/\s+/g, ''));
  const size = cleaned.length;
  if (size === 0) throw new Error('An ASCII board needs at least one row');

  for (const [rowIndex, row] of cleaned.entries()) {
    if (row.length !== size) {
      throw new Error(
        `Row ${rowIndex} has ${row.length} columns but the board has ${size} rows; boards must be square`,
      );
    }
  }

  const board = new Int8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    const row = cleaned[y] as string;
    for (let x = 0; x < size; x += 1) {
      const char = row[x] as string;
      const stone = STONE_BY_CHAR[char];
      if (stone === undefined) {
        throw new Error(`Unknown character "${char}" at ${x},${y}; use ".", "X" or "O"`);
      }
      board[y * size + x] = stone;
    }
  }

  return { board, size };
}

export function formatAsciiBoard(board: Int8Array, size: number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < size; y += 1) {
    let row = '';
    for (let x = 0; x < size; x += 1) {
      row += CHAR_BY_STONE[board[y * size + x] as Stone];
    }
    rows.push(row);
  }
  return rows;
}

/** Compact single-line encoding used to send a board over the wire. */
export function boardToString(board: Int8Array): string {
  let text = '';
  for (const value of board) text += CHAR_BY_STONE[value as Stone];
  return text;
}

export function boardFromString(text: string): Int8Array {
  const board = new Int8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const stone = STONE_BY_CHAR[text[i] as string];
    if (stone === undefined) {
      throw new Error(`Unknown character "${text[i]}" at position ${i}`);
    }
    board[i] = stone;
  }
  return board;
}
