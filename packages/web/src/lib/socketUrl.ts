/**
 * The server hands out the page and the socket on the same origin, so we only
 * have to swap the scheme. In development Vite proxies /ws to the API.
 */
export function socketUrl(): string {
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${window.location.host}/ws`;
}
