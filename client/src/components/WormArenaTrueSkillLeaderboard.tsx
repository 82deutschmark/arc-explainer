/**
 * Author: Cascade
 * Date: 2025-12-10
 * PURPOSE: TrueSkill-based global leaderboard for Worm Arena stats page.
 *          Renders a SnakeBench-parity leaderboard table with Rank,
 *          model slug, TrueSkill rating/uncertainty, games, outcomes,
 *          apples, top score, win rate, and total cost.
 * SRP/DRY check: Pass — presentational table only, no data fetching.
 */

import React from 'react';
import type { SnakeBenchTrueSkillLeaderboardEntry } from '@shared/types';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
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
import { HelpCircle } from 'lucide-react';

interface WormArenaTrueSkillLeaderboardProps {
  entries: SnakeBenchTrueSkillLeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
}

export function WormArenaTrueSkillLeaderboard({
  entries,
  isLoading,
  error,
}: WormArenaTrueSkillLeaderboardProps) {
  const hasRows = entries.length > 0;

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
                <TooltipContent side="top" className="max-w-xs text-xs">
                  Global Worm Arena rankings by conservative TrueSkill rating
                  (μ - 3σ), filtered to models with at least 3 games.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <div className="text-xs font-semibold mt-1 worm-muted">
              Top models by TrueSkill exposed rating (μ - 3σ), up to 150 rows.
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
            <ScrollArea className="h-[420px] max-h-[420px] border rounded-md bg-white/90 worm-border">
              <Table className="text-sm min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink">
                      Rank
                    </TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink">
                      Model
                    </TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink">
                      <span className="inline-flex items-center gap-1">
                        <span>TS rating (μ - 3σ)</span>
                      </span>
                    </TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink">
                      <span className="inline-flex items-center gap-1">
                        <span>σ (uncertainty)</span>
                      </span>
                    </TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink">
                      Games
                    </TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink">
                      Wins
                    </TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink">
                      Losses
                    </TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink">
                      Ties
                    </TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink">
                      Apples eaten
                    </TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink">
                      Top score
                    </TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink">
                      Win rate
                    </TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-worm-ink">
                      Total cost
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, index) => {
                    const winRatePercent =
                      typeof entry.winRate === 'number'
                        ? Math.round(entry.winRate * 100)
                        : undefined;

                    return (
                      <TableRow key={entry.modelSlug}>
                        <TableCell className="whitespace-nowrap font-mono">#{index + 1}</TableCell>
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
                        <TableCell className="whitespace-nowrap font-mono worm-metric-apples">
                          {entry.applesEaten}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono worm-metric-rating">
                          {entry.topScore}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono worm-metric-winrate">
                          {winRatePercent != null ? `${winRatePercent}%` : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono worm-metric-cost">
                          ${entry.totalCost.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export default WormArenaTrueSkillLeaderboard;
