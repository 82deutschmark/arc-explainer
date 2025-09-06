/**
 * useModelComparisons Hook
 * 
 * Fetches comprehensive model comparison data from the new metrics dashboard endpoint.
 * Provides cross-model analytics combining accuracy, trustworthiness, and feedback metrics.
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ModelComparison {
  modelName: string;
  accuracy: number;
  trustworthiness: number;
  userSatisfaction: number;
  attempts: number;
  costEfficiency: number;
}

interface ComprehensiveDashboard {
  accuracyStats: {
    totalSolverAttempts: number;
    overallAccuracyPercentage: number;
    topAccurateModels: Array<{
      modelName: string;
      accuracy: number;
      attempts: number;
    }>;
  };
  
  trustworthinessStats: {
    totalTrustworthinessAttempts: number;
    overallTrustworthiness: number;
    topTrustworthyModels: Array<{
      modelName: string;
      trustworthiness: number;
      attempts: number;
    }>;
  };
  
  feedbackStats: {
    totalFeedback: number;
    helpfulPercentage: number;
    topRatedModels: Array<{
      modelName: string;
      helpfulPercentage: number;
      feedbackCount: number;
    }>;
  };
  
  modelComparisons: ModelComparison[];
  
  performanceMetrics: {
    avgProcessingTime: number;
    totalCost: number;
    avgCostPerAttempt: number;
  };
}

export function useModelComparisons() {
  const query = useQuery({
    queryKey: ['model-comparisons'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/metrics/comprehensive-dashboard');
      const json = await response.json();
      return json.data as ComprehensiveDashboard;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - this is expensive query
  });

  return {
    // Raw dashboard data
    dashboard: query.data,
    
    // Extracted sections for convenience
    modelComparisons: query.data?.modelComparisons,
    performanceMetrics: query.data?.performanceMetrics,
    summaryStats: query.data ? {
      accuracy: query.data.accuracyStats,
      trustworthiness: query.data.trustworthinessStats,
      feedback: query.data.feedbackStats,
    } : undefined,

    // Query states
    isLoading: query.isLoading,
    error: query.error,
    isSuccess: query.isSuccess,
    isError: query.isError,

    // Actions
    refetch: query.refetch,
  };
}