/**
 * Author: Cascade
 * Date: 2025-12-19
 * PURPOSE: Lightweight hooks for interacting with the SnakeBench backend
 *          from the ARC Explainer frontend. Provides helpers for running
 *          single matches, small batches, and listing recent games.
 *
 *          useSnakeBenchGame uses smart replay fallbacks:
 *          - Server returns { data } for local files (local dev)
 *          - Server returns { replayUrl + fallbackUrls } for remote sources (deployment)
 *          - Client tries to fetch directly from replayUrl(s)
 *          - If browser fetch is blocked (commonly CORS), client falls back to
 *            same-origin /api/snakebench/games/:id/proxy
 * SRP/DRY check: Pass — focused on HTTP wiring for SnakeBench endpoints.
 */

import { useState, useCallback, useEffect } from 'react';
import type {
  SnakeBenchRunMatchRequest,
  SnakeBenchRunMatchResponse,
  SnakeBenchRunBatchRequest,
  SnakeBenchRunBatchResponse,
  SnakeBenchListGamesResponse,
  SnakeBenchGameSummary,
  SnakeBenchGameDetailResponse,
  SnakeBenchStatsResponse,
  SnakeBenchModelRatingResponse,
  SnakeBenchModelHistoryResponse,
} from '@shared/types';
import { apiRequest } from '@/lib/queryClient';

