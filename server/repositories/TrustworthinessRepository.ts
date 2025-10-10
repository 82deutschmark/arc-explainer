/**NEEDS AUDIT!!  This is my idiot implementation of a complex statistic...  please double check.
 * Trustworthiness Repository Implementation
 *
 * Handles AI CONFIDENCE RELIABILITY analysis operations only.
 * Focuses exclusively on how well AI confidence correlates with actual performance.
 *
 * Database field: trustworthiness_score (FLOAT) - measures how well AI confidence predicts correctness
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
import { MetricsQueryBuilder } from './utils/MetricsQueryBuilder.ts';
import { ANALYSIS_CRITERIA } from '../constants/metricsConstants.ts';
import { normalizeModelName } from '../utils/modelNormalizer.ts';

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

/**
 * Basic trustworthiness statistics for MetricsRepository delegation
 * Simplified version of TrustworthinessStats for aggregation purposes
 */
export interface BasicTrustworthinessStats {
  totalTrustworthinessAttempts: number;
  overallTrustworthiness: number;
}

/**
 * Model trustworthiness mapping for cross-repository analytics
 * Used by MetricsRepository for model comparison generation
 */
export interface ModelTrustworthinessMap {
  [modelName: string]: {
    trustworthiness: number;
    attempts: number;
    avgConfidence: number;
  };
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

      // Get trustworthiness by model with normalization
      const modelTrustworthiness = await this.query(`
        SELECT 
          -- Normalize model names (matches modelNormalizer.ts)
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END as model_name,
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
        GROUP BY
          -- Must match SELECT clause normalization (see modelNormalizer.ts)
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END
        HAVING COUNT(*) >= ${ANALYSIS_CRITERIA.BASIC_STATISTICS.minAttempts}
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
        HAVING COUNT(*) >= ${ANALYSIS_CRITERIA.BASIC_STATISTICS.minAttempts}
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
          -- Normalize model names (matches modelNormalizer.ts)
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END as model_name,
          COUNT(*) as total_attempts,
          AVG(e.trustworthiness_score) as avg_trustworthiness,
          AVG(e.confidence) as avg_confidence,
          AVG(e.api_processing_time_ms) as avg_processing_time,
          AVG(e.total_tokens) as avg_tokens
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.trustworthiness_score IS NOT NULL
          AND e.confidence IS NOT NULL
          AND NOT (e.trustworthiness_score = 1.0 AND e.confidence = 0) -- Exclude corrupted perfect scores with 0 confidence
        GROUP BY
          -- Must match SELECT clause normalization (see modelNormalizer.ts)
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END
        HAVING COUNT(*) >= ${ANALYSIS_CRITERIA.BASIC_STATISTICS.minAttempts}
        ORDER BY avg_trustworthiness DESC, total_attempts DESC
      `);

      // Get speed leaders (fastest processing times with decent trustworthiness)
      const speedQuery = await this.query(`
        SELECT 
          -- Normalize model names (matches modelNormalizer.ts)
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END as model_name,
          AVG(e.api_processing_time_ms) as avg_processing_time,
          COUNT(*) as total_attempts,
          AVG(e.trustworthiness_score) as avg_trustworthiness
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.api_processing_time_ms IS NOT NULL
          AND e.trustworthiness_score IS NOT NULL
        GROUP BY
          -- Must match SELECT clause normalization (see modelNormalizer.ts)
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END
        HAVING COUNT(*) >= ${ANALYSIS_CRITERIA.BASIC_STATISTICS.minAttempts}
        ORDER BY avg_processing_time ASC
      `);

