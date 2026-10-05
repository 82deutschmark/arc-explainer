/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: "Score by rank" -- every team on the board as a dot, rank on a log scale so the
 *          crowded top is readable, with the gold/silver/bronze zones shaded and our team
 *          drawn large and labelled. Hover reads off whichever team sits under the pointer.
 * SRP/DRY check: Pass - marks only; frame, gridlines and tooltip come from ChartFrame.
 */

import { useMemo } from 'react';
import { ChartFrame, PAD, W, AXIS_TEXT, niceMax } from './ChartFrame';
import { MEDAL_COLOR, US_COLOR, fmt, type BoardModel, type Medal } from './boardData';

const H = 380;

export function ScoreByRankChart({ model }: { model: BoardModel }) {
  const { latest, ourRow } = model;
  const n = latest.teams;
  const ymax = niceMax(latest.rows[0][4]);
  const x = (rank: number) => PAD.L + (Math.log(rank) / Math.log(n)) * (W - PAD.L - PAD.R);
  const y = (score: number) => PAD.T + (1 - score / ymax) * (H - PAD.T - PAD.B);
  const mr = latest.medalRanks;

  // Four thousand circles: build once per board, not on every hover re-render.
  const dots = useMemo(
    () =>
      latest.rows
        .filter((r) => r[1] !== latest.ourTeamId)
        .map((r) => <circle key={r[1]} cx={x(r[0])} cy={y(r[4])} r={2.1} />),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [latest],
  );

  const zones: Array<[Medal, number, number]> = [
    ['gold', 1, mr.gold],
    ['silver', mr.gold, mr.silver],
    ['bronze', mr.silver, mr.bronze],
  ];
  const ticks: Array<[number, string, 'middle' | 'end']> = [
    ...[1, 10, 100, 1000].filter((t) => t < n).map((t) => [x(t), t.toLocaleString(), 'middle'] as [number, string, 'middle']),
    [x(n), n.toLocaleString(), 'end'],
  ];

  const tooltipAt = (gx: number) => {
    const rank = Math.min(n, Math.max(1, Math.round(Math.exp(((gx - PAD.L) / (W - PAD.L - PAD.R)) * Math.log(n)))));
    const r = latest.rows[rank - 1];
    if (!r) return null;
    return (
      <>
        <b className="block">{r[2]}</b>#{r[0]} · {fmt(r[4])} points · {r[5]} submissions
      </>
    );
  };

  return (
    <ChartFrame height={H} label="Score by rank" ymax={ymax} y={y} xTicks={ticks} xTitle="rank (log scale)" tooltipAt={tooltipAt}>
      {zones.map(([name, a, b]) => (
        <g key={name}>
          <rect x={x(a)} y={PAD.T} width={Math.max(0, x(b) - x(a))} height={H - PAD.T - PAD.B} fill={MEDAL_COLOR[name]} opacity={0.14} />
          <text x={(x(a) + x(b)) / 2} y={PAD.T + 12} textAnchor="middle" style={AXIS_TEXT}>{name}</text>
        </g>
      ))}
      <g style={{ fill: 'var(--muted-foreground)' }} opacity={0.5}>{dots}</g>
      {ourRow && (
        <>
          <circle cx={x(ourRow[0])} cy={y(ourRow[4])} r={7} style={{ fill: US_COLOR, stroke: 'var(--card)' }} strokeWidth={2} />
          <text x={x(ourRow[0]) + 12} y={y(ourRow[4]) - 8} style={{ fill: US_COLOR, fontSize: 12, fontWeight: 700 }}>
            us · #{ourRow[0]} · {fmt(ourRow[4])}
          </text>
        </>
      )}
    </ChartFrame>
  );
}
