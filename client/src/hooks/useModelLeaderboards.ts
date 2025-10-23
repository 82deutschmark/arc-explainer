/**
 * useModelLeaderboards Hook
 * 
 * Manages parallel data fetching for all leaderboard components.
 * Provides clean data access and loading states for the main leaderboard section.
 */

import { useQueries } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type {
  AccuracyStats,
  PerformanceLeaderboards,
  FeedbackStats,
  ReliabilityStat,
  OverconfidentModel
} from '@/types/leaderboards';

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
          return json.data as ReliabilityStat[];
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ['overconfident-models'],
        queryFn: async () => {
          const response = await apiRequest('GET', '/api/feedback/overconfident-models');
          const json = await response.json();
          return json.data as OverconfidentModel[];
        },
        staleTime: 5 * 60 * 1000,
      }
    ]
  });

  const [accuracyQuery, trustworthinessQuery, feedbackQuery, reliabilityQuery, overconfidentQuery] = queries;

  return {
    // Individual data
    accuracyStats: accuracyQuery.data,
    performanceStats: trustworthinessQuery.data,
    feedbackStats: feedbackQuery.data,
    reliabilityStats: reliabilityQuery.data as ReliabilityStat[] | undefined,
    overconfidentModels: overconfidentQuery.data,

    // Loading states
    isLoadingAccuracy: accuracyQuery.isLoading,
    isLoadingPerformance: trustworthinessQuery.isLoading,
    isLoadingFeedback: feedbackQuery.isLoading,
    isLoadingReliability: reliabilityQuery.isLoading,
    isLoadingOverconfident: overconfidentQuery.isLoading,
    isLoadingAny: queries.some(q => q.isLoading),
    isLoadingAll: queries.every(q => q.isLoading),

    // Error states
    accuracyError: accuracyQuery.error,
    performanceError: trustworthinessQuery.error,
    feedbackError: feedbackQuery.error,
    reliabilityError: reliabilityQuery.error,
    overconfidentError: overconfidentQuery.error,
    hasAnyError: queries.some(q => q.error),

    // Utility functions
    refetch: () => Promise.all(queries.map(q => q.refetch())),

    // Success states
    isSuccess: queries.every(q => q.isSuccess),
    hasAnyData: queries.some(q => q.data),
  };
}