/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-09
 * PURPOSE: Worm Arena - Replay viewer for past/completed games. Shows game history,
 *          recent games list, and replay controls. Three-column layout: reasoning logs
 *          (left/right), game board (center). Earthy color palette, monospace reasoning.
 * SRP/DRY check: Pass - Replay viewer only, no match-starting logic.
 */

import React from 'react';
import { useLocation } from 'wouter';
import { useSnakeBenchRecentGames, useSnakeBenchGame, useModelRating } from '@/hooks/useSnakeBench';
import WormArenaGameBoard from '@/components/WormArenaGameBoard';
import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaReasoning from '@/components/WormArenaReasoning';
import WormArenaStatsPanel from '@/components/WormArenaStatsPanel';
import WormArenaGreatestHits from '@/components/WormArenaGreatestHits';
import { WormArenaControlBar } from '@/components/WormArenaControlBar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { summarizeWormArenaPlacement } from '@shared/utils/wormArenaPlacement.ts';

function useQueryParamMatchId(): { matchId: string | null; setMatchIdInUrl: (id: string) => void } {
  const [location, setLocation] = useLocation();

  const matchId = React.useMemo(() => {
    try {
      const query = (() => {
        if (typeof window !== 'undefined' && typeof window.location?.search === 'string') {
          const raw = window.location.search;
          return raw.startsWith('?') ? raw.slice(1) : raw;
        }

        const idx = location.indexOf('?');
        return idx >= 0 ? location.slice(idx + 1) : '';
      })();
      if (!query) return null;
      const params = new URLSearchParams(query);
      const raw = params.get('matchId') ?? params.get('gameId');
      const trimmed = raw?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : null;
    } catch {
      return null;
    }
  }, [location]);

  const setMatchIdInUrl = React.useCallback(
    (id: string) => {
      const trimmed = id.trim();
      if (!trimmed) {
        setLocation('/worm-arena');
        return;
      }

      const encoded = encodeURIComponent(trimmed);
      setLocation(`/worm-arena?matchId=${encoded}`);
    },
    [setLocation],
  );

  return { matchId, setMatchIdInUrl };
}

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
  const { matchId: initialMatchId, setMatchIdInUrl } = useQueryParamMatchId();

  const [selectedMatchId, setSelectedMatchId] = React.useState<string>(initialMatchId ?? '');
  const [frameIndex, setFrameIndex] = React.useState<number>(0);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [showNextMove, setShowNextMove] = React.useState<boolean>(true);

  const { games, total, refresh } = useSnakeBenchRecentGames();
  const { data: replayData, isLoading: loadingReplay, error: replayError, fetchGame } = useSnakeBenchGame(selectedMatchId);

  // Sync URL parameter changes to selectedMatchId
  React.useEffect(() => {
    if (initialMatchId && initialMatchId !== selectedMatchId) {
      setSelectedMatchId(initialMatchId);
    }
  }, [initialMatchId, selectedMatchId]);

  React.useEffect(() => {
    void refresh(10);
  }, [refresh]);

  // Effect: Pick a default game only if none is selected (no URL param, no state set)
  // If a matchId is in the URL or state, trust it and let the API fetch handle validation
  React.useEffect(() => {
    if (games.length === 0) return;

    // Only pick fallback if no game is currently selected
    if (!selectedMatchId) {
      const longGames = games.filter((g) => (g.roundsPlayed ?? 0) >= 20);
      const fallbackId = longGames[0]?.gameId ?? games[0]?.gameId ?? '';

      if (fallbackId) {
        setSelectedMatchId(fallbackId);
        setMatchIdInUrl(fallbackId);
      }
    }
    // For URL-provided matchIds: trust them completely. The API fetch will handle
    // invalid/missing games gracefully with errors shown to the user.
  }, [games, selectedMatchId, setMatchIdInUrl]);

  React.useEffect(() => {
    if (!selectedMatchId) return;
    setFrameIndex(0);
    setIsPlaying(false);
    void fetchGame(selectedMatchId);
  }, [selectedMatchId, fetchGame]);

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
      setFrameIndex((idx) => {
        if (idx >= frames.length - 1) {
          // Stop autoplay on the final frame instead of looping
          setIsPlaying(false);
          return idx;
        }
        return idx + 1;
      });
    }, 800);

    return () => clearInterval(handle);
  }, [isPlaying, frames.length]);

  React.useEffect(() => {
    if (frames.length > 0) {
      setIsPlaying(true);
    }
  }, [frames.length]);

  const currentFrame = frames.length > 0 ? frames[Math.min(frameIndex, frames.length - 1)] : null;
  const asciiFrame = React.useMemo(
    () => (currentFrame ? renderAsciiFrame(currentFrame, boardWidth, boardHeight, playerLabels) : ''),
    [currentFrame, boardWidth, boardHeight, playerLabels],
  );

  const selectedMeta = games.find((g) => g.gameId === selectedMatchId);
  const models = (replayData?.metadata?.models as string[] | undefined) ?? [];
  const modelA = Array.isArray(models) && models.length > 0 ? models[0] : null;
  const modelB = Array.isArray(models) && models.length > 1 ? models[1] : null;

  const { rating: ratingA } = useModelRating(modelA ?? undefined);
  const { rating: ratingB } = useModelRating(modelB ?? undefined);

  const placementA = React.useMemo(
    () => summarizeWormArenaPlacement(ratingA ?? undefined),
    [ratingA],
  );
  const placementB = React.useMemo(
    () => summarizeWormArenaPlacement(ratingB ?? undefined),
    [ratingB],
  );
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
    if (!selectedMatchId) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(selectedMatchId).catch(() => {
        // Best-effort copy; ignore errors
      });
    }
  }, [selectedMatchId]);

  const handleSelectMatch = React.useCallback(
    (id: string) => {
      const trimmed = id.trim();
      if (!trimmed) return;
      setSelectedMatchId(trimmed);
      setMatchIdInUrl(trimmed);
    },
    [setMatchIdInUrl],
  );

  return (
    <div className="worm-page">

      <WormArenaHeader
        matchupLabel={matchupLabel}
        totalGames={total}
        links={[
          { label: 'Replay', href: '/worm-arena', active: true },
          { label: 'Live', href: '/worm-arena/live' },
          { label: 'Stats & Placement', href: '/worm-arena/stats' },
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

        {(modelA || modelB) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {modelA && ratingA && (
              <Card className="worm-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-worm-ink">
                    {modelA}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-worm-ink">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Pessimistic rating</span>
                    <span className="worm-pill-green px-2 py-0.5 text-base">
                      {ratingA.exposed.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span>Games: {ratingA.gamesPlayed}</span>
                    <span>W {ratingA.wins}</span>
                    <span>L {ratingA.losses}</span>
                    <span>T {ratingA.ties}</span>
                  </div>
                  {placementA && (
                    <div className="flex items-center justify-between text-xs">
                      <span>{placementA.label}</span>
                      <Badge variant="outline" className="text-[11px] font-semibold">
                        {placementA.gamesPlayed}/{placementA.maxGames} games
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {modelB && ratingB && (
              <Card className="worm-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-worm-ink">
                    {modelB}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-worm-ink">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Pessimistic rating</span>
                    <span className="worm-pill-green px-2 py-0.5 text-base">
                      {ratingB.exposed.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span>Games: {ratingB.gamesPlayed}</span>
                    <span>W {ratingB.wins}</span>
                    <span>L {ratingB.losses}</span>
                    <span>T {ratingB.ties}</span>
                  </div>
                  {placementB && (
                    <div className="flex items-center justify-between text-xs">
                      <span>{placementB.label}</span>
                      <Badge variant="outline" className="text-[11px] font-semibold">
                        {placementB.gamesPlayed}/{placementB.maxGames} games
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 items-start">
          <WormArenaReasoning
            playerName={playerAName}
            color="red"
            reasoning={showNextMove && playerIds.length > 0 ? (frames[frameIndex + 1]?.moves?.[playerIds[0]]?.rationale || '') : playerAReasoning}
            score={playerAScore}
          />

          <div className="flex flex-col gap-4">
            <WormArenaGameBoard
              frame={currentFrame}
              boardWidth={boardWidth}
              boardHeight={boardHeight}
              playerLabels={playerLabels}
            />

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

          <WormArenaReasoning
            playerName={playerBName}
            color="gold"
            reasoning={showNextMove && playerIds.length > 1 ? (frames[frameIndex + 1]?.moves?.[playerIds[1]]?.rationale || '') : playerBReasoning}
            score={playerBScore}
          />
        </div>

        <div className="text-center mb-6 worm-muted text-[17px]">
          <div className="flex justify-center gap-6 flex-wrap">
            <span><strong>Scores:</strong> {Object.entries(finalScores).map(([k, v]) => (
              <span key={k} className="ml-2"><span className="font-mono">{k}</span>: {String(v)}</span>
            ))}</span>
            <span><strong>Round:</strong> {frameIndex + 1} / {frames.length}</span>
            <span><strong>Board:</strong> {boardWidth}x{boardHeight}</span>
          </div>
          {Array.isArray(models) && models.length > 0 && (
            <div className="mt-3 text-xs flex justify-center gap-3 flex-wrap">
              <span>View stats:</span>
              {models.slice(0, 2).map((slug) => (
                <a
                  key={slug}
                  href={`/worm-arena/stats?model=${encodeURIComponent(slug)}`}
                  className="underline font-mono"
                >
                  {slug}
                </a>
              ))}
            </div>
          )}
          {selectedMatchId && (
            <div className="mt-2 flex items-center justify-center gap-2 text-sm">
              <span>
                <strong>Match ID:</strong>{' '}
                <span className="font-mono text-xs">{selectedMatchId}</span>
              </span>
              <button
                type="button"
                onClick={handleCopyMatchId}
                className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50 worm-border text-worm-ink"
              >
                Copy
              </button>
            </div>
          )}
        </div>

        <div className="mb-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 items-start">
          <WormArenaStatsPanel />
          <WormArenaGreatestHits />
        </div>

      </main>
    </div>
  );
}
