/**
 * useExplanation Hook
 * @author Cascade
 * 
 * Custom hook for fetching explanation data and checking if a puzzle has been explained.
 * This hook integrates with the Railway PostgreSQL database via the API endpoints.
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ExplanationData } from '@/types/puzzle'; // Import the global type

interface ExplanationStatus {
  hasExplanation: boolean;
}

// This is the raw data structure from the backend API - now using camelCase (fixed)
interface RawExplanationData {
  id: number;
  puzzleId: string;
  modelName: string;
  patternDescription: string;
  solvingStrategy: string;
  hints: string[];
  alienMeaning: string;
  alienMeaningConfidence: number;
  confidence: number;
  helpfulCount: number;
  notHelpfulCount: number;
  totalFeedback: number;
  createdAt: string;
  saturnImages: any;
  saturnSuccess: boolean | null;
  predictedOutputGrid: any;
  isPredictionCorrect: boolean | null;
  apiProcessingTimeMs: number;
  hasReasoningLog: boolean;
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
      const json = await response.json();
      return json.data as ExplanationStatus;
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
          if (response.status === 404) {
            return [];
          }
          throw new Error(`Failed to fetch explanations: ${response.statusText}`);
        }
        const json = await response.json();
        const rawData: RawExplanationData[] = Array.isArray(json.data) ? json.data : [];

        // API already returns camelCase - just add explanationId mapping
        return rawData.map(raw => ({
          ...raw,
          helpfulVotes: raw.helpfulCount,
          notHelpfulVotes: raw.notHelpfulCount,
          explanationId: raw.id, // Ensure explanationId is mapped for feedback components
        }));
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
