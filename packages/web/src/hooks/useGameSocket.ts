import type { ClientMessage, GameSnapshot, ServerMessage } from '@go-lan/protocol';
import type { Color } from '@go-lan/rules';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { forgetToken, loadToken, saveToken } from '../lib/session.js';
import { socketUrl } from '../lib/socketUrl.js';

const RETRY_DELAY_MS = 1500;

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

type State = {
  status: ConnectionStatus;
  snapshot: GameSnapshot | null;
  myColor: Color | null;
  /** The address to build invite links from, as reported by the server. */
  shareOrigin: string | null;
  /** A refused action, shown until the player does something else. */
  notice: string | null;
  /** Set when the game is gone for good, so retrying is pointless. */
  fatal: string | null;
};

type Action =
  | { type: 'connecting' }
  | { type: 'opened' }
  | { type: 'closed' }
  | { type: 'server'; message: ServerMessage }
  | { type: 'notice'; text: string | null };

const initialState: State = {
  status: 'connecting',
  snapshot: null,
  myColor: null,
  shareOrigin: null,
  notice: null,
  fatal: null,
};

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'connecting':
      return { ...state, status: 'connecting' };
    case 'opened':
      return { ...state, status: 'open' };
    case 'closed':
      return { ...state, status: 'closed' };
    case 'notice':
      return { ...state, notice: action.text };
    case 'server': {
      const message = action.message;
      switch (message.type) {
        case 'welcome':
          return {
            ...state,
            status: 'open',
            snapshot: message.snapshot,
            myColor: message.color,
            shareOrigin: message.shareOrigin,
            notice: null,
            fatal: null,
          };
        case 'snapshot':
          return { ...state, snapshot: message.snapshot };
        case 'rejected':
          return message.reason === 'unknown-game'
            ? { ...state, fatal: message.message }
            : { ...state, notice: message.message };
      }
    }
  }
}

/**
 * Holds the connection for one game. The server snapshot is the only source of
 * truth here; nothing about the position is kept locally.
 */
export function useGameSocket(code: string, nick: string | null) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const nickRef = useRef(nick);
  nickRef.current = nick;

  const shouldConnect = nick !== null || loadToken(code) !== null;

  useEffect(() => {
    if (!shouldConnect || state.fatal) return;

    let retry: number | undefined;
    const socket = new WebSocket(socketUrl());
    socketRef.current = socket;
    dispatch({ type: 'connecting' });

    socket.addEventListener('open', () => {
      dispatch({ type: 'opened' });
      const token = loadToken(code);
      const hello: ClientMessage = token
        ? { type: 'rejoin', code, token }
        : { type: 'join', code, nick: nickRef.current ?? 'Guest' };
      socket.send(JSON.stringify(hello));
    });

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data as string) as ServerMessage;
      if (message.type === 'welcome') saveToken(code, message.token);
      // A token the server no longer knows is worse than no token: drop it so
      // the next attempt joins fresh.
      if (message.type === 'rejected' && message.reason === 'unknown-token') forgetToken(code);
      dispatch({ type: 'server', message });
    });

    socket.addEventListener('close', () => {
      dispatch({ type: 'closed' });
      retry = window.setTimeout(() => setAttempt((count) => count + 1), RETRY_DELAY_MS);
    });

    return () => {
      window.clearTimeout(retry);
      socket.close();
      socketRef.current = null;
    };
  }, [code, shouldConnect, attempt, state.fatal]);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
  }, []);

  const dismissNotice = useCallback(() => dispatch({ type: 'notice', text: null }), []);
  const showNotice = useCallback(
    (text: string) => dispatch({ type: 'notice', text }),
    [],
  );

  return { ...state, send, showNotice, dismissNotice };
}
