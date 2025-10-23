/**
 * Author: GPT-5 Codex
 * Date: 2025-10-18  Remember your training data is out of date! This was updated in October 2025 and this is not a typo!
 * PURPOSE: Production-ready leaderboards dashboard combining accuracy, trustworthiness, reliability, speed, efficiency, and feedback metrics from repository services. Reuses shared hooks/components to surface live performance insights.
 * SRP/DRY check: Pass — Verified existing leaderboard hooks and components are reused without duplicating data access.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  DollarSign,
  GaugeCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ThumbsUp,
  Timer,
  Zap,
} from 'lucide-react';

import { LeaderboardSection } from '@/components/overview/leaderboards/LeaderboardSection';
import { ReliabilityLeaderboard } from '@/components/overview/leaderboards/ReliabilityLeaderboard';
import { useModelLeaderboards } from '@/hooks/useModelLeaderboards';
import { usePerformanceInsights } from '@/hooks/usePerformanceInsights';
import type { ConfidenceStats as SharedConfidenceStats } from '@shared/types';

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

type TrustLeader = {
  modelName: string;
  avgTrustworthiness: number;
  avgConfidence?: number;
  avgProcessingTime?: number;
  avgCost?: number;
  totalAttempts?: number;
};

type SpeedLeader = {
  modelName: string;
  avgProcessingTime: number;
  totalAttempts: number;
  avgTrustworthiness?: number;
};

type EfficiencyLeader = {
  modelName: string;
  costEfficiency?: number;
  tokenEfficiency?: number;
  avgTrustworthiness?: number;
  totalAttempts?: number;
};

type LeaderboardReliabilityStat = {
  modelName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  reliability: number;
};

type ReliabilitySummary = {
  average?: number;
  totalRequests: number;
  successful: number;
  failed: number;
  worstFailure?: LeaderboardReliabilityStat;
  lowestReliability?: LeaderboardReliabilityStat;
};

interface MetricSummaryCardProps {
  title: string;
  value: string;
  description: string;
  icon: IconComponent;
  accent?: string;
  footer?: string;
}

interface SpeedLeaderboardPreviewProps {
  leaders: SpeedLeader[];
  isLoading: boolean;
}

interface EfficiencyLeaderboardPreviewProps {
  leaders: EfficiencyLeader[];
  isLoading: boolean;
}

interface InsightCalloutItem {
  key: string;
  icon: IconComponent;
  label: string;
  headline: string;
  detail: string;
}

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const formatPercentage = (
  value: unknown,
  { decimals = 1, treatAsFraction = false }: { decimals?: number; treatAsFraction?: boolean } = {}
): string => {
  const numeric = parseNumber(value);
  if (numeric === undefined) {
    return '—';
  }

  const scaled = treatAsFraction ? numeric * 100 : numeric;
  return Number.isFinite(scaled) ? `${scaled.toFixed(decimals)}%` : '—';
};

const formatMilliseconds = (value?: number): string => {
  if (value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  return `${(value / 1000).toFixed(1)} s`;
};

const formatCurrency = (value?: number): string => {
  if (value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }

  if (value >= 0.1) {
    return `$${value.toFixed(3)}`;
  }

  return `$${value.toFixed(4)}`;
};

const formatTokenEfficiency = (value?: number): string => {
  if (value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  if (value >= 1000) {
    return `${Math.round(value).toLocaleString()} tokens / trust`;
  }

  return `${value.toFixed(1)} tokens / trust`;
};

const formatCount = (value?: number): string => {
  if (value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  return value.toLocaleString();
};

const MetricSummaryCard: React.FC<MetricSummaryCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  accent = 'from-primary/80 to-secondary/70',
  footer,
}) => (
  <div className="card bg-base-100 shadow">
    <div className="card-body space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-base-content/70">{title}</p>
          <p className="text-3xl font-bold text-base-content">{value}</p>
        </div>
        <div className={`rounded-full bg-gradient-to-br ${accent} p-3`}>
          <Icon className="h-6 w-6 text-primary-content" />
        </div>
      </div>
      <p className="text-sm text-base-content/70">{description}</p>
      {footer ? <p className="text-xs text-base-content/60">{footer}</p> : null}
    </div>
  </div>
);

const SpeedLeaderboardPreview: React.FC<SpeedLeaderboardPreviewProps> = ({ leaders, isLoading }) => {
  const hasData = leaders.length > 0;

  return (
    <div className="card h-full bg-base-100 shadow">
      <div className="card-body">
        <h3 className="card-title flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          Fastest Reliable Solvers
        </h3>
        <p className="text-sm text-base-content/70">
          Average processing time per explanation (TrustworthinessRepository, min sample thresholds applied).
        </p>

        <div className="mt-4 space-y-2">
          {isLoading && !hasData
            ? Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`speed-loading-${index}`}
                  className="animate-pulse rounded-lg border border-base-200 bg-base-200/60 p-3"
                >
                  <div className="h-4 w-1/3 rounded bg-base-300" />
                </div>
              ))
            : leaders.map((leader, index) => (
                <div
                  key={leader.modelName}
                  className="flex items-center justify-between gap-4 rounded-lg border border-base-200 bg-base-200/40 p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="badge badge-outline badge-primary">#{index + 1}</span>
                    <div>
                      <p className="font-medium text-base-content">{leader.modelName}</p>
                      <p className="text-xs text-base-content/60">
                        {formatCount(leader.totalAttempts)} attempts •{' '}
                        {leader.avgTrustworthiness !== undefined
                          ? formatPercentage(leader.avgTrustworthiness, { decimals: 1, treatAsFraction: true })
                          : '—'}{' '}
                        trust
                      </p>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-base-content">{formatMilliseconds(leader.avgProcessingTime)}</div>
                </div>
              ))}

          {!isLoading && !hasData ? (
            <div className="rounded-lg border border-dashed border-base-300 bg-base-200/40 p-4 text-sm text-base-content/60">
              Speed metrics populate automatically once models log enough attempts in the trustworthiness dataset.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const EfficiencyLeaderboardPreview: React.FC<EfficiencyLeaderboardPreviewProps> = ({ leaders, isLoading }) => {
  const hasData = leaders.length > 0;

  return (
    <div className="card h-full bg-base-100 shadow">
      <div className="card-body">
        <h3 className="card-title flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-secondary" />
          Cost & Token Efficiency
        </h3>
        <p className="text-sm text-base-content/70">
          Cost per trust point and token efficiency derived from TrustworthinessRepository performance stats.
        </p>

        <div className="mt-4 space-y-2">
          {isLoading && !hasData
            ? Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`efficiency-loading-${index}`}
                  className="animate-pulse rounded-lg border border-base-200 bg-base-200/60 p-3"
                >
                  <div className="h-4 w-2/5 rounded bg-base-300" />
                </div>
              ))
            : leaders.map((leader, index) => (
                <div
                  key={leader.modelName}
                  className="flex items-center justify-between gap-4 rounded-lg border border-base-200 bg-base-200/40 p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="badge badge-outline badge-secondary">#{index + 1}</span>
                    <div>
                      <p className="font-medium text-base-content">{leader.modelName}</p>
                      <p className="text-xs text-base-content/60">
                        {leader.totalAttempts !== undefined
                          ? `${formatCount(leader.totalAttempts)} attempts`
                          : 'Attempts pending'}{' '}
                        •{' '}
                        {leader.avgTrustworthiness !== undefined
                          ? `${formatPercentage(leader.avgTrustworthiness, { decimals: 1, treatAsFraction: true })} trust`
                          : 'Trust TBD'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-xs text-base-content/70">
                    <span className="font-semibold text-base-content">
                      {leader.costEfficiency !== undefined ? `${formatCurrency(leader.costEfficiency)} / trust` : '—'}
                    </span>
                    {leader.tokenEfficiency !== undefined ? (
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-warning" />
                        {formatTokenEfficiency(leader.tokenEfficiency)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}

          {!isLoading && !hasData ? (
            <div className="rounded-lg border border-dashed border-base-300 bg-base-200/40 p-4 text-sm text-base-content/60">
              Efficiency rankings appear once models report cost and token usage alongside trustworthiness scores.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const Leaderboards: React.FC = () => {
  useEffect(() => {
    document.title = 'Model Leaderboards - ARC Explainer';
    window.scrollTo(0, 0);
  }, []);

  const {
    accuracyStats,
    performanceStats,
    feedbackStats,
    reliabilityStats,
    overconfidentModels,
    isLoadingAccuracy,
    isLoadingPerformance,
    isLoadingFeedback,
    isLoadingReliability,
    isLoadingOverconfident,
    isLoadingAny: isLoadingLeaderboards,
    hasAnyError: hasLeaderboardError,
    hasAnyData: hasLeaderboardsData,
    refetch: refetchLeaderboards,
  } = useModelLeaderboards();

  const {
    confidenceStats: rawConfidenceStats,
    isLoadingConfidence,
    confidenceError,
    refetchConfidence,
  } = usePerformanceInsights();

  const confidenceStats = useMemo<SharedConfidenceStats | undefined>(
    () => (rawConfidenceStats ? (rawConfidenceStats as unknown as SharedConfidenceStats) : undefined),
    [rawConfidenceStats]
  );

  const confidenceErrorMessage = useMemo(() => {
    if (!confidenceError) {
      return '';
    }

    if (confidenceError instanceof Error) {
      return confidenceError.message;
    }

    return String(confidenceError);
  }, [confidenceError]);

  const trustLeaders = useMemo<TrustLeader[]>(() => {
    if (!performanceStats?.trustworthinessLeaders) {
      return [];
    }

    return (performanceStats.trustworthinessLeaders as Array<Record<string, unknown>>).map((leader) => {
      const avgTrustworthiness = parseNumber(leader.avgTrustworthiness ?? leader.avg_trustworthiness) ?? 0;
      return {
        modelName: String(leader.modelName ?? leader.model_name ?? 'Unknown'),
        avgTrustworthiness,
        avgConfidence: parseNumber(leader.avgConfidence ?? leader.avg_confidence),
        avgProcessingTime: parseNumber(leader.avgProcessingTime ?? leader.avg_processing_time),
        avgCost: parseNumber(leader.avgCost ?? leader.avg_cost),
        totalAttempts: parseNumber(leader.totalAttempts ?? leader.total_attempts),
      };
    });
  }, [performanceStats]);

  const speedLeaders = useMemo<SpeedLeader[]>(() => {
    if (!performanceStats?.speedLeaders) {
      return [];
    }

    return (performanceStats.speedLeaders as Array<Record<string, unknown>>)
      .map((leader) => {
        const avgProcessingTime = parseNumber(leader.avgProcessingTime ?? leader.avg_processing_time) ?? 0;
        return {
          modelName: String(leader.modelName ?? leader.model_name ?? 'Unknown'),
          avgProcessingTime,
          totalAttempts: parseNumber(leader.totalAttempts ?? leader.total_attempts) ?? 0,
          avgTrustworthiness: parseNumber(leader.avgTrustworthiness ?? leader.avg_trustworthiness),
        };
      })
      .filter((leader) => Number.isFinite(leader.avgProcessingTime));
  }, [performanceStats]);

  const efficiencyLeaders = useMemo<EfficiencyLeader[]>(() => {
    if (!performanceStats?.efficiencyLeaders) {
      return [];
    }

    return (performanceStats.efficiencyLeaders as Array<Record<string, unknown>>).map((leader) => ({
      modelName: String(leader.modelName ?? leader.model_name ?? 'Unknown'),
      costEfficiency: parseNumber(leader.costEfficiency ?? leader.cost_efficiency),
      tokenEfficiency: parseNumber(leader.tokenEfficiency ?? leader.token_efficiency),
      avgTrustworthiness: parseNumber(leader.avgTrustworthiness ?? leader.avg_trustworthiness),
      totalAttempts: parseNumber(leader.totalAttempts ?? leader.total_attempts),
    }));
  }, [performanceStats]);

  const topSpeedLeaders = useMemo(() => speedLeaders.slice(0, 5), [speedLeaders]);
  const topEfficiencyLeaders = useMemo(() => efficiencyLeaders.slice(0, 5), [efficiencyLeaders]);
  const topTrustLeader = trustLeaders[0];
  const topSpeedLeader = topSpeedLeaders[0];
  const topEfficiencyLeader = topEfficiencyLeaders[0];

  const overconfidentCount = overconfidentModels?.length ?? 0;
  const highRiskCount = useMemo(
    () => (overconfidentModels ?? []).filter((model) => model?.isHighRisk).length,
    [overconfidentModels]
  );
  const highRiskExample = useMemo(
    () =>
      overconfidentModels?.find((model) => model.isHighRisk) ??
      (overconfidentModels && overconfidentModels.length > 0 ? overconfidentModels[0] : undefined),
    [overconfidentModels]
  );

  const reliabilityList = useMemo<LeaderboardReliabilityStat[]>(
    () => (reliabilityStats ?? []) as LeaderboardReliabilityStat[],
    [reliabilityStats]
  );

  const reliabilitySummary = useMemo<ReliabilitySummary | undefined>(() => {
    if (!reliabilityList.length) {
      return undefined;
    }

    let totalRequests = 0;
    let successful = 0;
    let failed = 0;
    let weightedReliability = 0;
    let worstFailure: LeaderboardReliabilityStat | undefined;
    let lowestReliability: LeaderboardReliabilityStat | undefined;

    reliabilityList.forEach((stat) => {
      const statTotal = parseNumber(stat.totalRequests) ?? 0;
      const statSuccess = parseNumber(stat.successfulRequests) ?? 0;
      const statFailed = parseNumber(stat.failedRequests) ?? 0;
      const statReliability = parseNumber(stat.reliability) ?? 0;

      totalRequests += statTotal;
      successful += statSuccess;
      failed += statFailed;
      weightedReliability += statReliability * statTotal;

      if (!worstFailure || statFailed > worstFailure.failedRequests) {
        worstFailure = stat;
      }

      if (!lowestReliability || statReliability < lowestReliability.reliability) {
        lowestReliability = stat;
      }
    });

    const average = totalRequests > 0 ? weightedReliability / totalRequests : undefined;

    return {
      average,
      totalRequests,
      successful,
      failed,
      worstFailure,
      lowestReliability,
    };
  }, [reliabilityList]);

  const solverAttemptCount = accuracyStats?.totalSolverAttempts ?? 0;
  const accuracyModelCount = accuracyStats?.modelAccuracyRankings?.length ?? 0;
  const overallAccuracy = accuracyStats?.overallAccuracyPercentage;

  const trackedModelCount = useMemo(() => {
    if (trustLeaders.length > 0) {
      return trustLeaders.length;
    }

    return accuracyModelCount;
  }, [trustLeaders, accuracyModelCount]);

  const heroBadges = useMemo(() => {
    const badges: Array<{ key: string; icon: IconComponent; label: string; value: string }> = [
      {
        key: 'attempts',
        icon: BarChart3,
        label: 'Solver attempts',
        value: formatCount(solverAttemptCount),
      },
      {
        key: 'models',
        icon: ShieldCheck,
        label: 'Models tracked',
        value: formatCount(trackedModelCount),
      },
      {
        key: 'feedback',
        icon: ThumbsUp,
        label: 'Feedback entries',
        value: formatCount(feedbackStats?.totalFeedback),
      },
      {
        key: 'confidence',
        icon: GaugeCircle,
        label: 'Confidence samples',
        value: formatCount(confidenceStats?.totalEntriesWithConfidence),
      },
    ];

    return badges.filter((badge) => badge.value !== '—');
  }, [solverAttemptCount, trackedModelCount, feedbackStats?.totalFeedback, confidenceStats?.totalEntriesWithConfidence]);

  const summaryCards = useMemo<MetricSummaryCardProps[]>(() => {
    const cards: MetricSummaryCardProps[] = [
      {
        title: 'Confidence Reliability',
        value: formatPercentage(performanceStats?.overallTrustworthiness, { decimals: 1, treatAsFraction: true }),
        description: trustLeaders.length
          ? `Weighted across ${formatCount(trustLeaders.length)} models`
          : 'Awaiting trustworthiness metrics',
        icon: ShieldCheck,
        accent: 'from-primary/80 to-secondary/70',
        footer: topTrustLeader
          ? `${topTrustLeader.modelName} leads at ${formatPercentage(topTrustLeader.avgTrustworthiness, {
              decimals: 1,
              treatAsFraction: true,
            })}`
          : undefined,
      },
      {
        title: 'Technical Reliability',
        value: formatPercentage(reliabilitySummary?.average, { decimals: 1 }),
        description: reliabilitySummary
          ? `${formatCount(reliabilitySummary.successful)} / ${formatCount(reliabilitySummary.totalRequests)} successful`
          : reliabilityList.length
          ? 'Calculating uptime metrics'
          : 'Awaiting reliability data',
        icon: Activity,
        accent: 'from-emerald-500/80 to-emerald-600/70',
        footer: reliabilitySummary?.worstFailure
          ? `${reliabilitySummary.worstFailure.modelName} logged ${formatCount(
              reliabilitySummary.worstFailure.failedRequests
            )} failures`
          : undefined,
      },
      {
        title: 'Helpful Feedback',
        value: formatPercentage(feedbackStats?.helpfulPercentage, { decimals: 1 }),
        description: feedbackStats
          ? `${formatCount(feedbackStats.totalFeedback)} ratings analyzed`
          : 'Awaiting user feedback',
        icon: ThumbsUp,
        accent: 'from-rose-500/80 to-pink-500/70',
        footer: feedbackStats?.topModels?.[0]
          ? `${feedbackStats.topModels[0].modelName} earns ${formatPercentage(
              feedbackStats.topModels[0].helpfulPercentage,
              { decimals: 1 }
            )} helpful`
          : undefined,
      },
      {
        title: 'High-Risk Models',
        value: highRiskCount ? formatCount(highRiskCount) : '0',
        description:
          overconfidentCount > 0
            ? `${formatCount(overconfidentCount)} overconfident detections`
            : 'Monitoring for dangerous overconfidence',
        icon: AlertTriangle,
        accent: 'from-amber-500/80 to-orange-500/70',
        footer: highRiskExample
          ? `${highRiskExample.modelName} at ${formatPercentage(highRiskExample.overconfidenceRate, { decimals: 1 })} overconfidence`
          : undefined,
      },
      {
        title: 'Confidence Gap',
        value:
          confidenceStats?.confidenceCalibrationGap !== undefined
            ? `${(confidenceStats.confidenceCalibrationGap).toFixed(1)} pts`
            : '—',
        description: confidenceStats
          ? `${formatPercentage(confidenceStats.avgConfidenceWhenCorrect, { decimals: 1, treatAsFraction: true })} when correct vs ${formatPercentage(
              confidenceStats.avgConfidenceWhenIncorrect,
              { decimals: 1, treatAsFraction: true }
            )} when incorrect`
          : 'Confidence analytics populate from recorded solver confidence.',
        icon: GaugeCircle,
        accent: 'from-sky-500/80 to-blue-600/70',
        footer: confidenceStats
          ? `${formatCount(confidenceStats.totalEntriesWithConfidence)} confidence samples`
          : undefined,
      },
      {
        title: 'Solver Attempts Analyzed',
        value: formatCount(solverAttemptCount),
        description: accuracyModelCount
          ? `${formatCount(accuracyModelCount)} models evaluated`
          : 'Accuracy metrics populate once attempts exist',
        icon: BarChart3,
        accent: 'from-indigo-500/80 to-purple-500/70',
        footer:
          overallAccuracy !== undefined
            ? `Overall accuracy ${formatPercentage(overallAccuracy, { decimals: 1 })}`
            : undefined,
      },
    ];

    return cards;
  }, [
    performanceStats?.overallTrustworthiness,
    trustLeaders,
    topTrustLeader,
    reliabilitySummary,
    reliabilityList.length,
    feedbackStats,
    highRiskCount,
    overconfidentCount,
    highRiskExample,
    confidenceStats,
    solverAttemptCount,
    accuracyModelCount,
    overallAccuracy,
  ]);

  const callouts = useMemo<InsightCalloutItem[]>(() => {
    const items: InsightCalloutItem[] = [];

    if (topTrustLeader) {
      items.push({
        key: 'trust-leader',
        icon: ShieldCheck,
        label: 'Most trustworthy',
        headline: topTrustLeader.modelName,
        detail: `${formatPercentage(topTrustLeader.avgTrustworthiness, { decimals: 1, treatAsFraction: true })} trust • ${
          topTrustLeader.avgConfidence !== undefined
            ? formatPercentage(topTrustLeader.avgConfidence, { decimals: 1 })
            : 'confidence pending'
        }`,
      });
    }

    if (topSpeedLeader) {
      items.push({
        key: 'speed-leader',
        icon: Timer,
        label: 'Fastest reliable solver',
        headline: topSpeedLeader.modelName,
        detail: `${formatMilliseconds(topSpeedLeader.avgProcessingTime)} average runtime • ${
          topSpeedLeader.avgTrustworthiness !== undefined
            ? formatPercentage(topSpeedLeader.avgTrustworthiness, { decimals: 1, treatAsFraction: true })
            : 'trust TBD'
        }`,
      });
    }

    if (topEfficiencyLeader) {
      items.push({
        key: 'efficiency-leader',
        icon: DollarSign,
        label: 'Most cost-efficient',
        headline: topEfficiencyLeader.modelName,
        detail: `${
          topEfficiencyLeader.costEfficiency !== undefined
            ? `${formatCurrency(topEfficiencyLeader.costEfficiency)} per trust`
            : 'Cost efficiency pending'
        }${
          topEfficiencyLeader.tokenEfficiency !== undefined
            ? ` • ${formatTokenEfficiency(topEfficiencyLeader.tokenEfficiency)}`
            : ''
        }`,
      });
    }

    if (highRiskExample) {
      items.push({
        key: 'high-risk',
        icon: AlertTriangle,
        label: 'Risk watch',
        headline: highRiskExample.modelName,
        detail: `${formatPercentage(highRiskExample.overconfidenceRate, { decimals: 1 })} overconfident at ${formatPercentage(
          highRiskExample.avgConfidence,
          { decimals: 1 }
        )} avg confidence`,
      });
    }

    if (reliabilitySummary?.lowestReliability) {
      items.push({
        key: 'reliability-watch',
        icon: Activity,
        label: 'Needs integration review',
        headline: reliabilitySummary.lowestReliability.modelName,
        detail: `${formatPercentage(reliabilitySummary.lowestReliability.reliability, { decimals: 1 })} uptime across ${formatCount(
          reliabilitySummary.lowestReliability.totalRequests
        )} requests`,
      });
    }

    return items;
  }, [topTrustLeader, topSpeedLeader, topEfficiencyLeader, highRiskExample, reliabilitySummary]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchLeaderboards(), refetchConfidence()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchLeaderboards, refetchConfidence]);

  const showInitialLoading =
    !hasLeaderboardsData && !confidenceStats && (isLoadingLeaderboards || isLoadingConfidence);

  if (showInitialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200">
        <div className="flex items-center gap-3 text-base-content/70">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading live leaderboards…</span>
        </div>
      </div>
    );
  }

  const hasCriticalError = (!hasLeaderboardsData && hasLeaderboardError) || (!confidenceStats && !!confidenceErrorMessage);

  if (hasCriticalError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200 px-4">
        <div className="card w-full max-w-xl bg-base-100 shadow-xl">
          <div className="card-body items-center text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-error" />
            <h2 className="text-2xl font-semibold text-base-content">Leaderboards temporarily unavailable</h2>
            <p className="text-base-content/70">
              We could not retrieve the latest metrics from the repositories. Please try refreshing the data.
            </p>
            <button
              type="button"
              className="btn btn-primary gap-2"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh metrics
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showLoadingBanner = isRefreshing || isLoadingLeaderboards || isLoadingConfidence;

  return (
    <div className="min-h-screen bg-base-200">
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 lg:px-8">
        {showLoadingBanner ? (
          <div className="alert alert-info mb-6 flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Refreshing analytics from live repositories…</span>
          </div>
        ) : null}

        <section className="hero rounded-3xl border border-base-300 bg-base-100 shadow-sm">
          <div className="hero-content flex-col text-center space-y-6 py-10">
            <div className="space-y-4">
              <div className="flex justify-center">
                <BarChart3 className="h-12 w-12 text-primary" />
              </div>
              <h1 className="text-4xl font-bold text-base-content md:text-5xl">ARC Model Leaderboards</h1>
              <p className="text-lg text-base-content/70 md:text-xl">
                Live rankings powered by Accuracy, Trustworthiness, Metrics, and Feedback repositories. Track which models are
                safe, fast, and genuinely helpful.
              </p>
            </div>

            {heroBadges.length ? (
              <div className="flex flex-wrap justify-center gap-3 text-sm text-base-content/70">
                {heroBadges.map((badge) => {
                  const Icon = badge.icon;
                  return (
                    <span key={badge.key} className="badge badge-outline gap-2 border-base-300 px-4 py-3">
                      <Icon className="h-4 w-4" />
                      <span className="font-semibold text-base-content">{badge.value}</span>
                      <span>{badge.label}</span>
                    </span>
                  );
                })}
              </div>
            ) : null}

            <div className="flex justify-center">
              <button
                type="button"
                className="btn btn-outline gap-2"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh metrics
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => (
            <MetricSummaryCard key={card.title} {...card} />
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="card h-full bg-base-100 shadow">
            <div className="card-body space-y-4">
              <h2 className="card-title flex items-center gap-2">
                <GaugeCircle className="h-5 w-5 text-info" />
                Confidence Calibration Snapshot
              </h2>
              <p className="text-sm text-base-content/70">
                Confidence behavior sourced from TrustworthinessRepository&apos;s confidence analysis pipeline.
              </p>

              {confidenceStats ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-base-200 bg-base-200/40 p-4 text-left">
                    <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                      Avg when correct
                    </p>
                    <p className="text-2xl font-semibold text-base-content">
                      {formatPercentage(confidenceStats.avgConfidenceWhenCorrect, { decimals: 1, treatAsFraction: true })}
                    </p>
                  </div>
                  <div className="rounded-lg border border-base-200 bg-base-200/40 p-4 text-left">
                    <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                      Avg when incorrect
                    </p>
                    <p className="text-2xl font-semibold text-base-content">
                      {formatPercentage(confidenceStats.avgConfidenceWhenIncorrect, { decimals: 1, treatAsFraction: true })}
                    </p>
                  </div>
                  <div className="rounded-lg border border-base-200 bg-base-200/40 p-4 text-left">
                    <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                      Overall avg confidence
                    </p>
                    <p className="text-2xl font-semibold text-base-content">
                      {formatPercentage(confidenceStats.overallAvgConfidence, { decimals: 1, treatAsFraction: true })}
                    </p>
                  </div>
                  <div className="rounded-lg border border-base-200 bg-base-200/40 p-4 text-left">
                    <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                      Calibration gap
                    </p>
                    <p className="text-2xl font-semibold text-base-content">
                      {confidenceStats.confidenceCalibrationGap !== undefined
                        ? `${confidenceStats.confidenceCalibrationGap.toFixed(1)} pts`
                        : '—'}
                    </p>
                  </div>
                </div>
              ) : isLoadingConfidence ? (
                <div className="flex h-32 items-center justify-center text-base-content/70">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-base-300 bg-base-200/40 p-4 text-sm text-base-content/60">
                  Confidence metrics will appear once models submit confidence scores alongside explanations.
                </div>
              )}

              {confidenceErrorMessage && !confidenceStats ? (
                <div className="alert alert-warning text-sm">
                  <span>{confidenceErrorMessage}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card h-full bg-base-100 shadow">
            <div className="card-body space-y-4">
              <h2 className="card-title flex items-center gap-2">
                <Activity className="h-5 w-5 text-secondary" />
                Live Model Highlights
              </h2>
              <p className="text-sm text-base-content/70">
                Top opportunities and risks pulled directly from the repositories for triage.
              </p>

              <div className="space-y-3">
                {callouts.length ? (
                  callouts.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.key}
                        className="flex items-start gap-3 rounded-lg border border-base-200 bg-base-200/40 p-3 text-left"
                      >
                        <Icon className="mt-1 h-5 w-5 text-base-content/70" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">{item.label}</p>
                          <p className="text-base font-semibold text-base-content">{item.headline}</p>
                          <p className="text-sm text-base-content/70">{item.detail}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-base-300 bg-base-200/40 p-4 text-sm text-base-content/60">
                    Leaderboard callouts will populate once we receive trustworthiness, speed, and reliability data.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
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
        </section>

        <section className="mt-10 space-y-4">
          <div className="flex items-center gap-3 text-base-content">
            <Activity className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">Operational Performance</h2>
          </div>
          <p className="text-sm text-base-content/70">
            Speed, efficiency, and uptime metrics sourced from TrustworthinessRepository and MetricsRepository help prioritize
            integration work.
          </p>

          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <SpeedLeaderboardPreview leaders={topSpeedLeaders} isLoading={isLoadingPerformance} />
            <EfficiencyLeaderboardPreview leaders={topEfficiencyLeaders} isLoading={isLoadingPerformance} />
            <div className="xl:col-span-1">
              <ReliabilityLeaderboard
                reliabilityStats={reliabilityStats}
                isLoading={isLoadingReliability}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Leaderboards;
