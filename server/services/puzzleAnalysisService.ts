/**
 * puzzleAnalysisService.ts
 *
 * Author: Cascade using GPT-4.1 (original), Claude Code using Sonnet 4.5 (2025-09-30 fix), 
 *         Cascade using Claude Sonnet 4 (2025-10-10 streaming validation fix)
 * Date: 2025-09-29T17:15:00-04:00 (original), 2025-09-30 (validation fix), 2025-10-10 (streaming fix)
 * PURPOSE: Service for handling puzzle analysis business logic. Extracts complex AI analysis
 * orchestration from controller. Manages the full analysis pipeline: prompt building, AI service
 * calls, response validation, and database persistence preparation.
 *
 * CRITICAL FIX (2025-10-10): Fixed streaming validation bug where streaming responses skipped
 * validateAndEnrichResult() entirely, causing NULL predicted_output_grid, isPredictionCorrect=false,
 * and trustworthinessScore=0 to be saved to database. Now wraps streaming harness to intercept
 * completion and validate analysis using validateStreamingResult() before sending to client.
 * This ensures streaming results match database schema expectations just like non-streaming analysis.
 *
 * CRITICAL FIX (2025-09-30): Fixed debate validation bug where 'debate' prompt type was excluded
 * from validateAndEnrichResult() call (line 124). This caused debate rebuttals to skip prediction
 * extraction and validation entirely, resulting in NULL predicted grids and default values
 * (isPredictionCorrect: false, trustworthinessScore: 0) being saved to database. Now uses
 * centralized isSolverMode() function from systemPrompts.ts to ensure consistent validation.
 *
 * PREVIOUS FIX (2025-09-29): Added originalExplanation and customChallenge extraction in
 * generatePromptPreview() to enable debate mode prompt preview. These fields were missing,
 * causing API calls to fail when previewing debate prompts.
 *
 * SRP/DRY check: Pass - Single service responsibility (analysis orchestration), now properly
 * uses centralized solver mode detection instead of duplicating logic.
 */

import { aiServiceFactory } from './aiServiceFactory';
import { puzzleService } from './puzzleService';
import { repositoryService } from '../repositories/RepositoryService';
import { validateSolverResponse, validateSolverResponseMulti } from './responseValidator';
import { logger } from '../utils/logger';
import { isSolverMode } from './prompts/systemPrompts';
import { validateStreamingResult } from './streamingValidator';
import type { PromptOptions } from './promptBuilder';
import type { ServiceOptions, StreamingHarness } from './base/BaseAIService';
import type { ARCExample, DetailedFeedback } from '../../shared/types';
import type { ExplanationData } from '../repositories/interfaces/IExplanationRepository.ts';

export interface AnalysisOptions {
  temperature?: number;
  captureReasoning?: boolean;
  promptId?: string;
  customPrompt?: string;
  emojiSetKey?: string;
  omitAnswer?: boolean;
  topP?: number;
  candidateCount?: number;
  thinkingBudget?: number;
  reasoningEffort?: string;
  reasoningVerbosity?: string;
  reasoningSummaryType?: string;
  systemPromptMode?: string;
  retryMode?: boolean;
  originalExplanation?: ExplanationData; // For debate mode
  originalExplanationId?: number;
  customChallenge?: string; // For debate mode
  previousResponseId?: string; // For conversation chaining
}

export interface RetryContext {
  previousAnalysis?: any;
  badFeedback?: any[];
}

