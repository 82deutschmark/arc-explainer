/**
 * useExplanation Hook
 * @author Cascade
 * 
 * Custom hook for fetching explanation data and checking if a puzzle has been explained.
 * This hook integrates with the Railway PostgreSQL database via the API endpoints.
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ExplanationStatus {
  hasExplanation: boolean;
}

interface ExplanationData {
  id: number;
  puzzleId: string;
  patternDescription: string;
  solvingStrategy: string;
  hints: string[];
  alienMeaning: string;
  confidence: number;
  modelName: string;
  createdAt: string;
  feedbackStats?: {
    helpfulCount: number;
    notHelpfulCount: number;
    commentCount: number;
  };
}

/**
 * Check if a puzzle has an associated explanation
 */
export function useHasExplanation(puzzleId: string | null) {
  return useQuery({
    queryKey: ['explanation-status', puzzleId],
    queryFn: async () => {
      if (!puzzleId) return { hasExplanation: false };
      const response = await apiRequest('GET', `/api/puzzle/${puzzleId}/has-explanation`);
      const data = await response.json();
      return data as ExplanationStatus;
    },
    enabled: !!puzzleId,
  });
}

/**
 * Fetch all explanations for a given puzzle.
 */
export function useExplanations(puzzleId: string | null) {
  return useQuery<ExplanationData[], Error>({
    queryKey: ['explanations', puzzleId],
    queryFn: async () => {
      if (!puzzleId) return [];
      try {
        const response = await apiRequest('GET', `/api/puzzle/${puzzleId}/explanations`);
        if (!response.ok) {
          // If the endpoint doesn't exist or there's an error, return empty.
          if (response.status === 404) {
            return [];
          }
          throw new Error(`Failed to fetch explanations: ${response.statusText}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching explanations:", error);
        return []; // Return empty array on error
      }
    },
    enabled: !!puzzleId,
  });
}

/**
 * Combined hook that provides explanation data for a puzzle.
 */
export function usePuzzleWithExplanation(puzzleId: string | null) {
  const {
    data: explanations,
    isLoading,
    error,
    refetch
  } = useExplanations(puzzleId);

  return {
    explanations: explanations || [],
    isLoading,
    error,
    refetchExplanations: refetch,
    hasExplanation: (explanations?.length || 0) > 0,
  };
}
