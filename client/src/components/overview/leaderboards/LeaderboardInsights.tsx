/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Insight callouts for the leaderboards dashboard. Surfaces noteworthy models derived from
 *          AccuracyRepository (accuracy stats), MetricsRepository (reliability), and FeedbackRepository
 *          (helpful feedback ratios), plus overconfidence risk alerts.
 * SRP/DRY check: Pass — derives insight text from supplied data; no external side effects.
 */

import React, { useMemo } from 'react';
import { AlertTriangle, ShieldCheck, ThumbsUp, Trophy } from 'lucide-react';

interface AccuracyModel {
  modelName: string;
  totalAttempts: number;
  correctPredictions: number;
  accuracyPercentage: number;
  singleTestAccuracy: number;
  multiTestAccuracy: number;
}

interface AccuracyStats {
  modelAccuracyRankings?: AccuracyModel[];
}

interface OverconfidentModel {
  modelName: string;
  totalAttempts: number;
  overconfidenceRate: number;
  avgConfidence: number;
  overallAccuracy: number;
  isHighRisk: boolean;
}

interface ReliabilityStat {
  modelName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  reliability: number;
}

interface FeedbackModelStat {
  modelName: string;
  feedbackCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  helpfulPercentage: number;
}

interface FeedbackStats {
  topModels?: FeedbackModelStat[];
}

interface LeaderboardInsightsProps {
  accuracyStats?: AccuracyStats;
  overconfidentModels?: OverconfidentModel[];
  reliabilityStats?: ReliabilityStat[];
  feedbackStats?: FeedbackStats;
  isLoading?: boolean;
}

export function LeaderboardInsights({
  accuracyStats,
  overconfidentModels,
  reliabilityStats,
  feedbackStats,
  isLoading = false,
}: LeaderboardInsightsProps) {
  const bestAccuracyModel = useMemo(() => {
    if (!accuracyStats?.modelAccuracyRankings?.length) {
      return undefined;
    }
    return [...accuracyStats.modelAccuracyRankings].sort((a, b) => b.accuracyPercentage - a.accuracyPercentage)[0];
  }, [accuracyStats]);

  const riskiestModel = useMemo(() => {
    if (!overconfidentModels?.length) {
      return undefined;
    }
    const sorted = [...overconfidentModels].sort((a, b) => b.overconfidenceRate - a.overconfidenceRate);
    return sorted.find(model => model.isHighRisk) ?? sorted[0];
  }, [overconfidentModels]);

  const { mostReliableModel, leastReliableModel } = useMemo(() => {
    if (!reliabilityStats?.length) {
      return { mostReliableModel: undefined, leastReliableModel: undefined };
    }
    const sorted = [...reliabilityStats].sort((a, b) => b.reliability - a.reliability);
    return {
      mostReliableModel: sorted[0],
      leastReliableModel: sorted[sorted.length - 1],
    };
  }, [reliabilityStats]);

  const topFeedbackModel = useMemo(() => {
    if (!feedbackStats?.topModels?.length) {
      return undefined;
    }
    return [...feedbackStats.topModels].sort((a, b) => b.helpfulPercentage - a.helpfulPercentage)[0];
  }, [feedbackStats]);

  const cards = [
    bestAccuracyModel && {
      id: 'accuracy-champion',
      icon: <Trophy className="h-5 w-5 text-amber-500" />,
      title: 'Accuracy champion',
      detail: `${bestAccuracyModel.modelName} leads with ${bestAccuracyModel.accuracyPercentage.toFixed(1)}% correctness over ${bestAccuracyModel.totalAttempts.toLocaleString()} attempts.`,
      tone: 'bg-amber-50 text-amber-900 border-amber-200',
    },
    riskiestModel && {
      id: 'overconfidence-alert',
      icon: <AlertTriangle className="h-5 w-5 text-rose-600" />,
      title: 'Overconfidence alert',
      detail: `${riskiestModel.modelName} shows ${riskiestModel.overconfidenceRate.toFixed(1)}% overconfidence while only ${riskiestModel.overallAccuracy.toFixed(1)}% accurate. Prioritise evaluation.`,
      tone: 'bg-rose-50 text-rose-900 border-rose-200',
    },
    mostReliableModel && {
      id: 'reliability-anchor',
      icon: <ShieldCheck className="h-5 w-5 text-emerald-600" />,
      title: 'Reliability anchor',
      detail: `${mostReliableModel.modelName} completes ${(mostReliableModel.reliability).toFixed(2)}% of ${mostReliableModel.totalRequests.toLocaleString()} requests.`,
      tone: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    },
    leastReliableModel && {
      id: 'reliability-risk',
      icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
      title: 'Reliability risk',
      detail: `${leastReliableModel.modelName} struggles at ${(leastReliableModel.reliability).toFixed(2)}% reliability with ${leastReliableModel.failedRequests.toLocaleString()} failures.`,
      tone: 'bg-amber-50 text-amber-900 border-amber-200',
    },
    topFeedbackModel && {
      id: 'feedback-star',
      icon: <ThumbsUp className="h-5 w-5 text-sky-600" />,
      title: 'Feedback star',
      detail: `${topFeedbackModel.modelName} earns ${topFeedbackModel.helpfulPercentage.toFixed(1)}% helpful votes from ${topFeedbackModel.feedbackCount.toLocaleString()} reviews.`,
      tone: 'bg-sky-50 text-sky-900 border-sky-200',
    },
  ].filter(Boolean) as Array<{
    id: string;
    icon: React.ReactNode;
    title: string;
    detail: string;
    tone: string;
  }>;

  if (isLoading) {
    return (
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 h-5 w-5 animate-pulse rounded-full bg-slate-200" />
            <div className="mb-2 h-5 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </section>
    );
  }

  if (!cards.length) {
    return null;
  }

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map(card => (
        <div
          key={card.id}
          className={`rounded-2xl border p-6 shadow-sm ${card.tone}`}
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 shadow-inner">
              {card.icon}
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wide">{card.title}</h3>
          </div>
          <p className="text-sm leading-relaxed">{card.detail}</p>
        </div>
      ))}
    </section>
  );
}
