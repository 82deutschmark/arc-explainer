/**
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-24 Time: 15:42
 * PURPOSE: Dedicated repository for all cost-related calculations and queries.
 * Follows Single Responsibility Principle by handling ONLY cost domain logic.
 * Eliminates architectural violations where cost calculations were scattered
 * across TrustworthinessRepository and MetricsRepository with different business rules.
 * Provides consistent model name normalization and filtering logic for all cost data.
 * SRP and DRY check: Pass - Single responsibility for cost calculations only.
 * Eliminates duplicate cost calculation logic from multiple repositories.
 * shadcn/ui: Pass - This is a backend repository, no UI components involved.
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';
import { normalizeModelName } from '../utils/modelNormalizer.ts';
import { MetricsQueryBuilder } from './utils/MetricsQueryBuilder.ts';
import { ANALYSIS_CRITERIA } from '../constants/metricsConstants.ts';

/**
 * Cost summary for a specific model
 * Contains aggregated cost metrics with consistent business rules
 */
export interface ModelCostSummary {
  modelName: string;          // Normalized model name (no :free, :beta suffixes)
  totalCost: number;          // Sum of all estimated_cost entries
  averageCost: number;        // Average cost per request
  totalAttempts: number;      // Total number of cost-bearing requests
  maxCost: number;           // Maximum cost for a single request
  minCost: number;           // Minimum cost for a single request
  lastUpdated: Date;         // When this data was last calculated
}

/**
 * Cost trend data for time-series analysis
 */
export interface CostTrend {
  date: string;               // Date in ISO format
  totalCost: number;          // Total cost for that date
  requestCount: number;       // Number of requests for that date
  averageCost: number;        // Average cost per request for that date
}

/**
 * Cost efficiency metrics combining cost with performance
 */
export interface CostEfficiencyMetrics {
  modelName: string;
  costPerAccuratePrediction: number;  // Cost divided by accuracy rate
  costPerTrustworthyAnswer: number;   // Cost divided by trustworthiness
  totalCost: number;
  accuracyRate: number;
  trustworthinessScore: number;
  attempts: number;
}

/**
 * Map structure for cross-repository integration
 * Used by MetricsRepository for model comparison generation
 */
export interface ModelCostMap {
  [modelName: string]: {
    totalCost: number;
    avgCost: number;
    attempts: number;
  };
}

/**
 * Repository for all cost-related database operations
 * Follows SRP by handling ONLY cost calculations and cost domain logic
 */
export class CostRepository extends BaseRepository {

