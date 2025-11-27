/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-26
 * PURPOSE: Hook to fetch community progress on ARC2-eval puzzles for the Poetiq solver.
 *          Returns ALL 120 puzzles with their status (solved/attempted/unattempted by Poetiq).
 *          Used by the PoetiqCommunity landing page to show the visual progress grid.
 * 
 *          Uses dedicated /api/poetiq/community-progress endpoint which:
 *          1. Reads ALL 120 puzzle IDs directly from file system (not deduplicated)
 *          2. Queries only Poetiq-specific explanations (model_name LIKE 'poetiq-%')
 * 
 * SRP/DRY check: Pass - Single responsibility for community Poetiq progress tracking
 */

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

export type PuzzleStatus = 'solved' | 'attempted' | 'unattempted';

export interface PoetiqPuzzleStatus {
  puzzleId: string;
  status: PuzzleStatus;
  modelName: string | null;
  createdAt: string | null;
  isPredictionCorrect: boolean | null;
  iterationCount: number | null;
  elapsedMs: number | null;
}

export interface PoetiqCommunityProgress {
  puzzles: PoetiqPuzzleStatus[];
  total: number;
  solved: number;
  attempted: number;
  unattempted: number;
  completionPercentage: number;
  isLoading: boolean;
  error: string | null;
}

const initialState: PoetiqCommunityProgress = {
  puzzles: [],
  total: 0,
  solved: 0,
  attempted: 0,
  unattempted: 0,
  completionPercentage: 0,
  isLoading: true,
  error: null,
};

/**
 * Hook for fetching Poetiq community progress on ARC2-eval puzzles
 * Returns all 120 puzzles with their Poetiq solver status
 */
export function usePoetiqCommunityProgress() {
  const [progress, setProgress] = useState<PoetiqCommunityProgress>(initialState);

  const fetchProgress = useCallback(async () => {
    try {
      setProgress(prev => ({ ...prev, isLoading: true, error: null }));

      // Use dedicated endpoint that:
      // 1. Reads ALL 120 puzzle IDs from file system (not deduplicated by puzzle loader)
      // 2. Queries ONLY Poetiq-specific explanations (model_name LIKE 'poetiq-%')
      const res = await apiRequest('GET', '/api/poetiq/community-progress');
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch Poetiq community progress');
      }

      const { puzzles, total, solved, attempted, unattempted, completionPercentage } = data.data;

      setProgress({
        puzzles,
        total,
        solved,
        attempted,
        unattempted,
        completionPercentage,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[PoetiqCommunityProgress] Error:', err);
      setProgress(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // Helper to get next recommended puzzle (first unattempted)
  const getNextRecommended = useCallback((): string | null => {
    const unattempted = progress.puzzles.find(p => p.status === 'unattempted');
    return unattempted?.puzzleId ?? null;
  }, [progress.puzzles]);

  // Helper to filter puzzles by status
  const filterByStatus = useCallback((status: PuzzleStatus): PoetiqPuzzleStatus[] => {
    return progress.puzzles.filter(p => p.status === status);
  }, [progress.puzzles]);

  return {
    ...progress,
    refetch: fetchProgress,
    getNextRecommended,
    filterByStatus,
  };
}
