/**
 * Feedback Hooks
 * @author Claude Code
 * 
 * Custom hooks for feedback data management, preview, and caching.
 * Provides convenient access to feedback data with proper loading states.
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Feedback, DetailedFeedback, FeedbackStats, FeedbackFilters } from '@shared/types';

/**
 * Hook to fetch feedback for a specific explanation
 */
export function useFeedbackForExplanation(explanationId: number | undefined): UseQueryResult<Feedback[]> {
  return useQuery({
    queryKey: ['feedback', 'explanation', explanationId],
    queryFn: async () => {
      if (!explanationId) return [];
      const response = await apiRequest('GET', `/api/explanation/${explanationId}/feedback`);
      const json = await response.json();
      return json.data as Feedback[];
    },
    enabled: !!explanationId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch feedback for a specific puzzle
 */
export function useFeedbackForPuzzle(puzzleId: string | undefined): UseQueryResult<DetailedFeedback[]> {
  return useQuery({
    queryKey: ['feedback', 'puzzle', puzzleId],
    queryFn: async () => {
      if (!puzzleId) return [];
      const response = await apiRequest('GET', `/api/puzzle/${puzzleId}/feedback`);
      const json = await response.json();
      return json.data as DetailedFeedback[];
    },
    enabled: !!puzzleId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch all feedback with optional filtering
 */
export function useFeedback(filters?: FeedbackFilters): UseQueryResult<DetailedFeedback[]> {
  return useQuery({
    queryKey: ['feedback', 'all', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            const serializedValue = value instanceof Date ? value.toISOString() : String(value);
            params.append(key, serializedValue);
          }
        });
      }
      
      const response = await apiRequest('GET', `/api/feedback?${params.toString()}`);
      const json = await response.json();
      return json.data as DetailedFeedback[];
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch feedback statistics
 */
export function useFeedbackStats() {
  return useQuery({
    queryKey: ['feedback', 'stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/feedback/stats');
      const json = await response.json();
      return json.data as FeedbackStats;
    },
    staleTime: 60000, // 1 minute - stats change less frequently
  });
}

/**
 * Hook for feedback preview functionality
 * Returns a preview of recent feedback for display in tooltips or small previews
 */
export function useFeedbackPreview(explanationId: number | undefined, maxItems = 3) {
  const { data: feedback, isLoading, error } = useFeedbackForExplanation(explanationId);
  
  const preview = feedback?.slice(0, maxItems) || [];
  const hasMore = (feedback?.length || 0) > maxItems;
  const summary = {
    total: feedback?.length || 0,
    helpful: feedback?.filter(f => f.feedbackType === 'helpful').length || 0,
    notHelpful: feedback?.filter(f => f.feedbackType === 'not_helpful').length || 0,
  };

  return {
    feedback: preview,
    hasMore,
    summary,
    isLoading,
    error,
    isEmpty: !feedback || feedback.length === 0
  };
}

/**
 * Hook for puzzle feedback summary
 * Provides aggregated feedback data for a puzzle across all explanations
 */
export function usePuzzleFeedbackSummary(puzzleId: string | undefined) {
  const { data: feedback, isLoading, error } = useFeedbackForPuzzle(puzzleId);
  
  const summary = {
    total: feedback?.length || 0,
    helpful: feedback?.filter(f => f.feedbackType === 'helpful').length || 0,
    notHelpful: feedback?.filter(f => f.feedbackType === 'not_helpful').length || 0,
    recentFeedback: feedback?.slice(0, 5) || [],
    modelBreakdown: {} as Record<string, { helpful: number; notHelpful: number }>
  };

  // Calculate model breakdown
  if (feedback) {
    feedback.forEach(f => {
      if (!summary.modelBreakdown[f.modelName]) {
        summary.modelBreakdown[f.modelName] = { helpful: 0, notHelpful: 0 };
      }
      if (f.feedbackType === 'helpful') {
        summary.modelBreakdown[f.modelName].helpful++;
      } else if (f.feedbackType === 'not_helpful') {
        summary.modelBreakdown[f.modelName].notHelpful++;
      }
    });
  }

  const helpfulPercentage = summary.total > 0 ? Math.round((summary.helpful / summary.total) * 100) : 0;

  return {
    summary: {
      ...summary,
      helpfulPercentage
    },
    isLoading,
    error,
    isEmpty: !feedback || feedback.length === 0
  };
}