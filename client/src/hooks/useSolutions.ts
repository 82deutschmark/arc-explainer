/**
 * useSolutions Hook
 * 
 * Manages community solutions data fetching and submission.
 * Follows TanStack Query patterns established in useModelLeaderboards.ts
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface Solution {
  id: string;
  puzzleId: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
  feedbackType: string;
  helpful_count?: number;
  not_helpful_count?: number;
  userVote?: 'helpful' | 'not_helpful' | null;
}

export interface SolutionSubmission {
  comment: string;
}

export function useSolutions(puzzleId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch solutions for puzzle
  const solutionsQuery = useQuery({
    queryKey: ['solutions', puzzleId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/puzzles/${puzzleId}/solutions`);
      const json = await response.json();
      
      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch solutions');
      }
      
      // Process solutions to include vote counts
      const solutionsWithVotes = await Promise.all(
        (json.data || []).map(async (solution: Solution) => {
          try {
            const votesResponse = await apiRequest('GET', `/api/solutions/${solution.id}/votes`);
            const votesJson = await votesResponse.json();
            
            if (votesJson.success) {
              return {
                ...solution,
                helpful_count: votesJson.data.helpful || 0,
                not_helpful_count: votesJson.data.notHelpful || 0
              };
            }
            return solution;
          } catch (err) {
            console.warn(`Failed to fetch votes for solution ${solution.id}:`, err);
            return solution;
          }
        })
      );
      
      return solutionsWithVotes as Solution[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!puzzleId,
  });
  
  // Submit new solution mutation
  const submitSolutionMutation = useMutation({
    mutationFn: async (submission: SolutionSubmission) => {
      const response = await apiRequest('POST', `/api/puzzles/${puzzleId}/solutions`, {
        comment: submission.comment
      });
      const json = await response.json();
      
      if (!json.success) {
        throw new Error(json.error || 'Failed to submit solution');
      }
      
      return json.data;
    },
    onSuccess: () => {
      // Invalidate and refetch solutions
      queryClient.invalidateQueries({ queryKey: ['solutions', puzzleId] });
      
      toast({
        title: "Success",
        description: "Your solution has been submitted!",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit solution. Please try again later.",
        variant: "destructive"
      });
    }
  });
  
  return {
    // Data
    solutions: solutionsQuery.data || [],
    
    // Loading states
    isLoading: solutionsQuery.isLoading,
    isSubmitting: submitSolutionMutation.isPending,
    
    // Error states
    error: solutionsQuery.error,
    submitError: submitSolutionMutation.error,
    
    // Actions
    submitSolution: (submission: SolutionSubmission) => submitSolutionMutation.mutate(submission),
    submitSolutionAsync: (submission: SolutionSubmission) => submitSolutionMutation.mutateAsync(submission),
    refetch: solutionsQuery.refetch,
    
    // Status
    isSuccess: solutionsQuery.isSuccess,
    isError: solutionsQuery.isError,
  };
}