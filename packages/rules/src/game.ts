import { collectGroup, createBoard, indexToPoint, isInside, neighborIndices, pointToIndex } from './board.js';
import {
  EMPTY,
  opponent,
  samePoint,
  stoneOf,
  type BoardSize,
  type Color,
  type GameState,
  type IllegalReason,
  type Move,
  type MoveOutcome,
  type Point,
} from './types.js';

/** Compensation in points for White, who moves second. Standard for area scoring. */
export const DEFAULT_KOMI = 7.5;

export type GameConfig = {
  boardSize: BoardSize;
  komi?: number;
};

export function createGame(config: GameConfig): GameState {
  const komi = config.komi ?? DEFAULT_KOMI;
  return {
    boardSize: config.boardSize,
    komi,
    board: createBoard(config.boardSize),
    turn: 'black',
    captures: { black: 0, white: 0 },
    koPoint: null,
    passesInARow: 0,
    phase: 'playing',
    moves: [],
    dead: new Array(config.boardSize * config.boardSize).fill(false),
    confirmed: { black: false, white: false },
    result: null,
  };
}

function reject(reason: IllegalReason): MoveOutcome {
  return { ok: false, reason };
}

export function applyMove(state: GameState, color: Color, move: Move): MoveOutcome {
  switch (move.type) {
    case 'play':
      return playStone(state, color, move.point);
    case 'pass':
      return passTurn(state, color);
    case 'resign':
      return resign(state, color);
  }
}

/**
 * Why a stone cannot be placed here, or null when the move is legal.
 * The client uses this to grey out illegal intersections before sending
 * anything to the server, and the server uses it as the final word.
 */
export function moveLegality(state: GameState, color: Color, point: Point): IllegalReason | null {
  const outcome = playStone(state, color, point);
  return outcome.ok ? null : outcome.reason;
}

function playStone(state: GameState, color: Color, point: Point): MoveOutcome {
  if (state.phase !== 'playing') return reject('wrong-phase');
  if (state.turn !== color) return reject('not-your-turn');

  const size = state.boardSize;
  if (!isInside(size, point)) return reject('out-of-bounds');

  const index = pointToIndex(size, point);
  if (state.board[index] !== EMPTY) return reject('occupied');
  if (state.koPoint !== null && samePoint(state.koPoint, point)) return reject('ko');

  const board = Int8Array.from(state.board);
  const mine = stoneOf(color);
  const theirs = stoneOf(opponent(color));
  board[index] = mine;

  let captured = 0;
  let lastCapturedIndex = -1;
  for (const neighbor of neighborIndices(size, index)) {
    if (board[neighbor] !== theirs) continue;
    const group = collectGroup(board, size, neighbor);
    if (group.liberties.length > 0) continue;
    for (const stone of group.stones) {
      board[stone] = EMPTY;
      lastCapturedIndex = stone;
    }
    captured += group.stones.length;
  }

  const placed = collectGroup(board, size, index);
  if (captured === 0 && placed.liberties.length === 0) return reject('suicide');

  // Ko: a lone stone that took exactly one stone and now has a single liberty
  // could be taken straight back, repeating the position forever.
  const koPoint =
    captured === 1 && placed.stones.length === 1 && placed.liberties.length === 1
      ? indexToPoint(size, lastCapturedIndex)
      : null;

  return {
    ok: true,
    state: {
      ...state,
      board,
      turn: opponent(color),
      captures: {
        ...state.captures,
        [color]: state.captures[color] + captured,
      },
      koPoint,
      passesInARow: 0,
      moves: [...state.moves, { color, move: { type: 'play', point }, captured }],
    },
  };
}

function passTurn(state: GameState, color: Color): MoveOutcome {
  if (state.phase !== 'playing') return reject('wrong-phase');
  if (state.turn !== color) return reject('not-your-turn');

  const passesInARow = state.passesInARow + 1;
  const bothPassed = passesInARow >= 2;

  return {
    ok: true,
    state: {
      ...state,
      turn: opponent(color),
      koPoint: null,
      passesInARow,
      phase: bothPassed ? 'marking' : 'playing',
      dead: bothPassed ? new Array(state.board.length).fill(false) : state.dead,
      confirmed: bothPassed ? { black: false, white: false } : state.confirmed,
      moves: [...state.moves, { color, move: { type: 'pass' }, captured: 0 }],
    },
  };
}

function resign(state: GameState, color: Color): MoveOutcome {
  if (state.phase === 'finished') return reject('wrong-phase');

  return {
    ok: true,
    state: {
      ...state,
      phase: 'finished',
      result: { type: 'resignation', winner: opponent(color) },
      moves: [...state.moves, { color, move: { type: 'resign' }, captured: 0 }],
    },
  };
}

/**
 * Rebuilds a game by replaying its moves from an empty board. Cheap even on a
 * full 19x19, and it means undo needs no stored snapshots.
 */
export function replayMoves(config: GameConfig, moves: GameState['moves']): GameState {
  let state = createGame(config);
  for (const [index, record] of moves.entries()) {
    const outcome = applyMove(state, record.color, record.move);
    if (!outcome.ok) {
      throw new Error(`Move ${index} became illegal while replaying: ${outcome.reason}`);
    }
    state = outcome.state;
  }
  return state;
}

/** Takes back the last move. Returns null when there is nothing to take back. */
export function undoLastMove(state: GameState): GameState | null {
  if (state.moves.length === 0) return null;
  return replayMoves(
    { boardSize: state.boardSize as BoardSize, komi: state.komi },
    state.moves.slice(0, -1),
  );
}
