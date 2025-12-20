/**
 * Author: Claude Sonnet 4.5
 * Date: 2025-12-20
 * PURPOSE: Hook for fetching recent matches for a specific Worm Arena model.
 *          Fetches from /api/snakebench/matches endpoint with model slug filter.
 *          Used by WormArenaRecentMatches component.
 * SRP/DRY check: Pass - focused on HTTP wiring for recent matches only.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SnakeBenchMatchSearchResponse, SnakeBenchMatchSearchRow } from '@shared/types';
import { apiRequest } from '@/lib/queryClient';

export interface UseWormArenaRecentMatchesState {
  matches: SnakeBenchMatchSearchRow[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWormArenaRecentMatches(
  modelSlug: string,
  limit: number = 10,
): UseWormArenaRecentMatchesState {
  const [matches, setMatches] = useState<SnakeBenchMatchSearchRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!modelSlug) {
      setMatches([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/snakebench/matches?model=${encodeURIComponent(modelSlug)}&limit=${encodeURIComponent(String(limit))}&sortBy=startedAt&sortDir=desc`;
      const res = await apiRequest('GET', url);
      const json = (await res.json()) as SnakeBenchMatchSearchResponse;
      if (!json.success) {
        throw new Error(json.error || 'Failed to load recent matches');
      }
      setMatches(json.rows ?? []);
    } catch (e: any) {
      const message = e?.message || 'Failed to load recent matches';
      setError(message);
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  }, [modelSlug, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { matches, isLoading, error, refresh };
}

export default useWormArenaRecentMatches;
