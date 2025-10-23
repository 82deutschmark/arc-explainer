/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Rebuilt leaderboards page composed of modular components that draw directly from
 *          AccuracyRepository and MetricsRepository-backed APIs for real performance insights.
 * SRP/DRY check: Pass — page orchestrates data hook and presentation components without duplicating logic.
 */

import React, { useMemo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { AccuracyOverviewCard } from '@/components/leaderboards/AccuracyOverviewCard';
import { TrustworthinessOverviewCard } from '@/components/leaderboards/TrustworthinessOverviewCard';
import { ReliabilitySummaryCard } from '@/components/leaderboards/ReliabilitySummaryCard';
import { ConfidenceDistributionCard } from '@/components/leaderboards/ConfidenceDistributionCard';
import { ModelPerformanceTable } from '@/components/leaderboards/ModelPerformanceTable';
import { ModelTrendChart } from '@/components/leaderboards/ModelTrendChart';
import { useLeaderboardMetrics } from '@/hooks/useLeaderboardMetrics';

function resolveErrorMessage(value: unknown): string {
  if (!value) return '';
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

export default function Leaderboards() {
  const { data, summary, performanceRows, queryState, errors, loading, refetch } = useLeaderboardMetrics();

  const errorMessages = useMemo(
    () =>
      Object.entries(errors)
        .map(([, value]) => resolveErrorMessage(value))
        .filter(message => Boolean(message)),
    [errors]
  );

  const isRefreshing = queryState.isLoadingAll;
  const chartModels = summary.topAccuracyModels.length
    ? summary.topAccuracyModels
    : data.accuracyStats?.modelAccuracyRankings ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Model Leaderboards</h1>
          <p className="mt-1 max-w-2xl text-sm text-base-content/70">
            Explore real-time puzzle accuracy, trustworthiness, and reliability metrics sourced from AccuracyRepository and
            MetricsRepository endpoints. Each section reflects live production data — no mock stats.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm self-start"
          onClick={() => refetch()}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh data
        </button>
      </header>

      {errorMessages.length > 0 && (
        <div className="rounded-lg border border-error/40 bg-error/10 p-4 text-sm text-error">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">One or more leaderboard feeds returned an error.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errorMessages.map((message, index) => (
                  <li key={`${message}-${index}`}>{message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-3">
        <AccuracyOverviewCard
          accuracyStats={data.accuracyStats}
          totals={summary.totals}
          topModels={summary.topAccuracyModels}
          isLoading={loading.accuracy}
        />
        <TrustworthinessOverviewCard
          performanceStats={data.performanceStats}
          topTrustworthyModels={summary.topTrustworthyModels}
          isLoading={loading.performance}
        />
        <ReliabilitySummaryCard
          reliabilityStats={data.reliabilityStats}
          topReliableModels={summary.mostReliableModels}
          isLoading={loading.reliability}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ConfidenceDistributionCard
          overconfidentModels={data.overconfidentModels}
          isLoading={loading.overconfident}
        />
        <ModelTrendChart accuracyModels={chartModels} isLoading={loading.accuracy} />
      </section>

      <section>
        <ModelPerformanceTable
          rows={performanceRows}
          isLoading={loading.accuracy || loading.performance || loading.reliability}
        />
      </section>
    </div>
  );
}

