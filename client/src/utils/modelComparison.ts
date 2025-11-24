/**
 * Author: Codex using GPT-5
 * Date: 2025-10-10T00:00:00Z
 * PURPOSE: Presenter utilities for model comparison dialogs; centralizes name formatting and metric aggregation to keep UI components focused on rendering while enabling reuse across analytics views.
 * SRP/DRY check: Pass - Dedicated to formatting and aggregation logic; verified no existing utilities covered this behavior.
 * shadcn/ui: Pass - No custom UI; utilities support shadcn/ui components.
 */

import { ModelComparisonResult } from '@/pages/AnalyticsOverview';

type ModelComparisonSummary = ModelComparisonResult['summary'] | null | undefined;

/**
 * Returns a comma-separated list of defined model names for display.
 */
export const formatModelNames = (summary: ModelComparisonSummary): string => {
  if (!summary) return '';
  return [
    summary.model1Name,
    summary.model2Name,
    summary.model3Name,
    summary.model4Name,
  ]
    .filter((name): name is string => Boolean(name?.trim()))
    .join(', ');
};

/**
 * Calculates the count of puzzles solved by exactly one model.
 */
export const computeUniqueSolves = (summary: ModelComparisonSummary): number => {
  if (!summary) return 0;
  const counts = [
    summary.model1OnlyCorrect,
    summary.model2OnlyCorrect,
    summary.model3OnlyCorrect,
    summary.model4OnlyCorrect,
  ];
  return counts.reduce((total: number, value) => total + (value ?? 0), 0);
};

/**
 * Guard helper to ensure summary objects with required fields.
 */
export const hasComparisonSummary = (
  result: ModelComparisonResult | null,
): result is ModelComparisonResult & { summary: NonNullable<ModelComparisonResult['summary']> } =>
  Boolean(result?.summary);

/**
 * Computes union-of-correct metrics for a set of attempt models.
 * Returns the count of puzzles solved correctly by at least one of the specified models.
 */
export const computeAttemptUnionAccuracy = (
  result: ModelComparisonResult,
  modelIndices: number[],
): {
  unionCorrectCount: number;
  totalPuzzles: number;
  unionAccuracyPercentage: number;
} => {
  // Validate inputs
  if (!result?.summary || !result?.details || modelIndices.length === 0) {
    return {
      unionCorrectCount: 0,
      totalPuzzles: 0,
      unionAccuracyPercentage: 0,
    };
  }

  const totalPuzzles = result.summary.totalPuzzles;
  
  // Dev warning if details length doesn't match expected total
  if (process.env.NODE_ENV === 'development' && result.details.length !== totalPuzzles) {
    console.warn(
      `computeAttemptUnionAccuracy: details length (${result.details.length}) ` +
      `does not match totalPuzzles (${totalPuzzles})`
    );
  }

  let unionCorrectCount = 0;

  // Iterate through each puzzle and check if any selected model solved it
  for (const detail of result.details) {
    const modelResults = [
      detail.model1Result,
      detail.model2Result,
      detail.model3Result,
      detail.model4Result,
    ];

    // Check if any of the selected models has 'correct' result
    const isCorrectByAnyAttempt = modelIndices
      .map(index => modelResults[index])
      .some(result => result === 'correct');

    if (isCorrectByAnyAttempt) {
      unionCorrectCount++;
    }
  }

  const unionAccuracyPercentage = totalPuzzles > 0 
    ? Math.round((unionCorrectCount / totalPuzzles) * 10000) / 100  // Round to 2 decimal places
    : 0;

  return {
    unionCorrectCount,
    totalPuzzles,
    unionAccuracyPercentage,
  };
};

/**
 * Parses a model name to extract base model name and attempt number.
 * Returns null if the model name doesn't follow the attempt pattern.
 */
export const parseAttemptModelName = (
  modelName: string,
): { baseModelName: string; attemptNumber: number } | null => {
  const match = modelName.match(/^(.+)-attempt(\d+)$/);
  if (!match) return null;

  const [, baseModelName, attemptNumberStr] = match;
  const attemptNumber = parseInt(attemptNumberStr, 10);
  
  if (isNaN(attemptNumber) || attemptNumber < 1) return null;

  return { baseModelName, attemptNumber };
};
