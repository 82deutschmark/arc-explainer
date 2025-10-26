/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * Updated: 2025-10-26
 * PURPOSE: Reusable summary statistic card for the leaderboards dashboard. Displays a headline metric
 *          sourced from AccuracyRepository, MetricsRepository, or FeedbackRepository data via
 *          `useModelLeaderboards`, with optional tone-based styling and expandable drilldown content.
 * SRP/DRY check: Pass — single-purpose presentational component reused across summary grids.
 *                Updated to support expandable content for actionable metric drilldowns.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type SummaryTone = 'default' | 'positive' | 'warning' | 'danger';

interface SummaryStatCardProps {
  title: string;
  value?: string;
  description: string;
  icon: React.ReactNode;
  tone?: SummaryTone;
  isLoading?: boolean;
  footer?: string;
  // New: support expandable content for drilldowns
  expandableContent?: React.ReactNode;
  onExpandChange?: (isExpanded: boolean) => void;
}

const toneClasses: Record<SummaryTone, string> = {
  default: 'border-slate-200 bg-white',
  positive: 'border-emerald-200 bg-emerald-50/80',
  warning: 'border-amber-200 bg-amber-50/80',
  danger: 'border-rose-200 bg-rose-50/80',
};

export function SummaryStatCard({
  title,
  value,
  description,
  icon,
  tone = 'default',
  isLoading = false,
  footer,
  expandableContent,
  onExpandChange,
}: SummaryStatCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    onExpandChange?.(newState);
  };

  const hasExpandableContent = !!expandableContent;

  return (
    <div
      className={`group rounded-md border text-slate-800 shadow-sm transition ${
        hasExpandableContent ? 'cursor-pointer hover:border-slate-400' : 'hover:border-slate-400'
      } focus-within:ring-2 focus-within:ring-slate-400/30 ${toneClasses[tone]}`}
      tabIndex={hasExpandableContent ? 0 : -1}
    >
      <div
        className="flex items-start gap-2.5 px-3 py-2.5"
        onClick={hasExpandableContent ? handleToggle : undefined}
        role={hasExpandableContent ? 'button' : undefined}
        onKeyDown={
          hasExpandableContent
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggle();
                }
              }
            : undefined
        }
      >
        <div className="mt-0.5 flex h-6 w-6 items-center justify-center text-slate-600 group-hover:text-slate-900">
          {icon}
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{title}</p>
          {isLoading ? (
            <div className="space-y-1.5">
              <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
            </div>
          ) : (
            <>
              <p className="text-base font-semibold text-slate-900">{value ?? '—'}</p>
              <p className="text-[11px] leading-snug text-slate-600">{description}</p>
            </>
          )}
        </div>
        {hasExpandableContent && !isLoading && (
          <div className="mt-0.5 text-slate-600 transition group-hover:text-slate-900">
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        )}
      </div>
      {!isLoading && footer && (
        <div className="border-t border-white/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
          {footer}
        </div>
      )}
      {isExpanded && hasExpandableContent && (
        <div className="border-t border-slate-200/50 px-3 py-2.5 bg-slate-50/30">
          {expandableContent}
        </div>
      )}
    </div>
  );
}
