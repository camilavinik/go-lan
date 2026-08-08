const NICK_KEY = 'go-lan:nick';
const tokenKey = (code: string) => `go-lan:token:${code.toUpperCase()}`;

/**
 * The seat token is how the server recognises you after a refresh. It is the
 * closest thing this app has to a login, and it never leaves the browser except
 * to reclaim your own seat.
 */
export function saveToken(code: string, token: string): void {
  localStorage.setItem(tokenKey(code), token);
}

export function loadToken(code: string): string | null {
  return localStorage.getItem(tokenKey(code));
}

export function forgetToken(code: string): void {
  localStorage.removeItem(tokenKey(code));
}

export function saveNick(nick: string): void {
  localStorage.setItem(NICK_KEY, nick);
}

export function loadNick(): string {
  return localStorage.getItem(NICK_KEY) ?? '';
}
