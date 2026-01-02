/**
 * Author: ChatGPT
 * Date: 2026-01-01
 * PURPOSE: Interactive leaderboard for correct answers showing key metrics: time, cost, model,
 *          thinking setting. Provides sortable columns, visual bars for comparison, and
 *          color-coded indicators for fast/slow and cheap/expensive runs.
 * SRP/DRY check: Pass - single responsibility (correct answer visualization), reuses formatters.
 */

import React, { useMemo, useState } from 'react';
import {
  Clock,
  DollarSign,
  Brain,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Zap,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatProcessingTimeDetailed } from '@/utils/timeFormatters';
import type { ExplanationData } from '@/types/puzzle';

interface CorrectAnswersLeaderboardProps {
  explanations: ExplanationData[];
  onSelectExplanation?: (id: number) => void;
}

type SortField = 'time' | 'cost' | 'model' | 'thinking';
type SortDirection = 'asc' | 'desc';

/** Map reasoningEffort to a numeric level for sorting and display. */
const THINKING_LEVELS: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  'x-high': 4,
};

const THINKING_LABELS: Record<string, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  'x-high': 'X-High',
};

const THINKING_COLORS: Record<string, string> = {
  none: 'bg-gray-700/50 text-gray-300 border-gray-600',
  low: 'bg-blue-900/40 text-blue-200 border-blue-700/60',
  medium: 'bg-amber-900/40 text-amber-200 border-amber-700/60',
  high: 'bg-orange-900/40 text-orange-200 border-orange-700/60',
  'x-high': 'bg-rose-900/40 text-rose-200 border-rose-700/60',
};

