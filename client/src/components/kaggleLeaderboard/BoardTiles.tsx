/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-07
 * PURPOSE: The headline row directly under the page title: the leader, the three medal
 *          lines, weekly gold-line movement, and days to the close, followed by the
 *          pinned team’s rank and distance to gold. Visible without scrolling,
 *          per the Boss's note on the old arc-3 page's tall hero band.
 * SRP/DRY check: Pass - reads BoardModel only; one small Tile used for every figure.
 */

import { Card } from '@/components/ui/card';
import { DAY_MS, MEDAL_COLOR, fmt, snapNearest, weekAgoMs, type BoardModel, type Medal } from './boardData';

function Tile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Card className="px-3 py-2.5" style={accent ? { borderTop: `3px solid ${accent}` } : undefined}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="truncate text-xs text-muted-foreground" title={sub}>{sub}</div>}
    </Card>
  );
}

export function BoardTiles({ model }: { model: BoardModel }) {
  const { latest, ourRow, history } = model;
  const mr = latest.medalRanks;
  const at = (rank: number) => latest.rows[rank - 1];
  const gold = at(mr.gold), silver = at(mr.silver), bronze = at(mr.bronze), leader = latest.rows[0];

  const week = history.snaps.some((s) => Date.parse(s.t) <= weekAgoMs()) ? snapNearest(history.snaps, weekAgoMs()) : null;
  const close = model.competition.closeAt ? Date.parse(model.competition.closeAt) : null;
  const daysLeft = close == null ? null : Math.max(0, Math.ceil((close - Date.now()) / DAY_MS));

  const tiles: Array<{ label: string; value: string; sub?: string; accent?: string }> = [];


  if (week?.gold != null) {
    const dg = gold[4] - week.gold;
    tiles.push({
      label: 'Gold line, past week',
      value: `${dg >= 0 ? '+' : ''}${fmt(dg)}`,
      sub: `${fmt(week.gold)} → ${fmt(gold[4])}`,
    });
  }

  const line = (medal: Medal, row: typeof gold, rank: number) => ({
    label: `${medal[0].toUpperCase()}${medal.slice(1)} line`,
    value: fmt(row[4]),
    sub: `rank ${rank}`,
    accent: MEDAL_COLOR[medal],
  });
  tiles.push(line('gold', gold, mr.gold), line('silver', silver, mr.silver), line('bronze', bronze, mr.bronze));
  tiles.unshift({ label: 'Leader', value: fmt(leader[4]), sub: leader[2] });
  if (daysLeft != null) tiles.push({ label: 'Days to close', value: String(daysLeft), sub: 'medals settle on the private board' });

  if (ourRow) {
    const medal = model.medalOf(ourRow[0]);
    const moved = ourRow[7] != null ? ourRow[7] - ourRow[0] : 0;
    tiles.push({
      label: 'Pinned team',
      value: `#${ourRow[0]}`,
      sub: `${ourRow[2]} · ${fmt(ourRow[4])} points · ${ourRow[5]} submissions${moved ? ` · ${moved > 0 ? 'up' : 'down'} ${Math.abs(moved)} today` : ''}`,
      accent: 'var(--primary)',
    });
    const gap = gold[4] - ourRow[4];
    tiles.push({
      label: 'Pinned: to gold',
      value: gap > 0 ? `+${fmt(gap)}` : 'In the zone',
      sub: gap > 0 ? `points to pass the gold line` : medal ? `currently ${medal}` : undefined,
    });
  }


  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(130px,1fr))]">
      {tiles.map((t) => (
        <Tile key={t.label} {...t} />
      ))}
    </div>
  );
}
