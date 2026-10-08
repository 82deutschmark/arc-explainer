/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-07
 * PURPOSE: "Scores over time" -- the leader, the three medal lines and the pinned team’s score over
 *          the chosen window, each line labelled at its end with its current value (labels
 *          spread apart with short leaders where lines converge, as the medal lines do).
 *          When the window runs to the close, a marker shows how much time is left. The
 *          crosshair snaps to the nearest saved snapshot and lists every line's value.
 * SRP/DRY check: Pass - marks only; frame, crosshair, tooltip and end labels come from
 *          ChartFrame; the window comes from the page's shared range switch.
 */

import { ChartFrame, EndLabels, PAD, TipRow, W, AXIS_TEXT, niceTicks, polyPoints, stepPoints } from './ChartFrame';
import { MEDAL_COLOR, US_COLOR, fmt, rangeBounds, snapNearest, timeTicks, trailAt, type BoardModel, type TimeRange } from './boardData';
import type { KaggleBoardSnap } from '@shared/types';

const H = 340;

const SERIES: Array<[string, string, (s: KaggleBoardSnap) => number | null]> = [
  ['Leader', 'var(--foreground)', (s) => s.top],
  ['Gold line', MEDAL_COLOR.gold, (s) => s.gold],
  ['Silver line', MEDAL_COLOR.silver, (s) => s.silver],
  ['Bronze line', MEDAL_COLOR.bronze, (s) => s.bronze],
];

export function RaceChart({ model, range }: { model: BoardModel; range: TimeRange }) {
  const [t0, t1] = rangeBounds(range, model);
  const all = model.history.snaps;
  const inRange = all.filter((s) => Date.parse(s.t) >= t0);
  // Carry the last snapshot before the window in, so lines start at the left edge.
  const before = [...all].reverse().find((s) => Date.parse(s.t) < t0);
  const snaps = before ? [{ ...before, t: new Date(t0).toISOString() }, ...inRange] : inRange;
  if (snaps.length < 2) return <p className="text-sm text-muted-foreground">Not enough saved history in this window yet.</p>;

  const ourId = model.latest.ourTeamId;
  const ourTrail = model.history.trails[ourId];
  const tLast = Date.parse(snaps[snaps.length - 1].t);
  const ourPts: Array<[number, number]> = [];
  if (ourTrail) {
    const start = trailAt(model.history, ourId, t0);
    if (start) ourPts.push([t0, start[1]]);
    for (const p of ourTrail.pts) if (Date.parse(p[0]) >= t0) ourPts.push([Date.parse(p[0]), p[1]]);
    if (ourPts.length) ourPts.push([tLast, ourPts[ourPts.length - 1][1]]);
  }

  const values = snaps.flatMap((s) => SERIES.map(([, , get]) => get(s)).filter((v): v is number => v != null)).concat(ourPts.map((p) => p[1]));
  const vmin = Math.min(...values), vmax = Math.max(...values);
  const pad = Math.max(0.5, (vmax - vmin) * 0.06);
  const ylo = Math.max(0, vmin - pad), yhi = vmax + pad;
  const plotR = W - PAD.R;
  const x = (t: number) => PAD.L + ((t - t0) / Math.max(1, t1 - t0)) * (plotR - PAD.L);
  const y = (v: number) => PAD.T + (1 - (v - ylo) / (yhi - ylo)) * (H - PAD.T - PAD.B);
  const yTicks = niceTicks(ylo, yhi, 5).map((v) => [y(v), String(v)] as [number, string]);

  const lines = SERIES.map(([name, color, get]) => ({
    name,
    color,
    pts: snaps.map((s) => [Date.parse(s.t), get(s)] as const).filter((p): p is readonly [number, number] => p[1] != null).map((p) => [p[0], p[1]] as [number, number]),
  }));

  const ends = [
    ...lines.filter((l) => l.pts.length).map((l) => ({ y: y(l.pts[l.pts.length - 1][1]), text: `${l.name.replace(' line', '')} ${fmt(l.pts[l.pts.length - 1][1])}`, color: l.color })),
    ...(ourPts.length ? [{ y: y(ourPts[ourPts.length - 1][1]), text: `Pinned ${fmt(ourPts[ourPts.length - 1][1])}`, color: US_COLOR, bold: true }] : []),
  ];

  const hover = (gx: number) => {
    const t = t0 + ((gx - PAD.L) / (plotR - PAD.L)) * (t1 - t0);
    if (t > tLast + 36e5) return null;
    const s = snapNearest(snaps, t);
    if (!s) return null;
    const ts = Date.parse(s.t);
    const ours = trailAt(model.history, ourId, ts);
    const rowsAt = SERIES.map(([name, color, get]) => ({ name, color, v: get(s) })).filter((r) => r.v != null) as Array<{ name: string; color: string; v: number }>;
    if (ours) rowsAt.push({ name: `${model.ourRow?.[2] ?? ourTrail?.name ?? "Pinned team"} (#${ours[2]})`, color: US_COLOR, v: ours[1] });
    rowsAt.sort((a, b) => b.v - a.v);
    return {
      x: x(ts),
      dots: rowsAt.map((r) => ({ y: y(r.v), color: r.color })),
      body: (
        <>
          <div className="mb-1 font-semibold">{new Date(s.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: s.t.endsWith('23:59:00Z') ? undefined : 'numeric', minute: s.t.endsWith('23:59:00Z') ? undefined : '2-digit' })}</div>
          {rowsAt.map((r) => <TipRow key={r.name} color={r.color} name={r.name} value={fmt(r.v)} strong={r.color === US_COLOR} />)}
          <div className="mt-1 text-muted-foreground">{s.teams.toLocaleString()} teams on the board</div>
        </>
      ),
    };
  };

  const close = model.competition.closeAt ? Date.parse(model.competition.closeAt) : tLast;
  const showClose = close <= t1 && close > tLast;
  const daysLeft = Math.ceil((close - tLast) / 864e5);

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {lines.map((l) => (
          <span key={l.name} className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t-2" style={{ borderColor: l.color }} />{l.name}</span>
        ))}
        {ourPts.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t-[3px]" style={{ borderColor: US_COLOR }} />Pinned team</span>}
      </div>
      <ChartFrame height={H} label="Leader, medal lines and pinned team score over time" yTicks={yTicks} xTicks={timeTicks(t0, t1, x)} hover={hover}>
        {showClose && (
          <g>
            <rect x={x(tLast)} y={PAD.T} width={x(close) - x(tLast)} height={H - PAD.T - PAD.B} style={{ fill: 'var(--muted)' }} opacity={0.6} />
            <line x1={x(close)} x2={x(close)} y1={PAD.T} y2={H - PAD.B} style={{ stroke: 'var(--muted-foreground)' }} />
            <text x={x(close) - 6} y={H - PAD.B - 8} textAnchor="end" style={AXIS_TEXT}>close · {daysLeft} days left</text>
          </g>
        )}
        {lines.map((l) =>
          l.pts.length > 1 ? (
            <polyline key={l.name} points={polyPoints(stepPoints(l.pts).map(([t, v]) => [x(t), y(v)]))} fill="none" style={{ stroke: l.color }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ) : null,
        )}
        {ourPts.length > 1 && (
          <polyline points={polyPoints(stepPoints(ourPts).map(([t, v]) => [x(t), y(v)]))} fill="none" style={{ stroke: US_COLOR }} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        )}
        <EndLabels items={ends} x={x(tLast)} bottom={H - PAD.B} />
      </ChartFrame>
    </>
  );
}
