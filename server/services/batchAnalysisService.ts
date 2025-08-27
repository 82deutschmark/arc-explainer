/**
 * batchAnalysisService.ts
 * 
 * Service for managing batch analysis operations.
 * Handles batch processing of puzzles with AI models, progress tracking, and result management.
 * 
 * @author Claude Code Assistant
 */

import { repositoryService } from '../repositories/RepositoryService';
import { puzzleService } from './puzzleService';
import { aiServiceFactory } from './aiServiceFactory';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { PromptOptions } from './promptBuilder';

interface BatchSessionConfig {
  modelKey: string;
  dataset: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'All';
  promptId?: string;
  customPrompt?: string;
  temperature?: number;
  reasoningEffort?: string;
  reasoningVerbosity?: string;
  reasoningSummaryType?: string;
  batchSize?: number;
}

interface BatchProgress {
  sessionId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';
  progress: {
    total: number;
    completed: number;
    successful: number;
    failed: number;
    percentage: number;
  };
  stats: {
    averageProcessingTime: number;
    overallAccuracy: number;
    eta: number;
  };
  startTime?: number;
  endTime?: number;
}

interface BatchResult {
  puzzleId: string;
  status: 'pending' | 'completed' | 'failed';
  explanation?: any;
  processingTime?: number;
  accuracy?: number;
  isCorrect?: boolean;
  error?: string;
}

class BatchAnalysisService extends EventEmitter {
  private activeSessions: Map<string, BatchProgress> = new Map();
  private sessionQueues: Map<string, string[]> = new Map();
  private processingTimers: Map<string, number> = new Map();
  private readonly MAX_CONCURRENT_SESSIONS = 3;
  private readonly DEFAULT_BATCH_SIZE = 10;

  /**
   * Start a new batch analysis session
   */
  async startBatchAnalysis(config: BatchSessionConfig): Promise<{ sessionId: string; error?: string }> {
    try {
      const sessionId = randomUUID();
      logger.info(`Starting batch analysis session ${sessionId} for model ${config.modelKey} on dataset ${config.dataset}`, 'batch-analysis');

      // Get puzzles for the selected dataset
      logger.info(`Fetching puzzles for dataset: ${config.dataset}`, 'batch-analysis');
      const puzzles = await this.getPuzzlesForDataset(config.dataset);
      logger.info(`Found ${puzzles.length} puzzles for dataset ${config.dataset}`, 'batch-analysis');
      
      if (puzzles.length === 0) {
        logger.error(`FAILED: No puzzles found for dataset ${config.dataset} - NOT adding session to activeSessions`, 'batch-analysis');
        return { sessionId: '', error: 'No puzzles found for selected dataset' };
      }

      // Check database connection before creating session
      logger.info(`Checking database connection status`, 'batch-analysis');
      try {
        await repositoryService.batchAnalysis.getBatchSession('test-connection');
      } catch (error) {
        logger.error(`FAILED: Database not connected when trying to create session ${sessionId} - NOT adding session to activeSessions`, 'batch-analysis');
        return { sessionId: '', error: 'Database connection not available' };
      }

      // Create database session record
      logger.info(`Creating database session for ${sessionId}`, 'batch-analysis');
      const sessionCreated = await repositoryService.batchAnalysis.createBatchSession({
        sessionId,
        modelKey: config.modelKey,
        dataset: config.dataset,
        promptId: config.promptId,
        customPrompt: config.customPrompt,
        temperature: config.temperature,
        reasoningEffort: config.reasoningEffort,
        reasoningVerbosity: config.reasoningVerbosity,
        reasoningSummaryType: config.reasoningSummaryType,
        totalPuzzles: puzzles.length
      });

      if (!sessionCreated) {
        logger.error(`FAILED: Failed to create database session for ${sessionId} - database operation returned false - NOT adding session to activeSessions`, 'batch-analysis');
        return { sessionId: '', error: 'Failed to create database session' };
      }
      logger.info(`Database session created successfully for ${sessionId}`, 'batch-analysis');

      // Initialize progress tracking
      const progress: BatchProgress = {
        sessionId,
        status: 'pending',
        progress: {
          total: puzzles.length,
          completed: 0,
          successful: 0,
          failed: 0,
          percentage: 0
        },
        stats: {
          averageProcessingTime: 0,
          overallAccuracy: 0,
          eta: 0
        }
      };

      this.activeSessions.set(sessionId, progress);
      this.sessionQueues.set(sessionId, puzzles.map(p => p.id));
      logger.info(`SUCCESS: Session ${sessionId} added to activeSessions with ${puzzles.length} puzzles`, 'batch-analysis');

      // Create batch result records for all puzzles
      for (const puzzle of puzzles) {
        await repositoryService.batchAnalysis.createBatchResult({
          sessionId,
          puzzleId: puzzle.id,
          status: 'pending'
        });
      }

      // Start processing if we haven't hit concurrent limit
      if (this.getActiveSessionCount() <= this.MAX_CONCURRENT_SESSIONS) {
        this.processBatchSession(sessionId, config);
      }

      logger.info(`SUCCESS: Batch analysis session ${sessionId} fully initialized and ready`, 'batch-analysis');
      return { sessionId };

    } catch (error) {
      logger.error(`EXCEPTION: Error starting batch analysis: ${error instanceof Error ? error.message : String(error)}`, 'batch-analysis');
      return { sessionId: '', error: 'Failed to start batch analysis' };
    }
  }