      // Get efficiency leaders (best cost and token efficiency relative to trustworthiness)
      const efficiencyQuery = await this.query(`
        SELECT 
          -- Normalize model names (matches modelNormalizer.ts)
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END as model_name,
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
        GROUP BY
          -- Must match SELECT clause normalization (see modelNormalizer.ts)
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END
        HAVING COUNT(*) >= ${ANALYSIS_CRITERIA.BASIC_STATISTICS.minAttempts}
        ORDER BY cost_efficiency ASC
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

  /**
   * Get basic trustworthiness statistics for MetricsRepository delegation
   * 
   * Returns simplified trustworthiness metrics without detailed model breakdowns.
   * Used by MetricsRepository.getGeneralModelStats() for pure aggregation pattern.
   * 
   * Uses MetricsQueryBuilder for DRY compliance and consistent filtering.
   * 
   * @returns {Promise<BasicTrustworthinessStats>} Basic trustworthiness statistics
   */
  async getBasicStats(): Promise<BasicTrustworthinessStats> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty basic trustworthiness stats.', 'database');
      return {
        totalTrustworthinessAttempts: 0,
        overallTrustworthiness: 0
      };
    }

    try {
      const query = `
        SELECT 
          COUNT(*) as total_trustworthiness_attempts,
          AVG(trustworthiness_score) as overall_trustworthiness
        FROM explanations e
        WHERE ${MetricsQueryBuilder.combineConditions(
          MetricsQueryBuilder.modelFilter(),
          MetricsQueryBuilder.trustworthinessFilter()
        )}
      `;

      const result = await this.query(query);
      const stats = result.rows[0];

      return {
        totalTrustworthinessAttempts: parseInt(stats.total_trustworthiness_attempts) || 0,
        overallTrustworthiness: Math.round((parseFloat(stats.overall_trustworthiness) || 0) * 10000) / 10000
      };

    } catch (error) {
      logger.error(`Error getting basic trustworthiness stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get model trustworthiness mapping for cross-repository analytics
   * 
   * Returns a key-value mapping of model names to their trustworthiness statistics.
   * Used by MetricsRepository.generateModelComparisons() for efficient aggregation.
   * 
   * Uses MetricsQueryBuilder for consistent query patterns and ANALYSIS_CRITERIA for standardized filtering.
   * 
   * @returns {Promise<ModelTrustworthinessMap>} Mapping of model names to trustworthiness data
   */
  async getModelTrustworthinessMap(): Promise<ModelTrustworthinessMap> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty model trustworthiness map.', 'database');
      return {};
    }

