/**
 * Author: GPT-5.2 Codex CLI
 * Date: 2025-12-12
 * PURPOSE: Worm Arena Live - Live match viewer and curated single-match launcher.
 *          Shows active gameplay as it streams and provides a curated matchup gallery
 *          for statistically useful 1v1 comparisons (no batching on this page).
 * SRP/DRY check: Pass - live streaming viewer + curated launcher only.
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

      <main className="p-8 space-y-6">
        <div
          className="rounded-lg border bg-white/90 shadow-sm px-4 py-3 worm-border"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-worm-ink">
                Session
              </div>
              <div className="text-xs worm-muted" title={sessionId}>
                {sessionId ? sessionId.slice(0, 16) + '…' : 'No active session'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm worm-muted">
                {infoText}
              </div>
              {statusBadge}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div
            className="lg:col-span-2 rounded-lg border bg-white/90 shadow-sm px-4 py-4 worm-border"
          >
            <h2 className="text-sm font-semibold mb-3 text-worm-ink">Live Board</h2>
            {latestFrame ? (
              <WormArenaGameBoard
                frame={latestFrame.frame}
                boardWidth={boardWidth}
                boardHeight={boardHeight}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 worm-muted">
                <div className="text-sm">
                  {status === 'failed'
                    ? 'Match failed.'
                    : status === 'completed'
                    ? 'Match complete. No frames streamed.'
                    : 'Waiting for live updates…'}
                </div>
              </div>
            )}
          </div>

          <div
            className="rounded-lg border bg-white/90 shadow-sm px-4 py-4 space-y-3 worm-border"
          >
            <h2 className="text-sm font-semibold text-worm-ink">Status</h2>
            <div className="text-sm worm-muted min-h-8">
              {infoText}
            </div>

            {finalSummary && (
              <div className="space-y-2 border-t pt-3 worm-border">
                <div className="text-sm font-semibold text-worm-ink">Final</div>
                <div className="text-xs worm-muted">
                  Match ID: {finalSummary.gameId.slice(0, 12)}
                </div>
                <div className="text-xs worm-muted">
                  {finalSummary.modelA} vs {finalSummary.modelB}
                </div>
                <div className="text-xs worm-muted">
                  Scores:{' '}
                  {Object.entries(finalSummary.scores || {}).map(([k, v]) => (
                    <span key={k} className="mr-3">
                      {k}:{v}
                    </span>
                  ))}
                </div>
                <a
                  href={`/worm-arena?matchId=${encodeURIComponent(finalSummary.gameId)}`}
                  className="inline-block mt-2 px-4 py-2 rounded text-xs font-semibold text-white transition-all bg-worm-ink"
                >
                  View Replay
                </a>
                <div className="text-xs mt-2 worm-muted">
                  View stats:
                  {['modelA', 'modelB'].map((key) => {
                    const slug = (finalSummary as any)[key] as string | undefined;
                    if (!slug) return null;
                    return (
                      <a
                        key={key}
                        href={`/worm-arena/stats?model=${encodeURIComponent(slug)}`}
                        className="ml-2 underline font-mono"
                      >
                        {slug}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {!finalSummary && status !== 'failed' && (
              <div className="text-xs worm-muted">
                Final scores & replay link appear here once complete.
              </div>
            )}

            {error && <div className="text-xs text-red-600">Error: {error}</div>}
          </div>
        </div>

        <div
          ref={setupRef}
          className="rounded-lg border px-4 py-4 space-y-4 worm-border bg-worm-card"
        >
          {modelsError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
              <strong>Error:</strong> {modelsError.message}
            </div>
          )}

          {loadingModels && (
            <div className="text-xs worm-muted">
              Loading available OpenRouter models…
            </div>
          )}

          <WormArenaMatchupSelector
            selectedMatchup={selectedMatchup}
            onSelectMatchup={setSelectedMatchup}
            isRunning={status === 'in_progress' || isStarting}
            availableModels={availableModelSet}
          />

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                disabled={status === 'in_progress' || isStarting}
                className="w-full flex items-center justify-between px-3 py-2 rounded border bg-white/80 text-xs font-semibold worm-border text-worm-ink"
              >
                <span>Advanced Settings</span>
                <span>{advancedOpen ? '▾' : '▸'}</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="text-xs font-semibold text-worm-ink">
                  Width
                  <input
                    type="number"
                    min={5}
                    max={30}
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="mt-1 w-full h-9 rounded border px-2 text-xs bg-white"
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
                    className="mt-1 w-full h-9 rounded border px-2 text-xs bg-white"
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
                    className="mt-1 w-full h-9 rounded border px-2 text-xs bg-white"
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
                    className="mt-1 w-full h-9 rounded border px-2 text-xs bg-white"
                    disabled={status === 'in_progress' || isStarting}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-worm-ink">
                  BYO API Key (optional)
                  <input
                    type="password"
                    value={byoApiKey}
                    onChange={(e) => setByoApiKey(e.target.value)}
                    className="mt-1 w-full h-9 rounded border px-2 text-xs bg-white"
                    placeholder="Paste your API key"
                    disabled={status === 'in_progress' || isStarting}
                  />
                  <div className="text-[10px] mt-1 worm-muted">
                    Leave blank to use server keys.
                  </div>
                </label>

                <label className="text-xs font-semibold text-worm-ink">
                  Provider
                  <select
                    value={byoProvider}
                    onChange={(e) => setByoProvider(e.target.value as any)}
                    className="mt-1 w-full h-9 rounded border px-2 text-xs bg-white"
                    disabled={status === 'in_progress' || isStarting}
                  >
                    <option value="server-default">Use server default</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="xai">xAI</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </label>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs worm-muted">
              Selected: <span className="font-mono">{selectedMatchup.modelA}</span> vs{' '}
              <span className="font-mono">{selectedMatchup.modelB}</span>
            </div>
            <button
              onClick={handleRunMatch}
              disabled={status === 'in_progress' || isStarting || loadingModels || !matchupAvailable}
              className="px-5 py-2 rounded text-xs font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-worm-green hover:bg-worm-green-hover"
            >
              {status === 'in_progress' || isStarting ? 'Running…' : 'Run Match'}
            </button>
          </div>

          {launchNotice && (
            <div className="text-xs worm-muted" role="status">
              {launchNotice}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

