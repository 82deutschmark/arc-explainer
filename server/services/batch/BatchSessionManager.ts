/**
 * BatchSessionManager.ts
 * 
 * Handles batch analysis session lifecycle management.
 * Responsible for creating, updating, and managing batch analysis sessions.
 * Follows Single Responsibility Principle by focusing only on session management.
 * 
 * @author Claude Code
 */

import { repositoryService } from '../../repositories/RepositoryService.js';
import { puzzleService } from '../puzzleService.js';
import { logger } from '../../utils/logger.js';
import { randomUUID } from 'crypto';

export interface BatchSessionConfig {
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

export interface BatchSessionInfo {
  sessionId: string;
  config: BatchSessionConfig;
  totalPuzzles: number;
  puzzleIds: string[];
  createdAt: Date;
}

export class BatchSessionManager {
  /**
   * Create a new batch analysis session with database persistence
   */
  async createSession(config: BatchSessionConfig): Promise<{ success: boolean; sessionInfo?: BatchSessionInfo; error?: string }> {
    try {
      const sessionId = randomUUID();
      logger.info(`Creating batch session ${sessionId} for model ${config.modelKey} on dataset ${config.dataset}`, 'batch-session');

      // Get puzzles for the selected dataset
      const puzzles = await this.getPuzzlesForDataset(config.dataset);
      
      if (puzzles.length === 0) {
        logger.error(`No puzzles found for dataset ${config.dataset}`, 'batch-session');
        return { success: false, error: 'No puzzles found for selected dataset' };
      }

      // Verify database connection
      await this.verifyDatabaseConnection(sessionId);

      // Create database session record
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
        logger.error(`Failed to create database session for ${sessionId}`, 'batch-session');
        return { success: false, error: 'Failed to create database session' };
      }

      // Create batch result records for all puzzles
      await this.createBatchResultRecords(sessionId, puzzles);

      const sessionInfo: BatchSessionInfo = {
        sessionId,
        config,
        totalPuzzles: puzzles.length,
        puzzleIds: puzzles.map(p => p.id),
        createdAt: new Date()
      };

      logger.info(`Session ${sessionId} created successfully with ${puzzles.length} puzzles`, 'batch-session');
      return { success: true, sessionInfo };

    } catch (error) {
      logger.error(`Error creating batch session: ${error instanceof Error ? error.message : String(error)}`, 'batch-session');
      return { success: false, error: 'Failed to create batch analysis session' };
    }
  }

  /**
   * Update session status in database
   */
  async updateSessionStatus(sessionId: string, status: string, additionalData?: any): Promise<boolean> {
    try {
      const updateData: any = { status };
      
      if (additionalData) {
        Object.assign(updateData, additionalData);
      }

      await repositoryService.batchAnalysis.updateBatchSession(sessionId, updateData);
      logger.info(`Session ${sessionId} status updated to: ${status}`, 'batch-session');
      return true;
    } catch (error) {
      logger.error(`Error updating session ${sessionId} status: ${error instanceof Error ? error.message : String(error)}`, 'batch-session');
      return false;
    }
  }

  /**
   * Get session configuration from database
   */
  async getSessionConfig(sessionId: string): Promise<BatchSessionConfig | null> {
    try {
      const session = await repositoryService.batchAnalysis.getBatchSession(sessionId);
      if (!session) {
        logger.warn(`Session ${sessionId} not found in database`, 'batch-session');
        return null;
      }

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
    } catch (error) {
      logger.error(`Error fetching session config for ${sessionId}: ${error instanceof Error ? error.message : String(error)}`, 'batch-session');
      return null;
    }
  }

  /**
   * Check if session exists and is valid
   */
  async validateSession(sessionId: string): Promise<boolean> {
    try {
      const session = await repositoryService.batchAnalysis.getBatchSession(sessionId);
      return session !== null;
    } catch (error) {
      logger.error(`Error validating session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`, 'batch-session');
      return false;
    }
  }

  /**
   * Get puzzles for a specific dataset
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
   * Verify database connection before creating session
   */
  private async verifyDatabaseConnection(testSessionId: string): Promise<void> {
    try {
      await repositoryService.batchAnalysis.getBatchSession('test-connection');
    } catch (error) {
      logger.error(`Database not connected when trying to create session ${testSessionId}`, 'batch-session');
      throw new Error('Database connection not available');
    }
  }

  /**
   * Create batch result records for all puzzles in session
   */
  private async createBatchResultRecords(sessionId: string, puzzles: any[]): Promise<void> {
    for (const puzzle of puzzles) {
      await repositoryService.batchAnalysis.createBatchResult({
        sessionId,
        puzzleId: puzzle.id,
        status: 'pending'
      });
    }
    logger.info(`Created ${puzzles.length} batch result records for session ${sessionId}`, 'batch-session');
  }
}

export const batchSessionManager = new BatchSessionManager();