/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Combined model performance table that aligns AccuracyRepository accuracy,
 *          MetricsRepository trustworthiness, and reliability stats for holistic comparisons.
 * SRP/DRY check: Pass — renders aggregated leaderboard table using shared data rows.
 */

import React from 'react';
import type { ModelPerformanceRow } from '@/types/leaderboards';
import {
  formatCount,
  formatPercentage,
  formatRatioAsPercentage,
  LEADERBOARD_LIMITS,
  LEADERBOARD_THRESHOLDS,
} from '@/constants/leaderboard';

interface ModelPerformanceTableProps {
  rows: ModelPerformanceRow[];
  isLoading: boolean;
  onModelSelect?: (modelName: string) => void;
}

const LoadingRow = () => (
  <tr className="animate-pulse">
    <td className="px-4 py-3">
      <div className="h-4 w-32 rounded bg-base-300" />
    </td>
    {[1, 2, 3, 4].map(col => (
      <td key={col} className="px-4 py-3">
        <div className="h-4 w-16 rounded bg-base-300" />
      </td>
    ))}
  </tr>
);

const accuracyBadgeClass = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return 'badge badge-outline';
  if (value >= LEADERBOARD_THRESHOLDS.HIGH_ACCURACY) return 'badge badge-success badge-outline';
  if (value >= LEADERBOARD_THRESHOLDS.MEDIUM_ACCURACY) return 'badge badge-warning badge-outline';
  return 'badge badge-error badge-outline';
};

const trustworthinessBadgeClass = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return 'badge badge-outline';
  if (value >= LEADERBOARD_THRESHOLDS.HIGH_TRUSTWORTHINESS) return 'badge badge-success badge-outline';
  if (value >= LEADERBOARD_THRESHOLDS.MEDIUM_TRUSTWORTHINESS) return 'badge badge-info badge-outline';
  return 'badge badge-warning badge-outline';
};

const reliabilityBadgeClass = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return 'badge badge-outline';
  if (value >= LEADERBOARD_THRESHOLDS.HIGH_RELIABILITY) return 'badge badge-success badge-outline';
  if (value >= LEADERBOARD_THRESHOLDS.MEDIUM_RELIABILITY) return 'badge badge-info badge-outline';
  return 'badge badge-warning badge-outline';
};

export function ModelPerformanceTable({ rows, isLoading, onModelSelect }: ModelPerformanceTableProps) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="card-title text-lg">Unified Model Leaderboard</h2>
            <p className="text-sm text-base-content/70">
              Combines AccuracyRepository accuracy, MetricsRepository trustworthiness, and reliability stats for direct comparison.
            </p>
          </div>
          <p className="text-xs text-base-content/60">
            Showing up to {LEADERBOARD_LIMITS.TABLE_ROWS} models with recent activity.
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-base-content/60">
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-left">Accuracy</th>
                <th className="px-4 py-3 text-left">Attempts / Requests</th>
                <th className="px-4 py-3 text-left">Trustworthiness</th>
                <th className="px-4 py-3 text-left">Confidence</th>
                <th className="px-4 py-3 text-left">Reliability</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && rows.length === 0 && Array.from({ length: 5 }).map((_, index) => <LoadingRow key={index} />)}

              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-base-content/70">
                    No recent stats available. Trigger puzzle runs to populate AccuracyRepository and MetricsRepository data.
                  </td>
                </tr>
              )}

              {rows.map(row => (
                <tr
                  key={row.modelName}
                  className={`${onModelSelect ? 'cursor-pointer hover:bg-base-200/60' : ''}`}
                  onClick={() => onModelSelect?.(row.modelName)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-base-content">{row.modelName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={accuracyBadgeClass(row.accuracyPercentage)}>
                      {formatPercentage(row.accuracyPercentage, 1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-base-content/80">{formatCount(row.totalAttempts)}</td>
                  <td className="px-4 py-3">
                    <span className={trustworthinessBadgeClass(row.trustworthiness)}>
                      {formatRatioAsPercentage(row.trustworthiness, 2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge badge-outline">{formatPercentage(row.avgConfidence, 1)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={reliabilityBadgeClass(row.reliability)}>
                      {formatRatioAsPercentage(row.reliability, 2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

