import { collectGroup, isInside, pointToIndex } from './board.js';
import { scoreArea, type ScoreBreakdown } from './score.js';
import { EMPTY, type Color, type GameState, type Point } from './types.js';

/**
 * Marks a whole group dead, or brings it back to life. Either player may do it:
 * the point of this phase is to agree, not to negotiate turn by turn.
 *
 * Any change wipes both confirmations, so nobody can accept a count and then
 * quietly change it.
 */
export function toggleDeadGroup(state: GameState, point: Point): GameState | null {
  if (state.phase !== 'marking') return null;
  if (!isInside(state.boardSize, point)) return null;

  const index = pointToIndex(state.boardSize, point);
  if (state.board[index] === EMPTY) return null;

  const group = collectGroup(state.board, state.boardSize, index);
  const nowDead = !state.dead[index];
  const dead = [...state.dead];
  for (const stone of group.stones) dead[stone] = nowDead;

  return {
    ...state,
    dead,
    confirmed: { black: false, white: false },
  };
}

/**
 * Accepts the current marking. Once both players have accepted the same board,
 * the score is final and the game is over.
 */
export function confirmScore(state: GameState, color: Color): GameState | null {
  if (state.phase !== 'marking') return null;

  const confirmed = { ...state.confirmed, [color]: true };
  if (!confirmed.black || !confirmed.white) {
    return { ...state, confirmed };
  }

  const breakdown = currentScore(state);
  return {
    ...state,
    confirmed,
    phase: 'finished',
    result: {
      type: 'score',
      black: breakdown.black,
      white: breakdown.white,
      winner: breakdown.winner,
      margin: breakdown.margin,
    },
  };
}

/**
 * Goes back to playing when the players disagree about what is dead. The
 * dispute is then settled on the board, which is how it works over-the-board.
 */
export function resumePlaying(state: GameState): GameState | null {
  if (state.phase !== 'marking') return null;

  return {
    ...state,
    phase: 'playing',
    passesInARow: 0,
    dead: new Array(state.board.length).fill(false),
    confirmed: { black: false, white: false },
  };
}

/** The score as it stands with the current marking, for the live preview. */
export function currentScore(state: GameState): ScoreBreakdown {
  return scoreArea(state.board, state.boardSize, state.dead, state.komi);
}
