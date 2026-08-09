import { useEffect, useState, type ReactNode } from 'react';
import { setRulesLanguage, useRulesLanguage, type RulesLanguage } from '../lib/rulesLanguage.js';

/**
 * Enough of the rules to get through a move without leaving the board, with the
 * rest a click away. Worth the space when neither player has played before.
 */
export function RulesSummary() {
  const language = useRulesLanguage();
  const copy = COPY[language];

  return (
    <div className="rules-card">
      <div className="rules-card__head">
        <p className="rules-card__label">{copy.shortLabel}</p>
        <LanguageToggle />
      </div>

      <ul className="rules-card__list" lang={language}>
        {copy.short.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <RulesDrawer label={copy.fullRules} />
    </div>
  );
}

/**
 * The rules in full, written for someone who has never played. They live in a
 * drawer because they are too long to sit next to the board.
 */
export function RulesDrawer({ label }: { label?: string }) {
  const language = useRulesLanguage();
  const copy = COPY[language];
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
        {label ?? copy.trigger}
      </button>

      {open && (
        <div className="rules-overlay" onClick={() => setOpen(false)}>
          <aside
            className="rules-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="rules-drawer__header">
              <h2 lang={language}>{copy.title}</h2>
              <div className="rules-drawer__tools">
                <LanguageToggle />
                <button type="button" className="button--quiet" onClick={() => setOpen(false)}>
                  {copy.close}
                </button>
              </div>
            </header>

            <div className="rules-drawer__body" lang={language}>
              {copy.sections.map((section) => (
                <section key={section.heading}>
                  <h3>{section.heading}</h3>
                  {section.body.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </section>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function LanguageToggle() {
  const language = useRulesLanguage();

  return (
    <div className="lang-toggle" role="group" aria-label="Rules language">
      {(['en', 'es'] as const).map((code) => (
        <button
          key={code}
          type="button"
          className={`lang-toggle__option ${language === code ? 'is-on' : ''}`}
          aria-pressed={language === code}
          onClick={() => setRulesLanguage(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

type Copy = {
  trigger: string;
  fullRules: string;
  shortLabel: string;
  title: string;
  close: string;
  short: string[];
  sections: { heading: string; body: ReactNode[] }[];
};

const COPY: Record<RulesLanguage, Copy> = {
  en: {
    trigger: 'How to play',
    fullRules: 'The full rules',
    shortLabel: 'The short version',
    title: 'How to play Go',
    close: 'Close',
    short: [
      'Stones go on the crossings and never move again.',
      'You capture an enemy group by filling every empty crossing around it.',
      'Two passes in a row end the game.',
      'Your stones plus the space they surround win it. White starts 7.5 up.',
    ],
    sections: [
      {
        heading: 'The idea',
        body: [
          'You and your opponent take turns putting stones on the board, and you are trying to surround more of it than they do. Stones are placed on the intersections of the lines, not inside the squares, and once placed they never move.',
          'Black plays first. On your turn you either place one stone or pass.',
        ],
      },
      {
        heading: 'Liberties',
        body: [
          "A stone's liberties are the empty intersections directly next to it, up, down, left and right. Diagonals do not count. Stones of the same colour that touch each other form a group and share their liberties.",
        ],
      },
      {
        heading: 'Capturing',
        body: [
          'If you fill the last liberty of an enemy group, that whole group is captured and comes off the board. A stone in the middle of the board starts with four liberties, one on the edge has three, and one in the corner only two, which is why corners are easier to attack.',
        ],
      },
      {
        heading: 'Two moves you are not allowed',
        body: [
          <>
            <strong>Suicide.</strong> You cannot place a stone that would leave its own group with no
            liberties. The exception is when the same move captures something, because the captured
            stones leave empty space behind and your group ends up with liberties after all.
          </>,
          <>
            <strong>Ko.</strong> When you capture a single stone and your opponent could immediately
            capture straight back, the position would repeat forever. So they have to play somewhere
            else first, and can only come back to it on their following turn.
          </>,
          'You do not have to keep either rule in your head. The board refuses moves that break them and tells you which rule you ran into.',
        ],
      },
      {
        heading: 'Ending the game',
        body: [
          'There is no checkmate. The game ends when both players pass in a row, which happens when neither of you thinks there is anything useful left to play.',
          <>
            Then comes the part that surprises new players: you agree which stones are{' '}
            <strong>dead</strong>. A group deep inside your opponent's area that could never survive
            is treated as captured even though nobody bothered to actually surround it. Click those
            groups to mark them, and both of you have to accept the same marking. If you disagree,
            either of you can go back to playing and settle it on the board.
          </>,
        ],
      },
      {
        heading: 'Counting',
        body: [
          'Each player scores one point for every stone they have on the board, plus one for every empty intersection surrounded only by their colour. Empty points touching both colours belong to nobody.',
          <>
            White gets an extra 7.5 points, called <strong>komi</strong>, to make up for moving
            second. The half point exists so games cannot end in a draw.
          </>,
        ],
      },
      {
        heading: 'A tip for your first game',
        body: [
          'Play on 9x9. A full 19x19 game between beginners takes a long time and it is harder to see what is happening. Try to claim a corner, keep your groups connected, and do not worry about losing stones early on.',
        ],
      },
    ],
  },
  es: {
    trigger: 'Cómo se juega',
    fullRules: 'Reglas completas',
    shortLabel: 'Lo esencial',
    title: 'Cómo se juega al Go',
    close: 'Cerrar',
    short: [
      'Las piedras van en los cruces y no se mueven nunca más.',
      'Capturás un grupo rival cuando ocupás todos los cruces vacíos que lo rodean.',
      'Dos pases seguidos terminan la partida.',
      'Ganás por tus piedras más el espacio que rodean. Blancas arrancan 7.5 arriba.',
    ],
    sections: [
      {
        heading: 'La idea',
        body: [
          'Vos y tu rival ponen piedras por turnos, y cada uno intenta rodear más tablero que el otro. Las piedras van sobre los cruces de las líneas, no adentro de los cuadrados, y una vez puestas no se mueven más.',
          'Empiezan las negras. En tu turno ponés una piedra o pasás.',
        ],
      },
      {
        heading: 'Libertades',
        body: [
          'Las libertades de una piedra son los cruces vacíos que tiene pegados: arriba, abajo, izquierda y derecha. Las diagonales no cuentan. Las piedras del mismo color que se tocan forman un grupo y comparten sus libertades.',
        ],
      },
      {
        heading: 'Capturar',
        body: [
          'Si ocupás la última libertad de un grupo rival, ese grupo entero queda capturado y sale del tablero. Una piedra en el medio del tablero arranca con cuatro libertades, una en el borde tiene tres y una en la esquina solo dos, por eso las esquinas son más fáciles de atacar.',
        ],
      },
      {
        heading: 'Dos jugadas que no podés hacer',
        body: [
          <>
            <strong>Suicidio.</strong> No podés poner una piedra que deje sin libertades a su propio
            grupo. La excepción es cuando esa misma jugada captura algo, porque las piedras
            capturadas dejan lugar vacío y tu grupo termina con libertades igual.
          </>,
          <>
            <strong>Ko.</strong> Cuando capturás una sola piedra y tu rival podría recapturar
            enseguida, la posición se repetiría para siempre. Por eso primero tiene que jugar en otro
            lado, y recién puede volver ahí en su turno siguiente.
          </>,
          'No hace falta que te acuerdes de ninguna de las dos. El tablero rechaza las jugadas que las rompen y te dice con qué regla chocaste.',
        ],
      },
      {
        heading: 'Terminar la partida',
        body: [
          'No hay jaque mate. La partida termina cuando los dos pasan seguido, que es lo que pasa cuando ninguno ve nada útil por jugar.',
          <>
            Después viene la parte que sorprende a los que recién empiezan: se ponen de acuerdo sobre
            qué piedras están <strong>muertas</strong>. Un grupo metido adentro del territorio rival
            que nunca podría sobrevivir cuenta como capturado, aunque nadie se haya tomado el trabajo
            de rodearlo. Hacé click en esos grupos para marcarlos; los dos tienen que aceptar la
            misma marcación. Si no se ponen de acuerdo, cualquiera puede volver a jugar y resolverlo
            en el tablero.
          </>,
        ],
      },
      {
        heading: 'Contar',
        body: [
          'Cada uno suma un punto por cada piedra suya en el tablero, más uno por cada cruce vacío rodeado solamente por su color. Los cruces vacíos que tocan los dos colores no son de nadie.',
          <>
            Las blancas suman 7.5 puntos extra, el <strong>komi</strong>, para compensar que juegan
            segundas. El medio punto existe para que no haya empates.
          </>,
        ],
      },
      {
        heading: 'Un consejo para tu primera partida',
        body: [
          'Jugá en 9x9. Una partida entera en 19x19 entre principiantes lleva muchísimo tiempo y cuesta más ver qué está pasando. Tratá de quedarte con una esquina, mantené tus grupos conectados y no te preocupes por perder piedras al principio.',
        ],
      },
    ],
  },
};
