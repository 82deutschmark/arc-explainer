/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Trustworthiness overview card highlighting MetricsRepository confidence reliability
 *          insights sourced via `/api/puzzle/performance-stats`.
 * SRP/DRY check: Pass — focused on rendering trustworthiness data for leaderboards layout.
 */

import React from 'react';
import { Shield, ShieldCheck, Clock, DollarSign } from 'lucide-react';
import type { PerformanceLeaderboards, TrustworthinessLeader } from '@/types/leaderboards';
import {
  formatRatioAsPercentage,
  formatPercentage,
  LEADERBOARD_LIMITS,
  LEADERBOARD_THRESHOLDS,
} from '@/constants/leaderboard';

interface TrustworthinessOverviewCardProps {
  performanceStats?: PerformanceLeaderboards;
  topTrustworthyModels: TrustworthinessLeader[];
  isLoading: boolean;
  onModelSelect?: (modelName: string) => void;
}

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      {[1, 2].map(item => (
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

const formatProcessingTime = (ms: number) => {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const formatCost = (cost: number) => {
  if (!Number.isFinite(cost)) return '—';
  if (cost < 0.01) return `$${(cost * 1000).toFixed(2)}m`;
  return `$${cost.toFixed(3)}`;
};

export function TrustworthinessOverviewCard({
  performanceStats,
  topTrustworthyModels,
  isLoading,
  onModelSelect
}: TrustworthinessOverviewCardProps) {
  if (isLoading) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-info" />
            Trustworthiness Snapshot
          </h2>
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  if (!performanceStats) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-info" />
            Trustworthiness Snapshot
          </h2>
          <p className="text-sm text-base-content/70">
            MetricsRepository has not returned trustworthiness data yet.
          </p>
        </div>
      </div>
    );
  }

  const overallTrustworthiness = formatRatioAsPercentage(performanceStats.overallTrustworthiness, 1);

  return (
    <div className="card bg-base-100 shadow h-full">
      <div className="card-body">
        <h2 className="card-title flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-info" />
          Trustworthiness Snapshot
        </h2>
        <p className="text-sm text-base-content/70">
          Confidence reliability insights powered by MetricsRepository `/api/puzzle/performance-stats`.
        </p>

        <div className="mt-4 rounded-lg border border-base-200 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">Overall trustworthiness</p>
          <div className="mt-2 flex items-center gap-2 text-2xl font-semibold text-base-content">
            {overallTrustworthiness}
            {performanceStats.overallTrustworthiness >= LEADERBOARD_THRESHOLDS.HIGH_TRUSTWORTHINESS && (
              <ShieldCheck className="h-5 w-5 text-success" />
            )}
          </div>
          <p className="mt-1 text-xs text-base-content/50">
            Weighted by the same trustworthiness calculations that guardrail overconfident models server-side.
          </p>
        </div>

        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-base-content/70">
            <ShieldCheck className="h-4 w-4 text-success" />
            Most Reliable Confidence Scores
          </h3>
          {topTrustworthyModels.length === 0 ? (
            <p className="text-sm text-base-content/70">No models met the trustworthiness thresholds.</p>
          ) : (
            <ul className="space-y-2">
              {topTrustworthyModels.map((model, index) => (
                <li
                  key={model.modelName}
                  className={`flex items-center justify-between rounded-lg border border-base-200 p-3 transition-colors ${
                    onModelSelect ? 'cursor-pointer hover:bg-base-200/60' : ''
                  }`}
                  onClick={() => onModelSelect?.(model.modelName)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-info/10 text-sm font-semibold text-info">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-base-content">{model.modelName}</p>
                      <p className="text-xs text-base-content/60">
                        {formatRatioAsPercentage(model.avgTrustworthiness, 1)} trust · {formatPercentage(model.avgConfidence, 1)} confidence
                      </p>
                      <p className="text-xs text-base-content/60">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatProcessingTime(model.avgProcessingTime)}
                        </span>
                        <span className="ml-3 inline-flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> {formatCost(model.avgCost)} avg cost
                        </span>
                      </p>
                    </div>
                  </div>
                  <span className="badge badge-outline badge-lg">
                    {formatCost(model.totalCost)} total cost
                  </span>
                </li>
              ))}
            </ul>
          )}
          {performanceStats.trustworthinessLeaders.length > LEADERBOARD_LIMITS.TOP_MODELS && (
            <p className="mt-3 text-xs text-base-content/60">
              Showing top {LEADERBOARD_LIMITS.TOP_MODELS} of {performanceStats.trustworthinessLeaders.length.toLocaleString()} models with trustworthiness scores.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

