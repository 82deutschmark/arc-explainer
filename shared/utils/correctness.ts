/**
 * Correctness Utility
 *
 * Author: Claude Sonnet 4.5
 * Date: 2025-09-29
 * PURPOSE: Single source of truth for puzzle-solving correctness determination.
 * MATCHES THE WORKING LOGIC FROM AnalysisResultHeader.tsx (lines 110-133)
 * Uses simple nullish coalescing (??) for robust null/undefined handling.
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
  modelName: string;
  isPredictionCorrect?: boolean | null;
  multiTestAllCorrect?: boolean | null;
  allPredictionsCorrect?: boolean | null; // Alternative field name (backward compat)
  hasMultiplePredictions?: boolean;
}

export interface CorrectnessStatus {
  isCorrect: boolean;
  isIncorrect: boolean;
  isUnknown: boolean;
  status: 'correct' | 'incorrect' | 'unknown';
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

  // Simple boolean check
  if (correctnessValue === true) {
    return {
      isCorrect: true,
      isIncorrect: false,
      isUnknown: false,
      status: 'correct',
      label: result.hasMultiplePredictions ? 'All Correct' : 'Correct'
    };
  } else if (correctnessValue === false) {
    return {
      isCorrect: false,
      isIncorrect: true,
      isUnknown: false,
      status: 'incorrect',
      label: result.hasMultiplePredictions ? 'Some Incorrect' : 'Incorrect'
    };
  } else {
    // null or undefined - no prediction data available
    return {
      isCorrect: false,
      isIncorrect: false,
      isUnknown: true,
      status: 'unknown',
      label: 'Unknown'
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