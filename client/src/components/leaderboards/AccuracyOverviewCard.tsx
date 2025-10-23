/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Accuracy overview card that surfaces headline stats from AccuracyRepository-backed
 *          `/api/feedback/accuracy-stats` results, including top models and aggregate solver data.
 * SRP/DRY check: Pass — dedicated to rendering accuracy-specific insights for the leaderboards page.
 */

import React from 'react';
import { Trophy, Target } from 'lucide-react';
import type { AccuracyStats, AccuracyModelRanking, LeaderboardSummaryTotals } from '@/types/leaderboards';
import { formatCount, formatPercentage, LEADERBOARD_LIMITS } from '@/constants/leaderboard';

interface AccuracyOverviewCardProps {
  accuracyStats?: AccuracyStats;
  totals: LeaderboardSummaryTotals;
  topModels: AccuracyModelRanking[];
  isLoading: boolean;
  onModelSelect?: (modelName: string) => void;
}

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      {[1, 2, 3, 4].map(item => (
        <div key={item} className="animate-pulse rounded-lg bg-base-200 p-4">
          <div className="h-4 w-20 rounded bg-base-300" />
          <div className="mt-3 h-6 w-28 rounded bg-base-300" />
        </div>
      ))}
    </div>
    <div className="space-y-3">
      {[1, 2, 3].map(item => (
        <div key={item} className="animate-pulse rounded-lg border border-base-200 p-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-base-300" />
            <div className="h-4 w-16 rounded bg-base-300" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export function AccuracyOverviewCard({
  accuracyStats,
  totals,
  topModels,
  isLoading,
  onModelSelect
}: AccuracyOverviewCardProps) {
  if (isLoading) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Accuracy Snapshot
          </h2>
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  if (!accuracyStats) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Accuracy Snapshot
          </h2>
          <p className="text-sm text-base-content/70">
            AccuracyRepository has not reported any solver attempts yet.
          </p>
        </div>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Solver Attempts',
      value: formatCount(totals.totalAttempts),
    },
    {
      label: 'Correct Predictions',
      value: formatCount(totals.totalCorrect),
    },
    {
      label: 'Overall Accuracy',
      value: formatPercentage(totals.overallAccuracyPercentage ?? undefined, 1),
    },
    {
      label: 'Models Tracked',
      value: formatCount(totals.trackedModels),
    },
  ];

  return (
    <div className="card bg-base-100 shadow h-full">
      <div className="card-body">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="card-title flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              Accuracy Snapshot
            </h2>
            <p className="text-sm text-base-content/70">
              Real accuracy metrics directly from AccuracyRepository via `/api/feedback/accuracy-stats`.
            </p>
          </div>
          <div className="hidden text-right text-sm sm:block">
            <span className="font-semibold text-primary">Updated</span>
            <p className="text-xs text-base-content/60">5 min cache window</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 text-sm">
          {metrics.map(metric => (
            <div key={metric.label} className="rounded-lg border border-base-200 p-4">
              <p className="text-base-content/70">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-base-content">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-base-content/70">
            <Trophy className="h-4 w-4 text-warning" />
            Top Models by Accuracy
          </h3>
          {topModels.length === 0 ? (
            <p className="text-sm text-base-content/70">No models meet the minimum attempt threshold.</p>
          ) : (
            <ul className="space-y-2">
              {topModels.map((model, index) => (
                <li
                  key={model.modelName}
                  className={`flex items-center justify-between rounded-lg border border-base-200 p-3 transition-colors ${
                    onModelSelect ? 'cursor-pointer hover:bg-base-200/60' : ''
                  }`}
                  onClick={() => onModelSelect?.(model.modelName)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-base-200 text-sm font-semibold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-base-content">{model.modelName}</p>
                      <p className="text-xs text-base-content/60">
                        {formatCount(model.totalAttempts)} attempts · {formatPercentage(model.accuracyPercentage, 1)} accuracy
                      </p>
                    </div>
                  </div>
                  <span className="badge badge-outline badge-lg">
                    {formatPercentage(model.singleTestAccuracy, 1)} single · {formatPercentage(model.multiTestAccuracy, 1)} multi
                  </span>
                </li>
              ))}
            </ul>
          )}
          {accuracyStats.modelAccuracyRankings.length > LEADERBOARD_LIMITS.TOP_MODELS && (
            <p className="mt-3 text-xs text-base-content/60">
              Showing top {LEADERBOARD_LIMITS.TOP_MODELS} of {accuracyStats.modelAccuracyRankings.length.toLocaleString()} tracked models.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

