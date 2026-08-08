import { describe, expect, it } from 'vitest';
import {
  applyMove,
  at,
  confirmScore,
  createGame,
  currentScore,
  gameFromAscii,
  pointToIndex,
  resumePlaying,
  scoreArea,
  toggleDeadGroup,
  type GameState,
} from '../src/index.js';

function pass(state: GameState): GameState {
  const outcome = applyMove(state, state.turn, { type: 'pass' });
  if (!outcome.ok) throw new Error(`Expected the pass to be accepted, got "${outcome.reason}"`);
  return outcome.state;
}

function play(state: GameState, x: number, y: number): GameState {
  const outcome = applyMove(state, state.turn, { type: 'play', point: at(x, y) });
  if (!outcome.ok) throw new Error(`Expected a legal move, got "${outcome.reason}"`);
  return outcome.state;
}

describe('ending the game', () => {
  it('moves to the marking phase after two passes in a row', () => {
    let state = createGame({ boardSize: 9 });
    state = pass(state);
    expect(state.phase).toBe('playing');
    state = pass(state);
    expect(state.phase).toBe('marking');
  });

  it('resets the pass counter when someone plays in between', () => {
    let state = createGame({ boardSize: 9 });
    state = pass(state);
    state = play(state, 4, 4);
    expect(state.passesInARow).toBe(0);
    state = pass(state);
    expect(state.phase).toBe('playing');
  });

  it('ends immediately on a resignation', () => {
    const state = createGame({ boardSize: 9 });
    const outcome = applyMove(state, 'black', { type: 'resign' });
    expect(outcome.ok && outcome.state.phase).toBe('finished');
    expect(outcome.ok && outcome.state.result).toEqual({ type: 'resignation', winner: 'white' });
  });

  it('refuses moves once the game is over', () => {
    const state = createGame({ boardSize: 9 });
    const resigned = applyMove(state, 'black', { type: 'resign' });
    if (!resigned.ok) throw new Error('resignation should be accepted');

    const late = applyMove(resigned.state, 'white', { type: 'play', point: at(3, 3) });
    expect(late.ok).toBe(false);
  });
});

describe('marking dead stones', () => {
  function marking(): GameState {
    let state = gameFromAscii(['OX...', '.X...', '.X...', '.X...', '.X...']);
    state = pass(state);
    state = pass(state);
    return state;
  }

  it('marks the whole group, not just the stone clicked', () => {
    const state = gameFromAscii(['XX...', '.....', '.....', '.....', '.....']);
    const started = pass(pass(state));
    const marked = toggleDeadGroup(started, at(0, 0));

    expect(marked?.dead[pointToIndex(5, at(0, 0))]).toBe(true);
    expect(marked?.dead[pointToIndex(5, at(1, 0))]).toBe(true);
  });

  it('brings a group back to life when clicked again', () => {
    const state = marking();
    const marked = toggleDeadGroup(state, at(0, 0)) as GameState;
    const revived = toggleDeadGroup(marked, at(0, 0)) as GameState;
    expect(revived.dead.some(Boolean)).toBe(false);
  });

  it('wipes both confirmations whenever the marking changes', () => {
    let state = marking();
    state = confirmScore(state, 'black') as GameState;
    expect(state.confirmed).toEqual({ black: true, white: false });

    state = toggleDeadGroup(state, at(0, 0)) as GameState;
    expect(state.confirmed).toEqual({ black: false, white: false });
  });

  it('finishes only once both players confirm', () => {
    let state = marking();
    state = confirmScore(state, 'black') as GameState;
    expect(state.phase).toBe('marking');

    state = confirmScore(state, 'white') as GameState;
    expect(state.phase).toBe('finished');
    expect(state.result?.type).toBe('score');
  });

  it('can go back to playing when the players disagree', () => {
    let state = marking();
    state = toggleDeadGroup(state, at(0, 0)) as GameState;
    state = resumePlaying(state) as GameState;

    expect(state.phase).toBe('playing');
    expect(state.passesInARow).toBe(0);
    expect(state.dead.some(Boolean)).toBe(false);
  });

  it('does nothing when clicking an empty intersection', () => {
    expect(toggleDeadGroup(marking(), at(4, 4))).toBeNull();
  });
});

describe('area scoring', () => {
  const split = ['.X.O.', '.X.O.', '.X.O.', '.X.O.', '.X.O.'];

  it('counts stones plus the empty points only one colour surrounds', () => {
    const state = gameFromAscii(split, { komi: 0 });
    const score = scoreArea(state.board, state.boardSize, state.dead, 0);

    expect(score.blackStones).toBe(5);
    expect(score.whiteStones).toBe(5);
    expect(score.blackTerritory).toBe(5);
    expect(score.whiteTerritory).toBe(5);
    expect(score.black).toBe(10);
    expect(score.white).toBe(10);
  });

  it('leaves points touching both colours neutral', () => {
    const state = gameFromAscii(split, { komi: 0 });
    const score = scoreArea(state.board, state.boardSize, state.dead, 0);
    // The middle column touches both walls, so it belongs to nobody.
    expect(score.ownership[pointToIndex(5, at(2, 2))]).toBe(0);
  });

  it('gives white the komi, which is what breaks ties', () => {
    const state = gameFromAscii(split, { komi: 7.5 });
    const score = currentScore(state);

    expect(score.white).toBe(17.5);
    expect(score.winner).toBe('white');
    expect(score.margin).toBe(7.5);
  });

  it('hands the points under a dead stone to the surrounding colour', () => {
    const withIntruder = ['OX.O.', '.X.O.', '.X.O.', '.X.O.', '.X.O.'];
    const state = gameFromAscii(withIntruder, { komi: 0 });

    const alive = currentScore(state);
    expect(alive.blackTerritory).toBe(0);

    const dead = [...state.dead];
    dead[pointToIndex(5, at(0, 0))] = true;
    const settled = scoreArea(state.board, state.boardSize, dead, 0);

    expect(settled.blackTerritory).toBe(5);
    expect(settled.black).toBe(10);
    expect(settled.whiteStones).toBe(5);
  });
});
