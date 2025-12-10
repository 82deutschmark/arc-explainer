/**
 * Author: Cascade
 * Date: 2025-12-10
 * PURPOSE: Worm Arena Stats & Placement page. Shows global Worm Arena
 *          aggregates, model-centric TrueSkill snapshots, placement
 *          progress, and recent match history. Backed entirely by
 *          SnakeBench DB tables via public ARC Explainer APIs.
 * SRP/DRY check: Pass — page-level composition only, delegates data
 *                fetching to dedicated hooks and shared helpers.
 */

import React from 'react';
import { useLocation } from 'wouter';

import WormArenaHeader from '@/components/WormArenaHeader';
import useWormArenaStats from '@/hooks/useWormArenaStats';
import {
  useSnakeBenchStats,
  useModelRating,
  useModelHistory,
} from '@/hooks/useSnakeBench';
import { summarizeWormArenaPlacement } from '@shared/utils/wormArenaPlacement.ts';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHead, TableHeader, TableRow, TableCell, TableBody } from '@/components/ui/table';

function useQueryParamModel(): string | null {
  const [location] = useLocation();

  try {
    const query = location.split('?')[1] ?? '';
    if (!query) return null;
    const params = new URLSearchParams(query);
    const model = params.get('model');
    return model && model.trim().length > 0 ? model.trim() : null;
  } catch {
    return null;
  }
}

