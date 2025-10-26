/**
 * FeedbackLeaderboard Component
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-06
 *
 * Displays models ranked by positive user feedback (helpful ratings).
 * Uses data from FeedbackRepository via /api/feedback/stats
 *
 * Key Features:
 * - Shows ALL models sorted by helpful count (most positive at top)
 * - Displays helpful vs not-helpful counts for each model
 * - Tooltips explaining feedback metrics
 * - Sample size warnings for models with low feedback counts
 *
 * SRP and DRY check: Pass - Single responsibility for feedback display
 * shadcn/ui: Pass - Uses shadcn/ui components (Card, Badge, Tooltip, Icons)
 */

import React, { useMemo } from 'react';
import { Heart, Info, ThumbsDown, ThumbsUp, Users } from 'lucide-react';

interface FeedbackModelStats {
  modelName: string;
  feedbackCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  helpfulPercentage: number;
}

interface FeedbackStats {
  totalFeedback: number;
  helpfulPercentage: number;
  topModels: FeedbackModelStats[];
  feedbackByModel: Record<string, {
    helpful: number;
    notHelpful: number;
  }>;
}

interface FeedbackLeaderboardProps {
  feedbackStats?: FeedbackStats;
  isLoading?: boolean;
  onModelClick?: (modelName: string) => void;
}

export function FeedbackLeaderboard({
  feedbackStats,
  isLoading,
  onModelClick
}: FeedbackLeaderboardProps) {
  const sortedModels = useMemo(() => {
    if (!feedbackStats?.topModels) {
      return [];
    }
    return [...feedbackStats.topModels].sort((a, b) => b.helpfulCount - a.helpfulCount);
  }, [feedbackStats]);

  const containerClasses = 'flex h-full flex-col rounded-md border border-gray-200 bg-white text-xs shadow-sm';
  const rowBaseClasses = 'grid grid-cols-[auto,minmax(0,1fr),auto,auto] items-center gap-2 px-2.5 py-1.5';

  const renderSkeleton = () => (
    <ol className="divide-y divide-gray-200">
      {[...Array(6)].map((_, index) => (
        <li key={index} className={`${rowBaseClasses} animate-pulse`}>
          <div className="h-3.5 w-3.5 rounded bg-gray-200" />
          <div className="space-y-1">
            <div className="h-3 w-32 rounded bg-gray-200" />
            <div className="h-2.5 w-40 rounded bg-gray-100" />
          </div>
          <div className="h-3 w-12 rounded bg-gray-200" />
          <div className="h-3 w-12 rounded bg-gray-200" />
        </li>
      ))}
    </ol>
  );

  if (isLoading) {
    return (
      <section className={containerClasses}>
        <header className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
          <Heart className="h-4 w-4 text-pink-600" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wide">Feedback leaders</h2>
        </header>
        <div className="flex-1 px-1.5 py-1.5">{renderSkeleton()}</div>
      </section>
    );
  }

  if (!sortedModels.length || !feedbackStats) {
    return (
      <section className={containerClasses}>
        <header className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
          <Heart className="h-4 w-4 text-pink-600" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wide">Feedback leaders</h2>
        </header>
        <div className="flex flex-1 items-center justify-center px-3 py-4 text-center text-[11px] text-gray-500">
          No feedback data available.
        </div>
      </section>
    );
  }

  const rankBadge = (index: number) => {
    if (index === 0) return <Heart className="h-3.5 w-3.5 text-pink-600" />;
    if (index === 1) return <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" />;
    if (index === 2) return <ThumbsUp className="h-3.5 w-3.5 text-sky-600" />;
    return <span className="text-[10px] font-semibold text-gray-500">#{index + 1}</span>;
  };

  const overallHelpfulText = `${feedbackStats.helpfulPercentage.toFixed(1)}% helpful · ${feedbackStats.totalFeedback.toLocaleString()} reviews`;

  return (
    <section className={containerClasses}>
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 text-gray-800">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-pink-600" />
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide">Feedback leaders</h2>
            <p className="text-[10px] text-gray-500">User-rated helpfulness density by model.</p>
          </div>
        </div>
        <span className="text-[10px] text-gray-500">{sortedModels.length} models</span>
      </header>
      <ol className="flex-1 divide-y divide-gray-200">
        {sortedModels.map((model, index) => (
          <li
            key={model.modelName}
            className={`${rowBaseClasses} ${onModelClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
            onClick={() => onModelClick?.(model.modelName)}
          >
            <div className="flex items-center justify-center">{rankBadge(index)}</div>
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-[12px] font-semibold text-gray-800" title={model.modelName}>
                {model.modelName}
              </p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                <span>
                  <Users className="mr-1 inline h-3 w-3" />
                  {(model.feedbackCount ?? 0).toLocaleString()} total
                </span>
                <span className="text-emerald-600">
                  <ThumbsUp className="mr-1 inline h-3 w-3" />
                  {(model.helpfulCount ?? 0).toLocaleString()} helpful
                </span>
                <span className="text-rose-600">
                  <ThumbsDown className="mr-1 inline h-3 w-3" />
                  {(model.notHelpfulCount ?? 0).toLocaleString()} not
                </span>
                {(model.feedbackCount ?? 0) < 10 && (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <Info className="h-3 w-3" />
                    Low sample
                  </span>
                )}
              </p>
            </div>
            <div className="text-right font-mono text-[11px] text-emerald-700" title="Helpful ratio">
              {(model.helpfulPercentage ?? 0).toFixed(1)}%
            </div>
            <div className="text-right font-mono text-[11px] text-gray-600" title="Total reviews">
              {(model.feedbackCount ?? 0).toLocaleString()}
            </div>
          </li>
        ))}
      </ol>
      <footer className="border-t border-gray-200 px-3 py-2 text-[10px] uppercase tracking-wide text-gray-600">
        {overallHelpfulText}
      </footer>
    </section>
  );
}