export class PuzzleAnalysisService {
  /**
   * Analyze a puzzle with specified AI model and options
   */
  async analyzePuzzle(
    taskId: string, 
    model: string, 
    options: AnalysisOptions = {}
  ): Promise<any> {
    const {
      temperature = 0.2,
      captureReasoning = true,
      promptId = "solver",
      customPrompt,
      emojiSetKey,
      omitAnswer = true,
      topP,
      candidateCount,
      thinkingBudget,
      reasoningEffort,
      reasoningVerbosity,
      reasoningSummaryType,
      systemPromptMode = 'ARC',
      retryMode = false,
      originalExplanation,
      originalExplanationId,
      customChallenge,
      previousResponseId
    } = options;

    // Track server processing time
    const apiStartTime = Date.now();
    
    const puzzle = await puzzleService.getPuzzleById(taskId);
    const aiService = aiServiceFactory.getService(model);
    let resolvedOriginalExplanation = originalExplanation;
    if (!resolvedOriginalExplanation && typeof originalExplanationId === 'number') {
      resolvedOriginalExplanation = await repositoryService.explanations.getExplanationById(originalExplanationId) || undefined;
    }
    
    // Get retry context if needed
    const retryContext = retryMode ? await this.getRetryContext(taskId) : null;
    
    // Build prompt options
    const promptOptions: PromptOptions = {};
    if (emojiSetKey) promptOptions.emojiSetKey = emojiSetKey;
    if (typeof omitAnswer === 'boolean') promptOptions.omitAnswer = omitAnswer;
    if (topP) promptOptions.topP = topP;
    if (candidateCount) promptOptions.candidateCount = candidateCount;
    if (typeof thinkingBudget === 'number') promptOptions.thinkingBudget = thinkingBudget;
    if (retryContext) {
      promptOptions.retryMode = retryMode;
      if (retryContext.previousAnalysis) promptOptions.previousAnalysis = retryContext.previousAnalysis;
            if (retryContext.badFeedback && retryContext.badFeedback.length > 0) promptOptions.badFeedback = retryContext.badFeedback as any[];
    }
    // Add debate mode context
    if (resolvedOriginalExplanation) promptOptions.originalExplanation = resolvedOriginalExplanation;
    if (customChallenge) promptOptions.customChallenge = customChallenge;
    
    // Build service options
    const serviceOpts: any = {};
    if (reasoningEffort) serviceOpts.reasoningEffort = reasoningEffort;
    if (reasoningVerbosity) serviceOpts.reasoningVerbosity = reasoningVerbosity;
    if (reasoningSummaryType) serviceOpts.reasoningSummaryType = reasoningSummaryType;
    if (systemPromptMode) serviceOpts.systemPromptMode = systemPromptMode;
    // Conversation chaining support - pass through response ID for multi-turn analysis
    if (previousResponseId) serviceOpts.previousResponseId = previousResponseId;
    
    // CRITICAL FIX: Correct parameter order to match BaseAIService interface
    // analyzePuzzleWithModel(task, modelKey, temperature, promptId, customPrompt, options, serviceOpts)
    const result = await aiService.analyzePuzzleWithModel(
      puzzle,        // task: ARCTask
      model,         // modelKey: string
      taskId,        // taskId: string
      temperature,   // temperature?: number
      promptId,      // promptId?: string
      customPrompt,  // customPrompt?: string
      promptOptions, // options?: PromptOptions
      serviceOpts    // serviceOpts?: ServiceOptions
    );
    
    // Calculate API processing time
    const apiProcessingTimeMs = Date.now() - apiStartTime;
    result.apiProcessingTimeMs = apiProcessingTimeMs;

    // Validate solver responses and custom prompts that may be attempting to solve
    // FIXED: Use centralized isSolverMode function to include debate, educationalApproach, gepa
    if (isSolverMode(promptId)) {
      this.validateAndEnrichResult(result, puzzle, promptId);
    }

    // Add rebuttal tracking if this is a debate response
    if (resolvedOriginalExplanation && resolvedOriginalExplanation.id) {
      result.rebuttingExplanationId = resolvedOriginalExplanation.id;
      logger.debug(`Marking as rebuttal to explanation ${resolvedOriginalExplanation.id}`, 'puzzle-analysis-service');
    }

    // Note: Database saving is handled by the calling service (explanationService)
    // This service only handles AI analysis and validation - not persistence
    logger.debug(`Analysis completed for puzzle ${taskId} with model ${model}`, 'puzzle-analysis-service');

    // Save raw analysis log
    await this.saveRawLog(taskId, model, result);

    return result;
  }

