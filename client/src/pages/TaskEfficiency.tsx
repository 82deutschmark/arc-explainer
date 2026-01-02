/**
 * Author: ChatGPT
 * Date: 2026-01-01
 * PURPOSE: Shareable Task Efficiency page showing top performers in each category.
 *          Designed for Twitter sharing - one link that proves efficiency matters.
 *          Shows: Fastest, Cheapest, Slowest, Most Expensive correct solutions.
 * SRP/DRY check: Pass - dedicated shareable view, reuses explanation data hooks.
 */

import React, { useMemo } from 'react';
import { useParams, Link } from 'wouter';
import { Clock, DollarSign, Zap, Trophy, TrendingDown, TrendingUp, Coins, ExternalLink, ArrowLeft } from 'lucide-react';
import { getPuzzleName } from '@shared/utils/puzzleNames';
import { usePaginatedExplanationSummaries } from '@/hooks/useExplanation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatProcessingTimeDetailed } from '@/utils/timeFormatters';
import type { ExplanationData } from '@/types/puzzle';

export default function TaskEfficiency() {
  const { taskId } = useParams<{ taskId: string }>();

  // Fetch only correct explanations
  const { summaries, isInitialLoading, counts } = usePaginatedExplanationSummaries(taskId, {
    pageSize: 1000,
    correctness: 'correct',
  });

  const puzzleName = useMemo(() => getPuzzleName(taskId), [taskId]);

  // Compute rankings
  const rankings = useMemo(() => {
    if (!summaries || summaries.length === 0) return null;

    // Filter out entries with missing data for each category
    const withTime = summaries.filter((e) => e.apiProcessingTimeMs && e.apiProcessingTimeMs > 0);
    const withCost = summaries.filter((e) => e.estimatedCost && e.estimatedCost > 0);
    const withTokens = summaries.filter((e) => e.totalTokens && e.totalTokens > 0);

    // Sort for each category
    const byTimeFastest = [...withTime].sort((a, b) => (a.apiProcessingTimeMs ?? 0) - (b.apiProcessingTimeMs ?? 0));
    const byTimeSlowest = [...withTime].sort((a, b) => (b.apiProcessingTimeMs ?? 0) - (a.apiProcessingTimeMs ?? 0));
    const byCostCheapest = [...withCost].sort((a, b) => (a.estimatedCost ?? 0) - (b.estimatedCost ?? 0));
    const byCostExpensive = [...withCost].sort((a, b) => (b.estimatedCost ?? 0) - (a.estimatedCost ?? 0));
    const byTokensFewest = [...withTokens].sort((a, b) => (a.totalTokens ?? 0) - (b.totalTokens ?? 0));

    return {
      fastest: byTimeFastest.slice(0, 3),
      slowest: byTimeSlowest.slice(0, 3),
      cheapest: byCostCheapest.slice(0, 3),
      expensive: byCostExpensive.slice(0, 3),
      fewestTokens: byTokensFewest.slice(0, 3),
      totalCorrect: summaries.length,
    };
  }, [summaries]);

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

  const getThinkingLabel = (effort: string | null | undefined) => {
    if (!effort) return null;
    const lower = effort.toLowerCase();
    if (lower.includes('x-high') || lower.includes('xhigh')) return 'X-High';
    if (lower.includes('high')) return 'High';
    if (lower.includes('medium') || lower.includes('med')) return 'Medium';
    if (lower.includes('low')) return 'Low';
    return null;
  };

  // Entry row component
  const EntryRow = ({ exp, rank, metric, value, highlight }: {
    exp: ExplanationData;
    rank: number;
    metric: 'time' | 'cost' | 'tokens';
    value: string;
    highlight: 'good' | 'bad';
  }) => {
    const thinking = getThinkingLabel(exp.reasoningEffort);
    const highlightUrl = `/task/${taskId}?highlight=${exp.id}`;
    
    return (
      <a
        href={highlightUrl}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-gray-800/60',
          rank === 1 && highlight === 'good' && 'bg-emerald-950/30 border border-emerald-800/50',
          rank === 1 && highlight === 'bad' && 'bg-rose-950/30 border border-rose-800/50',
        )}
      >
        {/* Rank medal */}
        <span className={cn(
          'w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold',
          rank === 1 && 'bg-yellow-500/20 text-yellow-300',
          rank === 2 && 'bg-gray-400/20 text-gray-300',
          rank === 3 && 'bg-amber-700/20 text-amber-400',
        )}>
          {rank}
        </span>

        {/* Model name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate" title={exp.modelName}>
            {exp.modelName}
          </p>
          {thinking && (
            <span className="text-[10px] text-gray-500">{thinking} thinking</span>
          )}
        </div>

        {/* Metric value */}
        <span className={cn(
          'text-sm font-mono font-semibold',
          highlight === 'good' ? 'text-emerald-300' : 'text-rose-300'
        )}>
          {value}
        </span>

        <ExternalLink className="h-3 w-3 text-gray-600" />
      </a>
    );
  };

  // Category card component
  const CategoryCard = ({ 
    title, 
    icon: Icon, 
    entries, 
    metric, 
    formatter, 
    highlight,
    iconColor 
  }: {
    title: string;
    icon: React.ElementType;
    entries: ExplanationData[];
    metric: 'time' | 'cost' | 'tokens';
    formatter: (e: ExplanationData) => string;
    highlight: 'good' | 'bad';
    iconColor: string;
  }) => (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden">
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b border-gray-800',
        highlight === 'good' ? 'bg-gradient-to-r from-emerald-950/40 to-gray-900' : 'bg-gradient-to-r from-rose-950/40 to-gray-900'
      )}>
        <Icon className={cn('h-4 w-4', iconColor)} />
        <span className="text-sm font-semibold text-gray-200">{title}</span>
      </div>
      <div className="p-2 space-y-1">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-2">No data</p>
        ) : (
          entries.map((exp, idx) => (
            <EntryRow
              key={exp.id}
              exp={exp}
              rank={idx + 1}
              metric={metric}
              value={formatter(exp)}
              highlight={highlight}
            />
          ))
        )}
      </div>
    </div>
  );

  // Loading state
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-10 w-64 mb-4 bg-gray-800" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 bg-gray-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // No correct solutions
  if (!rankings || rankings.totalCorrect === 0) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-4xl mx-auto text-center py-16">
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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href={`/task/${taskId}`}>
            <a className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-2">
              <ArrowLeft className="h-3 w-3" />
              Back to task
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
              {rankings.totalCorrect} correct solution{rankings.totalCorrect !== 1 ? 's' : ''}
            </Badge>
            <span className="text-xs text-gray-500">
              {counts?.all ?? 0} total attempts
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Efficiency comparison grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fastest */}
          <CategoryCard
            title="Fastest"
            icon={Zap}
            entries={rankings.fastest}
            metric="time"
            formatter={(e) => formatTime(e.apiProcessingTimeMs)}
            highlight="good"
            iconColor="text-emerald-400"
          />

          {/* Slowest */}
          <CategoryCard
            title="Slowest"
            icon={Clock}
            entries={rankings.slowest}
            metric="time"
            formatter={(e) => formatTime(e.apiProcessingTimeMs)}
            highlight="bad"
            iconColor="text-rose-400"
          />

          {/* Cheapest */}
          <CategoryCard
            title="Cheapest"
            icon={TrendingDown}
            entries={rankings.cheapest}
            metric="cost"
            formatter={(e) => formatCost(e.estimatedCost)}
            highlight="good"
            iconColor="text-emerald-400"
          />

          {/* Most Expensive */}
          <CategoryCard
            title="Most Expensive"
            icon={TrendingUp}
            entries={rankings.expensive}
            metric="cost"
            formatter={(e) => formatCost(e.estimatedCost)}
            highlight="bad"
            iconColor="text-rose-400"
          />

          {/* Fewest Tokens (full width) */}
          <div className="md:col-span-2">
            <CategoryCard
              title="Fewest Tokens"
              icon={Coins}
              entries={rankings.fewestTokens}
              metric="tokens"
              formatter={(e) => formatTokens(e.totalTokens)}
              highlight="good"
              iconColor="text-emerald-400"
            />
          </div>
        </div>

        {/* Quick comparison */}
        {rankings.fastest[0] && rankings.slowest[0] && rankings.cheapest[0] && rankings.expensive[0] && (
          <div className="mt-6 p-4 rounded-xl border border-gray-800 bg-gray-900/40">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Quick Comparison</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500">Fastest vs Slowest:</span>
                <p className="text-gray-200">
                  <span className="text-emerald-300 font-mono">{formatTime(rankings.fastest[0].apiProcessingTimeMs)}</span>
                  {' vs '}
                  <span className="text-rose-300 font-mono">{formatTime(rankings.slowest[0].apiProcessingTimeMs)}</span>
                  {rankings.fastest[0].apiProcessingTimeMs && rankings.slowest[0].apiProcessingTimeMs && (
                    <span className="text-gray-500 ml-1">
                      ({(rankings.slowest[0].apiProcessingTimeMs / rankings.fastest[0].apiProcessingTimeMs).toFixed(1)}x slower)
                    </span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Cheapest vs Most Expensive:</span>
                <p className="text-gray-200">
                  <span className="text-emerald-300 font-mono">{formatCost(rankings.cheapest[0].estimatedCost)}</span>
                  {' vs '}
                  <span className="text-rose-300 font-mono">{formatCost(rankings.expensive[0].estimatedCost)}</span>
                  {rankings.cheapest[0].estimatedCost && rankings.expensive[0].estimatedCost && (
                    <span className="text-gray-500 ml-1">
                      ({(rankings.expensive[0].estimatedCost / rankings.cheapest[0].estimatedCost).toFixed(1)}x more expensive)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-600">
          <p>Click any entry to view the full solution</p>
          <p className="mt-1">
            <a href={`/task/${taskId}`} className="text-emerald-500 hover:text-emerald-400 underline">
              View all {counts?.all ?? 0} attempts for this task
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
