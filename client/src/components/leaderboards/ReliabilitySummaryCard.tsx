/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Reliability summary card surfacing request success metrics from MetricsRepository
 *          via `/api/metrics/reliability` for inclusion on the leaderboards page.
 * SRP/DRY check: Pass — exclusively renders reliability-focused insights.
 */

import React, { useMemo } from 'react';
import { Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ReliabilityStat } from '@/types/leaderboards';
import {
  formatRatioAsPercentage,
  formatCount,
  LEADERBOARD_LIMITS,
  LEADERBOARD_THRESHOLDS,
} from '@/constants/leaderboard';

interface ReliabilitySummaryCardProps {
  reliabilityStats?: ReliabilityStat[];
  topReliableModels: ReliabilityStat[];
  isLoading: boolean;
}

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map(item => (
        <div key={item} className="animate-pulse rounded-lg bg-base-200 p-4">
          <div className="h-4 w-20 rounded bg-base-300" />
          <div className="mt-3 h-6 w-24 rounded bg-base-300" />
        </div>
      ))}
    </div>
    <div className="space-y-3">
      {[1, 2, 3].map(item => (
        <div key={item} className="animate-pulse rounded-lg border border-base-200 p-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-40 rounded bg-base-300" />
            <div className="h-4 w-16 rounded bg-base-300" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export function ReliabilitySummaryCard({ reliabilityStats, topReliableModels, isLoading }: ReliabilitySummaryCardProps) {
  const aggregate = useMemo(() => {
    if (!reliabilityStats?.length) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageReliability: null as number | null,
      };
    }

    const totals = reliabilityStats.reduce(
      (acc, item) => {
        acc.totalRequests += item.totalRequests;
        acc.successfulRequests += item.successfulRequests;
        acc.failedRequests += item.failedRequests;
        acc.reliabilitySum += item.reliability;
        return acc;
      },
      { totalRequests: 0, successfulRequests: 0, failedRequests: 0, reliabilitySum: 0 }
    );

    return {
      totalRequests: totals.totalRequests,
      successfulRequests: totals.successfulRequests,
      failedRequests: totals.failedRequests,
      averageReliability: totals.reliabilitySum / reliabilityStats.length,
    };
  }, [reliabilityStats]);

  if (isLoading) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-secondary" />
            Reliability Snapshot
          </h2>
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  if (!reliabilityStats) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-secondary" />
            Reliability Snapshot
          </h2>
          <p className="text-sm text-base-content/70">No reliability stats available from MetricsRepository.</p>
        </div>
      </div>
    );
  }

  const summaryMetrics = [
    {
      label: 'Total Requests',
      value: formatCount(aggregate.totalRequests),
    },
    {
      label: 'Successful',
      value: formatCount(aggregate.successfulRequests),
    },
    {
      label: 'Failures',
      value: formatCount(aggregate.failedRequests),
    },
    {
      label: 'Avg Reliability',
      value: formatRatioAsPercentage(aggregate.averageReliability, 2),
    },
  ];

  return (
    <div className="card bg-base-100 shadow h-full">
      <div className="card-body">
        <h2 className="card-title flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-secondary" />
          Reliability Snapshot
        </h2>
        <p className="text-sm text-base-content/70">
          Request success rates from MetricsRepository `/api/metrics/reliability` endpoint.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          {summaryMetrics.map(metric => (
            <div key={metric.label} className="rounded-lg border border-base-200 p-4">
              <p className="text-base-content/70">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-base-content">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-base-content/70">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Most Reliable Pipelines
          </h3>
          {topReliableModels.length === 0 ? (
            <p className="text-sm text-base-content/70">No models meet reliability thresholds yet.</p>
          ) : (
            <ul className="space-y-2">
              {topReliableModels.map(model => {
                const isExcellent = model.reliability >= LEADERBOARD_THRESHOLDS.HIGH_RELIABILITY;
                const isGood = model.reliability >= LEADERBOARD_THRESHOLDS.MEDIUM_RELIABILITY;
                return (
                  <li
                    key={model.modelName}
                    className={`flex items-center justify-between rounded-lg border border-base-200 p-3 ${
                      isExcellent ? 'bg-success/10 border-success/40' : isGood ? 'bg-info/10 border-info/40' : ''
                    }`}
                  >
                    <div>
                      <p className="font-medium text-base-content">{model.modelName}</p>
                      <p className="text-xs text-base-content/60">
                        {formatCount(model.totalRequests)} requests · {formatRatioAsPercentage(model.reliability, 2)} reliability
                      </p>
                    </div>
                    <span className="badge badge-outline badge-lg">
                      {formatCount(model.successfulRequests)} OK
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {reliabilityStats.length > LEADERBOARD_LIMITS.TOP_MODELS && (
            <p className="mt-3 text-xs text-base-content/60">
              Showing top {LEADERBOARD_LIMITS.TOP_MODELS} of {reliabilityStats.length.toLocaleString()} pipelines tracked.
            </p>
          )}
        </div>

        {aggregate.failedRequests > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            <AlertCircle className="h-4 w-4" />
            Investigate failing models to prevent user-visible outages.
          </div>
        )}
      </div>
    </div>
  );
}

