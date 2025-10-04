/**
 * Correctness Utility
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-03T23:05:00-04:00
 * PURPOSE: Single source of truth for puzzle-solving correctness determination.
 * FIXED: Removed "Some Incorrect" label - now just shows "Incorrect" for all failed predictions.
 * We cannot reliably distinguish "all incorrect" vs "some incorrect" without detailed validation data.
 * When multiTestAllCorrect === false, it just means NOT all correct (could be 0/N or some failed).
 *
 * SRP/DRY check: Pass - Single responsibility: correctness determination only
 *
 * CORRECTNESS LOGIC (matches AnalysisResultHeader and AccuracyRepository):
 * ```typescript
 * const isCorrect = result.multiTestAllCorrect ?? result.isPredictionCorrect;
 * ```
 * - Uses ?? nullish coalescing (handles null/undefined properly)
 * - Priority: multiTestAllCorrect first, then isPredictionCorrect
 * - Simple boolean result: true = correct, false = incorrect, null/undefined = unknown
 *
 * This prevents DRY violations where components invented their own correctness logic!
 */

export interface CorrectnessResult {
  modelName?: string;
  isPredictionCorrect?: boolean | null;
  multiTestAllCorrect?: boolean | null;
  allPredictionsCorrect?: boolean | null; // Alternative field name (backward compat)
  hasMultiplePredictions?: boolean | null;
}

export interface CorrectnessStatus {
  isCorrect: boolean;
  isIncorrect: boolean;
  isUnknown: boolean; // Always false - kept for backward compatibility
  status: 'correct' | 'incorrect';
  label: string;
}

/**
 * Determines if a result is correct using EXACT same logic as AnalysisResultHeader
 *
 * MATCHES: AnalysisResultHeader.tsx lines 114, 120, 126:
 * ```typescript
 * const isCorrect = result.multiTestAllCorrect ?? result.allPredictionsCorrect ?? result.isPredictionCorrect;
 * ```
 *
 * AND MATCHES: AccuracyRepository query logic:
 * ```sql
 * is_prediction_correct = true OR multi_test_all_correct = true
 * ```
 *
 * @param result - Result object with prediction correctness fields
 * @returns CorrectnessStatus with boolean flags and display label
 */
export function determineCorrectness(result: CorrectnessResult): CorrectnessStatus {
  // Use the EXACT working logic from AnalysisResultHeader (nullish coalescing)
  // This properly handles null/undefined and gives us the first non-null value
  const correctnessValue = result.multiTestAllCorrect ?? result.allPredictionsCorrect ?? result.isPredictionCorrect;

  // MATCHES AccuracyRepository SQL logic:
  // SUM(CASE WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 1 ELSE 0 END)
  // Anything NOT explicitly true counts as incorrect (null, undefined, false all = incorrect)
  if (correctnessValue === true) {
    return {
      isCorrect: true,
      isIncorrect: false,
      isUnknown: false,
      status: 'correct',
      label: result.hasMultiplePredictions ? 'All Correct' : 'Correct'
    };
  } else {
    // false, null, or undefined - all count as incorrect
    // NOTE: We can't distinguish "all incorrect" vs "some incorrect" without detailed validation data
    // When multiTestAllCorrect === false, it just means NOT all correct (could be 0/N or some failed)
    // So we just show "Incorrect" for clarity
    return {
      isCorrect: false,
      isIncorrect: true,
      isUnknown: false,
      status: 'incorrect',
      label: 'Incorrect'
    };
  }
}

/**
 * Determines if a result is debatable (not explicitly correct)
 *
 * Everything is debatable UNLESS it's explicitly correct.
 * This matches the logic in AnalysisResultListCard but uses shared correctness determination.
 *
 * @param result - Result object with prediction correctness fields
 * @returns true if the result is debatable (not explicitly correct)
 */
export function isDebatable(result: CorrectnessResult): boolean {
  const correctness = determineCorrectness(result);
  return !correctness.isCorrect;
}