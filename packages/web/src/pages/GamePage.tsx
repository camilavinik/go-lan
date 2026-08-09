import { describeRejection } from '@go-lan/protocol';
import type { IllegalReason, Point } from '@go-lan/rules';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Board } from '../components/Board.js';
import { SidePanel } from '../components/SidePanel.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import { loadNick, loadToken, saveNick } from '../lib/session.js';

export function GamePage() {
  const params = useParams();
  const code = (params.code ?? '').toUpperCase();

  // With a saved seat token the name does not matter: the server already knows
  // who we are. Without one, we need a name before we can join.
  const [nick, setNick] = useState<string | null>(() => loadNick() || null);
  const connection = useGameSocket(code, nick);
  const { snapshot, myColor, status, shareOrigin, notice, fatal, send, showNotice } = connection;

  if (fatal) {
    return (
      <main className="notice-screen">
        <h1>{fatal}</h1>
        <Link to="/">Back to the start</Link>
      </main>
    );
  }

  if (nick === null && loadToken(code) === null) {
    return <NamePrompt code={code} onSubmit={setNick} />;
  }

  if (!snapshot) {
    return (
      <main className="notice-screen">
        <h1>Joining game {code}...</h1>
      </main>
    );
  }

  const play = (point: Point) => send({ type: 'play', point });
  const flagIllegal = (reason: IllegalReason) => showNotice(describeRejection(reason));
  const toggleDead = (point: Point) => send({ type: 'toggleDead', point });

  return (
    <main className="game">
      <div className="game__board">
        <Board
          snapshot={snapshot}
          myColor={myColor}
          onPlay={play}
          onIllegal={flagIllegal}
          onToggleDead={toggleDead}
        />
      </div>

      <SidePanel
        snapshot={snapshot}
        myColor={myColor}
        status={status}
        shareOrigin={shareOrigin}
        notice={notice}
        onPass={() => send({ type: 'pass' })}
        onResign={() => send({ type: 'resign' })}
        onRequestUndo={() => send({ type: 'undoRequest' })}
        onRespondUndo={(accept) => send({ type: 'undoRespond', accept })}
        onConfirmScore={() => send({ type: 'confirmScore' })}
        onResumeGame={() => send({ type: 'resumeGame' })}
      />
    </main>
  );
}

function NamePrompt({ code, onSubmit }: { code: string; onSubmit: (nick: string) => void }) {
  const [value, setValue] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    saveNick(trimmed);
    onSubmit(trimmed);
  }

  return (
    <main className="notice-screen">
      <form className="card" onSubmit={handleSubmit}>
        <h1>Join game {code}</h1>
        <label className="field">
          <span>Your name</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={20}
            placeholder="Camila"
            autoFocus
          />
        </label>
        <button type="submit">Join</button>
      </form>
    </main>
  );
}
