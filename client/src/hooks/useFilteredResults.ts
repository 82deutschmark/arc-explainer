/**
 * Author: Sonnet 4.5
 * Date: 2025-10-12
 * PURPOSE: Memoized result filtering with cached correctness counts.
 * Previously: Filter buttons recalculated counts on every render (lines 916-933 in PuzzleExaminer).
 * Now: Correctness determined once, counts cached, filter buttons use memoized values.
 * SRP/DRY check: Pass - Single responsibility (result filtering with memoization)
 * DaisyUI: N/A - Data hook
 */

import { useMemo } from 'react';
import { determineCorrectness } from '@shared/utils/correctness';
import type { ExplanationData } from '@/types/puzzle';

export type CorrectnessFilter = 'all' | 'correct' | 'incorrect';

export interface FilteredResultsData {
  filtered: ExplanationData[];
  counts: {
    all: number;
    correct: number;
    incorrect: number;
  };
}

/**
 * Filters analysis results by correctness with memoized counts
 *
 * @param allResults - All analysis results
 * @param filter - Current filter selection
 * @returns Filtered results and cached counts
 *
 * Benefits:
 * - Correctness determination happens once per result
 * - Counts are cached and only recalculated when allResults changes
 * - Prevents redundant determineCorrectness() calls in filter buttons
 * - No recalculation on unrelated state changes (temperature, promptId, etc.)
 */
export function useFilteredResults(
  allResults: ExplanationData[],
  filter: CorrectnessFilter
): FilteredResultsData {
  // Cache correctness determination for each result
  const resultsWithCorrectness = useMemo(() => {
    return allResults.map(result => {
      const correctness = determineCorrectness({
        modelName: result.modelName,
        isPredictionCorrect: result.isPredictionCorrect,
        multiTestAllCorrect: result.multiTestAllCorrect,
        hasMultiplePredictions: result.hasMultiplePredictions
      });

      return {
        result,
        isCorrect: correctness.isCorrect,
        isIncorrect: correctness.isIncorrect
      };
    });
  }, [allResults]);

  // Calculate counts (memoized - only recalculates when allResults changes)
  const counts = useMemo(() => {
    const correctCount = resultsWithCorrectness.filter(r => r.isCorrect).length;
    const incorrectCount = resultsWithCorrectness.filter(r => r.isIncorrect).length;

    return {
      all: allResults.length,
      correct: correctCount,
      incorrect: incorrectCount
    };
  }, [resultsWithCorrectness, allResults.length]);

  // Filter results based on selection (memoized)
  const filtered = useMemo(() => {
    if (filter === 'all') {
      return allResults;
    }

    const targetCorrectness = filter === 'correct';
    return resultsWithCorrectness
      .filter(r => r.isCorrect === targetCorrectness)
      .map(r => r.result);
  }, [allResults, filter, resultsWithCorrectness]);

  return { filtered, counts };
}
