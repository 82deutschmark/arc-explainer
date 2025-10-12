/**
 * Author: Sonnet 4.5
 * Date: 2025-10-12
 * PURPOSE: Coordinates ALL puzzle data fetching to eliminate race conditions.
 * Previously: 3 independent hooks fired separately causing partial renders and layout shifts.
 * Now: Single hook waits for ALL queries before returning, ensuring complete data on first render.
 * SRP/DRY check: Pass - Single responsibility (data fetching coordination)
 * DaisyUI: N/A - Data hook
 */

import { useModels } from './useModels';
import { usePuzzle } from './usePuzzle';
import { usePuzzleWithExplanation } from './useExplanation';
import type { ARCTask } from '@shared/types';
import type { ModelConfig } from '@/types/puzzle';
import type { AnalysisResult } from '@/types/puzzle';

export interface PuzzleDataResult {
  // Puzzle data
  puzzle: ARCTask | null;
  models: ModelConfig[] | undefined;
  explanations: AnalysisResult[];

  // Loading states - coordinated across all queries
  isLoading: boolean;
  isLoadingPuzzle: boolean;
  isLoadingModels: boolean;
  isLoadingExplanations: boolean;

  // Error states
  error: Error | null;
  puzzleError: Error | null;
  modelsError: Error | null;

  // Refetch function
  refetchExplanations: () => void;
}

/**
 * Coordinates fetching of puzzle, models, and explanations data
 *
 * @param taskId - The puzzle task ID to load
 * @returns Coordinated puzzle data with unified loading state
 *
 * Benefits:
 * - Eliminates race conditions from independent queries
 * - Prevents partial renders and layout shifts
 * - Single source of truth for loading state
 * - Ensures all data is ready before component renders
 */
export function usePuzzleData(taskId: string | undefined): PuzzleDataResult {
  // Fetch all data sources
  const { data: models, isLoading: isLoadingModels, error: modelsError } = useModels();
  const { currentTask: puzzle, isLoadingTask: isLoadingPuzzle, taskError: puzzleError } = usePuzzle(taskId);
  const {
    explanations,
    isLoading: isLoadingExplanations,
    refetchExplanations
  } = usePuzzleWithExplanation(taskId);

  // Coordinate loading state - wait for ALL queries
  const isLoading = isLoadingModels || isLoadingPuzzle || (isLoadingExplanations ?? false);

  // Aggregate errors (prioritize puzzle error, then models error)
  const error = puzzleError || modelsError || null;

  return {
    puzzle,
    models,
    explanations: explanations || [],
    isLoading,
    isLoadingPuzzle,
    isLoadingModels,
    isLoadingExplanations: isLoadingExplanations ?? false,
    error,
    puzzleError,
    modelsError,
    refetchExplanations
  };
}
