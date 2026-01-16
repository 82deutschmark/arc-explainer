/**
 * Author: Cascade
 * Date: 2026-01-16
 * PURPOSE: Worm Arena "Greatest Hits" card with Share/Tweet buttons.
 *          Shows curated epic matches (longest, most expensive, highest-scoring)
 *          and ensures pinned hall-of-fame entries stay in declared order so
 *          keystone replays (like the Grok vs GPT-5.1 duel) always surface first.
 *          Uses overflow container (no Radix ScrollArea) so variable heights render
 *          reliably; replay links open in new tabs to keep the stats page intact.
 * SRP/DRY check: Pass — verified presentational-only update w/ ordered pin merge.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useWormArenaGreatestHits } from '@/hooks/useWormArenaGreatestHits';
import WormArenaMatchCard from '@/components/wormArena/WormArenaMatchCard';
import { PINNED_WORM_ARENA_GAMES } from '@/constants/wormArenaPinnedGames';
import type { WormArenaGreatestHitGame } from '@shared/types';

function normalizeGameId(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  const withoutExt = trimmed.endsWith('.json') ? trimmed.slice(0, -'.json'.length) : trimmed;
  return withoutExt.startsWith('snake_game_') ? withoutExt.slice('snake_game_'.length) : withoutExt;
}

export default function WormArenaGreatestHits() {
  const { games, isLoading, error } = useWormArenaGreatestHits(20);
  const mergedGames = React.useMemo(() => {
    const existingIds = new Set(games.map((g) => g.gameId));
    const pinnedToAdd = PINNED_WORM_ARENA_GAMES.filter((pinned) => !existingIds.has(pinned.gameId));
    return [...pinnedToAdd, ...games];
  }, [games]);

  return (
    <Card className="worm-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold text-black">
          Greatest Hits Matches
        </CardTitle>
        <p className="text-base mt-2 text-gray-800 leading-relaxed">
          Curated Worm Arena games with long runs, high costs, big scores, or monster apple hauls.
        </p>
      </CardHeader>
      <CardContent className="pt-0 text-base text-black">
        {isLoading && (
          <div className="py-3 text-base worm-muted">
            Loading greatest hits
            …
          </div>
        )}
        {error && !isLoading && (
          <div className="py-3 text-base text-red-700">{error}</div>
        )}
        {!isLoading && !error && mergedGames.length === 0 && (
          <div className="py-3 text-base worm-muted">
            No greatest hits yet — run a few matches to discover epic games.
          </div>
        )}

        {!isLoading && !error && mergedGames.length > 0 && (
          <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-3">
              {mergedGames.map((game) => (
                <WormArenaMatchCard
                  key={game.gameId}
                  gameId={game.gameId}
                  startedAt={game.startedAt}
                  modelA={game.modelA}
                  modelB={game.modelB}
                  roundsPlayed={game.roundsPlayed}
                  maxRounds={game.maxRounds}
                  totalCost={game.totalCost}
                  maxFinalScore={game.maxFinalScore}
                  scoreDelta={game.scoreDelta}
                  highlightReason={game.highlightReason}
                  durationSeconds={game.durationSeconds}
                  sumFinalScores={game.sumFinalScores}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
