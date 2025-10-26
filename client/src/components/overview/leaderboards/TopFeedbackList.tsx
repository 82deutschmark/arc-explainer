/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-10-26
 * PURPOSE: Displays list of top models by helpful feedback as expandable drilldown in summary card.
 *          Shows which models are rated most helpful by users with feedback counts and percentages.
 * SRP/DRY check: Pass — single responsibility for rendering top feedback model drilldown list.
 *                Reuses Badge component from leaderboard system.
 */

import React from 'react';
import { ThumbsUp, ThumbsDown, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FeedbackModelStat {
  modelName: string;
  feedbackCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  helpfulPercentage: number;
}

interface TopFeedbackListProps {
  models: FeedbackModelStat[];
  isLoading?: boolean;
}

export function TopFeedbackList({ models, isLoading }: TopFeedbackListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-6 w-full animate-pulse rounded bg-slate-200" />
        ))}
      </div>
    );
  }

  if (!models.length) {
    return (
      <div className="text-center py-2 text-[11px] text-slate-500">
        No feedback collected yet.
      </div>
    );
  }

  // Sort by helpful percentage, then by feedback count
  const sorted = [...models].sort((a, b) => {
    if (b.helpfulPercentage !== a.helpfulPercentage) {
      return b.helpfulPercentage - a.helpfulPercentage;
    }
    return b.feedbackCount - a.feedbackCount;
  });

  return (
    <div className="space-y-2">
      {sorted.map((model, index) => (
        <div
          key={model.modelName}
          className="flex flex-wrap items-center gap-2 text-[10px]"
        >
          {/* Rank */}
          <div className="flex-shrink-0 text-slate-500 font-semibold">#{index + 1}</div>

          {/* Model Name Badge */}
          <Badge
            variant="outline"
            className={`text-[10px] ${
              model.helpfulPercentage >= 80
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : model.helpfulPercentage >= 60
                  ? 'border-sky-300 bg-sky-50 text-sky-700'
                  : 'border-slate-300 bg-slate-50 text-slate-700'
            }`}
          >
            {model.modelName}
          </Badge>

          {/* Helpful percentage */}
          <span
            className={`text-[10px] font-semibold ${
              model.helpfulPercentage >= 80
                ? 'text-emerald-700'
                : model.helpfulPercentage >= 60
                  ? 'text-sky-700'
                  : 'text-slate-600'
            }`}
            title={`${model.helpfulPercentage.toFixed(1)}% helpful`}
          >
            {model.helpfulPercentage.toFixed(1)}%
          </span>

          {/* Feedback breakdown */}
          <div className="flex items-center gap-1 text-slate-600">
            <ThumbsUp className="h-3 w-3 text-emerald-600" />
            <span className="text-[10px]">{(model.helpfulCount ?? 0).toLocaleString()}</span>
            <ThumbsDown className="h-3 w-3 text-rose-600" />
            <span className="text-[10px]">{(model.notHelpfulCount ?? 0).toLocaleString()}</span>
          </div>

          {/* Total feedback count */}
          <span className="text-[10px] text-slate-500" title="Total feedback reviews">
            ({(model.feedbackCount ?? 0).toLocaleString()} reviews)
          </span>
        </div>
      ))}

      {models.length > 0 && (
        <div className="mt-1 border-t border-slate-200/50 pt-1.5 text-[10px] text-slate-500">
          <p>Top {Math.min(models.length, 5)} models by helpful feedback</p>
        </div>
      )}
    </div>
  );
}
