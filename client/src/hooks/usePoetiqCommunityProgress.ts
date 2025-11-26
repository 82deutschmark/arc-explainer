/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-26
 * PURPOSE: Hook to fetch community progress on ARC2-eval puzzles for the Poetiq solver.
 *          Returns ALL puzzles with their status (solved/attempted/unattempted by Poetiq).
 *          Used by the PoetiqCommunity landing page to show the visual progress grid.
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

      // Get all ARC2-eval puzzle IDs
      const listRes = await apiRequest('GET', '/api/puzzle/list?source=ARC2-Eval&limit=200');
      const listData = await listRes.json();
      
      if (!listData.success || !Array.isArray(listData.data)) {
        throw new Error('Failed to fetch ARC2-eval puzzle list');
      }

      const allPuzzleIds: string[] = listData.data.map((p: any) => p.puzzleId);
      const total = allPuzzleIds.length;

      // Get explanation status for all puzzles
      const statusRes = await apiRequest('POST', '/api/puzzle/bulk-status', { 
        puzzleIds: allPuzzleIds,
        // Request Poetiq-specific filtering
        modelPrefix: 'poetiq-'
      });
      const statusData = await statusRes.json();

      if (!statusData.success) {
        throw new Error('Failed to fetch puzzle status');
      }

      // Build puzzle status array for ALL puzzles
      const puzzles: PoetiqPuzzleStatus[] = allPuzzleIds.map((puzzleId: string) => {
        const status = statusData.data?.[puzzleId];
        
        // Check if this puzzle has a Poetiq explanation
        const hasPoetiqExplanation = status?.hasExplanation && 
          status?.modelName?.toLowerCase().startsWith('poetiq-');
        
        if (!hasPoetiqExplanation) {
          return {
            puzzleId,
            status: 'unattempted' as PuzzleStatus,
            modelName: null,
            createdAt: null,
            isPredictionCorrect: null,
            iterationCount: null,
            elapsedMs: null,
          };
        }

        // Has Poetiq explanation - check if solved
        const isSolved = status?.isSolved === true || status?.isPredictionCorrect === true;
        
        return {
          puzzleId,
          status: isSolved ? 'solved' as PuzzleStatus : 'attempted' as PuzzleStatus,
          modelName: status?.modelName || null,
          createdAt: status?.createdAt || null,
          isPredictionCorrect: status?.isPredictionCorrect ?? null,
          iterationCount: status?.iterationCount ?? null,
          elapsedMs: status?.apiProcessingTimeMs ?? null,
        };
      });

      // Calculate stats
      const solved = puzzles.filter(p => p.status === 'solved').length;
      const attempted = puzzles.filter(p => p.status === 'attempted').length;
      const unattempted = puzzles.filter(p => p.status === 'unattempted').length;
      const completionPercentage = total > 0 ? Math.round((solved / total) * 100) : 0;

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
