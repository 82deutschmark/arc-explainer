/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: "Our rank against the medal cut-offs" -- our place on the board over the chosen
 *          window, with the gold, silver and bronze zones drawn as bands whose edges move as
 *          the field grows (cut ranks are a share of the team count). Rank 1 is at the top
 *          on a log scale, so a climb reads as going up and the narrow gold zone is still
 *          visible. This is the chart for "are we in the medals, and which way are we
 *          heading", which a score chart cannot show because everyone's scores rise.
 * SRP/DRY check: Pass - marks only; frame, crosshair and tooltip come from ChartFrame;
 *          medal ranks use the same rule as the snapshot script (medalRanksFor).
 */

import { ChartFrame, EndLabels, PAD, TipRow, W, AXIS_TEXT, polyPoints, stepPoints } from './ChartFrame';
import { MEDAL_COLOR, US_COLOR, medalRanksFor, rangeBounds, snapNearest, timeTicks, trailAt, type BoardModel, type Medal, type TimeRange } from './boardData';

const H = 300;

export function OurRankChart({ model, range }: { model: BoardModel; range: TimeRange }) {
  const ourId = model.latest.ourTeamId;
  const trail = model.history.trails[ourId];
  if (!trail?.pts.length) return <p className="text-sm text-muted-foreground">No rank history for our team yet.</p>;

  const [t0, t1] = rangeBounds(range, model);
  const tLast = Date.parse(model.latest.fetched);
  const snaps = model.history.snaps.filter((s) => Date.parse(s.t) >= t0);
  const pre = [...model.history.snaps].reverse().find((s) => Date.parse(s.t) < t0);
  if (pre) snaps.unshift({ ...pre, t: new Date(t0).toISOString() });

  const ours: Array<[number, number]> = [];
  const start = trailAt(model.history, ourId, t0);
  if (start) ours.push([t0, start[2]]);
  for (const p of trail.pts) if (Date.parse(p[0]) >= t0) ours.push([Date.parse(p[0]), p[2]]);
  if (model.ourRow) ours.push([tLast, model.ourRow[0]]);
  if (ours.length < 2) return <p className="text-sm text-muted-foreground">Not enough rank history in this window yet.</p>;

  const cuts = snaps.map((s) => [Date.parse(s.t), medalRanksFor(s.teams)] as const);
  cuts.push([tLast, model.latest.medalRanks]);

  const worst = Math.max(...ours.map((p) => p[1]), ...cuts.map(([, c]) => c.bronze));
  const rmax = Math.max(10, worst * 1.25);
  const plotR = W - PAD.R;
  const x = (t: number) => PAD.L + ((Math.min(t, t1) - t0) / Math.max(1, t1 - t0)) * (plotR - PAD.L);
  const y = (rank: number) => PAD.T + (Math.log(Math.max(1, rank)) / Math.log(rmax)) * (H - PAD.T - PAD.B);

  const yTicks = [1, 3, 10, 30, 100, 300, 1000, 3000].filter((r) => r <= rmax).map((r) => [y(r), `#${r}`] as [number, string]);

  // Zone bands: from the zone above's edge down to this zone's edge, stepping with the field.
  const edge = (m: Medal) => stepPoints(cuts.map(([t, c]) => [x(t), y(c[m] + 0.5)] as [number, number]));
  const band = (upper: Array<[number, number]> | null, lower: Array<[number, number]>) => {
    const top = upper ?? lower.map(([px]) => [px, PAD.T] as [number, number]);
    return polyPoints([...top, ...[...lower].reverse()]);
  };
  const g = edge('gold'), sv = edge('silver'), b = edge('bronze');

  const hover = (gx: number) => {
    const t = t0 + ((gx - PAD.L) / (plotR - PAD.L)) * (t1 - t0);
    if (t > tLast + 36e5) return null;
    const s = snapNearest(snaps, t);
    if (!s) return null;
    const ts = Date.parse(s.t);
    const p = trailAt(model.history, ourId, ts);
    const c = medalRanksFor(s.teams);
    return {
      x: x(ts),
      dots: p ? [{ y: y(p[2]), color: US_COLOR }] : [],
      body: (
        <>
          <div className="mb-1 font-semibold">{new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
          {p && <TipRow color={US_COLOR} name="Our rank" value={`#${p[2]}`} strong />}
          <TipRow color={MEDAL_COLOR.gold} name="Gold to" value={`#${c.gold}`} />
          <TipRow color={MEDAL_COLOR.silver} name="Silver to" value={`#${c.silver}`} />
          <TipRow color={MEDAL_COLOR.bronze} name="Bronze to" value={`#${c.bronze}`} />
          <div className="mt-1 text-muted-foreground">{s.teams.toLocaleString()} teams</div>
        </>
      ),
    };
  };

  const best = ours.reduce((a, p) => (p[1] < a[1] ? p : a));
  const nowRank = ours[ours.length - 1][1];

  return (
    <ChartFrame height={H} label="Our rank over time against the medal zones" yTicks={yTicks} xTicks={timeTicks(t0, t1, x)} hover={hover}>
      <polygon points={band(null, g)} fill={MEDAL_COLOR.gold} opacity={0.16} />
      <polygon points={band(g, sv)} fill={MEDAL_COLOR.silver} opacity={0.16} />
      <polygon points={band(sv, b)} fill={MEDAL_COLOR.bronze} opacity={0.16} />
      {(['gold', 'silver', 'bronze'] as Medal[]).map((m, i) => (
        <g key={m}>
          <polyline points={polyPoints([g, sv, b][i])} fill="none" stroke={MEDAL_COLOR[m]} strokeWidth={1} />
          <text x={PAD.L + 6} y={[g, sv, b][i][0][1] - 4} style={{ ...AXIS_TEXT, fontWeight: 600 }}>{m}</text>
        </g>
      ))}
      <polyline points={polyPoints(stepPoints(ours).map(([t, r]) => [x(t), y(r)]))} fill="none" style={{ stroke: US_COLOR }} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {best[1] < nowRank && (
        <g>
          <circle cx={x(best[0])} cy={y(best[1])} r={4} style={{ fill: US_COLOR, stroke: 'var(--card)' }} strokeWidth={2} />
          <text x={x(best[0]) + 8} y={y(best[1]) - 6} style={AXIS_TEXT}>best in view #{best[1]}</text>
        </g>
      )}
      <EndLabels items={[{ y: y(nowRank), text: `Us #${nowRank}`, color: US_COLOR, bold: true }]} x={x(tLast)} bottom={H - PAD.B} />
    </ChartFrame>
  );
}
