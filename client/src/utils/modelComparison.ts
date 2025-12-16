/**
 * Author: Cascade
 * Date: 2025-12-16T00:00:00Z
 * PURPOSE: Presenter utilities for model comparison dialogs; centralizes name formatting and attempt-group parsing.
 *          NOTE: Removed the previous frontend "attempt union" accuracy fallback because it could not compute
 *          harness-aligned scoring without per-test-pair data.
 * SRP/DRY check: Pass - Dedicated to formatting and small parsing helpers; avoids duplicating backend scoring logic.
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
