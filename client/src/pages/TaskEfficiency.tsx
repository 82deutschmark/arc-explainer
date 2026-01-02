/**
 * Author: ChatGPT
 * Date: 2026-01-01
 * PURPOSE: Shareable Task Efficiency page - embeds the TaskEfficiencyLeaderboard component.
 *          Clean, simple, reuses the existing component for consistency.
 * SRP/DRY check: Pass - reuses TaskEfficiencyLeaderboard, just adds page wrapper.
 */

import React, { useMemo } from 'react';
import { useParams, Link } from 'wouter';
import { Trophy, ArrowLeft } from 'lucide-react';
import { getPuzzleName } from '@shared/utils/puzzleNames';
import { usePaginatedExplanationSummaries } from '@/hooks/useExplanation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskEfficiencyLeaderboard } from '@/components/puzzle/TaskEfficiencyLeaderboard';

export default function TaskEfficiency() {
  const { taskId } = useParams<{ taskId: string }>();

  // Fetch only correct explanations
  const { summaries, isInitialLoading, counts } = usePaginatedExplanationSummaries(taskId, {
    pageSize: 1000,
    correctness: 'correct',
  });

  const puzzleName = useMemo(() => getPuzzleName(taskId), [taskId]);

  // Helper to parse potentially string values from DB
  const toNum = (val: unknown): number | null => {
    if (val == null) return null;
    const num = typeof val === 'string' ? parseFloat(val) : Number(val);
    return Number.isFinite(num) && num > 0 ? num : null;
  };

  // Compute comparison stats for the summary section
  const comparisonStats = useMemo(() => {
    if (!summaries || summaries.length === 0) return null;

    let minTime = Infinity, maxTime = 0;
    let minCost = Infinity, maxCost = 0;
    let fastestModel = '', slowestModel = '';
    let cheapestModel = '', expensiveModel = '';

    for (const e of summaries) {
      const time = toNum(e.apiProcessingTimeMs);
      const cost = toNum(e.estimatedCost);

      if (time !== null) {
        if (time < minTime) { minTime = time; fastestModel = e.modelName; }
        if (time > maxTime) { maxTime = time; slowestModel = e.modelName; }
      }
      if (cost !== null) {
        if (cost < minCost) { minCost = cost; cheapestModel = e.modelName; }
        if (cost > maxCost) { maxCost = cost; expensiveModel = e.modelName; }
      }
    }

    if (minTime === Infinity || maxTime === 0 || minCost === Infinity || maxCost === 0) {
      return null;
    }

    return {
      minTime, maxTime, minCost, maxCost,
      fastestModel, slowestModel, cheapestModel, expensiveModel,
      timeMultiplier: maxTime / minTime,
      costMultiplier: maxCost / minCost,
    };
  }, [summaries]);

  // Formatters
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`;
  };

  // Loading state
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-3xl mx-auto">
          <Skeleton className="h-10 w-64 mb-4 bg-gray-800" />
          <Skeleton className="h-[500px] bg-gray-800" />
        </div>
      </div>
    );
  }

  // No correct solutions
  if (!summaries || summaries.length === 0) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-3xl mx-auto text-center py-16">
          <Trophy className="mx-auto h-12 w-12 text-gray-600 mb-4" />
          <h1 className="text-2xl font-bold text-gray-200 mb-2">No Correct Solutions Yet</h1>
          <p className="text-gray-500 mb-6">Task {taskId} doesn't have any correct solutions to compare.</p>
          <Link href={`/task/${taskId}`}>
            <a className="text-emerald-400 hover:text-emerald-300 underline">
              View task details
            </a>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-50">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gradient-to-r from-emerald-950/20 via-black to-black">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link href={`/task/${taskId}#correct`}>
            <a className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-2">
              <ArrowLeft className="h-3 w-3" />
              Back to task (correct filter)
            </a>
          </Link>
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-emerald-400" />
            <div>
              <h1 className="text-xl font-bold text-gray-100">
                Task Efficiency Leaderboard
              </h1>
              <p className="text-sm text-gray-400">
                <span className="font-mono text-emerald-300">{taskId}</span>
                {puzzleName && <span> - {puzzleName}</span>}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Badge variant="outline" className="border-emerald-700/60 bg-emerald-900/30 text-emerald-200">
              {summaries.length} correct solution{summaries.length !== 1 ? 's' : ''}
            </Badge>
            <span className="text-xs text-gray-500">
              {counts?.all ?? 0} total attempts
            </span>
          </div>
        </div>
      </div>

      {/* Quick comparison summary */}
      {comparisonStats && (
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/40">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Quick Comparison</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500">Fastest vs Slowest:</span>
                <p className="text-gray-200 mt-1">
                  <span className="text-emerald-300 font-mono">{formatTime(comparisonStats.minTime)}</span>
                  {' vs '}
                  <span className="text-rose-300 font-mono">{formatTime(comparisonStats.maxTime)}</span>
                  <span className="text-gray-500 ml-1">
                    ({comparisonStats.timeMultiplier.toFixed(1)}x slower)
                  </span>
                </p>
                <p className="text-gray-500 text-[10px] mt-0.5 truncate">
                  {comparisonStats.fastestModel} vs {comparisonStats.slowestModel}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Cheapest vs Most Expensive:</span>
                <p className="text-gray-200 mt-1">
                  <span className="text-emerald-300 font-mono">{formatCost(comparisonStats.minCost)}</span>
                  {' vs '}
                  <span className="text-rose-300 font-mono">{formatCost(comparisonStats.maxCost)}</span>
                  <span className="text-gray-500 ml-1">
                    ({comparisonStats.costMultiplier.toFixed(1)}x more)
                  </span>
                </p>
                <p className="text-gray-500 text-[10px] mt-0.5 truncate">
                  {comparisonStats.cheapestModel} vs {comparisonStats.expensiveModel}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main leaderboard - reuse the existing component */}
      <div className="max-w-3xl mx-auto px-4 pb-8">
        <div className="h-[600px]">
          <TaskEfficiencyLeaderboard
            explanations={summaries}
            taskId={taskId}
            onSelectExplanation={(id) => {
              // Navigate to the task page with highlight
              window.location.href = `/task/${taskId}?highlight=${id}`;
            }}
          />
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-xs text-gray-600">
          <p>Click any entry to view the full solution</p>
        </div>
      </div>
    </div>
  );
}
