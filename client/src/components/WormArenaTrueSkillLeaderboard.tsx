/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: TrueSkill-based global leaderboard for Worm Arena stats page.
 *          Renders a SnakeBench-parity leaderboard table with Rank,
 *          model slug, TrueSkill rating/uncertainty, games, outcomes,
 *          apples, top score, win rate, and total cost.
 *          Features sticky sorted header with red border and full sortability.
 *          Supports row selection/highlighting when used as a picker.
 * SRP/DRY check: Pass — presentational table with client-side sorting only.
 */

import React, { useState, useMemo } from 'react';
import type { SnakeBenchTrueSkillLeaderboardEntry } from '@shared/types';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
  TableBody,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle, ArrowUp, ArrowDown } from 'lucide-react';

type SortColumn = 'exposed' | 'sigma' | 'gamesPlayed' | 'wins' | 'losses' | 'ties' | 'applesEaten' | 'topScore' | 'winRate' | 'totalCost';
type SortDirection = 'asc' | 'desc';

type LeaderboardVariant = 'full' | 'compact';

interface WormArenaTrueSkillLeaderboardProps {
  entries: SnakeBenchTrueSkillLeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  selectedModelSlug?: string | null;
  onSelectModel?: (modelSlug: string) => void;
  variant?: LeaderboardVariant;
}

