/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Compact Worm Arena stats panel.
 *          Shows a scrollable Worm Arena leaderboard with sortable columns
 *          (win rate, games, wins, losses, ties) and a link into the deeper
 *          Stats & Placement page.
 * SRP/DRY check: Pass presentation-only wrapper around useWormArenaStats.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWormArenaStats } from '@/hooks/useWormArenaStats';

type SortKey = 'winRate' | 'gamesPlayed' | 'wins' | 'losses' | 'ties' | 'modelSlug';

const WormArenaStatsPanel: React.FC = () => {
  const { leaderboard, recentActivity, isLoading, error } = useWormArenaStats();

  const [sortKey, setSortKey] = React.useState<SortKey>('winRate');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  const rows = React.useMemo(() => {
    const compareNumber = (left: number, right: number) => {
      if (left === right) return 0;
      return sortDir === 'asc' ? left - right : right - left;
    };

    const compareString = (left: string, right: string) => {
      const cmp = left.localeCompare(right);
      return sortDir === 'asc' ? cmp : -cmp;
    };

    const toNumber = (val: unknown) => (Number.isFinite(Number(val)) ? Number(val) : 0);

    return [...leaderboard].sort((a, b) => {
      if (sortKey === 'modelSlug') {
        return compareString(String(a.modelSlug ?? ''), String(b.modelSlug ?? ''));
      }

      if (sortKey === 'winRate') {
        const aw = typeof a.winRate === 'number' ? a.winRate : -1;
        const bw = typeof b.winRate === 'number' ? b.winRate : -1;
        const primary = compareNumber(aw, bw);
        if (primary !== 0) return primary;
        const secondary = compareNumber(toNumber(a.gamesPlayed), toNumber(b.gamesPlayed));
        if (secondary !== 0) return secondary;
        return String(a.modelSlug ?? '').localeCompare(String(b.modelSlug ?? ''));
      }

      const av = toNumber((a as any)[sortKey]);
      const bv = toNumber((b as any)[sortKey]);
      const primary = compareNumber(av, bv);
      if (primary !== 0) return primary;
      return String(a.modelSlug ?? '').localeCompare(String(b.modelSlug ?? ''));
    });
  }, [leaderboard, sortKey, sortDir]);

  const setSort = React.useCallback((next: SortKey) => {
    setSortKey((prev) => {
      if (prev === next) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(next === 'modelSlug' ? 'asc' : 'desc');
      return next;
    });
  }, []);

  const activityLabel = React.useMemo(() => {
    if (!recentActivity) return null;
    const dayCount = typeof recentActivity.days === 'number' ? recentActivity.days : 0;
    if (dayCount > 0) {
      return `Last ${dayCount} days: ${recentActivity.gamesPlayed} games, ${recentActivity.uniqueModels} models`;
    }
    return `All time: ${recentActivity.gamesPlayed} games, ${recentActivity.uniqueModels} models`;
  }, [recentActivity]);

  return (
    <Card className="worm-card-soft">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span>Worm Arena Stats</span>
            <a
              href="/worm-arena/stats"
              className="text-xs font-semibold underline text-worm-blue hover:text-worm-blue-hover"
            >
              Deeper stats
            </a>
          </div>
          {activityLabel && <span className="text-xs font-normal worm-muted">{activityLabel}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading && <div className="text-base worm-muted">Loading Worm Arena stats…</div>}
        {!isLoading && error && (
          <div className="text-base text-red-700">Failed to load stats: {error}</div>
        )}
        {!isLoading && !error && leaderboard.length === 0 && (
          <div className="text-base worm-muted">No Worm Arena matches recorded yet.</div>
        )}
        {!isLoading && !error && leaderboard.length > 0 && (
          <div className="overflow-x-auto">
            <div className="max-h-[560px] overflow-y-auto pr-1">
            <table className="min-w-full text-base">
              <thead>
                <tr className="worm-table-head">
                  <th className="py-2 px-3 text-left font-semibold">
                    <button type="button" className="underline" onClick={() => setSort('modelSlug')}>Model</button>
                  </th>
                  <th className="py-2 px-3 text-right font-semibold">
                    <button type="button" className="underline" onClick={() => setSort('gamesPlayed')}>Games</button>
                  </th>
                  <th className="py-2 px-3 text-right font-semibold">
                    <button type="button" className="underline" onClick={() => setSort('wins')}>Wins</button>
                  </th>
                  <th className="py-2 px-3 text-right font-semibold">
                    <button type="button" className="underline" onClick={() => setSort('losses')}>Losses</button>
                  </th>
                  <th className="py-2 px-3 text-right font-semibold">
                    <button type="button" className="underline" onClick={() => setSort('ties')}>Ties</button>
                  </th>
                  <th className="py-2 px-3 text-right font-semibold">
                    <button type="button" className="underline" onClick={() => setSort('winRate')}>Win Rate</button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.modelSlug} className="worm-table-row">
                    <td className="py-2 px-3 font-mono text-sm truncate max-w-[280px]" title={row.modelSlug}>
                      <a
                        href={`/worm-arena/stats?model=${encodeURIComponent(row.modelSlug)}`}
                        className="underline"
                      >
                        {row.modelSlug}
                      </a>
                    </td>
                    <td className="py-2 px-3 text-right">{row.gamesPlayed}</td>
                    <td className="py-2 px-3 text-right font-semibold worm-metric-wins">
                      {row.wins}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold worm-metric-losses">
                      {row.losses}
                    </td>
                    <td className="py-2 px-3 text-right">{row.ties}</td>
                    <td className="py-2 px-3 text-right font-semibold">
                      {typeof row.winRate === 'number' ? `${(row.winRate * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            </div>

            <div className="mt-3 text-sm worm-muted">
              Showing {rows.length} models.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WormArenaStatsPanel;
