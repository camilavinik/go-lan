import {
  boardFromString,
  boardToString,
  currentScore,
  type Color,
  type GamePhase,
  type GameResult,
  type GameState,
  type Point,
} from '@go-lan/rules';

export type PlayerInfo = {
  nick: string;
  connected: boolean;
};

export type ScoreView = {
  black: number;
  white: number;
  blackStones: number;
  whiteStones: number;
  blackTerritory: number;
  whiteTerritory: number;
  komi: number;
  /** One character per intersection: "X", "O" or "." for neutral. */
  ownership: string;
};

/**
 * Everything a client needs to draw the game. The server sends a whole one of
 * these after every change; on a 19x19 board it is a few hundred bytes, which is
 * cheaper than the bugs that come with incremental updates.
 */
export type GameSnapshot = {
  code: string;
  boardSize: number;
  komi: number;
  /** One character per intersection: "X", "O" or ".". */
  board: string;
  turn: Color;
  captures: { black: number; white: number };
  koPoint: Point | null;
  passesInARow: number;
  phase: GamePhase;
  moveCount: number;
  lastMove: { color: Color; point: Point | null } | null;
  /** One character per intersection: "1" when the stone is marked dead. */
  dead: string;
  confirmed: { black: boolean; white: boolean };
  result: GameResult | null;
  /** The count as it stands, while marking and once the game is scored. */
  score: ScoreView | null;
  players: { black: PlayerInfo | null; white: PlayerInfo | null };
  spectators: number;
  pendingUndo: { by: Color } | null;
};

export type SnapshotContext = {
  code: string;
  players: GameSnapshot['players'];
  spectators: number;
  pendingUndo: GameSnapshot['pendingUndo'];
};

function lastMoveOf(state: GameState): GameSnapshot['lastMove'] {
  const record = state.moves.at(-1);
  if (!record || record.move.type === 'resign') return null;
  return {
    color: record.color,
    point: record.move.type === 'play' ? record.move.point : null,
  };
}

function scoreView(state: GameState): ScoreView | null {
  if (state.phase === 'playing') return null;
  const breakdown = currentScore(state);
  return {
    black: breakdown.black,
    white: breakdown.white,
    blackStones: breakdown.blackStones,
    whiteStones: breakdown.whiteStones,
    blackTerritory: breakdown.blackTerritory,
    whiteTerritory: breakdown.whiteTerritory,
    komi: breakdown.komi,
    ownership: boardToString(breakdown.ownership),
  };
}

export function toSnapshot(state: GameState, context: SnapshotContext): GameSnapshot {
  return {
    code: context.code,
    boardSize: state.boardSize,
    komi: state.komi,
    board: boardToString(state.board),
    turn: state.turn,
    captures: { ...state.captures },
    koPoint: state.koPoint,
    passesInARow: state.passesInARow,
    phase: state.phase,
    moveCount: state.moves.length,
    lastMove: lastMoveOf(state),
    dead: state.dead.map((isDead) => (isDead ? '1' : '0')).join(''),
    confirmed: { ...state.confirmed },
    result: state.result,
    score: scoreView(state),
    players: context.players,
    spectators: context.spectators,
    pendingUndo: context.pendingUndo,
  };
}

/**
 * Rebuilds a state the client can ask rules questions of, such as whether a
 * move is legal. The move history is not sent, so it comes back empty: nothing
 * in the rules depends on it beyond recording what happened.
 */
export function fromSnapshot(snapshot: GameSnapshot): GameState {
  return {
    boardSize: snapshot.boardSize,
    komi: snapshot.komi,
    board: boardFromString(snapshot.board),
    turn: snapshot.turn,
    captures: { ...snapshot.captures },
    koPoint: snapshot.koPoint,
    passesInARow: snapshot.passesInARow,
    phase: snapshot.phase,
    moves: [],
    dead: [...snapshot.dead].map((flag) => flag === '1'),
    confirmed: { ...snapshot.confirmed },
    result: snapshot.result,
  };
}