  /**
   * Analyze a puzzle using streaming responses, mirroring analyzePuzzle logic.
   */
  async analyzePuzzleStreaming(
    taskId: string,
    model: string,
    options: AnalysisOptions = {},
    stream: StreamingHarness,
    overrides: Partial<ServiceOptions> = {}
  ): Promise<void> {
    const {
      temperature = 0.2,
      captureReasoning = true,
      promptId = 'solver',
      customPrompt,
      emojiSetKey,
      omitAnswer = true,
      topP,
      candidateCount,
      thinkingBudget,
      reasoningEffort,
      reasoningVerbosity,
      reasoningSummaryType,
      systemPromptMode = 'ARC',
      retryMode = false,
      originalExplanation,
      originalExplanationId,
      customChallenge,
      previousResponseId,
    } = options;

    const puzzle = await puzzleService.getPuzzleById(taskId);
    const aiService = aiServiceFactory.getService(model);

    let resolvedOriginalExplanation = originalExplanation;
    if (!resolvedOriginalExplanation && typeof originalExplanationId === 'number') {
      resolvedOriginalExplanation = await repositoryService.explanations.getExplanationById(originalExplanationId) || undefined;
    }

    const retryContext = retryMode ? await this.getRetryContext(taskId) : null;

    const promptOptions: PromptOptions = {};
    if (emojiSetKey) promptOptions.emojiSetKey = emojiSetKey;
    if (typeof omitAnswer === 'boolean') promptOptions.omitAnswer = omitAnswer;
    if (topP) promptOptions.topP = topP;
    if (candidateCount) promptOptions.candidateCount = candidateCount;
    if (typeof thinkingBudget === 'number') promptOptions.thinkingBudget = thinkingBudget;
    if (retryContext) {
      promptOptions.retryMode = retryMode;
      if (retryContext.previousAnalysis) promptOptions.previousAnalysis = retryContext.previousAnalysis;
      if (retryContext.badFeedback && retryContext.badFeedback.length > 0) {
        promptOptions.badFeedback = retryContext.badFeedback as any[];
      }
    }
    if (resolvedOriginalExplanation) promptOptions.originalExplanation = resolvedOriginalExplanation;
    if (customChallenge) promptOptions.customChallenge = customChallenge;

    // Wrap the streaming harness to validate results before sending completion
    const validatingHarness: StreamingHarness = {
      sessionId: stream.sessionId,
      emit: (chunk) => stream.emit(chunk),
      emitEvent: stream.emitEvent,
      abortSignal: stream.abortSignal,
      metadata: stream.metadata,
      end: (completion) => {
        // CRITICAL: Validate and enrich the analysis before sending to client
        if (completion.responseSummary?.analysis) {
          logger.debug('[Streaming Analysis] Validating result before sending completion', 'puzzle-analysis-service');
          const validatedAnalysis = validateStreamingResult(
            completion.responseSummary.analysis,
            puzzle,
            promptId
          );
          completion.responseSummary.analysis = validatedAnalysis;
          logger.debug('[Streaming Analysis] Validation complete, sending enriched result', 'puzzle-analysis-service');
        } else {
          logger.warn('[Streaming Analysis] No analysis found in completion summary', 'puzzle-analysis-service');
        }
        stream.end(completion);
      }
    };

    const serviceOpts: any = {
      ...overrides,
      captureReasoning,
      stream: validatingHarness,
    };
    if (reasoningEffort) serviceOpts.reasoningEffort = reasoningEffort;
    if (reasoningVerbosity) serviceOpts.reasoningVerbosity = reasoningVerbosity;
    if (reasoningSummaryType) serviceOpts.reasoningSummaryType = reasoningSummaryType;
    if (systemPromptMode) serviceOpts.systemPromptMode = systemPromptMode;
    if (previousResponseId) serviceOpts.previousResponseId = previousResponseId;

    await aiService.analyzePuzzleWithStreaming(
      puzzle,
      model,
      taskId,
      temperature,
      promptId,
      customPrompt,
      promptOptions,
      serviceOpts
    );
  }

