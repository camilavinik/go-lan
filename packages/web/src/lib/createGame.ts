import type { ServerMessage } from '@go-lan/protocol';
import type { BoardSize } from '@go-lan/rules';
import { saveToken } from './session.js';
import { socketUrl } from './socketUrl.js';

export type NewGameRequest = {
  nick: string;
  boardSize: BoardSize;
  color: 'black' | 'white' | 'random';
};

const TIMEOUT_MS = 5000;

/**
 * Opens a short lived connection just to create the game and learn its code.
 * The game screen then opens its own connection and reclaims the seat with the
 * token saved here.
 */
export function requestNewGame(request: NewGameRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(socketUrl());
    const timer = window.setTimeout(() => {
      socket.close();
      reject(new Error('The server did not answer in time.'));
    }, TIMEOUT_MS);

    const finish = (error: Error | null, code?: string) => {
      window.clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else resolve(code as string);
    };

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'create', ...request }));
    });

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data as string) as ServerMessage;
      if (message.type === 'welcome') {
        saveToken(message.snapshot.code, message.token);
        finish(null, message.snapshot.code);
      } else if (message.type === 'rejected') {
        finish(new Error(message.message));
      }
    });

    socket.addEventListener('error', () => finish(new Error('Could not reach the server.')));
  });
}
