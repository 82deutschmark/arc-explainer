/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-14T00:00:00Z
 * PURPOSE: Helper utilities for Puzzle Trading Card feature.
 * Provides functions for calculating win/loss records, determining dataset colors,
 * and formatting puzzle card data for display.
 *
 * SRP/DRY check: Pass - Single responsibility for trading card data formatting
 */

import type { PuzzleStatsRecord } from '@/hooks/usePuzzleStats';

/**
 * Calculate win/loss record for a puzzle against LLMs
 * Win = LLM failed (wrongCount)
 * Loss = LLM succeeded (totalExplanations - wrongCount)
 */
export function calculateWinLossRecord(performanceData?: {
  wrongCount: number;
  totalExplanations: number;
}): { wins: number; losses: number; record: string } {
  if (!performanceData || performanceData.totalExplanations === 0) {
    return { wins: 0, losses: 0, record: '0-0' };
  }

  const wins = performanceData.wrongCount;
  const losses = performanceData.totalExplanations - performanceData.wrongCount;

  return {
    wins,
    losses,
    record: `${wins}-${losses}`
  };
}

/**
 * Get dataset display name (team name for trading card)
 */
export function getDatasetDisplayName(source?: string): string {
  if (!source) return 'Unknown';

  const displayNames: Record<string, string> = {
    'training': 'ARC Training',
    'training2': 'ARC Training 2',
    'evaluation': 'ARC Evaluation',
    'evaluation2': 'ARC Evaluation 2',
    'arc-heavy': 'ARC Heavy',
    'concept-arc': 'Concept ARC',
    'explained': 'Explained'
  };

  return displayNames[source.toLowerCase()] || source;
}

/**
 * Get vibrant, crisp gradient colors for dataset "team colors"
 * Returns gradient classes for card styling
 */
export function getDatasetGradient(source?: string): {
  borderGradient: string;
  backgroundGradient: string;
  teamColor: string;
  accentColor: string;
} {
  if (!source) {
    return {
      borderGradient: 'from-gray-400 via-gray-500 to-gray-600',
      backgroundGradient: 'from-gray-50 to-gray-100',
      teamColor: 'text-gray-700',
      accentColor: 'bg-gray-500'
    };
  }

  const sourceKey = source.toLowerCase();

  // Crisp, vibrant, colorful gradients (no brown!)
  const gradients: Record<string, {
    borderGradient: string;
    backgroundGradient: string;
    teamColor: string;
    accentColor: string;
  }> = {
    'training': {
      borderGradient: 'from-blue-500 via-indigo-500 to-purple-500',
      backgroundGradient: 'from-blue-50 via-indigo-50 to-purple-50',
      teamColor: 'text-blue-700',
      accentColor: 'bg-blue-500'
    },
    'training2': {
      borderGradient: 'from-cyan-500 via-teal-500 to-emerald-500',
      backgroundGradient: 'from-cyan-50 via-teal-50 to-emerald-50',
      teamColor: 'text-teal-700',
      accentColor: 'bg-teal-500'
    },
    'evaluation': {
      borderGradient: 'from-rose-500 via-pink-500 to-fuchsia-500',
      backgroundGradient: 'from-rose-50 via-pink-50 to-fuchsia-50',
      teamColor: 'text-rose-700',
      accentColor: 'bg-rose-500'
    },
    'evaluation2': {
      borderGradient: 'from-orange-500 via-amber-500 to-yellow-500',
      backgroundGradient: 'from-orange-50 via-amber-50 to-yellow-50',
      teamColor: 'text-orange-700',
      accentColor: 'bg-orange-500'
    },
    'arc-heavy': {
      borderGradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
      backgroundGradient: 'from-violet-50 via-purple-50 to-fuchsia-50',
      teamColor: 'text-violet-700',
      accentColor: 'bg-violet-500'
    },
    'concept-arc': {
      borderGradient: 'from-lime-500 via-green-500 to-emerald-500',
      backgroundGradient: 'from-lime-50 via-green-50 to-emerald-50',
      teamColor: 'text-green-700',
      accentColor: 'bg-green-500'
    }
  };

  return gradients[sourceKey] || gradients['training'];
}

/**
 * Get badge variant based on win percentage
 */
export function getPerformanceBadgeVariant(wins: number, losses: number): 'default' | 'secondary' | 'destructive' {
  const total = wins + losses;
  if (total === 0) return 'secondary';

  const winPercentage = (wins / total) * 100;

  // Puzzle "dominance" levels
  if (winPercentage >= 70) return 'destructive'; // Puzzle is crushing LLMs
  if (winPercentage >= 40) return 'default'; // Competitive puzzle
  return 'secondary'; // LLMs are doing well
}

/**
 * Get performance description for the puzzle
 * Returns win rate percentage (puzzle wins = LLM failures)
 */
export function getPerformanceDescription(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return 'Untested';

  const winPercentage = (wins / total) * 100;

  // Return actual win rate percentage with 1 decimal place
  return `${winPercentage.toFixed(1)}% win rate`;
}

