/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Hook for Worm Arena "Suggested Matchups" feature.
 *          Fetches interesting unplayed model pairings from the backend,
 *          supporting two modes: ladder (info gain) vs entertainment (watchability).
 *          Each matchup includes TrueSkill stats and explanation reasons.
 * SRP/DRY check: Pass - focused on HTTP wiring only.
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  WormArenaSuggestMode,
  WormArenaSuggestedMatchup,
  WormArenaSuggestMatchupsResponse,
} from '@shared/types';
import { apiRequest } from '@/lib/queryClient';

export interface UseWormArenaSuggestMatchupsState {
  matchups: WormArenaSuggestedMatchup[];
  mode: WormArenaSuggestMode;
  totalCandidates: number;
  isLoading: boolean;
  error: string | null;
  refresh: (newMode?: WormArenaSuggestMode) => Promise<void>;
}

export function useWormArenaSuggestMatchups(
  initialMode: WormArenaSuggestMode = 'ladder',
  limit: number = 10,
): UseWormArenaSuggestMatchupsState {
  const [matchups, setMatchups] = useState<WormArenaSuggestedMatchup[]>([]);
  const [mode, setMode] = useState<WormArenaSuggestMode>(initialMode);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (newMode?: WormArenaSuggestMode) => {
      const effectiveMode = newMode ?? mode;
      setIsLoading(true);
      setError(null);

      try {
        const url = `/api/snakebench/suggest-matchups?mode=${encodeURIComponent(effectiveMode)}&limit=${encodeURIComponent(String(limit))}`;
        const res = await apiRequest('GET', url);
        const json = (await res.json()) as WormArenaSuggestMatchupsResponse;

        if (!json.success) {
          throw new Error(json.error || 'Failed to load suggested matchups');
        }

        setMatchups(json.matchups ?? []);
        setMode(json.mode);
        setTotalCandidates(json.totalCandidates);
      } catch (e: any) {
        const message = e?.message || 'Failed to load suggested matchups';
        setError(message);
        setMatchups([]);
        setTotalCandidates(0);
      } finally {
        setIsLoading(false);
      }
    },
    [mode, limit],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { matchups, mode, totalCandidates, isLoading, error, refresh };
}

export default useWormArenaSuggestMatchups;