    try {
      const query = `
        SELECT 
          e.model_name,
          COUNT(*) as attempts,
          AVG(e.trustworthiness_score) as avg_trustworthiness,
          AVG(e.confidence) as avg_confidence
        FROM explanations e
        WHERE ${MetricsQueryBuilder.combineConditions(
          MetricsQueryBuilder.modelFilter(),
          MetricsQueryBuilder.trustworthinessFilter()
        )}
        ${MetricsQueryBuilder.modelGroupBy()}
        HAVING COUNT(*) >= ${ANALYSIS_CRITERIA.TRUSTWORTHINESS_ANALYSIS.requireValidTrustworthiness ? 1 : ANALYSIS_CRITERIA.STANDARD_RANKING.minAttempts}
      `;

      const result = await this.query(query);
      
      const trustworthinessMap: ModelTrustworthinessMap = {};
      
      result.rows.forEach(row => {
        trustworthinessMap[row.model_name] = {
          trustworthiness: Math.round((parseFloat(row.avg_trustworthiness) || 0) * 10000) / 10000,
          attempts: parseInt(row.attempts) || 0,
          avgConfidence: Math.round((parseFloat(row.avg_confidence) || 0) * 100) / 100
        };
      });

      return trustworthinessMap;

    } catch (error) {
      logger.error(`Error getting model trustworthiness map: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get TRUSTWORTHINESS STATS WITH MINIMUM ATTEMPTS - enhanced version with filtering
   *
   * This method extends getTrustworthinessStats() with minimum attempts filtering.
   * Useful for analytics dashboards that want to show only models with sufficient data.
   *
   * @param minAttempts Minimum number of attempts required (default: 100)
   * @returns Trustworthiness statistics filtered by minimum attempts
   */
  async getTrustworthinessStatsWithMinAttempts(minAttempts: number = ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minAttempts): Promise<TrustworthinessStats> {
    if (!this.isConnected()) {
      return {
        totalTrustworthinessAttempts: 0,
        overallTrustworthiness: 0,
        modelTrustworthinessRankings: []
      };
    }

    try {
      // Get overall trustworthiness stats (no filtering by individual model attempts)
      const overallStats = await this.query(`
        SELECT
          COUNT(*) as total_trustworthiness_attempts,
          AVG(trustworthiness_score) as overall_trustworthiness
        FROM explanations
        WHERE trustworthiness_score IS NOT NULL
          AND NOT (trustworthiness_score = 1.0 AND confidence = 0)
      `);

      // Get trustworthiness by model with minimum attempts filtering
      const modelTrustworthiness = await this.query(`
        SELECT
          -- Normalize model names (matches modelNormalizer.ts)
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END as model_name,
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
        GROUP BY
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END
        HAVING COUNT(*) >= $1  -- Apply minimum attempts filter
        ORDER BY avg_trustworthiness DESC, total_attempts DESC
      `, [minAttempts]);

      const overallRow = overallStats.rows[0];

      logger.info(`TrustworthinessRepository.getTrustworthinessStatsWithMinAttempts: Found ${overallRow.total_trustworthiness_attempts} total trustworthiness attempts, ${modelTrustworthiness.rows.length} models with ${minAttempts}+ attempts`, 'trustworthiness-debug');

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
      logger.error(`Error getting trustworthiness stats with min attempts: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get REAL PERFORMANCE STATS WITH MINIMUM ATTEMPTS - enhanced version with filtering
   *
   * This method extends getRealPerformanceStats() with minimum attempts filtering.
   * Useful for analytics dashboards focusing on statistically significant model data.
   *
   * @param minAttempts Minimum number of attempts required (default: 100)
   * @returns Performance statistics filtered by minimum attempts
   */
  async getRealPerformanceStatsWithMinAttempts(minAttempts: number = ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minAttempts): Promise<PerformanceLeaderboards> {
    if (!this.isConnected()) {
      return {
        trustworthinessLeaders: [],
        speedLeaders: [],
        efficiencyLeaders: [],
        overallTrustworthiness: 0
      };
    }

    try {
      // Get trustworthiness leaders with minimum attempts filtering
      const trustworthinessQuery = await this.query(`
        SELECT
          -- Normalize model names (matches modelNormalizer.ts)
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END as model_name,
          COUNT(*) as total_attempts,
          AVG(e.trustworthiness_score) as avg_trustworthiness,
          AVG(e.confidence) as avg_confidence,
          AVG(e.api_processing_time_ms) as avg_processing_time,
          AVG(e.total_tokens) as avg_tokens
        FROM explanations e
        WHERE e.model_name IS NOT NULL
          AND e.trustworthiness_score IS NOT NULL
          AND e.confidence IS NOT NULL
          AND NOT (e.trustworthiness_score = 1.0 AND e.confidence = 0)
        GROUP BY
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END
        HAVING COUNT(*) >= $1  -- Apply minimum attempts filter
        ORDER BY avg_trustworthiness DESC, total_attempts DESC
      `, [minAttempts]);

      // Get speed leaders with minimum attempts filtering
      const speedQuery = await this.query(`
        SELECT
          -- Normalize model names (matches modelNormalizer.ts)
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END as model_name,
          AVG(e.api_processing_time_ms) as avg_processing_time,
          COUNT(*) as total_attempts,
          AVG(e.trustworthiness_score) as avg_trustworthiness
        FROM explanations e
        WHERE e.model_name IS NOT NULL
          AND e.api_processing_time_ms IS NOT NULL
          AND e.trustworthiness_score IS NOT NULL
        GROUP BY
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END
        HAVING COUNT(*) >= $1  -- Apply minimum attempts filter
        ORDER BY avg_processing_time ASC
      `, [minAttempts]);

      // Get efficiency leaders with minimum attempts filtering
      const efficiencyQuery = await this.query(`
        SELECT
          -- Normalize model names (matches modelNormalizer.ts)
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END as model_name,
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
        GROUP BY
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name LIKE '%-beta' THEN REGEXP_REPLACE(e.model_name, '-beta$', '')
            WHEN e.model_name LIKE '%-alpha' THEN REGEXP_REPLACE(e.model_name, '-alpha$', '')
            WHEN e.model_name LIKE 'openrouter/sonoma-sky%' THEN 'x-ai/grok-4-fast'
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END
        HAVING COUNT(*) >= $1  -- Apply minimum attempts filter
        ORDER BY cost_efficiency ASC
      `, [minAttempts]);

      // Get overall trustworthiness stats (no minimum attempts filter for overall stats)
      const overallQuery = await this.query(`
        SELECT
          COUNT(*) as total_trustworthiness_attempts,
          AVG(trustworthiness_score) as overall_trustworthiness
        FROM explanations
        WHERE trustworthiness_score IS NOT NULL
      `);

      const overallStats = overallQuery.rows[0];

      logger.info(`TrustworthinessRepository.getRealPerformanceStatsWithMinAttempts: Found ${trustworthinessQuery.rows.length} trustworthiness leaders, ${speedQuery.rows.length} speed leaders, ${efficiencyQuery.rows.length} efficiency leaders with ${minAttempts}+ attempts`, 'trustworthiness-debug');

      return {
        trustworthinessLeaders: trustworthinessQuery.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts) || 0,
          avgTrustworthiness: Math.round((parseFloat(row.avg_trustworthiness) || 0) * 10000) / 10000,
          avgConfidence: Math.round((parseFloat(row.avg_confidence) || 0) * 10) / 10,
          avgProcessingTime: Math.round(parseFloat(row.avg_processing_time) || 0),
          avgTokens: Math.round(parseFloat(row.avg_tokens) || 0),
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
      logger.error(`Error getting real performance stats with min attempts: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }
}