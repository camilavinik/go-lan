import { describe, expect, it } from 'vitest';
import {
  applyMove,
  at,
  createGame,
  formatAsciiBoard,
  gameFromAscii,
  moveLegality,
  undoLastMove,
  type GameState,
  type Move,
} from '../src/index.js';

function play(state: GameState, x: number, y: number): GameState {
  const outcome = applyMove(state, state.turn, { type: 'play', point: at(x, y) });
  if (!outcome.ok) throw new Error(`Expected a legal move, got "${outcome.reason}"`);
  return outcome.state;
}

function expectRejection(state: GameState, move: Move, color = state.turn): string {
  const outcome = applyMove(state, color, move);
  if (outcome.ok) throw new Error('Expected the move to be rejected');
  return outcome.reason;
}

function board(state: GameState): string[] {
  return formatAsciiBoard(state.board, state.boardSize);
}

describe('placing a stone', () => {
  it('rejects an occupied intersection', () => {
    const state = gameFromAscii(['X..', '...', '...']);
    expect(expectRejection(state, { type: 'play', point: at(0, 0) })).toBe('occupied');
  });

  it('rejects a point outside the board', () => {
    const state = createGame({ boardSize: 9 });
    expect(expectRejection(state, { type: 'play', point: at(9, 0) })).toBe('out-of-bounds');
  });

  it('rejects playing out of turn', () => {
    const state = createGame({ boardSize: 9 });
    expect(expectRejection(state, { type: 'play', point: at(2, 2) }, 'white')).toBe('not-your-turn');
  });

  it('alternates colors', () => {
    let state = createGame({ boardSize: 9 });
    expect(state.turn).toBe('black');
    state = play(state, 2, 2);
    expect(state.turn).toBe('white');
    state = play(state, 6, 6);
    expect(state.turn).toBe('black');
  });
});

describe('captures', () => {
  it('takes a surrounded stone off the board', () => {
    // White has a single liberty left, at the right of the centre.
    const state = gameFromAscii(['.X.', 'XO.', '.X.'], { turn: 'black' });
    const next = play(state, 2, 1);

    expect(board(next)).toEqual(['.X.', 'X.X', '.X.']);
    expect(next.captures.black).toBe(1);
  });

  it('takes two separate groups with one stone', () => {
    const state = gameFromAscii(
      [
        '.X.X.',
        'XO.OX',
        '.X.X.',
        '.....',
        '.....',
      ],
      { turn: 'black' },
    );
    const next = play(state, 2, 1);

    expect(board(next)).toEqual([
      '.X.X.',
      'X.X.X',
      '.X.X.',
      '.....',
      '.....',
    ]);
    expect(next.captures.black).toBe(2);
  });

  it('counts captures per player across the game', () => {
    const state = gameFromAscii(['.X.', 'XO.', '.X.'], { turn: 'black' });
    const next = play(state, 2, 1);
    expect(next.captures).toEqual({ black: 1, white: 0 });
  });
});

describe('suicide', () => {
  it('rejects filling your own last liberty', () => {
    const state = gameFromAscii(['.X.', 'X.X', '.X.'], { turn: 'white' });
    expect(expectRejection(state, { type: 'play', point: at(1, 1) })).toBe('suicide');
  });

  it('allows it when the same move captures, because then it has liberties', () => {
    // White rings the whole board; the centre is White's only liberty.
    const state = gameFromAscii(['OOO', 'O.O', 'OOO'], { turn: 'black' });
    const next = play(state, 1, 1);

    expect(board(next)).toEqual(['...', '.X.', '...']);
    expect(next.captures.black).toBe(8);
  });
});

describe('ko', () => {
  const shape = [
    '.....',
    '..XO.',
    '.XO.O',
    '..XO.',
    '.....',
  ];

  it('forbids retaking immediately, then allows it a turn later', () => {
    let state = gameFromAscii(shape, { turn: 'black' });

    state = play(state, 3, 2);
    expect(state.captures.black).toBe(1);
    expect(state.koPoint).toEqual(at(2, 2));

    expect(expectRejection(state, { type: 'play', point: at(2, 2) })).toBe('ko');

    // White plays elsewhere, Black answers, and the ban has expired.
    state = play(state, 0, 0);
    expect(state.koPoint).toBeNull();
    state = play(state, 4, 4);

    const retake = applyMove(state, 'white', { type: 'play', point: at(2, 2) });
    expect(retake.ok).toBe(true);
  });

  it('does not set a ko ban when more than one stone is taken', () => {
    const state = gameFromAscii(
      [
        '.X.X.',
        'XO.OX',
        '.X.X.',
        '.....',
        '.....',
      ],
      { turn: 'black' },
    );
    expect(play(state, 2, 1).koPoint).toBeNull();
  });
});

describe('moveLegality', () => {
  it('reports the reason the interface should show', () => {
    const state = gameFromAscii(
      [
        '.X...',
        'X.X..',
        '.X...',
        '.....',
        '.....',
      ],
      { turn: 'white' },
    );
    expect(moveLegality(state, 'white', at(1, 1))).toBe('suicide');
    expect(moveLegality(state, 'white', at(4, 4))).toBeNull();
  });
});

describe('undo', () => {
  it('rebuilds the position before the last move', () => {
    let state = createGame({ boardSize: 9 });
    state = play(state, 2, 2);
    state = play(state, 6, 6);

    const undone = undoLastMove(state);
    expect(undone).not.toBeNull();
    expect(undone?.moves).toHaveLength(1);
    expect(undone?.turn).toBe('white');
    expect(undone?.board[6 * 9 + 6]).toBe(0);
  });

  it('puts a captured stone back and rewinds the counter', () => {
    let state = gameFromAscii(['.....', '.....', '.....', '.....', '.....']);
    // Black surrounds the white stone at 1,1 while White answers far away.
    for (const [x, y] of [
      [1, 0],
      [1, 1],
      [0, 1],
      [4, 4],
      [1, 2],
      [4, 3],
      [2, 1],
    ] as const) {
      state = play(state, x, y);
    }

    expect(state.captures.black).toBe(1);
    expect(board(state)[1]).toBe('X.X..');

    const undone = undoLastMove(state);
    expect(undone?.captures.black).toBe(0);
    expect(board(undone as GameState)[1]).toBe('XO...');
  });

  it('returns null when there is nothing to take back', () => {
    expect(undoLastMove(createGame({ boardSize: 9 }))).toBeNull();
  });
});
