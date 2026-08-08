import { EventEmitter } from 'node:events';
import type { ClientMessage, ServerMessage } from '@go-lan/protocol';
import type { WebSocket } from 'ws';
import { beforeEach, describe, expect, it } from 'vitest';
import { Gateway } from '../src/gateway.js';
import { RoomRegistry } from '../src/rooms.js';

class FakeSocket extends EventEmitter {
  readyState = 1;
  readonly received: ServerMessage[] = [];

  send(data: string): void {
    this.received.push(JSON.parse(data) as ServerMessage);
  }

  ping(): void {}
  terminate(): void {}
  close(): void {}

  /** Simulates the client sending a message. */
  say(message: ClientMessage): void {
    this.emit('message', Buffer.from(JSON.stringify(message)));
  }

  disconnect(): void {
    this.readyState = 3;
    this.emit('close');
  }

  last(): ServerMessage {
    const message = this.received.at(-1);
    if (!message) throw new Error('The socket received nothing');
    return message;
  }

  lastOfType<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> {
    const message = [...this.received].reverse().find((entry) => entry.type === type);
    if (!message) throw new Error(`The socket never received a "${type}" message`);
    return message as Extract<ServerMessage, { type: T }>;
  }
}

let registry: RoomRegistry;
let gateway: Gateway;

function connect(): FakeSocket {
  const socket = new FakeSocket();
  gateway.handleConnection(socket as unknown as WebSocket);
  return socket;
}

function hostAGame(nick = 'Camila'): { socket: FakeSocket; code: string } {
  const socket = connect();
  socket.say({ type: 'create', nick, boardSize: 9, color: 'black' });
  return { socket, code: socket.lastOfType('welcome').snapshot.code };
}

beforeEach(() => {
  registry = new RoomRegistry();
  gateway = new Gateway(registry);
});

describe('joining a game', () => {
  it('welcomes the host as the colour they chose', () => {
    const { socket } = hostAGame();
    const welcome = socket.lastOfType('welcome');

    expect(welcome.color).toBe('black');
    expect(welcome.token).toBeTruthy();
    expect(welcome.snapshot.players.black?.nick).toBe('Camila');
  });

  it('seats the guest and tells the host about it', () => {
    const { socket: host, code } = hostAGame();
    const guest = connect();
    guest.say({ type: 'join', code, nick: 'Ana' });

    expect(guest.lastOfType('welcome').color).toBe('white');
    expect(host.lastOfType('snapshot').snapshot.players.white?.nick).toBe('Ana');
  });

  it('lets a third person watch', () => {
    const { code } = hostAGame();
    connect().say({ type: 'join', code, nick: 'Ana' });

    const watcher = connect();
    watcher.say({ type: 'join', code, nick: 'Sofia' });

    expect(watcher.lastOfType('welcome').color).toBeNull();
    expect(watcher.lastOfType('welcome').snapshot.spectators).toBe(1);
  });

  it('turns away an unknown code', () => {
    const socket = connect();
    socket.say({ type: 'join', code: 'ZZZZZZ', nick: 'Ana' });

    expect(socket.last()).toMatchObject({ type: 'rejected', reason: 'unknown-game' });
  });

  it('turns away a message it cannot parse', () => {
    const socket = connect();
    socket.emit('message', Buffer.from('this is not json'));

    expect(socket.last()).toMatchObject({ type: 'rejected', reason: 'invalid-message' });
  });
});

