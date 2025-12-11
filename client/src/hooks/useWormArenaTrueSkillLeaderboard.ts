/**
 * Author: Cascade
 * Date: 2025-12-10
 * PURPOSE: Hook for Worm Arena TrueSkill leaderboard. Fetches a
 *          SnakeBench-backed TrueSkill leaderboard for Worm Arena
 *          games with configurable limits.
 * SRP/DRY check: Pass — HTTP wiring only, no UI.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SnakeBenchTrueSkillLeaderboardEntry, SnakeBenchTrueSkillLeaderboardResponse } from '@shared/types';
import { apiRequest } from '@/lib/queryClient';

export interface WormArenaTrueSkillLeaderboardState {
  entries: SnakeBenchTrueSkillLeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWormArenaTrueSkillLeaderboard(limit: number = 150, minGames: number = 3): WormArenaTrueSkillLeaderboardState {
  const [entries, setEntries] = useState<SnakeBenchTrueSkillLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/snakebench/trueskill-leaderboard?limit=${encodeURIComponent(String(limit))}&minGames=${encodeURIComponent(String(minGames))}`;
      const res = await apiRequest('GET', url);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) {
        const raw = await res.text();
        const snippet = raw.slice(0, 200) || '<empty response>';
        throw new Error(
          `Leaderboard API returned non-JSON response (content-type: ${contentType || 'unknown'}). Snippet: ${snippet}`,
        );
      }

      const json = (await res.json()) as SnakeBenchTrueSkillLeaderboardResponse;
      if (!json.success) {
        throw new Error(json.error || 'Failed to load Worm Arena TrueSkill leaderboard');
      }
      setEntries(json.entries ?? []);
    } catch (e: any) {
      const message = e?.message || 'Failed to load Worm Arena TrueSkill leaderboard';
      setError(message);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit, minGames]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, isLoading, error, refresh };
}

export default useWormArenaTrueSkillLeaderboard;
