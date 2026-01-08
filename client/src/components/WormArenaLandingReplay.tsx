/**
 * Author: Cascade (OpenAI o4-preview)
 * Date: 2026-01-08T21:25:00Z
 * PURPOSE: Lightweight Worm Arena replay preview for the landing hero.
 *          Renders a trimmed subset of frames with emoji board visuals,
 *          minimal controls, and matchup metadata for curated matches.
 * SRP/DRY check: Pass — dedicated to landing-only replay display while reusing
 *                existing Worm Arena board renderer and shared styles.
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { WormArenaGreatestHitGame } from '@shared/types';
import { Pause, Play, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import WormArenaGameBoard from '@/components/WormArenaGameBoard';

const FRAME_INTERVAL_MS = 700;
const MAX_LANDING_FRAMES = 60;

interface WormArenaLandingReplayProps {
  game?: WormArenaGreatestHitGame;
  replayData?: any | null;
  isLoading: boolean;
  error?: string | null;
  autoPlay?: boolean;
  className?: string;
  onReplayComplete?: () => void;
}

export const WormArenaLandingReplay: React.FC<WormArenaLandingReplayProps> = ({
  game,
  replayData,
  isLoading,
  error,
  autoPlay = true,
  className,
  onReplayComplete,
}) => {
  const frames = useMemo(() => {
    if (!replayData?.frames || !Array.isArray(replayData.frames)) {
      return [];
    }
    return replayData.frames.slice(0, MAX_LANDING_FRAMES);
  }, [replayData]);

  const boardWidth =
    replayData?.game?.board?.width ?? game?.boardWidth ?? 10;
  const boardHeight =
    replayData?.game?.board?.height ?? game?.boardHeight ?? 10;

  const playerLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    if (replayData?.players) {
      Object.entries(replayData.players).forEach(([sid, info], idx) => {
        const name =
          (info as any)?.name ??
          (info as any)?.model_name ??
          (info as any)?.modelName ??
          `Snake ${idx + 1}`;
        labels[sid] = String(name);
      });
    }
    return labels;
  }, [replayData]);

  const playerIds = Object.keys(playerLabels);
  const defaultA = game?.modelA ?? 'Snake A';
  const defaultB = game?.modelB ?? 'Snake B';
  const playerAName = playerIds.length > 0 ? playerLabels[playerIds[0]] : defaultA;
  const playerBName = playerIds.length > 1 ? playerLabels[playerIds[1]] : defaultB;

  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  const currentFrame =
    frames.length > 0 ? frames[Math.min(frameIndex, frames.length - 1)] : null;

  const currentScores =
    currentFrame?.state?.scores ??
    replayData?.metadata?.final_scores ??
    replayData?.totals?.scores ??
    {};

  const playerAScore =
    (playerIds.length > 0 && Number(currentScores[playerIds[0]])) || 0;
  const playerBScore =
    (playerIds.length > 1 && Number(currentScores[playerIds[1]])) || 0;

  useEffect(() => {
    setFrameIndex(0);
    setIsPlaying(autoPlay && frames.length > 1);
  }, [autoPlay, frames.length]);

  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
      return undefined;
    }

    const handle = window.setInterval(() => {
      setFrameIndex((prev) => {
        if (prev >= frames.length - 1) {
          setIsPlaying(false);
          onReplayComplete?.();
          return prev;
        }
        return prev + 1;
      });
    }, FRAME_INTERVAL_MS);

    return () => window.clearInterval(handle);
  }, [frames.length, isPlaying, onReplayComplete]);

  const handleTogglePlay = () => {
    if (frames.length === 0) return;
    setIsPlaying((prev) => !prev);
  };

  const handleReset = () => {
    setFrameIndex(0);
    setIsPlaying(autoPlay && frames.length > 1);
  };

  const matchupLabel = game
    ? `${game.modelA ?? 'Model A'} vs ${game.modelB ?? 'Model B'}`
    : 'Worm Arena Match';

  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-[1.25rem] bg-gradient-to-b from-[#110f14] via-[#0b0a0f] to-[#07060c] p-5 text-white shadow-2xl',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-amber-200/70">
          Worm Arena
        </p>
        <p className="text-lg font-semibold">{matchupLabel}</p>
        {game?.highlightReason && (
          <p className="text-xs text-amber-100/70">{game.highlightReason}</p>
        )}
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-4">
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-amber-200/10 bg-black/40 p-3">
          {isLoading && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-amber-200/80">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-amber-200" />
              Loading replay…
            </div>
          )}

          {!isLoading && error && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-red-200">
              <span>Failed to load Worm Arena match.</span>
              <span className="text-red-300/80">{error}</span>
            </div>
          )}

          {!isLoading && !error && frames.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-amber-100/70">
              No frames available for this replay.
            </div>
          )}

          {!isLoading && !error && frames.length > 0 && (
            <>
              <WormArenaGameBoard
                frame={currentFrame}
                boardWidth={boardWidth}
                boardHeight={boardHeight}
                playerLabels={playerLabels}
              />
              <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-mono">
                Round {frameIndex + 1}/{frames.length}
              </div>
              <div className="pointer-events-none absolute right-4 top-4 rounded-lg bg-black/70 px-3 py-2 text-right text-xs font-medium">
                <div className="text-amber-200">
                  {playerAName}: {playerAScore}
                </div>
                <div className="text-blue-200">
                  {playerBName}: {playerBScore}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-amber-100/80">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 border-amber-200/40 text-amber-200"
              onClick={handleReset}
              disabled={frames.length === 0}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="default"
              className="h-8 w-8 bg-amber-400 text-black hover:bg-amber-300"
              onClick={handleTogglePlay}
              disabled={frames.length === 0}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          </div>

          {game?.gameId && (
            <div className="text-[0.6rem] font-mono uppercase tracking-wide text-amber-100/60">
              Match ID: {game.gameId.slice(0, 8)}…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WormArenaLandingReplay;
