/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-20
 * PURPOSE: Hooks for Worm Arena models list, match history, and per-model insights reports.
 * SRP/DRY check: Pass - focused on model-related data fetching.
 */

import { useState, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type {
  WormArenaModelWithGames,
  SnakeBenchModelMatchHistoryEntry,
  SnakeBenchModelRating,
  WormArenaModelInsightsReport,
  WormArenaModelInsightsResponse,
} from '../../../shared/types';

interface ModelsWithGamesResponse {
  success: boolean;
  models: WormArenaModelWithGames[];
  error?: string;
  timestamp: number;
}

interface ModelHistoryFullResponse {
  success: boolean;
  modelSlug: string;
  history: SnakeBenchModelMatchHistoryEntry[];
  rating?: SnakeBenchModelRating | null;
  error?: string;
  timestamp: number;
}

/**
 * Hook to fetch all models that have played games.
 * Only returns models with at least one game.
 */
export function useWormArenaModelsWithGames() {
  const [models, setModels] = useState<WormArenaModelWithGames[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    console.log('[useWormArenaModelsWithGames] Fetching models...');
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest('GET', '/api/snakebench/models-with-games');
      const json = (await res.json()) as ModelsWithGamesResponse;
      console.log('[useWormArenaModelsWithGames] Response:', json);
      if (!json.success) {
        setError(json.error || 'Failed to load models');
        setModels([]);
        return;
      }
      console.log('[useWormArenaModelsWithGames] Loaded', json.models.length, 'models');
      console.log('[useWormArenaModelsWithGames] First model:', json.models[0]);
      setModels(json.models);
    } catch (e: any) {
      console.error('[useWormArenaModelsWithGames] Error:', e);
      setError(e?.message || 'Failed to load models');
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { models, isLoading, error, fetchModels };
}

/**
 * Hook to fetch full match history for a specific model.
 * Returns ALL games the model has ever played (unbounded).
 */
export function useWormArenaModelHistory() {
  const [history, setHistory] = useState<SnakeBenchModelMatchHistoryEntry[]>([]);
  const [rating, setRating] = useState<SnakeBenchModelRating | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (modelSlug: string) => {
    if (!modelSlug) {
      setHistory([]);
      setRating(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest(
        'GET',
        `/api/snakebench/model-history-full?modelSlug=${encodeURIComponent(modelSlug)}`
      );
      const json = (await res.json()) as ModelHistoryFullResponse;
      if (!json.success) {
        setError(json.error || 'Failed to load match history');
        setHistory([]);
        setRating(null);
        return;
      }
      setHistory(json.history);
      setRating(json.rating ?? null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load match history');
      setHistory([]);
      setRating(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setRating(null);
    setError(null);
  }, []);

  return { history, rating, isLoading, error, fetchHistory, clearHistory };
}

/**
 * Hook to fetch actionable insights report for a specific model.
 */
export function useWormArenaModelInsights() {
  const [report, setReport] = useState<WormArenaModelInsightsReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestSlug = useRef<string | null>(null);

  const fetchReport = useCallback(async (modelSlug: string) => {
    if (!modelSlug) {
      setReport(null);
      setError('Model slug is required');
      return;
    }

    // Track the latest request so stale responses do not overwrite the UI.
    activeRequestSlug.current = modelSlug;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest(
        'GET',
        `/api/snakebench/model-insights?modelSlug=${encodeURIComponent(modelSlug)}`,
      );
      const json = (await res.json()) as WormArenaModelInsightsResponse;
      if (activeRequestSlug.current !== modelSlug) {
        return;
      }
      if (!json.success || !json.report) {
        setError(json.error || 'Failed to load model insights');
        setReport(null);
        return;
      }
      setReport(json.report);
    } catch (e: any) {
      setError(e?.message || 'Failed to load model insights');
      setReport(null);
    } finally {
      // Only clear loading state if this request is still the active one.
      if (activeRequestSlug.current === modelSlug) {
        setIsLoading(false);
      }
    }
  }, []);

  const clearReport = useCallback(() => {
    // Reset report state when the selected model changes.
    activeRequestSlug.current = null;
    setReport(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { report, isLoading, error, fetchReport, clearReport };
}

