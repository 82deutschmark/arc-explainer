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
  return counts.reduce((total, value) => total + (value ?? 0), 0);
};

/**
 * Guard helper to ensure summary objects with required fields.
 */
export const hasComparisonSummary = (
  result: ModelComparisonResult | null,
): result is ModelComparisonResult & { summary: NonNullable<ModelComparisonResult['summary']> } =>
  Boolean(result?.summary);
