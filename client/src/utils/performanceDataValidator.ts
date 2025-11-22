/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Validation and safe default utilities for puzzle performance data.
 *          Prevents null/undefined errors and provides type-safe access to performance metrics
 *          across PuzzleCard, PuzzleTradingCard, and other components.
 * SRP/DRY check: Pass - Single responsibility for performance data validation, eliminates duplicate null-checking logic.
 */

import type { PuzzlePerformanceSnapshot } from '@/hooks/usePuzzleStats';

export interface ValidatedPerformanceData {
  avgCost: number;
  avgProcessingTime: number;
  avgTotalTokens: number;
  avgReasoningTokens: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgAccuracy: number;
  totalExplanations: number;
  wrongCount: number;
  hasMetrics: boolean;
}

/**
 * Validate performance data and provide safe defaults.
 * Returns validated data with all fields guaranteed to be numbers (never null/undefined).
 *
 * @param performanceData - Raw performance data from API
 * @returns Validated data with safe numeric defaults
 *
 * @example
 * const validated = validatePerformanceData(puzzle.performanceData);
 * console.log(validated.avgCost); // Always a number, never null
 */
export function validatePerformanceData(
  performanceData: PuzzlePerformanceSnapshot | null | undefined
): ValidatedPerformanceData {
  if (!performanceData) {
    return {
      avgCost: 0,
      avgProcessingTime: 0,
      avgTotalTokens: 0,
      avgReasoningTokens: 0,
      avgInputTokens: 0,
      avgOutputTokens: 0,
      avgAccuracy: 0,
      totalExplanations: 0,
      wrongCount: 0,
      hasMetrics: false
    };
  }

  const totalExplanations = performanceData.totalExplanations || 0;

  return {
    avgCost: performanceData.avgCost ?? 0,
    avgProcessingTime: performanceData.avgProcessingTime ?? 0,
    avgTotalTokens: performanceData.avgTotalTokens ?? 0,
    avgReasoningTokens: performanceData.avgReasoningTokens ?? 0,
    avgInputTokens: performanceData.avgInputTokens ?? 0,
    avgOutputTokens: performanceData.avgOutputTokens ?? 0,
    avgAccuracy: performanceData.avgAccuracy || 0,
    totalExplanations,
    wrongCount: performanceData.wrongCount || 0,
    hasMetrics: totalExplanations > 0
  };
}

/**
 * Check if performance data contains any rich metrics (cost, tokens, or time).
 *
 * @param performanceData - Raw performance data from API
 * @returns True if any rich metric is present
 *
 * @example
 * if (hasRichMetrics(puzzle.performanceData)) {
 *   // Show rich metrics section
 * }
 */
export function hasRichMetrics(
  performanceData: PuzzlePerformanceSnapshot | null | undefined
): boolean {
  if (!performanceData) return false;

  return (
    (performanceData.avgCost !== null && performanceData.avgCost !== undefined && performanceData.avgCost > 0) ||
    (performanceData.avgTotalTokens !== null && performanceData.avgTotalTokens !== undefined && performanceData.avgTotalTokens > 0) ||
    (performanceData.avgProcessingTime !== null && performanceData.avgProcessingTime !== undefined && performanceData.avgProcessingTime > 0)
  );
}

/**
 * Check if performance data contains reasoning token data (o-series models).
 *
 * @param performanceData - Raw performance data from API
 * @returns True if reasoning tokens are present
 *
 * @example
 * if (hasReasoningTokens(puzzle.performanceData)) {
 *   // This puzzle was attempted by o-series models
 * }
 */
export function hasReasoningTokens(
  performanceData: PuzzlePerformanceSnapshot | null | undefined
): boolean {
  if (!performanceData) return false;

  return (
    performanceData.avgReasoningTokens !== null &&
    performanceData.avgReasoningTokens !== undefined &&
    performanceData.avgReasoningTokens > 0
  );
}
