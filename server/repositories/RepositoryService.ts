/**
 * Repository Service - Centralized Repository Management
 * 
 * Provides unified access to all repositories with dependency injection support.
 * Replaces the monolithic DbService with a clean, modular architecture.
 * 
 * @author Claude
 * @date 2025-08-27
 */

import { initializeDatabase, isDatabaseConnected, getPool } from './base/BaseRepository.ts';
import { ExplanationRepository } from './ExplanationRepository.ts';
import { FeedbackRepository } from './FeedbackRepository.ts';
import { BatchAnalysisRepository } from './BatchAnalysisRepository.ts';
import { DatabaseSchema } from './database/DatabaseSchema.ts';
import { logger } from '../utils/logger.ts';

export class RepositoryService {
  private explanationRepository: ExplanationRepository;
  private feedbackRepository: FeedbackRepository;
  private batchAnalysisRepository: BatchAnalysisRepository;
  private initialized = false;

  constructor() {
    this.explanationRepository = new ExplanationRepository();
    this.feedbackRepository = new FeedbackRepository();
    this.batchAnalysisRepository = new BatchAnalysisRepository();
  }

  /**
   * Initialize database connection and create tables
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return isDatabaseConnected();
    }

    try {
      // Initialize database connection
      const connected = await initializeDatabase();
      
      if (connected) {
        const pool = getPool();
        if (pool) {
          // Create tables and validate schema
          await DatabaseSchema.createTablesIfNotExist(pool);
          const schemaValid = await DatabaseSchema.validateSchema(pool);
          
          if (schemaValid) {
            this.initialized = true;
            logger.info('Repository service initialized successfully', 'database');
            
            // Log database statistics
            const stats = await DatabaseSchema.getDatabaseStats(pool);
            logger.info(`Database stats: ${stats.totalExplanations} explanations, ${stats.totalFeedback} feedback entries`, 'database');
            
            return true;
          } else {
            logger.error('Database schema validation failed', 'database');
            return false;
          }
        }
      }
      
      logger.warn('Database not available - using fallback mode', 'database');
      return false;
    } catch (error) {
      logger.error(`Repository service initialization failed: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return false;
    }
  }

  /**
   * Check if repositories are ready for use
   */
  isInitialized(): boolean {
    return this.initialized && isDatabaseConnected();
  }

  /**
   * Get explanation repository
   */
  get explanations(): ExplanationRepository {
    return this.explanationRepository;
  }

  /**
   * Get feedback repository
   */
  get feedback(): FeedbackRepository {
    return this.feedbackRepository;
  }

  /**
   * Get batch analysis repository
   */
  get batchAnalysis(): BatchAnalysisRepository {
    return this.batchAnalysisRepository;
  }

  /**
   * Get database connection status
   */
  isConnected(): boolean {
    return isDatabaseConnected();
  }

  /**
   * Get database statistics for monitoring
   */
  async getDatabaseStats(): Promise<{
    connected: boolean;
    totalExplanations: number;
    totalFeedback: number;
    totalBatchSessions: number;
    totalBatchResults: number;
    lastExplanationAt: Date | null;
    lastFeedbackAt: Date | null;
  }> {
    if (!this.isConnected()) {
      return {
        connected: false,
        totalExplanations: 0,
        totalFeedback: 0,
        totalBatchSessions: 0,
        totalBatchResults: 0,
        lastExplanationAt: null,
        lastFeedbackAt: null
      };
    }

    const pool = getPool();
    if (!pool) {
      throw new Error('Database pool not available');
    }

    const stats = await DatabaseSchema.getDatabaseStats(pool);
    
    return {
      connected: true,
      ...stats
    };
  }

  /**
   * Health check for all repositories
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      database: boolean;
      explanations: boolean;
      feedback: boolean;
      batchAnalysis: boolean;
    };
    message: string;
  }> {
    const details = {
      database: this.isConnected(),
      explanations: false,
      feedback: false,
      batchAnalysis: false
    };

    let healthyCount = 0;

    if (details.database) {
      // Test each repository
      try {
        // Test explanations repository with a simple query
        await this.explanationRepository.hasExplanation('health-check-test');
        details.explanations = true;
        healthyCount++;
      } catch (error) {
        logger.warn('Explanations repository health check failed', 'database');
      }

      try {
        // Test feedback repository with a simple query
        await this.feedbackRepository.getFeedbackForExplanation(0);
        details.feedback = true;
        healthyCount++;
      } catch (error) {
        logger.warn('Feedback repository health check failed', 'database');
      }

      try {
        // Test batch analysis repository with a simple query
        await this.batchAnalysisRepository.getAllBatchSessions();
        details.batchAnalysis = true;
        healthyCount++;
      } catch (error) {
        logger.warn('Batch analysis repository health check failed', 'database');
      }
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';
    let message = 'All repositories unhealthy';

    if (!details.database) {
      status = 'unhealthy';
      message = 'Database connection failed';
    } else if (healthyCount === 3) {
      status = 'healthy';
      message = 'All repositories operational';
    } else if (healthyCount > 0) {
      status = 'degraded';
      message = `${healthyCount}/3 repositories operational`;
    }

    return {
      status,
      details,
      message
    };
  }
}

// Export singleton instance
export const repositoryService = new RepositoryService();