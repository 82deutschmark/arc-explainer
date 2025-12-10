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
import WormArenaGameBoard from '@/components/WormArenaGameBoard';
import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaReasoning from '@/components/WormArenaReasoning';
import WormArenaRecentGames from '@/components/WormArenaRecentGames';
import WormArenaStatsPanel from '@/components/WormArenaStatsPanel';
import { WormArenaControlBar } from '@/components/WormArenaControlBar';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

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
  const playerAScore = playerIds.length > 0 ? Number((finalScores as any)[playerIds[0]] ?? 0) : 0;
  const playerBScore = playerIds.length > 1 ? Number((finalScores as any)[playerIds[1]] ?? 0) : 0;

  const matchupLabel = React.useMemo(() => {
    if (playerIds.length >= 2) {
      return `${playerAName} vs ${playerBName}`;
    }

    if (Array.isArray(models) && models.length === 2) {
      return `${models[0]} vs ${models[1]}`;
    }

    return 'Worm Arena Match';
  }, [playerIds.length, playerAName, playerBName, models]);

  const handleCopyMatchId = React.useCallback(() => {
    if (!selectedGameId) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(selectedGameId).catch(() => {
        // Best-effort copy; ignore errors
      });
    }
  }, [selectedGameId]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5e6d3', fontFamily: 'Fredoka, Nunito, sans-serif' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <WormArenaHeader
        matchupLabel={matchupLabel}
        totalGames={total}
        links={[
          { label: 'Replay', href: '/worm-arena', active: true },
          { label: 'Live Games', href: '/worm-arena/live' },
          { label: 'Leaderboards', href: '/leaderboards' },
        ]}
        showMatchupLabel={false}
      />

      <main className="p-8 max-w-7xl mx-auto">
        {startedAt && (
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-2">{matchupLabel}</h2>
            <p className="text-base text-muted-foreground">
              Match run on {new Date(startedAt).toLocaleString()}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 items-start">
          <WormArenaReasoning
            playerName={playerAName}
            color="red"
            reasoning={showNextMove && playerIds.length > 0 ? (frames[frameIndex + 1]?.moves?.[playerIds[0]]?.rationale || '') : playerAReasoning}
            score={playerAScore}
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
            score={playerBScore}
          />
        </div>

        <div className="mb-6">
          <WormArenaControlBar
            onFirst={() => setFrameIndex(0)}
            onPrev={() => setFrameIndex((idx) => Math.max(0, idx - 1))}
            onPlayPause={() => setIsPlaying((v) => !v)}
            onNext={() => setFrameIndex((idx) => Math.min(frames.length - 1, idx + 1))}
            onLast={() => setFrameIndex(Math.max(0, frames.length - 1))}
            isPlaying={isPlaying}
            currentRound={frames.length === 0 ? 0 : frameIndex + 1}
            totalRounds={frames.length}
            showNextMove={showNextMove}
            onToggleThought={setShowNextMove}
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
          {selectedGameId && (
            <div className="mt-2 flex items-center justify-center gap-2 text-sm">
              <span>
                <strong>Match ID:</strong>{' '}
                <span className="font-mono text-xs">{selectedGameId}</span>
              </span>
              <button
                type="button"
                onClick={handleCopyMatchId}
                className="text-xs px-2 py-1 rounded border border-[#d4b5a0] bg-white hover:bg-gray-50"
              >
                Copy
              </button>
            </div>
          )}
        </div>

        <div className="mb-8">
          <WormArenaStatsPanel />
        </div>

        <Accordion type="single" collapsible defaultValue="games" className="mb-4">
          <AccordionItem value="games">
            <AccordionTrigger className="px-4 text-sm font-medium" style={{ color: '#3d2817' }}>
              Browse Recent Games
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-lg border" style={{ backgroundColor: '#faf5f0', borderColor: '#d4b5a0' }}>
                <div className="px-4 pb-4 border-t" style={{ borderColor: '#d4b5a0' }}>
                  <WormArenaRecentGames
                    games={games}
                    selectedGameId={selectedGameId}
                    isLoading={loadingGames}
                    onSelectGame={setSelectedGameId}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </main>
    </div>
  );
}
