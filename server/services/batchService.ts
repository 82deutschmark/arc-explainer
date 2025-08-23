/**
 * server/services/batchService.ts
 * 
 * Core batch testing service that orchestrates puzzle analysis runs.
 * Handles queue management, rate limiting, error recovery, and progress tracking.
 * Leverages existing puzzle analysis infrastructure for consistent behavior.
 * 
 * @author Cascade
 */

import fs from 'fs';
import path from 'path';
import { dbService } from './dbService';
import { puzzleService } from './puzzleService';
import { aiServiceFactory } from './aiServiceFactory';
import { broadcast } from './wsService';
import { logger } from '../utils/logger';
import type { PromptOptions } from './promptBuilder';
import { validateSolverResponseMulti, validateSolverResponse } from './responseValidator';

export interface BatchConfig {
  rateLimitDelayMs?: number; // Default 3000ms
  maxRetries?: number; // Default 3
  timeoutPerPuzzleMs?: number; // Default 300000 (5 minutes)
  concurrency?: number; // Default 1 (sequential processing)
  promptId?: string; // Default 'solver'
  customPrompt?: string; // Custom prompt text
  temperature?: number; // Default 0.2
  captureReasoning?: boolean; // Default true
  omitAnswer?: boolean; // Default true
  systemPromptMode?: string; // Default 'ARC'
  // GPT-5 reasoning parameters
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  reasoningVerbosity?: 'low' | 'medium' | 'high';
  reasoningSummaryType?: 'auto' | 'detailed';
  // Emoji set for puzzle grids
  emojiSetKey?: string;
}

export interface BatchRunStatus {
  id: number;
  status: 'running' | 'completed' | 'stopped' | 'error';
  model: string;
  datasetPath: string;
  totalPuzzles: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  averageAccuracy: number | null;
  totalProcessingTimeMs: number;
  createdAt: string;
  completedAt: string | null;
  config: BatchConfig;
  currentPuzzle?: string;
  estimatedTimeRemainingMs?: number;
}

export interface BatchResult {
  puzzleId: string;
  success: boolean;
  accuracyScore: number | null;
  processingTimeMs: number;
  errorMessage: string | null;
  explanationId: number | null;
}

// Active batch runs tracking
const activeBatchRuns = new Map<number, { shouldStop: boolean; currentPuzzle?: string }>();

class BatchService {
  /**
   * Start a new batch testing run
   */
  async startBatchRun(model: string, datasetPath: string, config: BatchConfig = {}): Promise<BatchRunStatus> {
    // Load puzzles from dataset
    const puzzles = await this.loadPuzzlesFromDataset(datasetPath);
    if (puzzles.length === 0) {
      throw new Error(`No puzzles found in dataset: ${datasetPath}`);
    }

    // Apply default configuration
    const fullConfig: BatchConfig = {
      rateLimitDelayMs: 3000,
      maxRetries: 3,
      timeoutPerPuzzleMs: 300000,
      concurrency: 1,
      promptId: 'solver',
      temperature: 0.2,
      captureReasoning: true,
      omitAnswer: true,
      systemPromptMode: 'ARC',
      // GPT-5 reasoning defaults
      reasoningEffort: 'low',
      reasoningVerbosity: 'low', 
      reasoningSummaryType: 'auto',
      ...config
    };

    // Create batch run record
    const batchRun = await dbService.createBatchRun(model, datasetPath, puzzles.length, fullConfig);
    if (!batchRun) {
      throw new Error('Failed to create batch run record');
    }

    // Start processing asynchronously
    this.processBatchRun(batchRun.id, puzzles, model, fullConfig).catch(error => {
      logger.error(`Batch run ${batchRun.id} failed: ${error.message}`, 'batch');
      this.markBatchRunError(batchRun.id, error.message);
    });

    return this.formatBatchRunStatus(batchRun);
  }

  /**
   * Get current status of a batch run
   */
  async getBatchRunStatus(batchId: number): Promise<BatchRunStatus | null> {
    const batchRun = await dbService.getBatchRun(batchId);
    if (!batchRun) {
      return null;
    }

    const status = this.formatBatchRunStatus(batchRun);
    
    // Add real-time info for running batches
    const activeRun = activeBatchRuns.get(batchId);
    if (activeRun) {
      status.currentPuzzle = activeRun.currentPuzzle;
      
      // Calculate estimated time remaining
      if (status.processedCount > 0 && status.totalProcessingTimeMs > 0) {
        const avgTimePerPuzzle = status.totalProcessingTimeMs / status.processedCount;
        const remainingPuzzles = status.totalPuzzles - status.processedCount;
        status.estimatedTimeRemainingMs = Math.round(avgTimePerPuzzle * remainingPuzzles);
      }
    }

    return status;
  }

  /**
   * Stop a running batch
   */
  async stopBatchRun(batchId: number): Promise<boolean> {
    const activeRun = activeBatchRuns.get(batchId);
    if (!activeRun) {
      return false;
    }

    // Signal the batch to stop
    activeRun.shouldStop = true;
    
    // Update database status
    await dbService.updateBatchRun(batchId, {
      status: 'stopped',
      completed_at: new Date()
    });

    // Broadcast stop notification
    broadcast(`batch-${batchId}`, {
      status: 'stopped',
      message: 'Batch run stopped by user request'
    });

    return true;
  }

