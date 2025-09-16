/**
 * useEloVoting.ts
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-16
 * PURPOSE: Hook for submitting Elo comparison votes and handling voting state
 * SRP and DRY check: Pass - Single responsibility (vote submission), reuses existing mutation patterns
 *
 * INTEGRATION:
 * - Follows established mutation patterns from existing hooks
 * - Uses TanStack Query for mutation state management
 * - Integrates with backend /api/elo/vote endpoint
 * - Handles optimistic updates and error recovery
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { ComparisonOutcome } from '../../../shared/types';

// Types for vote submission
interface VoteRequest {
  sessionId: string;
  explanationAId: number;
  explanationBId: number;
  outcome: ComparisonOutcome;
  puzzleId: string;
}

interface VoteResponse {
  newRatingA: number;
  newRatingB: number;
  ratingChangeA: number;
  ratingChangeB: number;
  voteRecorded: boolean;
}

/**
 * Hook for submitting Elo comparison votes
 */
export function useEloVoting() {
  const queryClient = useQueryClient();
  const [voteResult, setVoteResult] = useState<VoteResponse | null>(null);
  const [voteError, setVoteError] = useState<Error | null>(null);

  // Vote submission mutation
  const voteMutation = useMutation({
    mutationFn: async (voteData: VoteRequest): Promise<VoteResponse> => {
      const response = await apiRequest('POST', '/api/elo/vote', voteData);
      const jsonData = await response.json();

      if (!jsonData.success) {
        throw new Error(jsonData.error || 'Failed to submit vote');
      }

      return jsonData.data;
    },
    onSuccess: (data: VoteResponse, variables: VoteRequest) => {
      setVoteResult(data);
      setVoteError(null);

      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['elo-comparison'] });
      queryClient.invalidateQueries({ queryKey: ['elo-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['elo-model-stats'] });
      queryClient.invalidateQueries({ queryKey: ['elo-system-stats'] });

      // Optionally update specific comparison query cache
      const comparisonKey = ['elo-comparison', variables.puzzleId, variables.sessionId];
      queryClient.removeQueries({ queryKey: comparisonKey });
    },
    onError: (error: Error) => {
      setVoteError(error);
      setVoteResult(null);
    },
  });

  // Submit vote function
  const submitVote = async (voteData: VoteRequest) => {
    // Reset previous state
    setVoteError(null);
    setVoteResult(null);

    // Validate vote data
    if (!voteData.sessionId) {
      const error = new Error('Session ID is required');
      setVoteError(error);
      throw error;
    }

    if (!voteData.explanationAId || !voteData.explanationBId) {
      const error = new Error('Both explanation IDs are required');
      setVoteError(error);
      throw error;
    }

    if (voteData.explanationAId === voteData.explanationBId) {
      const error = new Error('Cannot vote between the same explanation');
      setVoteError(error);
      throw error;
    }

    if (!voteData.outcome) {
      const error = new Error('Outcome selection is required');
      setVoteError(error);
      throw error;
    }

    // Validate outcome is one of the valid enum values
    if (!['A_WINS', 'B_WINS', 'BOTH_BAD'].includes(voteData.outcome)) {
      const error = new Error('Invalid outcome value');
      setVoteError(error);
      throw error;
    }

    if (!voteData.puzzleId) {
      const error = new Error('Puzzle ID is required');
      setVoteError(error);
      throw error;
    }

    // Submit the vote
    return voteMutation.mutateAsync(voteData);
  };

  // Clear vote result (for new comparisons)
  const clearVoteResult = () => {
    setVoteResult(null);
    setVoteError(null);
  };

  return {
    submitVote,
    isSubmitting: voteMutation.isPending,
    voteResult,
    voteError,
    clearVoteResult,
    // Expose raw mutation for advanced usage
    mutation: voteMutation
  };
}

/**
 * Hook for tracking voting session statistics
 */
export function useVotingSession(sessionId: string) {
  return useState(() => {
    // Get session stats from localStorage
    const stored = localStorage.getItem(`voting-session-${sessionId}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { totalVotes: 0, startTime: Date.now() };
      }
    }
    return { totalVotes: 0, startTime: Date.now() };
  });
}

/**
 * Hook for managing voting preferences and settings
 */
export function useVotingPreferences() {
  const [preferences, setPreferences] = useState(() => {
    const stored = localStorage.getItem('elo-voting-preferences');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {
          showRatings: true,
          autoNextComparison: false,
          preferredPuzzleSource: 'any',
        };
      }
    }
    return {
      showRatings: true,
      autoNextComparison: false,
      preferredPuzzleSource: 'any',
    };
  });

  const updatePreferences = (newPreferences: Partial<typeof preferences>) => {
    const updated = { ...preferences, ...newPreferences };
    setPreferences(updated);
    localStorage.setItem('elo-voting-preferences', JSON.stringify(updated));
  };

  return {
    preferences,
    updatePreferences,
  };
}