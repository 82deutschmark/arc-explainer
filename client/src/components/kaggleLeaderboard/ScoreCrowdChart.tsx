/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-08
 * PURPOSE: "Where the scores bunch up" -- how many teams sit at each score across the
 *          contested range, as columns coloured by the medal zone that score lands in, with
 *          the three medal lines and the pinned team’s score marked. It answers the question the rank
 *          table cannot: what is a point worth here? In a crowded band a fraction of a point
 *          passes dozens of teams. Hover gives each column's count, rank range and places
 *          per point. Medal cutoffs and the full pinned-team name live in a readable
 *          HTML legend rather than overlapping inside the scaled SVG.
 * SRP/DRY check: Pass - marks only; frame and tooltip from ChartFrame, data from BoardModel.
 */

import { ChartFrame, PAD, TipRow, W, niceTicks, type Anchor } from './ChartFrame';
import { MEDAL_COLOR, US_COLOR, fmt, type BoardModel, type Medal } from './boardData';
import type { KaggleBoardRow } from '@shared/types';

const H = 300;
const RIGHT = 24;

export function ScoreCrowdChart({ model }: { model: BoardModel }) {
  const { latest, ourRow } = model;
  const rows = latest.rows;
  const mr = latest.medalRanks;
  const line = (m: Medal) => rows[mr[m] - 1][4];

  // Contested range: from the score at twice the bronze rank up to just past the 4th best.
  const lo = Math.floor(rows[Math.min(rows.length, mr.bronze * 2) - 1][4]);
  const hi = Math.ceil(rows[Math.min(3, rows.length - 1)][4] + 0.5);
  const raw = (hi - lo) / 48;
  const binW = [0.1, 0.2, 0.25, 0.5, 1, 2, 5].find((s) => s >= raw) ?? 5;
  const nBins = Math.ceil((hi - lo) / binW);
  const bins: KaggleBoardRow[][] = Array.from({ length: nBins }, () => []);
  for (const r of rows) {
    if (r[4] < lo || r[4] >= lo + nBins * binW) continue;
    bins[Math.min(nBins - 1, Math.floor((r[4] - lo) / binW + 1e-9))].push(r);
  }
  const below = rows.filter((r) => r[4] < lo).length;
  const above = rows.filter((r) => r[4] >= lo + nBins * binW);
  const maxCount = Math.max(...bins.map((b) => b.length), 1);

  const plotR = W - RIGHT;
  const x = (score: number) => PAD.L + ((score - lo) / (nBins * binW)) * (plotR - PAD.L);
  const y = (count: number) => PAD.T + 18 + (1 - count / maxCount) * (H - PAD.T - 18 - PAD.B);
  const slot = (plotR - PAD.L) / nBins;
  const barW = Math.min(24, Math.max(2, slot - 2));

  const zoneOf = (score: number): Medal | null =>
    score >= line('gold') ? 'gold' : score >= line('silver') ? 'silver' : score >= line('bronze') ? 'bronze' : null;

  const yTicks = niceTicks(0, maxCount, 4).map((v) => [y(v), String(v)] as [number, string]);
  const xTicks = niceTicks(lo, lo + nBins * binW, 8).map((v) => [x(v), String(v), 'middle'] as [number, string, Anchor]);

  const hover = (gx: number) => {
    const i = Math.floor((gx - PAD.L) / slot);
    const bin = bins[i];
    if (!bin) return null;
    const from = lo + i * binW;
    const ranks = bin.map((r) => r[0]);
    return {
      x: PAD.L + (i + 0.5) * slot,
      body: (
        <>
          <div className="mb-1 font-semibold">{fmt(from)} to {fmt(from + binW)} points</div>
          <TipRow name="Teams" value={bin.length} />
          {bin.length > 0 && <TipRow name="Ranks" value={`#${Math.min(...ranks)} to #${Math.max(...ranks)}`} />}
          <TipRow name="Places per point here" value={Math.round(bin.length / binW)} />
          {ourRow && ourRow[4] >= from && ourRow[4] < from + binW && <div className="mt-1 font-semibold">{ourRow[2]} is in this column.</div>}
        </>
      ),
    };
  };

  // How crowded the medal race is, said in one line under the chart.
  const between = rows.filter((r) => r[4] >= line('bronze') && r[4] < line('gold')).length;

  return (
    <>
      <dl className="mb-4 grid grid-cols-2 gap-3 text-sm" aria-label="Public medal score cutoffs">
        {(['gold', 'silver', 'bronze'] as Medal[]).map(m => <div key={m} className="min-w-0">
          <dt className="flex items-center gap-2 text-muted-foreground"><span aria-hidden="true" className="h-3 w-1 shrink-0" style={{ background: MEDAL_COLOR[m] }} />{m[0].toUpperCase() + m.slice(1)} cutoff</dt>
          <dd className="pl-3 font-mono font-semibold tabular-nums">{fmt(line(m))} points</dd>
        </div>)}
        {ourRow && <div className="min-w-0">
          <dt className="flex items-start gap-2 text-muted-foreground"><span aria-hidden="true" className="mt-1 h-3 w-1 shrink-0" style={{ background: US_COLOR }} /><span className="[overflow-wrap:anywhere]">Pinned: {ourRow[2]}</span></dt>
          <dd className="pl-3 font-mono font-semibold tabular-nums">{fmt(ourRow[4])} points</dd>
        </div>}
      </dl>
      <ChartFrame height={H} label="Number of teams at each score" yTicks={yTicks} xTicks={xTicks} xTitle="score" padRight={RIGHT} hover={hover}>
        {bins.map((bin, i) => {
          if (!bin.length) return null;
          const from = lo + i * binW;
          const zone = zoneOf(from);
          const top = y(bin.length);
          const bx = PAD.L + i * slot + (slot - barW) / 2;
          const h = H - PAD.B - top;
          const rr = Math.min(3, barW / 2, h);
          return (
            <path
              key={i}
              d={`M${bx} ${H - PAD.B} V${top + rr} Q${bx} ${top} ${bx + rr} ${top} H${bx + barW - rr} Q${bx + barW} ${top} ${bx + barW} ${top + rr} V${H - PAD.B} Z`}
              style={{ fill: zone ? MEDAL_COLOR[zone] : 'var(--muted-foreground)' }}
              opacity={zone ? 0.9 : 0.45}
            />
          );
        })}
        {(['bronze', 'silver', 'gold'] as Medal[]).map(m => (
          <g key={m}>
            <line x1={x(line(m))} x2={x(line(m))} y1={PAD.T} y2={H - PAD.B} stroke={MEDAL_COLOR[m]} strokeWidth={1.5} />
          </g>
        ))}
        {ourRow && ourRow[4] >= lo && ourRow[4] < hi && (
          <g>
            <line x1={x(ourRow[4])} x2={x(ourRow[4])} y1={PAD.T + 4} y2={H - PAD.B} style={{ stroke: US_COLOR }} strokeWidth={2} />
          </g>
        )}
      </ChartFrame>
      <p className="mt-1 text-xs text-muted-foreground">
        {between.toLocaleString()} teams sit between the bronze and gold lines, a spread of {fmt(line('gold') - line('bronze'))} points.
        {' '}Not shown: {below.toLocaleString()} teams below {lo}
        {above.length > 0 && <>, and {above.length} above {lo + nBins * binW} (top score {fmt(above[0][4])})</>}.
      </p>
    </>
  );
}
