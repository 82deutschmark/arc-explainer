/**
 * Accuracy Repository Implementation
 * 
 * Handles PURE PUZZLE-SOLVING ACCURACY operations only.
 * Focuses exclusively on boolean correctness metrics without any trustworthiness filtering.
 * 
 * SCOPE: This repository handles ONE CONCEPT only:
 * - PURE ACCURACY (puzzle-solving correctness):
 *   - Whether an AI model actually solved the puzzle correctly (boolean)
 *   - Database field: is_prediction_correct (boolean) - single test correctness
 *   - Database field: multi_test_all_correct (boolean) - multi-test correctness
 *   - Simple percentage: correct predictions / total attempts
 *   - Used for: Actual solver performance stats, accuracy leaderboards
 * 
 * KEY DISTINCTIONS:
 * - NO trustworthiness filtering (prediction_accuracy_score requirements)
 * - NO confidence correlation analysis
 * - NO user feedback about explanation quality
 * - ONLY pure boolean correctness metrics
 * 
 * INCLUSION CRITERIA:
 * - Solver attempts (have prediction grids)
 * - No filtering by confidence or trustworthiness scores
 * - Shows all models, even those without complete metadata
 * 
 * @author Claude
 * @date 2025-08-31
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';
import { MetricsQueryBuilder } from './utils/MetricsQueryBuilder.ts';
import { ANALYSIS_CRITERIA, CONFIDENCE_THRESHOLDS } from '../constants/metricsConstants.ts';
import { normalizeModelName } from '../utils/modelNormalizer.ts';

export interface PureAccuracyStats {
  totalSolverAttempts: number;
  totalCorrectPredictions: number;
  overallAccuracyPercentage: number;
  modelAccuracyRankings: ModelAccuracyRanking[];
}

export interface ModelAccuracyRanking {
  modelName: string;
  totalAttempts: number;
  correctPredictions: number;
  accuracyPercentage: number;
  singleTestAttempts: number;
  singleCorrectPredictions: number;
  singleTestAccuracy: number;
  multiTestAttempts: number;
  multiCorrectPredictions: number;
  multiTestAccuracy: number;
}

export interface DangerousModelRanking {
  modelName: string;
  totalHighConfidenceAttempts: number;
  wrongHighConfidencePredictions: number;
  dangerLevel: number; // Percentage of high-confidence attempts that were wrong
  avgConfidence: number;
  totalAttempts: number;
  overallAccuracy: number;
}

export interface OverconfidentModelRanking {
  modelName: string;
  totalAttempts: number;
  totalOverconfidentAttempts: number; // Attempts with confidence ≥80%
  wrongOverconfidentPredictions: number; // Wrong predictions with confidence ≥80%
  overconfidenceRate: number; // Percentage of overconfident attempts that were wrong
  avgConfidence: number;
  overallAccuracy: number;
  isHighRisk: boolean; // True if accuracy < 50% AND confidence ≥ 80%
}

/**
 * Basic accuracy statistics for MetricsRepository delegation
 * Simplified version of PureAccuracyStats for aggregation purposes
 */
export interface BasicAccuracyStats {
  totalSolverAttempts: number;
  totalCorrectPredictions: number;
  overallAccuracyPercentage: number;
}

/**
 * Model accuracy mapping for cross-repository analytics
 * Used by MetricsRepository for model comparison generation
 */
export interface ModelAccuracyMap {
  [modelName: string]: {
    accuracy: number;
    attempts: number;
    correctPredictions: number;
  };
}

export class AccuracyRepository extends BaseRepository {
  
