import type { GameSnapshot } from '@go-lan/protocol';
import type { Color, GameResult } from '@go-lan/rules';
import { useRef, useState } from 'react';
import type { ConnectionStatus } from '../hooks/useGameSocket.js';
import { copyText } from '../lib/clipboard.js';
import { RulesSummary } from './Rules.js';

export type SidePanelProps = {
  snapshot: GameSnapshot;
  myColor: Color | null;
  status: ConnectionStatus;
  shareOrigin: string | null;
  notice: string | null;
  onPass: () => void;
  onResign: () => void;
  onRequestUndo: () => void;
  onRespondUndo: (accept: boolean) => void;
  onConfirmScore: () => void;
  onResumeGame: () => void;
};

export function SidePanel(props: SidePanelProps) {
  const { snapshot, myColor, status, notice } = props;
  const isPlayer = myColor !== null;
  const myTurn = isPlayer && snapshot.phase === 'playing' && snapshot.turn === myColor;

  return (
    <aside className="panel">
      <Players snapshot={snapshot} myColor={myColor} />

      <p className="panel__status">{statusLine(snapshot, myColor)}</p>

      {notice && (
        <p className="panel__error" role="alert">
          {notice}
        </p>
      )}
      {status !== 'open' && (
        <p className="panel__connection">
          {status === 'connecting' ? 'Connecting...' : 'Connection lost, retrying...'}
        </p>
      )}

      {snapshot.pendingUndo && isPlayer && (
        <UndoRequest
          askedBy={snapshot.pendingUndo.by}
          myColor={myColor}
          onRespond={props.onRespondUndo}
        />
      )}

      {snapshot.phase === 'playing' && isPlayer && (
        <div className="panel__actions">
          <button type="button" onClick={props.onPass} disabled={!myTurn}>
            Pass
          </button>
          <button
            type="button"
            onClick={props.onRequestUndo}
            disabled={snapshot.moveCount === 0 || snapshot.pendingUndo !== null}
          >
            Take back
          </button>
          <ResignButton onResign={props.onResign} />
        </div>
      )}

      {snapshot.phase === 'marking' && (
        <MarkingPanel
          snapshot={snapshot}
          myColor={myColor}
          onConfirmScore={props.onConfirmScore}
          onResumeGame={props.onResumeGame}
        />
      )}

      {snapshot.phase === 'finished' && snapshot.result && (
        <div className="panel__result">
          <h2>{describeResult(snapshot.result)}</h2>
          {snapshot.score && (
            <p>
              Black {snapshot.score.black} &middot; White {snapshot.score.white}
            </p>
          )}
        </div>
      )}

      <RulesSummary />

      <ShareBox
        code={snapshot.code}
        spectators={snapshot.spectators}
        shareOrigin={props.shareOrigin}
      />
    </aside>
  );
}

