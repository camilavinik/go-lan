import { GAME_CODE_LENGTH } from '@go-lan/protocol';
import type { BoardSize } from '@go-lan/rules';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { RulesDrawer } from '../components/Rules.js';
import { requestNewGame } from '../lib/createGame.js';
import { loadNick, saveNick } from '../lib/session.js';

const BOARD_SIZES: { value: BoardSize; label: string; hint: string }[] = [
  { value: 9, label: '9 x 9', hint: 'A short game, best for learning' },
  { value: 13, label: '13 x 13', hint: 'Somewhere in between' },
  { value: 19, label: '19 x 19', hint: 'The full board' },
];

export function HomePage() {
  const navigate = useNavigate();
  const [nick, setNick] = useState(loadNick);
  const [boardSize, setBoardSize] = useState<BoardSize>(9);
  const [color, setColor] = useState<'black' | 'white' | 'random'>('black');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!nick.trim()) {
      setError('Put a name in first, so your opponent knows who they are playing.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      saveNick(nick.trim());
      const created = await requestNewGame({ nick: nick.trim(), boardSize, color });
      navigate(`/g/${created}`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!nick.trim()) {
      setError('Put a name in first, so your opponent knows who they are playing.');
      return;
    }
    if (trimmed.length !== GAME_CODE_LENGTH) {
      setError(`A game code is ${GAME_CODE_LENGTH} characters long.`);
      return;
    }

    saveNick(nick.trim());
    navigate(`/g/${trimmed}`);
  }

  return (
    <main className="home">
      <header className="home__header">
        <div>
          <h1>go-lan</h1>
          <p>Play Go with someone else on this network.</p>
        </div>
        <RulesDrawer />
      </header>

      <label className="field">
        <span>Your name</span>
        <input
          value={nick}
          onChange={(event) => setNick(event.target.value)}
          maxLength={20}
          placeholder="Nickname"
          autoComplete="nickname"
        />
      </label>

      {error && <p className="home__error">{error}</p>}

      <div className="home__panels">
        <form className="card" onSubmit={handleCreate}>
          <h2>Start a game</h2>

          <fieldset className="choices">
            <legend>Board</legend>
            {BOARD_SIZES.map((option) => (
              <label key={option.value} className="choice">
                <input
                  type="radio"
                  name="boardSize"
                  checked={boardSize === option.value}
                  onChange={() => setBoardSize(option.value)}
                />
                <span className="choice__label">{option.label}</span>
                <span className="choice__hint">{option.hint}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="choices choices--inline">
            <legend>You play</legend>
            {(['black', 'white', 'random'] as const).map((option) => (
              <label key={option} className="choice">
                <input
                  type="radio"
                  name="color"
                  checked={color === option}
                  onChange={() => setColor(option)}
                />
                <span className="choice__label">{option === 'random' ? 'Either' : option}</span>
              </label>
            ))}
          </fieldset>

          <p className="card__hint">Black moves first.</p>

          <button type="submit" disabled={busy}>
            {busy ? 'Creating...' : 'Create game'}
          </button>
        </form>

        <form className="card" onSubmit={handleJoin}>
          <h2>Join a game</h2>
          <label className="field">
            <span>Game code</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={GAME_CODE_LENGTH}
              placeholder="K4M9PZ"
              className="input--code"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </label>
          <p className="card__hint">
            Ask whoever started the game for their code, or open the link they sent you.
          </p>
          <button type="submit">Join</button>
        </form>
      </div>
    </main>
  );
}
