/**
 * batchAnalysisService.ts
 * 
 * Refactored orchestration service for batch analysis operations.
 * Now focuses on coordinating modular components rather than handling all logic directly.
 * Follows Single Responsibility Principle with significantly reduced complexity.
 * 
 * @author Claude Code (refactored from original 633-line monolith)
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { batchSessionManager, type BatchSessionConfig } from './batch/BatchSessionManager.js';
import { batchProgressTracker, type BatchProgress } from './batch/BatchProgressTracker.js';
import { batchQueueManager } from './batch/BatchQueueManager.js';
import { repositoryService } from '../repositories/RepositoryService.js';

class BatchAnalysisService extends EventEmitter {
  private readonly MAX_CONCURRENT_SESSIONS = 3;

  /**
   * Start a new batch analysis session
   */
  async startBatchAnalysis(config: BatchSessionConfig): Promise<{ sessionId: string; error?: string }> {
    try {
      logger.info(`Starting batch analysis for model ${config.modelKey} on dataset ${config.dataset}`, 'batch-service');

      // Create session using SessionManager
      const sessionResult = await batchSessionManager.createSession(config);
      
      if (!sessionResult.success || !sessionResult.sessionInfo) {
        return { sessionId: '', error: sessionResult.error || 'Failed to create session' };
      }

      const { sessionId, puzzleIds } = sessionResult.sessionInfo;

      // Initialize queue with puzzle IDs
      batchQueueManager.initializeQueue(sessionId, puzzleIds);

      // Set up event forwarding from queue manager
      this.setupEventForwarding(sessionId);

      // Start processing if within concurrent limits
      if (batchQueueManager.canStartSession()) {
        const started = await batchQueueManager.startProcessing(sessionId, config);
        if (started) {
          await batchSessionManager.updateSessionStatus(sessionId, 'running', { startedAt: new Date() });
        }
      } else {
        logger.info(`Session ${sessionId} queued - concurrent session limit reached`, 'batch-service');
        await batchSessionManager.updateSessionStatus(sessionId, 'pending');
      }

      logger.info(`Batch analysis session ${sessionId} created successfully`, 'batch-service');
      return { sessionId };

    } catch (error) {
      logger.error(`Error starting batch analysis: ${error instanceof Error ? error.message : String(error)}`, 'batch-service');
      return { sessionId: '', error: 'Failed to start batch analysis' };
    }
  }

  /**
   * Get status of a batch analysis session
   */
  async getBatchStatus(sessionId: string): Promise<BatchProgress | null> {
    try {
      return await batchProgressTracker.getProgress(sessionId);
    } catch (error) {
      logger.error(`Error getting batch status for ${sessionId}: ${error instanceof Error ? error.message : String(error)}`, 'batch-service');
      return null;
    }
  }

  /**
   * Control batch analysis session (pause, resume, cancel)
   */
  async controlBatchSession(sessionId: string, action: 'pause' | 'resume' | 'cancel'): Promise<boolean> {
    try {
      logger.info(`Controlling batch session ${sessionId}: ${action}`, 'batch-service');

      let success = false;

      switch (action) {
        case 'pause':
          success = batchQueueManager.pauseProcessing(sessionId);
          if (success) {
            await batchSessionManager.updateSessionStatus(sessionId, 'paused');
            this.emit('session-paused', sessionId);
          }
          break;

        case 'resume':
          const config = await batchSessionManager.getSessionConfig(sessionId);
          if (config) {
            success = await batchQueueManager.resumeProcessing(sessionId, config);
            if (success) {
              await batchSessionManager.updateSessionStatus(sessionId, 'running');
              this.emit('session-resumed', sessionId);
            }
          }
          break;

        case 'cancel':
          success = batchQueueManager.cancelProcessing(sessionId);
          if (success) {
            await batchSessionManager.updateSessionStatus(sessionId, 'cancelled', { completedAt: new Date() });
            batchQueueManager.cleanup(sessionId);
            this.emit('session-cancelled', sessionId);
          }
          break;
      }

      return success;
    } catch (error) {
      logger.error(`Error controlling batch session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`, 'batch-service');
      return false;
    }
  }

  /**
   * Get detailed results for a batch session
   */
  async getBatchResults(sessionId: string) {
    try {
      return await repositoryService.batchAnalysis.getBatchResults(sessionId);
    } catch (error) {
      logger.error(`Error getting batch results for ${sessionId}: ${error instanceof Error ? error.message : String(error)}`, 'batch-service');
      return [];
    }
  }

  /**
   * Get list of all batch sessions (for admin/overview)
   */
  async getAllSessions() {
    try {
      return await repositoryService.batchAnalysis.getAllBatchSessions();
    } catch (error) {
      logger.error(`Error getting all batch sessions: ${error instanceof Error ? error.message : String(error)}`, 'batch-service');
      return [];
    }
  }

  /**
   * Clean up completed or old sessions
   */
  async cleanupOldSessions(maxAgeHours: number = 24): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      
      // Get old completed/cancelled sessions
      const allSessions = await repositoryService.batchAnalysis.getAllBatchSessions();
      const oldSessions = allSessions.filter((session: any) => 
        ['completed', 'cancelled', 'error'].includes(session.status) &&
        new Date(session.completedAt || session.createdAt) < cutoffTime
      );

      // Clean up queue manager resources
      for (const session of oldSessions) {
        batchQueueManager.cleanup(session.sessionId);
        batchProgressTracker.invalidateCache(session.sessionId);
      }

      logger.info(`Cleaned up ${oldSessions.length} old batch sessions`, 'batch-service');
      return oldSessions.length;
    } catch (error) {
      logger.error(`Error cleaning up old sessions: ${error instanceof Error ? error.message : String(error)}`, 'batch-service');
      return 0;
    }
  }

  /**
   * Set up event forwarding from queue manager to this service
   */
  private setupEventForwarding(sessionId: string): void {
    // Forward key events from queue manager to service consumers
    batchQueueManager.on('session-started', (startedSessionId) => {
      if (startedSessionId === sessionId) {
        this.emit('session-started', { sessionId });
      }
    });

    batchQueueManager.on('session-progress', (data) => {
      if (data.sessionId === sessionId) {
        this.emit('session-progress', data);
      }
    });

    batchQueueManager.on('session-completed', (completedSessionId) => {
      if (completedSessionId === sessionId) {
        batchSessionManager.updateSessionStatus(sessionId, 'completed', { completedAt: new Date() });
        batchQueueManager.cleanup(sessionId);
        this.emit('session-completed', { sessionId });
      }
    });

    batchQueueManager.on('session-error', (data) => {
      if (data.sessionId === sessionId) {
        batchSessionManager.updateSessionStatus(sessionId, 'error');
        this.emit('session-error', data);
      }
    });

    batchQueueManager.on('puzzle-completed', (data) => {
      if (data.sessionId === sessionId) {
        this.emit('puzzle-completed', data);
      }
    });
  }
}

export const batchAnalysisService = new BatchAnalysisService();