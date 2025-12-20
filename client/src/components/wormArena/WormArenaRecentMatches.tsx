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
import { Badge } from '@/components/ui/badge';
import { useWormArenaRecentMatches } from '@/hooks/useWormArenaRecentMatches';

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
          <div className="max-h-[560px] overflow-y-auto pr-3">
            <div className="space-y-3">
              {matches.map((match) => {
                const resultLabel = match.result.charAt(0).toUpperCase() + match.result.slice(1);
                const scoreLabel = `${match.myScore} - ${match.opponentScore}`;
                const roundsLabel = `${match.roundsPlayed} rounds`;
                const hasCost = match.totalCost > 0;
                const costLabel = hasCost ? `$${match.totalCost.toFixed(2)}` : null;
                const replayHref = `/worm-arena?matchId=${encodeURIComponent(normalizeGameId(match.gameId))}`;

                return (
                  <div
                    key={match.gameId}
                    className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 rounded-md border px-4 py-3 bg-white/80 worm-border"
                  >
                    <div className="space-y-2 min-w-0">
                      {/* Opponent name */}
                      <div className="font-mono text-sm leading-snug">
                        vs <span className="min-w-0 break-words">{match.opponent}</span>
                      </div>

                      {/* Result and Score */}
                      <div className="flex flex-wrap gap-2 text-sm">
                        <Badge
                          variant="outline"
                          className={`font-semibold text-sm px-2 py-1 ${getResultBgClass(match.result)}`}
                        >
                          {resultLabel}
                        </Badge>
                        <Badge variant="outline" className="font-semibold text-sm px-2 py-1">
                          {scoreLabel}
                        </Badge>
                      </div>

                      {/* Metadata badges */}
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
                        {match.deathReason && match.result === 'lost' && (
                          <Badge variant="outline" className="font-semibold text-sm px-2 py-1">
                            {match.deathReason.replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex md:flex-col items-end justify-end gap-2 md:gap-1">
                      {match.startedAt && (
                        <span className="text-sm worm-muted">
                          {formatDate(match.startedAt)}
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
