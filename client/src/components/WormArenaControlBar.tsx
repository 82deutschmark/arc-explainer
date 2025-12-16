/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-10
 * PURPOSE: Compact horizontal playback control bar for Worm Arena replays.
 *          Provides match playback buttons, round indicator, and reasoning toggle.
 * SRP/DRY check: Pass - handles replay controls only, no reasoning duplication.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pause, Play } from 'lucide-react';

export interface WormArenaControlBarProps {
  onFirst: () => void;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onLast: () => void;
  isPlaying: boolean;
  currentRound: number;
  totalRounds: number;
  showNextMove: boolean;
  onToggleThought: (show: boolean) => void;
  playerALabel?: string;
  playerBLabel?: string;
  playerAScore?: number;
  playerBScore?: number;
  matchId?: string | null;
  onCopyMatchId?: () => void;
  statsModels?: string[];
}

export function WormArenaControlBar({
  onFirst,
  onPrev,
  onPlayPause,
  onNext,
  onLast,
  isPlaying,
  currentRound,
  totalRounds,
  showNextMove,
  onToggleThought,
  playerALabel,
  playerBLabel,
  playerAScore,
  playerBScore,
  matchId,
  onCopyMatchId,
  statsModels,
}: WormArenaControlBarProps) {
  const handleCurrentClick = React.useCallback(() => onToggleThought(false), [onToggleThought]);
  const handleNextClick = React.useCallback(() => onToggleThought(true), [onToggleThought]);
  const canShowScores = playerALabel && playerBLabel;
  const canShowMatchId = matchId && typeof onCopyMatchId === 'function';

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/80 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onFirst} aria-label="Jump to first round">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onPrev} aria-label="Previous round">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={onPlayPause} aria-label={isPlaying ? 'Pause replay' : 'Play replay'}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={onNext} aria-label="Next round">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onLast} aria-label="Jump to last round">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-base font-semibold text-worm-ink">
          Round {Math.max(0, currentRound)} / {Math.max(0, totalRounds)}
        </div>
      </div>

      {(canShowScores || canShowMatchId) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {canShowScores && (
            <div className="text-sm font-semibold text-worm-ink flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-muted-foreground font-medium">Scores:</span>
              <span className="text-worm-green">
                {playerALabel}: {Number.isFinite(playerAScore) ? Math.max(0, Math.floor(playerAScore ?? 0)) : 0}
              </span>
              <span className="text-worm-blue">
                {playerBLabel}: {Number.isFinite(playerBScore) ? Math.max(0, Math.floor(playerBScore ?? 0)) : 0}
              </span>
            </div>
          )}

          {canShowMatchId && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-worm-ink">Match ID:</span>
              <span className="font-mono">{matchId}</span>
              <Button size="sm" variant="outline" onClick={onCopyMatchId}>
                Copy
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <span className="text-sm text-muted-foreground">Reasoning shown:</span>
        <div className="flex rounded-md border bg-background overflow-hidden">
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={!showNextMove}
            className={`rounded-none first:rounded-l-md ${!showNextMove ? 'bg-worm-blue text-white hover:bg-worm-blue-hover' : 'text-worm-ink hover:bg-muted'}`}
            onClick={handleCurrentClick}
          >
            This move
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={showNextMove}
            className={`rounded-none last:rounded-r-md ${showNextMove ? 'bg-worm-blue text-white hover:bg-worm-blue-hover' : 'text-worm-ink hover:bg-muted'}`}
            onClick={handleNextClick}
          >
            Next move
          </Button>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        This move uses the current round. Next move previews the upcoming round.
      </div>

      {Array.isArray(statsModels) && statsModels.length > 0 && (
        <div className="text-xs flex flex-wrap justify-center gap-2">
          <span className="text-muted-foreground">View stats:</span>
          {statsModels.map((slug) => (
            <a key={slug} href={`/worm-arena/stats?model=${encodeURIComponent(slug)}`} className="underline font-mono">
              {slug}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
