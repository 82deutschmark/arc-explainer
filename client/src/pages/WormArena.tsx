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
import WormArenaControls from '@/components/WormArenaControls';
import WormArenaGameBoard from '@/components/WormArenaGameBoard';
import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaReasoning from '@/components/WormArenaReasoning';
import WormArenaRecentGames from '@/components/WormArenaRecentGames';

function renderAsciiFrame(frame: any, width: number, height: number, labels: Record<string, string>): string {
  if (!frame) return '';
  const w = Number.isFinite(width) ? Math.max(1, width) : 10;
  const h = Number.isFinite(height) ? Math.max(1, height) : 10;

  const grid: string[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));

  const apples: Array<[number, number]> = frame?.state?.apples ?? [];
  apples.forEach(([x, y]) => {
    if (Number.isFinite(x) && Number.isFinite(y) && y >= 0 && y < h && x >= 0 && x < w) {
      grid[y][x] = '@';
    }
  });

  const snakes: Record<string, Array<[number, number]>> = frame?.state?.snakes ?? {};
  Object.entries(snakes).forEach(([sid, positions], idx) => {
    const display = (labels[sid]?.[0] ?? sid ?? String(idx)).toString();
    positions.forEach((pos, posIdx) => {
      const [x, y] = pos as [number, number];
      if (Number.isFinite(x) && Number.isFinite(y) && y >= 0 && y < h && x >= 0 && x < w) {
        const char = posIdx === 0 ? display.toUpperCase() : display.toLowerCase();
        grid[y][x] = char;
      }
    });
  });

  return grid.map((row) => row.join(' ')).join('\n');
}