export function WormArenaTrueSkillLeaderboard({
  entries,
  isLoading,
  error,
  selectedModelSlug,
  onSelectModel,
  variant = 'full',
}: WormArenaTrueSkillLeaderboardProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('exposed');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const hasRows = entries.length > 0;

  const handleSort = (column: SortColumn) => {
    if (
      variant === 'compact' &&
      (column === 'applesEaten' || column === 'topScore' || column === 'winRate')
    ) {
      return;
    }

    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedEntries = useMemo(() => {
    // Preserve original TrueSkill rank before sorting by any column
    const entriesWithRank = entries.map((entry, index) => ({
      ...entry,
      _trueskillRank: index + 1,
    }));

    const sorted = [...entriesWithRank].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    return sorted;
  }, [entries, sortColumn, sortDirection]);

  return (
    <TooltipProvider>
      <Card className="worm-card">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle
              className="text-lg font-bold flex items-center gap-2"
            >
              <span>TrueSkill leaderboard</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 cursor-help worm-muted" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm text-xs space-y-2">
                  <div>
                    <strong>What is TrueSkill?</strong> TrueSkill is a rating system that measures a model's true skill by tracking wins, losses, and ties. It accounts for uncertainty — new models have high uncertainty (σ), which decreases as they play more games.
                  </div>
                  <div>
                    <strong>The exposed rating:</strong> This is a conservative estimate (μ − 3σ) designed to avoid overestimating newly ranked models. It represents the skill floor you can be confident about.
                  </div>
                  <div>
                    <strong>Why it matters:</strong> Unlike raw win rate, TrueSkill automatically adjusts for strength of competition and uncertainty. A 70% win rate against weak opponents is worth less than 50% against strong ones.
                  </div>
                  <div>
                    Filtered to models with ≥3 games. Click any column header to sort.
                  </div>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <div className="text-xs font-semibold mt-1 worm-muted">
              Click headers to sort. Click a row to select.
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading && (
            <div className="text-sm font-semibold py-3 worm-muted">
              Loading TrueSkill leaderboard...
            </div>
          )}
          {error && !isLoading && (
            <div className="text-sm font-semibold text-red-700 py-3">{error}</div>
          )}
          {!isLoading && !error && !hasRows && (
            <div className="text-sm font-semibold py-3 worm-muted">
              No models meet the minimum games requirement yet. Run a few matches to
              populate the TrueSkill leaderboard.
            </div>
          )}

          {hasRows && !error && (
            <div className="h-[420px] max-h-[420px] overflow-auto border rounded-md bg-white/90 worm-border">
              {/* Use a plain table here; the shared Table wrapper adds overflow styles that can break sticky headers. */}
              <table className={cn('w-full caption-bottom text-sm', variant === 'compact' ? 'min-w-[760px]' : 'min-w-[900px]')}>
                <TableHeader>
                  <TableRow className="sticky top-0 bg-white/95 border-b-2" style={{ borderColor: 'var(--worm-red)' }}>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink cursor-default">
                      Rank
                    </TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink cursor-default">
                      Model
                    </TableHead>
                    <TableHead
                      className="whitespace-nowrap font-bold text-worm-ink cursor-pointer hover:bg-worm-track/50 transition-colors"
                      onClick={() => handleSort('exposed')}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>TS rating (μ - 3σ)</span>
                        {sortColumn === 'exposed' && (
                          sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                        )}
                      </span>
                    </TableHead>
                    <TableHead
                      className="whitespace-nowrap font-bold text-worm-ink cursor-pointer hover:bg-worm-track/50 transition-colors"
                      onClick={() => handleSort('sigma')}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>σ (uncertainty)</span>
                        {sortColumn === 'sigma' && (
                          sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                        )}
                      </span>
                    </TableHead>
                    <TableHead
                      className="whitespace-nowrap font-bold text-worm-ink cursor-pointer hover:bg-worm-track/50 transition-colors"
                      onClick={() => handleSort('gamesPlayed')}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>Games</span>
                        {sortColumn === 'gamesPlayed' && (
                          sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                        )}
                      </span>
                    </TableHead>
                    <TableHead
                      className="whitespace-nowrap font-bold text-worm-ink cursor-pointer hover:bg-worm-track/50 transition-colors"
                      onClick={() => handleSort('wins')}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>Wins</span>
                        {sortColumn === 'wins' && (
                          sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                        )}
                      </span>
                    </TableHead>
                    <TableHead
                      className="whitespace-nowrap font-bold text-worm-ink cursor-pointer hover:bg-worm-track/50 transition-colors"
                      onClick={() => handleSort('losses')}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>Losses</span>
                        {sortColumn === 'losses' && (
                          sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                        )}
                      </span>
                    </TableHead>
                    <TableHead
                      className="whitespace-nowrap font-bold text-worm-ink cursor-pointer hover:bg-worm-track/50 transition-colors"
                      onClick={() => handleSort('ties')}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>Ties</span>
                        {sortColumn === 'ties' && (
                          sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                        )}
                      </span>
                    </TableHead>
                    {variant === 'full' && (
                      <>
                        <TableHead
                          className="whitespace-nowrap font-bold text-worm-ink cursor-pointer hover:bg-worm-track/50 transition-colors"
                          onClick={() => handleSort('applesEaten')}
                        >
                          <span className="inline-flex items-center gap-1">
                            <span>Apples eaten</span>
                            {sortColumn === 'applesEaten' && (
                              sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                            )}
                          </span>
                        </TableHead>
                        <TableHead
                          className="whitespace-nowrap font-bold text-worm-ink cursor-pointer hover:bg-worm-track/50 transition-colors"
                          onClick={() => handleSort('topScore')}
                        >
                          <span className="inline-flex items-center gap-1">
                            <span>Top score</span>
                            {sortColumn === 'topScore' && (
                              sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                            )}
                          </span>
                        </TableHead>
                        <TableHead
                          className="whitespace-nowrap font-bold text-worm-ink cursor-pointer hover:bg-worm-track/50 transition-colors"
                          onClick={() => handleSort('winRate')}
                        >
                          <span className="inline-flex items-center gap-1">
                            <span>Win rate</span>
                            {sortColumn === 'winRate' && (
                              sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                            )}
                          </span>
                        </TableHead>
                      </>
                    )}
                    <TableHead
                      className="whitespace-nowrap font-bold text-worm-ink cursor-pointer hover:bg-worm-track/50 transition-colors"
                      onClick={() => handleSort('totalCost')}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>Total cost</span>
                        {sortColumn === 'totalCost' && (
                          sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                        )}
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEntries.map((entry) => {
                    const winRatePercent =
                      typeof entry.winRate === 'number'
                        ? Math.round(entry.winRate * 100)
                        : undefined;

                    const isSelected = !!selectedModelSlug && entry.modelSlug === selectedModelSlug;

                    return (
                      <TableRow
                        key={`${entry.modelSlug}-${entry._trueskillRank}`}
                        onClick={() => onSelectModel?.(entry.modelSlug)}
                        className={cn(
                          onSelectModel ? 'cursor-pointer' : undefined,
                          isSelected ? 'bg-worm-track/70' : undefined,
                        )}
                      >
                        <TableCell className="whitespace-nowrap font-mono">#{entry._trueskillRank}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono max-w-[260px] truncate">
                          {entry.modelSlug}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono worm-metric-rating">
                          {entry.exposed.toFixed(2)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono worm-metric-sigma">
                          σ = {entry.sigma.toFixed(2)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono worm-metric-games">
                          {entry.gamesPlayed}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono worm-metric-wins">
                          {entry.wins}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono worm-metric-losses">
                          {entry.losses}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono worm-metric-ties">
                          {entry.ties}
                        </TableCell>
                        {variant === 'full' && (
                          <>
                            <TableCell className="whitespace-nowrap font-mono worm-metric-apples">
                              {entry.applesEaten}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-mono worm-metric-rating">
                              {entry.topScore}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-mono worm-metric-winrate">
                              {winRatePercent != null ? `${winRatePercent}%` : '—'}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="whitespace-nowrap font-mono worm-metric-cost">
                          ${entry.totalCost.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export default WormArenaTrueSkillLeaderboard;
