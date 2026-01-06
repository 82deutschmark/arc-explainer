/**
 * Author: Claude
 * Date: 2025-01-04
 * PURPOSE: Hook for fetching all recent Worm Arena matches (not model-specific).
 *          Used by WormArenaLive page to show recent match history.
 * SRP/DRY check: Pass - focused on HTTP wiring for recent matches only.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SnakeBenchMatchSearchResponse, SnakeBenchMatchSearchRow } from '@shared/types';
import { apiRequest } from '@/lib/queryClient';

export interface UseWormArenaAllRecentMatchesState {
    matches: SnakeBenchMatchSearchRow[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useWormArenaAllRecentMatches(
    limit: number = 10,
): UseWormArenaAllRecentMatchesState {
    const [matches, setMatches] = useState<SnakeBenchMatchSearchRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch all recent matches sorted by date, requiring at least minRounds=1 to satisfy the API constraint
            const url = `/api/snakebench/matches?minRounds=1&limit=${encodeURIComponent(String(limit))}&sortBy=startedAt&sortDir=desc`;
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
    }, [limit]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { matches, isLoading, error, refresh };
}

export default useWormArenaAllRecentMatches;
