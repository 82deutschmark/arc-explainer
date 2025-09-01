/**
 * BatchQueueManager.ts
 * 
 * Handles puzzle queue management and batch processing workflow coordination.
 * Responsible for managing processing queues, concurrency limits, and batch orchestration.
 * Follows Single Responsibility Principle by focusing only on queue and workflow management.
 * 
 * @author Claude Code
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';
import { batchResultProcessor } from './BatchResultProcessor.js';
import { batchProgressTracker } from './BatchProgressTracker.js';
import type { BatchSessionConfig } from './BatchSessionManager.js';

export interface QueueStatus {
  sessionId: string;
  total: number;
  remaining: number;
  inProgress: number;
  completed: number;
}

export class BatchQueueManager extends EventEmitter {
  private sessionQueues: Map<string, string[]> = new Map();
    private processingStatus: Map<string, 'pending' | 'running' | 'paused' | 'cancelled' | 'completed' | 'error'> = new Map();
  private readonly MAX_CONCURRENT_SESSIONS = 3;
  private readonly DEFAULT_BATCH_SIZE = 10;
  private readonly BATCH_DELAY_MS = 1000; // Delay between batches

  /**
   * Initialize queue for a batch session
   */
  initializeQueue(sessionId: string, puzzleIds: string[]): void {
    this.sessionQueues.set(sessionId, [...puzzleIds]); // Create copy
    this.processingStatus.set(sessionId, 'pending');
    
    logger.info(`Initialized queue for session ${sessionId} with ${puzzleIds.length} puzzles`, 'batch-queue');
  }

  /**
   * Start processing queue for a session
   */
  async startProcessing(sessionId: string, config: BatchSessionConfig): Promise<boolean> {
    const queue = this.sessionQueues.get(sessionId);
    if (!queue) {
      logger.error(`No queue found for session ${sessionId}`, 'batch-queue');
      return false;
    }

    const status = this.processingStatus.get(sessionId);
    if (status === 'running') {
      logger.warn(`Session ${sessionId} is already running`, 'batch-queue');
      return false;
    }

    // Check concurrent session limit
    if (this.getActiveSessionCount() >= this.MAX_CONCURRENT_SESSIONS) {
      logger.warn(`Cannot start session ${sessionId} - concurrent session limit reached (${this.MAX_CONCURRENT_SESSIONS})`, 'batch-queue');
      return false;
    }

    this.processingStatus.set(sessionId, 'running');
    
    // Start processing without waiting
    this.processQueueAsync(sessionId, config);
    
    logger.info(`Started processing queue for session ${sessionId}`, 'batch-queue');
    return true;
  }

  /**
   * Pause processing for a session
   */
  pauseProcessing(sessionId: string): boolean {
    const status = this.processingStatus.get(sessionId);
    if (status === 'running') {
      this.processingStatus.set(sessionId, 'paused');
      logger.info(`Paused processing for session ${sessionId}`, 'batch-queue');
      this.emit('session-paused', sessionId);
      return true;
    }
    return false;
  }

  /**
   * Resume processing for a session
   */
  async resumeProcessing(sessionId: string, config: BatchSessionConfig): Promise<boolean> {
    const status = this.processingStatus.get(sessionId);
    if (status === 'paused') {
      this.processingStatus.set(sessionId, 'running');
      
      // Resume processing
      this.processQueueAsync(sessionId, config);
      
      logger.info(`Resumed processing for session ${sessionId}`, 'batch-queue');
      this.emit('session-resumed', sessionId);
      return true;
    }
    return false;
  }

  /**
   * Cancel processing for a session
   */
  cancelProcessing(sessionId: string): boolean {
    const status = this.processingStatus.get(sessionId);
    if (['running', 'paused', 'pending'].includes(status || '')) {
      this.processingStatus.set(sessionId, 'cancelled');
      logger.info(`Cancelled processing for session ${sessionId}`, 'batch-queue');
      this.emit('session-cancelled', sessionId);
      return true;
    }
    return false;
  }

  /**
   * Get queue status for a session
   */
  getQueueStatus(sessionId: string): QueueStatus | null {
    const queue = this.sessionQueues.get(sessionId);
    if (!queue) {
      return null;
    }

    const status = this.processingStatus.get(sessionId);
    const total = queue.length;
    const remaining = queue.length;
    
    return {
      sessionId,
      total,
      remaining,
      inProgress: status === 'running' ? 1 : 0,
      completed: 0 // This would need to be calculated from progress tracker
    };
  }

  /**
   * Clean up session resources
   */
  cleanup(sessionId: string): void {
    this.sessionQueues.delete(sessionId);
    this.processingStatus.delete(sessionId);
    logger.info(`Cleaned up resources for session ${sessionId}`, 'batch-queue');
  }

  /**
   * Get number of active sessions
   */
  getActiveSessionCount(): number {
    let count = 0;
    for (const status of this.processingStatus.values()) {
      if (['running', 'pending'].includes(status)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Check if session can be started (under concurrent limit)
   */
  canStartSession(): boolean {
    return this.getActiveSessionCount() < this.MAX_CONCURRENT_SESSIONS;
  }

  /**
   * Process queue asynchronously
   */
  private async processQueueAsync(sessionId: string, config: BatchSessionConfig): Promise<void> {
    try {
      logger.info(`Starting async queue processing for session ${sessionId}`, 'batch-queue');
      
      const queue = this.sessionQueues.get(sessionId);
      if (!queue) {
        logger.error(`Queue not found for session ${sessionId}`, 'batch-queue');
        return;
      }

      this.emit('session-started', sessionId);

      const batchSize = config.batchSize || this.DEFAULT_BATCH_SIZE;

      // Process puzzles in batches
      while (queue.length > 0 && this.processingStatus.get(sessionId) === 'running') {
        const batch = queue.splice(0, Math.min(batchSize, queue.length));
        
        logger.info(`Processing batch of ${batch.length} puzzles for session ${sessionId}`, 'batch-queue');
        
        // Process batch using BatchResultProcessor
        const batchResults = await batchResultProcessor.processBatch(sessionId, batch, config);
        
        // Update progress for each result
        for (const result of batchResults) {
          await batchProgressTracker.updateProgress(
            sessionId, 
            result.puzzleId, 
            result.success, 
            result.processingTime
          );
          
          // Emit individual puzzle completion
          this.emit('puzzle-completed', {
            sessionId,
            puzzleId: result.puzzleId,
            success: result.success,
            processingTime: result.processingTime
          });
        }

        // Get updated progress and emit
        const currentProgress = await batchProgressTracker.getProgress(sessionId);
        if (currentProgress) {
          this.emit('session-progress', { sessionId, progress: currentProgress });
        }

        // Delay between batches to prevent API overload
        if (queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY_MS));
        }
      }

      // Check if session completed or was cancelled
      const finalStatus = this.processingStatus.get(sessionId);
      if (finalStatus === 'running' && queue.length === 0) {
        // Session completed successfully
        this.processingStatus.set(sessionId, 'completed');
        logger.info(`Queue processing completed for session ${sessionId}`, 'batch-queue');
        this.emit('session-completed', sessionId);
      } else if (finalStatus === 'cancelled') {
        logger.info(`Queue processing cancelled for session ${sessionId}`, 'batch-queue');
      }

    } catch (error) {
      logger.error(`Error in queue processing for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`, 'batch-queue');
      this.processingStatus.set(sessionId, 'error');
      this.emit('session-error', { sessionId, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export const batchQueueManager = new BatchQueueManager();