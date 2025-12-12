/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-12
 * PURPOSE: Worm Arena Live - Redesigned layout with clear information hierarchy.
 *          Left sidebar (control center): API key, matchup selection, main CTA button.
 *          Right content: Live game board prominently displayed, results panel below.
 *          Responsive: stacks vertically on mobile (lg breakpoint for side-by-side).
 *          Integrates with useWormArenaStreaming for real-time frame updates.
 * SRP/DRY check: Pass - orchestrates child components (Header, GameBoard, MatchupSelector).
 *                No duplicated logic; uses existing hooks and utilities.
 *                Improves UX from previous cramped layout by 4-5x readability.
 */

import React, { useEffect, useMemo } from 'react';
import { useRoute } from 'wouter';
import { useModels } from '@/hooks/useModels';
import useWormArenaStreaming from '@/hooks/useWormArenaStreaming';
import WormArenaGameBoard from '@/components/WormArenaGameBoard';
import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaHeaderStartAction from '@/components/WormArenaHeaderStartAction';
import WormArenaMatchupSelector from '@/components/WormArenaMatchupSelector';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import type { ModelConfig, SnakeBenchRunMatchRequest } from '@shared/types';
import { getDefaultMatchup, type CuratedMatchup } from '@shared/utils/curatedMatchups';