  /**
   * Get status of a batch analysis session
   * Queries database as primary source of truth
   */
  async getBatchStatus(sessionId: string): Promise<BatchProgress | null> {
    logger.info(`Fetching batch status for session ${sessionId} from database`, 'batch-analysis');
    
    try {
      const sessionData = await repositoryService.batchAnalysis.getBatchSession(sessionId);
      if (!sessionData) {
        logger.warn(`Session ${sessionId} not found in database`, 'batch-analysis');
        return null;
      }

      // Get session stats from repository
      const stats = await repositoryService.batchAnalysis.getBatchSessionStats(sessionId);
      const totalPuzzles = sessionData.totalPuzzles || 0;
      const completedPuzzles = stats.completedCount || 0;
      const successfulPuzzles = stats.successCount || 0;
      const failedPuzzles = stats.errorCount || 0;

      const progress: BatchProgress = {
        sessionId,
        status: sessionData.status as any || 'pending',
        progress: {
          total: totalPuzzles,
          completed: completedPuzzles,
          successful: successfulPuzzles, 
          failed: failedPuzzles,
          percentage: totalPuzzles > 0 
            ? Math.round((completedPuzzles / totalPuzzles) * 100)
            : 0
        },
        stats: {
          averageProcessingTime: stats.averageProcessingTime || 0,
          overallAccuracy: successfulPuzzles > 0 
            ? Math.round((successfulPuzzles / Math.max(completedPuzzles, 1)) * 100)
            : 0,
          eta: 0 // ETA calculation would need in-memory processing state
        },
        startTime: sessionData.createdAt ? new Date(sessionData.createdAt).getTime() : Date.now(),
        endTime: sessionData.completedAt ? new Date(sessionData.completedAt).getTime() : undefined
      };

      logger.info(`Database session ${sessionId}: ${progress.status} - ${progress.progress.completed}/${progress.progress.total} puzzles (${progress.progress.percentage}%)`, 'batch-analysis');
      return progress;
    } catch (error) {
      logger.error(`Error fetching session ${sessionId} from database: ${error instanceof Error ? error.message : String(error)}`, 'batch-analysis');
      return null;
    }
  }

