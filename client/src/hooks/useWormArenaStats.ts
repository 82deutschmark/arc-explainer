/**
 * Author: Cascade
 * Date: 2025-12-10
 * PURPOSE: Hook for Worm Arena stats, backed by local SnakeBench tables.
 *          Fetches WormArena-only leaderboard and recent-activity data.
 * SRP/DRY check: Pass read-only stats wiring, no UI.
 */

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface WormArenaLeaderboardEntry {
  modelSlug: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  winRate?: number;
}

interface WormArenaRecentActivity {
  days: number;
  gamesPlayed: number;
  uniqueModels: number;
}

interface LeaderboardResponse {
  success: boolean;
  result?: WormArenaLeaderboardEntry[];
  error?: string;
}

interface RecentActivityResponse {
  success: boolean;
  result?: WormArenaRecentActivity;
  error?: string;
}

export function useWormArenaStats() {
  const [leaderboard, setLeaderboard] = useState<WormArenaLeaderboardEntry[]>([]);
  const [recentActivity, setRecentActivity] = useState<WormArenaRecentActivity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [lbRes, activityRes] = await Promise.all([
        apiRequest('GET', '/api/snakebench/leaderboard?limit=100&sortBy=gamesPlayed'),
        apiRequest('GET', '/api/snakebench/recent-activity?days=0'),
      ]);

      const lbJson = (await lbRes.json()) as LeaderboardResponse;
      const actJson = (await activityRes.json()) as RecentActivityResponse;

      if (!lbJson.success) {
        throw new Error(lbJson.error || 'Failed to load Worm Arena leaderboard');
      }
      if (!actJson.success) {
        throw new Error(actJson.error || 'Failed to load Worm Arena recent activity');
      }

      setLeaderboard(lbJson.result ?? []);
      setRecentActivity(actJson.result ?? null);
    } catch (e: any) {
      const message = e?.message || 'Failed to load Worm Arena stats';
      setError(message);
      setLeaderboard([]);
      setRecentActivity(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { leaderboard, recentActivity, isLoading, error, refresh };
}

export default useWormArenaStats;
