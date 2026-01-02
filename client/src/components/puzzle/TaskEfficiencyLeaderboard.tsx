/**
 * Author: ChatGPT
 * Date: 2026-01-01
 * PURPOSE: Compact Task Efficiency Leaderboard for correct solutions. Shows time, cost, tokens
 *          in a punchy format. Default sorted by fastest. Zero-cost excluded from cheapest.
 *          No redundant "correct" status since we're already filtering by correct.
 * SRP/DRY check: Pass - single responsibility (efficiency ranking), reuses formatters.
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

  // Compute stats - exclude zeros from min calculations
  const stats = useMemo(() => {
    const validTimes = explanations
      .map((e) => e.apiProcessingTimeMs ?? 0)
      .filter((t) => t > 0);
    const validCosts = explanations
      .map((e) => e.estimatedCost ?? 0)
      .filter((c) => c > 0);
    const validTokens = explanations
      .map((e) => e.totalTokens ?? 0)
      .filter((t) => t > 0);

    return {
      minTime: validTimes.length ? Math.min(...validTimes) : 0,
      maxTime: validTimes.length ? Math.max(...validTimes) : 1,
      minCost: validCosts.length ? Math.min(...validCosts) : 0,
      maxCost: validCosts.length ? Math.max(...validCosts) : 0.01,
      minTokens: validTokens.length ? Math.min(...validTokens) : 0,
      maxTokens: validTokens.length ? Math.max(...validTokens) : 1,
    };
  }, [explanations]);

  // Sort explanations - always ascending (fastest/cheapest/fewest first)
  const sortedExplanations = useMemo(() => {
    return [...explanations].sort((a, b) => {
      switch (sortField) {
        case 'time':
          return (a.apiProcessingTimeMs ?? Infinity) - (b.apiProcessingTimeMs ?? Infinity);
        case 'cost': {
          // Put $0 at the end when sorting by cost
          const aCost = a.estimatedCost ?? 0;
          const bCost = b.estimatedCost ?? 0;
          if (aCost === 0 && bCost > 0) return 1;
          if (bCost === 0 && aCost > 0) return -1;
          return aCost - bCost;
        }
        case 'tokens':
          return (a.totalTokens ?? Infinity) - (b.totalTokens ?? Infinity);
        default:
          return 0;
      }
    });
  }, [explanations, sortField]);

  // Find fastest and cheapest IDs (exclude zeros)
  const fastestId = useMemo(() => {
    let best: ExplanationData | null = null;
    for (const e of explanations) {
      const time = e.apiProcessingTimeMs ?? 0;
      if (time > 0 && (!best || time < (best.apiProcessingTimeMs ?? Infinity))) {
        best = e;
      }
    }
    return best?.id;
  }, [explanations]);

  const cheapestId = useMemo(() => {
    let best: ExplanationData | null = null;
    for (const e of explanations) {
      const cost = e.estimatedCost ?? 0;
      if (cost > 0 && (!best || cost < (best.estimatedCost ?? Infinity))) {
        best = e;
      }
    }
    return best?.id;
  }, [explanations]);

  const fewestTokensId = useMemo(() => {
    let best: ExplanationData | null = null;
    for (const e of explanations) {
      const tokens = e.totalTokens ?? 0;
      if (tokens > 0 && (!best || tokens < (best.totalTokens ?? Infinity))) {
        best = e;
      }
    }
    return best?.id;
  }, [explanations]);

  // Formatters
  const formatCost = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value) || value === 0) return '-';
    if (value < 0.01) return `$${value.toFixed(4)}`;
    return `$${value.toFixed(2)}`;
  };

  const formatTime = (ms: number | null | undefined) => {
    if (ms == null || !Number.isFinite(ms) || ms === 0) return '-';
    return formatProcessingTimeDetailed(ms);
  };

  const formatTokens = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value) || value === 0) return '-';
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    return value.toLocaleString();
  };

  // Get thinking badge
  const getThinkingBadge = (effort: string | null | undefined) => {
    if (!effort) return null;
    const lower = effort.toLowerCase();
    if (lower.includes('x-high') || lower.includes('xhigh')) return 'X-Hi';
    if (lower.includes('high')) return 'Hi';
    if (lower.includes('medium') || lower.includes('med')) return 'Med';
    if (lower.includes('low')) return 'Lo';
    return null;
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => setSortField(field)}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wide transition-colors',
        sortField === field
          ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-700/60'
          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
      )}
    >
      {label}
      {sortField === field && <ArrowUp className="h-2.5 w-2.5" />}
    </button>
  );

  if (explanations.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 text-center">
        <Trophy className="mx-auto h-6 w-6 text-gray-600 mb-2" />
        <p className="text-sm text-gray-500">No correct solutions</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 overflow-hidden">
      {/* Compact header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-800 bg-gradient-to-r from-emerald-950/30 to-gray-900">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-gray-200">Efficiency</span>
          <Badge variant="outline" className="border-emerald-800 bg-emerald-950/40 text-emerald-300 text-[10px] px-1.5 py-0">
            {explanations.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <SortButton field="time" label="Time" />
          <SortButton field="cost" label="Cost" />
          <SortButton field="tokens" label="Tokens" />
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-gray-900/80 border-b border-gray-800/60 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-emerald-500" />
          Fastest: <span className="text-emerald-300 font-medium">{formatTime(stats.minTime)}</span>
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-emerald-500" />
          Cheapest: <span className="text-emerald-300 font-medium">{stats.minCost > 0 ? formatCost(stats.minCost) : 'N/A'}</span>
        </span>
        <span className="flex items-center gap-1">
          <Coins className="h-3 w-3 text-emerald-500" />
          Fewest: <span className="text-emerald-300 font-medium">{formatTokens(stats.minTokens)}</span>
        </span>
      </div>

      {/* Compact rows */}
      <div className="divide-y divide-gray-800/40 max-h-[400px] overflow-y-auto">
        {sortedExplanations.map((exp, idx) => {
          const isFastest = exp.id === fastestId;
          const isCheapest = exp.id === cheapestId;
          const isFewest = exp.id === fewestTokensId;
          const thinkingBadge = getThinkingBadge(exp.reasoningEffort);
          const time = exp.apiProcessingTimeMs ?? 0;
          const cost = exp.estimatedCost ?? 0;
          const tokens = exp.totalTokens ?? 0;

          return (
            <div
              key={exp.id}
              onClick={() => onSelectExplanation?.(exp.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-gray-800/50',
                idx % 2 === 1 && 'bg-gray-900/30',
                (isFastest || isCheapest) && 'bg-emerald-950/20'
              )}
            >
              {/* Rank */}
              <span className="w-5 text-[10px] font-mono text-gray-600">{idx + 1}</span>

              {/* Model name - truncated */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate" title={exp.modelName}>
                  {exp.modelName}
                </p>
              </div>

              {/* Thinking badge */}
              {thinkingBadge && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-gray-700 text-gray-400">
                  {thinkingBadge}
                </Badge>
              )}

              {/* Notable badges */}
              {isFastest && (
                <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-700/50 text-[9px] px-1 py-0">
                  <Zap className="h-2.5 w-2.5" />
                </Badge>
              )}
              {isCheapest && !isFastest && (
                <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-700/50 text-[9px] px-1 py-0">
                  <DollarSign className="h-2.5 w-2.5" />
                </Badge>
              )}

              {/* Metrics - right aligned, compact */}
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className={cn('w-14 text-right', isFastest ? 'text-emerald-300' : 'text-gray-400')}>
                  {formatTime(time)}
                </span>
                <span className={cn('w-14 text-right', isCheapest ? 'text-emerald-300' : cost === 0 ? 'text-gray-600' : 'text-gray-400')}>
                  {formatCost(cost)}
                </span>
                <span className={cn('w-12 text-right', isFewest ? 'text-emerald-300' : 'text-gray-400')}>
                  {formatTokens(tokens)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
