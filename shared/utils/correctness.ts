/**
 * Correctness Utility
 *
 * Author: Claude Sonnet 4.5
 * Date: 2025-09-29
 * PURPOSE: Single source of truth for puzzle-solving correctness determination.
 * Ensures consistency between frontend and backend correctness logic.
 * Matches the exact logic used in AccuracyRepository.ts (lines 138, 167, 263, etc.)
 *
 * SRP/DRY check: Pass - Single responsibility: correctness determination only
 *
 * CORRECTNESS LOGIC (matches database queries):
 * THREE EVALUATION METRICS (per CLAUDE.md lines 115, 130-131):
 * 1. is_prediction_correct - boolean (evaluation 1 of 3) - for single-test puzzles
 * 2. multi_test_all_correct - boolean (evaluation 2 of 3) - ALL tests must be correct
 * 3. multi_test_average_accuracy - double (evaluation 3 of 3) - PARTIAL CREDIT SCORING
 *
 * CORRECTNESS DETERMINATION:
 * - A prediction is CORRECT if: is_prediction_correct = true OR multi_test_all_correct = true
 * - A prediction is INCORRECT if: is_prediction_correct = false OR multi_test_all_correct = false
 * - PARTIAL CORRECT: multi_test_average_accuracy between 0 and 1 (some tests passed, not all)
 * - Unknown status if neither field is defined
 *
 * This prevents DRY violations where frontend components invented their own correctness logic!
 */

export interface CorrectnessResult {
  modelName: string;
  isPredictionCorrect?: boolean | null;
  multiTestAllCorrect?: boolean | null;
  multiTestAverageAccuracy?: number | null; // CRITICAL: Evaluation 3 of 3 - partial credit
  hasMultiplePredictions?: boolean;
}

export interface CorrectnessStatus {
  isCorrect: boolean;
  isIncorrect: boolean;
  isPartialCorrect: boolean;
  isUnknown: boolean;
  status: 'correct' | 'incorrect' | 'partial-correct' | 'unknown';
  label: string;
  partialScore?: number; // For displaying partial accuracy (0.0 to 1.0)
}

/**
 * Determines if a result is correct using the EXACT same logic as AccuracyRepository
 * PLUS handles partial correctness via multi_test_average_accuracy
 *
 * MATCHES: AccuracyRepository query logic:
 * ```sql
 * is_prediction_correct = true OR multi_test_all_correct = true
 * ```
 *
 * PLUS PARTIAL CREDIT: multi_test_average_accuracy for gradual scoring
 *
 * @param result - Result object with prediction correctness fields
 * @returns CorrectnessStatus with boolean flags and display label
 */
export function determineCorrectness(result: CorrectnessResult): CorrectnessStatus {
  // Match repository logic: is_prediction_correct = true OR multi_test_all_correct = true
  const isCorrect = result.isPredictionCorrect === true || result.multiTestAllCorrect === true;

  // Match repository logic for incorrect: either field is explicitly false
  const isIncorrect = result.isPredictionCorrect === false || result.multiTestAllCorrect === false;

  // Check for partial correctness using multi_test_average_accuracy (evaluation 3 of 3)
  const hasPartialScore = result.hasMultiplePredictions && 
                          result.multiTestAverageAccuracy !== null && 
                          result.multiTestAverageAccuracy !== undefined &&
                          result.multiTestAverageAccuracy > 0 &&
                          result.multiTestAverageAccuracy < 1;

  const isPartialCorrect = !isCorrect && hasPartialScore;

  // Unknown if no evaluation metrics are defined
  const isUnknown = !isCorrect && !isIncorrect && !isPartialCorrect;

  // Determine status and label
  if (isCorrect) {
    return {
      isCorrect: true,
      isIncorrect: false,
      isPartialCorrect: false,
      isUnknown: false,
      status: 'correct',
      label: result.hasMultiplePredictions ? 'All Correct' : 'Correct'
    };
  } else if (isPartialCorrect) {
    const percentCorrect = Math.round((result.multiTestAverageAccuracy || 0) * 100);
    return {
      isCorrect: false,
      isIncorrect: false,
      isPartialCorrect: true,
      isUnknown: false,
      status: 'partial-correct',
      label: `Partial (${percentCorrect}%)`,
      partialScore: result.multiTestAverageAccuracy || 0
    };
  } else if (isIncorrect) {
    return {
      isCorrect: false,
      isIncorrect: true,
      isPartialCorrect: false,
      isUnknown: false,
      status: 'incorrect',
      label: result.hasMultiplePredictions ? 'All Incorrect' : 'Incorrect'
    };
  } else {
    return {
      isCorrect: false,
      isIncorrect: false,
      isPartialCorrect: false,
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