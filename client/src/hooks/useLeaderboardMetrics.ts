/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Derived hook that composes `useModelLeaderboards` data into reusable summaries for the
 *          rebuilt leaderboards page. Ensures UI consumes real AccuracyRepository and MetricsRepository
 *          data with consistent memoized shapes.
 * SRP/DRY check: Pass — dedicated to aggregating leaderboard data for presentation components.
 */

import { useMemo } from 'react';
import { useModelLeaderboards } from './useModelLeaderboards';
import type {
  AccuracyStats,
  LeaderboardData,
  LeaderboardQueryState,
  LeaderboardSummary,
  LeaderboardSummaryTotals,
  ModelPerformanceRow,
  OverconfidentModel,
  PerformanceLeaderboards,
  ReliabilityStat,
  TrustworthinessLeader,
} from '@/types/leaderboards';
import { LEADERBOARD_LIMITS, LEADERBOARD_THRESHOLDS } from '@/constants/leaderboard';

const selectTopAccuracyModels = (accuracyStats?: AccuracyStats) => {
  if (!accuracyStats?.modelAccuracyRankings) {
    return [] as AccuracyStats['modelAccuracyRankings'];
  }

  const rankings = accuracyStats.modelAccuracyRankings;
  const filtered = rankings.filter(model => model.totalAttempts >= LEADERBOARD_THRESHOLDS.SIGNIFICANT_ATTEMPTS);
  const source = filtered.length > 0 ? filtered : rankings;
  return [...source]
    .sort((a, b) => b.accuracyPercentage - a.accuracyPercentage)
    .slice(0, LEADERBOARD_LIMITS.TOP_MODELS);
};

const selectTopTrustworthyModels = (performanceStats?: PerformanceLeaderboards) => {
  if (!performanceStats?.trustworthinessLeaders) {
    return [] as TrustworthinessLeader[];
  }
  return performanceStats.trustworthinessLeaders.slice(0, LEADERBOARD_LIMITS.TOP_MODELS);
};

const selectTopReliableModels = (reliabilityStats?: ReliabilityStat[]) => {
  if (!reliabilityStats) {
    return [] as ReliabilityStat[];
  }
  return [...reliabilityStats]
    .sort((a, b) => b.reliability - a.reliability)
    .slice(0, LEADERBOARD_LIMITS.TOP_MODELS);
};

const selectHighRiskModels = (overconfidentModels?: OverconfidentModel[]) => {
  if (!overconfidentModels) {
    return [] as OverconfidentModel[];
  }
  return [...overconfidentModels]
    .sort((a, b) => b.overconfidenceRate - a.overconfidenceRate)
    .slice(0, LEADERBOARD_LIMITS.TOP_MODELS);
};

const buildTotals = (accuracyStats?: AccuracyStats): LeaderboardSummaryTotals => ({
  totalAttempts: accuracyStats?.totalSolverAttempts ?? 0,
  totalCorrect: accuracyStats?.totalCorrectPredictions ?? 0,
  overallAccuracyPercentage: accuracyStats?.overallAccuracyPercentage ?? null,
  trackedModels: accuracyStats?.modelAccuracyRankings?.length ?? 0,
});

const buildPerformanceRows = (
  accuracyStats?: AccuracyStats,
  performanceStats?: PerformanceLeaderboards,
  reliabilityStats?: ReliabilityStat[]
) => {
  const rows = new Map<string, ModelPerformanceRow>();

  accuracyStats?.modelAccuracyRankings.forEach(model => {
    rows.set(model.modelName, {
      modelName: model.modelName,
      accuracyPercentage: model.accuracyPercentage,
      totalAttempts: model.totalAttempts,
    });
  });

  performanceStats?.trustworthinessLeaders.forEach(leader => {
    const existing = rows.get(leader.modelName) ?? { modelName: leader.modelName };
    rows.set(leader.modelName, {
      ...existing,
      modelName: leader.modelName,
      trustworthiness: leader.avgTrustworthiness,
      avgConfidence: leader.avgConfidence,
      totalAttempts: existing.totalAttempts,
    });
  });

  reliabilityStats?.forEach(stat => {
    const existing = rows.get(stat.modelName) ?? { modelName: stat.modelName };
    rows.set(stat.modelName, {
      ...existing,
      modelName: stat.modelName,
      reliability: stat.reliability,
      totalAttempts: existing.totalAttempts ?? stat.totalRequests,
    });
  });

  return Array.from(rows.values())
    .sort((a, b) => {
      const accuracyDiff = (b.accuracyPercentage ?? 0) - (a.accuracyPercentage ?? 0);
      if (accuracyDiff !== 0) return accuracyDiff;
      const trustDiff = (b.trustworthiness ?? 0) - (a.trustworthiness ?? 0);
      if (trustDiff !== 0) return trustDiff;
      return (b.reliability ?? 0) - (a.reliability ?? 0);
    })
    .slice(0, LEADERBOARD_LIMITS.TABLE_ROWS);
};

export function useLeaderboardMetrics() {
  const leaderboard = useModelLeaderboards();

  const data: LeaderboardData = {
    accuracyStats: leaderboard.accuracyStats,
    performanceStats: leaderboard.performanceStats,
    feedbackStats: leaderboard.feedbackStats,
    reliabilityStats: leaderboard.reliabilityStats,
    overconfidentModels: leaderboard.overconfidentModels,
  };

  const summary: LeaderboardSummary = useMemo(() => ({
    totals: buildTotals(data.accuracyStats),
    topAccuracyModels: selectTopAccuracyModels(data.accuracyStats),
    topTrustworthyModels: selectTopTrustworthyModels(data.performanceStats),
    mostReliableModels: selectTopReliableModels(data.reliabilityStats),
    highestRiskModels: selectHighRiskModels(data.overconfidentModels),
  }), [data.accuracyStats, data.performanceStats, data.reliabilityStats, data.overconfidentModels]);

  const performanceRows = useMemo(
    () => buildPerformanceRows(data.accuracyStats, data.performanceStats, data.reliabilityStats),
    [data.accuracyStats, data.performanceStats, data.reliabilityStats]
  );

  const state: LeaderboardQueryState = {
    isLoadingAny: leaderboard.isLoadingAny,
    isLoadingAll: leaderboard.isLoadingAll,
    hasAnyError: leaderboard.hasAnyError,
    isSuccess: leaderboard.isSuccess,
  };

  return {
    data,
    summary,
    performanceRows,
    queryState: state,
    refetch: leaderboard.refetch,
    errors: {
      accuracy: leaderboard.accuracyError,
      performance: leaderboard.performanceError,
      feedback: leaderboard.feedbackError,
      reliability: leaderboard.reliabilityError,
      overconfident: leaderboard.overconfidentError,
    },
    loading: {
      accuracy: leaderboard.isLoadingAccuracy,
      performance: leaderboard.isLoadingPerformance,
      feedback: leaderboard.isLoadingFeedback,
      reliability: leaderboard.isLoadingReliability,
      overconfident: leaderboard.isLoadingOverconfident,
    },
  };
}

