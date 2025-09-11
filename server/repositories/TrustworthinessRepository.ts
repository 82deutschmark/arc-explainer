/**
 * Trustworthiness Repository Implementation
 * 
 * Handles AI CONFIDENCE RELIABILITY analysis operations only.
 * Focuses exclusively on how well AI confidence correlates with actual performance.
 * 
 * SCOPE: This repository handles ONE CONCEPT only:
 * - TRUSTWORTHINESS (reliability of AI confidence claims):
 *   - Database field: trustworthiness_score (double precision) - PROPERLY NAMED!
 *   - NOT accuracy! This is a computed metric combining confidence AND correctness
 *   - Measures how well AI confidence correlates with actual performance
 *   - Used for: AI reliability analysis, confidence calibration studies
 *   - This is the PRIMARY METRIC for this research project
 * 
 * KEY DISTINCTIONS:
 * - NO pure puzzle-solving correctness (that's AccuracyRepository)
 * - NO user feedback about explanation quality (that's FeedbackRepository)  
 * - ONLY confidence reliability and calibration analysis
 * 
 * INCLUSION CRITERIA:
 * - Models that have trustworthiness_score values (trustworthiness computed)
 * - Excludes corrupted entries (perfect score with zero confidence)
 * - Focuses on reliability of AI confidence claims, not pure puzzle-solving
 * 
 * @author Claude
 * @date 2025-08-31
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';

export interface TrustworthinessStats {
  totalTrustworthinessAttempts: number;
  overallTrustworthiness: number;
  modelTrustworthinessRankings: ModelTrustworthinessRanking[];
}

export interface ModelTrustworthinessRanking {
  modelName: string;
  totalAttempts: number;
  avgTrustworthiness: number;
  minTrustworthiness: number;
  maxTrustworthiness: number;
  avgConfidence: number;
  trustworthinessEntries: number;
}

export interface ConfidenceStats {
  totalEntriesWithConfidence: number;
  overallAvgConfidence: number;
  avgConfidenceWhenCorrect: number;
  avgConfidenceWhenIncorrect: number;
  confidenceCalibrationGap: number;
  modelConfidenceAnalysis: ModelConfidenceAnalysis[];
}

export interface ModelConfidenceAnalysis {
  modelName: string;
  totalEntries: number;
  avgConfidence: number;
  avgConfidenceWhenCorrect: number;
  avgConfidenceWhenIncorrect: number;
  confidenceRange: number;
  minConfidence: number;
  maxConfidence: number;
  correctPredictions: number;
  incorrectPredictions: number;
}

export interface PerformanceLeaderboards {
  trustworthinessLeaders: TrustworthinessLeader[];
  speedLeaders: SpeedLeader[];
  efficiencyLeaders: EfficiencyLeader[];
  overallTrustworthiness: number;
}

export interface TrustworthinessLeader {
  modelName: string;
  totalAttempts: number;
  avgTrustworthiness: number;
  avgConfidence: number;
  avgProcessingTime: number;
  avgTokens: number;
  avgCost: number;
  totalCost: number;
}

export interface SpeedLeader {
  modelName: string;
  avgProcessingTime: number;
  totalAttempts: number;
  avgTrustworthiness: number;
}

export interface EfficiencyLeader {
  modelName: string;
  costEfficiency: number;
  tokenEfficiency: number;
  avgTrustworthiness: number;
  totalAttempts: number;
}

export class TrustworthinessRepository extends BaseRepository {
  
  /**
   * Get TRUSTWORTHINESS STATS - AI confidence reliability metrics
   * 
   * This method returns data about how well AI confidence correlates with actual performance.
   * Uses only trustworthiness_score field (despite misleading name, this is trustworthiness).
   * 
   * INCLUSION CRITERIA:
   * - Models that have trustworthiness_score values (trustworthiness computed)
   * - Excludes corrupted entries (perfect score with zero confidence)
   * - Focuses on reliability of AI confidence claims, not pure puzzle-solving
   * 
   * TRUSTWORTHINESS CALCULATION:
   * - trustworthiness_score combines confidence claims with actual correctness
   * - Higher scores mean AI confidence better predicts actual performance
   * - This is the PRIMARY METRIC for this research project
   */
  async getTrustworthinessStats(): Promise<TrustworthinessStats> {
    if (!this.isConnected()) {
      return {
        totalTrustworthinessAttempts: 0,
        overallTrustworthiness: 0,
        modelTrustworthinessRankings: []
      };
    }

    try {
      // Get overall trustworthiness stats
      const overallStats = await this.query(`
        SELECT 
          COUNT(*) as total_trustworthiness_attempts,
          AVG(trustworthiness_score) as overall_trustworthiness
        FROM explanations
        WHERE trustworthiness_score IS NOT NULL
          AND NOT (trustworthiness_score = 1.0 AND confidence = 0)
      `);

      // Get trustworthiness by model
      const modelTrustworthiness = await this.query(`
        SELECT 
          e.model_name,
          COUNT(*) as total_attempts,
          AVG(e.trustworthiness_score) as avg_trustworthiness,
          MIN(e.trustworthiness_score) as min_trustworthiness,
          MAX(e.trustworthiness_score) as max_trustworthiness,
          AVG(e.confidence) as avg_confidence,
          COUNT(e.trustworthiness_score) as trustworthiness_entries
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.trustworthiness_score IS NOT NULL
          AND e.confidence IS NOT NULL
          AND NOT (e.trustworthiness_score = 1.0 AND e.confidence = 0)
        GROUP BY e.model_name
        HAVING COUNT(*) >= 1
        ORDER BY avg_trustworthiness DESC, total_attempts DESC
      `);

      const overallRow = overallStats.rows[0];

      return {
        totalTrustworthinessAttempts: parseInt(overallRow.total_trustworthiness_attempts) || 0,
        overallTrustworthiness: Math.round((parseFloat(overallRow.overall_trustworthiness) || 0) * 10000) / 10000,
        modelTrustworthinessRankings: modelTrustworthiness.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts) || 0,
          avgTrustworthiness: Math.round((parseFloat(row.avg_trustworthiness) || 0) * 10000) / 10000,
          minTrustworthiness: Math.round((parseFloat(row.min_trustworthiness) || 0) * 10000) / 10000,
          maxTrustworthiness: Math.round((parseFloat(row.max_trustworthiness) || 0) * 10000) / 10000,
          avgConfidence: Math.round((parseFloat(row.avg_confidence) || 0) * 10) / 10,
          trustworthinessEntries: parseInt(row.trustworthiness_entries) || 0,
        }))
      };
    } catch (error) {
      logger.error(`Error getting trustworthiness stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get CONFIDENCE ANALYSIS STATS - AI confidence patterns
   * 
   * This method analyzes AI confidence levels and patterns across different scenarios.
   * Uses only confidence field to understand AI confidence behavior.
   * 
   * ANALYSIS INCLUDES:
   * - Average confidence when predictions are correct vs incorrect
   * - Confidence distribution patterns by model
   * - Overconfidence vs underconfidence trends
   */
  async getConfidenceStats(): Promise<ConfidenceStats> {
    if (!this.isConnected()) {
      return {
        totalEntriesWithConfidence: 0,
        overallAvgConfidence: 0,
        avgConfidenceWhenCorrect: 0,
        avgConfidenceWhenIncorrect: 0,
        confidenceCalibrationGap: 0,
        modelConfidenceAnalysis: []
      };
    }

    try {
      // Get overall confidence patterns
      const overallStats = await this.query(`
        SELECT 
          COUNT(*) as total_entries_with_confidence,
          AVG(confidence) as overall_avg_confidence,
          AVG(CASE WHEN (is_prediction_correct = true OR multi_test_all_correct = true) THEN confidence END) as avg_confidence_when_correct,
          AVG(CASE WHEN (is_prediction_correct = false AND multi_test_all_correct = false) THEN confidence END) as avg_confidence_when_incorrect
        FROM explanations
        WHERE confidence IS NOT NULL
          AND (predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL)
      `);

      // Get confidence analysis by model
      const modelConfidence = await this.query(`
        SELECT 
          e.model_name,
          COUNT(*) as total_entries,
          AVG(e.confidence) as avg_confidence,
          AVG(CASE WHEN (e.is_prediction_correct = true OR e.multi_test_all_correct = true) THEN e.confidence END) as avg_confidence_when_correct,
          AVG(CASE WHEN (e.is_prediction_correct = false AND e.multi_test_all_correct = false) THEN e.confidence END) as avg_confidence_when_incorrect,
          MIN(e.confidence) as min_confidence,
          MAX(e.confidence) as max_confidence,
          SUM(CASE WHEN (e.is_prediction_correct = true OR e.multi_test_all_correct = true) THEN 1 ELSE 0 END) as correct_predictions,
          SUM(CASE WHEN (e.is_prediction_correct = false AND e.multi_test_all_correct = false) THEN 1 ELSE 0 END) as incorrect_predictions
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.confidence IS NOT NULL
          AND (e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL)
        GROUP BY e.model_name
        HAVING COUNT(*) >= 1
        ORDER BY avg_confidence DESC, total_entries DESC
      `);

      const overallRow = overallStats.rows[0];
      const avgCorrect = parseFloat(overallRow.avg_confidence_when_correct) || 0;
      const avgIncorrect = parseFloat(overallRow.avg_confidence_when_incorrect) || 0;
      const calibrationGap = avgCorrect - avgIncorrect;

      return {
        totalEntriesWithConfidence: parseInt(overallRow.total_entries_with_confidence) || 0,
        overallAvgConfidence: Math.round((parseFloat(overallRow.overall_avg_confidence) || 0) * 10) / 10,
        avgConfidenceWhenCorrect: Math.round(avgCorrect * 10) / 10,
        avgConfidenceWhenIncorrect: Math.round(avgIncorrect * 10) / 10,
        confidenceCalibrationGap: Math.round(calibrationGap * 10) / 10,
        modelConfidenceAnalysis: modelConfidence.rows.map(row => ({
          modelName: row.model_name,
          totalEntries: parseInt(row.total_entries) || 0,
          avgConfidence: Math.round((parseFloat(row.avg_confidence) || 0) * 10) / 10,
          avgConfidenceWhenCorrect: Math.round((parseFloat(row.avg_confidence_when_correct) || 0) * 10) / 10,
          avgConfidenceWhenIncorrect: Math.round((parseFloat(row.avg_confidence_when_incorrect) || 0) * 10) / 10,
          confidenceRange: Math.round(((parseFloat(row.max_confidence) || 0) - (parseFloat(row.min_confidence) || 0)) * 10) / 10,
          minConfidence: Math.round((parseFloat(row.min_confidence) || 0) * 10) / 10,
          maxConfidence: Math.round((parseFloat(row.max_confidence) || 0) * 10) / 10,
          correctPredictions: parseInt(row.correct_predictions) || 0,
          incorrectPredictions: parseInt(row.incorrect_predictions) || 0,
        }))
      };
    } catch (error) {
      logger.error(`Error getting confidence stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get REAL PERFORMANCE STATS - Trustworthiness-focused analysis with performance metrics
   * 
   * This method provides comprehensive performance leaderboards focusing on trustworthiness,
   * processing speed, and cost efficiency relative to confidence reliability.
   */
  async getRealPerformanceStats(): Promise<PerformanceLeaderboards> {
    if (!this.isConnected()) {
      return {
        trustworthinessLeaders: [],
        speedLeaders: [],
        efficiencyLeaders: [],
        overallTrustworthiness: 0
      };
    }

    try {
      // Get trustworthiness leaders using the existing trustworthiness_score field 
      // (which already factors in both correctness and confidence)
      const trustworthinessQuery = await this.query(`
        SELECT 
          e.model_name,
          COUNT(*) as total_attempts,
          AVG(e.trustworthiness_score) as avg_trustworthiness,
          AVG(e.confidence) as avg_confidence,
          AVG(e.api_processing_time_ms) as avg_processing_time,
          AVG(e.total_tokens) as avg_tokens,
          AVG(e.estimated_cost) as avg_cost,
          SUM(e.estimated_cost) as total_cost
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.trustworthiness_score IS NOT NULL
          AND e.confidence IS NOT NULL
          AND NOT (e.trustworthiness_score = 1.0 AND e.confidence = 0) -- Exclude corrupted perfect scores with 0 confidence
        GROUP BY e.model_name
        HAVING COUNT(*) >= 1
        ORDER BY avg_trustworthiness DESC, total_attempts DESC
        LIMIT 10
      `);

      // Get speed leaders (fastest processing times with decent trustworthiness)
      const speedQuery = await this.query(`
        SELECT 
          e.model_name,
          AVG(e.api_processing_time_ms) as avg_processing_time,
          COUNT(*) as total_attempts,
          AVG(e.trustworthiness_score) as avg_trustworthiness
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.api_processing_time_ms IS NOT NULL
          AND e.trustworthiness_score IS NOT NULL
        GROUP BY e.model_name
        HAVING COUNT(*) >= 1
        ORDER BY avg_processing_time ASC
        LIMIT 10
      `);

      // Get efficiency leaders (best cost and token efficiency relative to trustworthiness)
      const efficiencyQuery = await this.query(`
        SELECT 
          e.model_name,
          (
            CASE 
              WHEN AVG(e.trustworthiness_score) > 0.01 
              THEN AVG(e.estimated_cost) / AVG(e.trustworthiness_score)
              ELSE 999999 
            END
          ) as cost_efficiency,
          (
            CASE 
              WHEN AVG(e.trustworthiness_score) > 0.01 
              THEN AVG(e.total_tokens) / AVG(e.trustworthiness_score)
              ELSE 999999 
            END
          ) as token_efficiency,
          AVG(e.trustworthiness_score) as avg_trustworthiness,
          COUNT(*) as total_attempts
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.trustworthiness_score IS NOT NULL
          AND e.estimated_cost IS NOT NULL
          AND e.total_tokens IS NOT NULL
        GROUP BY e.model_name
        HAVING COUNT(*) >= 1
        ORDER BY cost_efficiency ASC
        LIMIT 10
      `);

      // Get overall trustworthiness stats
      const overallQuery = await this.query(`
        SELECT 
          COUNT(*) as total_trustworthiness_attempts,
          AVG(trustworthiness_score) as overall_trustworthiness
        FROM explanations
        WHERE trustworthiness_score IS NOT NULL
      `);

      const overallStats = overallQuery.rows[0];

      return {
        trustworthinessLeaders: trustworthinessQuery.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts) || 0,
          avgTrustworthiness: Math.round((parseFloat(row.avg_trustworthiness) || 0) * 10000) / 10000,
          avgConfidence: Math.round((parseFloat(row.avg_confidence) || 0) * 10) / 10,
          avgProcessingTime: Math.round(parseFloat(row.avg_processing_time) || 0),
          avgTokens: Math.round(parseFloat(row.avg_tokens) || 0),
          avgCost: Math.round((parseFloat(row.avg_cost) || 0) * 1000000) / 1000000,
          totalCost: Math.round((parseFloat(row.total_cost) || 0) * 10000) / 10000,
        })),
        speedLeaders: speedQuery.rows.map(row => ({
          modelName: row.model_name,
          avgProcessingTime: Math.round(parseFloat(row.avg_processing_time) || 0),
          totalAttempts: parseInt(row.total_attempts) || 0,
          avgTrustworthiness: Math.round((parseFloat(row.avg_trustworthiness) || 0) * 10000) / 10000
        })),
        efficiencyLeaders: efficiencyQuery.rows.map(row => ({
          modelName: row.model_name,
          costEfficiency: Math.round((parseFloat(row.cost_efficiency) || 0) * 1000000) / 1000000,
          tokenEfficiency: Math.round(parseFloat(row.token_efficiency) || 0),
          avgTrustworthiness: Math.round((parseFloat(row.avg_trustworthiness) || 0) * 10000) / 10000,
          totalAttempts: parseInt(row.total_attempts) || 0
        })),
        overallTrustworthiness: Math.round((parseFloat(overallStats.overall_trustworthiness) || 0) * 10000) / 10000
      };
    } catch (error) {
      logger.error(`Error getting real performance stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get trustworthiness stats for a specific model
   */
  async getModelTrustworthiness(modelName: string): Promise<ModelTrustworthinessRanking | null> {
    if (!this.isConnected()) {
      return null;
    }

    try {
      const result = await this.query(`
        SELECT 
          e.model_name,
          COUNT(*) as total_attempts,
          AVG(e.trustworthiness_score) as avg_trustworthiness,
          MIN(e.trustworthiness_score) as min_trustworthiness,
          MAX(e.trustworthiness_score) as max_trustworthiness,
          AVG(e.confidence) as avg_confidence,
          COUNT(e.trustworthiness_score) as trustworthiness_entries
        FROM explanations e
        WHERE e.model_name = $1 
          AND e.trustworthiness_score IS NOT NULL
          AND e.confidence IS NOT NULL
          AND NOT (e.trustworthiness_score = 1.0 AND e.confidence = 0)
        GROUP BY e.model_name
      `, [modelName]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        modelName: row.model_name,
        totalAttempts: parseInt(row.total_attempts) || 0,
        avgTrustworthiness: Math.round((parseFloat(row.avg_trustworthiness) || 0) * 10000) / 10000,
        minTrustworthiness: Math.round((parseFloat(row.min_trustworthiness) || 0) * 10000) / 10000,
        maxTrustworthiness: Math.round((parseFloat(row.max_trustworthiness) || 0) * 10000) / 10000,
        avgConfidence: Math.round((parseFloat(row.avg_confidence) || 0) * 10) / 10,
        trustworthinessEntries: parseInt(row.trustworthiness_entries) || 0,
      };
    } catch (error) {
      logger.error(`Error getting model trustworthiness for ${modelName}: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }
}