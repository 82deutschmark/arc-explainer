/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: The headline row directly under the page title: our rank, distance to the gold
 *          line, how far the gold line moved in the past week (and how far we did), the
 *          three medal lines, the leader, and days to the close. Visible without scrolling,
 *          per the Boss's note on the old arc-3 page's tall hero band.
 * SRP/DRY check: Pass - reads BoardModel only; one small Tile used for every figure.
 */

import { Card } from '@/components/ui/card';
import { CLOSE_MS, DAY_MS, MEDAL_COLOR, fmt, snapNearest, trailAt, weekAgoMs, type BoardModel, type Medal } from './boardData';

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

  const week = snapNearest(history.snaps, weekAgoMs());
  const ourWeek = trailAt(history, latest.ourTeamId, weekAgoMs());
  const daysLeft = Math.max(0, Math.ceil((CLOSE_MS - Date.now()) / DAY_MS));

  const tiles: Array<{ label: string; value: string; sub?: string; accent?: string }> = [];

  if (ourRow) {
    const medal = model.medalOf(ourRow[0]);
    const moved = ourRow[7] != null ? ourRow[7] - ourRow[0] : 0;
    tiles.push({
      label: 'Our rank',
      value: `#${ourRow[0]}`,
      sub: `${fmt(ourRow[4])} points · ${ourRow[5]} submissions${moved ? ` · ${moved > 0 ? 'up' : 'down'} ${Math.abs(moved)} today` : ''}`,
      accent: 'var(--primary)',
    });
    const gap = gold[4] - ourRow[4];
    tiles.push({
      label: 'To gold',
      value: gap > 0 ? `+${fmt(gap)}` : 'In the zone',
      sub: gap > 0 ? `points to pass the gold line` : medal ? `currently ${medal}` : undefined,
    });
  }

  if (week?.gold != null) {
    const dg = gold[4] - week.gold;
    const mine = ourRow && ourWeek ? ourRow[4] - ourWeek[1] : null;
    tiles.push({
      label: 'Gold line, past week',
      value: `${dg >= 0 ? '+' : ''}${fmt(dg)}`,
      sub: `${fmt(week.gold)} → ${fmt(gold[4])}${mine != null ? ` · we ${mine >= 0 ? 'gained' : 'lost'} ${fmt(Math.abs(mine))}` : ''}`,
    });
  }

  const line = (medal: Medal, row: typeof gold, rank: number) => ({
    label: `${medal[0].toUpperCase()}${medal.slice(1)} line`,
    value: fmt(row[4]),
    sub: `rank ${rank}`,
    accent: MEDAL_COLOR[medal],
  });
  tiles.push(line('gold', gold, mr.gold), line('silver', silver, mr.silver), line('bronze', bronze, mr.bronze));
  tiles.push({ label: 'Leader', value: fmt(leader[4]), sub: leader[2] });
  tiles.push({ label: 'Days to close', value: String(daysLeft), sub: 'medals settle on the private board' });

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
      {tiles.map((t) => (
        <Tile key={t.label} {...t} />
      ))}
    </div>
  );
}
