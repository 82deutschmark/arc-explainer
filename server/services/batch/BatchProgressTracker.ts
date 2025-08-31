/**
 * BatchProgressTracker.ts
 * 
 * Handles real-time progress tracking and statistics calculation for batch analysis sessions.
 * Responsible for computing progress percentages, ETA, and performance metrics.
 * Follows Single Responsibility Principle by focusing only on progress calculation.
 * 
 * @author Claude Code
 */

import { repositoryService } from '../../repositories/RepositoryService.js';
import { logger } from '../../utils/logger.js';

export interface BatchProgress {
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

export interface BatchStats {
  completedCount: number;
  successCount: number;
  errorCount: number;
  averageProcessingTime: number;
}

export class BatchProgressTracker {
  private progressCache: Map<string, BatchProgress> = new Map();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds cache
  private lastCacheUpdate: Map<string, number> = new Map();

  /**
   * Get current progress for a batch session
   * Uses database as primary source of truth with intelligent caching
   */
  async getProgress(sessionId: string): Promise<BatchProgress | null> {
    try {
      // Check cache first
      const cached = this.getCachedProgress(sessionId);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const progress = await this.fetchProgressFromDatabase(sessionId);
      if (progress) {
        this.updateCache(sessionId, progress);
      }

      return progress;
    } catch (error) {
      logger.error(`Error fetching progress for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`, 'batch-progress');
      return null;
    }
  }

  /**
   * Update progress with new completion data
   * Used when individual puzzles complete
   */
  async updateProgress(sessionId: string, completedPuzzleId: string, success: boolean, processingTime?: number): Promise<BatchProgress | null> {
    try {
      // Update database first
      await repositoryService.batchAnalysis.updateBatchResult(sessionId, completedPuzzleId, {
        status: success ? 'completed' : 'failed',
        processingTimeMs: processingTime,
        completedAt: new Date()
      });

      // Invalidate cache to force fresh fetch
      this.invalidateCache(sessionId);

      // Return fresh progress
      return await this.getProgress(sessionId);
    } catch (error) {
      logger.error(`Error updating progress for session ${sessionId}, puzzle ${completedPuzzleId}: ${error instanceof Error ? error.message : String(error)}`, 'batch-progress');
      return null;
    }
  }

  /**
   * Calculate ETA based on current progress and processing times
   */
  calculateETA(progress: BatchProgress, processingTimes: number[]): number {
    if (processingTimes.length === 0 || progress.progress.completed === 0) {
      return 0;
    }

    const remainingPuzzles = progress.progress.total - progress.progress.completed;
    const averageTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    
    return Math.round((remainingPuzzles * averageTime) / 1000); // Return ETA in seconds
  }

  /**
   * Calculate overall accuracy percentage
   */
  calculateAccuracy(successful: number, completed: number): number {
    if (completed === 0) return 0;
    return Math.round((successful / completed) * 100);
  }

  /**
   * Calculate completion percentage
   */
  calculateCompletionPercentage(completed: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }

  /**
   * Update session statistics in database
   */
  async updateSessionStats(sessionId: string, stats: { 
    completedPuzzles?: number; 
    successfulPuzzles?: number; 
    failedPuzzles?: number; 
    averageProcessingTime?: number 
  }): Promise<boolean> {
    try {
      await repositoryService.batchAnalysis.updateBatchSession(sessionId, stats);
      
      // Invalidate cache after database update
      this.invalidateCache(sessionId);
      
      return true;
    } catch (error) {
      logger.error(`Error updating session stats for ${sessionId}: ${error instanceof Error ? error.message : String(error)}`, 'batch-progress');
      return false;
    }
  }

  /**
   * Get batch statistics from database
   */
  async getBatchStats(sessionId: string): Promise<BatchStats | null> {
    try {
      return await repositoryService.batchAnalysis.getBatchSessionStats(sessionId);
    } catch (error) {
      logger.error(`Error fetching batch stats for ${sessionId}: ${error instanceof Error ? error.message : String(error)}`, 'batch-progress');
      return null;
    }
  }

  /**
   * Clear progress cache for a session
   */
  invalidateCache(sessionId: string): void {
    this.progressCache.delete(sessionId);
    this.lastCacheUpdate.delete(sessionId);
  }

  /**
   * Clear all cached progress data
   */
  clearCache(): void {
    this.progressCache.clear();
    this.lastCacheUpdate.clear();
  }

  /**
   * Get cached progress if still valid
   */
  private getCachedProgress(sessionId: string): BatchProgress | null {
    const cached = this.progressCache.get(sessionId);
    const lastUpdate = this.lastCacheUpdate.get(sessionId);
    
    if (cached && lastUpdate && (Date.now() - lastUpdate) < this.CACHE_TTL_MS) {
      return cached;
    }
    
    return null;
  }

  /**
   * Update progress cache
   */
  private updateCache(sessionId: string, progress: BatchProgress): void {
    this.progressCache.set(sessionId, progress);
    this.lastCacheUpdate.set(sessionId, Date.now());
  }

  /**
   * Fetch progress data from database
   */
  private async fetchProgressFromDatabase(sessionId: string): Promise<BatchProgress | null> {
    const sessionData = await repositoryService.batchAnalysis.getBatchSession(sessionId);
    if (!sessionData) {
      logger.warn(`Session ${sessionId} not found in database`, 'batch-progress');
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
        percentage: this.calculateCompletionPercentage(completedPuzzles, totalPuzzles)
      },
      stats: {
        averageProcessingTime: stats.averageProcessingTime || 0,
        overallAccuracy: this.calculateAccuracy(successfulPuzzles, completedPuzzles),
        eta: 0 // ETA calculation requires additional context
      },
      startTime: sessionData.createdAt ? new Date(sessionData.createdAt).getTime() : Date.now(),
      endTime: sessionData.completedAt ? new Date(sessionData.completedAt).getTime() : undefined
    };

    logger.info(`Database session ${sessionId}: ${progress.status} - ${progress.progress.completed}/${progress.progress.total} puzzles (${progress.progress.percentage}%)`, 'batch-progress');
    return progress;
  }
}

export const batchProgressTracker = new BatchProgressTracker();