/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: "The race over time" -- the leader's score, the three medal lines and our own
 *          score across the whole competition, with the right edge pinned to the close so
 *          the remaining runway is visible. Hover reads off the nearest saved snapshot.
 * SRP/DRY check: Pass - marks only; frame, gridlines and tooltip come from ChartFrame.
 */

import { ChartFrame, PAD, W, niceMax, polyPoints, Swatch } from './ChartFrame';
import { CLOSE_MS, MEDAL_COLOR, US_COLOR, fmt, shortDate, snapNearest, type BoardModel } from './boardData';
import type { KaggleBoardSnap } from '@shared/types';

const H = 320;
/** The backfill reaches back to March, when scores were flat near zero; start in June. */
const FROM = '2026-06-01';

const SERIES: Array<[string, string, (s: KaggleBoardSnap) => number | null]> = [
  ['Leader', 'var(--foreground)', (s) => s.top],
  ['Gold line', MEDAL_COLOR.gold, (s) => s.gold],
  ['Silver line', MEDAL_COLOR.silver, (s) => s.silver],
  ['Bronze line', MEDAL_COLOR.bronze, (s) => s.bronze],
];

export function RaceChart({ model }: { model: BoardModel }) {
  const snaps = model.history.snaps.filter((s) => s.t >= FROM);
  if (snaps.length < 2) {
    return <p className="text-sm text-muted-foreground">History fills in as snapshots accumulate.</p>;
  }

  const t0 = Date.parse(snaps[0].t);
  const tLast = Date.parse(snaps[snaps.length - 1].t);
  const t1 = Math.max(tLast, CLOSE_MS);
  const ymax = niceMax(Math.max(...snaps.map((s) => s.top)));
  const x = (t: number) => PAD.L + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.L - PAD.R);
  const y = (v: number) => PAD.T + (1 - v / ymax) * (H - PAD.T - PAD.B);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(
    (f) => [x(t0 + f * (t1 - t0)), shortDate(t0 + f * (t1 - t0)), f === 0 ? 'start' : f === 1 ? 'end' : 'middle'] as [number, string, 'start' | 'middle' | 'end'],
  );

  const ours = model.history.trails[model.latest.ourTeamId];
  const ourPts: Array<[number, number]> = ours
    ? ours.pts.filter((p) => p[0] >= FROM).map((p) => [Date.parse(p[0]), p[1]])
    : [];
  if (ourPts.length) ourPts.push([tLast, ourPts[ourPts.length - 1][1]]);

  const tooltipAt = (gx: number) => {
    const s = snapNearest(snaps, t0 + ((gx - PAD.L) / (W - PAD.L - PAD.R)) * (t1 - t0));
    if (!s) return null;
    return (
      <>
        <b className="block">{new Date(s.t).toLocaleString()}</b>
        Leader {fmt(s.top)} · gold {s.gold != null ? fmt(s.gold) : '–'} · silver {s.silver != null ? fmt(s.silver) : '–'} · bronze{' '}
        {s.bronze != null ? fmt(s.bronze) : '–'}
      </>
    );
  };

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SERIES.map(([name, color]) => (
          <span key={name}><Swatch color={color} />{name}</span>
        ))}
        {ours && <span><Swatch color={US_COLOR} />Us</span>}
      </div>
      <ChartFrame height={H} label="Scores over time" ymax={ymax} y={y} xTicks={ticks} tooltipAt={tooltipAt}>
        <line x1={x(CLOSE_MS)} x2={x(CLOSE_MS)} y1={PAD.T} y2={H - PAD.B} style={{ stroke: 'var(--border)' }} strokeDasharray="4 4" />
        {SERIES.map(([name, color, get]) => {
          const pts = snaps
            .map((s) => [Date.parse(s.t), get(s)] as const)
            .filter((p): p is readonly [number, number] => p[1] != null)
            .map(([t, v]) => [x(t), y(v)] as [number, number]);
          return pts.length > 1 ? (
            <polyline key={name} points={polyPoints(pts)} fill="none" style={{ stroke: color }} strokeWidth={2} strokeLinejoin="round" />
          ) : null;
        })}
        {ourPts.length > 1 && (
          <polyline
            points={polyPoints(ourPts.map(([t, v]) => [x(t), y(v)]))}
            fill="none"
            style={{ stroke: US_COLOR }}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        )}
      </ChartFrame>
    </>
  );
}
