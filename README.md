# go-lan

A self-hosted app for playing Go (baduk, weiqi) with someone else on your local network.

One of you creates a game and gets a six character code. The other types the code in and you play.
There are no accounts, no sign up and nothing leaves your network.

## Features

- Real time two player games over WebSocket, on a 9x9, 13x13 or 19x19 board.
- Full rules: captures, ko, suicide, passing and resignation.
- Proper end of game: after two passes you agree which stones are dead, then the
  server counts the board with area scoring.
- Beginner friendly. Illegal moves are refused with the reason why, the last move
  is highlighted and captures are counted for you.
- Take back a move if your opponent agrees.
- Anyone else with the code joins as a spectator.
- Reconnect after a refresh and keep your seat.

Games live in memory only. Restarting the server clears them.

## Running it

With Docker, which is the intended way:

```bash
docker compose up -d
```

Then open `http://localhost:8080` on the machine running it, and
`http://<its-lan-ip>:8080` from any other machine in the house. On macOS you can
find that address with:

```bash
ipconfig getifaddr en0
```

## Development

Requires Node 22 or newer.

```bash
npm install
npm run dev
```

This starts the API on port 8080 and the Vite dev server on port 5173, with the
dev server proxying WebSocket traffic to the API. Open `http://localhost:5173`.

Other useful commands:

```bash
npm test         # run the rules engine and server test suites
npm run build    # build every package
npm run typecheck
```

## How it is put together

```
packages/
  rules/      Pure game logic. No dependencies, heavily tested.
  protocol/   The message types both sides speak, plus their validation.
  server/     Fastify, WebSocket handling and the in-memory room registry.
  web/        React frontend with an SVG board.
```

The interesting part is that `rules` runs in both places. The browser uses it to
tell you instantly whether a move is legal, and the server uses the very same
function as the final word, so the two can never disagree about the rules.

The design document lives in [docs/superpowers/specs](docs/superpowers/specs).

## New to Go?

The board starts empty. Black plays first, and players alternate placing a stone
on any empty intersection. A group of stones with no adjacent empty points is
captured and removed. The game ends when both players pass, and whoever surrounds
more of the board wins. White receives 7.5 points of compensation, called komi,
for moving second.

That is enough to start. The app will stop you from making an illegal move and
tell you why, so the fastest way to learn is to play a 9x9 game and see what
happens.