function Players({ snapshot, myColor }: { snapshot: GameSnapshot; myColor: Color | null }) {
  return (
    <div className="players">
      {(['black', 'white'] as const).map((color) => {
        const player = snapshot.players[color];
        const isTurn = snapshot.phase === 'playing' && snapshot.turn === color;

        return (
          <div key={color} className={`player ${isTurn ? 'player--turn' : ''}`}>
            <span className={`player__stone player__stone--${color}`} aria-hidden="true" />
            <span className="player__name">
              {player ? player.nick : 'Waiting for a player'}
              {color === myColor && <em> (you)</em>}
            </span>
            <span className="player__meta">
              {player && !player.connected && <span className="player__away">away</span>}
              {snapshot.captures[color]} captured
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MarkingPanel({
  snapshot,
  myColor,
  onConfirmScore,
  onResumeGame,
}: {
  snapshot: GameSnapshot;
  myColor: Color | null;
  onConfirmScore: () => void;
  onResumeGame: () => void;
}) {
  const waitingOn = (['black', 'white'] as const).filter((color) => !snapshot.confirmed[color]);

  return (
    <div className="panel__marking">
      <p className="panel__hint">
        Both passed, so the game is over. Click any group that cannot survive to mark it dead. Both
        of you have to agree before the score counts.
      </p>

      {snapshot.score && (
        <dl className="score">
          <div>
            <dt>Black</dt>
            <dd>
              {snapshot.score.black} ({snapshot.score.blackStones} stones +{' '}
              {snapshot.score.blackTerritory} territory)
            </dd>
          </div>
          <div>
            <dt>White</dt>
            <dd>
              {snapshot.score.white} ({snapshot.score.whiteStones} stones +{' '}
              {snapshot.score.whiteTerritory} territory + {snapshot.score.komi} komi)
            </dd>
          </div>
        </dl>
      )}

      {myColor !== null && (
        <div className="panel__actions">
          <button type="button" onClick={onConfirmScore} disabled={snapshot.confirmed[myColor]}>
            {snapshot.confirmed[myColor] ? 'Waiting for your opponent' : 'Accept the count'}
          </button>
          <button type="button" onClick={onResumeGame}>
            Keep playing instead
          </button>
        </div>
      )}

      {waitingOn.length > 0 && (
        <p className="panel__hint">Still to accept: {waitingOn.join(' and ')}.</p>
      )}
    </div>
  );
}

function UndoRequest({
  askedBy,
  myColor,
  onRespond,
}: {
  askedBy: Color;
  myColor: Color;
  onRespond: (accept: boolean) => void;
}) {
  if (askedBy === myColor) {
    return <p className="panel__notice">Waiting for your opponent to accept the take back.</p>;
  }

  return (
    <div className="panel__undo">
      <p>Your opponent would like to take back their move.</p>
      <div className="panel__actions">
        <button type="button" onClick={() => onRespond(true)}>
          Allow
        </button>
        <button type="button" onClick={() => onRespond(false)}>
          Refuse
        </button>
      </div>
    </div>
  );
}

function ResignButton({ onResign }: { onResign: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className="button--quiet" onClick={() => setConfirming(true)}>
        Resign
      </button>
    );
  }

  return (
    <>
      <button type="button" className="button--danger" onClick={onResign}>
        Yes, resign
      </button>
      <button type="button" className="button--quiet" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </>
  );
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function ShareBox({
  code,
  spectators,
  shareOrigin,
}: {
  code: string;
  spectators: number;
  shareOrigin: string | null;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const linkRef = useRef<HTMLInputElement>(null);

  // A link to localhost points at whichever machine opens it, so when the page
  // was loaded that way we use the address the server reports instead.
  const loopback = LOOPBACK_HOSTS.has(window.location.hostname);
  const origin = loopback && shareOrigin ? shareOrigin : window.location.origin;
  const link = `${origin}/g/${code}`;

  async function copy() {
    const done = await copyText(link);
    setCopyState(done ? 'copied' : 'failed');

    // Nothing was copied, so leave the link selected and the browser's own copy
    // shortcut will finish the job.
    if (!done) linkRef.current?.select();

    window.setTimeout(() => setCopyState('idle'), 1000);
  }

  return (
    <div className="share">
      <p className="share__label">Invite someone</p>
      <p className="share__code">{code}</p>
      <button
        type="button"
        className={`button--quiet ${copyState === 'copied' ? 'button--done' : ''}`}
        onClick={copy}
      >
        {copyState === 'copied' ? 'Link copied' : 'Copy link'}
      </button>
      {/* A field rather than a line of text: served over plain http the
          clipboard API does not exist at all, so copying by hand has to stay
          within reach. One click selects the whole thing. */}
      <input
        ref={linkRef}
        className="share__link"
        value={link}
        readOnly
        aria-label="Invite link"
        onFocus={(event) => event.currentTarget.select()}
        onClick={(event) => event.currentTarget.select()}
      />
      <p className="share__feedback" role="status">
        {copyState === 'failed' && 'Could not reach the clipboard. Copy the selected link.'}
      </p>
      {spectators > 0 && (
        <p className="share__spectators">
          {spectators} {spectators === 1 ? 'person is' : 'people are'} watching
        </p>
      )}
    </div>
  );
}

function statusLine(snapshot: GameSnapshot, myColor: Color | null): string {
  if (snapshot.phase === 'finished') return 'Game over';
  if (snapshot.phase === 'marking') return 'Agreeing which stones are dead';

  const opponentSeat = snapshot.players[snapshot.turn === 'black' ? 'white' : 'black'];
  if (!snapshot.players.black || !snapshot.players.white) {
    return 'Waiting for the second player to join';
  }

  if (myColor === null) return `${capitalise(snapshot.turn)} to play`;
  if (snapshot.turn === myColor) return 'Your move';
  return `Waiting for ${snapshot.players[snapshot.turn]?.nick ?? opponentSeat?.nick ?? 'your opponent'}`;
}

function describeResult(result: GameResult): string {
  if (result.type === 'resignation') return `${capitalise(result.winner)} wins by resignation`;
  return `${capitalise(result.winner)} wins by ${result.margin}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