  /**
   * Get retry context including previous analysis and bad feedback
   */
  private async getRetryContext(taskId: string): Promise<RetryContext | null> {
    try {
      let previousAnalysis: any;
      let badFeedback: any[] | undefined;
      
      // Get all explanations for this puzzle to find the worst one
      const explanations = await repositoryService.explanations.getExplanationsForPuzzle(taskId);
      if (explanations && explanations.length > 0) {
        // Find the worst analysis (incorrect prediction or lowest trustworthiness)
        previousAnalysis = explanations.find(exp => exp.isPredictionCorrect === false) || 
                         explanations.sort((a, b) => (a.trustworthinessScore || 1) - (b.trustworthinessScore || 1))[0];
      }
      
      // Get bad feedback for this puzzle
      if (repositoryService.feedback) {
        const allFeedback = await repositoryService.feedback.getFeedbackForPuzzle(taskId);
        if (allFeedback && allFeedback.length > 0) {
          // Filter to get only negative feedback with comments
          badFeedback = allFeedback.filter(fb => 
            (fb as any).voteType === 'not_helpful' && fb.comment && fb.comment.trim().length > 0
          );
        }
      }
      
      logger.debug(`[RETRY-MODE] Found ${previousAnalysis ? '1' : '0'} previous analysis and ${badFeedback ? badFeedback.length : 0} bad feedback entries`);
      
      return { previousAnalysis, badFeedback: badFeedback ?? undefined };
    } catch (error) {
      logger.error('[RETRY-MODE] Error fetching context: ' + (error instanceof Error ? error.message : String(error)));
      return null;
    }
  }

  /**
   * Validate and enrich solver response results
   */
  private validateAndEnrichResult(result: any, puzzle: any, promptId: string): void {
    const confidence = result.confidence === 0 ? 50 : (result.confidence || 50);
    const testCount = puzzle.test?.length || 0;
    
    // Preserve original analysis content before validation
    const originalAnalysis = {
      patternDescription: result.patternDescription,
      solvingStrategy: result.solvingStrategy,
      hints: result.hints,
      alienMeaning: result.alienMeaning,
      confidence: result.confidence,
      reasoningLog: result.reasoningLog,
      hasReasoningLog: result.hasReasoningLog
    };
    
    // CRITICAL FIX: Use validator with database-compatible field names
    // Author: Claude Code using Sonnet 4
    // Date: 2025-09-16
    // PURPOSE: Eliminate field mapping issues that caused multi-test data loss

    // Check if AI provided multiple predictions
    const multiplePredictedOutputs = result.multiplePredictedOutputs || result.result?.multiplePredictedOutputs;
    if (multiplePredictedOutputs === true) {
      // Multi-test case: AI provided multiple grids
      const correctAnswers = testCount > 1 ? puzzle.test.map((t: ARCExample) => t.output) : [puzzle.test[0].output];
      const multiValidation = validateSolverResponseMulti(result, correctAnswers, promptId, confidence);

      // FIXED: Use database-compatible field names directly from validator
      // No field transformation - direct assignment to match database schema
      result.hasMultiplePredictions = multiValidation.hasMultiplePredictions;
      result.multiplePredictedOutputs = multiValidation.multiplePredictedOutputs;
      result.multiTestResults = multiValidation.multiTestResults;
      result.multiTestAllCorrect = multiValidation.multiTestAllCorrect;
      result.multiTestAverageAccuracy = multiValidation.multiTestAverageAccuracy;
      result.multiTestPredictionGrids = multiValidation.multiTestPredictionGrids;

      // Legacy fields for backward compatibility
      result.predictedOutputGrid = multiValidation.multiplePredictedOutputs;
      result.trustworthinessScore = multiValidation.multiTestAverageAccuracy;
      result.multiValidation = multiValidation.multiTestResults; // Legacy alias

    } else {
      // Single-test case: AI provided one grid
      const correctAnswer = puzzle.test[0].output;
      const validation = validateSolverResponse(result, correctAnswer, promptId, confidence);

      // Single-test validation results
      result.predictedOutputGrid = validation.predictedGrid;
      result.isPredictionCorrect = validation.isPredictionCorrect;
      result.trustworthinessScore = validation.trustworthinessScore;

      // Ensure multi-test fields are properly set for single-test cases
      result.hasMultiplePredictions = false;
      result.multiplePredictedOutputs = null;
      result.multiTestResults = null;
      result.multiTestAllCorrect = null;
      result.multiTestAverageAccuracy = null;
      result.multiTestPredictionGrids = null;
    }
    
    // Restore original analysis content after validation
    if (originalAnalysis.patternDescription) {
      result.patternDescription = originalAnalysis.patternDescription;
    }
    if (originalAnalysis.solvingStrategy) {
      result.solvingStrategy = originalAnalysis.solvingStrategy;
    }
    if (originalAnalysis.hints && originalAnalysis.hints.length > 0) {
      result.hints = originalAnalysis.hints;
    }
    if (originalAnalysis.alienMeaning) {
      result.alienMeaning = originalAnalysis.alienMeaning;
    }
    if (originalAnalysis.reasoningLog) {
      result.reasoningLog = originalAnalysis.reasoningLog;
      result.hasReasoningLog = originalAnalysis.hasReasoningLog;
    }
    if (originalAnalysis.confidence !== undefined) {
      result.confidence = originalAnalysis.confidence;
    }
  }

