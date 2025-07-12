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
 * Fetch the full explanation data for a puzzle, including feedback stats
 */
export function useExplanation(puzzleId: string | null) {
  return useQuery({
    queryKey: ['explanation', puzzleId],
    queryFn: async () => {
      if (!puzzleId) return null;
      const response = await apiRequest('GET', `/api/puzzle/${puzzleId}/explanation`);
      const data = await response.json();
      return data as ExplanationData;
    },
    enabled: !!puzzleId,
    retry: false, // Don't retry if the explanation doesn't exist
  });
}

/**
 * Combined hook that provides both the explanation status and data
 */
export function usePuzzleWithExplanation(puzzleId: string | null) {
  const { 
    data: statusData, 
    isLoading: statusLoading,
    error: statusError
  } = useHasExplanation(puzzleId);
  
  const { 
    data: explanation, 
    isLoading: explanationLoading,
    error: explanationError,
    refetch: refetchExplanation
  } = useExplanation(puzzleId);
  
  // Safely access the hasExplanation property with type checking
  const hasExplanation = statusData ? (statusData as ExplanationStatus).hasExplanation : false;
  
  return {
    // Basic data
    puzzleId,
    hasExplanation,
    explanation,
    
    // Loading states
    isLoading: statusLoading || (hasExplanation && explanationLoading),
    
    // Errors
    error: statusError || explanationError,
    
    // Actions
    refetchExplanation
  };
}