export function CorrectAnswersLeaderboard({
  explanations,
  onSelectExplanation,
}: CorrectAnswersLeaderboardProps) {
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Compute stats for relative scaling
  const stats = useMemo(() => {
    const times = explanations
      .map((e) => e.apiProcessingTimeMs ?? 0)
      .filter((t) => t > 0);
    const costs = explanations
      .map((e) => e.estimatedCost ?? 0)
      .filter((c) => c > 0);

    return {
      minTime: Math.min(...times, 0),
      maxTime: Math.max(...times, 1),
      minCost: Math.min(...costs, 0),
      maxCost: Math.max(...costs, 0.01),
      avgTime: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      avgCost: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0,
    };
  }, [explanations]);

  // Sort explanations
  const sortedExplanations = useMemo(() => {
    const sorted = [...explanations].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'time':
          comparison = (a.apiProcessingTimeMs ?? 0) - (b.apiProcessingTimeMs ?? 0);
          break;
        case 'cost':
          comparison = (a.estimatedCost ?? 0) - (b.estimatedCost ?? 0);
          break;
        case 'model':
          comparison = (a.modelName ?? '').localeCompare(b.modelName ?? '');
          break;
        case 'thinking': {
          const aLevel = THINKING_LEVELS[a.reasoningEffort?.toLowerCase() ?? 'none'] ?? 0;
          const bLevel = THINKING_LEVELS[b.reasoningEffort?.toLowerCase() ?? 'none'] ?? 0;
          comparison = aLevel - bLevel;
          break;
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [explanations, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  // Find the fastest and cheapest for highlighting
  const fastestId = useMemo(() => {
    let fastest: ExplanationData | null = null;
    for (const e of explanations) {
      if (e.apiProcessingTimeMs && (!fastest || e.apiProcessingTimeMs < (fastest.apiProcessingTimeMs ?? Infinity))) {
        fastest = e;
      }
    }
    return fastest?.id;
  }, [explanations]);

  const cheapestId = useMemo(() => {
    let cheapest: ExplanationData | null = null;
    for (const e of explanations) {
      if (e.estimatedCost != null && (!cheapest || e.estimatedCost < (cheapest.estimatedCost ?? Infinity))) {
        cheapest = e;
      }
    }
    return cheapest?.id;
  }, [explanations]);

  const formatCost = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return '$0.00';
    if (value < 0.01) return `$${value.toFixed(4)}`;
    return `$${value.toFixed(2)}`;
  };

  const formatTime = (ms: number | null | undefined) => {
    if (ms == null || !Number.isFinite(ms)) return 'N/A';
    return formatProcessingTimeDetailed(ms);
  };

  const getThinkingKey = (effort: string | null | undefined): string => {
    if (!effort) return 'none';
    const lower = effort.toLowerCase();
    if (lower.includes('x-high') || lower.includes('xhigh')) return 'x-high';
    if (lower.includes('high')) return 'high';
    if (lower.includes('medium') || lower.includes('med')) return 'medium';
    if (lower.includes('low')) return 'low';
    return 'none';
  };

  // Compute bar widths as percentages
  const getTimeBarWidth = (ms: number | null | undefined) => {
    if (!ms || stats.maxTime === 0) return 0;
    return Math.min(100, (ms / stats.maxTime) * 100);
  };

  const getCostBarWidth = (cost: number | null | undefined) => {
    if (!cost || stats.maxCost === 0) return 0;
    return Math.min(100, (cost / stats.maxCost) * 100);
  };

  // Color coding: green = fast/cheap, red = slow/expensive
  const getTimeColor = (ms: number | null | undefined) => {
    if (!ms) return 'bg-gray-600';
    const ratio = ms / stats.maxTime;
    if (ratio < 0.25) return 'bg-emerald-500';
    if (ratio < 0.5) return 'bg-emerald-600/80';
    if (ratio < 0.75) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getCostColor = (cost: number | null | undefined) => {
    if (!cost) return 'bg-gray-600';
    const ratio = cost / stats.maxCost;
    if (ratio < 0.25) return 'bg-emerald-500';
    if (ratio < 0.5) return 'bg-emerald-600/80';
    if (ratio < 0.75) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  if (explanations.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-center">
        <Trophy className="mx-auto h-10 w-10 text-gray-600 mb-3" />
        <p className="text-gray-400">No correct answers yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden">
      {/* Header with summary stats */}
      <div className="border-b border-gray-800 bg-gradient-to-r from-emerald-950/40 via-gray-900 to-gray-900 px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-gray-100">
              Correct Answers Leaderboard
            </h3>
            <Badge variant="outline" className="border-emerald-700/60 bg-emerald-900/30 text-emerald-200 text-xs">
              {explanations.length} result{explanations.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span>Fastest: {formatTime(stats.minTime > 0 ? stats.minTime : null)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>Cheapest: {formatCost(stats.minCost > 0 ? stats.minCost : null)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sortable column headers */}
      <div className="hidden md:grid grid-cols-[minmax(180px,1fr)_100px_140px_140px] gap-3 px-4 py-2 bg-gray-900/80 border-b border-gray-800 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-1 h-auto py-1 px-0 text-gray-500 hover:text-gray-300"
          onClick={() => handleSort('model')}
        >
          Model {getSortIcon('model')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-1 h-auto py-1 px-0 text-gray-500 hover:text-gray-300"
          onClick={() => handleSort('thinking')}
        >
          <Brain className="h-3 w-3" />
          Thinking {getSortIcon('thinking')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-1 h-auto py-1 px-0 text-gray-500 hover:text-gray-300"
          onClick={() => handleSort('time')}
        >
          <Clock className="h-3 w-3" />
          Time {getSortIcon('time')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-1 h-auto py-1 px-0 text-gray-500 hover:text-gray-300"
          onClick={() => handleSort('cost')}
        >
          <DollarSign className="h-3 w-3" />
          Cost {getSortIcon('cost')}
        </Button>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-800/60">
        {sortedExplanations.map((explanation, idx) => {
          const thinkingKey = getThinkingKey(explanation.reasoningEffort);
          const isFastest = explanation.id === fastestId;
          const isCheapest = explanation.id === cheapestId;
          const timeMs = explanation.apiProcessingTimeMs ?? 0;
          const cost = explanation.estimatedCost ?? 0;

          return (
            <div
              key={explanation.id}
              className={cn(
                'group cursor-pointer transition-colors hover:bg-gray-800/50',
                idx % 2 === 1 && 'bg-gray-900/30',
                (isFastest || isCheapest) && 'bg-emerald-950/20'
              )}
              onClick={() => onSelectExplanation?.(explanation.id)}
            >
              {/* Desktop row */}
              <div className="hidden md:grid grid-cols-[minmax(180px,1fr)_100px_140px_140px] gap-3 px-4 py-3 items-center">
                {/* Model */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">
                      {explanation.modelName}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {explanation.createdAt
                        ? new Date(explanation.createdAt).toLocaleDateString()
                        : 'Unknown date'}
                    </p>
                  </div>
                  {isFastest && (
                    <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-700/50 text-[9px] px-1.5">
                      <Zap className="h-2.5 w-2.5 mr-0.5" />
                      Fastest
                    </Badge>
                  )}
                  {isCheapest && !isFastest && (
                    <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-700/50 text-[9px] px-1.5">
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                      Cheapest
                    </Badge>
                  )}
                </div>

                {/* Thinking */}
                <div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-medium border px-2 py-0.5',
                      THINKING_COLORS[thinkingKey]
                    )}
                  >
                    {THINKING_LABELS[thinkingKey]}
                  </Badge>
                </div>

                {/* Time with bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={cn(
                      'font-medium',
                      isFastest ? 'text-emerald-300' : 'text-gray-200'
                    )}>
                      {formatTime(timeMs)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', getTimeColor(timeMs))}
                      style={{ width: `${getTimeBarWidth(timeMs)}%` }}
                    />
                  </div>
                </div>

                {/* Cost with bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={cn(
                      'font-medium',
                      isCheapest ? 'text-emerald-300' : 'text-gray-200'
                    )}>
                      {formatCost(cost)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', getCostColor(cost))}
                      style={{ width: `${getCostBarWidth(cost)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Mobile row */}
              <div className="md:hidden px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-100 truncate">
                      {explanation.modelName}
                    </p>
                    {(isFastest || isCheapest) && (
                      <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-700/50 text-[9px] px-1.5 flex-shrink-0">
                        {isFastest ? <Zap className="h-2.5 w-2.5" /> : <Sparkles className="h-2.5 w-2.5" />}
                      </Badge>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-medium border px-2 py-0.5 flex-shrink-0',
                      THINKING_COLORS[thinkingKey]
                    )}
                  >
                    {THINKING_LABELS[thinkingKey]}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <Clock className="h-3 w-3" />
                      Time
                    </div>
                    <div className="text-xs font-medium text-gray-200">
                      {formatTime(timeMs)}
                    </div>
                    <div className="h-1 rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', getTimeColor(timeMs))}
                        style={{ width: `${getTimeBarWidth(timeMs)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <DollarSign className="h-3 w-3" />
                      Cost
                    </div>
                    <div className="text-xs font-medium text-gray-200">
                      {formatCost(cost)}
                    </div>
                    <div className="h-1 rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', getCostColor(cost))}
                        style={{ width: `${getCostBarWidth(cost)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with averages */}
      <div className="border-t border-gray-800 bg-gray-900/80 px-4 py-2 text-xs text-gray-500">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span>Average time: <span className="text-gray-300 font-medium">{formatTime(stats.avgTime)}</span></span>
          <span>Average cost: <span className="text-gray-300 font-medium">{formatCost(stats.avgCost)}</span></span>
        </div>
      </div>
    </div>
  );
}
