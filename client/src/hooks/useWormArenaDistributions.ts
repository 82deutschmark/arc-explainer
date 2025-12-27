/**
 * Author: Claude Haiku 4.5
 * Date: 2025-12-27
 * PURPOSE: Hook for fetching Worm Arena run length distribution data.
 *          Aggregates game lengths (rounds) by model and outcome (win/loss)
 *          with configurable minimum games threshold filter.
 * SRP/DRY check: Pass - focused exclusively on HTTP wiring and state management.
 */

import { useCallback, useEffect, useState } from 'react';
import type { WormArenaRunLengthDistributionData, WormArenaRunLengthDistributionResponse } from '@shared/types';
import { apiRequest } from '@/lib/queryClient';

export interface UseWormArenaDistributionsState {
  data: WormArenaRunLengthDistributionData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWormArenaDistributions(minGames: number = 5): UseWormArenaDistributionsState {
  const [data, setData] = useState<WormArenaRunLengthDistributionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/snakebench/run-length-distribution?minGames=${encodeURIComponent(String(minGames))}`;
      const res = await apiRequest('GET', url);
      const json = (await res.json()) as WormArenaRunLengthDistributionResponse;
      if (!json.success) {
        throw new Error(json.error || 'Failed to load run length distribution data');
      }
      setData(json.data ?? null);
    } catch (e: any) {
      const message = e?.message || 'Failed to load run length distribution data';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [minGames]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}

export default useWormArenaDistributions;
