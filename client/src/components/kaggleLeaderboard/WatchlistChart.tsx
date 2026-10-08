/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-07
 * PURPOSE: "Watchlist" -- score over the chosen window for each starred team,
 *          as step lines (a score only changes when a team submits), each labelled at its
 *          end. Every team keeps its own colour however the list changes; ours is always the
 *          site blue and drawn thicker. Up to eight lines (ours plus seven), the most a
 *          colour-blind-safe palette can keep apart; extra stars stay in the list and are
 *          drawn when a slot frees up. Chips link each team to Kaggle and remove it.
 * SRP/DRY check: Pass - marks only; frame, crosshair, tooltip and end labels come from
 *          ChartFrame; the starred list is owned by useWatchlist.
 */

import { X } from 'lucide-react';
import { ChartFrame, EndLabels, PAD, TipRow, W, niceTicks, polyPoints, stepPoints } from './ChartFrame';
import { fmt, rangeBounds, seriesColors, timeTicks, trailAt, type BoardModel, type TimeRange } from './boardData';
import { TeamName } from './TeamName';

const H = 340;
const MAX_LINES = 8;

interface Props {
  model: BoardModel;
  ids: string[];
  range: TimeRange;
  onRemove: (id: string) => void;
}

export function WatchlistChart({ model, ids: allIds, range, onRemove }: Props) {
  if (model.history.snaps.length < 2) return <p className="text-sm text-muted-foreground">History will appear after another saved snapshot.</p>;
  const { latest, history, byId } = model;
  const ourId = latest.ourTeamId;
  // Only teams still on the board and with a kept trail (top 300 and us) can be drawn.
  const drawable = allIds.filter((id) => history.trails[id] && byId.has(id));
  const ids = [...drawable.filter((id) => id === ourId), ...drawable.filter((id) => id !== ourId)].slice(0, MAX_LINES);
  const hidden = drawable.length - ids.length;
  if (!ids.length) {
    return <p className="text-sm text-muted-foreground">No teams starred yet. Use the stars in the table below.</p>;
  }

  const [t0, tEnd] = rangeBounds(range, model);
  const now = Date.parse(latest.fetched);
  const t1 = Math.min(tEnd, now); // trails stop at the latest save; no runway here
  const colorOf = seriesColors(ids, ourId);

  const series = ids.map((id) => {
    const pts: Array<[number, number]> = [];
    const start = trailAt(history, id, t0);
    if (start) pts.push([t0, start[1]]);
    for (const p of history.trails[id].pts) if (Date.parse(p[0]) >= t0) pts.push([Date.parse(p[0]), p[1]]);
    pts.push([now, byId.get(id)![4]]);
    return { id, pts, color: colorOf.get(id)! };
  });

  const values = series.flatMap((s) => s.pts.map((p) => p[1]));
  const vmin = Math.min(...values), vmax = Math.max(...values);
  const pad = Math.max(0.5, (vmax - vmin) * 0.06);
  const ylo = Math.max(0, vmin - pad), yhi = vmax + pad;
  const plotR = W - PAD.R - 40; // team names are longer than line names
  const x = (t: number) => PAD.L + ((t - t0) / Math.max(1, t1 - t0)) * (plotR - PAD.L);
  const y = (v: number) => PAD.T + (1 - (v - ylo) / (yhi - ylo)) * (H - PAD.T - PAD.B);
  const yTicks = niceTicks(ylo, yhi, 5).map((v) => [y(v), String(v)] as [number, string]);

  const short = (name: string) => (name.length > 18 ? `${name.slice(0, 17)}…` : name);

  const hover = (gx: number) => {
    const t = Math.min(t1, t0 + ((gx - PAD.L) / (plotR - PAD.L)) * (t1 - t0));
    const at = series
      .map((s) => ({ s, p: trailAt(history, s.id, t) }))
      .filter((r): r is { s: (typeof series)[number]; p: [string, number, number] } => r.p != null)
      .sort((a, b) => b.p[1] - a.p[1]);
    return {
      x: x(t),
      dots: at.map(({ s, p }) => ({ y: y(p[1]), color: s.color })),
      body: (
        <>
          <div className="mb-1 font-semibold">{new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
          {at.map(({ s, p }) => (
            <TipRow key={s.id} color={s.color} name={byId.get(s.id)![2]} value={`${fmt(p[1])} · #${p[2]}`} strong={s.id === ourId} />
          ))}
        </>
      ),
    };
  };

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
        {ids.map((id) => {
          const r = byId.get(id)!;
          return (
            <span key={id} className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-2 pr-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorOf.get(id) }} />
              <TeamName row={r} className="max-w-[180px] truncate" />
              <span className="font-mono text-muted-foreground">#{r[0]}</span>
              {!model.competition.pinnedTeamIds.includes(id) && <button type="button" className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Stop watching" aria-label={`Stop watching ${r[2]}`} onClick={() => onRemove(id)}>
                <X className="h-3 w-3" />
              </button>}
            </span>
          );
        })}
        {hidden > 0 && <span className="self-center text-muted-foreground">+{hidden} more starred (eight lines at most)</span>}
      </div>
      <ChartFrame height={H} label="Watched teams, score over time" yTicks={yTicks} xTicks={timeTicks(t0, t1, x)} padRight={W - plotR} hover={hover}>
        {series.map((s) => (
          <polyline
            key={s.id}
            points={polyPoints(stepPoints(s.pts).map(([t, v]) => [x(t), y(v)]))}
            fill="none"
            style={{ stroke: s.color }}
            strokeWidth={s.id === ourId ? 3 : 2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        <EndLabels
          x={x(now)}
          bottom={H - PAD.B}
          items={series.map((s) => ({ y: y(s.pts[s.pts.length - 1][1]), text: short(byId.get(s.id)![2]), color: s.color, bold: s.id === ourId }))}
        />
      </ChartFrame>
    </>
  );
}
