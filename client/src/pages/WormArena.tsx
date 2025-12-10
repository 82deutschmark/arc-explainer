/**
 * Author: Cascade
 * Date: 2025-12-09
 * PURPOSE: Worm Arena - Redesigned layout with minimalist + farm aesthetic.
 *          Three-column layout: reasoning logs (left/right), game board (center).
 *          Earthy color palette, large monospace reasoning text, minimal controls.
 * SRP/DRY check: Pass - Single page component with clear layout responsibility.
 */

import React from 'react';
import { useModels } from '@/hooks/useModels';
import { useSnakeBenchMatch, useSnakeBenchRecentGames, useSnakeBenchGame } from '@/hooks/useSnakeBench';
import useWormArenaStreaming from '@/hooks/useWormArenaStreaming';
import WormArenaSetup from '@/components/WormArenaSetup';
import WormArenaControls from '@/components/WormArenaControls';
import WormArenaGameBoard from '@/components/WormArenaGameBoard';
import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaReasoning from '@/components/WormArenaReasoning';

import type { ModelConfig, SnakeBenchRunMatchRequest } from '@shared/types';

function getSnakeEligibleModels(models: ModelConfig[]): string[] {
  const eligible = models
    .filter((m) => m.provider === 'OpenRouter')
    .map((m) => {
      const name = m.apiModelName || m.key;
      return (name && typeof name === 'string' && name.trim().length > 0) ? name.trim() : null;
    })
    .filter((m): m is string => m !== null);
  return eligible;
}

