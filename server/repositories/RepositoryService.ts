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
import { ContributorRepository } from './ContributorRepository.ts';
import { SnakeBenchRepository } from './SnakeBenchRepository.ts';
import { WormArenaSessionRepository } from './WormArenaSessionRepository.ts';
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
  private contributorRepository: ContributorRepository;
  private snakeBenchRepository: SnakeBenchRepository;
  private wormArenaSessionRepository: WormArenaSessionRepository;
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
    this.contributorRepository = new ContributorRepository();
    this.snakeBenchRepository = new SnakeBenchRepository();
    this.wormArenaSessionRepository = new WormArenaSessionRepository();
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
   * Get contributor repository (human contributor trading cards)
   */
  get contributors(): ContributorRepository {
    return this.contributorRepository;
  }

  /**
   * Get SnakeBench repository (compatibility-first SnakeBench DB access)
   */
  get snakeBench(): SnakeBenchRepository {
    return this.snakeBenchRepository;
  }

  /**
   * Get Worm Arena session repository (persistent live-link resolution)
   */
  get wormArenaSessions(): WormArenaSessionRepository {
    return this.wormArenaSessionRepository;
  }

  /**
   * Get database connection status
   */
  isConnected(): boolean {
    return isDatabaseConnected();
  }

  /**
   * Get database pool for direct queries (use sparingly - prefer repository methods)
   * @deprecated Use repository methods when possible for better encapsulation
   */
  get db() {
    return getPool();
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

}

// Export singleton instance
export const repositoryService = new RepositoryService();