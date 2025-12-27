/**
 * Author: Cascade
 * Date: 2025-12-20
 * PURPOSE: Worm Arena replay viewer page. Allows selecting a match from
 *          the match list, renders the replay board, and shows per-player
 *          ratings / metadata.
 *          Updated to include Rules navigation link.
 * SRP/DRY check: Pass - page composition only.
 */
/**
 *          Refactored to use extracted utilities, hooks, and components for SRP/DRY compliance.
 *          - Utilities: shared/utils/formatters.ts, shared/utils/wormArenaResults.ts
 *          - Hooks: useQueryParamMatchId, useWormArenaReplayData
 *          - Components: WormArenaPlayerRatingCard, WormArenaReplayViewer
 * SRP/DRY check: Pass - Orchestration only, logic extracted to dedicated modules.
 */

import React from 'react';
import { useSnakeBenchRecentGames, useSnakeBenchGame, useModelRating } from '@/hooks/useSnakeBench';
import { useQueryParamMatchId } from '@/hooks/useQueryParamMatchId';
import { useWormArenaGreatestHits } from '@/hooks/useWormArenaGreatestHits';
import { useIsMobile } from '@/hooks/use-mobile';
import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaStatsPanel from '@/components/WormArenaStatsPanel';
import WormArenaGreatestHits from '@/components/WormArenaGreatestHits';
import WormArenaSuggestedMatchups from '@/components/WormArenaSuggestedMatchups';
import WormArenaPlayerRatingCard from '@/components/WormArenaPlayerRatingCard';
import { WormArenaReplayViewer, type RenderMode } from '@/components/wormArena/WormArenaReplayViewer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { summarizeWormArenaPlacement } from '@shared/utils/wormArenaPlacement.ts';
import {
  buildFinalSummary,
  buildMatchTotalsSummary,
  appendFinalResultIfNeeded,
} from '@shared/utils/wormArenaResults.ts';

