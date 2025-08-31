/**
 * BatchResultProcessor.ts
 * 
 * Handles individual puzzle processing and result aggregation for batch analysis.
 * Responsible for AI service calls, validation, and explanation storage.
 * Follows Single Responsibility Principle by focusing only on result processing.
 * 
 * @author Claude Code
 */

import { aiServiceFactory } from '../aiServiceFactory.js';
import { puzzleService } from '../puzzleService.js';
import { logger } from '../../utils/logger.js';
import type { PromptOptions } from '../promptBuilder.js';
import type { BatchSessionConfig } from './BatchSessionManager.js';

export interface PuzzleProcessingResult {
  success: boolean;
  puzzleId: string;
  explanationId?: number;
  processingTime?: number;
  accuracy?: number;
  isCorrect?: boolean;
  error?: string;
}

export interface BatchProcessingStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  averageProcessingTime: number;
  processingTimes: number[];
}

export class BatchResultProcessor {
  private processingStats: Map<string, BatchProcessingStats> = new Map();

  /**
   * Process a single puzzle within a batch session
   */
  async processPuzzle(sessionId: string, puzzleId: string, config: BatchSessionConfig): Promise<PuzzleProcessingResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Processing puzzle ${puzzleId} for session ${sessionId} with model ${config.modelKey}`, 'batch-processor');

      // Get puzzle data
      const puzzle = await puzzleService.getPuzzleById(puzzleId);
      if (!puzzle) {
        return { 
          success: false, 
          puzzleId, 
          error: `Puzzle ${puzzleId} not found` 
        };
      }

      // Get AI service
      const aiService = aiServiceFactory.getService(config.modelKey);
      if (!aiService) {
        logger.error(`AI service for model ${config.modelKey} not available`, 'batch-processor');
        return { 
          success: false, 
          puzzleId, 
          error: `AI service for ${config.modelKey} not available` 
        };
      }

      // Build service options
      const serviceOpts = this.buildServiceOptions(config);
      const options: PromptOptions = {};

      // Analyze puzzle with AI
      logger.info(`Starting AI analysis for puzzle ${puzzleId} with model ${config.modelKey}`, 'batch-processor');
      const aiResult = await aiService.analyzePuzzleWithModel(
        puzzle,
        config.modelKey,
        config.temperature || 0.2,
        true, // captureReasoning
        config.promptId || 'solver',
        config.customPrompt,
        options,
        serviceOpts,
        puzzleId
      );

      const processingTime = Date.now() - startTime;

      // Process validation if solver prompt
      const validationResults = await this.processValidation(puzzleId, aiResult, config);

      // Save explanation to database
      const explanationId = await this.saveExplanation(puzzleId, aiResult, validationResults, config, processingTime);

      if (!explanationId) {
        return { 
          success: false, 
          puzzleId, 
          error: 'Failed to save explanation to database' 
        };
      }

      // Update processing statistics
      this.updateProcessingStats(sessionId, true, processingTime);

      logger.info(`Successfully processed puzzle ${puzzleId} in ${processingTime}ms`, 'batch-processor');

      return {
        success: true,
        puzzleId,
        explanationId,
        processingTime,
        accuracy: aiResult.predictionAccuracyScore || aiResult.multiTestAverageAccuracy,
        isCorrect: aiResult.isPredictionCorrect || aiResult.multiTestAllCorrect
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(sessionId, false, processingTime);

      logger.error(`Error processing puzzle ${puzzleId}: ${error instanceof Error ? error.message : String(error)}`, 'batch-processor');
      
      return { 
        success: false, 
        puzzleId,
        processingTime,
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Process multiple puzzles concurrently
   */
  async processBatch(sessionId: string, puzzleIds: string[], config: BatchSessionConfig): Promise<PuzzleProcessingResult[]> {
    logger.info(`Processing batch of ${puzzleIds.length} puzzles for session ${sessionId}`, 'batch-processor');

    const batchPromises = puzzleIds.map(puzzleId => 
      this.processPuzzle(sessionId, puzzleId, config)
    );

    const results = await Promise.allSettled(batchPromises);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          puzzleId: puzzleIds[index],
          error: result.reason?.message || 'Unknown processing error'
        };
      }
    });
  }

  /**
   * Get processing statistics for a session
   */
  getProcessingStats(sessionId: string): BatchProcessingStats | null {
    return this.processingStats.get(sessionId) || null;
  }

  /**
   * Clear processing statistics for a session
   */
  clearProcessingStats(sessionId: string): void {
    this.processingStats.delete(sessionId);
  }

  /**
   * Build service options from config
   */
  private buildServiceOptions(config: BatchSessionConfig): any {
    const serviceOpts: any = {};
    
    if (config.reasoningEffort) serviceOpts.reasoningEffort = config.reasoningEffort;
    if (config.reasoningVerbosity) serviceOpts.reasoningVerbosity = config.reasoningVerbosity;
    if (config.reasoningSummaryType) serviceOpts.reasoningSummaryType = config.reasoningSummaryType;
    
    return serviceOpts;
  }

  /**
   * Process validation for solver responses
   */
  private async processValidation(puzzleId: string, aiResult: any, config: BatchSessionConfig): Promise<any> {
    if (config.promptId !== "solver") {
      return {};
    }

    try {
      const { validateSolverResponse, validateSolverResponseMulti } = await import('../responseValidator.js');
      
      const puzzle = await puzzleService.getPuzzleById(puzzleId);
      const confidence = aiResult.confidence || aiResult.result?.confidence || 50;
      const testCount = puzzle.test?.length || 0;
      
      // Create validation results without modifying original response
      if (aiResult.multiplePredictedOutputs === true || aiResult.result?.multiplePredictedOutputs === true) {
        // Multi-test case
        const correctAnswers = testCount > 1 ? puzzle.test.map((t: any) => t.output) : [puzzle.test[0].output];
        const multi = validateSolverResponseMulti(aiResult.result || aiResult, correctAnswers, config.promptId, confidence);

        return {
          predictedOutputGrid: null,
          hasMultiplePredictions: true,
          multiTestResults: multi.itemResults,
          multiTestAllCorrect: multi.allCorrect,
          multiTestAverageAccuracy: multi.averageAccuracyScore
        };
      } else {
        // Single-test case
        const correctAnswer = puzzle.test[0].output;
        const validation = validateSolverResponse(aiResult.result || aiResult, correctAnswer, config.promptId, confidence);

        return {
          predictedOutputGrid: validation.predictedGrid,
          hasMultiplePredictions: false,
          isPredictionCorrect: validation.isPredictionCorrect,
          predictionAccuracyScore: validation.predictionAccuracyScore
        };
      }
    } catch (validationError) {
      logger.error(`Validation failed for ${puzzleId}, preserving original response:`, 'batch-processor', validationError);
      return {};
    }
  }

  /**
   * Save explanation to database
   */
  private async saveExplanation(
    puzzleId: string, 
    aiResult: any, 
    validationResults: any, 
    config: BatchSessionConfig, 
    processingTime: number
  ): Promise<number | null> {
    try {
      // Prepare explanation data
      const explanationToSave = {
        [config.modelKey]: { 
          ...aiResult.result,    // Preserve original AI response 
          ...validationResults, // Add validation results separately
          modelKey: config.modelKey,
          actualProcessingTime: Math.round(processingTime / 1000)
        }
      };
      
      // Use explanationService to ensure proper model name recording
      const { explanationService } = await import('../explanationService.js');
      const saveResult = await explanationService.saveExplanation(puzzleId, explanationToSave);
      
      return saveResult.explanationIds[0] || null;
    } catch (error) {
      logger.error(`Failed to save explanation for puzzle ${puzzleId}: ${error instanceof Error ? error.message : String(error)}`, 'batch-processor');
      return null;
    }
  }

  /**
   * Update processing statistics for session
   */
  private updateProcessingStats(sessionId: string, success: boolean, processingTime: number): void {
    let stats = this.processingStats.get(sessionId);
    
    if (!stats) {
      stats = {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        averageProcessingTime: 0,
        processingTimes: []
      };
    }

    stats.totalProcessed++;
    stats.processingTimes.push(processingTime);
    
    if (success) {
      stats.successful++;
    } else {
      stats.failed++;
    }

    // Recalculate average processing time
    stats.averageProcessingTime = Math.round(
      stats.processingTimes.reduce((sum, time) => sum + time, 0) / stats.processingTimes.length
    );

    this.processingStats.set(sessionId, stats);
  }
}

export const batchResultProcessor = new BatchResultProcessor();