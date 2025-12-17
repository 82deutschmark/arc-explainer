/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Worm Arena "Greatest Hits" card.
 *          Shows a short list of especially interesting matches
 *          (longest, most expensive, highest-scoring) with one-click
 *          replay links into the main Worm Arena viewer.
 *
 *          Layout note: Matchup strings can be long (provider/model IDs).
 *          We intentionally avoid truncation so users can always see both
 *          sides of the matchup (champion + challenger).
 *
 *          Note: Uses a simple overflow container instead of Radix ScrollArea.
 *          ScrollArea requires a fixed height and can render a 0-height viewport
 *          when only max-height is applied, causing the list to appear cut off.
 *          Replay links open in a new tab so users can keep the stats page open.
 * SRP/DRY check: Pass — purely presentational; data comes from hook.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWormArenaGreatestHits } from '@/hooks/useWormArenaGreatestHits';

function normalizeGameId(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  const withoutExt = trimmed.endsWith('.json') ? trimmed.slice(0, -'.json'.length) : trimmed;
  return withoutExt.startsWith('snake_game_') ? withoutExt.slice('snake_game_'.length) : withoutExt;
}

export default function WormArenaGreatestHits() {
  const { games, isLoading, error } = useWormArenaGreatestHits(20);

  return (
    <Card className="worm-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold text-worm-ink">
          Greatest Hits Matches
        </CardTitle>
        <p className="text-sm mt-1 worm-muted">
          Curated Worm Arena games with long runs, high costs, or big scores.
        </p>
      </CardHeader>
      <CardContent className="pt-0 text-base text-worm-ink">
        {isLoading && (
          <div className="py-3 text-base worm-muted">
            Loading greatest hits
            …
          </div>
        )}
        {error && !isLoading && (
          <div className="py-3 text-base text-red-700">{error}</div>
        )}
        {!isLoading && !error && games.length === 0 && (
          <div className="py-3 text-base worm-muted">
            No greatest hits yet — run a few matches to discover epic games.
          </div>
        )}

        {!isLoading && !error && games.length > 0 && (
          <div className="max-h-[560px] overflow-y-auto pr-3">
            <div className="space-y-3">
              {games.map((game) => {
                const matchup = `${game.modelA} vs ${game.modelB}`;
                const roundsLabel = `${game.roundsPlayed} / ${game.maxRounds || game.roundsPlayed} rounds`;
                const hasCost = game.totalCost > 0;
                const costLabel = hasCost ? `$${game.totalCost.toFixed(2)}` : null;
                const scoreLabel =
                  game.scoreDelta > 0
                    ? `Score delta: ${game.scoreDelta}`
                    : `Max score: ${game.maxFinalScore}`;
                const replayHref = `/worm-arena?matchId=${encodeURIComponent(normalizeGameId(game.gameId))}`;

                return (
                  <div
                    key={game.gameId}
                    className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 rounded-md border px-4 py-3 bg-white/80 worm-border"
                  >
                    <div className="space-y-2 min-w-0">
                      {/*
                        Matchup IDs can be long (e.g. provider/model names).
                        Avoid truncation so the challenger is always visible.
                      */}
                      <div className="font-mono text-sm leading-snug whitespace-normal break-words" title={matchup}>
                        <div className="flex gap-2">
                          <span className="shrink-0 worm-muted">Champion:</span>
                          <span className="min-w-0 break-words">{game.modelA}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="shrink-0 worm-muted">Challenger:</span>
                          <span className="min-w-0 break-words">{game.modelB}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <Badge variant="outline" className="font-semibold text-sm px-2 py-1">
                          {roundsLabel}
                        </Badge>
                        {costLabel && (
                          <Badge
                            variant="outline"
                            className="font-semibold text-sm px-2 py-1 worm-border"
                          >
                            Cost: {costLabel}
                          </Badge>
                        )}
                        <Badge variant="outline" className="font-semibold text-sm px-2 py-1">
                          {scoreLabel}
                        </Badge>
                      </div>
                      <div className="text-sm worm-muted">
                        {game.highlightReason}
                      </div>
                    </div>

                    <div className="flex md:flex-col items-end justify-end gap-2 md:gap-1">
                      {game.startedAt && (
                        <span className="text-sm worm-muted">
                          {new Date(game.startedAt).toLocaleDateString()}
                        </span>
                      )}
                      <a
                        href={replayHref}
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-semibold text-sm text-worm-ink hover:text-worm-green whitespace-nowrap"
                      >
                        View replay
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
