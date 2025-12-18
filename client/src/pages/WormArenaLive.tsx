/**
 * Author: Cascade / Claude Haiku 4.5
 * Date: 2025-12-18
 * PURPOSE: Worm Arena Live streaming hub with the apple scoreboard pinned up top,
 *          run controls hidden mid-match, and post-game summaries that stay on the
 *          same page alongside the final board.
 *          Supports durable share links: if a user visits a live URL after the match
 *          ends, we resolve sessionId -> gameId and redirect to the replay page.
 *          SETUP VIEW: Two-column layout with suggested matchups on left, run controls on right.
 *          Users can click "Run" on a suggested matchup to instantly start it.
 *          SUPPORTS: Auto-start from query params (modelA, modelB, autoStart) for direct links.
 * SRP/DRY check: Pass - coordinates child hooks/components without duplicating their logic.
 *                Suggested matchups integrated via onRunMatch callback; state updates isolated.
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
import WormArenaLiveScoreboard from '@/components/WormArenaLiveScoreboard';
import WormArenaSuggestedMatchups from '@/components/WormArenaSuggestedMatchups';

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
  const [copyHint, setCopyHint] = React.useState<string | null>(null);
  const [autoStartAttempted, setAutoStartAttempted] = React.useState(false);

  const availableModelSet = React.useMemo(() => new Set(selectableModels), [selectableModels]);
  const matchupAvailable = isValid(availableModelSet);

  const {
    status,
    message,
    phase,
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

  // Track if we've already attempted to resolve a failed session
  const [resolveAttempted, setResolveAttempted] = React.useState(false);

  // Parse query parameters (modelA, modelB) from suggested matchups and pre-fill form
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const queryModelA = params.get('modelA')?.trim();
    const queryModelB = params.get('modelB')?.trim();

    // Pre-fill models if provided in query
    if (queryModelA && queryModelA !== modelA) {
      setModelA(queryModelA);
    }
    if (queryModelB && queryModelB !== modelB) {
      setModelB(queryModelB);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    connect(sessionId);
    return () => disconnect();
  }, [sessionId, connect, disconnect]);

  // When SSE connection fails, try to resolve sessionId to gameId for replay redirect
  useEffect(() => {
    if (!sessionId || status !== 'failed' || resolveAttempted || finalSummary) return;

    const tryResolve = async () => {
      setResolveAttempted(true);
      try {
        const res = await fetch(`/api/wormarena/resolve/${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.success && data?.status === 'completed' && data?.replayUrl) {
          // Redirect to replay page
          window.location.href = data.replayUrl;
        }
      } catch (err) {
        console.error('[WormArenaLive] Failed to resolve session', err);
      }
    };

    tryResolve();
  }, [sessionId, status, resolveAttempted, finalSummary]);

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
      const prep = await startLiveMatch(payload);
      if (prep?.liveUrl) window.location.href = prep.liveUrl;
    } catch (err: any) {
      console.error('[WormArenaLive] Failed to start match', err);
      setLaunchNotice(err?.message || 'Failed to start match');
    }
  };

  // Auto-start match if autoStart=true was in query params and models are ready
  useEffect(() => {
    if (autoStartAttempted || loadingModels || !matchupAvailable) return;

    const params = new URLSearchParams(window.location.search);
    const autoStartParam = params.get('autoStart')?.toLowerCase() === 'true';

    if (!autoStartParam) return;

    setAutoStartAttempted(true);
    handleRunMatch();
  }, [autoStartAttempted, loadingModels, matchupAvailable, handleRunMatch]);

  // Handle running a match from suggested matchups
  const handleSuggestedMatchupRun = React.useCallback(
    (modelA: string, modelB: string) => {
      setModelA(modelA);
      setModelB(modelB);
      // Delay to allow state to update
      setTimeout(() => {
        const available = new Set(selectableModels);
        if (available.has(modelA) && available.has(modelB)) {
          handleRunMatch();
        } else {
          setLaunchNotice('Selected models are not available. Please try another matchup.');
        }
      }, 0);
    },
    [setModelA, setModelB, selectableModels, handleRunMatch],
  );

  const latestFrame = useMemo(() => (frames.length ? frames[frames.length - 1] : null), [frames]);
  const boardWidth = (latestFrame as any)?.frame?.state?.width ?? 10;
  const boardHeight = (latestFrame as any)?.frame?.state?.height ?? 10;
  const currentRoundValue = useMemo(() => {
    const frameRound = Number((latestFrame as any)?.round);
    if (Number.isFinite(frameRound)) return frameRound;
    const summaryRound = Number(finalSummary?.roundsPlayed);
    return Number.isFinite(summaryRound) ? summaryRound : null;
  }, [latestFrame, finalSummary]);
  const maxRoundsValue = useMemo(() => {
    const frameMax = Number((latestFrame as any)?.frame?.state?.max_rounds);
    if (Number.isFinite(frameMax) && frameMax > 0) return frameMax;
    const summaryRound = Number(finalSummary?.roundsPlayed);
    return Number.isFinite(summaryRound) ? summaryRound : null;
  }, [latestFrame, finalSummary]);

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
  const aliveNames = useMemo(() => {
    const snakeState = (latestFrame as any)?.frame?.state?.snakes;
    if (snakeState && typeof snakeState === 'object') {
      return Object.keys(snakeState)
        .sort()
        .map((id) => playerNameBySnakeId[id] || id);
    }
    if (finalSummary?.scores) {
      return Object.keys(finalSummary.scores)
        .sort()
        .map((id) => playerNameBySnakeId[id] || id);
    }
    return [];
  }, [latestFrame, playerNameBySnakeId, finalSummary]);

  // Pull the freshest apple score for a given snake, falling back to the final summary if needed.
  const scoreForSnake = (snakeId?: string) => {
    if (!snakeId) return 0;
    const frameScores = (latestFrame as any)?.frame?.state?.scores;
    if (frameScores && typeof frameScores === 'object' && Object.prototype.hasOwnProperty.call(frameScores, snakeId)) {
      const raw = frameScores[snakeId];
      const value = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isFinite(value)) return value;
    }
    if (finalSummary?.scores && Object.prototype.hasOwnProperty.call(finalSummary.scores, snakeId)) {
      const raw = finalSummary.scores[snakeId];
      const value = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isFinite(value)) return value;
    }
    return 0;
  };
  const playerAScore = scoreForSnake(leftSnakeId);
  const playerBScore = scoreForSnake(rightSnakeId);

  // Build shareable URL: replay URL if match completed (has gameId), otherwise live URL
  const shareableUrl = React.useMemo(() => {
    if (finalSummary?.gameId) {
      return `${window.location.origin}/worm-arena?matchId=${encodeURIComponent(finalSummary.gameId)}`;
    }
    if (sessionId) {
      return `${window.location.origin}/worm-arena/live/${encodeURIComponent(sessionId)}`;
    }
    return '';
  }, [sessionId, finalSummary?.gameId]);

  // Copy shareable link (replay URL if available, otherwise live URL)
  const handleCopyShareLink = React.useCallback(async () => {
    if (!shareableUrl) return;
    try {
      if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareableUrl);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = shareableUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopyHint(finalSummary?.gameId ? 'Copied replay link!' : 'Copied live link!');
    } catch (err) {
      console.error('[WormArenaLive] Failed to copy share link', err);
      setCopyHint('Copy failed. Please copy manually.');
    } finally {
      if (typeof window !== 'undefined') {
        window.setTimeout(() => setCopyHint(null), 2500);
      }
    }
  }, [shareableUrl, finalSummary?.gameId]);

  const hasSessionParam = Boolean(sessionId);
  const viewMode: ViewMode = finalSummary
    ? 'completed'
    : status === 'connecting' || status === 'starting' || status === 'in_progress'
      ? 'live'
      : hasSessionParam
        ? 'live'
        : 'setup';
  const isActiveView = viewMode === 'live' || viewMode === 'completed';

  const reconnectWarning =
    hasSessionParam && status === 'failed' && !message && !finalSummary
      ? 'Live session not found or already finished. Current streaming API does not support rejoining mid-match.'
      : null;
  const headerSubtitle =
    viewMode === 'setup' ? 'Start a live match' : viewMode === 'live' ? 'Streaming...' : 'Match complete';
  const statusMessage = reconnectWarning || message;

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
          { label: 'Skill Analysis', href: '/worm-arena/skill-analysis' },
        ]}
      />

      <main className="p-4 max-w-7xl mx-auto space-y-4">
        {viewMode === 'setup' && (
          <div className="transition-opacity duration-300 ease-in-out">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Suggested matchups sidebar */}
              <WormArenaSuggestedMatchups
                limit={8}
                onRunMatch={handleSuggestedMatchupRun}
              />

              {/* Run controls form */}
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
          </div>
        )}

        {isActiveView && (
          <div className="space-y-4 transition-opacity duration-300 ease-in-out animate-in fade-in">
            <WormArenaLiveScoreboard
              playerAName={leftName}
              playerBName={rightName}
              playerAScore={playerAScore}
              playerBScore={playerBScore}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              <WormArenaReasoning
                playerName={leftName}
                color="green"
                reasoning={leftReasoning}
                score={playerAScore}
                strategyLabel="Live output"
              />

              <div className="flex flex-col gap-4">
                <WormArenaLiveBoardPanel
                  viewMode={viewMode === 'completed' ? 'completed' : 'live'}
                  status={status}
                  latestFrame={latestFrame}
                  boardWidth={boardWidth}
                  boardHeight={boardHeight}
                  finalSummary={finalSummary}
                />

                <WormArenaLiveStatusStrip
                  status={status}
                  message={statusMessage}
                  error={error}
                  sessionId={sessionId}
                  currentMatchIndex={currentMatchIndex}
                  totalMatches={totalMatches}
                  playerAName={leftName}
                  playerBName={rightName}
                  playerAScore={playerAScore}
                  playerBScore={playerBScore}
                  currentRound={currentRoundValue}
                  maxRounds={maxRoundsValue}
                  phase={phase}
                  aliveSnakes={aliveNames}
                />

                {sessionId && (
                  <div className="rounded-lg border-2 worm-border bg-white shadow-sm px-4 py-3 space-y-2">
                    <div className="text-[11px] uppercase font-semibold text-muted-foreground">
                      {finalSummary?.gameId ? 'Share Replay' : 'Share Live Match'}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs sm:text-sm font-mono bg-worm-card rounded px-2 py-1 text-worm-ink break-all">
                        {finalSummary?.gameId || sessionId}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyShareLink}
                        className="px-3 py-1.5 text-xs font-semibold rounded border border-worm-ink text-worm-ink hover:bg-worm-card transition-colors"
                      >
                        {copyHint ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {copyHint || (finalSummary?.gameId
                        ? 'Share this link so others can watch the replay.'
                        : 'Share this link so others can watch the live match.')}
                    </div>
                  </div>
                )}

                {finalSummary && <WormArenaLiveResultsPanel finalSummary={finalSummary} />}
              </div>

              <WormArenaReasoning
                playerName={rightName}
                color="blue"
                reasoning={rightReasoning}
                score={playerBScore}
                strategyLabel="Live output"
              />
            </div>
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