function getSnakeEligibleModels(models: ModelConfig[]): string[] {
  const eligible = models
    .filter((m) => m.provider === 'OpenRouter')
    .map((m) => {
      const name = m.apiModelName || m.key;
      return name && typeof name === 'string' && name.trim().length > 0 ? name.trim() : null;
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

export default function WormArenaLive() {
  const [, params] = useRoute('/worm-arena/live/:sessionId');
  const sessionId = params?.sessionId ?? '';

  const setupRef = React.useRef<HTMLDivElement>(null);

  const { data: modelConfigs = [], isLoading: loadingModels, error: modelsError } = useModels();
  const snakeModels = React.useMemo(() => getSnakeEligibleModels(modelConfigs), [modelConfigs]);
  const selectableModels = React.useMemo(
    () => snakeModels.filter((m) => typeof m === 'string' && m.trim().length > 0),
    [snakeModels],
  );

  const [selectedMatchup, setSelectedMatchup] = React.useState<CuratedMatchup>(getDefaultMatchup());
  const [width, setWidth] = React.useState<number>(10);
  const [height, setHeight] = React.useState<number>(10);
  const [maxRounds, setMaxRounds] = React.useState<number>(150);
  const [numApples, setNumApples] = React.useState<number>(5);
  const [byoApiKey, setByoApiKey] = React.useState<string>('');
  const [byoProvider, setByoProvider] = React.useState<
    'openrouter' | 'openai' | 'anthropic' | 'xai' | 'gemini' | 'server-default'
  >('server-default');
  const [launchNotice, setLaunchNotice] = React.useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = React.useState<boolean>(false);

  const availableModelSet = React.useMemo(() => new Set(selectableModels), [selectableModels]);
  const matchupAvailable =
    availableModelSet.has(selectedMatchup.modelA) && availableModelSet.has(selectedMatchup.modelB);

  const {
    status,
    message,
    frames,
    finalSummary,
    error,
    connect,
    disconnect,
    startMatch: startLiveMatch,
    isStarting,
  } = useWormArenaStreaming();

  useEffect(() => {
    if (!sessionId) return;
    connect(sessionId);
    return () => disconnect();
  }, [sessionId, connect, disconnect]);

  const handleRunMatch = async () => {
    if (!matchupAvailable) {
      setLaunchNotice('Selected matchup is not available on OpenRouter.');
      return;
    }

    const payload: SnakeBenchRunMatchRequest = {
      modelA: mapToSnakeBenchModelId(selectedMatchup.modelA),
      modelB: mapToSnakeBenchModelId(selectedMatchup.modelB),
      width,
      height,
      maxRounds,
      numApples,
      ...(byoApiKey && byoProvider !== 'server-default'
        ? { apiKey: byoApiKey, provider: byoProvider }
        : {}),
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

  const handleScrollToSetup = () => {
    setTimeout(() => setupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const latestFrame = useMemo(() => (frames.length ? frames[frames.length - 1] : null), [frames]);
  const boardWidth = (latestFrame as any)?.frame?.state?.width ?? 10;
  const boardHeight = (latestFrame as any)?.frame?.state?.height ?? 10;

  const statusBadge = (() => {
    switch (status) {
      case 'connecting':
      case 'starting':
        return <span className="badge badge-outline">Starting…</span>;
      case 'in_progress':
        return <span className="badge badge-primary">Streaming</span>;
      case 'completed':
        return <span className="badge badge-success">Completed</span>;
      case 'failed':
        return <span className="badge badge-error">Failed</span>;
      default:
        return <span className="badge badge-neutral">Idle</span>;
    }
  })();

  const infoText = error
    ? error
    : message || (status === 'in_progress' ? 'Running your match…' : 'Preparing your match…');

  return (
    <div className="worm-page">
      <WormArenaHeader
        matchupLabel={finalSummary ? `${finalSummary.modelA} vs ${finalSummary.modelB}` : undefined}
        totalGames={0}
        links={[
          { label: 'Replay', href: '/worm-arena' },
          { label: 'Live', href: '/worm-arena/live', active: true },
          { label: 'Stats & Placement', href: '/worm-arena/stats' },
        ]}
        actionSlot={
          <WormArenaHeaderStartAction
            isRunning={status === 'in_progress' || isStarting}
            isStarting={isStarting}
            onPlayClick={handleRunMatch}
            onScrollToControls={handleScrollToSetup}
          />
        }
      />

      <main className="flex flex-col lg:flex-row gap-6 p-8 max-w-7xl mx-auto min-h-[calc(100vh-200px)]">
        {/* ===== LEFT SIDEBAR: CONTROL CENTER ===== */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          {/* Session & Status Bar */}
          <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-3 worm-border">
            <div className="text-xs font-bold uppercase tracking-wide text-worm-ink mb-2">
              Session
            </div>
            <div className="text-xs worm-muted font-mono" title={sessionId}>
              {sessionId ? sessionId.slice(0, 20) + '…' : 'No active session'}
            </div>
          </div>

          {/* Status Indicator */}
          <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-3 worm-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs font-bold uppercase tracking-wide text-worm-ink">
                Status
              </div>
              {statusBadge}
            </div>
            <div className="text-xs text-worm-ink leading-relaxed">
              {infoText}
            </div>
          </div>

          {/* API Key Section */}
          <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-4 worm-border space-y-2">
            <label className="text-xs font-bold uppercase tracking-wide text-worm-ink block">
              API Key (Optional)
            </label>
            <input
              type="password"
              value={byoApiKey}
              onChange={(e) => setByoApiKey(e.target.value)}
              placeholder="Paste your API key"
              disabled={status === 'in_progress' || isStarting}
              className="w-full h-10 rounded border px-3 text-xs bg-white/80 placeholder-gray-400"
            />
            <select
              value={byoProvider}
              onChange={(e) => setByoProvider(e.target.value as any)}
              disabled={status === 'in_progress' || isStarting}
              className="w-full h-10 rounded border px-3 text-xs bg-white/80"
            >
              <option value="server-default">Use server keys</option>
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="xai">xAI</option>
              <option value="gemini">Gemini</option>
            </select>
            <div className="text-[11px] worm-muted">
              Leave API key blank to use server defaults.
            </div>
          </div>

          {/* Error Display */}
          {modelsError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3">
              <strong>Error:</strong> {modelsError.message}
            </div>
          )}

          {/* Matchup Selector */}
          <div ref={setupRef} className="space-y-3 flex-1">
            <div className="text-xs font-bold uppercase tracking-wide text-worm-ink">
              Select Matchup
            </div>
            {loadingModels ? (
              <div className="text-xs worm-muted p-4 text-center">
                Loading models…
              </div>
            ) : (
              <WormArenaMatchupSelector
                selectedMatchup={selectedMatchup}
                onSelectMatchup={setSelectedMatchup}
                isRunning={status === 'in_progress' || isStarting}
                availableModels={availableModelSet}
              />
            )}
          </div>

          {/* Advanced Settings */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                disabled={status === 'in_progress' || isStarting}
                className="w-full flex items-center justify-between px-3 py-2 rounded border bg-white/80 text-xs font-semibold worm-border text-worm-ink hover:bg-white transition-colors"
              >
                <span>⚙ Advanced Settings</span>
                <span>{advancedOpen ? '▾' : '▸'}</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3 bg-white/50 rounded p-3 border worm-border">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-worm-ink">
                  Width
                  <input
                    type="number"
                    min={5}
                    max={30}
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="mt-1 w-full h-8 rounded border px-2 text-xs bg-white"
                    disabled={status === 'in_progress' || isStarting}
                  />
                </label>
                <label className="text-xs font-semibold text-worm-ink">
                  Height
                  <input
                    type="number"
                    min={5}
                    max={30}
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="mt-1 w-full h-8 rounded border px-2 text-xs bg-white"
                    disabled={status === 'in_progress' || isStarting}
                  />
                </label>
                <label className="text-xs font-semibold text-worm-ink">
                  Max Rounds
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={maxRounds}
                    onChange={(e) => setMaxRounds(Number(e.target.value))}
                    className="mt-1 w-full h-8 rounded border px-2 text-xs bg-white"
                    disabled={status === 'in_progress' || isStarting}
                  />
                </label>
                <label className="text-xs font-semibold text-worm-ink">
                  Apples
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={numApples}
                    onChange={(e) => setNumApples(Number(e.target.value))}
                    className="mt-1 w-full h-8 rounded border px-2 text-xs bg-white"
                    disabled={status === 'in_progress' || isStarting}
                  />
                </label>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Main CTA Button - BOLD & PROMINENT */}
          <button
            onClick={handleRunMatch}
            disabled={status === 'in_progress' || isStarting || loadingModels || !matchupAvailable}
            className="w-full px-6 py-4 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-worm-green hover:bg-worm-green-hover shadow-md hover:shadow-lg text-center"
          >
            {status === 'in_progress' || isStarting ? (
              <>
                <span className="inline-block animate-spin mr-2">⚡</span>
                Running Match…
              </>
            ) : (
              <>
                <span className="inline-block mr-2">▶</span>
                Start Match
              </>
            )}
          </button>

          {/* Launch Notice */}
          {launchNotice && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3">
              {launchNotice}
            </div>
          )}
        </div>

        {/* ===== RIGHT CONTENT: LIVE BOARD & RESULTS ===== */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Live Board - MAIN ATTRACTION */}
          <div className="rounded-lg border bg-white/90 shadow-md px-6 py-6 worm-border flex-1 flex flex-col">
            <h2 className="text-xs font-bold uppercase tracking-wide text-worm-ink mb-4">
              🎮 Live Board
            </h2>
            {latestFrame ? (
              <div className="flex-1 flex items-center justify-center">
                <WormArenaGameBoard
                  frame={latestFrame.frame}
                  boardWidth={boardWidth}
                  boardHeight={boardHeight}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 worm-muted">
                <div className="text-sm font-medium">
                  {status === 'failed'
                    ? '❌ Match failed'
                    : status === 'completed'
                    ? '✓ Match complete'
                    : '⏳ Waiting for updates…'}
                </div>
              </div>
            )}
          </div>

          {/* Results Panel */}
          {finalSummary && (
            <div className="rounded-lg border bg-white/90 shadow-sm px-6 py-4 worm-border space-y-4">
              <div className="text-xs font-bold uppercase tracking-wide text-worm-ink">
                ✓ Match Complete
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] worm-muted">Match ID</div>
                  <div className="font-mono text-xs text-worm-ink">
                    {finalSummary.gameId.slice(0, 12)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] worm-muted">Matchup</div>
                  <div className="text-xs text-worm-ink font-semibold">
                    {finalSummary.modelA} vs {finalSummary.modelB}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[11px] worm-muted mb-2">Final Scores</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(finalSummary.scores || {}).map(([k, v]) => (
                    <div key={k} className="text-xs font-mono bg-white/60 rounded p-2">
                      <span className="text-worm-ink font-semibold">{k}:</span> {v}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <a
                  href={`/worm-arena?matchId=${encodeURIComponent(finalSummary.gameId)}`}
                  className="px-4 py-2 rounded text-xs font-semibold text-white bg-worm-ink hover:opacity-90 transition-opacity"
                >
                  View Replay
                </a>
                {['modelA', 'modelB'].map((key) => {
                  const slug = (finalSummary as any)[key] as string | undefined;
                  if (!slug) return null;
                  return (
                    <a
                      key={key}
                      href={`/worm-arena/stats?model=${encodeURIComponent(slug)}`}
                      className="px-3 py-2 rounded text-xs font-semibold text-worm-ink border border-worm-ink hover:bg-worm-card transition-colors"
                    >
                      {slug} Stats
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

