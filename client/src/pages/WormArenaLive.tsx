/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-16
 * PURPOSE: Worm Arena Live - Simplified setup with two model dropdowns and clean transitions.
 *          Removed curated matchup selector for faster, cleaner UX.
 *          Uses useWormArenaSetup hook to manage setup state.
 *          Smooth fade transitions between setup → live → completed states.
 *          Sorts model dropdowns by newest-first using server-provided addedAt (DB discovery)
 *          with releaseDate fallback.
 * SRP/DRY check: Pass - orchestrates child components with minimal state management.
 *                State extracted to useWormArenaSetup hook for better maintainability.
 */

import React, { useEffect, useMemo } from 'react';
import { useRoute } from 'wouter';
import { useModels } from '@/hooks/useModels';
import useWormArenaStreaming from '@/hooks/useWormArenaStreaming';
import { useWormArenaSetup } from '@/hooks/useWormArenaSetup';
import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaLiveStatusStrip from '@/components/WormArenaLiveStatusStrip';
import WormArenaLiveBoardPanel from '@/components/WormArenaLiveBoardPanel';
import WormArenaLiveResultsPanel from '@/components/WormArenaLiveResultsPanel';
import WormArenaRunControls from '@/components/WormArenaRunControls';
import WormArenaReasoning from '@/components/WormArenaReasoning';

import type { ModelConfig, SnakeBenchRunMatchRequest } from '@shared/types';

type ViewMode = 'setup' | 'live' | 'completed';

function getSnakeEligibleModels(models: ModelConfig[]): ModelConfig[] {
  return models.filter((m) => m.provider === 'OpenRouter');
}

function toSnakeModelId(model: ModelConfig): string {
  const raw = model.apiModelName || model.key;
  return typeof raw === 'string' ? raw.trim() : '';
}

function parseIsoTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function parseReleaseDate(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim();
  const ms = new Date(`${normalized}-01T00:00:00Z`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function mapToSnakeBenchModelId(modelId: string): string {
  if (modelId === 'openrouter/gpt-5.1-codex-mini') {
    return 'openai/gpt-5.1-codex-mini';
  }
  return modelId;
}

export default function WormArenaLive() {
  const [, params] = useRoute('/worm-arena/live/:sessionId');
  const sessionId = React.useMemo(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.location?.pathname === 'string') {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const liveIdx = parts.lastIndexOf('live');
        const candidate = liveIdx >= 0 ? parts[liveIdx + 1] : undefined;
        const trimmed = candidate?.trim();
        if (trimmed && trimmed.length > 0) return trimmed;
      }
    } catch {
      // ignore
    }

    const fallback = params?.sessionId?.trim();
    return fallback && fallback.length > 0 ? fallback : '';
  }, [params?.sessionId]);

  const { data: modelConfigs = [], isLoading: loadingModels, error: modelsError } = useModels();
  const snakeModels = React.useMemo(() => getSnakeEligibleModels(modelConfigs), [modelConfigs]);

  const selectableModels = React.useMemo(() => {
    const bestById = new Map<string, { id: string; sortMs: number; tiebreaker: string }>();

    snakeModels.forEach((m) => {
      const id = toSnakeModelId(m);
      if (!id) return;

      const addedMs = parseIsoTimestamp((m as any).addedAt);
      const releaseMs = parseReleaseDate(m.releaseDate);
      const sortMs = addedMs ?? releaseMs ?? Number.NEGATIVE_INFINITY;

      const existing = bestById.get(id);
      if (!existing || sortMs > existing.sortMs) {
        bestById.set(id, { id, sortMs, tiebreaker: id });
      }
    });

    return Array.from(bestById.values())
      .sort((a, b) => {
        if (a.sortMs !== b.sortMs) return b.sortMs - a.sortMs;
        return a.tiebreaker.localeCompare(b.tiebreaker);
      })
      .map((entry) => entry.id);
  }, [snakeModels]);

  // Setup state hook
  const {
    modelA,
    modelB,
    width,
    height,
    maxRounds,
    numApples,
    byoApiKey,
    byoProvider,
    setModelA,
    setModelB,
    setWidth,
    setHeight,
    setMaxRounds,
    setNumApples,
    setByoApiKey,
    setByoProvider,
    isValid,
  } = useWormArenaSetup();

  const [launchNotice, setLaunchNotice] = React.useState<string | null>(null);

  const availableModelSet = React.useMemo(() => new Set(selectableModels), [selectableModels]);
  const matchupAvailable = isValid(availableModelSet);

  const {
    status,
    message,
    frames,
    reasoningBySnakeId,
    playerNameBySnakeId,
    finalSummary,
    error,
    connect,
    disconnect,
    startMatch: startLiveMatch,
    isStarting,
    currentMatchIndex,
    totalMatches,
  } = useWormArenaStreaming();

  useEffect(() => {
    if (!sessionId) return;
    connect(sessionId);
    return () => disconnect();
  }, [sessionId, connect, disconnect]);

  const handleRunMatch = async () => {
    if (!matchupAvailable) {
      setLaunchNotice('Selected models are not available on OpenRouter.');
      return;
    }

    const payload: SnakeBenchRunMatchRequest = {
      modelA: mapToSnakeBenchModelId(modelA),
      modelB: mapToSnakeBenchModelId(modelB),
      width,
      height,
      maxRounds,
      numApples,
      ...(byoApiKey ? { apiKey: byoApiKey, provider: byoProvider } : {}),
    };

    setLaunchNotice(null);
    try {
      const prep = await startLiveMatch(payload, []);
      if (prep?.liveUrl) window.location.href = prep.liveUrl;
    } catch (err: any) {
      console.error('[WormArenaLive] Failed to start match', err);
      setLaunchNotice(err?.message || 'Failed to start match');
    }
  };

  const latestFrame = useMemo(() => (frames.length ? frames[frames.length - 1] : null), [frames]);
  const boardWidth = (latestFrame as any)?.frame?.state?.width ?? 10;
  const boardHeight = (latestFrame as any)?.frame?.state?.height ?? 10;

  const snakeIds = useMemo(() => {
    const ids = new Set<string>();
    Object.keys(playerNameBySnakeId || {}).forEach((k) => ids.add(k));
    Object.keys(reasoningBySnakeId || {}).forEach((k) => ids.add(k));
    const fromFrame = (latestFrame as any)?.frame?.state?.snakes;
    if (fromFrame && typeof fromFrame === 'object') {
      Object.keys(fromFrame).forEach((k) => ids.add(k));
    }
    return Array.from(ids).sort();
  }, [latestFrame, playerNameBySnakeId, reasoningBySnakeId]);

  const leftSnakeId = snakeIds[0];
  const rightSnakeId = snakeIds[1];
  const leftName = (leftSnakeId && playerNameBySnakeId[leftSnakeId]) || (leftSnakeId ? `Snake ${leftSnakeId}` : 'Player A');
  const rightName = (rightSnakeId && playerNameBySnakeId[rightSnakeId]) || (rightSnakeId ? `Snake ${rightSnakeId}` : 'Player B');
  const leftReasoning = (leftSnakeId && reasoningBySnakeId[leftSnakeId]) || '';
  const rightReasoning = (rightSnakeId && reasoningBySnakeId[rightSnakeId]) || '';

  const viewMode: ViewMode = finalSummary
    ? 'completed'
    : status === 'connecting' || status === 'starting' || status === 'in_progress'
      ? 'live'
      : 'setup';

  const headerSubtitle =
    viewMode === 'setup' ? 'Start a live match' : viewMode === 'live' ? 'Streaming...' : 'Match complete';

  return (
    <div className="worm-page">
      <WormArenaHeader
        matchupLabel={finalSummary ? `${finalSummary.modelA} vs ${finalSummary.modelB}` : undefined}
        totalGames={0}
        subtitle={headerSubtitle}
        links={[
          { label: 'Replay', href: '/worm-arena' },
          { label: 'Live', href: '/worm-arena/live', active: true },
          { label: 'Matches', href: '/worm-arena/matches' },
          { label: 'Stats & Placement', href: '/worm-arena/stats' },
        ]}
      />

      <main className="p-4 max-w-7xl mx-auto space-y-4">
        {viewMode === 'setup' && (
          <div className="transition-opacity duration-300 ease-in-out">
            <WormArenaRunControls
              viewMode="setup"
              status={status}
              isStarting={isStarting}
              loadingModels={loadingModels}
              matchupAvailable={matchupAvailable}
              availableModels={availableModelSet}
              modelOptions={selectableModels}
              modelA={modelA}
              modelB={modelB}
              onModelAChange={setModelA}
              onModelBChange={setModelB}
              width={width}
              height={height}
              maxRounds={maxRounds}
              numApples={numApples}
              onWidthChange={setWidth}
              onHeightChange={setHeight}
              onMaxRoundsChange={setMaxRounds}
              onNumApplesChange={setNumApples}
              byoApiKey={byoApiKey}
              byoProvider={byoProvider}
              onByoApiKeyChange={setByoApiKey}
              onByoProviderChange={setByoProvider}
              onStart={handleRunMatch}
              launchNotice={launchNotice}
            />
          </div>
        )}

        {viewMode === 'live' && (
          <div className="transition-opacity duration-300 ease-in-out animate-in fade-in">
            {(() => {
              const snakeIds = Object.keys((latestFrame as any)?.frame?.state?.snakes ?? {}).sort();
              const aliveNames = snakeIds.map(id => playerNameBySnakeId[id] || id).slice(0, 2);
              return (
                <WormArenaLiveStatusStrip
                  status={status}
                  message={message}
                  error={error}
                  sessionId={sessionId}
                  currentMatchIndex={currentMatchIndex}
                  totalMatches={totalMatches}
                  playerAName={leftName}
                  playerBName={rightName}
                  playerAScore={Number((latestFrame as any)?.frame?.state?.scores?.[leftSnakeId] ?? 0)}
                  playerBScore={Number((latestFrame as any)?.frame?.state?.scores?.[rightSnakeId] ?? 0)}
                  currentRound={(latestFrame as any)?.round ?? 0}
                  maxRounds={(latestFrame as any)?.frame?.state?.max_rounds ?? 0}
                  aliveSnakes={aliveNames}
                />
              );
            })()}
          </div>
        )}

        {viewMode === 'live' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 transition-opacity duration-300 ease-in-out animate-in fade-in items-stretch">
            <WormArenaReasoning
              playerName={leftName}
              color="green"
              reasoning={leftReasoning}
              score={Number((latestFrame as any)?.frame?.state?.scores?.[leftSnakeId] ?? 0)}
              strategyLabel="Live output"
            />

            <div className="flex flex-col gap-4">
              <WormArenaLiveBoardPanel
                viewMode="live"
                status={status}
                latestFrame={latestFrame}
                boardWidth={boardWidth}
                boardHeight={boardHeight}
                finalSummary={null}
              />
            </div>

            <WormArenaReasoning
              playerName={rightName}
              color="blue"
              reasoning={rightReasoning}
              score={Number((latestFrame as any)?.frame?.state?.scores?.[rightSnakeId] ?? 0)}
              strategyLabel="Live output"
            />
          </div>
        )}

        {viewMode === 'completed' && finalSummary && (
          <div className="transition-opacity duration-300 ease-in-out animate-in fade-in">
            <WormArenaLiveResultsPanel finalSummary={finalSummary} />
          </div>
        )}

        {modelsError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3">
            <strong>Error:</strong> {modelsError.message}
          </div>
        )}
      </main>
    </div>
  );
 }