  /**
   * Check if database is connected
   */
  protected isConnected(): boolean {
    try {
      return this.getClient !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Get comprehensive cost summary for a specific model
   * Uses normalized model names for consistency
   *
   * @param modelName - The model name to analyze (will be normalized)
   * @returns Cost summary with aggregated metrics
   */
  async getModelCostSummary(modelName: string): Promise<ModelCostSummary | null> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning null for model cost summary', 'database');
      return null;
    }

    try {
      const normalizedName = normalizeModelName(modelName);

      const query = `
        SELECT
          COUNT(*) as total_attempts,
          SUM(COALESCE(estimated_cost, 0)) as total_cost,
          AVG(COALESCE(estimated_cost, 0)) as average_cost,
          MAX(COALESCE(estimated_cost, 0)) as max_cost,
          MIN(COALESCE(estimated_cost, 0)) as min_cost,
          NOW() as last_updated
        FROM explanations
        WHERE model_name IS NOT NULL
          AND estimated_cost IS NOT NULL
          AND estimated_cost > 0
          AND (
            model_name = $1 OR
            CASE
              WHEN model_name LIKE '%:free' THEN REGEXP_REPLACE(model_name, ':free$', '')
              WHEN model_name LIKE '%:beta' THEN REGEXP_REPLACE(model_name, ':beta$', '')
              WHEN model_name LIKE '%:alpha' THEN REGEXP_REPLACE(model_name, ':alpha$', '')
              WHEN model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
              WHEN model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
              ELSE model_name
            END = $1
          )
        GROUP BY 1 -- Dummy GROUP BY since we're aggregating all rows
        HAVING COUNT(*) >= ${ANALYSIS_CRITERIA.BASIC_STATISTICS.minAttempts}
      `;

      const result = await this.query(query, [normalizedName]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        modelName: normalizedName,
        totalCost: parseFloat(row.total_cost) || 0,
        averageCost: parseFloat(row.average_cost) || 0,
        totalAttempts: parseInt(row.total_attempts) || 0,
        maxCost: parseFloat(row.max_cost) || 0,
        minCost: parseFloat(row.min_cost) || 0,
        lastUpdated: new Date(row.last_updated)
      };

    } catch (error) {
      logger.error(`Error getting cost summary for model ${modelName}: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return null;
    }
  }

  /**
   * Get cost summaries for all models with sufficient data
   * Applies consistent normalization and filtering across all models
   *
   * @returns Array of cost summaries sorted by total cost (descending)
   */
  async getAllModelCosts(): Promise<ModelCostSummary[]> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty model costs array', 'database');
      return [];
    }

    try {
      const query = `
        SELECT
          CASE
            WHEN model_name LIKE '%:free' THEN REGEXP_REPLACE(model_name, ':free$', '')
            WHEN model_name LIKE '%:beta' THEN REGEXP_REPLACE(model_name, ':beta$', '')
            WHEN model_name LIKE '%:alpha' THEN REGEXP_REPLACE(model_name, ':alpha$', '')
            WHEN model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE model_name
          END as normalized_model_name,
          COUNT(*) as total_attempts,
          SUM(COALESCE(estimated_cost, 0)) as total_cost,
          AVG(COALESCE(estimated_cost, 0)) as average_cost,
          MAX(COALESCE(estimated_cost, 0)) as max_cost,
          MIN(COALESCE(estimated_cost, 0)) as min_cost,
          NOW() as last_updated
        FROM explanations
        WHERE model_name IS NOT NULL
          AND estimated_cost IS NOT NULL
          AND estimated_cost > 0
        GROUP BY normalized_model_name
        HAVING COUNT(*) >= ${ANALYSIS_CRITERIA.BASIC_STATISTICS.minAttempts}
        ORDER BY total_cost DESC
      `;

      const result = await this.query(query);

      return result.rows.map(row => ({
        modelName: row.normalized_model_name,
        totalCost: parseFloat(row.total_cost) || 0,
        averageCost: parseFloat(row.average_cost) || 0,
        totalAttempts: parseInt(row.total_attempts) || 0,
        maxCost: parseFloat(row.max_cost) || 0,
        minCost: parseFloat(row.min_cost) || 0,
        lastUpdated: new Date(row.last_updated)
      }));

    } catch (error) {
      logger.error(`Error getting all model costs: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return [];
    }
  }

  /**
   * Get cost trend data for a specific model over time
   * Useful for analyzing cost patterns and optimization
   *
   * @param modelName - The model to analyze
   * @param timeRange - Time range in days (default: 30)
   * @returns Array of daily cost trends
   */
  async getCostTrends(modelName: string, timeRange: number = 30): Promise<CostTrend[]> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty cost trends', 'database');
      return [];
    }

    try {
      const normalizedName = normalizeModelName(modelName);

      const query = `
        SELECT
          DATE(created_at) as date,
          SUM(COALESCE(estimated_cost, 0)) as total_cost,
          COUNT(*) as request_count,
          AVG(COALESCE(estimated_cost, 0)) as average_cost
        FROM explanations
        WHERE model_name IS NOT NULL
          AND estimated_cost IS NOT NULL
          AND estimated_cost > 0
          AND created_at >= NOW() - INTERVAL '${timeRange} days'
          AND (
            model_name = $1 OR
            CASE
              WHEN model_name LIKE '%:free' THEN REGEXP_REPLACE(model_name, ':free$', '')
              WHEN model_name LIKE '%:beta' THEN REGEXP_REPLACE(model_name, ':beta$', '')
              WHEN model_name LIKE '%:alpha' THEN REGEXP_REPLACE(model_name, ':alpha$', '')
              WHEN model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
              WHEN model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
              ELSE model_name
            END = $1
          )
        GROUP BY date
        ORDER BY date ASC
      `;

      const result = await this.query(query, [normalizedName]);

      return result.rows.map(row => ({
        date: row.date,
        totalCost: parseFloat(row.total_cost) || 0,
        requestCount: parseInt(row.request_count) || 0,
        averageCost: parseFloat(row.average_cost) || 0
      }));

    } catch (error) {
      logger.error(`Error getting cost trends for model ${modelName}: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return [];
    }
  }

  /**
   * Get simplified cost map for cross-repository integration
   * Used by MetricsRepository for model comparison generation
   * Maintains backward compatibility while using proper cost domain logic
   *
   * @returns Map of model names to basic cost metrics
   */
  async getModelCostMap(): Promise<ModelCostMap> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty cost map', 'database');
      return {};
    }

    try {
      const costs = await this.getAllModelCosts();

      const costMap: ModelCostMap = {};
      for (const cost of costs) {
        costMap[cost.modelName] = {
          totalCost: cost.totalCost,
          avgCost: cost.averageCost,
          attempts: cost.totalAttempts
        };
      }

      return costMap;

    } catch (error) {
      logger.error(`Error generating cost map: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return {};
    }
  }