  /**
   * List batch runs with optional filtering
   */
  async listBatchRuns(filters: {
    limit?: number;
    offset?: number;
    status?: string;
    model?: string;
  } = {}): Promise<BatchRunStatus[]> {
    const batchRuns = await dbService.getAllBatchRuns(filters.limit, filters.offset);
    
    return batchRuns
      .filter(run => {
        if (filters.status && run.status !== filters.status) return false;
        if (filters.model && run.model !== filters.model) return false;
        return true;
      })
      .map(run => this.formatBatchRunStatus(run));
  }

  /**
   * Get detailed results for a batch run
   */
  async getBatchResults(batchId: number): Promise<BatchResult[]> {
    const results = await dbService.getBatchResults(batchId);
    
    return results.map(result => ({
      puzzleId: result.puzzle_id,
      success: result.success,
      accuracyScore: result.accuracy_score,
      processingTimeMs: result.processing_time_ms,
      errorMessage: result.error_message,
      explanationId: result.explanation_id
    }));
  }

  /**
   * Core batch processing loop
   */
  private async processBatchRun(
    batchId: number,
    puzzles: string[],
    model: string,
    config: BatchConfig
  ): Promise<void> {
    // Register as active batch run
    activeBatchRuns.set(batchId, { shouldStop: false });
    
    const startTime = Date.now();
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let totalProcessingTime = 0;
    let totalAccuracyScore = 0;
    let accuracyScoreCount = 0;

    try {
      logger.info(`Starting batch processing: ${puzzles.length} puzzles with model ${model}`, 'batch');

      for (let i = 0; i < puzzles.length; i++) {
        const puzzleId = puzzles[i];
        const activeRun = activeBatchRuns.get(batchId);
        
        // Check if batch was stopped
        if (activeRun?.shouldStop) {
          logger.info(`Batch ${batchId} stopped at puzzle ${i + 1}/${puzzles.length}`, 'batch');
          break;
        }

        // Update current puzzle
        if (activeRun) {
          activeRun.currentPuzzle = puzzleId;
        }

        // Broadcast progress
        broadcast(`batch-${batchId}`, {
          status: 'running',
          progress: Math.round((i / puzzles.length) * 100),
          processedCount: i,
          totalPuzzles: puzzles.length,
          currentPuzzle: puzzleId,
          successCount,
          errorCount,
          message: `Processing puzzle ${i + 1}/${puzzles.length}: ${puzzleId}`
        });

        // Process single puzzle with retries
        const puzzleResult = await this.processSinglePuzzle(
          puzzleId,
          model,
          config,
          batchId
        );

        // Update counters
        processedCount++;
        totalProcessingTime += puzzleResult.processingTimeMs;
        
        if (puzzleResult.success) {
          successCount++;
          if (puzzleResult.accuracyScore !== null) {
            totalAccuracyScore += puzzleResult.accuracyScore;
            accuracyScoreCount++;
          }
        } else {
          errorCount++;
        }

        // Rate limiting delay
        if (config.rateLimitDelayMs && config.rateLimitDelayMs > 0) {
          await this.delay(config.rateLimitDelayMs);
        }

        // Update database progress every 10 puzzles
        if (processedCount % 10 === 0 || processedCount === puzzles.length) {
          await dbService.updateBatchRun(batchId, {
            processed_count: processedCount,
            success_count: successCount,
            error_count: errorCount,
            average_accuracy: accuracyScoreCount > 0 ? totalAccuracyScore / accuracyScoreCount : undefined,
            total_processing_time_ms: totalProcessingTime
          });
        }
      }

      // Mark as completed
      await dbService.updateBatchRun(batchId, {
        status: 'completed',
        completed_at: new Date(),
        processed_count: processedCount,
        success_count: successCount,
        error_count: errorCount,
        average_accuracy: accuracyScoreCount > 0 ? totalAccuracyScore / accuracyScoreCount : undefined,
        total_processing_time_ms: totalProcessingTime
      });

      // Final broadcast
      broadcast(`batch-${batchId}`, {
        status: 'completed',
        progress: 100,
        processedCount,
        totalPuzzles: puzzles.length,
        successCount,
        errorCount,
        averageAccuracy: accuracyScoreCount > 0 ? totalAccuracyScore / accuracyScoreCount : null,
        totalProcessingTimeMs: totalProcessingTime,
        message: `Batch completed: ${successCount}/${processedCount} successful`
      });

      logger.info(`Batch ${batchId} completed: ${successCount}/${processedCount} successful in ${Date.now() - startTime}ms`, 'batch');

    } catch (error) {
      logger.error(`Batch ${batchId} failed: ${error instanceof Error ? error.message : String(error)}`, 'batch');
      await this.markBatchRunError(batchId, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      // Cleanup
      activeBatchRuns.delete(batchId);
    }
  }

  /**
   * Process a single puzzle with retry logic
   */
  private async processSinglePuzzle(
    puzzleId: string,
    model: string,
    config: BatchConfig,
    batchId: number
  ): Promise<BatchResult> {
    const maxRetries = config.maxRetries || 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        // Load puzzle
        const puzzle = await puzzleService.getPuzzleById(puzzleId);
        const aiService = aiServiceFactory.getService(model);

        // Build options object matching PuzzleExaminer's request format
        const options = {
          omitAnswer: config.omitAnswer,
          systemPromptMode: config.systemPromptMode || 'ARC',
          ...(config.emojiSetKey ? { emojiSetKey: config.emojiSetKey } : {})
        };
        
        // Build service options for GPT-5 reasoning models
        const serviceOpts = {
          ...(config.reasoningEffort ? { reasoningEffort: config.reasoningEffort } : {}),
          ...(config.reasoningVerbosity ? { reasoningVerbosity: config.reasoningVerbosity } : {}),
          ...(config.reasoningSummaryType ? { reasoningSummaryType: config.reasoningSummaryType } : {})
        };

        // Call AI service with same format as single puzzle analysis
        const result = await Promise.race([
          aiService.analyzePuzzleWithModel(
            puzzle,
            model,
            config.temperature || 0.2,
            config.captureReasoning || true,
            config.promptId || 'solver',
            config.customPrompt,
            options,
            serviceOpts
          ),
          this.createTimeoutPromise(config.timeoutPerPuzzleMs || 300000)
        ]);

        const processingTime = Date.now() - startTime;

        // Validate solver response
        const testCount = puzzle.test?.length || 0;
        let accuracyScore: number | null = null;
        let success = false;

        if (testCount > 1) {
          const correctAnswers = puzzle.test.map(t => t.output);
          const validation = validateSolverResponseMulti(result, correctAnswers, config.promptId || 'solver', result.confidence || 50);
          accuracyScore = validation.averageAccuracyScore || null;
          success = validation.allCorrect || false;
        } else if (testCount === 1) {
          const correctAnswer = puzzle.test[0].output;
          const validation = validateSolverResponse(result, correctAnswer, config.promptId || 'solver', result.confidence || 50);
          accuracyScore = validation.predictionAccuracyScore || null;
          success = validation.isPredictionCorrect || false;
        }

        // Store result in database
        await dbService.addBatchResult(
          batchId,
          puzzleId,
          result.explanationId || null,
          processingTime,
          accuracyScore,
          success,
          null
        );

        return {
          puzzleId,
          success,
          accuracyScore,
          processingTimeMs: processingTime,
          errorMessage: null,
          explanationId: result.explanationId || null
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Puzzle ${puzzleId} attempt ${attempt}/${maxRetries} failed: ${lastError.message}`, 'batch');
        
        if (attempt < maxRetries) {
          // Exponential backoff for retries
          await this.delay(1000 * Math.pow(2, attempt - 1));
        }
      }
    }

    // All retries failed
    const errorMessage = lastError?.message || 'Unknown error after all retries';
    
    await dbService.addBatchResult(
      batchId,
      puzzleId,
      null,
      0,
      null,
      false,
      errorMessage
    );

    return {
      puzzleId,
      success: false,
      accuracyScore: null,
      processingTimeMs: 0,
      errorMessage,
      explanationId: null
    };
  }

  /**
   * Load puzzle IDs from a dataset directory
   */
  private async loadPuzzlesFromDataset(datasetPath: string): Promise<string[]> {
    const fullPath = path.resolve(process.cwd(), datasetPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Dataset path does not exist: ${fullPath}`);
    }

    const files = fs.readdirSync(fullPath);
    const puzzleIds = files
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'))
      .sort();

    logger.info(`Loaded ${puzzleIds.length} puzzles from ${datasetPath}`, 'batch');
    return puzzleIds;
  }

