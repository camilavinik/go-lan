import { EMPTY, type Point, type Stone } from './types.js';

export type Group = {
  /** Board indices of the connected stones. */
  stones: number[];
  /** Board indices of the empty intersections touching the group. */
  liberties: number[];
};

export function createBoard(size: number): Int8Array {
  return new Int8Array(size * size);
}

export function pointToIndex(size: number, point: Point): number {
  return point.y * size + point.x;
}

export function indexToPoint(size: number, index: number): Point {
  return { x: index % size, y: Math.floor(index / size) };
}

export function isInside(size: number, point: Point): boolean {
  return (
    Number.isInteger(point.x) &&
    Number.isInteger(point.y) &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < size &&
    point.y < size
  );
}

export function neighborIndices(size: number, index: number): number[] {
  const x = index % size;
  const y = Math.floor(index / size);
  const result: number[] = [];
  if (x > 0) result.push(index - 1);
  if (x < size - 1) result.push(index + 1);
  if (y > 0) result.push(index - size);
  if (y < size - 1) result.push(index + size);
  return result;
}

/**
 * Flood fill from a stone, returning every stone connected to it and the empty
 * intersections around them. Every rule in Go reduces to this one question.
 */
export function collectGroup(board: Int8Array, size: number, index: number): Group {
  const color = board[index] as Stone;
  const stones: number[] = [];
  const liberties: number[] = [];
  if (color === EMPTY) return { stones, liberties };

  const seen = new Uint8Array(board.length);
  const stack = [index];
  seen[index] = 1;

  while (stack.length > 0) {
    const current = stack.pop() as number;
    stones.push(current);
    for (const neighbor of neighborIndices(size, current)) {
      if (seen[neighbor]) continue;
      const value = board[neighbor];
      if (value === EMPTY) {
        seen[neighbor] = 1;
        liberties.push(neighbor);
      } else if (value === color) {
        seen[neighbor] = 1;
        stack.push(neighbor);
      }
    }
  }

  return { stones, liberties };
}

/**
 * The marked reference intersections printed on a real board (hoshi).
 * Purely conventional: they carry no rules meaning.
 */
export function starPoints(size: number): Point[] {
  if (size < 7) return [];

  const edge = size >= 13 ? 3 : 2;
  const far = size - 1 - edge;
  const middle = (size - 1) / 2;

  const points: Point[] = [
    { x: edge, y: edge },
    { x: far, y: edge },
    { x: edge, y: far },
    { x: far, y: far },
  ];

  if (size % 2 === 1) points.push({ x: middle, y: middle });

  // Only the full size board carries the four side marks.
  if (size === 19) {
    points.push(
      { x: middle, y: edge },
      { x: middle, y: far },
      { x: edge, y: middle },
      { x: far, y: middle },
    );
  }

  return points;
}

/** Empty intersections reachable from `index`, plus the stone colors enclosing them. */
export function collectEmptyRegion(
  board: Int8Array,
  size: number,
  index: number,
): { points: number[]; borders: Set<Stone> } {
  const points: number[] = [];
  const borders = new Set<Stone>();
  if (board[index] !== EMPTY) return { points, borders };

  const seen = new Uint8Array(board.length);
  const stack = [index];
  seen[index] = 1;

  while (stack.length > 0) {
    const current = stack.pop() as number;
    points.push(current);
    for (const neighbor of neighborIndices(size, current)) {
      if (seen[neighbor]) continue;
      const value = board[neighbor] as Stone;
      seen[neighbor] = 1;
      if (value === EMPTY) {
        stack.push(neighbor);
      } else {
        borders.add(value);
      }
    }
  }

  return { points, borders };
}
