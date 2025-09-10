/**
 * puzzleAnalysisService.ts
 * 
 * Service for handling puzzle analysis business logic.
 * Extracts complex AI analysis orchestration from controller.
 * 
 * @author Claude Code
 */

import { aiServiceFactory } from './aiServiceFactory';
import { puzzleService } from './puzzleService';
import { repositoryService } from '../repositories/RepositoryService';
import { validateSolverResponse, validateSolverResponseMulti } from './responseValidator';
import { logger } from '../utils/logger';
import type { PromptOptions } from './promptBuilder';
import type { ARCExample, DetailedFeedback } from '../../shared/types';

export interface AnalysisOptions {
  temperature?: number;
  captureReasoning?: boolean;
  promptId?: string;
  customPrompt?: string;
  emojiSetKey?: string;
  omitAnswer?: boolean;
  topP?: number;
  candidateCount?: number;
  reasoningEffort?: string;
  reasoningVerbosity?: string;
  reasoningSummaryType?: string;
  systemPromptMode?: string;
  retryMode?: boolean;
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
      reasoningEffort,
      reasoningVerbosity,
      reasoningSummaryType,
      systemPromptMode = 'ARC',
      retryMode = false
    } = options;

    // Track server processing time
    const apiStartTime = Date.now();
    
    const puzzle = await puzzleService.getPuzzleById(taskId);
    const aiService = aiServiceFactory.getService(model);
    
    // Get retry context if needed
    const retryContext = retryMode ? await this.getRetryContext(taskId) : null;
    
    // Build prompt options
    const promptOptions: PromptOptions = {};
    if (emojiSetKey) promptOptions.emojiSetKey = emojiSetKey;
    if (typeof omitAnswer === 'boolean') promptOptions.omitAnswer = omitAnswer;
    if (topP) promptOptions.topP = topP;
    if (candidateCount) promptOptions.candidateCount = candidateCount;
    if (retryContext) {
      promptOptions.retryMode = retryMode;
      if (retryContext.previousAnalysis) promptOptions.previousAnalysis = retryContext.previousAnalysis;
            if (retryContext.badFeedback && retryContext.badFeedback.length > 0) promptOptions.badFeedback = retryContext.badFeedback as any[];
    }
    
    // Build service options
    const serviceOpts: any = {};
    if (reasoningEffort) serviceOpts.reasoningEffort = reasoningEffort;
    if (reasoningVerbosity) serviceOpts.reasoningVerbosity = reasoningVerbosity;
    if (reasoningSummaryType) serviceOpts.reasoningSummaryType = reasoningSummaryType;
    if (systemPromptMode) serviceOpts.systemPromptMode = systemPromptMode;
    
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
    
    // Validate solver responses if needed
    if (promptId === "solver") {
      this.validateAndEnrichResult(result, puzzle, promptId);
    }
    
    // Note: Database saving is handled by the calling service (explanationService)
    // This service only handles AI analysis and validation - not persistence
    logger.debug(`Analysis completed for puzzle ${taskId} with model ${model}`, 'puzzle-analysis-service');
    
    // Save raw analysis log
    await this.saveRawLog(taskId, model, result);
    
    return result;
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
                         explanations.sort((a, b) => (a.predictionAccuracyScore || 1) - (b.predictionAccuracyScore || 1))[0];
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
    
    // Check if AI provided multiple predictions
    const multiplePredictedOutputs = result.multiplePredictedOutputs || result.result?.multiplePredictedOutputs;
    if (multiplePredictedOutputs === true) {
      // Multi-test case: AI provided multiple grids
      const correctAnswers = testCount > 1 ? puzzle.test.map((t: ARCExample) => t.output) : [puzzle.test[0].output];
      const multi = validateSolverResponseMulti(result, correctAnswers, promptId, confidence);

      // Add validation results
      result.predictedOutputGrid = multi.predictedGrids;
      result.multiplePredictedOutputs = multi.predictedGrids;
      result.hasMultiplePredictions = true;
      result.predictedOutputGrids = multi.predictedGrids;
      result.multiValidation = multi.itemResults;
      result.multiTestResults = multi.itemResults;
      result.multiTestAllCorrect = multi.allCorrect;
      result.multiTestAverageAccuracy = multi.averageAccuracyScore;
      result.predictionAccuracyScore = multi.averageAccuracyScore;

    } else {
      // Single-test case: AI provided one grid
      const correctAnswer = puzzle.test[0].output;
      const validation = validateSolverResponse(result, correctAnswer, promptId, confidence);

      // Add validation results
      result.predictedOutputGrid = validation.predictedGrid;
      result.multiplePredictedOutputs = null;
      result.hasMultiplePredictions = false;
      result.isPredictionCorrect = validation.isPredictionCorrect;
      result.predictionAccuracyScore = validation.predictionAccuracyScore;
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
      systemPromptMode = 'ARC'
    } = options;

    const puzzle = await puzzleService.getPuzzleById(taskId);
    const aiService = aiServiceFactory.getService(provider);

    // Build options
    const promptOptions: PromptOptions = {};
    if (emojiSetKey) promptOptions.emojiSetKey = emojiSetKey;
    if (typeof omitAnswer === 'boolean') promptOptions.omitAnswer = omitAnswer;

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