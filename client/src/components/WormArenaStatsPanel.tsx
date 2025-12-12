/**
 * Author: Cascade
 * Date: 2025-12-10
 * PURPOSE: Compact Worm Arena stats panel. Shows local WormArena leaderboard
 *          and recent-activity summary powered by SnakeBench-backed tables.
 * SRP/DRY check: Pass presentation-only wrapper around useWormArenaStats.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWormArenaStats } from '@/hooks/useWormArenaStats';

const WormArenaStatsPanel: React.FC = () => {
  const { leaderboard, recentActivity, isLoading, error } = useWormArenaStats();

  const rows = React.useMemo(() => {
    const sorted = [...leaderboard].sort(
      (a, b) => (b.gamesPlayed ?? 0) - (a.gamesPlayed ?? 0),
    );
    return sorted.slice(0, 12);
  }, [leaderboard]);

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
          <span>Worm Arena Stats</span>
          {activityLabel && <span className="text-xs font-normal worm-muted">{activityLabel}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm">
        {isLoading && <div className="worm-muted">Loading Worm Arena stats…</div>}
        {!isLoading && error && (
          <div className="text-red-700">Failed to load stats: {error}</div>
        )}
        {!isLoading && !error && leaderboard.length === 0 && (
          <div className="worm-muted">No Worm Arena matches recorded yet.</div>
        )}
        {!isLoading && !error && leaderboard.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="worm-table-head">
                  <th className="py-1 px-2 text-left font-semibold">Model</th>
                  <th className="py-1 px-2 text-right font-semibold">Games</th>
                  <th className="py-1 px-2 text-right font-semibold">Wins</th>
                  <th className="py-1 px-2 text-right font-semibold">Losses</th>
                  <th className="py-1 px-2 text-right font-semibold">Ties</th>
                  <th className="py-1 px-2 text-right font-semibold">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.modelSlug} className="worm-table-row">
                    <td className="py-1 px-2 font-mono text-[11px] truncate max-w-[240px]" title={row.modelSlug}>
                      {row.modelSlug}
                    </td>
                    <td className="py-1 px-2 text-right">{row.gamesPlayed}</td>
                    <td className="py-1 px-2 text-right font-semibold worm-metric-wins">
                      {row.wins}
                    </td>
                    <td className="py-1 px-2 text-right font-semibold worm-metric-losses">
                      {row.losses}
                    </td>
                    <td className="py-1 px-2 text-right">{row.ties}</td>
                    <td className="py-1 px-2 text-right">
                      {typeof row.winRate === 'number' ? `${(row.winRate * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {leaderboard.length > rows.length && (
              <div className="mt-2 text-[11px] worm-muted">
                Showing top {rows.length} by games played.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WormArenaStatsPanel;
