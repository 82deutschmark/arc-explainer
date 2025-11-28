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

export interface ModelStats {
  modelName: string;
  attempts: number;
  solved: number;
  successRate: number;
}

export interface PoetiqCommunityProgress {
  puzzles: PoetiqPuzzleStatus[];
  total: number;
  solved: number;
  attempted: number;
  unattempted: number;
  failed: number;
  completionPercentage: number;
  attemptedPercentage: number;
  successRateOnAttempted: number;
  avgIterationsSolved: number | null;
  avgIterationsFailed: number | null;
  modelStats: ModelStats[];
  isLoading: boolean;
  error: string | null;
}

const initialState: PoetiqCommunityProgress = {
  puzzles: [],
  total: 0,
  solved: 0,
  attempted: 0,
  unattempted: 0,
  failed: 0,
  completionPercentage: 0,
  attemptedPercentage: 0,
  successRateOnAttempted: 0,
  avgIterationsSolved: null,
  avgIterationsFailed: null,
  modelStats: [],
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

      // Calculate derived metrics
      const failed = attempted - solved;
      const attemptedPercentage = total > 0 ? Math.round((attempted / total) * 100) : 0;
      const successRateOnAttempted = attempted > 0 ? Math.round((solved / attempted) * 100) : 0;

      // Calculate average iterations for solved vs failed
      const solvedPuzzles = puzzles.filter((p: PoetiqPuzzleStatus) => p.status === 'solved' && p.iterationCount !== null);
      const failedPuzzles = puzzles.filter((p: PoetiqPuzzleStatus) => p.status === 'attempted' && p.iterationCount !== null);

      const avgIterationsSolved = solvedPuzzles.length > 0
        ? solvedPuzzles.reduce((sum: number, p: PoetiqPuzzleStatus) => sum + (p.iterationCount || 0), 0) / solvedPuzzles.length
        : null;

      const avgIterationsFailed = failedPuzzles.length > 0
        ? failedPuzzles.reduce((sum: number, p: PoetiqPuzzleStatus) => sum + (p.iterationCount || 0), 0) / failedPuzzles.length
        : null;

      // Calculate per-model stats
      const modelMap = new Map<string, { attempts: number; solved: number }>();
      puzzles.forEach((p: PoetiqPuzzleStatus) => {
        if (p.status === 'attempted' || p.status === 'solved') {
          const modelName = p.modelName || 'unknown';
          const current = modelMap.get(modelName) || { attempts: 0, solved: 0 };
          current.attempts += 1;
          if (p.status === 'solved') current.solved += 1;
          modelMap.set(modelName, current);
        }
      });

      const modelStats: ModelStats[] = Array.from(modelMap.entries()).map(([modelName, stats]) => ({
        modelName,
        attempts: stats.attempts,
        solved: stats.solved,
        successRate: stats.attempts > 0 ? Math.round((stats.solved / stats.attempts) * 100) : 0,
      }));

      setProgress({
        puzzles,
        total,
        solved,
        attempted,
        unattempted,
        failed,
        completionPercentage,
        attemptedPercentage,
        successRateOnAttempted,
        avgIterationsSolved: avgIterationsSolved ? Math.round(avgIterationsSolved * 10) / 10 : null,
        avgIterationsFailed: avgIterationsFailed ? Math.round(avgIterationsFailed * 10) / 10 : null,
        modelStats,
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
