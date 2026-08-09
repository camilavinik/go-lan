import { useEffect, useState } from 'react';

/**
 * The rules of Go written for someone who has never played. Kept in a drawer
 * because they are too long to sit next to the board, but one click away
 * because you will want them during your first few games.
 */
export function RulesDrawer({ label = 'How to play' }: { label?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="rules-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="rules-trigger__icon" aria-hidden="true">
          ?
        </span>
        {label}
      </button>

      {open && (
        <div className="rules-overlay" onClick={() => setOpen(false)}>
          <aside
            className="rules-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="How to play Go"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="rules-drawer__header">
              <h2>How to play Go</h2>
              <button type="button" className="button--quiet" onClick={() => setOpen(false)}>
                Close
              </button>
            </header>

            <div className="rules-drawer__body">
              <RulesContent />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function RulesContent() {
  return (
    <>
      <h3>The idea</h3>
      <p>
        You and your opponent take turns putting stones on the board, and you are trying to surround
        more of it than they do. Stones are placed on the intersections of the lines, not inside the
        squares, and once placed they never move.
      </p>
      <p>Black plays first. On your turn you either place one stone or pass.</p>

      <h3>Liberties</h3>
      <p>
        A stone's liberties are the empty intersections directly next to it, up, down, left and
        right. Diagonals do not count. Stones of the same colour that touch each other form a group
        and share their liberties.
      </p>

      <h3>Capturing</h3>
      <p>
        If you fill the last liberty of an enemy group, that whole group is captured and comes off
        the board. A stone in the middle of the board starts with four liberties, one on the edge
        has three, and one in the corner only two, which is why corners are easier to attack.
      </p>

      <h3>Two moves you are not allowed</h3>
      <p>
        <strong>Suicide.</strong> You cannot place a stone that would leave its own group with no
        liberties. The exception is when the same move captures something, because the captured
        stones leave empty space behind and your group ends up with liberties after all.
      </p>
      <p>
        <strong>Ko.</strong> When you capture a single stone and your opponent could immediately
        capture straight back, the position would repeat forever. So they have to play somewhere
        else first, and can only come back to it on their following turn.
      </p>
      <p>
        You do not have to keep either rule in your head. The board refuses moves that break them
        and tells you which rule you ran into.
      </p>

      <h3>Ending the game</h3>
      <p>
        There is no checkmate. The game ends when both players pass in a row, which happens when
        neither of you thinks there is anything useful left to play.
      </p>
      <p>
        Then comes the part that surprises new players: you agree which stones are{' '}
        <strong>dead</strong>. A group deep inside your opponent's area that could never survive is
        treated as captured even though nobody bothered to actually surround it. Click those groups
        to mark them, and both of you have to accept the same marking. If you disagree, either of
        you can go back to playing and settle it on the board.
      </p>

      <h3>Counting</h3>
      <p>
        Each player scores one point for every stone they have on the board, plus one for every
        empty intersection surrounded only by their colour. Empty points touching both colours
        belong to nobody.
      </p>
      <p>
        White gets an extra 7.5 points, called <strong>komi</strong>, to make up for moving second.
        The half point exists so games cannot end in a draw.
      </p>

      <h3>A tip for your first game</h3>
      <p>
        Play on 9x9. A full 19x19 game between beginners takes a long time and it is harder to see
        what is happening. Try to claim a corner, keep your groups connected, and do not worry about
        losing stones early on.
      </p>
    </>
  );
}