  /**
   * Control batch analysis session (pause, resume, cancel)
   */
  async controlBatchSession(sessionId: string, action: 'pause' | 'resume' | 'cancel'): Promise<boolean> {
    const progress = this.activeSessions.get(sessionId);
    if (!progress) {
      logger.warn(`Batch session ${sessionId} not found for action ${action}`, 'batch-analysis');
      return false;
    }

    logger.info(`Controlling batch session ${sessionId}: ${action}`, 'batch-analysis');

    switch (action) {
      case 'pause':
        if (progress.status === 'running') {
          progress.status = 'paused';
          await repositoryService.batchAnalysis.updateBatchSession(sessionId, { status: 'paused' });
          this.emit('session-paused', sessionId);
          return true;
        }
        break;

      case 'resume':
        if (progress.status === 'paused') {
          progress.status = 'running';
          await repositoryService.batchAnalysis.updateBatchSession(sessionId, { status: 'running' });
          // Resume processing
          this.processBatchSession(sessionId, await this.getSessionConfig(sessionId));
          this.emit('session-resumed', sessionId);
          return true;
        }
        break;

      case 'cancel':
        if (['running', 'paused', 'pending'].includes(progress.status)) {
          progress.status = 'cancelled';
          progress.endTime = Date.now();
          await repositoryService.batchAnalysis.updateBatchSession(sessionId, { 
            status: 'cancelled',
            completedAt: new Date()
          });
          this.cleanup(sessionId);
          this.emit('session-cancelled', sessionId);
          return true;
        }
        break;
    }

    return false;
  }

  /**
   * Get detailed results for a batch session
   */
  async getBatchResults(sessionId: string) {
    return await repositoryService.batchAnalysis.getBatchResults(sessionId);
  }

  /**
   * Process a batch analysis session
   */
  private async processBatchSession(sessionId: string, config: BatchSessionConfig | null) {
    if (!config) {
      config = await this.getSessionConfig(sessionId);
      if (!config) return;
    }

    const progress = this.activeSessions.get(sessionId);
    if (!progress || progress.status === 'cancelled') return;

    progress.status = 'running';
    progress.startTime = Date.now();
    
    await repositoryService.batchAnalysis.updateBatchSession(sessionId, { 
      status: 'running',
      startedAt: new Date()
    });

    logger.info(`Processing batch session ${sessionId} with ${progress.progress.total} puzzles`, 'batch-analysis');
    this.emit('session-started', { sessionId, progress });

    const queue = this.sessionQueues.get(sessionId) || [];
    const batchSize = config.batchSize || this.DEFAULT_BATCH_SIZE;
    const processingTimes: number[] = [];

    // Process puzzles in batches
    while (queue.length > 0 && progress.status === 'running') {
      const batch = queue.splice(0, Math.min(batchSize, queue.length));
      
      // Process batch concurrently
      const batchPromises = batch.map(puzzleId => 
        this.processSinglePuzzle(sessionId, puzzleId, config!)
      );

      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Update progress based on batch results
        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i];
          const puzzleId = batch[i];

          progress.progress.completed++;
          
          if (result.status === 'fulfilled' && result.value.success) {
            progress.progress.successful++;
            if (result.value.processingTime) {
              processingTimes.push(result.value.processingTime);
            }
            
            await repositoryService.batchAnalysis.updateBatchResult(sessionId, puzzleId, {
              status: 'completed',
              explanationId: result.value.explanationId,
              processingTimeMs: result.value.processingTime,
              completedAt: new Date()
            });
            
          } else {
            progress.progress.failed++;
            const error = result.status === 'rejected' ? result.reason.message : 'Unknown error';
            
            await repositoryService.batchAnalysis.updateBatchResult(sessionId, puzzleId, {
              status: 'failed',
              error: error,
              completedAt: new Date()
            });
          }
        }

        // Update statistics
        progress.progress.percentage = Math.round((progress.progress.completed / progress.progress.total) * 100);
        progress.stats.averageProcessingTime = processingTimes.length > 0 
          ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
          : 0;
        progress.stats.overallAccuracy = progress.progress.completed > 0 
          ? Math.round((progress.progress.successful / progress.progress.completed) * 100)
          : 0;
        
