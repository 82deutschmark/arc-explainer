/**
 * useVoting Hook
 * 
 * Encapsulates voting logic for solutions.
 * Provides optimistic updates and error handling.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Solution } from './useSolutions';

type VoteType = 'helpful' | 'not_helpful';

export function useVoting(puzzleId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({});
  
  const voteMutation = useMutation({
    mutationFn: async ({ solutionId, voteType }: { solutionId: string; voteType: VoteType }) => {
      const response = await apiRequest('POST', `/api/solutions/${solutionId}/vote`, {
        feedbackType: voteType
      });
      const json = await response.json();
      
      if (!json.success) {
        throw new Error(json.error || 'Failed to submit vote');
      }
      
      return json.data;
    },
    onMutate: async ({ solutionId, voteType }) => {
      // Set loading state
      setVotingStates(prev => ({ ...prev, [solutionId]: true }));
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['solutions', puzzleId] });
      
      // Snapshot the previous value
      const previousSolutions = queryClient.getQueryData<Solution[]>(['solutions', puzzleId]);
      
      // Optimistically update
      queryClient.setQueryData<Solution[]>(['solutions', puzzleId], (old) => {
        if (!old) return old;
        
        return old.map(solution => {
          if (solution.id === solutionId) {
            const isRemovingVote = solution.userVote === voteType;
            
            // Calculate new vote counts
            let helpful_count = solution.helpful_count || 0;
            let not_helpful_count = solution.not_helpful_count || 0;
            
            // Remove old vote if exists
            if (solution.userVote === 'helpful' && voteType !== 'helpful') {
              helpful_count--;
            } else if (solution.userVote === 'not_helpful' && voteType !== 'not_helpful') {
              not_helpful_count--;
            }
            
            // Add new vote if not removing
            if (!isRemovingVote) {
              if (voteType === 'helpful') {
                helpful_count++;
              } else {
                not_helpful_count++;
              }
            }
            
            return {
              ...solution,
              userVote: isRemovingVote ? null : voteType,
              helpful_count,
              not_helpful_count
            };
          }
          return solution;
        });
      });
      
      return { previousSolutions };
    },
    onError: (err, variables, context) => {
      // Rollback optimistic update
      if (context?.previousSolutions) {
        queryClient.setQueryData(['solutions', puzzleId], context.previousSolutions);
      }
      
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit vote. Please try again later.",
        variant: "destructive"
      });
    },
    onSuccess: (_, { voteType }) => {
      toast({
        title: "Success",
        description: `Vote ${voteType === 'helpful' ? '👍' : '👎'} recorded`,
        variant: "default"
      });
    },
    onSettled: (_, __, { solutionId }) => {
      // Clear loading state
      setVotingStates(prev => ({ ...prev, [solutionId]: false }));
      
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['solutions', puzzleId] });
    }
  });
  
  return {
    // Actions
    vote: (solutionId: string, voteType: VoteType) => 
      voteMutation.mutate({ solutionId, voteType }),
    
    // States
    isVoting: (solutionId: string) => votingStates[solutionId] || false,
    isVotingAny: Object.values(votingStates).some(Boolean),
    
    // Status
    error: voteMutation.error,
  };
}