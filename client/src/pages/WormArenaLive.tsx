/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-09
 * PURPOSE: Worm Arena Live - Live match viewer and start interface. Shows active gameplay
 *          as it streams, with controls to start new matches. Matches WormArena layout
 *          for consistency but focuses on live data and match creation.
 * SRP/DRY check: Pass — live streaming viewer + match start interface, separated concerns.
 */

import React, { useEffect, useMemo } from 'react';
import { useRoute } from 'wouter';
import { useModels } from '@/hooks/useModels';
import useWormArenaStreaming from '@/hooks/useWormArenaStreaming';
import WormArenaGameBoard from '@/components/WormArenaGameBoard';
import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaHeaderStartAction from '@/components/WormArenaHeaderStartAction';
import WormArenaSetup from '@/components/WormArenaSetup';
import { Table, TableHead, TableHeader, TableRow, TableCell, TableBody } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

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

export default function WormArenaLive() {
  const [match, params] = useRoute('/worm-arena/live/:sessionId');
  const sessionId = params?.sessionId ?? '';

  const setupRef = React.useRef<HTMLDivElement>(null);

  // Model selection for starting new matches
  const { data: modelConfigs = [], isLoading: loadingModels, error: modelsError } = useModels();
  const snakeModels = React.useMemo(() => getSnakeEligibleModels(modelConfigs), [modelConfigs]);
  const selectableModels = React.useMemo(
    () => snakeModels.filter((m) => typeof m === 'string' && m.trim().length > 0),
    [snakeModels],
  );

  const [modelA, setModelA] = React.useState<string>('');
  const [selectedOpponents, setSelectedOpponents] = React.useState<string[]>([]);
  const [width, setWidth] = React.useState<number>(10);
  const [height, setHeight] = React.useState<number>(10);
  const [maxRounds, setMaxRounds] = React.useState<number>(150);
  const [numApples, setNumApples] = React.useState<number>(5);
  const [byoApiKey, setByoApiKey] = React.useState<string>('');
  const [byoProvider, setByoProvider] = React.useState<'openrouter' | 'openai' | 'anthropic' | 'xai' | 'gemini' | 'server-default'>('server-default');
  const [launchNotice, setLaunchNotice] = React.useState<string | null>(null);

  // Set preferred models on load
  React.useEffect(() => {
    if (selectableModels.length === 0) return;

    if (!modelA) {
      const preferredA = 'x-ai/grok-4.1-fast';
      const hasPreferredA = selectableModels.includes(preferredA);

      if (hasPreferredA) {
        setModelA(preferredA);
      } else if (selectableModels.length >= 1) {
        setModelA(selectableModels[0]);
      }
    }
  }, [selectableModels, modelA]);

  // Auto-populate opponents with top 9 models (excluding modelA)
  React.useEffect(() => {
    if (modelA && selectableModels.length > 0 && selectedOpponents.length === 0) {
      const topOpponents = selectableModels
        .filter(m => m !== modelA)
        .slice(0, 9);
      setSelectedOpponents(topOpponents);
    }
  }, [modelA, selectableModels, selectedOpponents.length]);

  // Live streaming
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
    batchResults,
    currentMatchIndex,
    totalMatches,
  } = useWormArenaStreaming();

  // Connect to stream if sessionId exists
  useEffect(() => {
    if (!sessionId) return;
    connect(sessionId);
    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect]);

  // Handle starting a new match or batch
  const handleRunMatch = async () => {
    if (!modelA || selectedOpponents.length === 0) return;

    const mappedOpponents = selectedOpponents.map(op => mapToSnakeBenchModelId(op));

    const payload: SnakeBenchRunMatchRequest = {
      modelA: mapToSnakeBenchModelId(modelA),
      modelB: '', // Will be set per opponent in backend
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
      const prep = await startLiveMatch(payload, mappedOpponents);
      if (prep?.liveUrl) {
        window.location.href = prep.liveUrl;
      }
    } catch (err: any) {
      console.error('[WormArenaLive] Failed to start match', err);
      setLaunchNotice(err?.message || 'Failed to start match');
    }
  };

  const handleScrollToSetup = () => {
    setTimeout(() => {
      setupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const latestFrame = useMemo(() => {
    if (frames.length === 0) return null;
    return frames[frames.length - 1];
  }, [frames]);

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
    <div className="min-h-screen" style={{ backgroundColor: '#f5f1e8', fontFamily: 'Fredoka, Nunito, sans-serif' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

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
        {/* Session Info */}
        <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-3" style={{ borderColor: '#d4b5a0' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold" style={{ color: '#3d2817' }}>Session</div>
              <div className="text-xs" style={{ color: '#7a6b5f' }} title={sessionId}>
                {sessionId ? sessionId.slice(0, 16) + '…' : 'No active session'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm" style={{ color: '#7a6b5f' }}>{infoText}</div>
              {statusBadge}
            </div>
          </div>
        </div>

        {/* Live Board & Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-lg border bg-white/90 shadow-sm px-4 py-4" style={{ borderColor: '#d4b5a0' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: '#3d2817' }}>🐛 Live Board</h2>
            {latestFrame ? (
              <WormArenaGameBoard frame={latestFrame.frame} boardWidth={boardWidth} boardHeight={boardHeight} />
            ) : (
              <div className="flex flex-col items-center justify-center h-64" style={{ color: '#7a6b5f' }}>
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

          <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-4 space-y-3" style={{ borderColor: '#d4b5a0' }}>
            <h2 className="text-sm font-semibold" style={{ color: '#3d2817' }}>📊 Status</h2>
            <div className="text-sm" style={{ color: '#7a6b5f', minHeight: '2rem' }}>{infoText}</div>

            {finalSummary && (
              <div className="space-y-2 border-t pt-3" style={{ borderColor: '#d4b5a0' }}>
                <div className="text-sm font-semibold" style={{ color: '#3d2817' }}>✅ Final</div>
                <div className="text-xs" style={{ color: '#7a6b5f' }}>ID: {finalSummary.gameId.slice(0, 12)}</div>
                <div className="text-xs" style={{ color: '#7a6b5f' }}>
                  {finalSummary.modelA} vs {finalSummary.modelB}
                </div>
                <div className="text-xs" style={{ color: '#7a6b5f' }}>
                  Scores: {Object.entries(finalSummary.scores || {}).map(([k, v]) => (
                    <span key={k} className="mr-3">{k}:{v}</span>
                  ))}
                </div>
                <a
                  href={`/worm-arena?gameId=${encodeURIComponent(finalSummary.gameId)}`}
                  className="inline-block mt-2 px-4 py-2 rounded text-xs font-semibold text-white transition-all"
                  style={{ backgroundColor: '#3d2817' }}
                >
                  View Replay
                </a>
                <div className="text-xs mt-2" style={{ color: '#7a6b5f' }}>
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
              <div className="text-xs" style={{ color: '#7a6b5f' }}>
                Final scores & replay link appear here once complete.
              </div>
            )}

            {error && <div className="text-xs text-red-600">Error: {error}</div>}
          </div>
        </div>

        {/* Batch Results Table - show when batch is running or completed */}
        {totalMatches && totalMatches > 1 && batchResults.length > 0 && (
          <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-4" style={{ borderColor: '#d4b5a0' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: '#3d2817' }}>✅ Completed Matches</h2>
            <ScrollArea className="max-h-[40vh] border rounded-md bg-white/90">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap font-bold" style={{ color: '#3d2817' }}>Match #</TableHead>
                    <TableHead className="font-bold" style={{ color: '#3d2817' }}>Models</TableHead>
                    <TableHead className="font-bold" style={{ color: '#3d2817' }}>Score</TableHead>
                    <TableHead className="font-bold" style={{ color: '#3d2817' }}>Result</TableHead>
                    <TableHead className="font-bold" style={{ color: '#3d2817' }}>Replay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchResults.map((result) => {
                    const modelAScore = result.scores?.[result.modelA] ?? 0;
                    const modelBScore = result.scores?.[result.modelB] ?? 0;
                    const resultLabel = modelAScore > modelBScore ? 'Win' : modelAScore < modelBScore ? 'Loss' : 'Tie';
                    const resultColor = resultLabel === 'Win' ? '#6b9e3f' : resultLabel === 'Loss' ? '#c85a3a' : '#3d2817';

                    return (
                      <TableRow key={result.gameId}>
                        <TableCell className="whitespace-nowrap">{result.index}/{result.total}</TableCell>
                        <TableCell className="text-xs font-mono">{result.modelA} vs {result.modelB}</TableCell>
                        <TableCell>{modelAScore}-{modelBScore}</TableCell>
                        <TableCell style={{ color: resultColor }} className="font-semibold">{resultLabel}</TableCell>
                        <TableCell>
                          <a
                            href={`/worm-arena?gameId=${encodeURIComponent(result.gameId)}`}
                            className="underline text-sm font-semibold"
                          >
                            View
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
            {totalMatches && batchResults.length < totalMatches && (
              <div className="text-xs mt-3" style={{ color: '#7a6b5f' }}>
                {batchResults.length}/{totalMatches} matches complete
              </div>
            )}
          </div>
        )}

        {/* Match Setup Controls */}
        <div ref={setupRef} className="rounded-lg border" style={{ backgroundColor: '#faf5f0', borderColor: '#d4b5a0' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: '#d4b5a0' }}>
            <span className="font-medium text-sm" style={{ color: '#3d2817' }}>
              🎮 Start New Match
            </span>
          </div>

          <div className="px-4 py-4 space-y-3">
            <WormArenaSetup
              modelA={modelA}
              selectableModels={selectableModels}
              selectedOpponents={selectedOpponents}
              isRunning={status === 'in_progress' || isStarting}
              loadingModels={loadingModels}
              modelsError={modelsError?.message}
              onModelAChange={setModelA}
              onOpponentsChange={setSelectedOpponents}
              byoApiKey={byoApiKey}
              byoProvider={byoProvider}
              onApiKeyChange={setByoApiKey}
              onProviderChange={setByoProvider}
              onRunMatch={handleRunMatch}
            />
            {launchNotice && (
              <div className="text-sm" style={{ color: '#7a6b5f' }} role="status">
                {launchNotice}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
