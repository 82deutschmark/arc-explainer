/**
 * usePerformanceInsights Hook
 * 
 * Manages data for performance analysis components including confidence analysis,
 * speed/efficiency metrics, and cross-cutting performance insights.
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ConfidenceStats {
  totalExplanationsWithConfidence: number;
  avgConfidenceWhenCorrect: number;
  avgConfidenceWhenIncorrect: number;
  confidenceCalibrationGap: number;
  overconfidenceRate: number;
  underconfidenceRate: number;
  modelConfidenceAnalysis: Array<{
    modelName: string;
    avgConfidence: number;
    avgConfidenceWhenCorrect: number;
    avgConfidenceWhenIncorrect: number;
    confidenceCalibrationGap: number;
    totalExplanations: number;
    correctExplanations: number;
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
  speedLeaders: Array<{
    modelName: string;
    avgProcessingTime: number;
    totalAttempts: number;
    avgTrustworthiness: number;
  }>;
  efficiencyLeaders: Array<{
    modelName: string;
    avgCost: number;
    avgTrustworthiness: number;
    costEfficiencyRatio: number;
    totalAttempts: number;
  }>;
  overallTrustworthiness: number;
}

export function usePerformanceInsights() {
  const confidenceQuery = useQuery({
    queryKey: ['confidence-analysis'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzle/confidence-stats');
      const json = await response.json();
      return json.data as ConfidenceStats;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const performanceQuery = useQuery({
    queryKey: ['performance-insights'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzle/performance-stats');
      const json = await response.json();
      return json.data as PerformanceLeaderboards;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    // Raw data
    confidenceStats: confidenceQuery.data,
    performanceStats: performanceQuery.data,

    // Derived insights
    speedLeaders: performanceQuery.data?.speedLeaders,
    efficiencyLeaders: performanceQuery.data?.efficiencyLeaders,
    confidenceAnalysis: confidenceQuery.data?.modelConfidenceAnalysis,

    // Loading states
    isLoadingConfidence: confidenceQuery.isLoading,
    isLoadingPerformance: performanceQuery.isLoading,
    isLoadingAny: confidenceQuery.isLoading || performanceQuery.isLoading,

    // Error states
    confidenceError: confidenceQuery.error,
    performanceError: performanceQuery.error,
    hasAnyError: confidenceQuery.error || performanceQuery.error,

    // Success states
    isSuccess: confidenceQuery.isSuccess && performanceQuery.isSuccess,
    hasAnyData: confidenceQuery.data || performanceQuery.data,

    // Actions
    refetchConfidence: confidenceQuery.refetch,
    refetchPerformance: performanceQuery.refetch,
    refetchAll: () => Promise.all([confidenceQuery.refetch(), performanceQuery.refetch()]),
  };
}