/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Worm Arena "Suggested Matchups" card.
 *          Shows interesting unplayed model pairings with two scoring modes:
 *          - Ladder: maximize ranking info gain (high uncertainty, close ratings)
 *          - Entertainment: maximize watchability (close fights, high stakes)
 *          Each suggestion shows TrueSkill stats and explanation reasons.
 *          One-click "Run Match" button starts the matchup via the live page.
 * SRP/DRY check: Pass - purely presentational; data comes from hook.
 */

import React from 'react';
import { useLocation } from 'wouter';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Trophy, RefreshCw, Play } from 'lucide-react';
import { useWormArenaSuggestMatchups } from '@/hooks/useWormArenaSuggestMatchups';
import type { WormArenaSuggestMode, WormArenaSuggestedMatchup } from '@shared/types';

interface WormArenaSuggestedMatchupsProps {
  /** Maximum number of suggestions to show */
  limit?: number;
  /** Called when user clicks "Run Match" - receives modelA and modelB slugs */
  onRunMatch?: (modelA: string, modelB: string) => void;
  /** If true, shows compact version without full descriptions */
  compact?: boolean;
  /** Optional curated suggestions to override backend list */
  overrideMatchups?: WormArenaSuggestedMatchup[];
}

export default function WormArenaSuggestedMatchups({
  limit = 10,
  onRunMatch,
  compact = false,
  overrideMatchups,
}: WormArenaSuggestedMatchupsProps) {
  const [, setLocation] = useLocation();
  const { matchups, mode, totalCandidates, isLoading, error, refresh } =
    useWormArenaSuggestMatchups('ladder', limit);

  const handleModeToggle = React.useCallback(() => {
    const newMode: WormArenaSuggestMode = mode === 'ladder' ? 'entertainment' : 'ladder';
    void refresh(newMode);
  }, [mode, refresh]);

  const handleRunMatch = React.useCallback(
    (modelA: string, modelB: string) => {
      if (onRunMatch) {
        onRunMatch(modelA, modelB);
      } else {
        // Default: navigate to live page with pre-filled models in a new tab
        const params = new URLSearchParams({
          modelA,
          modelB,
          autoStart: 'true',
        });
        const href = `/worm-arena/live?${params.toString()}`;
        window.open(href, '_blank');
      }
    },
    [onRunMatch, setLocation],
  );

  const modeLabel = mode === 'ladder' ? 'Ladder Quality' : 'Entertainment';
  const modeDescription =
    mode === 'ladder'
      ? 'Prioritizes matches that will improve ranking accuracy (high uncertainty, close ratings).'
      : 'Prioritizes exciting matches to watch (close fights, high stakes, upset potential).';

  const activeMatchups = overrideMatchups?.slice(0, limit) ?? matchups;
  const hasOverride = Array.isArray(overrideMatchups);

  return (
    <Card className="worm-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-xl font-bold text-worm-ink">
            Suggested Matchups
          </CardTitle>
          {!hasOverride && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleModeToggle}
                disabled={isLoading}
                className="gap-1.5 text-sm"
              >
                {mode === 'ladder' ? (
                  <Trophy className="w-4 h-4" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {modeLabel}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refresh()}
                disabled={isLoading}
                className="h-8 w-8"
                title="Refresh suggestions"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          )}
        </div>
        {!compact && !hasOverride && (
          <p className="text-sm mt-2 worm-muted">{modeDescription}</p>
        )}
        {!hasOverride && totalCandidates > 0 && (
          <p className="text-xs mt-1 worm-muted">
            {totalCandidates.toLocaleString()} unplayed pairings available
          </p>
        )}
        {hasOverride && (
          <p className="text-xs mt-1 worm-muted">
            Curated matchups (live tournament set)
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0 text-base text-worm-ink">
        {!hasOverride && isLoading && (
          <div className="py-4 text-base worm-muted flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Finding interesting matchups...
          </div>
        )}

        {!hasOverride && error && !isLoading && (
          <div className="py-3 text-base text-red-700">{error}</div>
        )}

        {!isLoading && !error && activeMatchups.length === 0 && (
          <div className="py-4 text-base worm-muted">
            No unplayed matchups found. All model pairs have already competed!
          </div>
        )}

        {!isLoading && !error && activeMatchups.length > 0 && (
          <div className="max-h-[480px] overflow-y-auto pr-2">
            <div className="space-y-3">
              {activeMatchups.map((matchup, idx) => {
                const { modelA, modelB, reasons, score } = matchup;

                return (
                  <div
                    key={`${modelA.modelSlug}-${modelB.modelSlug}-${idx}`}
                    className="rounded-md border px-4 py-3 bg-white/80 worm-border hover:bg-white/95 transition-colors"
                  >
                    {/* Matchup header */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm leading-snug">
                          <div className="flex gap-2 items-baseline">
                            <span className="shrink-0 worm-muted text-xs">A:</span>
                            <span className="min-w-0 break-words font-medium">
                              {modelA.modelSlug}
                            </span>
                          </div>
                          <div className="flex gap-2 items-baseline">
                            <span className="shrink-0 worm-muted text-xs">B:</span>
                            <span className="min-w-0 break-words font-medium">
                              {modelB.modelSlug}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleRunMatch(modelA.modelSlug, modelB.modelSlug)}
                        className="shrink-0 gap-1.5 bg-worm-green hover:bg-worm-green-hover text-worm-green-ink"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Run
                      </Button>
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-2 text-xs mb-2">
                      <Badge
                        variant="outline"
                        className="font-mono px-1.5 py-0.5"
                        title={`Model A: mu=${modelA.mu.toFixed(1)}, sigma=${modelA.sigma.toFixed(1)}`}
                      >
                        A: {modelA.exposed.toFixed(1)} ({modelA.gamesPlayed}g)
                      </Badge>
                      <Badge
                        variant="outline"
                        className="font-mono px-1.5 py-0.5"
                        title={`Model B: mu=${modelB.mu.toFixed(1)}, sigma=${modelB.sigma.toFixed(1)}`}
                      >
                        B: {modelB.exposed.toFixed(1)} ({modelB.gamesPlayed}g)
                      </Badge>
                      {!compact && (
                        <Badge
                          variant="secondary"
                          className="font-mono px-1.5 py-0.5 text-xs"
                          title="Suggestion score (higher = more interesting)"
                        >
                          Score: {score}
                        </Badge>
                      )}
                    </div>

                    {/* Reasons */}
                    <div className="flex flex-wrap gap-1.5">
                      {reasons.map((reason, ridx) => (
                        <span
                          key={ridx}
                          className="inline-block text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200"
                        >
                          {reason}
                        </span>
                      ))}
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
