# go-lan

A self-hosted app for playing Go (baduk, weiqi) with someone else on your local network.

One of you creates a game and gets a six character code. The other types the code in and you play.

## Features

- Real time two player games over WebSocket, on a 9x9, 13x13 or 19x19 board.
- Full rules: captures, ko, suicide, passing and resignation.
- Proper end of game: after two passes you agree which stones are dead, then the
  server counts the board with area scoring and 7.5 komi.
- Beginner friendly. An illegal move is refused in red with the reason why, and
  the message clears as soon as the game moves on. The last move is highlighted
  and captures are counted for you.
- The short version of the rules sits next to the board while you play, and the
  whole thing, written for someone who has never played, is one click away. In
  English or Spanish: it follows your browser the first time and remembers what
  you pick after that.
- Take back a move if your opponent agrees.
- Anyone else with the code joins as a spectator.
- Reconnect after a refresh and keep your seat.
- An invite link that works from other machines, whichever address you opened.

No clocks, no handicap stones, no ratings. Games live in memory only, so
restarting the server clears them.

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

## Who can reach it, and what is stored

The server listens on every interface, which is the entire point: your opponent
has to be able to reach it. It also means anyone on the same network who has the
six character code can open the game, and take a seat if one is still free. That
is reasonable for a home or an office, but it is not a login system, so do not
forward the port to the internet.

Nothing is written down. There is no database and no game log; rooms sit in
memory, and are dropped when the server stops or after a while with nobody
connected. Your name and your seat token live in your own browser's local
storage and only ever travel to your own server. The token is what lets you
reload the page and get your seat back, and it is only ever sent to the
connection that owns it, never to your opponent or to spectators.

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

It talks to port 8080 by default. Point it at a container started by
`npm run play`, which may have landed on another port, with `GO_LAN_URL`:

```bash
GO_LAN_URL=ws://localhost:8081/ws node scripts/opponent-bot.mjs
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

You do not need to read anything before starting. Every screen has a button that
opens the rules in full, written for someone who has never played, and during a
game the four lines that matter most stay next to the board.

The very short version: black plays first, you take turns placing a stone on any
empty crossing, and a group with no empty crossings left beside it is captured
and removed. The game ends when both players pass, and whoever ends up with more
stones and surrounded space wins. White gets 7.5 points for moving second.

The app refuses illegal moves and tells you which rule you ran into, so the
fastest way to learn is to start a 9x9 game and see what happens.
