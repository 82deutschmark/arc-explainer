/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * PURPOSE: Reusable summary statistic card for the leaderboards dashboard. Displays a headline metric
 *          sourced from AccuracyRepository, MetricsRepository, or FeedbackRepository data via
 *          `useModelLeaderboards`, with optional tone-based styling and loading placeholders.
 * SRP/DRY check: Pass — single-purpose presentational component reused across summary grids.
 */

import React from 'react';

export type SummaryTone = 'default' | 'positive' | 'warning' | 'danger';

interface SummaryStatCardProps {
  title: string;
  value?: string;
  description: string;
  icon: React.ReactNode;
  tone?: SummaryTone;
  isLoading?: boolean;
  footer?: string;
}

const toneClasses: Record<SummaryTone, string> = {
  default: 'border-slate-200 bg-white',
  positive: 'border-emerald-200 bg-emerald-50',
  warning: 'border-amber-200 bg-amber-50',
  danger: 'border-rose-200 bg-rose-50',
};

export function SummaryStatCard({
  title,
  value,
  description,
  icon,
  tone = 'default',
  isLoading = false,
  footer,
}: SummaryStatCardProps) {
  return (
    <div
      className={`rounded-xl border shadow-sm transition hover:shadow-md focus-within:ring-2 focus-within:ring-primary/40 ${toneClasses[tone]}`}
      tabIndex={0}
    >
      <div className="flex items-start gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-primary shadow-inner">
          {icon}
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-6 w-24 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            </div>
          ) : (
            <>
              <p className="text-2xl font-semibold text-slate-900">{value ?? '—'}</p>
              <p className="text-sm text-slate-600">{description}</p>
            </>
          )}
        </div>
      </div>
      {!isLoading && footer && (
        <div className="border-t border-white/60 px-5 py-3 text-xs font-medium text-slate-600">
          {footer}
        </div>
      )}
    </div>
  );
}
