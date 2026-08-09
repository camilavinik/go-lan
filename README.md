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
- An invite link that works from other machines, whichever address you opened.

Games live in memory only. Restarting the server clears them.

## Running it

```bash
npm run play
```

That is the whole thing. It builds the image if needed, picks a free port,
starts the container, waits for it to answer and opens your browser on the
address the rest of the network can use. Running it again when it is already up
does nothing except open the browser, so a game in progress survives.

```bash
npm run stop
```

It needs Docker running, and nothing else. If you would rather drive Docker
yourself:

```bash
GO_LAN_PORT=8090 docker compose up -d
```

Started that way, invite links fall back to whatever address your browser used,
because a container cannot see the host's address on the network. `npm run play`
works it out and passes it in, which is why the invite link is right even when
you are browsing through `localhost`.

One caveat: `npm run play` leaves a healthy container alone, so it will not pick
up code changes. Run `npm run stop` first, or use the development setup below.

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

To try things out without a second person, `scripts/opponent-bot.mjs` creates a
game, prints its code and plays the first empty point every turn. It passes when
you pass, which is how you reach the marking phase on your own.

```bash
node scripts/opponent-bot.mjs
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
