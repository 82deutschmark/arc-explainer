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
      // Get basic explanation stats - ALL explanations with confidence
      const basicStats = await this.query(`
        SELECT 
          COUNT(*) as total_explanations,
          AVG(confidence) as avg_confidence,
          COUNT(CASE WHEN predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL THEN 1 END) as total_solver_attempts,
          SUM(CASE WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct_predictions
        FROM explanations
        WHERE confidence IS NOT NULL 
      `);

      // Get model performance for ALL models with explanations
      const modelStats = await this.query(`
        SELECT 
          e.model_name,
          COUNT(e.id) as total_attempts,
          AVG(e.confidence) as avg_confidence,
          
          -- Solver mode stats (subset of total attempts)
          COUNT(CASE WHEN e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL THEN 1 END) as solver_attempts,
          SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) as correct_predictions,
          
          -- Trustworthiness scores (when available)
          AVG(e.trustworthiness_score) as avg_trustworthiness_score,
          MIN(e.trustworthiness_score) as min_trustworthiness_score,
          MAX(e.trustworthiness_score) as max_trustworthiness_score,
          COUNT(CASE WHEN e.trustworthiness_score IS NOT NULL THEN 1 END) as trustworthiness_entries,
          
          -- Calculate accuracy percentage for solver attempts only
          CASE 
            WHEN COUNT(CASE WHEN e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL THEN 1 END) > 0 
            THEN (SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / 
                  COUNT(CASE WHEN e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL THEN 1 END))
            ELSE 0 
          END as solver_accuracy_percentage
        FROM explanations e
        WHERE e.model_name IS NOT NULL
          AND e.confidence IS NOT NULL
        GROUP BY e.model_name
        HAVING COUNT(e.id) >= 1  -- Only include models with at least 1 explanation
        ORDER BY solver_accuracy_percentage DESC, total_attempts DESC
      `);

      const stats = basicStats.rows[0];

      return {
        totalExplanations: parseInt(stats.total_explanations) || 0,
        avgConfidence: parseFloat(stats.avg_confidence) || 0,
        totalSolverAttempts: parseInt(stats.total_solver_attempts) || 0,
        totalCorrectPredictions: parseInt(stats.total_correct_predictions) || 0,
        accuracyByModel: modelStats.rows.map(row => ({
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
        })),
        modelAccuracy: modelStats.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts) || 0,
          totalExplanations: parseInt(row.total_attempts) || 0,
          avgConfidence: parseFloat(row.avg_confidence) || 0,
          solverAttempts: parseInt(row.solver_attempts) || 0,
          correctPredictions: parseInt(row.correct_predictions) || 0,
          accuracyPercentage: parseFloat(row.solver_accuracy_percentage) || 0,
          avgTrustworthiness: 0,
          avgAccuracyScore: 0,
          minTrustworthiness: 0,
          maxTrustworthiness: 0,
          trustworthinessEntries: 0,
          successfulPredictions: parseInt(row.correct_predictions) || 0,
          predictionSuccessRate: parseFloat(row.solver_accuracy_percentage) || 0
        }))
      };
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
      // Get comprehensive model data combining all metrics
      const result = await this.query(`
        WITH model_accuracy AS (
          SELECT 
            e.model_name,
            COUNT(CASE WHEN e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL THEN 1 END) as solver_attempts,
            SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) as correct_predictions,
            AVG(e.trustworthiness_score) as avg_trustworthiness,
            AVG(e.estimated_cost) as avg_cost,
            COUNT(*) as total_attempts
          FROM explanations e
          WHERE e.model_name IS NOT NULL
          GROUP BY e.model_name
        ),
        model_feedback AS (
          SELECT 
            e.model_name,
            COUNT(f.id) as feedback_count,
            AVG(CASE WHEN f.feedback_type = 'helpful' THEN 1.0 ELSE 0.0 END) as user_satisfaction
          FROM explanations e
          LEFT JOIN feedback f ON e.id = f.explanation_id
          WHERE e.model_name IS NOT NULL
          GROUP BY e.model_name
        )
        SELECT 
          ma.model_name,
          CASE 
            WHEN ma.solver_attempts > 0 
            THEN (ma.correct_predictions * 100.0 / ma.solver_attempts)
            ELSE 0 
          END as accuracy_percentage,
          COALESCE(ma.avg_trustworthiness, 0) as trustworthiness,
          COALESCE(mf.user_satisfaction * 100, 0) as user_satisfaction_percentage,
          ma.total_attempts,
          CASE 
            WHEN ma.avg_cost IS NULL OR ma.avg_cost = 0 THEN 0
            WHEN ma.avg_trustworthiness IS NULL OR ma.avg_trustworthiness <= 0.001 THEN 999
            WHEN ma.avg_cost / ma.avg_trustworthiness > 999 THEN 999
            ELSE ma.avg_cost / ma.avg_trustworthiness
          END as cost_efficiency
        FROM model_accuracy ma
        LEFT JOIN model_feedback mf ON ma.model_name = mf.model_name
        WHERE ma.total_attempts >= 1  -- Include all models with at least 1 attempt for broader coverage
        ORDER BY accuracy_percentage DESC, trustworthiness DESC
        LIMIT 50  -- Show more models to ensure comprehensive coverage
      `);

      return result.rows.map(row => {
        // Parse and validate raw values
        const rawAccuracy = parseFloat(row.accuracy_percentage) || 0;
        const rawTrustworthiness = parseFloat(row.trustworthiness) || 0;
        const rawUserSatisfaction = parseFloat(row.user_satisfaction_percentage) || 0;
        const rawAttempts = parseInt(row.total_attempts) || 0;
        const rawCostEfficiency = parseFloat(row.cost_efficiency) || 0;
        
        // Log extreme cost efficiency values for monitoring
        if (rawCostEfficiency > 100) {
          logger.warn(`High cost efficiency detected for ${row.model_name}: ${rawCostEfficiency}`, 'metrics');
        }
        
        return {
          modelName: row.model_name,
          accuracy: Math.min(100, Math.max(0, Math.round(rawAccuracy * 10) / 10)), // Clamp to 0-100%
          trustworthiness: Math.min(1, Math.max(0, Math.round(rawTrustworthiness * 10000) / 10000)), // Clamp to 0-1
          userSatisfaction: Math.min(100, Math.max(0, Math.round(rawUserSatisfaction * 10) / 10)), // Clamp to 0-100%
          attempts: Math.max(0, rawAttempts), // Ensure non-negative
          costEfficiency: Math.min(999, Math.max(0, Math.round(rawCostEfficiency * 1000000) / 1000000)) // Cap at $999
        };
      });
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
          model_name,
          COUNT(*) AS total_requests,
          COUNT(CASE WHEN pattern_description IS NOT NULL AND pattern_description != '' THEN 1 END) AS successful_requests
        FROM explanations
        WHERE model_name IS NOT NULL
        GROUP BY model_name
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
}