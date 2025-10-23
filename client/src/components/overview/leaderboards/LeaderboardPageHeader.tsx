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
    <header className="rounded-lg border border-slate-800/70 bg-slate-950 p-3 text-slate-100 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1 text-[10px] font-medium uppercase tracking-[0.25em] text-slate-400">
            <span className="rounded-sm bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200">Live metrics</span>
            <span className="text-slate-500">Accuracy · Metrics · Feedback</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold leading-tight">ARC model leaderboards</h1>
            <p className="text-[12px] text-slate-400">
              Single-screen snapshot of solver accuracy, calibration, infrastructure reliability, and human feedback.
            </p>
          </div>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
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
          <div key={stat.label} className="rounded border border-white/15 bg-white/5 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">{stat.label}</p>
            {isLoading ? (
              <div className="mt-1.5 h-5 w-14 animate-pulse rounded bg-white/25" />
            ) : (
              <p className="mt-1 text-base font-semibold text-white">{stat.value}</p>
            )}
          </div>
        ))}
      </div>
    </header>
  );
}
