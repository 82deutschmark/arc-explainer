/**
 * Metrics Repository Implementation
 * 
 * Aggregates analytics from AccuracyRepository, TrustworthinessRepository, and FeedbackRepository.
 * Handles mixed overview metrics and comprehensive dashboard analytics.
 * 
 * SCOPE: This repository handles AGGREGATED ANALYTICS combining:
 * - Pure accuracy data from AccuracyRepository
 * - Trustworthiness data from TrustworthinessRepository  
 * - User feedback data from FeedbackRepository
 * - Infrastructure/database performance metrics
 * 
 * RESPONSIBILITIES:
 * - Provide unified dashboard overviews combining multiple data sources
 * - Handle mixed analytics that require data from multiple repositories
 * - Infrastructure and performance monitoring metrics
 * - Cross-repository comparative analytics
 * 
 * WHAT THIS REPOSITORY DOES NOT HANDLE:
 * - Individual repository concerns (those stay in their respective repositories)
 * - Raw data storage or manipulation (delegates to other repositories)
 * 
 * This repository follows the Aggregate pattern, coordinating between
 * specialized repositories without duplicating their logic.
 * 
 * @author Claude
 * @date 2025-08-31
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { AccuracyRepository } from './AccuracyRepository.ts';
import { TrustworthinessRepository } from './TrustworthinessRepository.ts';
import { FeedbackRepository } from './FeedbackRepository.ts';
import { logger } from '../utils/logger.ts';
import { MetricsQueryBuilder } from './utils/MetricsQueryBuilder.ts';
import { COST_EFFICIENCY, ANALYSIS_CRITERIA } from '../constants/metricsConstants.ts';
import type { BasicAccuracyStats, ModelAccuracyMap } from './AccuracyRepository.ts';
import type { BasicTrustworthinessStats, ModelTrustworthinessMap } from './TrustworthinessRepository.ts';
import type { ModelFeedbackMap } from './FeedbackRepository.ts';

export interface GeneralModelStats {
  totalExplanations: number;
  avgConfidence: number;
  totalSolverAttempts: number;
  totalCorrectPredictions: number;
  modelAccuracy: ModelOverview[];
  accuracyByModel: ModelOverview[];
}

export interface ModelOverview {
  modelName: string;
  totalAttempts: number;
  totalExplanations: number;
  avgConfidence: number;
  
  // Solver-specific data (subset of total)
  solverAttempts: number;
  correctPredictions: number;
  accuracyPercentage: number;
  
  // Trustworthiness scores (when available)
  avgTrustworthiness: number;
  avgAccuracyScore: number; // Backward compatibility (actually trustworthiness)
  minTrustworthiness: number;
  maxTrustworthiness: number;
  trustworthinessEntries: number;
  
  // For compatibility
  successfulPredictions: number;
  predictionSuccessRate: number;
}

export interface RawDatabaseStats {
  totalExplanations: number;
  avgProcessingTime: number;
  maxProcessingTime: number;
  avgPredictionAccuracy: number; // Actually trustworthiness
  totalTokens: number;
  avgTokens: number;
  maxTokens: number;
  totalEstimatedCost: number;
  avgEstimatedCost: number;
  maxEstimatedCost: number;
  explanationsWithTokens: number;
  explanationsWithCost: number;
  explanationsWithAccuracy: number;
  explanationsWithProcessingTime: number;
}

export interface ComprehensiveDashboard {
  // Core metrics
  accuracyStats: {
    totalSolverAttempts: number;
    overallAccuracyPercentage: number;
    topAccurateModels: Array<{ modelName: string; accuracy: number; attempts: number }>;
  };
  
  trustworthinessStats: {
    totalTrustworthinessAttempts: number;
    overallTrustworthiness: number;
    topTrustworthyModels: Array<{ modelName: string; trustworthiness: number; attempts: number }>;
  };
  
  feedbackStats: {
    totalFeedback: number;
    helpfulPercentage: number;
    topRatedModels: Array<{ modelName: string; helpfulPercentage: number; feedbackCount: number }>;
  };
  
  // Cross-cutting insights
  modelComparisons: Array<{
    modelName: string;
    accuracy: number;
    trustworthiness: number;
    userSatisfaction: number;
    attempts: number;
    costEfficiency: number;
  }>;
  
  performanceMetrics: {
    avgProcessingTime: number;
    totalCost: number;
    avgCostPerAttempt: number;
  };
}

export interface ModelReliabilityStat {
  modelName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  reliability: number;
}

export class MetricsRepository extends BaseRepository {
  
  private accuracyRepo: AccuracyRepository;
  private trustworthinessRepo: TrustworthinessRepository;
  private feedbackRepo: FeedbackRepository;
  
  constructor() {
    super();
    this.accuracyRepo = new AccuracyRepository();
    this.trustworthinessRepo = new TrustworthinessRepository();
    this.feedbackRepo = new FeedbackRepository();
  }
  
  /**
   * Get GENERAL MODEL STATS - Overview of all model activity
   * 
   * IMPORTANT: This method returns MIXED DATA combining multiple concepts!
   * 
   * WHAT THIS METHOD INCLUDES:
   * - ALL explanations with confidence values (not just solver attempts)
   * - Models that only did explanation tasks (no predictions)
   * - Models that made solver attempts (with predictions)
   * 
   * DATA MIXING WARNING:
   * - accuracyByModel: Contains trustworthiness data (trustworthiness_score)
   * - modelAccuracy: Contains pure accuracy percentages (is_prediction_correct)
   * - Both arrays have different inclusion criteria and different orderings!
   * 
   * USE CASES:
   * - General dashboard overview showing all model activity
   * - Comparing explanation volume vs solver attempt volume
   * - NOT for pure accuracy analysis (use AccuracyRepository.getPureAccuracyStats)
   * - NOT for pure trustworthiness analysis (use TrustworthinessRepository.getTrustworthinessStats)
   */
  async getGeneralModelStats(): Promise<GeneralModelStats> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty general model stats.', 'database');
      return {
        totalExplanations: 0,
        avgConfidence: 0,
        totalSolverAttempts: 0,
        totalCorrectPredictions: 0,
        modelAccuracy: [],
        accuracyByModel: []
      };
    }

    try {
      // REFACTORED: Parallel data fetching for optimal performance
      const [accuracyStats, trustworthinessStats, infrastructureStats, modelStats] = await Promise.all([
        this.accuracyRepo.getBasicStats(),
        this.trustworthinessRepo.getBasicStats(),
        this.getInfrastructureStats(),
        this.getModelOverviewStats()
      ]);

      // Pure aggregation - no business logic, just combining data
      return this.combineGeneralModelStats(
        accuracyStats,
        trustworthinessStats,
        infrastructureStats,
        modelStats
      );

    } catch (error) {
      logger.error(`Error getting general model stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get RAW DATABASE STATS - Infrastructure and performance metrics
   * 
   * This method provides technical database statistics about API usage,
   * processing performance, token consumption, and cost analysis.
   * 
   * METRIC CATEGORIES:
   * - Processing Performance: API call timing and response times
   * - Token Usage: Input/output tokens, cost estimation
   * - Data Completeness: Count of entries with complete data fields
   * 
   * IMPORTANT: avgPredictionAccuracy uses trustworthiness_score field
   * Despite the name, this is TRUSTWORTHINESS data, not pure accuracy!
   * This field measures AI confidence reliability, not puzzle-solving success.
   */
  async getRawDatabaseStats(): Promise<RawDatabaseStats> {
    if (!this.isConnected()) {
      return {
        totalExplanations: 0,
        avgProcessingTime: 0,
        maxProcessingTime: 0,
        avgPredictionAccuracy: 0,
        totalTokens: 0,
        avgTokens: 0,
        maxTokens: 0,
        totalEstimatedCost: 0,
        avgEstimatedCost: 0,
        maxEstimatedCost: 0,
        explanationsWithTokens: 0,
        explanationsWithCost: 0,
        explanationsWithAccuracy: 0,
        explanationsWithProcessingTime: 0
      };
    }

    try {
      const stats = await this.query(`
        SELECT 
          COUNT(*) as total_explanations,
          AVG(api_processing_time_ms) as avg_processing_time,
          MAX(api_processing_time_ms) as max_processing_time,
          AVG(trustworthiness_score) as avg_prediction_accuracy,
          SUM(total_tokens) as total_tokens,
          AVG(total_tokens) as avg_tokens,
          MAX(total_tokens) as max_tokens,
          SUM(estimated_cost) as total_estimated_cost,
          AVG(estimated_cost) as avg_estimated_cost,
          MAX(estimated_cost) as max_estimated_cost,
          COUNT(total_tokens) FILTER (WHERE total_tokens IS NOT NULL) as explanations_with_tokens,
          COUNT(estimated_cost) FILTER (WHERE estimated_cost IS NOT NULL) as explanations_with_cost,
          COUNT(trustworthiness_score) FILTER (WHERE trustworthiness_score IS NOT NULL) as explanations_with_accuracy,
          COUNT(api_processing_time_ms) FILTER (WHERE api_processing_time_ms IS NOT NULL) as explanations_with_processing_time
        FROM explanations
      `);

      const row = stats.rows[0];
      return {
        totalExplanations: parseInt(row.total_explanations) || 0,
        avgProcessingTime: Math.round((parseFloat(row.avg_processing_time) || 0) * 100) / 100,
        maxProcessingTime: parseInt(row.max_processing_time) || 0,
        avgPredictionAccuracy: Math.round((parseFloat(row.avg_prediction_accuracy) || 0) * 10000) / 10000,
        totalTokens: parseInt(row.total_tokens) || 0,
        avgTokens: Math.round(parseFloat(row.avg_tokens) || 0),
        maxTokens: parseInt(row.max_tokens) || 0,
        totalEstimatedCost: Math.round((parseFloat(row.total_estimated_cost) || 0) * 10000) / 10000,
        avgEstimatedCost: Math.round((parseFloat(row.avg_estimated_cost) || 0) * 1000000) / 1000000,
        maxEstimatedCost: Math.round((parseFloat(row.max_estimated_cost) || 0) * 1000000) / 1000000,
        explanationsWithTokens: parseInt(row.explanations_with_tokens) || 0,
        explanationsWithCost: parseInt(row.explanations_with_cost) || 0,
        explanationsWithAccuracy: parseInt(row.explanations_with_accuracy) || 0,
        explanationsWithProcessingTime: parseInt(row.explanations_with_processing_time) || 0
      };
    } catch (error) {
      logger.error(`Error getting raw database stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get comprehensive dashboard combining accuracy, trustworthiness, and feedback data
   * This is the primary method for dashboard overviews
   */
  async getComprehensiveDashboard(): Promise<ComprehensiveDashboard> {
    try {
      // Get data from each specialized repository
      const [accuracyStats, trustworthinessStats, feedbackStats] = await Promise.all([
        this.accuracyRepo.getPureAccuracyStats(),
        this.trustworthinessRepo.getTrustworthinessStats(),
        this.feedbackRepo.getFeedbackSummaryStats()
      ]);

      // Get performance metrics
      const rawStats = await this.getRawDatabaseStats();

      // Create model comparisons by combining data from all sources
      const modelComparisons = await this.generateModelComparisons();

      return {
        accuracyStats: {
          totalSolverAttempts: accuracyStats.totalSolverAttempts,
          overallAccuracyPercentage: accuracyStats.overallAccuracyPercentage,
          topAccurateModels: accuracyStats.modelAccuracyRankings.slice(0, 5).map(model => ({
            modelName: model.modelName,
            accuracy: model.accuracyPercentage,
            attempts: model.totalAttempts
          }))
        },
        
        trustworthinessStats: {
          totalTrustworthinessAttempts: trustworthinessStats.totalTrustworthinessAttempts,
          overallTrustworthiness: trustworthinessStats.overallTrustworthiness,
          topTrustworthyModels: trustworthinessStats.modelTrustworthinessRankings.slice(0, 5).map(model => ({
            modelName: model.modelName,
            trustworthiness: model.avgTrustworthiness,
            attempts: model.totalAttempts
          }))
        },
        
        feedbackStats: {
          totalFeedback: feedbackStats.totalFeedback,
          helpfulPercentage: feedbackStats.helpfulPercentage,
          topRatedModels: feedbackStats.topModels.slice(0, 5).map(model => ({
            modelName: model.modelName,
            helpfulPercentage: model.feedbackCount > 0 
              ? Math.round((model.helpfulCount / model.feedbackCount) * 100)
              : 0,
            feedbackCount: model.feedbackCount
          }))
        },
        
        modelComparisons,
        
        performanceMetrics: {
          avgProcessingTime: rawStats.avgProcessingTime,
          totalCost: rawStats.totalEstimatedCost,
          avgCostPerAttempt: rawStats.totalExplanations > 0 
            ? Math.round((rawStats.totalEstimatedCost / rawStats.totalExplanations) * 1000000) / 1000000
            : 0
        }
      };
    } catch (error) {
      logger.error(`Error getting comprehensive dashboard: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Generate cross-repository model comparisons
   */
  private async generateModelComparisons(): Promise<ComprehensiveDashboard['modelComparisons']> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      // REFACTORED: Parallel data fetching using repository delegation pattern
      const [accuracyMap, trustworthinessMap, feedbackMap] = await Promise.all([
        this.accuracyRepo.getModelAccuracyMap(),
        this.trustworthinessRepo.getModelTrustworthinessMap(), 
        this.feedbackRepo.getModelFeedbackMap()
      ]);

      // Pure aggregation using centralized business logic
      return this.combineModelComparisons(accuracyMap, trustworthinessMap, feedbackMap);

    } catch (error) {
      logger.error(`Error generating model comparisons: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return [];
    }
  }

  /**
   * Get MODEL RELIABILITY STATS - Technical success rate of API responses
   *
   * This method measures the technical reliability of models by checking if their
   * responses were successfully parsed and stored with essential data.
   *
   * RELIABILITY DEFINITION:
   * A "successful" request is an entry in the `explanations` table where
   * `pattern_description` is NOT NULL and not an empty string. This indicates
   * that the core analysis from the model was received and processed correctly.
   *
   * USE CASES:
   * - Identifying models that frequently return errors or unparsable responses.
   * - Monitoring the technical health of AI provider integrations.
   * - Distinguishing technical failures from incorrect puzzle solutions.
   */
  async getModelReliabilityStats(): Promise<ModelReliabilityStat[]> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty model reliability stats.', 'database');
      return [];
    }

    try {
      const result = await this.query(`
        SELECT
          e.model_name,
          COUNT(*) AS total_requests,
          COUNT(CASE WHEN e.pattern_description IS NOT NULL AND e.pattern_description != '' THEN 1 END) AS successful_requests
        FROM explanations e
        WHERE ${MetricsQueryBuilder.modelFilter()}
        ${MetricsQueryBuilder.modelGroupBy()}
        ORDER BY total_requests DESC
      `);

      return result.rows.map(row => {
        const totalRequests = parseInt(row.total_requests, 10) || 0;
        const successfulRequests = parseInt(row.successful_requests, 10) || 0;
        const failedRequests = totalRequests - successfulRequests;
        const reliability = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

        return {
          modelName: row.model_name,
          totalRequests,
          successfulRequests,
          failedRequests,
          reliability: Math.round(reliability * 100) / 100, // Round to two decimal places
        };
      });
    } catch (error) {
      logger.error(`Error getting model reliability stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  // ==================== HELPER METHODS FOR SRP REFACTORING ====================

  /**
   * Get infrastructure statistics (confidence, explanation counts)
   * Used by getGeneralModelStats() following pure aggregation pattern
   */
  private async getInfrastructureStats(): Promise<{
    totalExplanations: number;
    avgConfidence: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_explanations,
        AVG(confidence) as avg_confidence
      FROM explanations e
      WHERE ${MetricsQueryBuilder.combineConditions(
        'confidence IS NOT NULL',
        MetricsQueryBuilder.modelFilter()
      )}
    `;

    const result = await this.query(query);
    const stats = result.rows[0];

    return {
      totalExplanations: parseInt(stats.total_explanations) || 0,
      avgConfidence: Math.round((parseFloat(stats.avg_confidence) || 0) * 10) / 10
    };
  }

  /**
   * Get model overview statistics for general stats aggregation
   * Returns detailed model breakdown with mixed accuracy/trustworthiness data
   */
  private async getModelOverviewStats(): Promise<ModelOverview[]> {
    const query = `
      SELECT 
        e.model_name,
        COUNT(e.id) as total_attempts,
        AVG(e.confidence) as avg_confidence,
        ${MetricsQueryBuilder.solverAttemptCount()} as solver_attempts,
        ${MetricsQueryBuilder.correctPredictionsCount()} as correct_predictions,
        ${MetricsQueryBuilder.accuracyPercentage(
          MetricsQueryBuilder.correctPredictionsCount(),
          MetricsQueryBuilder.solverAttemptCount()
        )} as solver_accuracy_percentage,
        AVG(e.trustworthiness_score) as avg_trustworthiness_score,
        MIN(e.trustworthiness_score) as min_trustworthiness_score,
        MAX(e.trustworthiness_score) as max_trustworthiness_score,
        COUNT(CASE WHEN e.trustworthiness_score IS NOT NULL THEN 1 END) as trustworthiness_entries
      FROM explanations e
      WHERE ${MetricsQueryBuilder.combineConditions(
        MetricsQueryBuilder.modelFilter(),
        'e.confidence IS NOT NULL'
      )}
      ${MetricsQueryBuilder.modelGroupBy()}
      HAVING COUNT(e.id) >= ${ANALYSIS_CRITERIA.BASIC_STATISTICS.minAttempts}
      ORDER BY solver_accuracy_percentage DESC, total_attempts DESC
    `;

    const result = await this.query(query);

    return result.rows.map(row => ({
      modelName: row.model_name,
      totalAttempts: parseInt(row.total_attempts) || 0,
      totalExplanations: parseInt(row.total_attempts) || 0,
      avgConfidence: Math.round((parseFloat(row.avg_confidence) || 0) * 10) / 10,
      
      // Solver-specific data (subset of total)
      solverAttempts: parseInt(row.solver_attempts) || 0,
      correctPredictions: parseInt(row.correct_predictions) || 0,
      accuracyPercentage: Math.round((parseFloat(row.solver_accuracy_percentage) || 0) * 10) / 10,
      
      // Trustworthiness scores (when available)
      avgTrustworthiness: Math.round((parseFloat(row.avg_trustworthiness_score) || 0) * 10000) / 10000,
      avgAccuracyScore: Math.round((parseFloat(row.avg_trustworthiness_score) || 0) * 10000) / 10000, // Backward compatibility
      minTrustworthiness: Math.round((parseFloat(row.min_trustworthiness_score) || 0) * 10000) / 10000,
      maxTrustworthiness: Math.round((parseFloat(row.max_trustworthiness_score) || 0) * 10000) / 10000,
      trustworthinessEntries: parseInt(row.trustworthiness_entries) || 0,
      
      // For compatibility
      successfulPredictions: parseInt(row.correct_predictions) || 0,
      predictionSuccessRate: Math.round((parseFloat(row.solver_accuracy_percentage) || 0) * 10) / 10
    }));
  }

  /**
   * Combines data from multiple repositories into GeneralModelStats format
   * Pure aggregation function following SRP principle
   */
  private combineGeneralModelStats(
    accuracyStats: BasicAccuracyStats,
    trustworthinessStats: BasicTrustworthinessStats,
    infrastructureStats: { totalExplanations: number; avgConfidence: number },
    modelStats: ModelOverview[]
  ): GeneralModelStats {
    return {
      totalExplanations: infrastructureStats.totalExplanations,
      avgConfidence: infrastructureStats.avgConfidence,
      totalSolverAttempts: accuracyStats.totalSolverAttempts,
      totalCorrectPredictions: accuracyStats.totalCorrectPredictions,
      accuracyByModel: modelStats,
      modelAccuracy: modelStats.map(model => ({
        modelName: model.modelName,
        totalAttempts: model.totalAttempts,
        totalExplanations: model.totalExplanations,
        avgConfidence: model.avgConfidence,
        solverAttempts: model.solverAttempts,
        correctPredictions: model.correctPredictions,
        accuracyPercentage: model.accuracyPercentage,
        avgTrustworthiness: 0,
        avgAccuracyScore: 0,
        minTrustworthiness: 0,
        maxTrustworthiness: 0,
        trustworthinessEntries: 0,
        successfulPredictions: model.correctPredictions,
        predictionSuccessRate: model.accuracyPercentage
      }))
    };
  }

  /**
   * Combines model comparison data from multiple repositories
   * Used by generateModelComparisons() following delegation pattern
   */
  private combineModelComparisons(
    accuracyMap: ModelAccuracyMap,
    trustworthinessMap: ModelTrustworthinessMap,
    feedbackMap: ModelFeedbackMap
  ): ComprehensiveDashboard['modelComparisons'] {
    const allModelNames = new Set([
      ...Object.keys(accuracyMap),
      ...Object.keys(trustworthinessMap),
      ...Object.keys(feedbackMap)
    ]);

    return Array.from(allModelNames).map(modelName => {
      const accuracy = accuracyMap[modelName];
      const trustworthiness = trustworthinessMap[modelName];
      const feedback = feedbackMap[modelName];

      // Calculate cost efficiency using constants
      let costEfficiency = 0;
      if (accuracy && trustworthiness && trustworthiness.trustworthiness > 0) {
        const rawEfficiency = accuracy.attempts / trustworthiness.trustworthiness;
        costEfficiency = Math.min(COST_EFFICIENCY.MAX_EFFICIENCY, Math.max(0, rawEfficiency));
      }

      return {
        modelName,
        accuracy: accuracy?.accuracy || 0,
        trustworthiness: trustworthiness?.trustworthiness || 0,
        userSatisfaction: feedback?.userSatisfaction || 0,
        attempts: Math.max(
          accuracy?.attempts || 0,
          trustworthiness?.attempts || 0,
          feedback?.feedbackCount || 0
        ),
        costEfficiency: Math.round(costEfficiency * 1000000) / 1000000
      };
    });
  }
}