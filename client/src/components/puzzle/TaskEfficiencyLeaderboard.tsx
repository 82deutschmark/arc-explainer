/**
 * Author: ChatGPT
 * Date: 2026-01-01
 * PURPOSE: Task Efficiency Leaderboard - compact, sortable view of correct solutions.
 *          Shows exact time, cost, tokens. Sortable by clicking headers.
 *          Zero-cost excluded from cheapest. No rounded token counts.
 * SRP/DRY check: Pass - single responsibility (efficiency ranking).
 */

import React, { useMemo, useState } from 'react';
import { Clock, DollarSign, Coins, ArrowUp, ArrowDown, Zap, Trophy, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatProcessingTimeDetailed } from '@/utils/timeFormatters';
import type { ExplanationData } from '@/types/puzzle';

interface TaskEfficiencyLeaderboardProps {
  explanations: ExplanationData[];
  taskId?: string;
  onSelectExplanation?: (id: number) => void;
}

type SortField = 'time' | 'cost' | 'tokens';

export function TaskEfficiencyLeaderboard({
  explanations,
  taskId,
  onSelectExplanation,
}: TaskEfficiencyLeaderboardProps) {
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortAsc, setSortAsc] = useState(true);

  // Debug: log what we're receiving
  // console.log('TaskEfficiencyLeaderboard explanations:', explanations.map(e => ({
  //   id: e.id,
  //   model: e.modelName,
  //   time: e.apiProcessingTimeMs,
  //   cost: e.estimatedCost,
  //   tokens: e.totalTokens,
  // })));

  // Helper to parse potentially string values from DB
  const toNum = (val: unknown): number | null => {
    if (val == null) return null;
    const num = typeof val === 'string' ? parseFloat(val) : Number(val);
    return Number.isFinite(num) && num > 0 ? num : null;
  };

  // Compute stats - exclude zeros/nulls from min calculations
  const stats = useMemo(() => {
    const validTimes: number[] = [];
    const validCosts: number[] = [];
    const validTokens: number[] = [];

    for (const e of explanations) {
      const time = toNum(e.apiProcessingTimeMs);
      const cost = toNum(e.estimatedCost);
      const tokens = toNum(e.totalTokens);

      if (time !== null) validTimes.push(time);
      if (cost !== null) validCosts.push(cost);
      if (tokens !== null) validTokens.push(tokens);
    }

    return {
      minTime: validTimes.length > 0 ? Math.min(...validTimes) : null,
      maxTime: validTimes.length > 0 ? Math.max(...validTimes) : null,
      minCost: validCosts.length > 0 ? Math.min(...validCosts) : null,
      maxCost: validCosts.length > 0 ? Math.max(...validCosts) : null,
      minTokens: validTokens.length > 0 ? Math.min(...validTokens) : null,
    };
  }, [explanations]);

  // Sort explanations - use toNum for proper string handling
  const sortedExplanations = useMemo(() => {
    const sorted = [...explanations].sort((a, b) => {
      const fallback = sortAsc ? Infinity : -Infinity;

      switch (sortField) {
        case 'time':
          return sortAsc
            ? (toNum(a.apiProcessingTimeMs) ?? fallback) - (toNum(b.apiProcessingTimeMs) ?? fallback)
            : (toNum(b.apiProcessingTimeMs) ?? fallback) - (toNum(a.apiProcessingTimeMs) ?? fallback);
        case 'cost':
          return sortAsc
            ? (toNum(a.estimatedCost) ?? fallback) - (toNum(b.estimatedCost) ?? fallback)
            : (toNum(b.estimatedCost) ?? fallback) - (toNum(a.estimatedCost) ?? fallback);
        case 'tokens':
          return sortAsc
            ? (toNum(a.totalTokens) ?? fallback) - (toNum(b.totalTokens) ?? fallback)
            : (toNum(b.totalTokens) ?? fallback) - (toNum(a.totalTokens) ?? fallback);
        default:
          return 0;
      }
    });

    return sorted;
  }, [explanations, sortField, sortAsc]);

  // Find best IDs for highlighting - use toNum for proper string handling
  const fastestId = useMemo(() => {
    let bestId: number | null = null;
    let bestTime = Infinity;
    for (const e of explanations) {
      const time = toNum(e.apiProcessingTimeMs);
      if (time !== null && time < bestTime) {
        bestTime = time;
        bestId = e.id;
      }
    }
    return bestId;
  }, [explanations]);

  const cheapestId = useMemo(() => {
    let bestId: number | null = null;
    let bestCost = Infinity;
    for (const e of explanations) {
      const cost = toNum(e.estimatedCost);
      if (cost !== null && cost < bestCost) {
        bestCost = cost;
        bestId = e.id;
      }
    }
    return bestId;
  }, [explanations]);

  const fewestTokensId = useMemo(() => {
    let bestId: number | null = null;
    let bestTokens = Infinity;
    for (const e of explanations) {
      const tokens = toNum(e.totalTokens);
      if (tokens !== null && tokens < bestTokens) {
        bestTokens = tokens;
        bestId = e.id;
      }
    }
    return bestId;
  }, [explanations]);

  // Formatters - show exact values, no rounding for tokens
  // Handle string values from DB by parsing to number first
  const formatCost = (value: number | string | null | undefined): string => {
    if (value == null) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!Number.isFinite(num) || num === 0) return '-';
    // Always show 4 decimal places for precision
    return `$${num.toFixed(4)}`;
  };

  const formatTime = (ms: number | string | null | undefined): string => {
    if (ms == null) return '-';
    const num = typeof ms === 'string' ? parseFloat(ms) : ms;
    if (!Number.isFinite(num) || num === 0) return '-';
    const result = formatProcessingTimeDetailed(num);
    return result ?? '-';
  };

  const formatTokens = (value: number | string | null | undefined): string => {
    if (value == null) return '-';
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!Number.isFinite(num) || num === 0) return '-';
    // Show exact number with commas, no rounding
    return num.toLocaleString();
  };

  // Get thinking label
  const getThinkingLabel = (effort: string | null | undefined): string | null => {
    if (!effort) return null;
    const lower = effort.toLowerCase();
    if (lower.includes('x-high') || lower.includes('xhigh')) return 'X-Hi';
    if (lower.includes('high')) return 'Hi';
    if (lower.includes('medium') || lower.includes('med')) return 'Med';
    if (lower.includes('low')) return 'Lo';
    return null;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const SortHeader = ({ field, label, icon: Icon }: { field: SortField; label: string; icon: React.ElementType }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        'flex items-center justify-end gap-1 w-full text-xs font-semibold uppercase tracking-wide transition-colors',
        sortField === field
          ? 'text-emerald-300'
          : 'text-gray-500 hover:text-gray-300'
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
      {sortField === field && (
        sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      )}
    </button>
  );

  if (explanations.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-center">
        <Trophy className="mx-auto h-8 w-8 text-gray-600 mb-2" />
        <p className="text-sm text-gray-500">No correct solutions</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden h-full flex flex-col">
      {/* Header - clickable to open full efficiency page */}
      <a
        href={taskId ? `/task/${taskId}/efficiency` : undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-800 bg-gradient-to-r from-emerald-950/40 to-gray-900 hover:from-emerald-950/60 hover:to-gray-800 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-emerald-400" />
          <span className="text-base font-semibold text-gray-100">Efficiency</span>
          <Badge variant="outline" className="border-emerald-700/60 bg-emerald-900/30 text-emerald-200 text-xs">
            {explanations.length}
          </Badge>
        </div>
        {taskId && <ExternalLink className="h-4 w-4 text-gray-500" />}
      </a>

      {/* Comparison bar - shows range/spread, not just best */}
      {stats.minTime && stats.maxTime && stats.minCost && stats.maxCost && (
        <div className="grid grid-cols-2 gap-3 px-4 py-2.5 bg-gray-900/80 border-b border-gray-800/60 text-sm">
          <div>
            <span className="text-gray-500 text-xs">Time spread:</span>
            <div className="flex items-center gap-1">
              <span className="text-emerald-300 font-mono">{formatTime(stats.minTime)}</span>
              <span className="text-gray-600">→</span>
              <span className="text-rose-300 font-mono">{formatTime(stats.maxTime)}</span>
              <span className="text-gray-500 text-xs">({(stats.maxTime / stats.minTime).toFixed(1)}x)</span>
            </div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Cost spread:</span>
            <div className="flex items-center gap-1">
              <span className="text-emerald-300 font-mono">{formatCost(stats.minCost)}</span>
              <span className="text-gray-600">→</span>
              <span className="text-rose-300 font-mono">{formatCost(stats.maxCost)}</span>
              <span className="text-gray-500 text-xs">({(stats.maxCost / stats.minCost).toFixed(1)}x)</span>
            </div>
          </div>
        </div>
      )}

      {/* Column headers - sortable */}
      <div className="grid grid-cols-[1fr_70px_75px_70px] gap-2 px-4 py-2.5 border-b border-gray-800 bg-black text-gray-500">
        <div className="text-xs font-semibold uppercase tracking-wide">Model</div>
        <SortHeader field="time" label="Time" icon={Clock} />
        <SortHeader field="cost" label="Cost" icon={DollarSign} />
        <SortHeader field="tokens" label="Tokens" icon={Coins} />
      </div>

      {/* Rows - scrollable with visible scrollbar */}
      <div className="flex-1 overflow-y-auto overflow-x-auto divide-y divide-gray-800/40 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
        {sortedExplanations.map((exp, idx) => {
          const isFastest = exp.id === fastestId;
          const isCheapest = exp.id === cheapestId;
          const isFewest = exp.id === fewestTokensId;
          const thinkingLabel = getThinkingLabel(exp.reasoningEffort);
          const time = exp.apiProcessingTimeMs;
          const cost = exp.estimatedCost;
          const tokens = exp.totalTokens;

          return (
            <div
              key={exp.id}
              onClick={() => onSelectExplanation?.(exp.id)}
              className={cn(
                'grid grid-cols-[1fr_70px_75px_70px] gap-2 px-4 py-2.5 cursor-pointer transition-colors hover:bg-gray-800/60',
                idx % 2 === 1 && 'bg-gray-900/30',
                (isFastest || isCheapest || isFewest) && 'bg-emerald-950/20'
              )}
            >
              {/* Model name */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-gray-600 w-5">{idx + 1}</span>
                <span className="text-sm font-medium text-gray-200 truncate" title={exp.modelName}>
                  {exp.modelName}
                </span>
                {isFastest && <Zap className="h-4 w-4 text-emerald-400 flex-shrink-0" />}
                {isCheapest && !isFastest && <DollarSign className="h-4 w-4 text-emerald-400 flex-shrink-0" />}
              </div>

              {/* Time */}
              <div className={cn(
                'text-right text-sm font-mono',
                isFastest ? 'text-emerald-300 font-semibold' : 'text-gray-400'
              )}>
                {formatTime(time)}
              </div>

              {/* Cost */}
              <div className={cn(
                'text-right text-sm font-mono',
                isCheapest ? 'text-emerald-300 font-semibold' : cost && cost > 0 ? 'text-gray-400' : 'text-gray-600'
              )}>
                {formatCost(cost)}
              </div>

              {/* Tokens */}
              <div className={cn(
                'text-right text-sm font-mono',
                isFewest ? 'text-emerald-300 font-semibold' : 'text-gray-400'
              )}>
                {formatTokens(tokens)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
