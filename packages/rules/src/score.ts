import { collectEmptyRegion } from './board.js';
import { BLACK, EMPTY, WHITE, type Color, type Stone } from './types.js';

export type ScoreBreakdown = {
  blackStones: number;
  whiteStones: number;
  blackTerritory: number;
  whiteTerritory: number;
  komi: number;
  black: number;
  white: number;
  winner: Color;
  margin: number;
  /**
   * One entry per intersection: the color that owns it, or EMPTY when the point
   * is neutral. Drives the territory overlay during the marking phase.
   */
  ownership: Int8Array;
};

/**
 * Area scoring (Chinese rules): each player counts their stones on the board
 * plus the empty intersections surrounded only by their color. Stones marked
 * dead are lifted first, so the points under them go to the opponent.
 */
export function scoreArea(
  board: Int8Array,
  size: number,
  dead: boolean[],
  komi: number,
): ScoreBreakdown {
  const settled = Int8Array.from(board);
  for (let i = 0; i < settled.length; i += 1) {
    if (dead[i]) settled[i] = EMPTY;
  }

  const ownership = Int8Array.from(settled);
  let blackStones = 0;
  let whiteStones = 0;
  for (const value of settled) {
    if (value === BLACK) blackStones += 1;
    else if (value === WHITE) whiteStones += 1;
  }

  let blackTerritory = 0;
  let whiteTerritory = 0;
  const visited = new Uint8Array(settled.length);

  for (let i = 0; i < settled.length; i += 1) {
    if (settled[i] !== EMPTY || visited[i]) continue;
    const region = collectEmptyRegion(settled, size, i);
    for (const point of region.points) visited[point] = 1;

    if (region.borders.size !== 1) continue;
    const owner = [...region.borders][0] as Stone;
    for (const point of region.points) ownership[point] = owner;
    if (owner === BLACK) blackTerritory += region.points.length;
    else whiteTerritory += region.points.length;
  }

  const black = blackStones + blackTerritory;
  const white = whiteStones + whiteTerritory + komi;

  return {
    blackStones,
    whiteStones,
    blackTerritory,
    whiteTerritory,
    komi,
    black,
    white,
    winner: black > white ? 'black' : 'white',
    margin: Math.abs(black - white),
    ownership,
  };
}
