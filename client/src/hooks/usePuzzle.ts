/**
 * Author: Cascade using GPT-4
 * Date: 2025-10-10T11:28:38-04:00
 * PURPOSE: Custom React hooks for puzzle data fetching and management.
 * Provides hooks for loading individual puzzles, puzzle lists, and worst-performing puzzles.
 * Uses TanStack Query for efficient data fetching, caching, and state management.
 * SRP and DRY check: Pass - Each hook has a single responsibility (puzzle data, list data, worst-performing data)
 * shadcn/ui: N/A - This is a data hook, not a UI component
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ARCTask, PuzzleAnalysis, SolutionValidation } from '@shared/types';

// Shared API response type
interface APIResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Hook for loading and managing a single puzzle task
 * @param taskId - Optional puzzle ID to load
 * @returns Puzzle data, analysis, loading states, and solution submission function
 */
export function usePuzzle(taskId?: string) {
  const [currentTask, setCurrentTask] = useState<ARCTask | null>(null);

  // Load a specific puzzle task
  const { data: taskResponse, isLoading: taskLoading, error: taskError } = useQuery<APIResponse<ARCTask>>({
    queryKey: [`/api/puzzle/task/${taskId}`],
    enabled: !!taskId,
  });

  // Extract data from response format
  const task = taskResponse?.success ? taskResponse.data : undefined;

  useEffect(() => {
    if (task) {
      setCurrentTask(task);
    }
  }, [task]);

  // Submit user solution for validation
  const solutionMutation = useMutation({
    mutationFn: async (solution: { 
      input: number[][], 
      userOutput: number[][], 
      correctOutput: number[][] 
    }) => {
      const response = await apiRequest('POST', '/api/puzzle/validate', solution);
      return response.json();
    },
  });

  const submitSolution = (solution: number[][]) => {
    if (!currentTask || currentTask.test.length === 0) {
      throw new Error('No current task or test data available');
    }

    solutionMutation.mutate({
      input: currentTask.test[0].input,
      userOutput: solution,
      correctOutput: currentTask.test[0].output,
    });
  };

  return {
    currentTask,
    task,
    isLoadingTask: taskLoading,
    taskError,
    submitSolution,
    solutionResult: (solutionMutation.data?.success ? solutionMutation.data.data : undefined) as SolutionValidation | undefined,
    isSolutionSubmitting: solutionMutation.isPending,
  };
}

// Type for puzzle list filters
interface PuzzleListFilters {
  maxGridSize?: number;
  minGridSize?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  gridSizeConsistent?: boolean;
  prioritizeUnexplained?: boolean;
  source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy' | 'ConceptARC';
  multiTestFilter?: 'single' | 'multi';
}

// Type for puzzle list item (based on API response structure)
interface PuzzleListItem {
  id: string;
  [key: string]: unknown; // Allow additional properties from API
}

/**
 * Hook for fetching a filtered list of puzzles
 * @param filters - Optional filter criteria for puzzles
 * @returns Filtered puzzle list, loading state, and error
 */
export function usePuzzleList(filters?: PuzzleListFilters) {
  const queryParams = new URLSearchParams();
  if (filters?.maxGridSize) queryParams.set('maxGridSize', filters.maxGridSize.toString());
  if (filters?.minGridSize) queryParams.set('minGridSize', filters.minGridSize.toString());
  if (filters?.difficulty) queryParams.set('difficulty', filters.difficulty);
  if (filters?.gridSizeConsistent !== undefined) queryParams.set('gridSizeConsistent', filters.gridSizeConsistent.toString());
  if (filters?.prioritizeUnexplained) queryParams.set('prioritizeUnexplained', 'true');
  if (filters?.source) queryParams.set('source', filters.source);
  if (filters?.multiTestFilter) queryParams.set('multiTestFilter', filters.multiTestFilter);

  const queryString = queryParams.toString();
  const url = `/api/puzzle/list${queryString ? `?${queryString}` : ''}`;
  
  const { data: responseData, isLoading, error } = useQuery<APIResponse<PuzzleListItem[]>>({
    queryKey: [url],
    queryFn: async () => {
      const response = await apiRequest('GET', url);
      return await response.json();
    },
  });

  // Extract puzzles from the response format { success: boolean, data: [...] }
  const puzzles = responseData?.success && Array.isArray(responseData.data)
    ? responseData.data
    : [];

  return {
    puzzles,
    isLoading,
    error,
  };
}

// Type for worst-performing puzzles response
interface WorstPerformingResponse {
  puzzles: PuzzleListItem[];
  total: number;
}

/**
 * Hook for fetching worst-performing puzzles based on AI model accuracy
 * @param limit - Maximum number of puzzles to return (default: 20)
 * @param sortBy - Sort criteria (default: 'composite')
 * @param minAccuracy - Minimum accuracy filter (0-100)
 * @param maxAccuracy - Maximum accuracy filter (0-100)
 * @param zeroAccuracyOnly - Filter for only puzzles with 0% accuracy
 * @param source - Dataset source filter
 * @param multiTestFilter - Filter by single or multi-test puzzles
 * @param includeRichMetrics - Include additional metrics in response
 * @returns Worst-performing puzzles, total count, loading state, and error
 */
export function useWorstPerformingPuzzles(
  limit: number = 20, 
  sortBy: string = 'composite',
  minAccuracy?: number,
  maxAccuracy?: number,
  zeroAccuracyOnly?: boolean,
  source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy' | 'ConceptARC',
  multiTestFilter?: 'single' | 'multi',
  includeRichMetrics?: boolean
) {
  const queryParams = new URLSearchParams();
  queryParams.set('limit', limit.toString());
  queryParams.set('sortBy', sortBy);
  
  if (minAccuracy !== undefined) queryParams.set('minAccuracy', (minAccuracy / 100).toString());
  if (maxAccuracy !== undefined) queryParams.set('maxAccuracy', (maxAccuracy / 100).toString());
  if (zeroAccuracyOnly) queryParams.set('zeroAccuracyOnly', 'true');
  if (source) queryParams.set('source', source);
  if (multiTestFilter) queryParams.set('multiTestFilter', multiTestFilter);
  if (includeRichMetrics) queryParams.set('includeRichMetrics', 'true');
  
  const queryString = queryParams.toString();
  const url = `/api/puzzle/worst-performing?${queryString}`;
  
  const { data: responseData, isLoading, error } = useQuery<APIResponse<WorstPerformingResponse>>({
    queryKey: [url],
    queryFn: async () => {
      const response = await apiRequest('GET', url);
      return await response.json();
    },
    refetchInterval: 60000, // Refetch every 60 seconds
    refetchOnWindowFocus: true, // Also refetch when window regains focus
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Extract puzzles from the response format { success: boolean, data: { puzzles: [...], total: number } }
  const puzzles = responseData?.success && responseData.data?.puzzles
    ? responseData.data.puzzles
    : [];

  const total = responseData?.success && responseData.data?.total
    ? responseData.data.total
    : 0;

  return {
    puzzles,
    total,
    isLoading,
    error,
  };
}
