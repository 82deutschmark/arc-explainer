/**
 * Author: Cascade
 * Date: 2025-12-02
 * PURPOSE: Lightweight hooks for interacting with the SnakeBench backend
 *          from the ARC Explainer frontend. Provides helpers for running
 *          single matches, small batches, and listing recent games.
 * SRP/DRY check: Pass — focused on HTTP wiring for SnakeBench endpoints.
 */

import { useState, useCallback } from 'react';
import type {
  SnakeBenchRunMatchRequest,
  SnakeBenchRunMatchResponse,
  SnakeBenchRunBatchRequest,
  SnakeBenchRunBatchResponse,
  SnakeBenchListGamesResponse,
  SnakeBenchGameSummary,
  SnakeBenchGameDetailResponse,
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
      setData(json.data ?? null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load game replay');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, fetchGame };
}
