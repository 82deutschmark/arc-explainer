/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * PURPOSE: Hook to fetch Poetiq solver progress on ARC2-eval puzzles.
 *          Shows which puzzles have been solved and which remain.
 * 
 * SRP/DRY check: Pass - Single responsibility for ARC2-eval Poetiq progress
 */

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface Arc2EvalPuzzle {
  puzzleId: string;
  hasExplanation: boolean;
  explanationId: string | null;
  modelName: string | null;
  createdAt: string | null;
  confidence: number | null;
  estimatedCost: number | null;
  apiProcessingTimeMs: number | null;
  feedbackCount: number;
  isSolved: boolean;
}

export interface Arc2EvalProgress {
  puzzles: Arc2EvalPuzzle[];
  total: number;
  solved: number;
  attempted: number;
  isLoading: boolean;
  error: string | null;
}

export function useArc2EvalProgress() {
  const [progress, setProgress] = useState<Arc2EvalProgress>({
    puzzles: [],
    total: 0,
    solved: 0,
    attempted: 0,
    isLoading: true,
    error: null,
  });

  const fetchProgress = useCallback(async () => {
    try {
      setProgress(prev => ({ ...prev, isLoading: true, error: null }));

      // First, get all ARC2-eval puzzle IDs
      const listRes = await apiRequest('GET', '/api/puzzle/list?dataset=ARC2-Eval&limit=200');
      const listData = await listRes.json();
      
      if (!listData.success || !listData.data?.puzzles) {
        throw new Error('Failed to fetch ARC2-eval puzzle list');
      }

      const puzzleIds = listData.data.puzzles.map((p: any) => p.puzzleId);

      // Then get Poetiq explanations for those puzzles
      const statusRes = await apiRequest('POST', '/api/puzzle/bulk-status', { puzzleIds });
      const statusData = await statusRes.json();

      if (!statusData.success) {
        throw new Error('Failed to fetch puzzle status');
      }

      const puzzles: Arc2EvalPuzzle[] = puzzleIds.map((id: string) => {
        const status = statusData.data[id];
        return {
          puzzleId: id,
          hasExplanation: status?.hasExplanation || false,
          explanationId: status?.explanationId || null,
          modelName: status?.modelName || null,
          createdAt: status?.createdAt || null,
          confidence: status?.confidence || null,
          estimatedCost: status?.estimatedCost || null,
          apiProcessingTimeMs: status?.apiProcessingTimeMs || null,
          feedbackCount: status?.feedbackCount || 0,
          isSolved: status?.isSolved || false,
        };
      });

      const solved = puzzles.filter(p => p.isSolved).length;
      const attempted = puzzles.filter(p => p.hasExplanation).length;

      setProgress({
        puzzles,
        total: puzzles.length,
        solved,
        attempted,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Arc2EvalProgress] Error:', err);
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

  return {
    ...progress,
    refetch: fetchProgress,
  };
}
