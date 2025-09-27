/**
 * Repository Service - Centralized Repository Management
 * 
 * Provides unified access to all repositories with dependency injection support.
 * Replaces the monolithic DbService with a clean, modular architecture.
 * 
 * **External Integration Note**: This is the primary entry point for
 * accessing all database operations. External applications should use
 * this service to access repositories rather than instantiating them directly.
 * 
 * Updated to include separated repositories following Single Responsibility Principle:
 * - AccuracyRepository: Pure puzzle-solving correctness metrics
 * - TrustworthinessRepository: AI confidence reliability analysis  
 * - FeedbackRepository: User feedback about explanation quality
 * - MetricsRepository: Aggregated analytics from all repositories
 * 
 * @example External Integration
 * ```typescript
 * // Get accuracy statistics for external leaderboards
 * const accuracyStats = await repositoryService.accuracy.getPureAccuracyStats();
 * 
 * // Get explanations for external analysis
 * const explanations = await repositoryService.explanation.getByPuzzle(puzzleId);
 * 
 * // Submit feedback from external apps
 * await repositoryService.feedback.create({
 *   explanationId,
 *   feedbackType: 'helpful',
 *   comment: 'Great explanation!'
 * });
 * ```
 * 
 * @author Claude
 * @date 2025-08-27
 * @updated 2025-08-31 - Added separated repositories for Phase 1 refactor
 */

import { initializeDatabase, isDatabaseConnected, getPool } from './base/BaseRepository.ts';
import { ExplanationRepository } from './ExplanationRepository.ts';
import { FeedbackRepository } from './FeedbackRepository.ts';
import { BatchAnalysisRepository } from './BatchAnalysisRepository.ts';
import { AccuracyRepository } from './AccuracyRepository.ts';
import { TrustworthinessRepository } from './TrustworthinessRepository.ts';
import { MetricsRepository } from './MetricsRepository.ts';
import { CostRepository } from './CostRepository.ts';
import { EloRepository } from './EloRepository.ts';
import { ModelDatasetRepository } from './ModelDatasetRepository.ts';
import { DatabaseSchema } from './database/DatabaseSchema.ts';
import { logger } from '../utils/logger.ts';

export class RepositoryService {
  private explanationRepository: ExplanationRepository;
  private modelDatasetRepository: ModelDatasetRepository;
  private feedbackRepository: FeedbackRepository;
  private batchAnalysisRepository: BatchAnalysisRepository;
  private accuracyRepository: AccuracyRepository;
  private trustworthinessRepository: TrustworthinessRepository;
  private metricsRepository: MetricsRepository;
  private costRepository: CostRepository;
  private eloRepository: EloRepository;
  private initialized = false;

  constructor() {
    this.explanationRepository = new ExplanationRepository();
    this.modelDatasetRepository = new ModelDatasetRepository();
    this.feedbackRepository = new FeedbackRepository();
    this.batchAnalysisRepository = new BatchAnalysisRepository();
    this.accuracyRepository = new AccuracyRepository();
    this.trustworthinessRepository = new TrustworthinessRepository();
    this.metricsRepository = new MetricsRepository();
    this.costRepository = new CostRepository();
    this.eloRepository = new EloRepository();
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
          // Create tables and apply migrations
          await DatabaseSchema.initialize(pool);
          this.initialized = true;
          logger.info('Repository service initialized successfully', 'database');
          return true;
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
   * Get accuracy repository (pure puzzle-solving correctness)
   */
  get accuracy(): AccuracyRepository {
    return this.accuracyRepository;
  }

  /**
   * Get trustworthiness repository (AI confidence reliability)
   */
  get trustworthiness(): TrustworthinessRepository {
    return this.trustworthinessRepository;
  }

  /**
   * Get metrics repository (aggregated analytics)
   */
  get metrics(): MetricsRepository {
    return this.metricsRepository;
  }

  /**
   * Get cost repository for cost calculations and analysis
   */
  get cost(): CostRepository {
    return this.costRepository;
  }

  /**
   * Get Elo repository (explanation comparison ratings)
   */
  get elo(): EloRepository {
    return this.eloRepository;
  }

  /**
   * Get model dataset repository (model performance on datasets)
   */
  get modelDataset(): ModelDatasetRepository {
    return this.modelDatasetRepository;
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

    const stats = {
      totalExplanations: 0,
      totalFeedback: 0,
      totalBatchSessions: 0,
      totalBatchResults: 0,
      lastExplanationAt: null,
      lastFeedbackAt: null
    };
    
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
      accuracy: boolean;
      trustworthiness: boolean;
      metrics: boolean;
    };
    message: string;
  }> {
    const details = {
      database: this.isConnected(),
      explanations: false,
      feedback: false,
      batchAnalysis: false,
      accuracy: false,
      trustworthiness: false,
      metrics: false
    };

    let healthyCount = 0;
    const totalRepositories = 6; // Updated count for all repositories

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

      try {
        // Test accuracy repository with a simple query
        await this.accuracyRepository.getPureAccuracyStats();
        details.accuracy = true;
        healthyCount++;
      } catch (error) {
        logger.warn('Accuracy repository health check failed', 'database');
      }

      try {
        // Test trustworthiness repository with a simple query
        await this.trustworthinessRepository.getTrustworthinessStats();
        details.trustworthiness = true;
        healthyCount++;
      } catch (error) {
        logger.warn('Trustworthiness repository health check failed', 'database');
      }

      try {
        // Test metrics repository with a simple query
        await this.metricsRepository.getRawDatabaseStats();
        details.metrics = true;
        healthyCount++;
      } catch (error) {
        logger.warn('Metrics repository health check failed', 'database');
      }
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';
    let message = 'All repositories unhealthy';

    if (!details.database) {
      status = 'unhealthy';
      message = 'Database connection failed';
    } else if (healthyCount === totalRepositories) {
      status = 'healthy';
      message = 'All repositories operational';
    } else if (healthyCount > 0) {
      status = 'degraded';
      message = `${healthyCount}/${totalRepositories} repositories operational`;
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