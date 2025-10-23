/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Confidence distribution card exposing overconfident models detected by
 *          AccuracyRepository via `/api/feedback/overconfident-models`.
 * SRP/DRY check: Pass — focuses on surfacing high-risk confidence behaviour.
 */

import React from 'react';
import { Flame, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { OverconfidentModel } from '@/types/leaderboards';
import {
  formatCount,
  formatPercentage,
  LEADERBOARD_LIMITS,
  LEADERBOARD_THRESHOLDS,
} from '@/constants/leaderboard';

interface ConfidenceDistributionCardProps {
  overconfidentModels?: OverconfidentModel[];
  isLoading: boolean;
  onModelSelect?: (modelName: string) => void;
}

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4].map(item => (
      <div key={item} className="animate-pulse rounded-lg border border-base-200 p-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-40 rounded bg-base-300" />
          <div className="h-4 w-20 rounded bg-base-300" />
        </div>
      </div>
    ))}
  </div>
);

const riskBadge = (model: OverconfidentModel) => {
  if (model.isHighRisk || model.overconfidenceRate >= LEADERBOARD_THRESHOLDS.HIGH_CONFIDENCE_RATE) {
    return (
      <span className="badge badge-error badge-outline flex items-center gap-1 text-xs">
        <ShieldAlert className="h-3 w-3" /> High risk
      </span>
    );
  }

  if (model.overconfidenceRate >= LEADERBOARD_THRESHOLDS.OVERCONFIDENT_RATE) {
    return (
      <span className="badge badge-warning badge-outline text-xs">Watchlist</span>
    );
  }

  return <span className="badge badge-outline text-xs">Monitored</span>;
};

export function ConfidenceDistributionCard({ overconfidentModels, isLoading, onModelSelect }: ConfidenceDistributionCardProps) {
  if (isLoading) {
    return (
      <div className="card bg-base-100 shadow h-full">
        <div className="card-body">
          <h2 className="card-title flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5 text-error" />
            Confidence Risks
          </h2>
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  if (!overconfidentModels || overconfidentModels.length === 0) {
    return (
      <div className="card bg-base-100 shadow h-full">
        <div className="card-body">
          <h2 className="card-title flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5 text-error" />
            Confidence Risks
          </h2>
          <p className="text-sm text-base-content/70">
            AccuracyRepository has not flagged any overconfident models with ≥
            {LEADERBOARD_THRESHOLDS.SIGNIFICANT_ATTEMPTS.toLocaleString()} attempts.
          </p>
        </div>
      </div>
    );
  }

  const visibleModels = overconfidentModels.slice(0, LEADERBOARD_LIMITS.TOP_MODELS);

  return (
    <div className="card bg-base-100 shadow h-full">
      <div className="card-body">
        <h2 className="card-title flex items-center gap-2 text-lg">
          <Flame className="h-5 w-5 text-error" />
          Confidence Risks
        </h2>
        <p className="text-sm text-base-content/70">
          High confidence misses from AccuracyRepository `/api/feedback/overconfident-models` endpoint.
        </p>

        <ul className="mt-4 space-y-3">
          {visibleModels.map(model => (
            <li
              key={model.modelName}
              className={`rounded-lg border border-base-200 p-3 transition-colors ${
                onModelSelect ? 'cursor-pointer hover:bg-base-200/60' : ''
              }`}
              onClick={() => onModelSelect?.(model.modelName)}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-base-content">{model.modelName}</p>
                  <p className="text-xs text-base-content/60">
                    {formatCount(model.totalOverconfidentAttempts)} risky attempts · {formatPercentage(model.overconfidenceRate, 1)} overconfidence
                  </p>
                  <p className="text-xs text-base-content/60">
                    {formatPercentage(model.avgConfidence, 1)} avg confidence · {formatPercentage(model.overallAccuracy, 1)} accuracy
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 text-xs">
                  {riskBadge(model)}
                  <span className="badge badge-outline">
                    {formatCount(model.totalAttempts)} total attempts
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {overconfidentModels.length > LEADERBOARD_LIMITS.TOP_MODELS && (
          <p className="mt-3 text-xs text-base-content/60">
            Showing top {LEADERBOARD_LIMITS.TOP_MODELS} of {overconfidentModels.length.toLocaleString()} high-confidence risk profiles.
          </p>
        )}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="h-4 w-4" />
          Prioritize retraining prompts or throttling usage for these models before deploying to production users.
        </div>
      </div>
    </div>
  );
}

