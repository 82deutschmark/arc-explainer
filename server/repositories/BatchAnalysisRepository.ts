/**
 * Batch Analysis Repository Implementation
 * 
 * Handles all batch analysis session and result operations.
 * Extracted from monolithic DbService to follow Single Responsibility Principle.
 * 
 * @author Claude
 * @date 2025-08-27
 */

import { BaseRepository } from './base/BaseRepository.js';
import { logger } from '../utils/logger.js';

export interface BatchSessionData {
  sessionId: string;
  totalPuzzles: number;
  modelKey: string;
  dataset: string;
  promptId?: string;
  customPrompt?: string;
  temperature?: number;
  reasoningEffort?: string;
  reasoningVerbosity?: string;
  reasoningSummaryType?: string;
}

export interface BatchSessionResponse {
  sessionId: string;
  totalPuzzles: number;
  completedPuzzles: number;
  modelKey: string;
  dataset: string;
  promptId?: string;
  customPrompt?: string;
  temperature?: number;
  reasoningEffort?: string;
  reasoningVerbosity?: string;
  reasoningSummaryType?: string;
  status: string;
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

export interface BatchResultData {
  sessionId: string;
  puzzleId: string;
  status?: string;
  explanationId?: number;
  error?: string;
  processingTimeMs?: number;
}

export interface BatchResultResponse {
  sessionId: string;
  puzzleId: string;
  status: string;
  explanationId?: number;
  error?: string;
  processingTimeMs?: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface BatchSessionUpdates {
  completedPuzzles?: number;
  status?: string;
  completedAt?: Date;
  [key: string]: any;
}

export interface BatchResultUpdates {
  status?: string;
  explanationId?: number;
  error?: string;
  processingTimeMs?: number;
  completedAt?: Date;
}

export class BatchAnalysisRepository extends BaseRepository {
  
  async createBatchSession(sessionData: BatchSessionData): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('Database not available');
    }

    const client = await this.getClient();
    
