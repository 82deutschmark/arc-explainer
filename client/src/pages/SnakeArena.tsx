/**
 * Author: Cascade
 * Date: 2025-12-02
 * PURPOSE: Embed the external SnakeBench LLM Snake Arena frontend inside ARC Explainer.
 *          Uses VITE_SNAKEBENCH_URL to locate the Next.js app and renders it in an iframe,
 *          with a small wrapper header and helpful messaging when misconfigured.
 * SRP/DRY check:  to embedding a single external app; reuses global layout & nav.
 */

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useModels } from '@/hooks/useModels';
import { useSnakeBenchMatch, useSnakeBenchRecentGames, useSnakeBenchGame } from '@/hooks/useSnakeBench';
import type { ModelConfig, SnakeBenchRunMatchRequest } from '@shared/types';

function getSnakeEligibleModels(models: ModelConfig[]): string[] {
  const eligible = models
    .filter((m) => m.provider === 'OpenRouter')
    .map((m) => {
      const name = m.apiModelName || m.key;
      // Validate: must exist and have non-whitespace content
      return (name && typeof name === 'string' && name.trim().length > 0) ? name.trim() : null;
    })
    .filter((m): m is string => m !== null);
  return eligible;
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

export default function SnakeArena() {
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
  const [byoProvider, setByoProvider] = React.useState<'openrouter' | 'openai' | 'anthropic' | 'xai' | 'gemini' | ''>('');
  const [recentActivity, setRecentActivity] = React.useState<{ days: number; gamesPlayed: number; uniqueModels: number } | null>(null);
  const [leaderboard, setLeaderboard] = React.useState<Array<{ modelSlug: string; gamesPlayed: number; wins: number; losses: number; ties: number; winRate?: number }>>([]);
  const [selectedGameId, setSelectedGameId] = React.useState<string>('');
  const [frameIndex, setFrameIndex] = React.useState<number>(0);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);

  const { runMatch, lastResponse, isRunning, error: matchError } = useSnakeBenchMatch();
  const { games, total, isLoading: loadingGames, error: gamesError, refresh } = useSnakeBenchRecentGames();
  const { data: replayData, isLoading: loadingReplay, error: replayError, fetchGame } = useSnakeBenchGame(selectedGameId);

  React.useEffect(() => {
    if (selectableModels.length >= 2 && !modelA && !modelB) {
      setModelA(selectableModels[0]);
      setModelB(selectableModels[1]);
    }
  }, [selectableModels, modelA, modelB]);

  React.useEffect(() => {
    void refresh(10);
  }, [refresh]);

  React.useEffect(() => {
    const fetchSummaries = async () => {
      try {
        const [activityRes, leaderboardRes] = await Promise.all([
          fetch('/api/snakebench/recent-activity?days=7'),
          fetch('/api/snakebench/leaderboard?limit=5&sortBy=gamesPlayed'),
        ]);
        const activityData = await activityRes.json();
        const leaderboardData = await leaderboardRes.json();
        if (activityData.success) setRecentActivity(activityData.result);
        if (leaderboardData.success) setLeaderboard(leaderboardData.result);
      } catch {
        // Silently ignore if endpoints fail
      }
    };
    void fetchSummaries();
  }, [lastResponse]);

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
      modelA,
      modelB,
      width,
      height,
      maxRounds,
      numApples,
      ...(byoApiKey && byoProvider ? { apiKey: byoApiKey, provider: byoProvider } : {}),
    };
    const result = await runMatch(payload);
    if (result?.gameId) {
      setSelectedGameId(result.gameId);
    }
    void refresh(10);
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

  const renderConfigPanel = () => {
    const disabled = loadingModels || selectableModels.length < 2 || isRunning;
    const hasValidModels = selectableModels.length >= 2;

    return (
      <div className="border rounded-md p-4 bg-white/70 space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-gray-700">Match-up Controls</h2>
            <p className="text-xs text-muted-foreground">
              Choose two OpenRouter models and basic game settings, then run a single SnakeBench match.
            </p>
          </div>
          <Button size="sm" onClick={handleRunMatch} disabled={disabled || !modelA || !modelB}>
            {isRunning ? 'Running match...' : 'Run match'}
          </Button>
        </div>

        {modelsError && (
          <Alert variant="destructive">
            <AlertTitle>Model catalog error</AlertTitle>
            <AlertDescription className="text-xs">
              {modelsError.message}
            </AlertDescription>
          </Alert>
        )}

        {loadingModels && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertTitle>Loading models...</AlertTitle>
            <AlertDescription className="text-xs">Fetching available OpenRouter models.</AlertDescription>
          </Alert>
        )}

        {!loadingModels && !hasValidModels && !modelsError && (
          <Alert variant="destructive">
            <AlertTitle>No models available</AlertTitle>
            <AlertDescription className="text-xs">
              Could not load OpenRouter models. Please refresh and try again.
            </AlertDescription>
          </Alert>
        )}

        {hasValidModels && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Model A</label>
                <Select value={modelA || ''} onValueChange={setModelA} disabled={disabled}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={loadingModels ? 'Loading models...' : 'Select Model A'} />
                  </SelectTrigger>
                  {selectableModels.length > 0 && (
                    <SelectContent className="max-h-64 text-xs">
                      {selectableModels.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  )}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Model B</label>
                <Select value={modelB || ''} onValueChange={setModelB} disabled={disabled}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={loadingModels ? 'Loading models...' : 'Select Model B'} />
                  </SelectTrigger>
                  {selectableModels.length > 0 && (
                    <SelectContent className="max-h-64 text-xs">
                      {selectableModels.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  )}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="space-y-1.5">
            <label className="font-medium text-gray-700">Width</label>
            <Input
              type="number"
              className="h-8 text-xs"
              min={4}
              max={50}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value) || 10)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-medium text-gray-700">Height</label>
            <Input
              type="number"
              className="h-8 text-xs"
              min={4}
              max={50}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value) || 10)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-medium text-gray-700">Max rounds</label>
            <Input
              type="number"
              className="h-8 text-xs"
              min={10}
              max={500}
              value={maxRounds}
              onChange={(e) => setMaxRounds(Number(e.target.value) || 150)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-medium text-gray-700">Apples</label>
            <Input
              type="number"
              className="h-8 text-xs"
              min={1}
              max={20}
              value={numApples}
              onChange={(e) => setNumApples(Number(e.target.value) || 5)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1.5">
            <label className="font-medium text-gray-700">Provider (BYO key)</label>
            <Select value={byoProvider || 'none'} onValueChange={(v) => setByoProvider(v === 'none' ? '' : (v as any))} disabled={disabled}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Use server keys" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="none">Use server keys</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="xai">xAI</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="font-medium text-gray-700">API Key (BYO)</label>
            <Input
              type="password"
              className="h-8 text-xs"
              placeholder="Optional per-request key"
              value={byoApiKey}
              onChange={(e) => setByoApiKey(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        {matchError && (
          <Alert variant="destructive">
            <AlertTitle>Latest match error</AlertTitle>
            <AlertDescription className="text-xs">{matchError}</AlertDescription>
          </Alert>
        )}

            {lastResponse?.success && lastResponse.result && (
              <div className="border-t pt-3 mt-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-800">Last match</div>
                    <div className="text-gray-600">
                      {lastResponse.result.modelA} vs {lastResponse.result.modelB} — game {lastResponse.result.gameId}
                    </div>
                  </div>
                  <div className="flex gap-4 text-gray-800">
                    <div>
                      <div className="font-semibold">Scores</div>
                      <div className="text-gray-700">
                        {Object.entries(lastResponse.result.scores).map(([m, s]) => (
                          <span key={m} className="mr-3">
                            <span className="font-mono">{m}</span>: {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">Result</div>
                      <div className="text-gray-700">
                        {Object.entries(lastResponse.result.results).map(([m, r]) => (
                          <span key={m} className="mr-3">
                            <span className="font-mono">{m}</span>: {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderReplayPanel = () => {
    const selectedMeta = games.find((g) => g.gameId === selectedGameId);
    const models = (replayData?.metadata?.models as string[] | undefined) ?? [];
    const finalScores = replayData?.metadata?.final_scores ?? replayData?.totals?.scores ?? {};
    const roundsPlayed = selectedMeta?.roundsPlayed ?? replayData?.metadata?.actual_rounds ?? replayData?.game?.rounds_played ?? frames.length ?? 0;
    const startedAt = selectedMeta?.startedAt ?? replayData?.metadata?.start_time ?? replayData?.game?.started_at ?? '';

    return (
      <div className="border rounded-md p-4 bg-white/70 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-gray-700">Worm Arena Replays</h2>
            <p className="text-xs text-muted-foreground">Local replay viewer (JSON-compatible with upstream SnakeBench).</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => refresh(15)} disabled={loadingGames}>
              Refresh list
            </Button>
            <Button size="sm" variant={isPlaying ? 'destructive' : 'default'} onClick={() => setIsPlaying((v) => !v)} disabled={frames.length === 0}>
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-1 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">Games</span>
              {gamesError && <span className="text-red-600">{gamesError}</span>}
            </div>
            <div className="border rounded bg-white/80 max-h-64 overflow-y-auto text-[11px]">
              {loadingGames && <div className="p-2 text-gray-500">Loading games...</div>}
              {!loadingGames && games.length === 0 && <div className="p-2 text-gray-500">No games yet.</div>}
              {!loadingGames && games.length > 0 && (
                <table className="w-full text-left">
                  <tbody>
                    {games.map((g) => (
                      <tr
                        key={g.gameId}
                        className={`border-b last:border-0 cursor-pointer ${selectedGameId === g.gameId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        onClick={() => setSelectedGameId(g.gameId)}
                      >
                        <td className="py-2 px-2">
                          <div className="font-mono text-[10px] truncate" title={g.gameId}>{g.gameId}</div>
                          <div className="text-gray-600">{g.totalScore} pts · {g.roundsPlayed} rds</div>
                          <div className="text-gray-500">{g.startedAt ? new Date(g.startedAt).toLocaleString() : ''}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {!loadingGames && total > games.length && (
              <div className="text-[10px] text-gray-500">Showing {games.length} of {total}.</div>
            )}
          </div>

          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-gray-700">
                  {selectedGameId ? `Game ${selectedGameId}` : 'Select a game'}
                </div>
                <div className="text-gray-600">
                  {models.length > 0 ? models.join(' vs ') : `${modelA || 'Model A'} vs ${modelB || 'Model B'}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setFrameIndex((idx) => Math.max(0, idx - 1))} disabled={frames.length === 0}>
                  Prev
                </Button>
                <div className="text-[11px] text-gray-700">
                  Frame {frames.length === 0 ? 0 : frameIndex + 1} / {frames.length || 0}
                </div>
                <Button size="sm" variant="outline" onClick={() => setFrameIndex((idx) => Math.min(frames.length - 1, idx + 1))} disabled={frames.length === 0}>
                  Next
                </Button>
              </div>
            </div>

            {replayError && <p className="text-[11px] text-red-600">Replay load error: {replayError}</p>}
            {loadingReplay && <p className="text-[11px] text-gray-500">Loading replay...</p>}

            <div className="grid md:grid-cols-3 gap-3 text-[11px]">
              <div className="space-y-1">
                <div className="font-semibold text-gray-700">Summary</div>
                <div className="text-gray-600">Rounds: {roundsPlayed}</div>
                <div className="text-gray-600">Started: {startedAt ? new Date(startedAt).toLocaleString() : '—'}</div>
                <div className="text-gray-600">Board: {boardWidth} × {boardHeight}</div>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-gray-700">Scores</div>
                {Object.keys(finalScores).length === 0 && <div className="text-gray-500">No scores yet.</div>}
                {Object.entries(finalScores).map(([k, v]) => (
                  <div key={k} className="text-gray-700">
                    <span className="font-mono mr-1">{k}</span> {v}
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-gray-700">Controls</div>
                <div className="text-gray-600">Click rows to load replay JSON.</div>
                <div className="text-gray-600">Use Prev/Next or Play for timeline.</div>
              </div>
            </div>

            <div className="border rounded bg-black text-green-200 font-mono text-[11px] leading-tight p-3 min-h-[260px] overflow-auto">
              {asciiFrame ? asciiFrame : 'No frames available for this game yet.'}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRecentGames = () => {
    return (
      <div className="border rounded-md p-4 bg-white/60">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <h2 className="text-xs font-semibold tracking-wide uppercase text-gray-700">Recent games (SnakeBench)</h2>
            <p className="text-[11px] text-muted-foreground">
              Loaded from <code>completed_games/game_index.json</code> inside the SnakeBench backend.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refresh(10)} disabled={loadingGames}>
            Refresh
          </Button>
        </div>
        {gamesError && (
          <p className="text-[11px] text-red-600 mb-1">{gamesError}</p>
        )}
        <div className="text-[11px] text-gray-800 max-h-40 overflow-y-auto">
          {loadingGames && <p className="text-gray-500">Loading games...</p>}
          {!loadingGames && games.length === 0 && <p className="text-gray-500">No games found yet.</p>}
          {!loadingGames && games.length > 0 && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2">Game</th>
                  <th className="py-1 pr-2">Score</th>
                  <th className="py-1 pr-2">Rounds</th>
                  <th className="py-1">Started</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr
                    key={g.gameId}
                    className={`border-b last:border-0 cursor-pointer ${selectedGameId === g.gameId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    onClick={() => setSelectedGameId(g.gameId)}
                  >
                    <td className="py-1 pr-2 font-mono text-[10px] truncate max-w-[120px]" title={g.gameId}>
                      {g.gameId}
                    </td>
                    <td className="py-1 pr-2">{g.totalScore}</td>
                    <td className="py-1 pr-2">{g.roundsPlayed}</td>
                    <td className="py-1 text-gray-600">
                      {g.startedAt ? new Date(g.startedAt).toLocaleString() : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loadingGames && total > games.length && (
            <p className="mt-1 text-[10px] text-gray-500">Showing {games.length} of {total} games.</p>
          )}
        </div>
      </div>
    );
  };

  const renderSummaries = () => {
    return (
      <div className="border rounded-md p-4 bg-white/60 space-y-3">
        <div>
          <h2 className="text-xs font-semibold tracking-wide uppercase text-gray-700">Local summaries</h2>
          <p className="text-[11px] text-muted-foreground">
            Lightweight activity and leaderboard from local DB (when available).
          </p>
        </div>

        {recentActivity && (
          <div className="text-[11px]">
            <div className="font-medium text-gray-700 mb-1">Recent activity (last {recentActivity.days} days)</div>
            <div className="flex gap-4 text-gray-600">
              <span>Games: <strong>{recentActivity.gamesPlayed}</strong></span>
              <span>Models: <strong>{recentActivity.uniqueModels}</strong></span>
            </div>
          </div>
        )}

        {leaderboard.length > 0 && (
          <div className="text-[11px]">
            <div className="font-medium text-gray-700 mb-1">Top models by games played</div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-2">Model</th>
                  <th className="py-1 pr-2">Games</th>
                  <th className="py-1 pr-2">W-L-T</th>
                  <th className="py-1">Win%</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((m) => (
                  <tr key={m.modelSlug} className="border-b last:border-0">
                    <td className="py-1 pr-2 font-mono text-[10px] truncate max-w-[120px]" title={m.modelSlug}>
                      {m.modelSlug}
                    </td>
                    <td className="py-1 pr-2">{m.gamesPlayed}</td>
                    <td className="py-1 pr-2 text-gray-600">
                      {m.wins}-{m.losses}-{m.ties}
                    </td>
                    <td className="py-1 text-gray-600">
                      {m.winRate !== undefined ? `${(m.winRate * 100).toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!recentActivity && leaderboard.length === 0 && (
          <p className="text-[11px] text-gray-500">No local summary data available yet.</p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="text-sm text-muted-foreground">
        Worm Arena runs locally with your own API keys and stores replays in SnakeBench format. The official SnakeBench embed lives on its own page for global leaderboards.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-[180px]">
        <div className="space-y-3">{renderConfigPanel()}</div>
        <div className="lg:col-span-2 space-y-3">{renderReplayPanel()}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {renderRecentGames()}
        {renderSummaries()}
      </div>
    </div>
  );
}