/**
 * Calculate approximate total spend for a puzzle
 * totalSpendApprox = avgCost × totalExplanations
 */
export function calculateTotalSpendApprox(performanceData?: {
  avgCost?: number | null;
  totalExplanations: number;
}): number {
  if (!performanceData || !performanceData.avgCost || performanceData.totalExplanations === 0) {
    return 0;
  }
  return performanceData.avgCost * performanceData.totalExplanations;
}

/**
 * Calculate approximate total tokens used for a puzzle
 * totalTokensApprox = avgTotalTokens × totalExplanations
 */
export function calculateTotalTokensApprox(performanceData?: {
  avgTotalTokens?: number | null;
  totalExplanations: number;
}): number {
  if (!performanceData || !performanceData.avgTotalTokens || performanceData.totalExplanations === 0) {
    return 0;
  }
  return performanceData.avgTotalTokens * performanceData.totalExplanations;
}

/**
 * Format cost in USD for display
 */
export function formatCostUSD(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format tokens for display (with K/M suffix for large numbers)
 */
export function formatTokens(tokens: number): string {
  if (tokens === 0) return '0';
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toFixed(0);
}

/**
 * Format latency in seconds for display
 */
export function formatLatencySeconds(ms: number): string {
  if (ms === 0) return '0s';
  const seconds = ms / 1000;
  if (seconds < 1) return `${ms}ms`;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Format puzzle stats for trading card display
 */
export function formatPuzzleStats(puzzle: PuzzleStatsRecord) {
  const { wins, losses, record } = calculateWinLossRecord(puzzle.performanceData);
  const teamName = getDatasetDisplayName(puzzle.source);
  const colors = getDatasetGradient(puzzle.source);
  const badgeVariant = getPerformanceBadgeVariant(wins, losses);
  const performanceDesc = getPerformanceDescription(wins, losses);

  return {
    record,
    wins,
    losses,
    teamName,
    colors,
    badgeVariant,
    performanceDesc,
    avgAccuracy: puzzle.performanceData?.avgAccuracy ?? 0,
    totalAttempts: puzzle.performanceData?.totalExplanations ?? 0,
    // OPTIMIZATION: Changed from array to count to prevent PostgreSQL temp disk overflow
    modelsAttemptedCount: puzzle.performanceData?.modelsAttemptedCount ?? 0
  };
}

/**
 * Format processing time for compact card display
 * - If < 1000ms: "850ms"
 * - If >= 1000ms: "2.3s"
 */
export function formatProcessingTime(ms: number | null | undefined): string {
  if (!ms || ms === 0) return '0ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Compact metric for display on puzzle cards
 */
export interface CompactMetric {
  label: string;
  value: string;
  type: 'cost' | 'tokens' | 'time' | 'reasoning';
}

/**
 * Get the most important metrics for compact card display.
 * Prioritizes: cost > total tokens > processing time > reasoning tokens
 * Returns up to maxMetrics most relevant metrics (default: 2)
 *
 * @param performanceData - Performance data from puzzle
 * @param maxMetrics - Maximum number of metrics to return (default: 2)
 * @returns Array of compact metrics, prioritized by importance
 */
export function getCompactMetrics(
  performanceData: {
    avgCost?: number | null;
    avgTotalTokens?: number | null;
    avgProcessingTime?: number | null;
    avgReasoningTokens?: number | null;
  } | null | undefined,
  maxMetrics: number = 2
): CompactMetric[] {
  if (!performanceData) return [];

  const metrics: CompactMetric[] = [];

  // Priority 1: Cost (if > 0)
  if (performanceData.avgCost && performanceData.avgCost > 0) {
    metrics.push({
      label: 'Avg Cost',
      value: formatCostUSD(performanceData.avgCost),
      type: 'cost'
    });
  }

  // Priority 2: Total Tokens (if > 0)
  if (performanceData.avgTotalTokens && performanceData.avgTotalTokens > 0) {
    metrics.push({
      label: 'Tokens',
      value: formatTokens(performanceData.avgTotalTokens),
      type: 'tokens'
    });
  }

  // Priority 3: Processing Time (if > 0)
  if (performanceData.avgProcessingTime && performanceData.avgProcessingTime > 0) {
    metrics.push({
      label: 'Time',
      value: formatProcessingTime(performanceData.avgProcessingTime),
      type: 'time'
    });
  }

  // Priority 4: Reasoning Tokens (if > 0 AND significant portion of total)
  if (performanceData.avgReasoningTokens && performanceData.avgReasoningTokens > 0) {
    const totalTokens = performanceData.avgTotalTokens || 0;
    const reasoningPercentage = totalTokens > 0 ? (performanceData.avgReasoningTokens / totalTokens) : 0;

    // Only show reasoning tokens if they're > 10% of total (indicates o-series model usage)
    if (reasoningPercentage > 0.1) {
      metrics.push({
        label: 'Reasoning',
        value: formatTokens(performanceData.avgReasoningTokens),
        type: 'reasoning'
      });
    }
  }

  // Return up to maxMetrics
  return metrics.slice(0, maxMetrics);
}
