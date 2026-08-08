import { describe, expect, it } from 'vitest';
import {
  boardFromString,
  boardToString,
  collectGroup,
  formatAsciiBoard,
  parseAsciiBoard,
  pointToIndex,
  starPoints,
} from '../src/index.js';

describe('ascii boards', () => {
  it('round trips a position', () => {
    const rows = ['.XO', 'XOO', '...'];
    const { board, size } = parseAsciiBoard(rows);
    expect(size).toBe(3);
    expect(formatAsciiBoard(board, size)).toEqual(rows);
  });

  it('ignores whitespace inside rows', () => {
    const { board, size } = parseAsciiBoard(['. X O', 'X O O', '. . .']);
    expect(formatAsciiBoard(board, size)).toEqual(['.XO', 'XOO', '...']);
  });

  it('rejects boards that are not square', () => {
    expect(() => parseAsciiBoard(['..', '...'])).toThrow(/square/);
  });

  it('round trips the compact wire encoding', () => {
    const { board } = parseAsciiBoard(['.XO', 'XOO', '...']);
    expect(boardToString(board)).toBe('.XOXOO...');
    expect(boardFromString('.XOXOO...')).toEqual(board);
  });
});

describe('collectGroup', () => {
  it('finds connected stones and their liberties', () => {
    const { board, size } = parseAsciiBoard(['XX.', 'X..', '...']);
    const group = collectGroup(board, size, pointToIndex(size, { x: 0, y: 0 }));

    expect(group.stones).toHaveLength(3);
    // Right of the top pair, and below both the corner column and the pair.
    expect(group.liberties.sort()).toEqual(
      [
        pointToIndex(size, { x: 2, y: 0 }),
        pointToIndex(size, { x: 1, y: 1 }),
        pointToIndex(size, { x: 0, y: 2 }),
      ].sort(),
    );
  });

  it('does not join stones of different colors', () => {
    const { board, size } = parseAsciiBoard(['XO.', '...', '...']);
    const group = collectGroup(board, size, pointToIndex(size, { x: 0, y: 0 }));
    expect(group.stones).toEqual([pointToIndex(size, { x: 0, y: 0 })]);
  });

  it('returns nothing for an empty intersection', () => {
    const { board, size } = parseAsciiBoard(['...', '...', '...']);
    expect(collectGroup(board, size, 0)).toEqual({ stones: [], liberties: [] });
  });
});

describe('starPoints', () => {
  it('places nine marks on a 19x19 board', () => {
    expect(starPoints(19)).toHaveLength(9);
    expect(starPoints(19)).toContainEqual({ x: 3, y: 3 });
    expect(starPoints(19)).toContainEqual({ x: 9, y: 9 });
    expect(starPoints(19)).toContainEqual({ x: 15, y: 15 });
  });

  it('places five marks on the smaller boards', () => {
    const small = starPoints(9);
    expect(small).toHaveLength(5);
    expect(small).toContainEqual({ x: 2, y: 2 });
    expect(small).toContainEqual({ x: 4, y: 4 });
    expect(small).not.toContainEqual({ x: 4, y: 2 });

    const medium = starPoints(13);
    expect(medium).toHaveLength(5);
    expect(medium).toContainEqual({ x: 3, y: 3 });
    expect(medium).toContainEqual({ x: 6, y: 6 });
  });
});
