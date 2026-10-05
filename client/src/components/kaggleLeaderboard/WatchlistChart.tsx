/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: "Teams we are watching" -- score over the last 75 days for each starred team, as
 *          step lines (a score only changes when a team submits), with a removable chip per
 *          team showing its current rank and score. Our team is always drawn in the site
 *          blue and slightly thicker. Hover lists every watched team's score at that date.
 * SRP/DRY check: Pass - marks only; frame, gridlines and tooltip come from ChartFrame;
 *          the starred list itself is owned by useWatchlist.
 */

import { X } from 'lucide-react';
import { ChartFrame, PAD, W, niceMax, polyPoints, Swatch } from './ChartFrame';
import { DAY_MS, US_COLOR, WATCH_PALETTE, fmt, shortDate, trailAt, type BoardModel } from './boardData';

const H = 340;
const WINDOW_DAYS = 75;

interface Props {
  model: BoardModel;
  ids: string[];
  onRemove: (id: string) => void;
}

export function WatchlistChart({ model, ids: allIds, onRemove }: Props) {
  const { latest, history, byId } = model;
  // Only teams still on the board and with a kept trail (top 300 and us) can be drawn.
  const ids = allIds.filter((id) => history.trails[id] && byId.has(id));
  if (!ids.length) {
    return <p className="text-sm text-muted-foreground">No teams starred yet. Use the stars in the table below.</p>;
  }

  const now = Date.parse(latest.fetched);
  const t0 = now - WINDOW_DAYS * DAY_MS;
  const colorOf = new Map(ids.map((id, i) => [id, id === latest.ourTeamId ? US_COLOR : WATCH_PALETTE[i % WATCH_PALETTE.length]]));
  const ymax = niceMax(Math.max(...ids.map((id) => byId.get(id)![4])));
  const x = (t: number) => PAD.L + ((t - t0) / (now - t0)) * (W - PAD.L - PAD.R);
  const y = (v: number) => PAD.T + (1 - v / ymax) * (H - PAD.T - PAD.B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(
    (f) => [x(t0 + f * (now - t0)), shortDate(t0 + f * (now - t0)), f === 0 ? 'start' : f === 1 ? 'end' : 'middle'] as [number, string, 'start' | 'middle' | 'end'],
  );

  /** Step path inside the window: flat until each change, then up (or down) to it. */
  const stepPath = (id: string): Array<[number, number]> => {
    const path: Array<[number, number]> = [];
    let before: number | null = null;
    for (const [iso, v] of history.trails[id].pts) {
      const t = Date.parse(iso);
      if (t < t0) { before = v; continue; }
      if (!path.length && before != null) path.push([t0, before]);
      if (path.length) path.push([t, path[path.length - 1][1]]);
      path.push([t, v]);
    }
    if (!path.length && before != null) path.push([t0, before]);
    if (path.length) path.push([now, path[path.length - 1][1]]);
    return path;
  };

  const tooltipAt = (gx: number) => {
    const t = t0 + ((gx - PAD.L) / (W - PAD.L - PAD.R)) * (now - t0);
    const rows = ids
      .map((id) => [id, trailAt(history, id, t)] as const)
      .filter((r): r is readonly [string, [string, number, number]] => r[1] != null)
      .sort((a, b) => b[1][1] - a[1][1]);
    return (
      <>
        <b className="block">{new Date(t).toLocaleDateString()}</b>
        {rows.map(([id, p]) => (
          <div key={id}>{byId.get(id)?.[2] ?? history.trails[id].name}: {fmt(p[1])} (#{p[2]})</div>
        ))}
      </>
    );
  };

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
        {ids.map((id) => {
          const r = byId.get(id)!;
          return (
            <span key={id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
              <Swatch color={colorOf.get(id)!} />
              {r[2]} · #{r[0]} · {fmt(r[4])}
              <button type="button" className="ml-0.5 text-muted-foreground hover:text-foreground" title="Stop watching" aria-label={`Stop watching ${r[2]}`} onClick={() => onRemove(id)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
      <ChartFrame height={H} label="Watched teams, score over time" ymax={ymax} y={y} xTicks={ticks} tooltipAt={tooltipAt}>
        {ids.map((id) => {
          const pts = stepPath(id);
          return pts.length > 1 ? (
            <polyline
              key={id}
              points={polyPoints(pts.map(([t, v]) => [x(t), y(v)]))}
              fill="none"
              style={{ stroke: colorOf.get(id) }}
              strokeWidth={id === latest.ourTeamId ? 3 : 2}
              strokeLinejoin="round"
            />
          ) : null;
        })}
      </ChartFrame>
    </>
  );
}
