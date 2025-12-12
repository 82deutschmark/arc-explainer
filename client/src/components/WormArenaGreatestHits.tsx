/**
 * Author: Cascade
 * Date: 2025-12-11
 * PURPOSE: Worm Arena "Greatest Hits" card.
 *          Shows a short list of especially interesting matches
 *          (longest, most expensive, highest-scoring) with one-click
 *          replay links into the main Worm Arena viewer.
 * SRP/DRY check: Pass purely presentational; data comes from hook.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWormArenaGreatestHits } from '@/hooks/useWormArenaGreatestHits';

export default function WormArenaGreatestHits() {
  const { games, isLoading, error } = useWormArenaGreatestHits(5);

  return (
    <Card className="worm-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-worm-ink">
          Greatest Hits Matches
        </CardTitle>
        <p className="text-xs font-semibold mt-1 worm-muted">
          Curated Worm Arena games with long runs, high costs, or big scores.
        </p>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-worm-ink">
        {isLoading && (
          <div className="py-2 text-sm font-semibold worm-muted">
            Loading greatest hits
          </div>
        )}
        {error && !isLoading && (
          <div className="py-2 text-sm font-semibold text-red-700">{error}</div>
        )}
        {!isLoading && !error && games.length === 0 && (
          <div className="py-2 text-sm font-semibold worm-muted">
            No greatest hits yet run a few matches to discover epic games.
          </div>
        )}

        {!isLoading && !error && games.length > 0 && (
          <div className="space-y-2">
            {games.map((game) => {
              const matchup = `${game.modelA} vs ${game.modelB}`;
              const roundsLabel = `${game.roundsPlayed} / ${game.maxRounds || game.roundsPlayed} rounds`;
              const costLabel = `$${game.totalCost.toFixed(4)}`;
              const scoreLabel =
                game.scoreDelta > 0
                  ? `Score delta: ${game.scoreDelta}`
                  : `Max score: ${game.maxFinalScore}`;

              return (
                <div
                  key={game.gameId}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-md border px-3 py-2 bg-white/80 worm-border"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="font-mono text-xs truncate" title={matchup}>
                      {matchup}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <Badge variant="outline" className="font-semibold">
                        {roundsLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="font-semibold worm-border"
                      >
                        Cost: {costLabel}
                      </Badge>
                      <Badge variant="outline" className="font-semibold">
                        {scoreLabel}
                      </Badge>
                    </div>
                    <div className="text-[11px] font-semibold worm-muted">
                      {game.highlightReason}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 text-xs">
                    {game.startedAt && (
                      <span className="text-[11px] worm-muted">
                        {new Date(game.startedAt).toLocaleString()}
                      </span>
                    )}
                    <a
                      href={`/worm-arena?matchId=${encodeURIComponent(game.gameId)}`}
                      className="underline font-semibold text-xs text-worm-ink"
                    >
                      View replay
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
