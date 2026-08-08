import {
  clientMessageSchema,
  describeRejection,
  type ClientMessage,
  type RejectionReason,
  type ServerMessage,
} from '@go-lan/protocol';
import type { Color } from '@go-lan/rules';
import type { RawData, WebSocket } from 'ws';
import type { Room, RoomRegistry, Seating } from './rooms.js';

const OPEN = 1;

type Session = {
  room: Room;
  color: Color | null;
  token: string;
};

type Alive = { isAlive?: boolean };

/**
 * Translates socket traffic into registry calls. It owns the mapping from
 * connections to seats; the registry owns the game rules.
 */
export class Gateway {
  readonly #registry: RoomRegistry;
  readonly #sessions = new Map<WebSocket, Session>();
  readonly #socketsByCode = new Map<string, Set<WebSocket>>();

  constructor(registry: RoomRegistry) {
    this.#registry = registry;
  }

  handleConnection(socket: WebSocket): void {
    (socket as WebSocket & Alive).isAlive = true;
    socket.on('pong', () => {
      (socket as WebSocket & Alive).isAlive = true;
    });
    socket.on('message', (raw: RawData) => this.#handleMessage(socket, raw));
    socket.on('close', () => this.#handleClose(socket));
    socket.on('error', () => socket.close());
  }

  /**
   * Closes connections that stopped answering, so a laptop that went to sleep
   * does not leave its player showing as present forever.
   */
  checkHeartbeats(): void {
    for (const socket of this.#sessions.keys()) {
      const tracked = socket as WebSocket & Alive;
      if (tracked.isAlive === false) {
        socket.terminate();
        continue;
      }
      tracked.isAlive = false;
      socket.ping();
    }
  }

  #handleMessage(socket: WebSocket, raw: RawData): void {
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      this.#reject(socket, 'invalid-message');
      return;
    }

    const parsed = clientMessageSchema.safeParse(payload);
    if (!parsed.success) {
      this.#reject(socket, 'invalid-message');
      return;
    }

    this.#dispatch(socket, parsed.data);
  }

  #dispatch(socket: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case 'create': {
        this.#enter(
          socket,
          this.#registry.create({
            nick: message.nick,
            boardSize: message.boardSize,
            komi: message.komi,
            color: message.color,
          }),
        );
        return;
      }

      case 'join': {
        const outcome = this.#registry.join(message.code, message.nick);
        if (!outcome.ok) {
          this.#reject(socket, outcome.reason);
          return;
        }
        this.#enter(socket, outcome.value);
        return;
      }

      case 'rejoin': {
        const outcome = this.#registry.rejoin(message.code, message.token);
        if (!outcome.ok) {
          this.#reject(socket, outcome.reason);
          return;
        }
        this.#enter(socket, outcome.value);
        return;
      }

      default:
        this.#dispatchGameAction(socket, message);
    }
  }

  #dispatchGameAction(
    socket: WebSocket,
    message: Exclude<ClientMessage, { type: 'create' | 'join' | 'rejoin' }>,
  ): void {
    const session = this.#sessions.get(socket);
    if (!session) {
      this.#reject(socket, 'not-in-a-game');
      return;
    }
    if (session.color === null) {
      this.#reject(socket, 'spectators-cannot-play');
      return;
    }

    const { room, color } = session;
    const registry = this.#registry;

    const outcome = (() => {
      switch (message.type) {
        case 'play':
          return registry.move(room, color, { type: 'play', point: message.point });
        case 'pass':
          return registry.move(room, color, { type: 'pass' });
        case 'resign':
          return registry.move(room, color, { type: 'resign' });
        case 'toggleDead':
          return registry.toggleDead(room, message.point);
        case 'confirmScore':
          return registry.confirmScore(room, color);
        case 'resumeGame':
          return registry.resumeGame(room);
        case 'undoRequest':
          return registry.requestUndo(room, color);
        case 'undoRespond':
          return registry.respondUndo(room, color, message.accept);
      }
    })();

    if (!outcome.ok) {
      this.#reject(socket, outcome.reason);
      return;
    }

    this.#broadcast(room);
  }

  #enter(socket: WebSocket, seating: Seating): void {
    this.#leaveCurrentRoom(socket);

    const { room, color, token } = seating;
    this.#sessions.set(socket, { room, color, token });

    let sockets = this.#socketsByCode.get(room.code);
    if (!sockets) {
      sockets = new Set();
      this.#socketsByCode.set(room.code, sockets);
    }
    sockets.add(socket);

    this.#registry.attach(room, color);

    send(socket, {
      type: 'welcome',
      token,
      color,
      snapshot: this.#registry.snapshot(room),
    });
    this.#broadcast(room, socket);
  }

  #handleClose(socket: WebSocket): void {
    const session = this.#leaveCurrentRoom(socket);
    if (session) this.#broadcast(session.room);
  }

  #leaveCurrentRoom(socket: WebSocket): Session | null {
    const session = this.#sessions.get(socket);
    if (!session) return null;

    this.#sessions.delete(socket);
    this.#registry.detach(session.room, session.color);

    const sockets = this.#socketsByCode.get(session.room.code);
    if (sockets) {
      sockets.delete(socket);
      if (sockets.size === 0) this.#socketsByCode.delete(session.room.code);
    }

    return session;
  }

  #broadcast(room: Room, except?: WebSocket): void {
    const sockets = this.#socketsByCode.get(room.code);
    if (!sockets || sockets.size === 0) return;

    const message: ServerMessage = { type: 'snapshot', snapshot: this.#registry.snapshot(room) };
    for (const socket of sockets) {
      if (socket !== except) send(socket, message);
    }
  }

  #reject(socket: WebSocket, reason: RejectionReason): void {
    send(socket, { type: 'rejected', reason, message: describeRejection(reason) });
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState !== OPEN) return;
  socket.send(JSON.stringify(message));
}
