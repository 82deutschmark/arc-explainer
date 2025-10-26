/**
 * Author: gpt-5-codex
 * Date: 2025-10-23
 * Updated: 2025-10-26
 * PURPOSE: Responsive summary grid for leaderboards page. Composes multiple SummaryStatCard components
 *          to highlight key metrics from AccuracyRepository, MetricsRepository, and FeedbackRepository.
 *          Updated to support expandable drilldown content in cards.
 * SRP/DRY check: Pass — layout-only wrapper that keeps the page component lean.
 */

import React from 'react';
import { SummaryStatCard, SummaryTone } from './SummaryStatCard';

export interface LeaderboardSummaryItem {
  id: string;
  title: string;
  value?: string;
  description: string;
  icon: React.ReactNode;
  tone?: SummaryTone;
  footer?: string;
  // New: support expandable drilldown content
  expandableContent?: React.ReactNode;
  onExpandChange?: (isExpanded: boolean) => void;
}

interface LeaderboardSummaryGridProps {
  items: LeaderboardSummaryItem[];
  isLoading?: boolean;
}

export function LeaderboardSummaryGrid({ items, isLoading = false }: LeaderboardSummaryGridProps) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
      {items.map(item => (
        <SummaryStatCard
          key={item.id}
          title={item.title}
          value={item.value}
          description={item.description}
          icon={item.icon}
          tone={item.tone}
          isLoading={isLoading}
          footer={item.footer}
          expandableContent={item.expandableContent}
          onExpandChange={item.onExpandChange}
        />
      ))}
    </div>
  );
}
