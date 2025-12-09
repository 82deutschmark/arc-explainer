/**
 * Author: Cascade
 * Date: 2025-12-02
 * PURPOSE: Embed the external SnakeBench LLM Snake Arena frontend inside ARC Explainer.
 *          Uses VITE_SNAKEBENCH_URL to locate the Next.js app and renders it in an iframe,
 *          with a small wrapper header and helpful messaging when misconfigured.
 * SRP/DRY check: Pass  dedicated to embedding a single external app; reuses global layout & nav.
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
import { useSnakeBenchMatch, useSnakeBenchRecentGames } from '@/hooks/useSnakeBench';
import type { ModelConfig, SnakeBenchRunMatchRequest } from '@shared/types';

const SNAKEBENCH_URL_DEFAULT = 'https://snakebench.com';
const url = import.meta.env.VITE_SNAKEBENCH_URL ?? SNAKEBENCH_URL_DEFAULT;

function getSnakeEligibleModels(models: ModelConfig[]): string[] {
  return models
    .filter((m) => m.provider === 'OpenRouter')
    .map((m) => m.apiModelName || m.key)
    .filter(Boolean);
}

export default function SnakeArena() {
  const { data: modelConfigs = [], isLoading: loadingModels, error: modelsError } = useModels();
  const snakeModels = React.useMemo(() => getSnakeEligibleModels(modelConfigs), [modelConfigs]);

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

  const { runMatch, lastResponse, isRunning, error: matchError } = useSnakeBenchMatch();
  const { games, total, isLoading: loadingGames, error: gamesError, refresh } = useSnakeBenchRecentGames();

  React.useEffect(() => {
    if (snakeModels.length >= 2 && !modelA && !modelB) {
      setModelA(snakeModels[0]);
      setModelB(snakeModels[1]);
    }
  }, [snakeModels, modelA, modelB]);

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
        if (leaderboard mimData.success) setLeaderboard(leaderboardData.result);
      } catch {
        // Silently ignore if endpoints fail
      }
    };
    void fetchSummaries();
  }, [lastResponse]);

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
    await runMatch(payload);
    void refresh(10);
  };

  const renderConfigPanel = () => {
    const disabled = loadingModels || snakeModels.length < 2 || isRunning;

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
            {isRunning ? 'Running match…' : 'Run match'}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Model A</label>
            <Select value={modelA} onValueChange={setModelA} disabled={disabled}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={loadingModels ? 'Loading models…' : 'Select Model A'} />
              </SelectTrigger>
              <SelectContent className="max-h-64 text-xs">
                {snakeModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Model B</label>
            <Select value={modelB} onValueChange={setModelB} disabled={disabled}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={loadingModels ? 'Loading models…' : 'Select Model B'} />
              </SelectTrigger>
              <SelectContent className="max-h-64 text-xs">
                {snakeModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
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
            <Select value={byoProvider} onValueChange={(v: any) => setByoProvider(v)} disabled={disabled}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Use server keys" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="">Use server keys</SelectItem>
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
          {loadingGames && <p className="text-gray-500">Loading games…</p>}
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
                  <tr key={g.gameId} className="border-b last:border-0">
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

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] gap-3 p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Snake Arena</h1>
          <p className="text-sm text-muted-foreground">
            Embedded SnakeBench LLM Snake Arena UI from <span className="font-mono">{url}</span>.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={url} target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-[180px]">
        <div className="lg:col-span-2 space-y-3">{renderConfigPanel()}</div>
        <div>{renderRecentGames()}</div>
      </div>

      {!import.meta.env.VITE_SNAKEBENCH_URL && (
        <Alert variant="default" className="border-yellow-300 bg-yellow-50">
          <AlertTitle className="text-xs">Using default SnakeBench URL</AlertTitle>
          <AlertDescription className="text-xs">
            Set <code>VITE_SNAKEBENCH_URL</code> in your environment to customize the embedded SnakeBench UI (e.g., for staging/local).
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 border rounded-md overflow-hidden bg-black/5">
        <iframe
          src={url}
          title="SnakeBench Snake Arena"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