export default function WormArenaStats() {
  const queryModel = useQueryParamModel();

  const { leaderboard, recentActivity } = useWormArenaStats();
  const { stats: globalStats } = useSnakeBenchStats();

  const [selectedModel, setSelectedModel] = React.useState<string | null>(queryModel);
  const [filter, setFilter] = React.useState('');

  const { rating, isLoading: loadingRating, error: ratingError, refresh: refreshRating } = useModelRating(selectedModel ?? undefined);
  const {
    historyForTable,
    isLoading: loadingHistory,
    error: historyError,
    refresh: refreshHistory,
  } = useModelHistory(selectedModel ?? undefined, 50);

  React.useEffect(() => {
    if (selectedModel) {
      void refreshRating(selectedModel);
      void refreshHistory(selectedModel);
    }
  }, [selectedModel, refreshRating, refreshHistory]);

  React.useEffect(() => {
    if (!selectedModel && leaderboard.length > 0) {
      setSelectedModel(leaderboard[0].modelSlug);
    }
  }, [leaderboard, selectedModel]);

  const placement = React.useMemo(() => summarizeWormArenaPlacement(rating ?? undefined), [rating]);

  const filteredLeaderboard = React.useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return leaderboard;
    return leaderboard.filter((entry) => entry.modelSlug.toLowerCase().includes(term));
  }, [leaderboard, filter]);

  const handleSelectModel = (slug: string) => {
    setSelectedModel(slug);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5e6d3', fontFamily: 'Fredoka, Nunito, sans-serif' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <WormArenaHeader
        totalGames={globalStats?.totalGames ?? 0}
        links={[
          { label: 'Replay', href: '/worm-arena' },
          { label: 'Live', href: '/worm-arena/live' },
          { label: 'Stats & Placement', href: '/worm-arena/stats', active: true },
        ]}
        showMatchupLabel={false}
      />

      <main className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
        {/* Sidebar: Model selector */}
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Models</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Search model (e.g. openai/gpt-5.1)"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="text-sm"
              />
              <ScrollArea className="h-80 border rounded-md bg-white/70">
                <div className="p-2 space-y-1">
                  {filteredLeaderboard.map((entry) => {
                    const active = entry.modelSlug === selectedModel;
                    return (
                      <button
                        key={entry.modelSlug}
                        type="button"
                        onClick={() => handleSelectModel(entry.modelSlug)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded border transition-colors ${
                          active
                            ? 'bg-[#1a2f23] text-[#faf6f1] border-[#1a2f23]'
                            : 'bg-white/80 text-[#3d2817] border-[#d4b5a0] hover:bg-[#faf6f1]'
                        }`}
                      >
                        <span className="truncate mr-2">{entry.modelSlug}</span>
                        <span className="font-mono text-[10px] text-[#7a6b5f]">
                          {entry.gamesPlayed}g · {entry.wins}W/{entry.losses}L
                        </span>
                      </button>
                    );
                  })}
                  {filteredLeaderboard.length === 0 && (
                    <div className="text-xs text-center text-muted-foreground py-4">
                      No models yet. Run a few matches to populate stats.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {recentActivity && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent activity</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 text-[#3d2817]">
                <div>
                  Last {recentActivity.days} days: <strong>{recentActivity.gamesPlayed}</strong> games
                </div>
                <div>
                  Active models: <strong>{recentActivity.uniqueModels}</strong>
                </div>
              </CardContent>
            </Card>
          )}
        </aside>

        {/* Main content: Stats & placement */}
        <section className="space-y-6">
          {/* Global strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card className="bg-[#faf6f1] border-[#d4b5a0]">
              <CardHeader className="py-3">
                <CardTitle className="text-xs text-[#7a6b5f]">Total matches</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-2xl font-bold" style={{ color: '#3d2817' }}>
                  {globalStats?.totalGames ?? 0}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#faf6f1] border-[#d4b5a0]">
              <CardHeader className="py-3">
                <CardTitle className="text-xs text-[#7a6b5f]">Models competing</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-2xl font-bold" style={{ color: '#3d2817' }}>
                  {globalStats?.activeModels ?? 0}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#faf6f1] border-[#d4b5a0]">
              <CardHeader className="py-3">
                <CardTitle className="text-xs text-[#7a6b5f]">Top apples (single game)</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-2xl font-bold" style={{ color: '#3d2817' }}>
                  {globalStats?.topApples ?? 0}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#faf6f1] border-[#d4b5a0]">
              <CardHeader className="py-3">
                <CardTitle className="text-xs text-[#7a6b5f]">Total testing cost</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="text-2xl font-bold" style={{ color: '#3d2817' }}>
                  ${globalStats?.totalCost?.toFixed ? globalStats.totalCost.toFixed(2) : (globalStats?.totalCost ?? 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Model summary & placement */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            <Card className="bg-[#faf6f1] border-[#d4b5a0]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Model snapshot</span>
                  {rating?.modelSlug && <Badge variant="outline">{rating.modelSlug}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm" style={{ color: '#3d2817' }}>
                {loadingRating && <div className="text-xs text-muted-foreground">Loading rating…</div>}
                {ratingError && <div className="text-xs text-red-600">{ratingError}</div>}
                {!loadingRating && !rating && !ratingError && (
                  <div className="text-xs text-muted-foreground">Select a model on the left to see stats.</div>
                )}

                {rating && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[11px] text-[#7a6b5f]">Skill estimate</div>
                        <div className="text-xl font-semibold">{rating.mu.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#7a6b5f]">Uncertainty</div>
                        <div className="text-xl font-semibold">{rating.sigma.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#7a6b5f]">Pessimistic rating</div>
                        <div className="text-xl font-semibold">{rating.exposed.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#7a6b5f]">Leaderboard score</div>
                        <div className="text-xl font-semibold">{rating.displayScore.toFixed(0)}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-xs mt-2">
                      <div>
                        <div className="text-[11px] text-[#7a6b5f]">Games</div>
                        <div className="font-semibold">{rating.gamesPlayed}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#7a6b5f]">Wins</div>
                        <div className="font-semibold">{rating.wins}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#7a6b5f]">Losses</div>
                        <div className="font-semibold">{rating.losses}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#7a6b5f]">Ties</div>
                        <div className="font-semibold">{rating.ties}</div>
                      </div>
                    </div>

                    <div className="text-xs mt-3 text-[#7a6b5f]">
                      We start uncertain about each model. After around nine high-signal games with the right opponents,
                      this pessimistic rating stabilises.
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#faf6f1] border-[#d4b5a0]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Placement status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm" style={{ color: '#3d2817' }}>
                {placement ? (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span>{placement.label}</span>
                      <Badge variant="outline">
                        {placement.gamesPlayed}/{placement.maxGames} games
                      </Badge>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#e5d5c5] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(placement.progress * 100)}%`,
                          background:
                            placement.phase === 'complete' || placement.phase === 'effectively_complete'
                              ? '#9ece6a'
                              : '#c85a3a',
                        }}
                      />
                    </div>
                    <div className="text-xs text-[#7a6b5f]">{placement.description}</div>
                    <div className="text-[11px] text-[#7a6b5f]">
                      9 games is a rule of thumb: we can stop earlier if uncertainty is already low, or continue playing
                      for more precision.
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">Select a model to see placement progress.</div>
                )}

                {rating && rating.isActive === false && (
                  <div className="text-[11px] text-[#7a6b5f] border-t pt-2 mt-2">
                    This model is currently inactive, but its stats are preserved.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* History table */}
          <Card className="bg-[#faf6f1] border-[#d4b5a0]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent matches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm" style={{ color: '#3d2817' }}>
              {loadingHistory && <div className="text-xs text-muted-foreground">Loading history…</div>}
              {historyError && <div className="text-xs text-red-600">{historyError}</div>}

              {historyForTable.length === 0 && !loadingHistory && !historyError && (
                <div className="text-xs text-muted-foreground">No games yet for this model.</div>
              )}

              {historyForTable.length > 0 && (
                <ScrollArea className="max-h-96 border rounded-md bg-white/80">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">When</TableHead>
                        <TableHead>Opponent</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Rounds</TableHead>
                        <TableHead>Death reason</TableHead>
                        <TableHead>Replay</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyForTable.map((row) => {
                        const dt = row.startedAt ? new Date(row.startedAt) : null;
                        const when = dt ? dt.toLocaleString() : '';
                        const score = `${row.myScore}-${row.opponentScore}`;
                        return (
                          <TableRow key={row.gameId}>
                            <TableCell className="whitespace-nowrap">{when}</TableCell>
                            <TableCell>{row.opponentSlug || 'Unknown'}</TableCell>
                            <TableCell className="capitalize">{row.result}</TableCell>
                            <TableCell>{score}</TableCell>
                            <TableCell>{row.rounds}</TableCell>
                            <TableCell>{row.deathReason ?? '—'}</TableCell>
                            <TableCell>
                              <a
                                href={`/worm-arena?gameId=${encodeURIComponent(row.gameId)}`}
                                className="underline text-xs"
                              >
                                View replay
                              </a>
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
        </section>
      </main>
    </div>
  );
}