export function useSnakeBenchMatch() {
  const [lastRequest, setLastRequest] = useState<SnakeBenchRunMatchRequest | null>(null);
  const [lastResponse, setLastResponse] = useState<SnakeBenchRunMatchResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runMatch = useCallback(async (req: SnakeBenchRunMatchRequest) => {
    setIsRunning(true);
    setError(null);
    setLastRequest(req);
    try {
      const res = await apiRequest('POST', '/api/snakebench/run-match', req);
      const json = (await res.json()) as SnakeBenchRunMatchResponse;
      setLastResponse(json);
      if (!json.success) {
        setError(json.error || 'SnakeBench match failed');
      }
      return json;
    } catch (e: any) {
      const message = e?.message || 'SnakeBench match failed';
      setError(message);
      setLastResponse({ success: false, error: message, timestamp: Date.now() });
      throw e;
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { runMatch, lastRequest, lastResponse, isRunning, error };
}

export function useSnakeBenchBatch() {
  const [lastRequest, setLastRequest] = useState<SnakeBenchRunBatchRequest | null>(null);
  const [lastResponse, setLastResponse] = useState<SnakeBenchRunBatchResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBatch = useCallback(async (req: SnakeBenchRunBatchRequest) => {
    setIsRunning(true);
    setError(null);
    setLastRequest(req);
    try {
      const res = await apiRequest('POST', '/api/snakebench/run-batch', req);
      const json = (await res.json()) as SnakeBenchRunBatchResponse;
      setLastResponse(json);
      if (!json.success) {
        setError(json.error || 'SnakeBench batch failed');
      }
      return json;
    } catch (e: any) {
      const message = e?.message || 'SnakeBench batch failed';
      setError(message);
      setLastResponse({ success: false, error: message, timestamp: Date.now() } as SnakeBenchRunBatchResponse);
      throw e;
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { runBatch, lastRequest, lastResponse, isRunning, error };
}

export function useSnakeBenchRecentGames() {
  const [games, setGames] = useState<SnakeBenchGameSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (limit: number = 10) => {
    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/snakebench/games?limit=${encodeURIComponent(String(limit))}`;
      const res = await apiRequest('GET', url);
      const json = (await res.json()) as SnakeBenchListGamesResponse;
      if (!json.success) {
        setError('Failed to load Worm Arena games');
        setGames([]);
        setTotal(0);
        return;
      }
      setGames(json.games || []);
      setTotal(json.total || 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Worm Arena games');
      setGames([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { games, total, isLoading, error, refresh };
}

/**
 * Hook to fetch a single SnakeBench game replay.
 *
 * Matches upstream SnakeBench pattern:
 * - If server returns { data }, use it directly (local dev)
 * - If server returns { replayUrl }, fetch from that URL (deployment)
 *
 * This eliminates server-side JSON proxy truncation issues.
 */
export function useSnakeBenchGame(gameId?: string) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGame = useCallback(async (id: string) => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest('GET', `/api/snakebench/games/${encodeURIComponent(id)}`);
      const json = (await res.json()) as SnakeBenchGameDetailResponse;
      if (!json.success) {
        setError(json.error || 'Failed to load game replay');
        setData(null);
        return;
      }

      // Option 1: Server returned data directly (local dev)
      if (json.data) {
        setData(json.data);
        return;
      }

      // Option 2: Server returned replayUrl - fetch directly (deployment)
      // Try primary URL first, then fallbacks (snakebench.com, GitHub raw, etc.)
      // If browser fetch is blocked (commonly CORS), fall back to same-origin proxy.
      if (json.replayUrl || json.fallbackUrls?.length) {
        const urlsToTry = [json.replayUrl, ...(json.fallbackUrls || [])].filter(Boolean) as string[];
        let lastError = '';

        for (const url of urlsToTry) {
          try {
            const replayRes = await fetch(url);
            if (replayRes.ok) {
              const replayJson = await replayRes.json();
              setData(replayJson);
              return;
            }
            lastError = `HTTP ${replayRes.status} from ${url}`;
          } catch (e: any) {
            lastError = `${e?.message || 'fetch failed'} from ${url}`;
          }
        }

        // Direct fetch failed. Try same-origin proxy fallback.
        try {
          const proxyRes = await apiRequest('GET', `/api/snakebench/games/${encodeURIComponent(id)}/proxy`);
          const proxyJson = (await proxyRes.json()) as SnakeBenchGameDetailResponse;
          if (proxyJson.success && proxyJson.data) {
            setData(proxyJson.data);
            return;
          }
          lastError = proxyJson.error || lastError || 'proxy did not return data';
        } catch (e: any) {
          lastError = e?.message || lastError || 'proxy fetch failed';
        }

        // All strategies failed
        setError(`Failed to fetch replay: ${lastError}`);
        setData(null);
        return;
      }

      // Neither data nor replayUrl - unexpected
      setError('Server returned neither data nor replayUrl');
      setData(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load game replay');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, fetchGame };
}

export function useSnakeBenchStats() {
  const [stats, setStats] = useState<SnakeBenchStatsResponse['stats'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest('GET', '/api/snakebench/stats');
      const json = (await res.json()) as SnakeBenchStatsResponse;
      if (!json.success) {
        throw new Error(json.error || 'Failed to load Worm Arena stats');
      }
      setStats(json.stats ?? null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Worm Arena stats');
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, isLoading, error, refresh };
}

export function useModelRating(modelSlug?: string) {
  const [rating, setRating] = useState<SnakeBenchModelRatingResponse['rating'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (slug?: string) => {
      const target = (slug ?? modelSlug ?? '').trim();
      if (!target) {
        setRating(null);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const url = `/api/snakebench/model-rating?modelSlug=${encodeURIComponent(target)}`;
        const res = await apiRequest('GET', url);
        const json = (await res.json()) as SnakeBenchModelRatingResponse;
        if (!json.success) {
          throw new Error(json.error || 'Failed to load model rating');
        }
        setRating(json.rating ?? null);
      } catch (e: any) {
        setError(e?.message || 'Failed to load model rating');
        setRating(null);
      } finally {
        setIsLoading(false);
      }
    },
    [modelSlug],
  );

  return { rating, isLoading, error, refresh };
}

export function useModelHistory(modelSlug?: string, limit: number = 50) {
  const [history, setHistory] = useState<SnakeBenchModelHistoryResponse['history']>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (slug?: string) => {
      const target = (slug ?? modelSlug ?? '').trim();
      if (!target) {
        setHistory([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const url = `/api/snakebench/model-history?modelSlug=${encodeURIComponent(
          target,
        )}&limit=${encodeURIComponent(String(limit))}`;
        const res = await apiRequest('GET', url);
        const json = (await res.json()) as SnakeBenchModelHistoryResponse;
        if (!json.success) {
          throw new Error(json.error || 'Failed to load model history');
        }
        setHistory(json.history ?? []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load model history');
        setHistory([]);
      } finally {
        setIsLoading(false);
      }
    },
    [modelSlug, limit],
  );

  const historyForTable = history;
  const historyForChart = [...history].sort((a, b) => {
    const at = a.startedAt ? Date.parse(a.startedAt) : 0;
    const bt = b.startedAt ? Date.parse(b.startedAt) : 0;
    return at - bt;
  });

  return { historyForTable, historyForChart, isLoading, error, refresh };
}
