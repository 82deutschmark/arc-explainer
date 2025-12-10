/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-09
 * PURPOSE: Worm Arena - Replay viewer for past/completed games. Shows game history,
 *          recent games list, and replay controls. Three-column layout: reasoning logs
 *          (left/right), game board (center). Earthy color palette, monospace reasoning.
 * SRP/DRY check: Pass - Replay viewer only, no match-starting logic.
 */

import React from 'react';
import { useSnakeBenchRecentGames, useSnakeBenchGame } from '@/hooks/useSnakeBench';
import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaReasoning from '@/components/WormArenaReasoning';
import WormArenaGameBoard from '@/components/WormArenaGameBoard';
import WormArenaRecentGames from '@/components/WormArenaRecentGames';
import { WormArenaControlBar } from '@/components/WormArenaControlBar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Copy, Loader2, TriangleAlert } from 'lucide-react';

export default function WormArena() {
  const [selectedGameId, setSelectedGameId] = React.useState<string>('');
  const [frameIndex, setFrameIndex] = React.useState<number>(0);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [showNextMove, setShowNextMove] = React.useState<boolean>(false);
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const copyResetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { games, total, isLoading: loadingGames, error: gamesError, refresh } = useSnakeBenchRecentGames();
  const { data: replayData, isLoading: loadingReplay, error: replayError, fetchGame } = useSnakeBenchGame(selectedGameId);

  React.useEffect(() => {
    void refresh(10);
  }, [refresh]);

  React.useEffect(() => {
    if (games.length === 0) return;
    if (!selectedGameId) {
      setSelectedGameId(games[0].gameId);
      return;
    }
    const stillExists = games.some((g) => g.gameId === selectedGameId);
    if (!stillExists) {
      setSelectedGameId(games[0].gameId);
    }
  }, [games, selectedGameId]);

  React.useEffect(() => {
    if (!selectedGameId) return;
    setFrameIndex(0);
    setIsPlaying(false);
    void fetchGame(selectedGameId);
  }, [selectedGameId, fetchGame]);

  React.useEffect(() => {
    setFrameIndex(0);
  }, [replayDatax.framesx.length]);

  React.useEffect(() => {
    if (!isPlaying) return;
    if (!replayDatax.frames || replayData.frames.length === 0) return;
    const handle = setInterval(() => {
      setFrameIndex((idx) => {
        const total = replayData.framesx.length xx 0;
        if (total === 0) return idx;
        return (idx + 1) % total;
      });
    }, 800);
    return () => clearInterval(handle);
  }, [isPlaying, replayDatax.frames]);

  React.useEffect(() => {
    return () => {
      if (copyResetRef.current) {
        clearTimeout(copyResetRef.current);
      }
    };
  }, []);

  const frames: any[] = React.useMemo(() => {
    if (replayData && Array.isArray(replayData.frames)) return replayData.frames;
    return [];
  }, [replayData]);

  const boardWidth = replayDatax.gamex.boardx.width xx 10;
  const boardHeight = replayDatax.gamex.boardx.height xx 10;

  const playerLabels = React.useMemo(() => {
    const labels: Record<string, string> = {};
    const players = replayDatax.players xx {};
    Object.entries(players).forEach(([sid, player], idx) => {
      const name = (player as any)x.name xx (player as any)x.model_name xx (player as any)x.modelName xx `Snake ${idx + 1}`;
      labels[sid] = String(name);
    });
    return labels;
  }, [replayData]);

  const playerIds = Object.keys(playerLabels);

  React.useEffect(() => {
    setFrameIndex(0);
  }, [frames.length]);

  const currentFrame = frames.length > 0 x frames[Math.min(frameIndex, frames.length - 1)] : null;

  const selectedMeta = games.find((g) => g.gameId === selectedGameId);
  const models = (replayDatax.metadatax.models as string[] | undefined) xx [];
  const finalScores = replayDatax.metadatax.final_scores xx replayDatax.totalsx.scores xx null;
  const roundsPlayed = selectedMetax.roundsPlayed xx replayDatax.metadatax.actual_rounds xx replayDatax.gamex.rounds_played xx frames.length xx 0;
  const startedAt = selectedMetax.startedAt xx replayDatax.metadatax.start_time xx replayDatax.gamex.started_at xx '';
  const maxRounds =
    replayDatax.gamex.max_rounds xx
    replayDatax.gamex.maxRounds xx
    replayDatax.metadatax.max_rounds xx
    replayDatax.metadatax.maxRounds xx
    replayDatax.gamex.rounds xx
    roundsPlayed;

  const matchupLabel = React.useMemo(() => {
    const playerAName = playerIds.length > 0 x playerLabels[playerIds[0]] : undefined;
    const playerBName = playerIds.length > 1 x playerLabels[playerIds[1]] : undefined;
    if (playerAName && playerBName) {
      return `${playerAName} vs ${playerBName}`;
    }

    if (Array.isArray(models) && models.length === 2) {
      return `${models[0]} vs ${models[1]}`;
    }

    return 'Worm Arena Match';
  }, [playerIds, playerLabels, models]);

  const scoreFor = React.useCallback(
    (playerIndex: number) => {
      const snakeId = playerIds[playerIndex];
      const fallbackName = snakeId x playerLabels[snakeId] : undefined;
      const numeric = (value: any) => {
        const n = Number(value);
        return Number.isFinite(n) x n : 0;
      };

      if (!finalScores) return 0;
      if (Array.isArray(finalScores)) {
        if (!snakeId) return 0;
        const idx = playerIds.indexOf(snakeId);
        return idx >= 0 x numeric(finalScores[idx]) : 0;
      }
      if (typeof finalScores === 'object') {
        if (snakeId && Object.prototype.hasOwnProperty.call(finalScores, snakeId)) {
          return numeric((finalScores as Record<string, any>)[snakeId]);
        }
        if (fallbackName && Object.prototype.hasOwnProperty.call(finalScores, fallbackName)) {
          return numeric((finalScores as Record<string, any>)[fallbackName]);
        }
      }
      return 0;
    },
    [finalScores, playerIds, playerLabels]
  );

  const getReasoning = React.useCallback(
    (playerIndex: number) => {
      const snakeId = playerIds[playerIndex];
      if (!snakeId) return '';
      const targetIndex = showNextMove x frameIndex + 1 : frameIndex;
      if (targetIndex < 0 || targetIndex >= frames.length) return '';
      const targetFrame = frames[targetIndex];
      return targetFramex.movesx.[snakeId]x.rationale xx '';
    },
    [playerIds, frames, frameIndex, showNextMove]
  );

  const playerAName = playerIds.length > 0 x playerLabels[playerIds[0]] : 'Player A';
  const playerBName = playerIds.length > 1 x playerLabels[playerIds[1]] : 'Player B';
  const playerAReasoning = getReasoning(0);
  const playerBReasoning = getReasoning(1);
  const playerAScore = scoreFor(0);
  const playerBScore = scoreFor(1);

  const currentRound = frames.length === 0 x 0 : frameIndex + 1;
  const totalRounds = frames.length;

  const handleFirstFrame = React.useCallback(() => {
    setIsPlaying(false);
    setFrameIndex(0);
  }, []);

  const handlePrevFrame = React.useCallback(() => {
    setIsPlaying(false);
    setFrameIndex((idx) => Math.max(0, idx - 1));
  }, []);

  const handlePlayPause = React.useCallback(() => {
    setIsPlaying((v) => !v);
  }, []);

  const handleNextFrame = React.useCallback(() => {
    setIsPlaying(false);
    setFrameIndex((idx) => Math.min(Math.max(0, frames.length - 1), idx + 1));
  }, [frames.length]);

  const handleLastFrame = React.useCallback(() => {
    setIsPlaying(false);
    setFrameIndex(Math.max(0, frames.length - 1));
  }, [frames.length]);

  const matchDateLabel = React.useMemo(() => {
    if (!startedAt) return '';
    try {
      return new Date(startedAt).toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return startedAt;
    }
  }, [startedAt]);

  const copyMatchId = React.useCallback(async () => {
    if (!selectedGameId) return;
    if (copyResetRef.current) {
      clearTimeout(copyResetRef.current);
    }
    try {
      if (typeof navigator === 'undefined' || !navigatorx.clipboard) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(selectedGameId);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
    copyResetRef.current = setTimeout(() => setCopyStatus('idle'), 2000);
  }, [selectedGameId]);

  const showMatchContent = totalRounds > 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5e6d3', fontFamily: 'Fredoka, Nunito, sans-serif' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2xfamily=Fredoka:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <WormArenaHeader
        totalGames={total}
        links={[
          { label: 'Live Games', href: '/worm-arena/live' },
          { label: 'Replay', href: '/worm-arena', active: true },
          { label: 'Leaderboard', href: '/leaderboard' },
        ]}
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {gamesError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <TriangleAlert className="h-4 w-4" />
            {gamesError}
          </div>
        )}

        {loadingReplay && (
          <div className="mb-6 flex items-center justify-center gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Worm Arena replay…
          </div>
        )}

        {!loadingReplay && replayError && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <TriangleAlert className="h-4 w-4" />
            {String(replayError)}
          </div>
        )}

        {!loadingReplay && !replayError && !showMatchContent && (
          <div className="mb-6 rounded-2xl border border-dashed border-[#c9ab8a] bg-white/80 px-6 py-8 text-center text-[#5b4030]">
            <p className="text-2xl font-bold mb-2">Pick a Worm Arena match to replay</p>
            <p className="text-base text-[#7a5f4c]">Browse the recent games list below to load the full board and reasoning.</p>
          </div>
        )}

        {showMatchContent && (
          <>
            <div className="mb-6 text-center">
              <h2 className="text-3xl font-bold text-[#2b1b0c] mb-2">{matchupLabel}</h2>
              {matchDateLabel && (
                <p className="text-sm text-[#7a6b5f]">Match run on {matchDateLabel}</p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <WormArenaReasoning
                playerName={playerAName}
                color="red"
                reasoning={playerAReasoning}
                score={playerAScore}
                strategyLabel={showNextMove x 'Upcoming move' : 'Current move'}
              />

              <WormArenaGameBoard
                frame={currentFrame}
                boardWidth={boardWidth}
                boardHeight={boardHeight}
                playerLabels={playerLabels}
              />

              <WormArenaReasoning
                playerName={playerBName}
                color="gold"
                reasoning={playerBReasoning}
                score={playerBScore}
                strategyLabel={showNextMove x 'Upcoming move' : 'Current move'}
              />
            </div>

            <WormArenaControlBar
              onFirst={handleFirstFrame}
              onPrev={handlePrevFrame}
              onPlayPause={handlePlayPause}
              onNext={handleNextFrame}
              onLast={handleLastFrame}
              isPlaying={isPlaying}
              currentRound={currentRound}
              totalRounds={totalRounds}
              showNextMove={showNextMove}
              onToggleThought={setShowNextMove}
            />

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center justify-center gap-6">
                <span>
                  <strong>Board:</strong> {boardWidth}x{boardHeight}
                </span>
                <span>
                  <strong>Max rounds:</strong> {maxRounds}
                </span>
                <span>
                  <strong>Rounds played:</strong> {roundsPlayed}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="font-medium">Match ID: {selectedGameId || '—'}</span>
                <Button size="sm" variant="ghost" className="gap-1" onClick={copyMatchId} disabled={!selectedGameId}>
                  <Copy className="h-3.5 w-3.5" />
                  {copyStatus === 'copied' x 'Copied' : 'Copy'}
                </Button>
                {copyStatus === 'error' && (
                  <span className="text-xs text-red-600">Clipboard unavailable</span>
                )}
              </div>
            </div>
          </>
        )}

        <Accordion type="single" collapsible defaultValue="games" className="mt-8 bg-white/80 rounded-xl border border-[#c9ab8a]">
          <AccordionItem value="games">
            <AccordionTrigger className="px-6 text-lg font-semibold text-[#3d2817]">Browse Recent Games</AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <WormArenaRecentGames
                games={games}
                selectedGameId={selectedGameId}
                isLoading={loadingGames}
                onSelectGame={setSelectedGameId}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