describe('playing', () => {
  it('broadcasts the new position to both players', () => {
    const { socket: host, code } = hostAGame();
    const guest = connect();
    guest.say({ type: 'join', code, nick: 'Ana' });

    host.say({ type: 'play', point: { x: 2, y: 2 } });

    expect(guest.lastOfType('snapshot').snapshot.board[2 * 9 + 2]).toBe('X');
    expect(host.lastOfType('snapshot').snapshot.turn).toBe('white');
  });

  it('refuses a move out of turn', () => {
    const { code } = hostAGame();
    const guest = connect();
    guest.say({ type: 'join', code, nick: 'Ana' });

    guest.say({ type: 'play', point: { x: 2, y: 2 } });
    expect(guest.last()).toMatchObject({ type: 'rejected', reason: 'not-your-turn' });
  });

  it('refuses an illegal move with the rules engine reason', () => {
    const { socket: host, code } = hostAGame();
    const guest = connect();
    guest.say({ type: 'join', code, nick: 'Ana' });

    host.say({ type: 'play', point: { x: 2, y: 2 } });
    guest.say({ type: 'play', point: { x: 2, y: 2 } });

    expect(guest.last()).toMatchObject({ type: 'rejected', reason: 'occupied' });
  });

  it('does not let a spectator play', () => {
    const { code } = hostAGame();
    connect().say({ type: 'join', code, nick: 'Ana' });

    const watcher = connect();
    watcher.say({ type: 'join', code, nick: 'Sofia' });
    watcher.say({ type: 'play', point: { x: 2, y: 2 } });

    expect(watcher.last()).toMatchObject({ type: 'rejected', reason: 'spectators-cannot-play' });
  });

  it('does not let a stray connection play', () => {
    const socket = connect();
    socket.say({ type: 'pass' });

    expect(socket.last()).toMatchObject({ type: 'rejected', reason: 'not-in-a-game' });
  });
});

describe('leaving and coming back', () => {
  it('marks a player away when they disconnect and back when they return', () => {
    const { socket: host, code } = hostAGame();
    const token = host.lastOfType('welcome').token;

    const guest = connect();
    guest.say({ type: 'join', code, nick: 'Ana' });

    host.disconnect();
    expect(guest.lastOfType('snapshot').snapshot.players.black?.connected).toBe(false);

    const reopened = connect();
    reopened.say({ type: 'rejoin', code, token });

    expect(reopened.lastOfType('welcome').color).toBe('black');
    expect(guest.lastOfType('snapshot').snapshot.players.black?.connected).toBe(true);
  });

  it('keeps the position through a reconnection', () => {
    const { socket: host, code } = hostAGame();
    const token = host.lastOfType('welcome').token;
    host.say({ type: 'play', point: { x: 4, y: 4 } });
    host.disconnect();

    const reopened = connect();
    reopened.say({ type: 'rejoin', code, token });

    expect(reopened.lastOfType('welcome').snapshot.board[4 * 9 + 4]).toBe('X');
  });
});

describe('finishing a game', () => {
  it('walks from two passes through marking to a final score', () => {
    const { socket: host, code } = hostAGame();
    const guest = connect();
    guest.say({ type: 'join', code, nick: 'Ana' });

    host.say({ type: 'pass' });
    guest.say({ type: 'pass' });
    expect(host.lastOfType('snapshot').snapshot.phase).toBe('marking');

    host.say({ type: 'confirmScore' });
    expect(host.lastOfType('snapshot').snapshot.phase).toBe('marking');

    guest.say({ type: 'confirmScore' });
    const finished = host.lastOfType('snapshot').snapshot;

    expect(finished.phase).toBe('finished');
    // An empty board is all neutral, so White wins on komi alone.
    expect(finished.result).toMatchObject({ type: 'score', winner: 'white' });
  });

  it('goes back to playing when someone disputes the marking', () => {
    const { socket: host, code } = hostAGame();
    const guest = connect();
    guest.say({ type: 'join', code, nick: 'Ana' });

    host.say({ type: 'pass' });
    guest.say({ type: 'pass' });
    guest.say({ type: 'resumeGame' });

    expect(host.lastOfType('snapshot').snapshot.phase).toBe('playing');
  });

  it('ends the game on a resignation', () => {
    const { socket: host, code } = hostAGame();
    const guest = connect();
    guest.say({ type: 'join', code, nick: 'Ana' });

    host.say({ type: 'resign' });
    expect(guest.lastOfType('snapshot').snapshot.result).toEqual({
      type: 'resignation',
      winner: 'white',
    });
  });
});
