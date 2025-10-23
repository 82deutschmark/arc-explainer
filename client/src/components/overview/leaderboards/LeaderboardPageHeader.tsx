/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Leaderboards hero header that contextualises live statistics sourced from the accuracy,
 *          metrics, and feedback repositories. Provides a simple refresh affordance and responsive
 *          layout for headline numbers.
 * SRP/DRY check: Pass — presentation-only component; data shaping handled by page container.
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';

interface LeaderboardPageHeaderProps {
  modelCount?: number;
  totalAttempts?: number;
  helpfulPercentage?: number;
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function LeaderboardPageHeader({
  modelCount,
  totalAttempts,
  helpfulPercentage,
  isLoading = false,
  onRefresh,
  isRefreshing = false,
}: LeaderboardPageHeaderProps) {
  const attemptsText = totalAttempts !== undefined ? totalAttempts.toLocaleString() : '—';
  const modelsText = modelCount !== undefined ? modelCount.toLocaleString() : '—';
  const helpfulText = helpfulPercentage !== undefined ? `${helpfulPercentage.toFixed(1)}%` : '—';

  return (
    <header className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-lg">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4 lg:max-w-3xl">
          <div className="flex items-center gap-3 text-sm uppercase tracking-widest text-slate-300">
            <span className="rounded-full bg-slate-700 px-3 py-1 font-semibold">Live metrics</span>
            <span>AccuracyRepository · MetricsRepository · FeedbackRepository</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold leading-tight md:text-4xl">ARC Model Leaderboards</h1>
            <p className="mt-3 text-base text-slate-200 md:text-lg">
              Track solver accuracy, calibrated confidence, infrastructure reliability, and user satisfaction across every model in production.
            </p>
          </div>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 self-start rounded-full border border-slate-500 bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh data
          </button>
        )}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[{
          label: 'Tracked models',
          value: modelsText,
        }, {
          label: 'Solver attempts analysed',
          value: attemptsText,
        }, {
          label: 'Helpful feedback ratio',
          value: helpfulText,
        }].map(stat => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-slate-300">{stat.label}</p>
            {isLoading ? (
              <div className="mt-2 h-7 w-20 animate-pulse rounded bg-white/30" />
            ) : (
              <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
            )}
          </div>
        ))}
      </div>
    </header>
  );
}
