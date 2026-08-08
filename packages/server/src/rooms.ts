import { randomUUID } from 'node:crypto';
import { toSnapshot, type GameSnapshot, type RejectionReason } from '@go-lan/protocol';
import {
  applyMove,
  confirmScore,
  createGame,
  resumePlaying,
  toggleDeadGroup,
  undoLastMove,
  type BoardSize,
  type Color,
  type GameState,
  type Move,
  type Point,
} from '@go-lan/rules';
import { generateUniqueGameCode } from './codes.js';

export type Seat = {
  token: string;
  nick: string;
  /** How many browser tabs currently hold this seat. */
  openSockets: number;
};

export type Room = {
  code: string;
  game: GameState;
  seats: { black: Seat | null; white: Seat | null };
  spectators: number;
  pendingUndo: { by: Color } | null;
  lastActivity: number;
};

/** null colour means the connection is watching rather than playing. */
export type Seating = { room: Room; token: string; color: Color | null };

export type CreateOptions = {
  nick: string;
  boardSize: BoardSize;
  komi?: number;
  color?: 'black' | 'white' | 'random';
};

export type Outcome<T> = { ok: true; value: T } | { ok: false; reason: RejectionReason };
export type ActionOutcome = { ok: true } | { ok: false; reason: RejectionReason };

export const ROOM_IDLE_TIMEOUT_MS = 60 * 60 * 1000;

const failed = (reason: RejectionReason): { ok: false; reason: RejectionReason } => ({
  ok: false,
  reason,
});

/**
 * Every live game, held in memory. Deliberately knows nothing about sockets, so
 * the rules of joining, seating and taking back moves can be tested directly.
 */
export class RoomRegistry {
  readonly #rooms = new Map<string, Room>();
  readonly #now: () => number;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  get size(): number {
    return this.#rooms.size;
  }

  get(code: string): Room | undefined {
    return this.#rooms.get(code.toUpperCase());
  }

  create(options: CreateOptions): Seating {
    const code = generateUniqueGameCode((candidate) => this.#rooms.has(candidate));
    const room: Room = {
      code,
      game: createGame({ boardSize: options.boardSize, komi: options.komi }),
      seats: { black: null, white: null },
      spectators: 0,
      pendingUndo: null,
      lastActivity: this.#now(),
    };

    const requested = options.color ?? 'black';
    const color: Color =
      requested === 'random' ? (Math.random() < 0.5 ? 'black' : 'white') : requested;

    const seat: Seat = { token: randomUUID(), nick: options.nick, openSockets: 0 };
    room.seats[color] = seat;
    this.#rooms.set(code, room);

    return { room, token: seat.token, color };
  }

  /** Takes the free seat if there is one, otherwise joins as a spectator. */
  join(code: string, nick: string): Outcome<Seating> {
    const room = this.get(code);
    if (!room) return failed('unknown-game');

    const color: Color | null =
      room.seats.black === null ? 'black' : room.seats.white === null ? 'white' : null;

    const token = randomUUID();
    if (color !== null) {
      room.seats[color] = { token, nick, openSockets: 0 };
    }

    this.#touch(room);
    return { ok: true, value: { room, token, color } };
  }

  /** Returns a player to their seat after a refresh or a dropped connection. */
  rejoin(code: string, token: string): Outcome<Seating> {
    const room = this.get(code);
    if (!room) return failed('unknown-game');

    for (const color of ['black', 'white'] as const) {
      if (room.seats[color]?.token === token) {
        return { ok: true, value: { room, token, color } };
      }
    }

    return failed('unknown-token');
  }

  attach(room: Room, color: Color | null): void {
    if (color === null) room.spectators += 1;
    else if (room.seats[color]) room.seats[color].openSockets += 1;
    this.#touch(room);
  }

  detach(room: Room, color: Color | null): void {
    if (color === null) room.spectators = Math.max(0, room.spectators - 1);
    else if (room.seats[color]) {
      room.seats[color].openSockets = Math.max(0, room.seats[color].openSockets - 1);
    }
    this.#touch(room);
  }

  /** Drops games nobody has been connected to for a while, so memory stays flat. */
  sweep(idleMs: number = ROOM_IDLE_TIMEOUT_MS): number {
    const now = this.#now();
    let removed = 0;

    for (const [code, room] of this.#rooms) {
      const connections =
        room.spectators +
        (room.seats.black?.openSockets ?? 0) +
        (room.seats.white?.openSockets ?? 0);
      if (connections === 0 && now - room.lastActivity > idleMs) {
        this.#rooms.delete(code);
        removed += 1;
      }
    }

    return removed;
  }

  snapshot(room: Room): GameSnapshot {
    return toSnapshot(room.game, {
      code: room.code,
      players: {
        black: describeSeat(room.seats.black),
        white: describeSeat(room.seats.white),
      },
      spectators: room.spectators,
      pendingUndo: room.pendingUndo,
    });
  }

  move(room: Room, color: Color, move: Move): ActionOutcome {
    const outcome = applyMove(room.game, color, move);
    if (!outcome.ok) return failed(outcome.reason);

    room.game = outcome.state;
    room.pendingUndo = null;
    this.#touch(room);
    return { ok: true };
  }

  toggleDead(room: Room, point: Point): ActionOutcome {
    if (room.game.phase !== 'marking') return failed('wrong-phase');

    const next = toggleDeadGroup(room.game, point);
    // Clicking an empty intersection is a miss, not an error worth reporting.
    if (next) {
      room.game = next;
      this.#touch(room);
    }
    return { ok: true };
  }

  confirmScore(room: Room, color: Color): ActionOutcome {
    const next = confirmScore(room.game, color);
    if (!next) return failed('wrong-phase');

    room.game = next;
    this.#touch(room);
    return { ok: true };
  }

  resumeGame(room: Room): ActionOutcome {
    const next = resumePlaying(room.game);
    if (!next) return failed('wrong-phase');

    room.game = next;
    this.#touch(room);
    return { ok: true };
  }

  requestUndo(room: Room, color: Color): ActionOutcome {
    if (room.game.phase !== 'playing') return failed('wrong-phase');
    if (room.game.moves.length === 0) return failed('nothing-to-undo');

    room.pendingUndo = { by: color };
    this.#touch(room);
    return { ok: true };
  }

  respondUndo(room: Room, color: Color, accept: boolean): ActionOutcome {
    const pending = room.pendingUndo;
    if (!pending) return failed('no-pending-undo');
    if (pending.by === color) return failed('undo-not-yours');

    if (accept) {
      const rewound = undoLastMove(room.game);
      if (!rewound) return failed('nothing-to-undo');
      room.game = rewound;
    }

    room.pendingUndo = null;
    this.#touch(room);
    return { ok: true };
  }

  #touch(room: Room): void {
    room.lastActivity = this.#now();
  }
}

function describeSeat(seat: Seat | null): { nick: string; connected: boolean } | null {
  if (!seat) return null;
  return { nick: seat.nick, connected: seat.openSockets > 0 };
}
