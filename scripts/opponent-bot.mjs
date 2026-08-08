// A throwaway opponent for manual testing: creates a game, prints the code and
// answers every move with the first empty intersection it can find. If you pass,
// it passes back, which is how you reach the marking phase by hand.
import { WebSocket } from 'ws';

const url = process.env.GO_LAN_URL ?? 'ws://localhost:8080/ws';
const boardSize = Number(process.env.BOARD_SIZE ?? 9);

const socket = new WebSocket(url);
let myColor = null;

socket.on('open', () => {
  socket.send(JSON.stringify({ type: 'create', nick: 'Bot', boardSize, color: 'black' }));
});

socket.on('message', (raw) => {
  const message = JSON.parse(raw.toString());

  if (message.type === 'welcome') {
    myColor = message.color;
    console.log(`CODE ${message.snapshot.code}`);
  }

  if (message.type === 'rejected') {
    console.log(`REJECTED ${message.reason}`);
    return;
  }

  const snapshot = message.snapshot;
  if (!snapshot || snapshot.phase !== 'playing') return;
  if (snapshot.turn !== myColor || !snapshot.players.white) return;

  const index = [...snapshot.board].findIndex((stone) => stone === '.');
  const reply =
    snapshot.passesInARow > 0 || index < 0
      ? { type: 'pass' }
      : {
          type: 'play',
          point: { x: index % snapshot.boardSize, y: Math.floor(index / snapshot.boardSize) },
        };

  setTimeout(() => socket.send(JSON.stringify(reply)), 400);
});