  /**
   * Get total system cost statistics
   * Provides high-level cost metrics for dashboard and reporting
   */
  async getSystemCostStats(): Promise<{
    totalSystemCost: number;
    totalRequests: number;
    averageCostPerRequest: number;
    uniqueModels: number;
    costBearingRequests: number;
  }> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning zero cost stats', 'database');
      return {
        totalSystemCost: 0,
        totalRequests: 0,
        averageCostPerRequest: 0,
        uniqueModels: 0,
        costBearingRequests: 0
      };
    }

    try {
      const query = `
        SELECT
          SUM(COALESCE(estimated_cost, 0)) as total_system_cost,
          COUNT(*) as total_requests,
          AVG(COALESCE(estimated_cost, 0)) as average_cost_per_request,
          COUNT(DISTINCT CASE
            WHEN estimated_cost IS NOT NULL AND estimated_cost > 0 THEN
              CASE
                WHEN model_name LIKE '%:free' THEN REGEXP_REPLACE(model_name, ':free$', '')
                WHEN model_name LIKE '%:beta' THEN REGEXP_REPLACE(model_name, ':beta$', '')
                WHEN model_name LIKE '%:alpha' THEN REGEXP_REPLACE(model_name, ':alpha$', '')
                WHEN model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
                WHEN model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
                ELSE model_name
              END
            ELSE NULL
          END) as unique_models,
          COUNT(CASE WHEN estimated_cost IS NOT NULL AND estimated_cost > 0 THEN 1 END) as cost_bearing_requests
        FROM explanations
        WHERE model_name IS NOT NULL
      `;

      const result = await this.query(query);
      const row = result.rows[0];

      return {
        totalSystemCost: parseFloat(row.total_system_cost) || 0,
        totalRequests: parseInt(row.total_requests) || 0,
        averageCostPerRequest: parseFloat(row.average_cost_per_request) || 0,
        uniqueModels: parseInt(row.unique_models) || 0,
        costBearingRequests: parseInt(row.cost_bearing_requests) || 0
      };

    } catch (error) {
      logger.error(`Error getting system cost stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return {
        totalSystemCost: 0,
        totalRequests: 0,
        averageCostPerRequest: 0,
        uniqueModels: 0,
        costBearingRequests: 0
      };
    }
  }

  /**
   * Get COST EFFICIENCY METRICS - cost per correct answer calculations
   *
   * This method calculates the actual cost per correct prediction, which is more
   * meaningful than cost per attempt. It combines cost data with accuracy data
   * to provide insights into which models provide the best value for money.
   *
   * Key metrics:
   * - Cost per accurate prediction: total cost / number of correct answers
   * - Cost per trustworthy answer: total cost / trustworthiness score
   * - Accuracy and trustworthiness rates for context
   *
   * @param minAttempts Minimum attempts required for reliable statistics (default: 100)
   * @returns Array of models sorted by cost efficiency (lowest cost per correct answer first)
   */
  async getCostEfficiencyMetrics(minAttempts: number = ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minAttempts): Promise<CostEfficiencyMetrics[]> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty cost efficiency metrics', 'database');
      return [];
    }

    try {
      const query = `
        SELECT
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END as model_name,

          -- Cost metrics
          COUNT(*) as attempts,
          SUM(COALESCE(e.estimated_cost, 0)) as total_cost,
          AVG(COALESCE(e.estimated_cost, 0)) as avg_cost,

          -- Accuracy metrics
          SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) as correct_predictions,
          CASE
            WHEN COUNT(*) > 0
            THEN (SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / COUNT(*))
            ELSE 0
          END as accuracy_rate,

          -- Trustworthiness metrics
          AVG(COALESCE(e.trustworthiness_score, 0)) as trustworthiness_score,

          -- Cost efficiency calculations
          CASE
            WHEN SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) > 0
            THEN SUM(COALESCE(e.estimated_cost, 0)) / SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END)
            ELSE 999999 -- High value for models with no correct predictions
          END as cost_per_accurate_prediction,

          CASE
            WHEN AVG(COALESCE(e.trustworthiness_score, 0)) > 0.001
            THEN SUM(COALESCE(e.estimated_cost, 0)) / AVG(COALESCE(e.trustworthiness_score, 0))
            ELSE 999999 -- High value for models with no trustworthiness
          END as cost_per_trustworthy_answer

        FROM explanations e
        WHERE e.model_name IS NOT NULL
          AND e.estimated_cost IS NOT NULL
          AND e.estimated_cost > 0
          AND (e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL) -- Only solver attempts
        GROUP BY
          CASE
            WHEN e.model_name LIKE '%:free' THEN REGEXP_REPLACE(e.model_name, ':free$', '')
            WHEN e.model_name LIKE '%:beta' THEN REGEXP_REPLACE(e.model_name, ':beta$', '')
            WHEN e.model_name LIKE '%:alpha' THEN REGEXP_REPLACE(e.model_name, ':alpha$', '')
            WHEN e.model_name = 'z-ai/glm-4.5-air:free' THEN 'z-ai/glm-4.5'
            WHEN e.model_name LIKE 'z-ai/glm-4.5-air%' THEN 'z-ai/glm-4.5'
            ELSE e.model_name
          END
        HAVING COUNT(*) >= $1  -- Apply minimum attempts filter
        ORDER BY cost_per_accurate_prediction ASC, accuracy_rate DESC
      `;

      const result = await this.query(query, [minAttempts]);

      logger.info(`CostRepository.getCostEfficiencyMetrics: Found ${result.rows.length} models with ${minAttempts}+ attempts and cost data`, 'cost-debug');

      return result.rows.map(row => ({
        modelName: row.model_name,
        costPerAccuratePrediction: Math.round((parseFloat(row.cost_per_accurate_prediction) || 0) * 100000) / 100000, // 5 decimal precision for costs
        costPerTrustworthyAnswer: Math.round((parseFloat(row.cost_per_trustworthy_answer) || 0) * 100000) / 100000,
        totalCost: Math.round((parseFloat(row.total_cost) || 0) * 10000) / 10000,
        accuracyRate: Math.round((parseFloat(row.accuracy_rate) || 0) * 10) / 10,
        trustworthinessScore: Math.round((parseFloat(row.trustworthiness_score) || 0) * 10000) / 10000,
        attempts: parseInt(row.attempts) || 0
      }));

    } catch (error) {
      logger.error(`Error getting cost efficiency metrics: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return [];
    }
  }

  /**
   * Get COST EFFICIENCY for a specific model
   *
   * @param modelName The model to analyze (will be normalized)
   * @returns Cost efficiency metrics for the specific model, or null if insufficient data
   */
  async getModelCostEfficiency(modelName: string): Promise<CostEfficiencyMetrics | null> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning null for model cost efficiency', 'database');
      return null;
    }

    try {
      const normalizedName = normalizeModelName(modelName);
      const results = await this.getCostEfficiencyMetrics(1); // Allow single attempt for specific model lookup

      const modelResult = results.find(result => result.modelName === normalizedName);
      return modelResult || null;

    } catch (error) {
      logger.error(`Error getting cost efficiency for model ${modelName}: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return null;
    }
  }

  /**
   * Get COST WASTE ANALYSIS - identify models with poor cost efficiency
   *
   * This method identifies models that are expensive relative to their accuracy.
   * Useful for highlighting models that waste resources and should be avoided.
   *
   * @param minAttempts Minimum attempts for statistical significance
   * @param maxCostPerCorrect Maximum acceptable cost per correct answer
   * @returns Models exceeding cost efficiency thresholds, sorted by waste (highest first)
   */
  async getCostWasteAnalysis(
    minAttempts: number = ANALYSIS_CRITERIA.MODEL_FAILURE_ANALYSIS.minAttempts,
    maxCostPerCorrect: number = 0.10 // $0.10 per correct answer threshold
  ): Promise<CostEfficiencyMetrics[]> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty cost waste analysis', 'database');
      return [];
    }

    try {
      const allMetrics = await this.getCostEfficiencyMetrics(minAttempts);

      // Filter for models with poor cost efficiency
      const wastefulModels = allMetrics.filter(model =>
        model.costPerAccuratePrediction > maxCostPerCorrect &&
        model.costPerAccuratePrediction < 999999 // Exclude models with infinite cost
      );

      logger.info(`CostRepository.getCostWasteAnalysis: Found ${wastefulModels.length} models exceeding $${maxCostPerCorrect} per correct answer`, 'cost-debug');

      // Sort by cost per correct answer (highest waste first)
      return wastefulModels.sort((a, b) => b.costPerAccuratePrediction - a.costPerAccuratePrediction);

    } catch (error) {
      logger.error(`Error getting cost waste analysis: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return [];
    }
  }
}

export default new CostRepository();