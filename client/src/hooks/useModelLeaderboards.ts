/**
 * useModelLeaderboards Hook
 * 
 * Manages parallel data fetching for all leaderboard components.
 * Provides clean data access and loading states for the main leaderboard section.
 */

import { useQuery, useQueries } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface AccuracyStats {
  totalSolverAttempts: number;
  totalCorrectPredictions: number;
  overallAccuracyPercentage: number;
  modelAccuracyRankings: Array<{
    modelName: string;
    totalAttempts: number;
    correctPredictions: number;
    accuracyPercentage: number;
    singleTestAccuracy: number;
    multiTestAccuracy: number;
  }>;
}

interface PerformanceLeaderboards {
  trustworthinessLeaders: Array<{
    modelName: string;
    avgTrustworthiness: number;
    avgConfidence: number;
    avgProcessingTime: number;
    avgCost: number;
    totalCost: number;
  }>;
  speedLeaders: any[];
  efficiencyLeaders: any[];
  overallTrustworthiness: number;
}

interface FeedbackStats {
  totalFeedback: number;
  helpfulPercentage: number;
  topModels: Array<{
    modelName: string;
    feedbackCount: number;
    helpfulCount: number;
    notHelpfulCount: number;
    helpfulPercentage: number;
  }>;
  feedbackByModel: Record<string, {
    helpful: number;
    notHelpful: number;
  }>;
}

interface ReliabilityStats {
  modelName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  reliability: number;
}

export function useModelLeaderboards() {
  const queries = useQueries({
    queries: [
      {
        queryKey: ['accuracy-leaderboard'],
        queryFn: async () => {
          const response = await apiRequest('GET', '/api/feedback/accuracy-stats');
          const json = await response.json();
          return json.data as AccuracyStats;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
      {
        queryKey: ['trustworthiness-leaderboard'],
        queryFn: async () => {
          const response = await apiRequest('GET', '/api/puzzle/performance-stats');
          const json = await response.json();
          return json.data as PerformanceLeaderboards;
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ['feedback-leaderboard'],
        queryFn: async () => {
          const response = await apiRequest('GET', '/api/feedback/stats');
          const json = await response.json();
          return json.data as FeedbackStats;
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ['reliability-leaderboard'],
        queryFn: async () => {
          const response = await apiRequest('GET', '/api/metrics/reliability');
          const json = await response.json();
          return json.data as ReliabilityStats[];
        },
        staleTime: 5 * 60 * 1000,
      }
    ]
  });

  const [accuracyQuery, trustworthinessQuery, feedbackQuery, reliabilityQuery] = queries;

  return {
    // Individual data
    accuracyStats: accuracyQuery.data,
    performanceStats: trustworthinessQuery.data,
    feedbackStats: feedbackQuery.data,
    reliabilityStats: reliabilityQuery.data,

    // Loading states
    isLoadingAccuracy: accuracyQuery.isLoading,
    isLoadingPerformance: trustworthinessQuery.isLoading,
    isLoadingFeedback: feedbackQuery.isLoading,
    isLoadingReliability: reliabilityQuery.isLoading,
    isLoadingAny: queries.some(q => q.isLoading),
    isLoadingAll: queries.every(q => q.isLoading),

    // Error states
    accuracyError: accuracyQuery.error,
    performanceError: trustworthinessQuery.error,
    feedbackError: feedbackQuery.error,
    reliabilityError: reliabilityQuery.error,
    hasAnyError: queries.some(q => q.error),

    // Utility functions
    refetch: () => Promise.all(queries.map(q => q.refetch())),
    
    // Success states
    isSuccess: queries.every(q => q.isSuccess),
    hasAnyData: queries.some(q => q.data),
  };
}