export default function WormArena() {
  // URL parameter management (extracted hook)
  const { matchId: initialMatchId, setMatchIdInUrl } = useQueryParamMatchId();
  const isMobile = useIsMobile();

  // Local UI state
  const [selectedMatchId, setSelectedMatchId] = React.useState<string>(initialMatchId ?? '');
  const [frameIndex, setFrameIndex] = React.useState<number>(0);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [showNextMove, setShowNextMove] = React.useState<boolean>(true);
  const [renderMode, setRenderMode] = React.useState<RenderMode>('cartoon');

  // Data fetching hooks
  const { games, total, refresh } = useSnakeBenchRecentGames();
  const { data: replayData, isLoading: loadingReplay, error: replayError, fetchGame } = useSnakeBenchGame(selectedMatchId);
  const { games: greatestHitsGames, isLoading: loadingGreatestHits } = useWormArenaGreatestHits(5);

  // Sync URL parameter changes to selectedMatchId
  React.useEffect(() => {
    if (initialMatchId && initialMatchId !== selectedMatchId) {
      setSelectedMatchId(initialMatchId);
    }
  }, [initialMatchId, selectedMatchId]);

  // Load recent games on mount
  React.useEffect(() => {
    void refresh(10);
  }, [refresh]);

  // Pick a default game if none selected
  React.useEffect(() => {
    if (loadingGreatestHits) return;

    if (!selectedMatchId) {
      let fallbackId = greatestHitsGames[0]?.gameId ?? '';

      if (!fallbackId && games.length > 0) {
        const longGames = games.filter((g) => (g.roundsPlayed ?? 0) >= 20);
        fallbackId = longGames[0]?.gameId ?? games[0]?.gameId ?? '';
      }

      if (fallbackId) {
        setSelectedMatchId(fallbackId);
        setMatchIdInUrl(fallbackId);
      }
    }
  }, [greatestHitsGames, loadingGreatestHits, games, selectedMatchId, setMatchIdInUrl]);

  // Fetch game data when selection changes
  React.useEffect(() => {
    if (!selectedMatchId) return;
    setFrameIndex(0);
    setIsPlaying(false);
    void fetchGame(selectedMatchId);
  }, [selectedMatchId, fetchGame]);

  // Extract frames from replay data
  const frames: any[] = React.useMemo(() => {
    if (replayData && Array.isArray(replayData.frames)) return replayData.frames;
    return [];
  }, [replayData]);

  // Board dimensions
  const boardWidth = replayData?.game?.board?.width ?? 10;
  const boardHeight = replayData?.game?.board?.height ?? 10;

  // Build player labels map
  const playerLabels = React.useMemo(() => {
    const labels: Record<string, string> = {};
    const players = replayData?.players ?? {};
    Object.entries(players).forEach(([sid, player], idx) => {
      const name = (player as any)?.name ?? (player as any)?.model_name ?? (player as any)?.modelName ?? `Snake ${idx + 1}`;
      labels[sid] = String(name);
    });
    return labels;
  }, [replayData]);

  // Reset frame index when frames change
  React.useEffect(() => {
    setFrameIndex(0);
  }, [frames.length]);

  // Autoplay timer
  React.useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    const handle = setInterval(() => {
      setFrameIndex((idx) => {
        if (idx >= frames.length - 1) {
          setIsPlaying(false);
          return idx;
        }
        return idx + 1;
      });
    }, 800);

    return () => clearInterval(handle);
  }, [isPlaying, frames.length]);

  // Start autoplay when frames load
  React.useEffect(() => {
    if (frames.length > 0) {
      setIsPlaying(true);
    }
  }, [frames.length]);

  // Current frame and derived data
  const currentFrame = frames.length > 0 ? frames[Math.min(frameIndex, frames.length - 1)] : null;

  const selectedMeta = games.find((g) => g.gameId === selectedMatchId);
  const models = (replayData?.metadata?.models as string[] | undefined) ?? [];
  const modelA = Array.isArray(models) && models.length > 0 ? models[0] : null;
  const modelB = Array.isArray(models) && models.length > 1 ? models[1] : null;

  // Fetch ratings for both models
  const { rating: ratingA } = useModelRating(modelA ?? undefined);
  const { rating: ratingB } = useModelRating(modelB ?? undefined);

  // Compute placement summaries
  const placementA = React.useMemo(
    () => summarizeWormArenaPlacement(ratingA ?? undefined),
    [ratingA],
  );
  const placementB = React.useMemo(
    () => summarizeWormArenaPlacement(ratingB ?? undefined),
    [ratingB],
  );

  // Scores
  const finalScores = replayData?.metadata?.final_scores ?? replayData?.totals?.scores ?? {};
  const currentScores = currentFrame?.state?.scores ?? replayData?.initial_state?.scores ?? {};
  const startedAt = selectedMeta?.startedAt ?? replayData?.metadata?.start_time ?? replayData?.game?.started_at ?? '';

  // Get current reasoning for a snake
  const getCurrentReasoning = (snakeId: string) => {
    if (!currentFrame?.moves?.[snakeId]) return '';
    return currentFrame.moves[snakeId].rationale || '';
  };

  // Player info
  const playerIds = Object.keys(playerLabels);
  const playerAReasoning = playerIds.length > 0 ? getCurrentReasoning(playerIds[0]) : '';
  const playerBReasoning = playerIds.length > 1 ? getCurrentReasoning(playerIds[1]) : '';
  const playerAName = playerIds.length > 0 ? playerLabels[playerIds[0]] : 'Player A';
  const playerBName = playerIds.length > 1 ? playerLabels[playerIds[1]] : 'Player B';
  const playerAScore = playerIds.length > 0
    ? Number((currentScores as any)[playerIds[0]] ?? (finalScores as any)[playerIds[0]] ?? 0)
    : 0;
  const playerBScore = playerIds.length > 1
    ? Number((currentScores as any)[playerIds[1]] ?? (finalScores as any)[playerIds[1]] ?? 0)
    : 0;

  const isFinalFrame = frames.length > 0 && frameIndex >= frames.length - 1;

  // Build reasoning with final summary appended on last frame (using extracted utilities)
  const playerAReasoningBase = showNextMove && playerIds.length > 0 && !isFinalFrame
    ? (frames[frameIndex + 1]?.moves?.[playerIds[0]]?.rationale || '')
    : playerAReasoning;
  const playerBReasoningBase = showNextMove && playerIds.length > 1 && !isFinalFrame
    ? (frames[frameIndex + 1]?.moves?.[playerIds[1]]?.rationale || '')
    : playerBReasoning;

  const playerAReasoningForPanel = playerIds.length > 0
    ? appendFinalResultIfNeeded(isFinalFrame, playerIds[0], playerAReasoningBase, replayData, frames.length, finalScores)
    : playerAReasoningBase;
  const playerBReasoningForPanel = playerIds.length > 1
    ? appendFinalResultIfNeeded(isFinalFrame, playerIds[1], playerBReasoningBase, replayData, frames.length, finalScores)
    : playerBReasoningBase;

  // Match totals summary (only on final frame)
  const matchTotalsSummary = React.useMemo(() => {
    if (!isFinalFrame) return '';
    return buildMatchTotalsSummary(replayData, frames.length, finalScores, playerLabels);
  }, [isFinalFrame, replayData, frames.length, finalScores, playerLabels]);

  // Matchup label
  const matchupLabel = React.useMemo(() => {
    if (playerIds.length >= 2) {
      return `${playerAName} vs ${playerBName}`;
    }
    if (Array.isArray(models) && models.length === 2) {
      return `${models[0]} vs ${models[1]}`;
    }
    return 'Worm Arena Match';
  }, [playerIds.length, playerAName, playerBName, models]);

  // Clipboard handler
  const handleCopyMatchId = React.useCallback(() => {
    if (!selectedMatchId) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(selectedMatchId).catch(() => {
        // Best-effort copy; ignore errors
      });
    }
  }, [selectedMatchId]);

  return (
    <div className="worm-page">
      <WormArenaHeader
        matchupLabel={matchupLabel}
        totalGames={total}
        links={[
          { label: 'Replay', href: '/worm-arena', active: true },
          { label: 'Live', href: '/worm-arena/live' },
          { label: 'Matches', href: '/worm-arena/matches' },
          { label: 'Models', href: '/worm-arena/models' },
          { label: 'Stats & Placement', href: '/worm-arena/stats' },
          { label: 'Skill Analysis', href: '/worm-arena/skill-analysis' },
          { label: 'Distributions', href: '/worm-arena/distributions' },
          { label: 'Rules', href: '/worm-arena/rules' },
        ]}
        showMatchupLabel={false}
        compact
      />

      <main className="p-4 max-w-7xl mx-auto">
        {/* Match header */}
        {startedAt && (
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-2">{matchupLabel}</h2>
            <p className="text-base text-muted-foreground">
              Match run on {new Date(startedAt).toLocaleString()}
            </p>
          </div>
        )}

        {/* Player rating cards (using extracted component) */}
        {(modelA || modelB) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {modelA && (
              <WormArenaPlayerRatingCard
                model={modelA}
                rating={ratingA}
                placement={placementA}
              />
            )}
            {modelB && (
              <WormArenaPlayerRatingCard
                model={modelB}
                rating={ratingB}
                placement={placementB}
              />
            )}
          </div>
        )}

        {/* Loading state */}
        {loadingReplay && selectedMatchId && (
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-current mb-2" />
              <p className="text-muted-foreground">Loading replay...</p>
            </div>
          </div>
        )}

        {/* Replay viewer (using extracted component) */}
        {!loadingReplay && !replayError && replayData && (
          <WormArenaReplayViewer
            currentFrame={currentFrame}
            boardWidth={boardWidth}
            boardHeight={boardHeight}
            playerLabels={playerLabels}
            frames={frames}
            frameIndex={frameIndex}
            setFrameIndex={setFrameIndex}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            showNextMove={showNextMove}
            setShowNextMove={setShowNextMove}
            renderMode={renderMode}
            setRenderMode={setRenderMode}
            isMobile={isMobile}
            playerAName={playerAName}
            playerBName={playerBName}
            playerAScore={playerAScore}
            playerBScore={playerBScore}
            playerAReasoningForPanel={playerAReasoningForPanel}
            playerBReasoningForPanel={playerBReasoningForPanel}
            currentScores={currentScores as Record<string, number>}
            selectedMatchId={selectedMatchId}
            onCopyMatchId={handleCopyMatchId}
            models={models}
          />
        )}

        {/* Match totals summary (only on final frame) */}
        {matchTotalsSummary && (
          <Card className="worm-card mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-worm-ink">Match totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-mono whitespace-pre-wrap text-worm-ink">{matchTotalsSummary}</div>
            </CardContent>
          </Card>
        )}

        {/* Bottom section: suggested matchups and greatest hits */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <WormArenaSuggestedMatchups limit={8} compact />
          <WormArenaGreatestHits />
        </div>

        {/* Stats panel */}
        <div className="mb-8">
          <WormArenaStatsPanel />
        </div>
      </main>
    </div>
  );
}
