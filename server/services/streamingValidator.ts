/**
 * streamingValidator.ts
 * 
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-10
 * PURPOSE: Validates and enriches streaming analysis results before sending completion summary.
 * Applies same validation logic as non-streaming analysis (validateAndEnrichResult) to ensure
 * prediction grids, correctness flags, and accuracy scores are properly set.
 * 
 * CRITICAL: Streaming responses were skipping validation, causing NULL prediction grids and
 * incorrect accuracy flags in database. This utility ensures streaming results match the
 * database schema expectations just like non-streaming analysis.
 * 
 * SRP/DRY check: Pass - Single responsibility (streaming validation), reuses existing validators
 */

import { validateSolverResponse, validateSolverResponseMulti } from './responseValidator';
import { isSolverMode } from './prompts/systemPrompts';
import { logger } from '../utils/logger';
import { shouldValidateAsMultiTest } from './utils/multiPredictionDetection';
import type { ARCTask, ARCExample } from '../../shared/types';

/**
 * Validates and enriches streaming analysis result before sending to client.
 * Mirrors the validation logic from puzzleAnalysisService.validateAndEnrichResult()
 * but returns the enriched result rather than mutating in place.
 */
export function validateStreamingResult(
  result: any,
  puzzle: ARCTask,
  promptId: string
): any {
  // Only validate solver prompts
  if (!isSolverMode(promptId)) {
    logger.debug('[Streaming Validator] Non-solver prompt, skipping validation', 'streaming-validator');
    return result;
  }

  logger.debug(`[Streaming Validator] Validating streaming result for prompt: ${promptId}`, 'streaming-validator');

  const confidence = result.confidence === 0 ? 50 : (result.confidence || 50);
  const testCount = puzzle.test?.length || 0;

  // Preserve original analysis content
  const originalAnalysis = {
    patternDescription: result.patternDescription,
    solvingStrategy: result.solvingStrategy,
    hints: result.hints,
    alienMeaning: result.alienMeaning,
    confidence: result.confidence,
    reasoningLog: result.reasoningLog,
    hasReasoningLog: result.hasReasoningLog
  };

  const shouldRunMultiValidation = shouldValidateAsMultiTest(result, testCount);
  let validatedResult = { ...result };

  if (shouldRunMultiValidation) {
    const correctAnswers = (puzzle.test || []).map((t: ARCExample) => t.output);
    if (correctAnswers.length === 0 && puzzle.test?.[0]?.output) {
      correctAnswers.push(puzzle.test[0].output);
    }
    const multiValidation = validateSolverResponseMulti(result, correctAnswers, promptId, confidence);

    // Use database-compatible field names directly from validator
    validatedResult.hasMultiplePredictions = multiValidation.hasMultiplePredictions;
    validatedResult.multiplePredictedOutputs = multiValidation.multiplePredictedOutputs;
    validatedResult.multiTestResults = multiValidation.multiTestResults;
    validatedResult.multiTestAllCorrect = multiValidation.multiTestAllCorrect;
    validatedResult.multiTestAverageAccuracy = multiValidation.multiTestAverageAccuracy;
    validatedResult.multiTestPredictionGrids = multiValidation.multiTestPredictionGrids;

    // Legacy fields for backward compatibility
    validatedResult.predictedOutputGrid = multiValidation.multiplePredictedOutputs;
    validatedResult.trustworthinessScore = multiValidation.multiTestAverageAccuracy;
    validatedResult.multiValidation = multiValidation.multiTestResults;

    logger.debug(`[Streaming Validator] Multi-test validation: ${multiValidation.multiTestAllCorrect ? 'ALL CORRECT' : 'SOME INCORRECT'}`, 'streaming-validator');
  } else {
    // Single-test case: AI provided one grid
    const correctAnswer = puzzle.test?.[0]?.output;
    if (!correctAnswer) {
      const puzzleIdForLog = result?.puzzleId ?? 'unknown';
      logger.warn(`Puzzle ${puzzleIdForLog} is missing expected output data`, 'streaming-validator');
    }
    const validation = correctAnswer
      ? validateSolverResponse(result, correctAnswer, promptId, confidence)
      : { predictedGrid: null, isPredictionCorrect: false, trustworthinessScore: 0, extractionMethod: 'missing_expected_output' };

    // Single-test validation results
    validatedResult.predictedOutputGrid = validation.predictedGrid;
    validatedResult.isPredictionCorrect = validation.isPredictionCorrect;
    validatedResult.trustworthinessScore = validation.trustworthinessScore;

    // Ensure multi-test fields are properly set for single-test cases
    validatedResult.hasMultiplePredictions = false;
    validatedResult.multiplePredictedOutputs = null;
    validatedResult.multiTestResults = null;
    validatedResult.multiTestAllCorrect = null;
    validatedResult.multiTestAverageAccuracy = null;
    validatedResult.multiTestPredictionGrids = null;

    logger.debug(`[Streaming Validator] Single-test validation: ${validation.isPredictionCorrect ? 'CORRECT' : 'INCORRECT'}`, 'streaming-validator');
  }

  // Restore original analysis content after validation
  if (originalAnalysis.patternDescription) {
    validatedResult.patternDescription = originalAnalysis.patternDescription;
  }
  if (originalAnalysis.solvingStrategy) {
    validatedResult.solvingStrategy = originalAnalysis.solvingStrategy;
  }
  if (originalAnalysis.hints && originalAnalysis.hints.length > 0) {
    validatedResult.hints = originalAnalysis.hints;
  }
  if (originalAnalysis.alienMeaning) {
    validatedResult.alienMeaning = originalAnalysis.alienMeaning;
  }
  if (originalAnalysis.reasoningLog) {
    validatedResult.reasoningLog = originalAnalysis.reasoningLog;
    validatedResult.hasReasoningLog = originalAnalysis.hasReasoningLog;
  }
  if (originalAnalysis.confidence !== undefined) {
    validatedResult.confidence = originalAnalysis.confidence;
  }

  return validatedResult;
}
