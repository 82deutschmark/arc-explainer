/**
 * Author: Claude Sonnet 4
 * Date: 2025-12-19
 * PURPOSE: Hook for fetching models with games and full match history.
 *          Used by the WormArenaModels page to show every game a model has ever played.
 * SRP/DRY check: Pass - focused on model match history data fetching.
 */

import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type {
  WormArenaModelWithGames,
  SnakeBenchModelMatchHistoryEntry,
  SnakeBenchModelRating,
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
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest('GET', '/api/snakebench/models-with-games');
      const json = (await res.json()) as ModelsWithGamesResponse;
      if (!json.success) {
        setError(json.error || 'Failed to load models');
        setModels([]);
        return;
      }
      setModels(json.models);
    } catch (e: any) {
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
