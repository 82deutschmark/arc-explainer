/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Composable leaderboards page consuming live statistics from the AccuracyRepository,
 *          MetricsRepository, and FeedbackRepository via `useModelLeaderboards`. Presents a concise
 *          hero, summary metrics, insights, and dedicated leaderboard components.
 * SRP/DRY check: Pass — orchestrates prebuilt components without duplicating data-fetching logic.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, GaugeCircle, ShieldCheck, ThumbsUp } from 'lucide-react';

import { LeaderboardPageHeader } from '@/components/overview/leaderboards/LeaderboardPageHeader';
import { LeaderboardSummaryGrid } from '@/components/overview/leaderboards/LeaderboardSummaryGrid';
import type { LeaderboardSummaryItem } from '@/components/overview/leaderboards/LeaderboardSummaryGrid';
import { LeaderboardInsights } from '@/components/overview/leaderboards/LeaderboardInsights';
import { LeaderboardSection } from '@/components/overview/leaderboards/LeaderboardSection';
import { ReliabilityLeaderboard } from '@/components/overview/leaderboards/ReliabilityLeaderboard';
import { useModelLeaderboards } from '@/hooks/useModelLeaderboards';

function formatPercentage(value?: number, decimals = 1): string | undefined {
  if (value === undefined || Number.isNaN(value)) {
    return undefined;
  }
  return `${value.toFixed(decimals)}%`;
}

const determineTone = (value?: number, positiveThreshold = 70, warningThreshold = 50) => {
  if (value === undefined) {
    return 'default' as const;
  }
  if (value >= positiveThreshold) {
    return 'positive' as const;
  }
  if (value < warningThreshold) {
    return 'danger' as const;
  }
  return 'warning' as const;
};

const Leaderboards: React.FC = () => {
  const {
    accuracyStats,
    performanceStats,
    feedbackStats,
    reliabilityStats,
    overconfidentModels,
    isLoadingAny,
    isLoadingAccuracy,
    isLoadingPerformance,
    isLoadingFeedback,
    isLoadingReliability,
    isLoadingOverconfident,
    accuracyError,
    performanceError,
    feedbackError,
    reliabilityError,
    overconfidentError,
    refetch,
  } = useModelLeaderboards();

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    document.title = 'Model Leaderboards - ARC Explainer';
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void refetch().finally(() => {
      setIsRefreshing(false);
    });
  }, [refetch]);

  const averageReliability = useMemo(() => {
    if (!reliabilityStats || !reliabilityStats.length) {
      return undefined;
    }
    const total = reliabilityStats.reduce((acc, stat) => acc + stat.reliability, 0);
    return total / reliabilityStats.length;
  }, [reliabilityStats]);

  const highRiskCount = useMemo(() => {
    if (!overconfidentModels) {
      return undefined;
    }
    const flagged = overconfidentModels.filter(model => model.isHighRisk).length;
    return flagged || overconfidentModels.length ? flagged : undefined;
  }, [overconfidentModels]);

  const summaryItems: LeaderboardSummaryItem[] = useMemo(() => {
    const overallAccuracy = accuracyStats?.overallAccuracyPercentage;
    const overallTrust = performanceStats?.overallTrustworthiness;
    const helpfulRatio = feedbackStats?.helpfulPercentage;

    return [
      {
        id: 'overall-accuracy',
        title: 'Overall accuracy',
        value: formatPercentage(overallAccuracy),
        description: 'Correctness rate computed by AccuracyRepository across all solver attempts.',
        icon: <Activity className="h-5 w-5" />, 
        tone: determineTone(overallAccuracy),
      },
      {
        id: 'trustworthiness',
        title: 'Avg trustworthiness',
        value: overallTrust !== undefined ? formatPercentage(overallTrust * 100) : undefined,
        description: 'Confidence calibration score from MetricsRepository performance stats.',
        icon: <ShieldCheck className="h-5 w-5" />, 
        tone: determineTone(overallTrust !== undefined ? overallTrust * 100 : undefined),
      },
      {
        id: 'reliability',
        title: 'Avg reliability',
        value: formatPercentage(averageReliability),
        description: 'Successful response rate calculated via MetricsRepository reliability feed.',
        icon: <GaugeCircle className="h-5 w-5" />, 
        tone: determineTone(averageReliability, 95, 85),
      },
      {
        id: 'feedback',
        title: 'Helpful feedback',
        value: formatPercentage(helpfulRatio),
        description: 'User-rated helpful responses sourced from FeedbackRepository.',
        icon: <ThumbsUp className="h-5 w-5" />, 
        tone: determineTone(helpfulRatio),
        footer: feedbackStats ? `${feedbackStats.totalFeedback.toLocaleString()} total reviews` : undefined,
      },
      {
        id: 'high-risk-models',
        title: 'High-risk models',
        value: highRiskCount !== undefined ? `${highRiskCount}` : undefined,
        description: 'Overconfident models flagged by AccuracyRepository for investigation.',
        icon: <AlertTriangle className="h-5 w-5" />, 
        tone:
          highRiskCount === undefined
            ? 'default'
            : highRiskCount > 0
              ? 'danger'
              : 'positive',
      },
    ];
  }, [accuracyStats, performanceStats, averageReliability, feedbackStats, highRiskCount]);

  const errorMessages = useMemo(() => {
    const collect: string[] = [];
    const map: Array<[unknown, string]> = [
      [accuracyError, 'accuracy'],
      [performanceError, 'trustworthiness'],
      [feedbackError, 'feedback'],
      [reliabilityError, 'reliability'],
      [overconfidentError, 'overconfidence'],
    ];
    map.forEach(([err, label]) => {
      if (!err) {
        return;
      }
      if (err instanceof Error) {
        collect.push(`${label}: ${err.message}`);
      } else {
        collect.push(`${label}: failed to load`);
      }
    });
    return collect;
  }, [accuracyError, performanceError, feedbackError, reliabilityError, overconfidentError]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-3 lg:max-w-7xl lg:px-4">
      <LeaderboardPageHeader
        modelCount={accuracyStats?.modelAccuracyRankings?.length}
        totalAttempts={accuracyStats?.totalSolverAttempts}
        helpfulPercentage={feedbackStats?.helpfulPercentage}
        isLoading={isLoadingAny}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {errorMessages.length > 0 && !isLoadingAny && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-900">
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wide">Data warnings</h2>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-snug">
            {errorMessages.map(message => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <LeaderboardSummaryGrid items={summaryItems} isLoading={isLoadingAny} />

      <LeaderboardInsights
        accuracyStats={accuracyStats}
        overconfidentModels={overconfidentModels}
        reliabilityStats={reliabilityStats}
        feedbackStats={feedbackStats}
        isLoading={isLoadingAny}
      />

      <LeaderboardSection
        accuracyStats={accuracyStats}
        performanceStats={performanceStats}
        feedbackStats={feedbackStats}
        overconfidentModels={overconfidentModels}
        isLoadingAccuracy={isLoadingAccuracy}
        isLoadingPerformance={isLoadingPerformance}
        isLoadingFeedback={isLoadingFeedback}
        isLoadingOverconfident={isLoadingOverconfident}
      />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Technical reliability</h2>
          <p className="text-[11px] text-slate-500">Raw uptime metrics from MetricsRepository.</p>
        </div>
        <ReliabilityLeaderboard
          reliabilityStats={reliabilityStats}
          isLoading={isLoadingReliability}
        />
      </section>
    </div>
  );
};

export default Leaderboards;