  /**
   * Save raw analysis log to file system
   */
  private async saveRawLog(taskId: string, model: string, result: any): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedModelName = model.replace(/[\/\\:*?"<>|]/g, '-');
      const logFileName = `${taskId}-${sanitizedModelName}-${timestamp}-raw.json`;
      const logFilePath = path.join('data', 'explained', logFileName);
      await fs.writeFile(logFilePath, JSON.stringify(result, null, 2));
      logger.debug(`Response for ${model} saved to ${logFilePath}`, 'puzzle-analysis-service');
    } catch (logError) {
      logger.error(`Failed to save raw log for ${model}: ${logError instanceof Error ? logError.message : String(logError)}`, 'puzzle-analysis-service');
    }
  }

  /**
   * Generate prompt preview for a specific provider
   */
  async generatePromptPreview(
    taskId: string,
    provider: string,
    options: AnalysisOptions = {}
  ): Promise<any> {
    const {
      temperature = 0.2,
      captureReasoning = true,
      promptId = "solver",
      customPrompt,
      emojiSetKey,
      omitAnswer = true,
      reasoningEffort,
      reasoningVerbosity,
      reasoningSummaryType,
      systemPromptMode = 'ARC',
      originalExplanation,
      customChallenge
    } = options;

    const puzzle = await puzzleService.getPuzzleById(taskId);
    const aiService = aiServiceFactory.getService(provider);

    // Build options
    const promptOptions: PromptOptions = {};
    if (emojiSetKey) promptOptions.emojiSetKey = emojiSetKey;
    if (typeof omitAnswer === 'boolean') promptOptions.omitAnswer = omitAnswer;
    // Add debate mode context
    if (originalExplanation) promptOptions.originalExplanation = originalExplanation;
    if (customChallenge) promptOptions.customChallenge = customChallenge;

    const serviceOpts: any = {};
    if (reasoningEffort) serviceOpts.reasoningEffort = reasoningEffort;
    if (reasoningVerbosity) serviceOpts.reasoningVerbosity = reasoningVerbosity;
    if (reasoningSummaryType) serviceOpts.reasoningSummaryType = reasoningSummaryType;
    if (systemPromptMode) serviceOpts.systemPromptMode = systemPromptMode;

    // FIX: Correct parameter order for generatePromptPreview method
    // generatePromptPreview(task, modelKey, promptId, customPrompt, options, serviceOpts)
    return await aiService.generatePromptPreview(
      puzzle,         // task: ARCTask
      provider,       // modelKey: string 
      promptId,       // promptId?: string
      customPrompt,   // customPrompt?: string
      promptOptions,  // options?: PromptOptions
      serviceOpts     // serviceOpts?: ServiceOptions
    );
  }
}

export const puzzleAnalysisService = new PuzzleAnalysisService();
