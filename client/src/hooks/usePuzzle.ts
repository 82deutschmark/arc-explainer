import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ARCTask, PuzzleAnalysis, SolutionValidation } from '@shared/types';

export function usePuzzle(taskId?: string) {
  const [currentTask, setCurrentTask] = useState<ARCTask | null>(null);

  // Load a specific puzzle task
  const { data: task, isLoading: taskLoading, error: taskError } = useQuery({
    queryKey: ['/api/puzzle/task', taskId],
    enabled: !!taskId,
  });

  // Get AI analysis of the puzzle
  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['/api/puzzle/analyze', taskId],
    enabled: !!taskId,
  });

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
    task: currentTask,
    analysis: analysis as PuzzleAnalysis | undefined,
    validation: solutionMutation.data as SolutionValidation | undefined,
    isLoadingTask: taskLoading,
    isLoadingAnalysis: analysisLoading,
    isValidating: solutionMutation.isPending,
    taskError,
    validationError: solutionMutation.error,
    submitSolution,
    resetValidation: () => solutionMutation.reset(),
  };
}

export function usePuzzleList() {
  const { data: puzzleList, isLoading, error } = useQuery({
    queryKey: ['/api/puzzle/list'],
  });

  return {
    puzzles: puzzleList || [],
    isLoading,
    error,
  };
}