  /**
   * Get PURE ACCURACY STATS - only boolean correctness metrics
   * 
   * This method returns TRUE puzzle-solving accuracy without any trustworthiness filtering.
   * Uses only is_prediction_correct and multi_test_all_correct boolean fields.
   * 
   * **External Integration**: This endpoint is used by AccuracyLeaderboard component
   * via `/api/feedback/accuracy-stats` to show "Models Needing Improvement".
   * 
   * INCLUSION CRITERIA:
   * - Models that made solver attempts (have prediction grids)
   * - No filtering by prediction_accuracy_score or confidence requirements
   * - Shows all models, even those without trustworthiness data
   * 
   * CORRECTNESS CRITERIA:
   * - is_prediction_correct = true (single test correct)
   * - multi_test_all_correct = true (multi-test correct)
   * - Simple percentage: correct / total attempts
   * 
   * @returns {Promise<PureAccuracyStats>} Accuracy statistics with models sorted by accuracy (ascending - worst first)
   * @external Used by external leaderboard components and analytics dashboards
   */
  async getPureAccuracyStats(): Promise<PureAccuracyStats> {
    if (!this.isConnected()) {
      return {
        totalSolverAttempts: 0,
        totalCorrectPredictions: 0,
        overallAccuracyPercentage: 0,
        modelAccuracyRankings: []
      };
    }

    try {
      // Get overall pure accuracy stats (EXCLUDE REBUTTALS - only count original solver attempts)
      const overallStats = await this.query(`
        SELECT
          COUNT(*) as total_solver_attempts,
          SUM(CASE WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct_predictions
        FROM explanations
        WHERE (predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL)
          AND rebutting_explanation_id IS NULL
      `);

      // Get pure accuracy by model - NO trustworthiness or confidence filtering
      // Use normalization in the GROUP BY to consolidate model variations
      const modelAccuracy = await this.query(`
        SELECT 
          -- Use normalized model name for grouping but show original for reference
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END as model_name,
          COUNT(e.id) as total_attempts,
          
          -- Single test accuracy
          COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END) as single_test_attempts,
          SUM(CASE WHEN e.is_prediction_correct = true THEN 1 ELSE 0 END) as single_correct_predictions,
          
          -- Multi test accuracy
          COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END) as multi_test_attempts,
          SUM(CASE WHEN e.multi_test_all_correct = true THEN 1 ELSE 0 END) as multi_correct_predictions,
          
          -- Overall accuracy
          SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct_predictions,
          
          -- Calculate overall accuracy percentage
          CASE 
            WHEN COUNT(e.id) > 0 
            THEN (SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(e.id))
            ELSE 0 
          END as accuracy_percentage,
          
          -- Single test accuracy percentage
          CASE 
            WHEN COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END) > 0 
            THEN (SUM(CASE WHEN e.is_prediction_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END))
            ELSE 0 
          END as single_test_accuracy_percentage,
          
          -- Multi test accuracy percentage
          CASE 
            WHEN COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END) > 0 
            THEN (SUM(CASE WHEN e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END))
            ELSE 0 
          END as multi_test_accuracy_percentage
        FROM explanations e
        WHERE e.model_name IS NOT NULL
          AND (e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL)
          AND e.rebutting_explanation_id IS NULL
        GROUP BY
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END
        HAVING COUNT(e.id) >= ${ANALYSIS_CRITERIA.BASIC_STATISTICS.minAttempts} AND 
               NOT ((SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(e.id)) = 0 AND COUNT(e.id) < 10)
        ORDER BY accuracy_percentage ASC, total_attempts DESC
      `);

      const overallRow = overallStats.rows[0];
      const totalAttempts = parseInt(overallRow.total_solver_attempts) || 0;
      const totalCorrect = parseInt(overallRow.total_correct_predictions) || 0;

      // Debug logging to identify the issue
      logger.info(`AccuracyRepository.getPureAccuracyStats: Found ${totalAttempts} solver attempts, ${totalCorrect} correct, ${modelAccuracy.rows.length} models with accuracy data`, 'accuracy-debug');
      
      if (modelAccuracy.rows.length === 0) {
        logger.warn('AccuracyRepository.getPureAccuracyStats: No models found with solver attempts. This suggests no prediction data exists in the database.', 'accuracy-debug');
      }

      return {
        totalSolverAttempts: totalAttempts,
        totalCorrectPredictions: totalCorrect,
        overallAccuracyPercentage: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100 * 10) / 10 : 0,
        modelAccuracyRankings: modelAccuracy.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts) || 0,
          correctPredictions: parseInt(row.total_correct_predictions) || 0,
          accuracyPercentage: Math.round((parseFloat(row.accuracy_percentage) || 0) * 10) / 10,
          singleTestAttempts: parseInt(row.single_test_attempts) || 0,
          singleCorrectPredictions: parseInt(row.single_correct_predictions) || 0,
          singleTestAccuracy: Math.round((parseFloat(row.single_test_accuracy_percentage) || 0) * 10) / 10,
          multiTestAttempts: parseInt(row.multi_test_attempts) || 0,
          multiCorrectPredictions: parseInt(row.multi_correct_predictions) || 0,
          multiTestAccuracy: Math.round((parseFloat(row.multi_test_accuracy_percentage) || 0) * 10) / 10,
        }))
      };
    } catch (error) {
      logger.error(`Error getting pure accuracy stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get accuracy stats for a specific model
   */
  async getModelAccuracy(modelName: string): Promise<ModelAccuracyRanking | null> {
    if (!this.isConnected()) {
      return null;
    }

    try {
      const result = await this.query(`
        SELECT 
          e.model_name,
          COUNT(e.id) as total_attempts,
          
          -- Single test accuracy
          COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END) as single_test_attempts,
          SUM(CASE WHEN e.is_prediction_correct = true THEN 1 ELSE 0 END) as single_correct_predictions,
          
          -- Multi test accuracy
          COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END) as multi_test_attempts,
          SUM(CASE WHEN e.multi_test_all_correct = true THEN 1 ELSE 0 END) as multi_correct_predictions,
          
          -- Overall accuracy
          SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct_predictions,
          
          -- Calculate accuracy percentages
          CASE 
            WHEN COUNT(e.id) > 0 
            THEN (SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(e.id))
            ELSE 0 
          END as accuracy_percentage,
          
          CASE 
            WHEN COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END) > 0 
            THEN (SUM(CASE WHEN e.is_prediction_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END))
            ELSE 0 
          END as single_test_accuracy_percentage,
          
          CASE 
            WHEN COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END) > 0 
            THEN (SUM(CASE WHEN e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END))
            ELSE 0 
          END as multi_test_accuracy_percentage
        FROM explanations e
        WHERE e.model_name = $1
          AND (e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL)
          AND e.rebutting_explanation_id IS NULL
        GROUP BY e.model_name
      `, [modelName]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        modelName: row.model_name,
        totalAttempts: parseInt(row.total_attempts) || 0,
        correctPredictions: parseInt(row.total_correct_predictions) || 0,
        accuracyPercentage: Math.round((parseFloat(row.accuracy_percentage) || 0) * 10) / 10,
        singleTestAttempts: parseInt(row.single_test_attempts) || 0,
        singleCorrectPredictions: parseInt(row.single_correct_predictions) || 0,
        singleTestAccuracy: Math.round((parseFloat(row.single_test_accuracy_percentage) || 0) * 10) / 10,
        multiTestAttempts: parseInt(row.multi_test_attempts) || 0,
        multiCorrectPredictions: parseInt(row.multi_correct_predictions) || 0,
        multiTestAccuracy: Math.round((parseFloat(row.multi_test_accuracy_percentage) || 0) * 10) / 10,
      };
    } catch (error) {
      logger.error(`Error getting model accuracy for ${modelName}: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get top performing models by accuracy
   */
  async getTopAccurateModels(limit: number = 10): Promise<ModelAccuracyRanking[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      const result = await this.query(`
        SELECT 
          e.model_name,
          COUNT(e.id) as total_attempts,
          SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct_predictions,
          CASE 
            WHEN COUNT(e.id) > 0 
            THEN (SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(e.id))
            ELSE 0 
          END as accuracy_percentage
        FROM explanations e
        WHERE e.model_name IS NOT NULL
          AND (e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL)
          AND e.rebutting_explanation_id IS NULL
        GROUP BY e.model_name
        HAVING COUNT(e.id) >= ${ANALYSIS_CRITERIA.STANDARD_RANKING.minAttempts}  -- Require at least 3 attempts for meaningful ranking
        ORDER BY accuracy_percentage DESC, total_attempts DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        modelName: row.model_name,
        totalAttempts: parseInt(row.total_attempts) || 0,
        correctPredictions: parseInt(row.total_correct_predictions) || 0,
        accuracyPercentage: Math.round((parseFloat(row.accuracy_percentage) || 0) * 10) / 10,
        singleTestAttempts: 0, // Would need additional query for these details
        singleCorrectPredictions: 0,
        singleTestAccuracy: 0,
        multiTestAttempts: 0,
        multiCorrectPredictions: 0,
        multiTestAccuracy: 0,
      }));
    } catch (error) {
      logger.error(`Error getting top accurate models: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get DANGEROUS MODELS - models with high confidence but wrong predictions
   * 
   * This method identifies overconfident models that are consistently wrong.
   * These are the most dangerous models for users to rely on because they
   * appear confident but produce incorrect results.
   * 
   * CRITERIA:
   * - High confidence (≥90%)
   * - Wrong predictions (is_prediction_correct = false OR multi_test_all_correct = false)
   * - Sorted by number of wrong high-confidence predictions (descending)
   * 
   * @param limit Maximum number of dangerous models to return
   */
  async getDangerousModels(limit: number = 10): Promise<DangerousModelRanking[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      const result = await this.query(`
        SELECT 
          e.model_name,
          
          -- High confidence attempts (≥90%)
          COUNT(CASE WHEN e.confidence >= 90 THEN 1 END) as total_high_confidence_attempts,
          
          -- Wrong high confidence predictions
          COUNT(CASE 
            WHEN e.confidence >= ${CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE} 
            AND (e.is_prediction_correct = false OR e.multi_test_all_correct = false)
            THEN 1 
          END) as wrong_high_confidence_predictions,
          
          -- Danger level: percentage of high-confidence attempts that were wrong
          CASE 
            WHEN COUNT(CASE WHEN e.confidence >= 90 THEN 1 END) > 0
            THEN (COUNT(CASE 
              WHEN e.confidence >= ${CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE} 
              AND (e.is_prediction_correct = false OR e.multi_test_all_correct = false)
              THEN 1 
            END) * 100.0 / COUNT(CASE WHEN e.confidence >= 90 THEN 1 END))
            ELSE 0
          END as danger_level,
          
          -- Average confidence for this model
          AVG(CASE WHEN e.confidence IS NOT NULL THEN e.confidence END) as avg_confidence,
          
          -- Overall stats for context
          COUNT(e.id) as total_attempts,
          SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct,
          
          -- Overall accuracy percentage
          CASE 
            WHEN COUNT(e.id) > 0 
            THEN (SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(e.id))
            ELSE 0 
          END as overall_accuracy_percentage
          
        FROM explanations e
        WHERE e.model_name IS NOT NULL
          AND e.confidence IS NOT NULL
          AND (e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL)
          AND e.rebutting_explanation_id IS NULL
        GROUP BY e.model_name
        HAVING COUNT(CASE WHEN e.confidence >= ${CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE} THEN 1 END) >= ${ANALYSIS_CRITERIA.HIGH_CONFIDENCE_ANALYSIS.minAttempts}  -- At least 3 high-confidence attempts
          AND COUNT(CASE 
            WHEN e.confidence >= ${CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE} 
            AND (e.is_prediction_correct = false OR e.multi_test_all_correct = false)
            THEN 1 
          END) > 0  -- At least 1 wrong high-confidence prediction
        ORDER BY wrong_high_confidence_predictions DESC, danger_level DESC, total_high_confidence_attempts DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        modelName: row.model_name,
        totalHighConfidenceAttempts: parseInt(row.total_high_confidence_attempts) || 0,
        wrongHighConfidencePredictions: parseInt(row.wrong_high_confidence_predictions) || 0,
        dangerLevel: Math.round((parseFloat(row.danger_level) || 0) * 10) / 10,
        avgConfidence: Math.round((parseFloat(row.avg_confidence) || 0) * 10) / 10,
        totalAttempts: parseInt(row.total_attempts) || 0,
        overallAccuracy: Math.round((parseFloat(row.overall_accuracy_percentage) || 0) * 10) / 10,
      }));
    } catch (error) {
      logger.error(`Error getting dangerous models: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get basic accuracy statistics for MetricsRepository delegation
   * 
   * Returns simplified accuracy metrics without detailed model breakdowns.
   * Used by MetricsRepository.getGeneralModelStats() for pure aggregation pattern.
   * 
   * Uses MetricsQueryBuilder for DRY compliance and consistent filtering.
   * 
   * @returns {Promise<BasicAccuracyStats>} Basic accuracy statistics
   */
  async getBasicStats(): Promise<BasicAccuracyStats> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty basic accuracy stats.', 'database');
      return {
        totalSolverAttempts: 0,
        totalCorrectPredictions: 0,
        overallAccuracyPercentage: 0
      };
    }

    try {
      const query = `
        SELECT 
          ${MetricsQueryBuilder.solverAttemptCount()} as total_solver_attempts,
          ${MetricsQueryBuilder.correctPredictionsCount()} as total_correct_predictions,
          ${MetricsQueryBuilder.accuracyPercentage(
            MetricsQueryBuilder.correctPredictionsCount(),
            MetricsQueryBuilder.solverAttemptCount()
          )} as overall_accuracy_percentage
        FROM explanations e
        WHERE ${MetricsQueryBuilder.combineConditions(
          MetricsQueryBuilder.modelFilter(),
          MetricsQueryBuilder.solverAttemptFilter(),
          MetricsQueryBuilder.originalSolverFilter()
        )}
      `;

      const result = await this.query(query);
      const stats = result.rows[0];

      return {
        totalSolverAttempts: parseInt(stats.total_solver_attempts) || 0,
        totalCorrectPredictions: parseInt(stats.total_correct_predictions) || 0,
        overallAccuracyPercentage: Math.round((parseFloat(stats.overall_accuracy_percentage) || 0) * 100) / 100
      };

    } catch (error) {
      logger.error(`Error getting basic accuracy stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get model accuracy mapping for cross-repository analytics
   * 
   * Returns a key-value mapping of model names to their accuracy statistics.
   * Used by MetricsRepository.generateModelComparisons() for efficient aggregation.
   * 
   * Uses MetricsQueryBuilder for consistent query patterns and ANALYSIS_CRITERIA for standardized filtering.
   * 
   * @returns {Promise<ModelAccuracyMap>} Mapping of model names to accuracy data
   */
  async getModelAccuracyMap(): Promise<ModelAccuracyMap> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty model accuracy map.', 'database');
      return {};
    }

    try {
      const query = `
        SELECT 
          e.model_name,
          COUNT(e.id) as attempts,
          ${MetricsQueryBuilder.correctPredictionsCount()} as correct_predictions,
          ${MetricsQueryBuilder.accuracyPercentage(
            MetricsQueryBuilder.correctPredictionsCount(),
            'COUNT(e.id)'
          )} as accuracy
        FROM explanations e
        WHERE ${MetricsQueryBuilder.combineConditions(
          MetricsQueryBuilder.modelFilter(),
          MetricsQueryBuilder.solverAttemptFilter(),
          MetricsQueryBuilder.originalSolverFilter()
        )}
        ${MetricsQueryBuilder.modelGroupBy()}
        HAVING COUNT(e.id) >= ${ANALYSIS_CRITERIA.STANDARD_RANKING.minAttempts}
      `;

      const result = await this.query(query);
      
      const accuracyMap: ModelAccuracyMap = {};
      
      result.rows.forEach(row => {
        accuracyMap[row.model_name] = {
          accuracy: Math.round((parseFloat(row.accuracy) || 0) * 100) / 100,
          attempts: parseInt(row.attempts) || 0,
          correctPredictions: parseInt(row.correct_predictions) || 0
        };
      });

      return accuracyMap;

    } catch (error) {
      logger.error(`Error getting model accuracy map: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get OVERCONFIDENT MODELS - models with high confidence (≥80%) but poor accuracy (<50%)
   *
   * This method identifies overconfident models using enhanced criteria:
   * - Confidence threshold: ≥80% (more inclusive than getDangerousModels)
   * - Poor accuracy: <50% overall accuracy
   * - Minimum attempts: 100+ for statistical significance
   *
   * These models are particularly dangerous because they appear confident
   * but consistently produce poor results, potentially misleading users.
   *
   * @param limit Maximum number of overconfident models to return
   * @returns Array of models ranked by risk level (highest risk first)
   */
  async getOverconfidentModels(limit: number = 15): Promise<OverconfidentModelRanking[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      const result = await this.query(`
        SELECT
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END as model_name,

          -- Total attempts for this model
          COUNT(e.id) as total_attempts,

          -- Overconfident attempts (≥80% confidence)
          COUNT(CASE WHEN e.confidence >= ${ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minConfidence} THEN 1 END) as total_overconfident_attempts,

          -- Wrong overconfident predictions
          COUNT(CASE
            WHEN e.confidence >= ${ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minConfidence}
            AND (e.is_prediction_correct = false OR e.multi_test_all_correct = false)
            THEN 1
          END) as wrong_overconfident_predictions,

          -- Overconfidence rate: percentage of overconfident attempts that were wrong
          CASE
            WHEN COUNT(CASE WHEN e.confidence >= ${ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minConfidence} THEN 1 END) > 0
            THEN (COUNT(CASE
              WHEN e.confidence >= ${ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minConfidence}
              AND (e.is_prediction_correct = false OR e.multi_test_all_correct = false)
              THEN 1
            END) * 100.0 / COUNT(CASE WHEN e.confidence >= ${ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minConfidence} THEN 1 END))
            ELSE 0
          END as overconfidence_rate,

          -- Average confidence for this model
          AVG(CASE WHEN e.confidence IS NOT NULL THEN e.confidence END) as avg_confidence,

          -- Overall accuracy
          CASE
            WHEN COUNT(e.id) > 0
            THEN (SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(e.id))
            ELSE 0
          END as overall_accuracy_percentage

        FROM explanations e
        WHERE e.model_name IS NOT NULL
          AND e.confidence IS NOT NULL
          AND (e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL)
          AND e.rebutting_explanation_id IS NULL
        GROUP BY
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END
        HAVING
          -- Require minimum attempts for statistical significance
          COUNT(e.id) >= ${ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minAttempts}
          -- Must have some overconfident attempts
          AND COUNT(CASE WHEN e.confidence >= ${ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minConfidence} THEN 1 END) > 0
        ORDER BY
          -- First sort by high-risk models (poor accuracy + overconfident)
          CASE WHEN (
            (SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(e.id)) < ${ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.maxAccuracy}
            AND AVG(CASE WHEN e.confidence IS NOT NULL THEN e.confidence END) >= ${ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minConfidence}
          ) THEN 1 ELSE 2 END,
          -- Then by number of wrong overconfident predictions (descending)
          wrong_overconfident_predictions DESC,
          -- Then by overconfidence rate (descending)
          overconfidence_rate DESC,
          -- Finally by total attempts (descending)
          total_attempts DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => {
        const overallAccuracy = parseFloat(row.overall_accuracy_percentage) || 0;
        const avgConfidence = parseFloat(row.avg_confidence) || 0;
        const isHighRisk = overallAccuracy < ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.maxAccuracy &&
                          avgConfidence >= ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minConfidence;

        return {
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts) || 0,
          totalOverconfidentAttempts: parseInt(row.total_overconfident_attempts) || 0,
          wrongOverconfidentPredictions: parseInt(row.wrong_overconfident_predictions) || 0,
          overconfidenceRate: Math.round((parseFloat(row.overconfidence_rate) || 0) * 10) / 10,
          avgConfidence: Math.round(avgConfidence * 10) / 10,
          overallAccuracy: Math.round(overallAccuracy * 10) / 10,
          isHighRisk
        };
      });
    } catch (error) {
      logger.error(`Error getting overconfident models: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get PURE ACCURACY STATS WITH MINIMUM ATTEMPTS - enhanced version with filtering
   *
   * This method extends getPureAccuracyStats() with minimum attempts filtering.
   * Useful for analytics dashboards that want to show only models with sufficient data.
   *
   * @param minAttempts Minimum number of attempts required (default: 100)
   * @returns Accuracy statistics filtered by minimum attempts
   */
  async getPureAccuracyStatsWithMinAttempts(minAttempts: number = ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minAttempts): Promise<PureAccuracyStats> {
    if (!this.isConnected()) {
      return {
        totalSolverAttempts: 0,
        totalCorrectPredictions: 0,
        overallAccuracyPercentage: 0,
        modelAccuracyRankings: []
      };
    }

    try {
      // Get overall pure accuracy stats (no filtering by model attempts, but EXCLUDE REBUTTALS)
      const overallStats = await this.query(`
        SELECT
          COUNT(*) as total_solver_attempts,
          SUM(CASE WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct_predictions
        FROM explanations
        WHERE (predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL)
          AND rebutting_explanation_id IS NULL
      `);

      // Get model accuracy with minimum attempts filtering
      const modelAccuracy = await this.query(`
        SELECT
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END as model_name,
          COUNT(e.id) as total_attempts,

          -- Single test accuracy
          COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END) as single_test_attempts,
          SUM(CASE WHEN e.is_prediction_correct = true THEN 1 ELSE 0 END) as single_correct_predictions,

          -- Multi test accuracy
          COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END) as multi_test_attempts,
          SUM(CASE WHEN e.multi_test_all_correct = true THEN 1 ELSE 0 END) as multi_correct_predictions,

          -- Overall accuracy
          SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct_predictions,

          -- Calculate accuracy percentages
          CASE
            WHEN COUNT(e.id) > 0
            THEN (SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(e.id))
            ELSE 0
          END as accuracy_percentage,

          CASE
            WHEN COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END) > 0
            THEN (SUM(CASE WHEN e.is_prediction_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END))
            ELSE 0
          END as single_test_accuracy_percentage,

          CASE
            WHEN COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END) > 0
            THEN (SUM(CASE WHEN e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END))
            ELSE 0
          END as multi_test_accuracy_percentage
        FROM explanations e
        WHERE e.model_name IS NOT NULL
          AND (e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL)
          AND e.rebutting_explanation_id IS NULL
        GROUP BY
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END
        HAVING COUNT(e.id) >= $1  -- Apply minimum attempts filter
        ORDER BY accuracy_percentage ASC, total_attempts DESC
      `, [minAttempts]);

      const overallRow = overallStats.rows[0];
      const totalAttempts = parseInt(overallRow.total_solver_attempts) || 0;
      const totalCorrect = parseInt(overallRow.total_correct_predictions) || 0;

      logger.info(`AccuracyRepository.getPureAccuracyStatsWithMinAttempts: Found ${totalAttempts} total solver attempts, ${totalCorrect} correct, ${modelAccuracy.rows.length} models with ${minAttempts}+ attempts`, 'accuracy-debug');

      return {
        totalSolverAttempts: totalAttempts,
        totalCorrectPredictions: totalCorrect,
        overallAccuracyPercentage: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100 * 10) / 10 : 0,
        modelAccuracyRankings: modelAccuracy.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts) || 0,
          correctPredictions: parseInt(row.total_correct_predictions) || 0,
          accuracyPercentage: Math.round((parseFloat(row.accuracy_percentage) || 0) * 10) / 10,
          singleTestAttempts: parseInt(row.single_test_attempts) || 0,
          singleCorrectPredictions: parseInt(row.single_correct_predictions) || 0,
          singleTestAccuracy: Math.round((parseFloat(row.single_test_accuracy_percentage) || 0) * 10) / 10,
          multiTestAttempts: parseInt(row.multi_test_attempts) || 0,
          multiCorrectPredictions: parseInt(row.multi_correct_predictions) || 0,
          multiTestAccuracy: Math.round((parseFloat(row.multi_test_accuracy_percentage) || 0) * 10) / 10,
        }))
      };
    } catch (error) {
      logger.error(`Error getting pure accuracy stats with min attempts: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get DEBATE ACCURACY STATS - only for rebuttals/challenges (NOT original solver attempts)
   *
   * This method returns accuracy metrics specifically for debate rebuttals.
   * These are explanations created in response to other (usually incorrect) explanations
   * using the debate prompt template.
   *
   * INCLUSION CRITERIA:
   * - Only rebuttals (rebutting_explanation_id IS NOT NULL)
   * - Models that made solver attempts (have prediction grids)
   *
   * CORRECTNESS CRITERIA:
   * - is_prediction_correct = true (single test correct)
   * - multi_test_all_correct = true (multi-test correct)
   * - Simple percentage: correct / total attempts
   *
   * USE CASES:
   * - Understand which models are good at challenging incorrect explanations
   * - Compare debate performance vs pure solver performance
   * - Identify models that excel at critique vs pure solving
   *
   * @returns {Promise<PureAccuracyStats>} Debate accuracy statistics
   */
  async getDebateAccuracyStats(): Promise<PureAccuracyStats> {
    if (!this.isConnected()) {
      return {
        totalSolverAttempts: 0,
        totalCorrectPredictions: 0,
        overallAccuracyPercentage: 0,
        modelAccuracyRankings: []
      };
    }

    try {
      // Get overall debate accuracy stats (ONLY REBUTTALS - debate challenges)
      const overallStats = await this.query(`
        SELECT
          COUNT(*) as total_solver_attempts,
          SUM(CASE WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct_predictions
        FROM explanations
        WHERE (predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL)
          AND rebutting_explanation_id IS NOT NULL
      `);

      // Get debate accuracy by model - ONLY rebuttals
      const modelAccuracy = await this.query(`
        SELECT
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END as model_name,
          COUNT(e.id) as total_attempts,

          -- Single test accuracy
          COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END) as single_test_attempts,
          SUM(CASE WHEN e.is_prediction_correct = true THEN 1 ELSE 0 END) as single_correct_predictions,

          -- Multi test accuracy
          COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END) as multi_test_attempts,
          SUM(CASE WHEN e.multi_test_all_correct = true THEN 1 ELSE 0 END) as multi_correct_predictions,

          -- Overall accuracy
          SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct_predictions,

          -- Calculate overall accuracy percentage
          CASE
            WHEN COUNT(e.id) > 0
            THEN (SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(e.id))
            ELSE 0
          END as accuracy_percentage,

          -- Single test accuracy percentage
          CASE
            WHEN COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END) > 0
            THEN (SUM(CASE WHEN e.is_prediction_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END))
            ELSE 0
          END as single_test_accuracy_percentage,

          -- Multi test accuracy percentage
          CASE
            WHEN COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END) > 0
            THEN (SUM(CASE WHEN e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END))
            ELSE 0
          END as multi_test_accuracy_percentage
        FROM explanations e
        WHERE e.model_name IS NOT NULL
          AND (e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL)
          AND e.rebutting_explanation_id IS NOT NULL
        GROUP BY
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END
        HAVING COUNT(e.id) >= ${ANALYSIS_CRITERIA.BASIC_STATISTICS.minAttempts}
        ORDER BY accuracy_percentage DESC, total_attempts DESC
      `);

      const overallRow = overallStats.rows[0];
      const totalAttempts = parseInt(overallRow.total_solver_attempts) || 0;
      const totalCorrect = parseInt(overallRow.total_correct_predictions) || 0;

      logger.info(`AccuracyRepository.getDebateAccuracyStats: Found ${totalAttempts} debate attempts, ${totalCorrect} correct, ${modelAccuracy.rows.length} models with debate data`, 'debate-accuracy-debug');

      return {
        totalSolverAttempts: totalAttempts,
        totalCorrectPredictions: totalCorrect,
        overallAccuracyPercentage: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100 * 10) / 10 : 0,
        modelAccuracyRankings: modelAccuracy.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts) || 0,
          correctPredictions: parseInt(row.total_correct_predictions) || 0,
          accuracyPercentage: Math.round((parseFloat(row.accuracy_percentage) || 0) * 10) / 10,
          singleTestAttempts: parseInt(row.single_test_attempts) || 0,
          singleCorrectPredictions: parseInt(row.single_correct_predictions) || 0,
          singleTestAccuracy: Math.round((parseFloat(row.single_test_accuracy_percentage) || 0) * 10) / 10,
          multiTestAttempts: parseInt(row.multi_test_attempts) || 0,
          multiCorrectPredictions: parseInt(row.multi_correct_predictions) || 0,
          multiTestAccuracy: Math.round((parseFloat(row.multi_test_accuracy_percentage) || 0) * 10) / 10,
        }))
      };
    } catch (error) {
      logger.error(`Error getting debate accuracy stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get debate performance for a specific model
   *
   * Returns accuracy stats for a model's debate rebuttals only.
   * Useful for comparing a model's solver vs debate performance.
   *
   * @param modelName The model to get debate stats for
   * @returns {Promise<ModelAccuracyRanking | null>} Model debate stats or null if no data
   */
  async getModelDebatePerformance(modelName: string): Promise<ModelAccuracyRanking | null> {
    if (!this.isConnected()) {
      return null;
    }

    try {
      const result = await this.query(`
        SELECT
          e.model_name,
          COUNT(e.id) as total_attempts,

          -- Single test accuracy
          COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END) as single_test_attempts,
          SUM(CASE WHEN e.is_prediction_correct = true THEN 1 ELSE 0 END) as single_correct_predictions,

          -- Multi test accuracy
          COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END) as multi_test_attempts,
          SUM(CASE WHEN e.multi_test_all_correct = true THEN 1 ELSE 0 END) as multi_correct_predictions,

          -- Overall accuracy
          SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct_predictions,

          -- Calculate accuracy percentages
          CASE
            WHEN COUNT(e.id) > 0
            THEN (SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(e.id))
            ELSE 0
          END as accuracy_percentage,

          CASE
            WHEN COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END) > 0
            THEN (SUM(CASE WHEN e.is_prediction_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END))
            ELSE 0
          END as single_test_accuracy_percentage,

          CASE
            WHEN COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END) > 0
            THEN (SUM(CASE WHEN e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END))
            ELSE 0
          END as multi_test_accuracy_percentage
        FROM explanations e
        WHERE e.model_name = $1
          AND (e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL)
          AND e.rebutting_explanation_id IS NOT NULL
        GROUP BY e.model_name
      `, [modelName]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        modelName: row.model_name,
        totalAttempts: parseInt(row.total_attempts) || 0,
        correctPredictions: parseInt(row.total_correct_predictions) || 0,
        accuracyPercentage: Math.round((parseFloat(row.accuracy_percentage) || 0) * 10) / 10,
        singleTestAttempts: parseInt(row.single_test_attempts) || 0,
        singleCorrectPredictions: parseInt(row.single_correct_predictions) || 0,
        singleTestAccuracy: Math.round((parseFloat(row.single_test_accuracy_percentage) || 0) * 10) / 10,
        multiTestAttempts: parseInt(row.multi_test_attempts) || 0,
        multiCorrectPredictions: parseInt(row.multi_correct_predictions) || 0,
        multiTestAccuracy: Math.round((parseFloat(row.multi_test_accuracy_percentage) || 0) * 10) / 10,
      };
    } catch (error) {
      logger.error(`Error getting model debate performance for ${modelName}: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }
}