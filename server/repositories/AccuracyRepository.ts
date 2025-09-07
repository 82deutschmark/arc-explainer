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

export class AccuracyRepository extends BaseRepository {
  
  /**
   * Get PURE ACCURACY STATS - only boolean correctness metrics
   * 
   * This method returns TRUE puzzle-solving accuracy without any trustworthiness filtering.
   * Uses only is_prediction_correct and multi_test_all_correct boolean fields.
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
      // Get overall pure accuracy stats
      const overallStats = await this.query(`
        SELECT 
          COUNT(*) as total_solver_attempts,
          SUM(CASE WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct_predictions
        FROM explanations
        WHERE (predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL)
      `);

      // Get pure accuracy by model - NO trustworthiness or confidence filtering
      const modelAccuracy = await this.query(`
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
        GROUP BY e.model_name
        HAVING COUNT(e.id) >= 1
        ORDER BY accuracy_percentage ASC, total_attempts DESC
      `);

      const overallRow = overallStats.rows[0];
      const totalAttempts = parseInt(overallRow.total_solver_attempts) || 0;
      const totalCorrect = parseInt(overallRow.total_correct_predictions) || 0;

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
        GROUP BY e.model_name
        HAVING COUNT(e.id) >= 3  -- Require at least 3 attempts for meaningful ranking
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
}