export default function WormArena() {
  const [selectedGameId, setSelectedGameId] = React.useState<string>('');
  const [frameIndex, setFrameIndex] = React.useState<number>(0);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [isConfigExpanded, setIsConfigExpanded] = React.useState<boolean>(true);
  const [showNextMove, setShowNextMove] = React.useState<boolean>(true);

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

  const frames: any[] = React.useMemo(() => {
    if (replayData && Array.isArray(replayData.frames)) return replayData.frames;
    return [];
  }, [replayData]);

  const boardWidth = replayData?.game?.board?.width ?? 10;
  const boardHeight = replayData?.game?.board?.height ?? 10;

  const playerLabels = React.useMemo(() => {
    const labels: Record<string, string> = {};
    const players = replayData?.players ?? {};
    Object.entries(players).forEach(([sid, player], idx) => {
      const name = (player as any)?.name ?? (player as any)?.model_name ?? (player as any)?.modelName ?? `Snake ${idx + 1}`;
      labels[sid] = String(name);
    });
    return labels;
  }, [replayData]);

  React.useEffect(() => {
    setFrameIndex(0);
  }, [frames.length]);

  React.useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    const handle = setInterval(() => {
      setFrameIndex((idx) => (idx + 1) % frames.length);
    }, 800);
    return () => clearInterval(handle);
  }, [isPlaying, frames.length]);

  const currentFrame = frames.length > 0 ? frames[Math.min(frameIndex, frames.length - 1)] : null;
  const asciiFrame = React.useMemo(
    () => (currentFrame ? renderAsciiFrame(currentFrame, boardWidth, boardHeight, playerLabels) : ''),
    [currentFrame, boardWidth, boardHeight, playerLabels],
  );

  const selectedMeta = games.find((g) => g.gameId === selectedGameId);
  const models = (replayData?.metadata?.models as string[] | undefined) ?? [];
  const finalScores = replayData?.metadata?.final_scores ?? replayData?.totals?.scores ?? {};
  const roundsPlayed = selectedMeta?.roundsPlayed ?? replayData?.metadata?.actual_rounds ?? replayData?.game?.rounds_played ?? frames.length ?? 0;
  const startedAt = selectedMeta?.startedAt ?? replayData?.metadata?.start_time ?? replayData?.game?.started_at ?? '';

  const getCurrentReasoning = (snakeId: string) => {
    if (!currentFrame?.moves?.[snakeId]) return '';
    return currentFrame.moves[snakeId].rationale || '';
  };

  const playerIds = Object.keys(playerLabels);
  const playerAReasoning = playerIds.length > 0 ? getCurrentReasoning(playerIds[0]) : '';
  const playerBReasoning = playerIds.length > 1 ? getCurrentReasoning(playerIds[1]) : '';
  const playerAName = playerIds.length > 0 ? playerLabels[playerIds[0]] : 'Player A';
  const playerBName = playerIds.length > 1 ? playerLabels[playerIds[1]] : 'Player B';

  const matchupLabel = React.useMemo(() => {
    if (playerIds.length >= 2) {
      return `${playerAName} vs ${playerBName}`;
    }

    if (Array.isArray(models) && models.length === 2) {
      return `${models[0]} vs ${models[1]}`;
    }

    return 'Worm Arena Match';
  }, [playerIds.length, playerAName, playerBName, models]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f1e8', fontFamily: 'Fredoka, Nunito, sans-serif' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <WormArenaHeader matchupLabel={matchupLabel} totalGames={total} />

      <div className="px-8 pt-4">
        <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3" style={{ borderColor: '#d4b5a0' }}>
          <div className="text-lg font-bold flex items-center gap-2" style={{ color: '#3d2817' }}>
            🐛 Replay Controls · {matchupLabel}
          </div>
          <div className="flex-1">
            <WormArenaControls
              modelsLabel={matchupLabel}
              currentRound={frames.length === 0 ? 0 : frameIndex + 1}
              totalRounds={frames.length}
              currentThought={playerAReasoning}
              upcomingThought={playerBReasoning}
              isPlaying={isPlaying}
              isLoading={loadingReplay}
              errorMessage={replayError ? String(replayError) : null}
              canStepBackward={frameIndex > 0}
              canStepForward={frames.length > 0 && frameIndex < frames.length - 1}
              onPlayToggle={() => setIsPlaying((v) => !v)}
              onStepPrevious={() => setFrameIndex((idx) => Math.max(0, idx - 1))}
              onStepNext={() => setFrameIndex((idx) => Math.min(frames.length - 1, idx + 1))}
              onJumpToStart={() => setFrameIndex(0)}
              onJumpToEnd={() => setFrameIndex(Math.max(0, frames.length - 1))}
            />
          </div>
        </div>
      </div>

      <main className="p-8">
        {startedAt && (
          <div className="text-center mb-6">
            <p className="text-base" style={{ color: '#7a6b5f' }}>
              Match run on {new Date(startedAt).toLocaleString()}
            </p>
          </div>
        )}

        <div className="mb-6 flex justify-center gap-4">
          <button
            onClick={() => setShowNextMove(false)}
            className={`px-6 py-2 rounded-full font-semibold transition-all ${
              !showNextMove
                ? 'bg-[#3d2817] text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Current Move
          </button>
          <button
            onClick={() => setShowNextMove(true)}
            className={`px-6 py-2 rounded-full font-semibold transition-all ${
              showNextMove
                ? 'bg-[#3d2817] text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Next Move
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <WormArenaReasoning
            playerName={playerAName}
            color="red"
            reasoning={showNextMove && playerIds.length > 0 ? (frames[frameIndex + 1]?.moves?.[playerIds[0]]?.rationale || '') : playerAReasoning}
            currentRound={frames.length === 0 ? 0 : frameIndex + 1}
            totalRounds={frames.length}
            showNextMove={showNextMove}
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
            reasoning={showNextMove && playerIds.length > 1 ? (frames[frameIndex + 1]?.moves?.[playerIds[1]]?.rationale || '') : playerBReasoning}
            currentRound={frames.length === 0 ? 0 : frameIndex + 1}
            totalRounds={frames.length}
            showNextMove={showNextMove}
          />
        </div>

        <div className="text-center mb-6" style={{ color: '#7a6b5f', fontSize: '17px' }}>
          <div className="flex justify-center gap-6 flex-wrap">
            <span><strong>Scores:</strong> {Object.entries(finalScores).map(([k, v]) => (
              <span key={k} className="ml-2"><span className="font-mono">{k}</span>: {String(v)}</span>
            ))}</span>
            <span><strong>Round:</strong> {frameIndex + 1} / {frames.length}</span>
            <span><strong>Board:</strong> {boardWidth}x{boardHeight}</span>
          </div>
        </div>

        <div className="rounded-lg border" style={{ backgroundColor: '#faf5f0', borderColor: '#d4b5a0' }}>
          <button
            onClick={() => setIsConfigExpanded(!isConfigExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
            style={{ color: '#3d2817' }}
          >
            <span className="font-medium">
              {isConfigExpanded ? '▼' : '▶'} {isConfigExpanded ? 'Hide' : 'Show'} Game Selection
            </span>
          </button>

          {isConfigExpanded && (
            <div className="px-4 pb-4 border-t" style={{ borderColor: '#d4b5a0' }}>
              <WormArenaRecentGames
                games={games}
                selectedGameId={selectedGameId}
                isLoading={loadingGames}
                onSelectGame={setSelectedGameId}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