function mapToSnakeBenchModelId(modelId: string): string {
  if (modelId === 'openrouter/gpt-5.1-codex-mini') {
    return 'openai/gpt-5.1-codex-mini';
  }
  return modelId;
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
  const { data: modelConfigs = [], isLoading: loadingModels, error: modelsError } = useModels();
  const snakeModels = React.useMemo(() => getSnakeEligibleModels(modelConfigs), [modelConfigs]);
  const selectableModels = React.useMemo(
    () => snakeModels.filter((m) => typeof m === 'string' && m.trim().length > 0),
    [snakeModels],
  );

  const [modelA, setModelA] = React.useState<string>('');
  const [modelB, setModelB] = React.useState<string>('');
  const [width, setWidth] = React.useState<number>(10);
  const [height, setHeight] = React.useState<number>(10);
  const [maxRounds, setMaxRounds] = React.useState<number>(150);
  const [numApples, setNumApples] = React.useState<number>(5);
  const [byoApiKey, setByoApiKey] = React.useState<string>('');
  const [byoProvider, setByoProvider] = React.useState<'openrouter' | 'openai' | 'anthropic' | 'xai' | 'gemini' | 'server-default'>('server-default');
  const [selectedGameId, setSelectedGameId] = React.useState<string>('');
  const [frameIndex, setFrameIndex] = React.useState<number>(0);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [isConfigExpanded, setIsConfigExpanded] = React.useState<boolean>(false);
  const [showNextMove, setShowNextMove] = React.useState<boolean>(true);
  const { startMatch: startLiveMatch, isStarting } = useWormArenaStreaming();
  const [launchNotice, setLaunchNotice] = React.useState<string | null>(null);

  const { runMatch, lastResponse, isRunning, error: matchError } = useSnakeBenchMatch();
  const { games, total, isLoading: loadingGames, error: gamesError, refresh } = useSnakeBenchRecentGames();
  const { data: replayData, isLoading: loadingReplay, error: replayError, fetchGame } = useSnakeBenchGame(selectedGameId);

  React.useEffect(() => {
    if (selectableModels.length === 0) return;

    if (!modelA && !modelB) {
      const preferredA = 'x-ai/grok-4.1-fast';
      const preferredB = 'openai/gpt-5.1-codex-mini';

      const hasPreferredA = selectableModels.includes(preferredA);
      const hasPreferredB = selectableModels.includes(preferredB);

      if (hasPreferredA && hasPreferredB) {
        setModelA(preferredA);
        setModelB(preferredB);
      } else if (selectableModels.length >= 2) {
        setModelA(selectableModels[0]);
        setModelB(selectableModels[1]);
      }
    }
  }, [selectableModels, modelA, modelB]);

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

  const handleRunMatch = async () => {
    if (!modelA || !modelB) return;
    const payload: SnakeBenchRunMatchRequest = {
      modelA: mapToSnakeBenchModelId(modelA),
      modelB: mapToSnakeBenchModelId(modelB),
      width,
      height,
      maxRounds,
      numApples,
      ...(byoApiKey && byoProvider && byoProvider !== 'server-default'
        ? { apiKey: byoApiKey, provider: byoProvider }
        : {}),
    };
    setLaunchNotice(null);
    try {
      const prep = await startLiveMatch(payload);
      if (prep?.liveUrl) {
        window.open(prep.liveUrl, '_blank', 'noopener,noreferrer');
        setLaunchNotice('We’re starting your match in a new tab. It may take a little while.');
      }
    } catch (err: any) {
      console.error('[WormArena] Failed to start live match', err);
      setLaunchNotice(err?.message || 'Failed to start match');
    } finally {
      void refresh(10);
    }
  };

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

  // Get reasoning for current frame
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
    // Prefer explicit player names from replay data
    if (playerIds.length >= 2) {
      return `${playerAName} vs ${playerBName}`;
    }

    // Fallback to metadata models if they look like a pair
    if (Array.isArray(models) && models.length === 2) {
      return `${models[0]} vs ${models[1]}`;
    }

    // Fallback to currently selected models from setup
    if (modelA || modelB) {
      return `${modelA || 'Model A'} vs ${modelB || 'Model B'}`;
    }

    return 'Worm Arena Match';
  }, [playerIds.length, playerAName, playerBName, models, modelA, modelB]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f1e8', fontFamily: 'Fredoka, Nunito, sans-serif' }}>
      {/* Google Fonts for Fredoka */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* New Worm Arena Header with integrated play button */}
      <WormArenaHeader
        isRunning={isRunning || isStarting}
        isStarting={isStarting}
        onPlayClick={handleRunMatch}
        matchupLabel={matchupLabel}
        totalGames={total}
      />

      <main className="p-8">
        {/* Match Metadata */}
        {startedAt && (
          <div className="text-center mb-6">
            <p className="text-sm" style={{ color: '#7a6b5f' }}>
              Match run on {new Date(startedAt).toLocaleString()}
            </p>
          </div>
        )}

        {/* Move Reasoning Toggle */}
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

        {/* Three-Column Hero Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left Column: Player A Reasoning */}
          <WormArenaReasoning
            playerName={playerAName}
            color="red"
            reasoning={showNextMove && playerIds.length > 0 ? (frames[frameIndex + 1]?.moves?.[playerIds[0]]?.rationale || '') : playerAReasoning}
            currentRound={frames.length === 0 ? 0 : frameIndex + 1}
            totalRounds={frames.length}
            showNextMove={showNextMove}
          />

          {/* Center Column: Game Board (emoji canvas) */}
          <WormArenaGameBoard
            frame={currentFrame}
            boardWidth={boardWidth}
            boardHeight={boardHeight}
            playerLabels={playerLabels}
          />

          {/* Right Column: Player B Reasoning */}
          <WormArenaReasoning
            playerName={playerBName}
            color="gold"
            reasoning={showNextMove && playerIds.length > 1 ? (frames[frameIndex + 1]?.moves?.[playerIds[1]]?.rationale || '') : playerBReasoning}
            currentRound={frames.length === 0 ? 0 : frameIndex + 1}
            totalRounds={frames.length}
            showNextMove={showNextMove}
          />
        </div>

        {/* Metadata Row */}
        <div className="text-center mb-4" style={{ color: '#7a6b5f', fontSize: '16px' }}>
          <div className="flex justify-center gap-6 flex-wrap">
            <span><strong>Scores:</strong> {Object.entries(finalScores).map(([k, v]) => (
              <span key={k} className="ml-2"><span className="font-mono">{k}</span>: {String(v)}</span>
            ))}</span>
            <span><strong>Round:</strong> {frameIndex + 1} / {frames.length}</span>
            <span><strong>Board:</strong> {boardWidth}x{boardHeight}</span>
          </div>
        </div>

        {/* Playback Controls */}
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

        {/* Collapsible Game Selection & Setup */}
        <div className="rounded-lg border" style={{ backgroundColor: '#faf5f0', borderColor: '#d4b5a0' }}>
          <button
            onClick={() => setIsConfigExpanded(!isConfigExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
            style={{ color: '#3d2817' }}
          >
            <span className="font-medium">
              {isConfigExpanded ? '▼' : '▶'} {isConfigExpanded ? 'Hide' : 'Show'} Match Setup
            </span>
          </button>
          
          {isConfigExpanded && (
            <div className="px-4 pb-4 border-t" style={{ borderColor: '#d4b5a0' }}>
              {/* Game Selection */}
              <div className="mb-4">
                <h4 className="font-medium mb-2 text-sm" style={{ color: '#3d2817' }}>Recent Games</h4>
                <div className="border rounded bg-white/80 max-h-32 overflow-y-auto text-xs">
                  {loadingGames && <div className="p-2" style={{ color: '#7a6b5f' }}>Loading games...</div>}
                  {!loadingGames && games.length === 0 && <div className="p-2" style={{ color: '#7a6b5f' }}>No games yet.</div>}
                  {!loadingGames && games.length > 0 && (
                    <div className="divide-y" style={{ borderColor: '#d4b5a0' }}>
                      {games.map((g) => (
                        <button
                          key={g.gameId}
                          onClick={() => setSelectedGameId(g.gameId)}
                          className={`w-full text-left p-2 hover:bg-gray-50 ${selectedGameId === g.gameId ? 'bg-blue-50' : ''}`}
                          style={{ fontSize: '11px' }}
                        >
                          <div className="font-mono truncate" title={g.gameId}>{g.gameId}</div>
                          <div style={{ color: '#7a6b5f' }}>{g.totalScore} pts · {g.roundsPlayed} rds</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* New Match Setup */}
              <div className="space-y-3">
                <WormArenaSetup
                  modelA={modelA}
                  modelB={modelB}
                  selectableModels={selectableModels}
                  isRunning={isRunning || isStarting}
                  loadingModels={loadingModels}
                  modelsError={modelsError?.message}
                  onModelAChange={setModelA}
                  onModelBChange={setModelB}
                  byoApiKey={byoApiKey}
                  byoProvider={byoProvider}
                  onApiKeyChange={setByoApiKey}
                  onProviderChange={setByoProvider}
                  onRunMatch={handleRunMatch}
                />
                {launchNotice && (
                  <div className="text-sm text-[#7a6b5f]" role="status">
                    {launchNotice}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