  /**
   * Mark batch run as errored
   */
  private async markBatchRunError(batchId: number, errorMessage: string): Promise<void> {
    await dbService.updateBatchRun(batchId, {
      status: 'error',
      completed_at: new Date()
    });

    broadcast(`batch-${batchId}`, {
      status: 'error',
      message: `Batch failed: ${errorMessage}`
    });
  }

  /**
   * Format database batch run for API response
   */
  private formatBatchRunStatus(dbRun: any): BatchRunStatus {
    return {
      id: dbRun.id,
      status: dbRun.status,
      model: dbRun.model,
      datasetPath: dbRun.dataset_path,
      totalPuzzles: dbRun.total_puzzles,
      processedCount: dbRun.processed_count,
      successCount: dbRun.success_count,
      errorCount: dbRun.error_count,
      averageAccuracy: dbRun.average_accuracy,
      totalProcessingTimeMs: dbRun.total_processing_time_ms,
      createdAt: dbRun.created_at,
      completedAt: dbRun.completed_at,
      config: typeof dbRun.config === 'string' ? JSON.parse(dbRun.config) : dbRun.config || {}
    };
  }

  /**
   * Promise-based delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create timeout promise for puzzle processing
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Puzzle processing timed out after ${timeoutMs}ms`)), timeoutMs);
    });
  }
}

export const batchService = new BatchService();
