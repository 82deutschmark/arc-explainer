/**
 * Author: Cascade
 * Date: 2025-12-11
 * PURPOSE: Hook for Worm Arena "Greatest Hits" matches.
 *          Fetches a small curated list of standout Worm Arena games
 *          (longest, most expensive, highest-scoring) from the backend
 *          and exposes a simple loading/error API for the replay UI.
 * SRP/DRY check: Pass  focused on HTTP wiring only.
 */

import { useCallback, useEffect, useState } from 'react';
import type { WormArenaGreatestHitGame, WormArenaGreatestHitsResponse } from '@shared/types';
import { apiRequest } from '@/lib/queryClient';

export interface UseWormArenaGreatestHitsState {
  games: WormArenaGreatestHitGame[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWormArenaGreatestHits(limitPerDimension: number = 5): UseWormArenaGreatestHitsState {
  const [games, setGames] = useState<WormArenaGreatestHitGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/snakebench/greatest-hits?limitPerDimension=${encodeURIComponent(String(limitPerDimension))}`;
      const res = await apiRequest('GET', url);
      const json = (await res.json()) as WormArenaGreatestHitsResponse;
      if (!json.success) {
        throw new Error(json.error || 'Failed to load Worm Arena greatest hits');
      }
      setGames(json.games ?? []);
    } catch (e: any) {
      const message = e?.message || 'Failed to load Worm Arena greatest hits';
      setError(message);
      setGames([]);
    } finally {
      setIsLoading(false);
    }
  }, [limitPerDimension]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { games, isLoading, error, refresh };
}

export default useWormArenaGreatestHits;
