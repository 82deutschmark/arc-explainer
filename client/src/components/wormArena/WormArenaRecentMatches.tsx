/**
 * Author: Claude Sonnet 4.5
 * Date: 2025-12-20
 * PURPOSE: Reusable component for displaying recent Worm Arena matches for a specific model.
 *          Fetches match data internally via useWormArenaRecentMatches hook.
 *          Each match is clickable and links to replay viewer.
 *          Follows WormArenaGreatestHits pattern for layout and styling.
 * SRP/DRY check: Pass - single responsibility of displaying recent matches.
 *                Reuses existing API endpoint and types.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useWormArenaRecentMatches } from '@/hooks/useWormArenaRecentMatches';
import WormArenaMatchCard from '@/components/wormArena/WormArenaMatchCard';

function normalizeGameId(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  const withoutExt = trimmed.endsWith('.json') ? trimmed.slice(0, -'.json'.length) : trimmed;
  return withoutExt.startsWith('snake_game_') ? withoutExt.slice('snake_game_'.length) : withoutExt;
}

function formatDate(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      year: '2-digit',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return '-';
  }
}

function getResultBgClass(result: string): string {
  if (result === 'won') return 'bg-green-100 text-green-800';
  if (result === 'lost') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

interface WormArenaRecentMatchesProps {
  modelSlug: string;
  limit?: number;
  className?: string;
}

export default function WormArenaRecentMatches({
  modelSlug,
  limit = 10,
  className,
}: WormArenaRecentMatchesProps) {
  const { matches, isLoading, error } = useWormArenaRecentMatches(modelSlug, limit);

  return (
    <Card className={`worm-card ${className || ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold text-worm-ink">
          Recent Matches
        </CardTitle>
        <p className="text-sm mt-1 worm-muted">
          Latest games for {modelSlug}
        </p>
      </CardHeader>
      <CardContent className="pt-0 text-base text-worm-ink">
        {isLoading && (
          <div className="py-3 text-base worm-muted">
            Loading recent matches…
          </div>
        )}
        {error && !isLoading && (
          <div className="py-3 text-base text-red-700">{error}</div>
        )}
        {!isLoading && !error && matches.length === 0 && (
          <div className="py-3 text-base worm-muted">
            No matches found for {modelSlug}.
          </div>
        )}

        {!isLoading && !error && matches.length > 0 && (
          <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-3">
              {matches.map((match) => (
                <WormArenaMatchCard
                  key={match.gameId}
                  gameId={match.gameId}
                  startedAt={match.startedAt}
                  modelA={modelSlug}
                  modelB={match.opponent}
                  result={match.result}
                  myScore={match.myScore}
                  opponentScore={match.opponentScore}
                  roundsPlayed={match.roundsPlayed}
                  totalCost={match.totalCost}
                  maxFinalScore={Math.max(match.myScore, match.opponentScore)}
                  scoreDelta={Math.abs(match.myScore - match.opponentScore)}
                  deathReason={match.deathReason}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
