import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ARCTask, PuzzleAnalysis, SolutionValidation } from '@shared/types';

export function usePuzzle(taskId?: string) {
  const [currentTask, setCurrentTask] = useState<ARCTask | null>(null);

  // Define response type for API calls
  interface APIResponse<T> {
    success: boolean;
    data: T;
  }

  // Load a specific puzzle task
  const { data: taskResponse, isLoading: taskLoading, error: taskError } = useQuery<APIResponse<ARCTask>>({
    queryKey: [`/api/puzzle/task/${taskId}`],
    enabled: !!taskId,
  });

  // Get AI analysis of the puzzle
  const { data: analysisResponse, isLoading: analysisLoading } = useQuery<APIResponse<PuzzleAnalysis>>({
    queryKey: [`/api/puzzle/analyze/${taskId}`],
    enabled: !!taskId,
  });
  
  // Extract data from response format
  const task = taskResponse?.success ? taskResponse.data : undefined;
  const analysis = analysisResponse?.success ? analysisResponse.data : undefined;

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
    analysis,
    isLoadingTask: taskLoading,
    isLoadingAnalysis: analysisLoading,
    taskError,
    submitSolution,
    solutionResult: solutionMutation.data as SolutionValidation | undefined,
    isSolutionSubmitting: solutionMutation.isPending,
  };
}

export function usePuzzleList(filters?: {
  maxGridSize?: number;
  minGridSize?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  gridSizeConsistent?: boolean;
  prioritizeUnexplained?: boolean;
  source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy';
  multiTestFilter?: 'single' | 'multi';
}) {
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

  // Define proper type for the API response
  interface APIResponse {
    success: boolean;
    data: any[];
  }
  
  const { data: responseData, isLoading, error } = useQuery<APIResponse>({
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

  // Debug log to help troubleshoot
  console.log('usePuzzleList response:', responseData, 'extracted puzzles:', puzzles.length);

  return {
    puzzles,
    isLoading,
    error,
  };
}

export function useWorstPerformingPuzzles(
  limit: number = 20, 
  sortBy: string = 'composite',
  minAccuracy?: number,
  maxAccuracy?: number,
  zeroAccuracyOnly?: boolean,
  source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy',
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
  
  const { data: responseData, isLoading, error } = useQuery({
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

  // Debug log to help troubleshoot
  console.log('useWorstPerformingPuzzles response:', responseData, 'extracted puzzles:', puzzles.length);

  return {
    puzzles,
    total,
    isLoading,
    error,
  };
}
