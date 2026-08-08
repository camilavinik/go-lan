import { fromSnapshot, type GameSnapshot } from '@go-lan/protocol';
import {
  indexToPoint,
  moveLegality,
  starPoints,
  type Color,
  type IllegalReason,
  type Point,
} from '@go-lan/rules';
import { useMemo, useState } from 'react';

const CELL = 24;
const PADDING = 22;
const STONE_RADIUS = CELL * 0.46;

/** Short enough to sit on the board. The full sentence goes in the side panel. */
const SHORT_REASON: Record<IllegalReason, string> = {
  occupied: 'Taken',
  suicide: 'No liberties',
  ko: 'Ko, not yet',
  'not-your-turn': 'Not your turn',
  'out-of-bounds': 'Off the board',
  'wrong-phase': 'Not now',
};

export type BoardProps = {
  snapshot: GameSnapshot;
  myColor: Color | null;
  onPlay: (point: Point) => void;
  onIllegal: (reason: IllegalReason) => void;
  onToggleDead: (point: Point) => void;
};

export function Board({ snapshot, myColor, onPlay, onIllegal, onToggleDead }: BoardProps) {
  const size = snapshot.boardSize;
  const extent = PADDING * 2 + (size - 1) * CELL;
  const [hovered, setHovered] = useState<number | null>(null);

  const game = useMemo(() => fromSnapshot(snapshot), [snapshot]);
  const marks = useMemo(() => starPoints(size), [size]);

  const canPlay = snapshot.phase === 'playing' && myColor !== null && myColor === snapshot.turn;
  const canMark = snapshot.phase === 'marking' && myColor !== null;

  // Worked out once per position rather than per hover: it is 361 rule checks.
  const illegalPoints = useMemo(() => {
    const points = new Set<number>();
    if (!canPlay || myColor === null) return points;
    for (let index = 0; index < size * size; index += 1) {
      if (snapshot.board[index] !== '.') continue;
      if (moveLegality(game, myColor, indexToPoint(size, index)) !== null) points.add(index);
    }
    return points;
  }, [game, canPlay, myColor, size, snapshot.board]);

  const hoveredIsEmpty = hovered !== null && snapshot.board[hovered] === '.';
  const hoveredReason =
    canPlay && hovered !== null && hoveredIsEmpty
      ? moveLegality(game, myColor, indexToPoint(size, hovered))
      : null;
  const showGhost = canPlay && hoveredIsEmpty && hoveredReason === null;

  const at = (value: number) => PADDING + value * CELL;

  function handleClick(index: number) {
    const point = indexToPoint(size, index);

    if (canMark) {
      if (snapshot.board[index] !== '.') onToggleDead(point);
      return;
    }

    if (!canPlay) return;

    const reason = moveLegality(game, myColor, point);
    if (reason) onIllegal(reason);
    else onPlay(point);
  }

  const interactive = canPlay || canMark;

  return (
    <svg
      className="board"
      viewBox={`0 0 ${extent} ${extent}`}
      role="grid"
      aria-label={`Go board, ${size} by ${size}`}
      onMouseLeave={() => setHovered(null)}
    >
      <rect className="board__wood" x={0} y={0} width={extent} height={extent} rx={4} />

      <g className="board__grid">
        {Array.from({ length: size }, (_, i) => (
          <line key={`h${i}`} x1={at(0)} y1={at(i)} x2={at(size - 1)} y2={at(i)} />
        ))}
        {Array.from({ length: size }, (_, i) => (
          <line key={`v${i}`} x1={at(i)} y1={at(0)} x2={at(i)} y2={at(size - 1)} />
        ))}
      </g>

      <g className="board__stars">
        {marks.map((point) => (
          <circle key={`${point.x},${point.y}`} cx={at(point.x)} cy={at(point.y)} r={2.2} />
        ))}
      </g>

      {snapshot.score && (
        <g className="board__territory">
          {[...snapshot.score.ownership].map((owner, index) => {
            if (owner === '.') return null;
            const occupiedByLivingStone =
              snapshot.board[index] !== '.' && snapshot.dead[index] !== '1';
            if (occupiedByLivingStone) return null;

            const point = indexToPoint(size, index);
            const side = CELL * 0.3;
            return (
              <rect
                key={index}
                className={owner === 'X' ? 'territory--black' : 'territory--white'}
                x={at(point.x) - side / 2}
                y={at(point.y) - side / 2}
                width={side}
                height={side}
              />
            );
          })}
        </g>
      )}

      <g className="board__stones">
        {[...snapshot.board].map((stone, index) => {
          if (stone === '.') return null;
          const point = indexToPoint(size, index);
          const isDead = snapshot.dead[index] === '1';
          const cx = at(point.x);
          const cy = at(point.y);

          return (
            <g key={index} className={isDead ? 'stone stone--dead' : 'stone'}>
              <circle
                className={stone === 'X' ? 'stone--black' : 'stone--white'}
                cx={cx}
                cy={cy}
                r={STONE_RADIUS}
              />
              {isDead && (
                <g className="stone__cross">
                  <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} />
                  <line x1={cx - 5} y1={cy + 5} x2={cx + 5} y2={cy - 5} />
                </g>
              )}
            </g>
          );
        })}
      </g>

      {snapshot.lastMove?.point && (
        <circle
          className="board__last-move"
          cx={at(snapshot.lastMove.point.x)}
          cy={at(snapshot.lastMove.point.y)}
          r={STONE_RADIUS * 0.4}
        />
      )}

      {showGhost && hovered !== null && (
        <circle
          className={`stone stone--ghost ${myColor === 'black' ? 'stone--black' : 'stone--white'}`}
          cx={at(indexToPoint(size, hovered).x)}
          cy={at(indexToPoint(size, hovered).y)}
          r={STONE_RADIUS}
        />
      )}

      {hoveredReason && hovered !== null && (
        <Tooltip
          text={SHORT_REASON[hoveredReason]}
          x={at(indexToPoint(size, hovered).x)}
          y={at(indexToPoint(size, hovered).y)}
          extent={extent}
        />
      )}

      <g className="board__targets">
        {Array.from({ length: size * size }, (_, index) => {
          const point = indexToPoint(size, index);
          const isStone = snapshot.board[index] !== '.';
          const illegalHere = illegalPoints.has(index);
          const clickable = canMark ? isStone : canPlay && !isStone && !illegalHere;

          return (
            <rect
              key={index}
              x={at(point.x) - CELL / 2}
              y={at(point.y) - CELL / 2}
              width={CELL}
              height={CELL}
              fill="transparent"
              style={{
                pointerEvents: interactive ? 'all' : 'none',
                cursor: illegalHere ? 'not-allowed' : clickable ? 'pointer' : 'default',
              }}
              onMouseEnter={() => setHovered(index)}
              onClick={() => handleClick(index)}
            />
          );
        })}
      </g>
    </svg>
  );
}

type TooltipProps = { text: string; x: number; y: number; extent: number };

function Tooltip({ text, x, y, extent }: TooltipProps) {
  const height = 15;
  const width = text.length * 5.2 + 10;
  const left = Math.min(Math.max(x - width / 2, 2), extent - width - 2);
  const above = y - CELL * 0.6 - height;
  const top = above < 2 ? y + CELL * 0.6 : above;

  return (
    <g className="board__tooltip" pointerEvents="none">
      <rect x={left} y={top} width={width} height={height} rx={3} />
      <text x={left + width / 2} y={top + height / 2 + 3.4} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}
