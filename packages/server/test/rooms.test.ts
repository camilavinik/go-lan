import { describe, expect, it } from 'vitest';
import { ROOM_IDLE_TIMEOUT_MS, RoomRegistry } from '../src/rooms.js';

function registryWithClock() {
  let now = 0;
  const registry = new RoomRegistry(() => now);
  return {
    registry,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe('creating and joining', () => {
  it('gives the creator the colour they asked for', () => {
    const registry = new RoomRegistry();
    const white = registry.create({ nick: 'Camila', boardSize: 9, color: 'white' });

    expect(white.color).toBe('white');
    expect(white.room.seats.white?.nick).toBe('Camila');
    expect(white.room.seats.black).toBeNull();
  });

  it('gives the code six unambiguous characters', () => {
    const registry = new RoomRegistry();
    const { room } = registry.create({ nick: 'Camila', boardSize: 19 });
    expect(room.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('seats the second player in the free chair', () => {
    const registry = new RoomRegistry();
    const created = registry.create({ nick: 'Camila', boardSize: 9, color: 'black' });
    const joined = registry.join(created.room.code, 'Ana');

    expect(joined.ok && joined.value.color).toBe('white');
  });

  it('accepts the code in lower case, because people type it that way', () => {
    const registry = new RoomRegistry();
    const created = registry.create({ nick: 'Camila', boardSize: 9 });
    const joined = registry.join(created.room.code.toLowerCase(), 'Ana');

    expect(joined.ok).toBe(true);
  });

  it('turns a third arrival into a spectator', () => {
    const registry = new RoomRegistry();
    const created = registry.create({ nick: 'Camila', boardSize: 9 });
    registry.join(created.room.code, 'Ana');
    const watcher = registry.join(created.room.code, 'Sofia');

    expect(watcher.ok && watcher.value.color).toBeNull();
  });

  it('refuses a code nobody is playing', () => {
    const registry = new RoomRegistry();
    const joined = registry.join('ZZZZZZ', 'Ana');
    expect(joined.ok === false && joined.reason).toBe('unknown-game');
  });
});

describe('reconnecting', () => {
  it('returns a player to their seat with their token', () => {
    const registry = new RoomRegistry();
    const created = registry.create({ nick: 'Camila', boardSize: 9, color: 'black' });

    const back = registry.rejoin(created.room.code, created.token);
    expect(back.ok && back.value.color).toBe('black');
  });

  it('refuses a token from another game', () => {
    const registry = new RoomRegistry();
    const created = registry.create({ nick: 'Camila', boardSize: 9 });

    const back = registry.rejoin(created.room.code, 'not-a-real-token');
    expect(back.ok === false && back.reason).toBe('unknown-token');
  });
});

describe('taking back a move', () => {
  function gameInProgress() {
    const registry = new RoomRegistry();
    const { room } = registry.create({ nick: 'Camila', boardSize: 9, color: 'black' });
    registry.join(room.code, 'Ana');
    registry.move(room, 'black', { type: 'play', point: { x: 2, y: 2 } });
    registry.move(room, 'white', { type: 'play', point: { x: 6, y: 6 } });
    return { registry, room };
  }

  it('rewinds one move once the opponent accepts', () => {
    const { registry, room } = gameInProgress();

    expect(registry.requestUndo(room, 'black').ok).toBe(true);
    expect(room.pendingUndo).toEqual({ by: 'black' });

    expect(registry.respondUndo(room, 'white', true).ok).toBe(true);
    expect(room.game.moves).toHaveLength(1);
    expect(room.pendingUndo).toBeNull();
  });

  it('keeps the position when the opponent says no', () => {
    const { registry, room } = gameInProgress();
    registry.requestUndo(room, 'black');
    registry.respondUndo(room, 'white', false);

    expect(room.game.moves).toHaveLength(2);
    expect(room.pendingUndo).toBeNull();
  });

  it('does not let you answer your own request', () => {
    const { registry, room } = gameInProgress();
    registry.requestUndo(room, 'black');

    const answer = registry.respondUndo(room, 'black', true);
    expect(answer.ok === false && answer.reason).toBe('undo-not-yours');
  });

  it('drops a pending request as soon as somebody plays', () => {
    const { registry, room } = gameInProgress();
    registry.requestUndo(room, 'black');
    registry.move(room, 'black', { type: 'play', point: { x: 4, y: 4 } });

    expect(room.pendingUndo).toBeNull();
  });

  it('has nothing to take back on an empty board', () => {
    const registry = new RoomRegistry();
    const { room } = registry.create({ nick: 'Camila', boardSize: 9 });

    const request = registry.requestUndo(room, 'black');
    expect(request.ok === false && request.reason).toBe('nothing-to-undo');
  });
});

describe('clearing idle games', () => {
  it('removes a game nobody has been connected to for an hour', () => {
    const { registry, advance } = registryWithClock();
    registry.create({ nick: 'Camila', boardSize: 9 });

    advance(ROOM_IDLE_TIMEOUT_MS + 1);
    expect(registry.sweep()).toBe(1);
    expect(registry.size).toBe(0);
  });

  it('keeps a game that still has somebody connected', () => {
    const { registry, advance } = registryWithClock();
    const { room, color } = registry.create({ nick: 'Camila', boardSize: 9 });
    registry.attach(room, color);

    advance(ROOM_IDLE_TIMEOUT_MS + 1);
    expect(registry.sweep()).toBe(0);
  });

  it('keeps a game that was active recently', () => {
    const { registry, advance } = registryWithClock();
    registry.create({ nick: 'Camila', boardSize: 9 });

    advance(ROOM_IDLE_TIMEOUT_MS - 1);
    expect(registry.sweep()).toBe(0);
  });
});

describe('presence', () => {
  it('reports a player as away once their last tab closes', () => {
    const registry = new RoomRegistry();
    const { room, color } = registry.create({ nick: 'Camila', boardSize: 9 });

    registry.attach(room, color);
    expect(registry.snapshot(room).players.black?.connected).toBe(true);

    registry.detach(room, color);
    expect(registry.snapshot(room).players.black?.connected).toBe(false);
  });

  it('counts spectators', () => {
    const registry = new RoomRegistry();
    const { room } = registry.create({ nick: 'Camila', boardSize: 9 });

    registry.attach(room, null);
    registry.attach(room, null);
    expect(registry.snapshot(room).spectators).toBe(2);
  });
});