    try {
      await this.query(`
        INSERT INTO batch_analysis_sessions 
        (session_id, total_puzzles, model_key, dataset, prompt_id, custom_prompt, 
         temperature, reasoning_effort, reasoning_verbosity, reasoning_summary_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        sessionData.sessionId,
        sessionData.totalPuzzles,
        sessionData.modelKey,
        sessionData.dataset,
        sessionData.promptId || null,
        sessionData.customPrompt || null,
        sessionData.temperature || null,
        sessionData.reasoningEffort || null,
        sessionData.reasoningVerbosity || null,
        sessionData.reasoningSummaryType || null
      ], client);

      return true;
    } catch (error) {
      logger.error(`Error creating batch session: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateBatchSession(sessionId: string, updates: BatchSessionUpdates): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('Database not available');
    }

    const client = await this.getClient();
    
    try {
      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      // Convert camelCase to snake_case for database columns
      Object.entries(updates).forEach(([key, value]) => {
        const dbColumn = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        setParts.push(`${dbColumn} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      });

      if (setParts.length === 0) {
        logger.warn('No updates provided for batch session', 'database');
        return false;
      }

      // Add sessionId as final parameter
      values.push(sessionId);
      
      await this.query(
        `UPDATE batch_analysis_sessions SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE session_id = $${paramIndex}`,
        values,
        client
      );

      return true;
    } catch (error) {
      logger.error(`Error updating batch session: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    } finally {
      client.release();
    }
  }

  async getBatchSession(sessionId: string): Promise<BatchSessionResponse | null> {
    if (!this.isConnected()) {
      return null;
    }

    try {
      const result = await this.query(`
        SELECT * FROM batch_analysis_sessions WHERE session_id = $1
      `, [sessionId]);

      return result.rows.length > 0 ? this.mapRowToBatchSession(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Error getting batch session: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  async getAllBatchSessions(): Promise<BatchSessionResponse[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      const result = await this.query(`
        SELECT * FROM batch_analysis_sessions ORDER BY created_at DESC
      `);

      return result.rows.map(row => this.mapRowToBatchSession(row));
    } catch (error) {
      logger.error(`Error getting all batch sessions: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  async createBatchResult(data: BatchResultData): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('Database not available');
    }

    const client = await this.getClient();
    
    try {
      await this.query(`
        INSERT INTO batch_analysis_results (session_id, puzzle_id, status, explanation_id, error, processing_time_ms)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        data.sessionId,
        data.puzzleId,
        data.status || 'pending',
        data.explanationId || null,
        data.error || null,
        data.processingTimeMs || null
      ], client);

      return true;
    } catch (error) {
      logger.error(`Error creating batch result: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateBatchResult(sessionId: string, puzzleId: string, updates: BatchResultUpdates): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('Database not available');
    }

    const client = await this.getClient();
    
    try {
      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      // Convert camelCase to snake_case for database columns
      Object.entries(updates).forEach(([key, value]) => {
        const dbColumn = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        setParts.push(`${dbColumn} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      });

      if (setParts.length === 0) {
        logger.warn('No updates provided for batch result', 'database');
        return false;
      }

      // Add sessionId and puzzleId as final parameters
      values.push(sessionId, puzzleId);
      
      await this.query(
        `UPDATE batch_analysis_results SET ${setParts.join(', ')} WHERE session_id = $${paramIndex} AND puzzle_id = $${paramIndex + 1}`,
        values,
        client
      );

      return true;
    } catch (error) {
      logger.error(`Error updating batch result: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    } finally {
      client.release();
    }
  }

  async getBatchResults(sessionId: string): Promise<BatchResultResponse[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      const result = await this.query(`
        SELECT * FROM batch_analysis_results 
        WHERE session_id = $1 
        ORDER BY completed_at DESC, created_at DESC
      `, [sessionId]);

      return result.rows.map(row => this.mapRowToBatchResult(row));
    } catch (error) {
      logger.error(`Error getting batch results: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  async getBatchResultsByStatus(sessionId: string, status: string): Promise<BatchResultResponse[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      const result = await this.query(`
        SELECT * FROM batch_analysis_results 
        WHERE session_id = $1 AND status = $2
        ORDER BY created_at DESC
      `, [sessionId, status]);

      return result.rows.map(row => this.mapRowToBatchResult(row));
    } catch (error) {
      logger.error(`Error getting batch results by status: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  async getBatchSessionStats(sessionId: string): Promise<{
    totalPuzzles: number;
    completedCount: number;
    pendingCount: number;
    errorCount: number;
    successCount: number;
    averageProcessingTime: number;
  }> {
    if (!this.isConnected()) {
      return {
        totalPuzzles: 0,
        completedCount: 0,
        pendingCount: 0,
        errorCount: 0,
        successCount: 0,
        averageProcessingTime: 0
      };
    }

    try {
      const result = await this.query(`
        SELECT 
          COUNT(*) as total_results,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count,
          COUNT(CASE WHEN status = 'completed' AND explanation_id IS NOT NULL THEN 1 END) as success_count,
          AVG(CASE WHEN processing_time_ms IS NOT NULL THEN processing_time_ms END) as avg_processing_time
        FROM batch_analysis_results 
        WHERE session_id = $1
      `, [sessionId]);

      const stats = result.rows[0];
      
      // Get total puzzles from session
      const sessionResult = await this.query(`
        SELECT total_puzzles FROM batch_analysis_sessions WHERE session_id = $1
      `, [sessionId]);
      
      const totalPuzzles = sessionResult.rows.length > 0 ? sessionResult.rows[0].total_puzzles : 0;

      return {
        totalPuzzles,
        completedCount: parseInt(stats.completed_count) || 0,
        pendingCount: parseInt(stats.pending_count) || 0,
        errorCount: parseInt(stats.error_count) || 0,
        successCount: parseInt(stats.success_count) || 0,
        averageProcessingTime: Math.round(parseFloat(stats.avg_processing_time) || 0)
      };
    } catch (error) {
      logger.error(`Error getting batch session stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Map database row to BatchSessionResponse object
   */
  private mapRowToBatchSession(row: any): BatchSessionResponse {
    return {
      sessionId: row.session_id,
      totalPuzzles: row.total_puzzles,
      completedPuzzles: row.completed_puzzles || 0,
      modelKey: row.model_key,
      dataset: row.dataset,
      promptId: row.prompt_id,
      customPrompt: row.custom_prompt,
      temperature: row.temperature,
      reasoningEffort: row.reasoning_effort,
      reasoningVerbosity: row.reasoning_verbosity,
      reasoningSummaryType: row.reasoning_summary_type,
      status: row.status || 'active',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at
    };
  }

  /**
   * Map database row to BatchResultResponse object
   */
  private mapRowToBatchResult(row: any): BatchResultResponse {
    return {
      sessionId: row.session_id,
      puzzleId: row.puzzle_id,
      status: row.status,
      explanationId: row.explanation_id,
      error: row.error,
      processingTimeMs: row.processing_time_ms,
      createdAt: row.created_at,
      completedAt: row.completed_at
    };
  }
}