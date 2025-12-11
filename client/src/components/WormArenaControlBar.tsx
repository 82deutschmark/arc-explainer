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
}: WormArenaControlBarProps) {
  const handleCurrentClick = React.useCallback(() => onToggleThought(false), [onToggleThought]);
  const handleNextClick = React.useCallback(() => onToggleThought(true), [onToggleThought]);

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

        <div className="text-base font-semibold text-[#3d2817]">
          Round {Math.max(0, currentRound)} / {Math.max(0, totalRounds)}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <span className="text-sm text-muted-foreground">Thoughts show:</span>
        <div className="flex rounded-md border bg-background">
          <Button
            size="sm"
            variant={showNextMove ? 'ghost' : 'default'}
            className="rounded-none first:rounded-l-md"
            onClick={handleCurrentClick}
          >
            Current move
          </Button>
          <Button
            size="sm"
            variant={showNextMove ? 'default' : 'ghost'}
            className="rounded-none last:rounded-r-md"
            onClick={handleNextClick}
          >
            Upcoming move
          </Button>
        </div>
      </div>
    </div>
  );
}