        // Calculate ETA
        if (processingTimes.length > 0) {
          const remainingPuzzles = progress.progress.total - progress.progress.completed;
          progress.stats.eta = Math.round((remainingPuzzles * progress.stats.averageProcessingTime) / 1000);
        }

        // Update database with progress
        await repositoryService.batchAnalysis.updateBatchSession(sessionId, {
          completedPuzzles: progress.progress.completed,
          successfulPuzzles: progress.progress.successful,
          failedPuzzles: progress.progress.failed,
          averageProcessingTime: progress.stats.averageProcessingTime
        });

        // Emit progress update
        this.emit('session-progress', { sessionId, progress });

        // Small delay between batches to prevent overwhelming APIs
        if (queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        logger.error(`Error processing batch for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`, 'batch-analysis');
        progress.status = 'error';
        await repositoryService.batchAnalysis.updateBatchSession(sessionId, { 
          status: 'error'
        });
        break;
      }
    }

    // Session complete
    if (progress.status === 'running') {
      progress.status = 'completed';
      progress.endTime = Date.now();
      
      await repositoryService.batchAnalysis.updateBatchSession(sessionId, { 
        status: 'completed',
        completedAt: new Date()
      });
      
      logger.info(`Batch session ${sessionId} completed: ${progress.progress.successful}/${progress.progress.total} successful`, 'batch-analysis');
      this.emit('session-completed', { sessionId, progress });
    }

    this.cleanup(sessionId);
  }

  /**
   * Process a single puzzle within a batch
   */
  private async processSinglePuzzle(sessionId: string, puzzleId: string, config: BatchSessionConfig): Promise<{
    success: boolean;
    explanationId?: number;
    processingTime?: number;
    accuracy?: number;
    isCorrect?: boolean;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      
      // Get puzzle data
      const puzzle = await puzzleService.getPuzzleById(puzzleId);
      if (!puzzle) {
        return { success: false, error: `Puzzle ${puzzleId} not found` };
      }

      // Get AI service
      logger.info(`Getting AI service for model: ${config.modelKey}`, 'batch-analysis');
      const aiService = aiServiceFactory.getService(config.modelKey);
      if (!aiService) {
        logger.error(`AI service for model ${config.modelKey} not available`, 'batch-analysis');
        return { success: false, error: `AI service for ${config.modelKey} not available` };
      }
      logger.info(`AI service retrieved successfully for ${config.modelKey}`, 'batch-analysis');

      // Build options for prompt
      const options: PromptOptions = {};
      
      // Build service options
      const serviceOpts: any = {};
      if (config.reasoningEffort) serviceOpts.reasoningEffort = config.reasoningEffort;
      if (config.reasoningVerbosity) serviceOpts.reasoningVerbosity = config.reasoningVerbosity;
      if (config.reasoningSummaryType) serviceOpts.reasoningSummaryType = config.reasoningSummaryType;

      // Analyze puzzle
      logger.info(`Starting AI analysis for puzzle ${puzzleId} with model ${config.modelKey}`, 'batch-analysis');
      const result = await aiService.analyzePuzzleWithModel(
        puzzle,
        config.modelKey,
        config.temperature || 0.2,
        true, // captureReasoning
        config.promptId || 'solver',
        config.customPrompt,
        options,
        serviceOpts
      );
      logger.info(`AI analysis completed for puzzle ${puzzleId}`, 'batch-analysis');

      const processingTime = Date.now() - startTime;

      // CRITICAL FIX: Preserve original AI response, add validation results separately
      // Don't modify result.result in-place - preserve the original AI response data
      let validationResults = {};
      
      if (config.promptId === "solver") {
        const { validateSolverResponse, validateSolverResponseMulti } = await import('./responseValidator');
        const { puzzleService } = await import('./puzzleService');
        
        try {
          const puzzle = await puzzleService.getPuzzleById(puzzleId);
          const confidence = result.result.confidence || 50;
          const testCount = puzzle.test?.length || 0;
          
          // Create validation results without modifying original response
          if (result.result.multiplePredictedOutputs === true) {
            // Multi-test case
            const correctAnswers = testCount > 1 ? puzzle.test.map((t: any) => t.output) : [puzzle.test[0].output];
            const multi = validateSolverResponseMulti(result.result, correctAnswers, config.promptId, confidence);

            validationResults = {
              predictedOutputGrid: null,
              hasMultiplePredictions: true,
              multiTestResults: multi.itemResults,
              multiTestAllCorrect: multi.allCorrect,
              multiTestAverageAccuracy: multi.averageAccuracyScore,
              extractionMethod: multi.extractionMethodSummary
            };
          } else {
            // Single-test case
            const correctAnswer = puzzle.test[0].output;
            const validation = validateSolverResponse(result.result, correctAnswer, config.promptId, confidence);

            validationResults = {
              predictedOutputGrid: validation.predictedGrid,
              hasMultiplePredictions: false,
              isPredictionCorrect: validation.isPredictionCorrect,
              predictionAccuracyScore: validation.predictionAccuracyScore,
              extractionMethod: validation.extractionMethod
            };
          }
        } catch (validationError) {
          console.error(`[BATCH-VALIDATION-ERROR] Validation failed for ${puzzleId}, preserving original response:`, validationError);
          // Continue with original response data if validation fails
        }
      }

      // Save explanation using proper service (ensures correct model name handling)
      const explanationToSave = {
        [config.modelKey]: { 
          ...result.result,    // Preserve original AI response 
          ...validationResults, // Add validation results separately
          modelKey: config.modelKey,
          actualProcessingTime: Math.round(processingTime / 1000)
        }
      };
      
      // Use explanationService to ensure proper model name recording
      const { explanationService } = await import('./explanationService');
      const saveResult = await explanationService.saveExplanation(puzzleId, explanationToSave);
      const explanationId = saveResult.explanationIds[0];
      
      if (!explanationId) {
        return { success: false, error: 'Failed to save explanation to database' };
      }

      return {
        success: true,
        explanationId,
        processingTime,
        accuracy: result.predictionAccuracyScore || result.multiTestAverageAccuracy,
        isCorrect: result.isPredictionCorrect || result.multiTestAllCorrect
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Get puzzles for a dataset
   */
  private async getPuzzlesForDataset(dataset: string) {
    const filters: any = {};
    
    switch (dataset) {
      case 'ARC1':
        filters.source = 'ARC1';
        break;
      case 'ARC1-Eval':
        filters.source = 'ARC1-Eval';
        break;
      case 'ARC2':
        filters.source = 'ARC2';
        break;
      case 'ARC2-Eval':
        filters.source = 'ARC2-Eval';
        break;
      case 'All':
        // No source filter for all datasets
        break;
      default:
        return [];
    }

    return await puzzleService.getPuzzleList(filters);
  }

  /**
   * Get session configuration from database
   */
  private async getSessionConfig(sessionId: string): Promise<BatchSessionConfig | null> {
    const session = await repositoryService.batchAnalysis.getBatchSession(sessionId);
    if (!session) return null;

    return {
      modelKey: session.modelKey,
      dataset: session.dataset as 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'All',
      promptId: session.promptId,
      customPrompt: session.customPrompt,
      temperature: session.temperature,
      reasoningEffort: session.reasoningEffort,
      reasoningVerbosity: session.reasoningVerbosity,
      reasoningSummaryType: session.reasoningSummaryType
    };
  }

  /**
   * Get count of active sessions
   */
  private getActiveSessionCount(): number {
    let count = 0;
    for (const progress of this.activeSessions.values()) {
      if (['running', 'pending'].includes(progress.status)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Cleanup session resources
   */
  private cleanup(sessionId: string) {
    this.sessionQueues.delete(sessionId);
    const timer = this.processingTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.processingTimers.delete(sessionId);
    }
    
    // Keep session in activeSessions for status queries
    // Will be cleaned up after some time by a scheduled cleanup process
  }
}

export const batchAnalysisService = new BatchAnalysisService();