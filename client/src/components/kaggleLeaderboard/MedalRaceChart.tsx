/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: "The race for medals" -- score against rank for the part of the board that is
 *          actually contested, drawn as the board's staircase with the gold, silver and
 *          bronze zones shaded and our team called out with how far it is to the next
 *          medal line, in points and in teams to pass.
 *
 *          WHY NOT EVERY TEAM. On 05-Oct-2026 roughly three quarters of the board sat near
 *          zero, and the original arc-3 chart spent most of its width on them with a log
 *          rank axis that squashed the medal zones into the left edge. Here the rank axis is
 *          linear and stops a little past the bronze line, and the score axis starts just
 *          under the last team shown, so the tight pack around the medal lines is readable.
 *          Teams scoring above the axis (a runaway leader) are drawn as arrows on the top
 *          edge with their score, so nothing is hidden.
 * SRP/DRY check: Pass - marks only; frame, crosshair and tooltip come from ChartFrame.
 */

import { ChartFrame, PAD, TipRow, W, AXIS_TEXT, LABEL_TEXT, niceTicks, polyPoints, type Anchor } from './ChartFrame';
import { MEDAL_COLOR, US_COLOR, fmt, type BoardModel, type Medal } from './boardData';

const H = 400;
const RIGHT = 24;

export function MedalRaceChart({ model }: { model: BoardModel }) {
  const { latest, ourRow } = model;
  const rows = latest.rows;
  const mr = latest.medalRanks;
  const n = latest.teams;

  // Show a little past bronze, and past us if we are further down.
  const lastRank = Math.min(n, Math.ceil(Math.max(mr.bronze * 1.35, (ourRow?.[0] ?? 0) * 1.1)));
  const shown = rows.slice(0, lastRank);
  // Clip the top so one runaway score does not flatten the pack: cap at the 4th-best score.
  const capRef = rows[Math.min(3, rows.length - 1)][4];
  const yTop = Math.ceil(capRef + 1);
  const yBottom = Math.max(0, Math.floor(shown[shown.length - 1][4] - 1));
  const plotR = W - RIGHT;
  const x = (rank: number) => PAD.L + ((rank - 0.5) / lastRank) * (plotR - PAD.L);
  const y = (score: number) => PAD.T + (1 - (Math.min(score, yTop) - yBottom) / (yTop - yBottom)) * (H - PAD.T - PAD.B);

  const yTicks = niceTicks(yBottom, yTop, 6).map((v) => [y(v), String(v)] as [number, string]);
  const xTicks: Array<[number, string, Anchor]> = [[x(1), '1', 'middle']];
  for (const t of niceTicks(0, lastRank, 6)) if (t >= 50 && x(t) < plotR - 20) xTicks.push([x(t), String(t), 'middle']);

  // The staircase: each team holds its score across its own rank slot.
  const stair: Array<[number, number]> = [];
  for (const r of shown) {
    stair.push([x(r[0] - 0.5), y(r[4])], [x(r[0] + 0.5), y(r[4])]);
  }
  const area = `${polyPoints(stair)} ${x(lastRank + 0.5).toFixed(1)},${H - PAD.B} ${x(0.5).toFixed(1)},${H - PAD.B}`;

  const zones: Array<[Medal, number, number]> = [
    ['gold', 1, mr.gold],
    ['silver', mr.gold + 1, mr.silver],
    ['bronze', mr.silver + 1, mr.bronze],
  ];
  const clipped = rows.filter((r) => r[4] > yTop);

  // Our callout: points and teams to the next medal line above us.
  let callout: { text: string; targetY: number; medal: Medal } | null = null;
  if (ourRow) {
    const next = (['bronze', 'silver', 'gold'] as Medal[]).find((m) => ourRow[0] > mr[m]);
    const target: Medal | null = next ?? null;
    if (target) {
      const line = rows[mr[target] - 1][4];
      callout = {
        medal: target,
        targetY: y(line),
        text: `+${fmt(line - ourRow[4])} to ${target} · ${ourRow[0] - mr[target]} teams to pass`,
      };
    }
  }

  const hover = (gx: number) => {
    const rank = Math.round((gx - PAD.L) / (plotR - PAD.L) * lastRank + 0.5);
    const r = rows[Math.min(lastRank, Math.max(1, rank)) - 1];
    if (!r) return null;
    const medal = model.medalOf(r[0]);
    const near = rows.filter((o) => Math.abs(o[4] - r[4]) <= 0.25).length - 1;
    return {
      x: x(r[0]),
      dots: [{ y: y(r[4]), color: r[1] === latest.ourTeamId ? US_COLOR : 'var(--foreground)' }],
      body: (
        <>
          <div className="mb-1 font-semibold">{r[2]}</div>
          <TipRow name="Rank" value={`#${r[0]}${medal ? ` · ${medal}` : ''}`} />
          <TipRow name="Score" value={fmt(r[4])} />
          <TipRow name="Submissions" value={r[5]} />
          <div className="mt-1 text-muted-foreground">{near} other teams within a quarter point</div>
        </>
      ),
    };
  };

  return (
    <>
      <ChartFrame height={H} label="Score by rank, medal zones" yTicks={yTicks} xTicks={xTicks} xTitle="rank" padRight={RIGHT} hover={hover}>
        {zones.map(([name, a, b]) => (
          <g key={name}>
            <rect x={x(a - 0.5)} y={PAD.T} width={Math.max(0, x(b + 0.5) - x(a - 0.5))} height={H - PAD.T - PAD.B} fill={MEDAL_COLOR[name]} opacity={0.12} />
            <line x1={x(b + 0.5)} x2={x(b + 0.5)} y1={PAD.T} y2={H - PAD.B} stroke={MEDAL_COLOR[name]} strokeWidth={1.5} />
            <text x={x(b + 0.5) - 5} y={PAD.T + 14} textAnchor="end" style={{ ...AXIS_TEXT, fontWeight: 600 }}>
              {name} · {fmt(rows[b - 1][4])}
            </text>
          </g>
        ))}
        <polygon points={area} style={{ fill: 'var(--foreground)' }} opacity={0.06} />
        <polyline points={polyPoints(stair)} fill="none" style={{ stroke: 'var(--foreground)' }} strokeOpacity={0.75} strokeWidth={1.5} strokeLinejoin="round" />
        {clipped.map((r, i) => (
          <g key={r[1]}>
            <path d={`M${x(r[0])} ${PAD.T + 2} l-4 7 h8 z`} style={{ fill: 'var(--foreground)' }} />
            {i === 0 && (
              <text x={x(r[0]) + 8} y={PAD.T + 9} style={AXIS_TEXT}>
                {clipped.length === 1 ? `leader ${fmt(r[4])}, off the top` : `${clipped.length} teams above ${yTop}, leader ${fmt(r[4])}`}
              </text>
            )}
          </g>
        ))}
        {ourRow && ourRow[0] <= lastRank && (
          <g>
            {callout && (
              <>
                <line x1={x(ourRow[0])} x2={x(ourRow[0])} y1={y(ourRow[4]) - 9} y2={callout.targetY} style={{ stroke: US_COLOR }} strokeWidth={1.5} />
                <line x1={x(ourRow[0]) - 5} x2={x(ourRow[0]) + 5} y1={callout.targetY} y2={callout.targetY} style={{ stroke: US_COLOR }} strokeWidth={1.5} />
              </>
            )}
            <circle cx={x(ourRow[0])} cy={y(ourRow[4])} r={6} style={{ fill: US_COLOR, stroke: 'var(--card)' }} strokeWidth={2} />
            <text
              x={x(ourRow[0]) + (x(ourRow[0]) > plotR - 260 ? -12 : 12)}
              y={y(ourRow[4]) + 22}
              textAnchor={x(ourRow[0]) > plotR - 260 ? 'end' : 'start'}
              style={{ ...LABEL_TEXT, fontWeight: 700 }}
            >
              Us · #{ourRow[0]} · {fmt(ourRow[4])}
            </text>
            {callout && (
              <text
                x={x(ourRow[0]) + (x(ourRow[0]) > plotR - 260 ? -12 : 12)}
                y={y(ourRow[4]) + 38}
                textAnchor={x(ourRow[0]) > plotR - 260 ? 'end' : 'start'}
                style={AXIS_TEXT}
              >
                {callout.text}
              </text>
            )}
          </g>
        )}
      </ChartFrame>
      <p className="mt-1 text-xs text-muted-foreground">
        Showing the top {lastRank.toLocaleString()} of {n.toLocaleString()} teams; the rest score {fmt(shown[shown.length - 1][4])} or less.
        {ourRow && ourRow[0] > lastRank && <> We are #{ourRow[0]} with {fmt(ourRow[4])}, below this view.</>}
      </p>
    </>
  );
}
