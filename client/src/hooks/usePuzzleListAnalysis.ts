/**
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-28
 * PURPOSE: Hook for analyzing a list of puzzle IDs to see which models solved them.
 * Connects to the puzzle-analysis.ts functionality via the new /api/puzzle/analyze-list endpoint.
 * Returns structured data for displaying model performance on user-specified puzzles.
 * SRP and DRY check: Pass - Single responsibility of managing puzzle list analysis API calls
 * shadcn/ui: N/A - This is a data hook
 */

import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface PuzzleResult {
  puzzle_id: string;
  correct_models: string[];
  total_attempts: number;
}

export interface PuzzleStatus {
  puzzleId: string;
  status: 'correct' | 'incorrect' | 'not_attempted';
}

export interface ModelPuzzleMatrix {
  modelName: string;
  puzzleStatuses: PuzzleStatus[];
}

export interface PuzzleListAnalysisResponse {
  modelPuzzleMatrix: ModelPuzzleMatrix[];
  puzzleResults: PuzzleResult[];
  summary: {
    totalPuzzles: number;
    totalModels: number;
    perfectModels: number;     // Got ALL puzzles correct
    partialModels: number;     // Got some correct, some incorrect
    notAttemptedModels: number; // Never attempted any
  };
}

export function usePuzzleListAnalysis() {
  const mutation = useMutation({
    mutationFn: async (puzzleIds: string[]): Promise<PuzzleListAnalysisResponse> => {
      const response = await apiRequest('POST', '/api/puzzle/analyze-list', {
        body: JSON.stringify({ puzzleIds }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to analyze puzzle list');
      }

      const json = await response.json();
      return json.data as PuzzleListAnalysisResponse;
    },
    // Cache results for 10 minutes since puzzle analysis data doesn't change frequently
    gcTime: 10 * 60 * 1000,
  });

  return {
    // Main analysis function
    analyzePuzzleList: mutation.mutate,
    analyzePuzzleListAsync: mutation.mutateAsync,

    // Data
    data: mutation.data,

    // States
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,

    // Utility
    reset: mutation.reset,
  };
}