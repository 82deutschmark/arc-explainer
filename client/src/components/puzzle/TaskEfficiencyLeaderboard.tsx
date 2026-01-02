/**
 * Author: ChatGPT
 * Date: 2026-01-01
 * PURPOSE: Task Efficiency Leaderboard - compact, sortable view of correct solutions.
 *          Shows exact time, cost, tokens. Sortable by clicking headers.
 *          Zero-cost excluded from cheapest. No rounded token counts.
 * SRP/DRY check: Pass - single responsibility (efficiency ranking).
 */

import React, { useMemo, useState } from 'react';
import { Clock, DollarSign, Coins, ArrowUp, ArrowDown, Zap, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatProcessingTimeDetailed } from '@/utils/timeFormatters';
import type { ExplanationData } from '@/types/puzzle';

interface TaskEfficiencyLeaderboardProps {
  explanations: ExplanationData[];
  onSelectExplanation?: (id: number) => void;
}

type SortField = 'time' | 'cost' | 'tokens';

export function TaskEfficiencyLeaderboard({
  explanations,
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

  // Compute stats - exclude zeros/nulls from min calculations
  const stats = useMemo(() => {
    const validTimes: number[] = [];
    const validCosts: number[] = [];
    const validTokens: number[] = [];

    for (const e of explanations) {
      const time = e.apiProcessingTimeMs;
      const cost = e.estimatedCost;
      const tokens = e.totalTokens;

      if (typeof time === 'number' && time > 0) validTimes.push(time);
      if (typeof cost === 'number' && cost > 0) validCosts.push(cost);
      if (typeof tokens === 'number' && tokens > 0) validTokens.push(tokens);
    }

    return {
      minTime: validTimes.length > 0 ? Math.min(...validTimes) : null,
      minCost: validCosts.length > 0 ? Math.min(...validCosts) : null,
      minTokens: validTokens.length > 0 ? Math.min(...validTokens) : null,
    };
  }, [explanations]);

  // Sort explanations
  const sortedExplanations = useMemo(() => {
    const sorted = [...explanations].sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortField) {
        case 'time':
          aVal = a.apiProcessingTimeMs ?? (sortAsc ? Infinity : -Infinity);
          bVal = b.apiProcessingTimeMs ?? (sortAsc ? Infinity : -Infinity);
          break;
        case 'cost':
          // Treat 0 and null as "no data" - sort to end
          aVal = (a.estimatedCost && a.estimatedCost > 0) ? a.estimatedCost : (sortAsc ? Infinity : -Infinity);
          bVal = (b.estimatedCost && b.estimatedCost > 0) ? b.estimatedCost : (sortAsc ? Infinity : -Infinity);
          break;
        case 'tokens':
          aVal = a.totalTokens ?? (sortAsc ? Infinity : -Infinity);
          bVal = b.totalTokens ?? (sortAsc ? Infinity : -Infinity);
          break;
        default:
          return 0;
      }

      return sortAsc ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }, [explanations, sortField, sortAsc]);

  // Find best IDs for highlighting
  const fastestId = useMemo(() => {
    let best: ExplanationData | null = null;
    for (const e of explanations) {
      const time = e.apiProcessingTimeMs;
      if (typeof time === 'number' && time > 0) {
        if (!best || time < (best.apiProcessingTimeMs ?? Infinity)) {
          best = e;
        }
      }
    }
    return best?.id ?? null;
  }, [explanations]);

  const cheapestId = useMemo(() => {
    let best: ExplanationData | null = null;
    for (const e of explanations) {
      const cost = e.estimatedCost;
      if (typeof cost === 'number' && cost > 0) {
        if (!best || cost < (best.estimatedCost ?? Infinity)) {
          best = e;
        }
      }
    }
    return best?.id ?? null;
  }, [explanations]);

  const fewestTokensId = useMemo(() => {
    let best: ExplanationData | null = null;
    for (const e of explanations) {
      const tokens = e.totalTokens;
      if (typeof tokens === 'number' && tokens > 0) {
        if (!best || tokens < (best.totalTokens ?? Infinity)) {
          best = e;
        }
      }
    }
    return best?.id ?? null;
  }, [explanations]);

  // Formatters - show exact values, no rounding for tokens
  const formatCost = (value: number | null | undefined): string => {
    if (value == null || value === 0) return '-';
    // Always show 4 decimal places for precision
    return `$${value.toFixed(4)}`;
  };

  const formatTime = (ms: number | null | undefined): string => {
    if (ms == null || ms === 0) return '-';
    const result = formatProcessingTimeDetailed(ms);
    return result ?? '-';
  };

  const formatTokens = (value: number | null | undefined): string => {
    if (value == null || value === 0) return '-';
    // Show exact number with commas, no rounding
    return value.toLocaleString();
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
        'flex items-center justify-end gap-1 w-full text-[10px] font-semibold uppercase tracking-wide transition-colors',
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
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-800 bg-gradient-to-r from-emerald-950/40 to-gray-900">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-emerald-400" />
          <span className="text-base font-semibold text-gray-100">Efficiency</span>
          <Badge variant="outline" className="border-emerald-700/60 bg-emerald-900/30 text-emerald-200 text-xs">
            {explanations.length}
          </Badge>
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-gray-900/80 border-b border-gray-800/60 text-[11px]">
        <div className="flex flex-col">
          <span className="flex items-center gap-1 text-gray-500">
            <Zap className="h-3 w-3 text-emerald-500" />
            Fastest
          </span>
          <span className="text-emerald-300 font-mono font-medium">
            {stats.minTime != null ? formatTime(stats.minTime) : 'N/A'}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="flex items-center gap-1 text-gray-500">
            <DollarSign className="h-3 w-3 text-emerald-500" />
            Cheapest
          </span>
          <span className="text-emerald-300 font-mono font-medium">
            {stats.minCost != null ? formatCost(stats.minCost) : 'N/A'}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="flex items-center gap-1 text-gray-500">
            <Coins className="h-3 w-3 text-emerald-500" />
            Fewest
          </span>
          <span className="text-emerald-300 font-mono font-medium">
            {stats.minTokens != null ? formatTokens(stats.minTokens) : 'N/A'}
          </span>
        </div>
      </div>

      {/* Column headers - sortable */}
      <div className="grid grid-cols-[1fr_50px_80px_70px_80px] gap-2 px-4 py-2 border-b border-gray-800 bg-black text-gray-500">
        <div className="text-[10px] font-semibold uppercase tracking-wide">Model</div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-center">Think</div>
        <SortHeader field="time" label="Time" icon={Clock} />
        <SortHeader field="cost" label="Cost" icon={DollarSign} />
        <SortHeader field="tokens" label="Tokens" icon={Coins} />
      </div>

      {/* Rows - scrollable */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800/40">
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
                'grid grid-cols-[1fr_50px_80px_70px_80px] gap-2 px-4 py-2 cursor-pointer transition-colors hover:bg-gray-800/60',
                idx % 2 === 1 && 'bg-gray-900/30',
                (isFastest || isCheapest || isFewest) && 'bg-emerald-950/20'
              )}
            >
              {/* Model name */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-mono text-gray-600 w-4">{idx + 1}</span>
                <span className="text-xs font-medium text-gray-200 truncate" title={exp.modelName}>
                  {exp.modelName}
                </span>
                {isFastest && <Zap className="h-3 w-3 text-emerald-400 flex-shrink-0" />}
                {isCheapest && !isFastest && <DollarSign className="h-3 w-3 text-emerald-400 flex-shrink-0" />}
              </div>

              {/* Thinking */}
              <div className="flex items-center justify-center">
                {thinkingLabel ? (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-gray-700 text-gray-400">
                    {thinkingLabel}
                  </Badge>
                ) : (
                  <span className="text-gray-600">-</span>
                )}
              </div>

              {/* Time */}
              <div className={cn(
                'text-right text-[11px] font-mono',
                isFastest ? 'text-emerald-300 font-semibold' : 'text-gray-400'
              )}>
                {formatTime(time)}
              </div>

              {/* Cost */}
              <div className={cn(
                'text-right text-[11px] font-mono',
                isCheapest ? 'text-emerald-300 font-semibold' : cost && cost > 0 ? 'text-gray-400' : 'text-gray-600'
              )}>
                {formatCost(cost)}
              </div>

              {/* Tokens */}
              <div className={cn(
                'text-right text-[11px] font-mono',
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
