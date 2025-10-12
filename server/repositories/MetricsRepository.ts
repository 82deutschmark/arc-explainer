/**
 * Metrics Repository Implementation
 * 
 * Aggregates analytics from AccuracyRepository, TrustworthinessRepository, FeedbackRepository,
 * and ModelDatasetRepository.
 * Handles mixed overview metrics and comprehensive dashboard analytics.
 * 
 * SCOPE: This repository handles AGGREGATED ANALYTICS combining:
 * - Pure accuracy data from AccuracyRepository
 * - Trustworthiness data from TrustworthinessRepository  
 * - User feedback data from FeedbackRepository
 * - Dataset puzzle IDs from ModelDatasetRepository (for model comparisons)
 * - Infrastructure/database performance metrics
 * 
 * RESPONSIBILITIES:
 * - Provide unified dashboard overviews combining multiple data sources
 * - Handle mixed analytics that require data from multiple repositories
 * - Infrastructure and performance monitoring metrics
 * - Cross-repository comparative analytics (e.g., multi-model comparisons)
 * 
 * WHAT THIS REPOSITORY DOES NOT HANDLE:
 * - Individual repository concerns (those stay in their respective repositories)
 * - Raw data storage or manipulation (delegates to other repositories)
 * - Dataset discovery or filesystem operations (delegates to ModelDatasetRepository)
 * 
 * This repository follows the Aggregate pattern, coordinating between
 * specialized repositories without duplicating their logic.
 * 
 * ARCHITECTURE FIX (2025-10-10): Removed puzzleLoader dependency and dataset mapping logic.
 * Now properly delegates to ModelDatasetRepository for dataset operations (SRP compliance).
 * 
 * @author Claude / Cascade
 * @date 2025-08-31 (updated 2025-10-10)
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { AccuracyRepository } from './AccuracyRepository.ts';
import { TrustworthinessRepository } from './TrustworthinessRepository.ts';
import { FeedbackRepository } from './FeedbackRepository.ts';
import { CostRepository, type ModelCostMap } from './CostRepository.ts';
import { normalizeModelName } from '../utils/modelNormalizer.ts';
import { logger } from '../utils/logger.ts';
import { MetricsQueryBuilder } from './utils/MetricsQueryBuilder.ts';
import { COST_EFFICIENCY, ANALYSIS_CRITERIA } from '../constants/metricsConstants.ts';
import type { BasicAccuracyStats, ModelAccuracyMap } from './AccuracyRepository.ts';
import type { BasicTrustworthinessStats, ModelTrustworthinessMap } from './TrustworthinessRepository.ts';
import type { ModelFeedbackMap } from './FeedbackRepository.ts';
import { queryCache, CacheKeys, CacheTTL } from '../utils/queryCache.ts';
import { timeQuery, Operations } from '../utils/performanceMonitor.ts';

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
    totalCost: number;
    avgCost: number;
    correctAnswers: number;
    costPerCorrectAnswer: number | null;
  }>;
  
  performanceMetrics: {
    avgProcessingTime: number;
    totalCost: number;
    avgCostPerAttempt: number;
  };
}

export interface PuzzleComparisonDetail {
  puzzleId: string;
  model1Result: 'correct' | 'incorrect' | 'not_attempted';
  model2Result: 'correct' | 'incorrect' | 'not_attempted';
  model3Result?: 'correct' | 'incorrect' | 'not_attempted';
  model4Result?: 'correct' | 'incorrect' | 'not_attempted';
}

export interface ModelPerformanceOnDataset {
  modelName: string;
  totalPuzzlesInDataset: number;
  attempts: number;
  coveragePercentage: number; // attempts / totalPuzzlesInDataset * 100
  correctCount: number;
  incorrectCount: number;
  notAttemptedCount: number;
  accuracyPercentage: number; // correctCount / attempts * 100
  avgProcessingTime: number; // milliseconds
  totalCost: number;
  avgCostPerAttempt: number;
  costPerCorrectAnswer: number | null;
  avgConfidence: number;
  confidenceWhenCorrect: number | null; // trustworthiness metric
}

export interface ModelComparisonSummary {
  totalPuzzles: number;
  model1Name: string;
  model2Name: string;
  model3Name?: string;
  model4Name?: string;
  dataset: string;
  // Agreement counts
  allCorrect: number;
  allIncorrect: number;
  allNotAttempted: number;
  // Partial agreement counts
  threeCorrect?: number;
  twoCorrect?: number;
  oneCorrect?: number;
  // Model-specific counts
  model1OnlyCorrect: number;
  model2OnlyCorrect: number;
  model3OnlyCorrect?: number;
  model4OnlyCorrect?: number;
  // NEW: Per-model performance metrics
  modelPerformance: ModelPerformanceOnDataset[];
  // NEW: Head-to-head insights
  fullySolvedCount: number; // puzzles where at least one model is correct
  unsolvedCount: number; // puzzles where all models are incorrect
  winnerModel: string | null; // model with highest accuracy
  mostEfficientModel: string | null; // model with best cost per correct
  fastestModel: string | null; // model with lowest avg processing time
}

export interface ModelComparisonResult {
  summary: ModelComparisonSummary;
  details: PuzzleComparisonDetail[];
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
  private costRepo: CostRepository;
  
  constructor() {
    super();
    this.accuracyRepo = new AccuracyRepository();
    this.trustworthinessRepo = new TrustworthinessRepository();
    this.feedbackRepo = new FeedbackRepository();
    this.costRepo = new CostRepository();
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
      // Use caching and performance monitoring for this expensive operation
      return await queryCache.get(
        CacheKeys.comprehensiveDashboard(),
        () => timeQuery(Operations.COMPREHENSIVE_DASHBOARD, async () => {
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
        }),
        CacheTTL.DASHBOARD_DATA
      );
    } catch (error) {
      logger.error(`Error getting comprehensive dashboard: ${error instanceof Error ? error.message : String(error)}`, 'database');
      // Return a default/empty structure on error to ensure the app doesn't crash
      return {
        accuracyStats: { totalSolverAttempts: 0, overallAccuracyPercentage: 0, topAccurateModels: [] },
        trustworthinessStats: { totalTrustworthinessAttempts: 0, overallTrustworthiness: 0, topTrustworthyModels: [] },
        feedbackStats: { totalFeedback: 0, helpfulPercentage: 0, topRatedModels: [] },
        modelComparisons: [],
        performanceMetrics: { avgProcessingTime: 0, totalCost: 0, avgCostPerAttempt: 0 }
      };
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
      const [accuracyMap, trustworthinessMap, feedbackMap, costMap] = await Promise.all([
        this.accuracyRepo.getModelAccuracyMap(),
        this.trustworthinessRepo.getModelTrustworthinessMap(),
        this.feedbackRepo.getModelFeedbackMap(),
        this.costRepo.getModelCostMap() // Use proper cost domain repository
      ]);

      // Pure aggregation using centralized business logic
      return this.combineModelComparisons(accuracyMap, trustworthinessMap, feedbackMap, costMap);

    } catch (error) {
      logger.error(`Error generating model comparisons: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return [];
    }
  }


  private combineModelComparisons(
    accuracyMap: ModelAccuracyMap,
    trustworthinessMap: ModelTrustworthinessMap,
    feedbackMap: ModelFeedbackMap,
    costMap: ModelCostMap
  ): ComprehensiveDashboard['modelComparisons'] {
    const normalizedAccuracy = this.normalizeAccuracyMap(accuracyMap);
    const normalizedTrustworthiness = this.normalizeTrustworthinessMap(trustworthinessMap);
    const normalizedFeedback = this.normalizeFeedbackMap(feedbackMap);
    const normalizedCost = this.normalizeCostMap(costMap);

    const allModelNames = new Set<string>([
      ...normalizedAccuracy.keys(),
      ...normalizedTrustworthiness.keys(),
      ...normalizedFeedback.keys(),
      ...normalizedCost.keys()
    ]);

    return Array.from(allModelNames)
      .map(modelName => {
        const accuracy = normalizedAccuracy.get(modelName);
        const trustworthiness = normalizedTrustworthiness.get(modelName);
        const feedback = normalizedFeedback.get(modelName);
        const cost = normalizedCost.get(modelName);

        const attempts = Math.max(
          accuracy?.attempts ?? 0,
          trustworthiness?.attempts ?? 0,
          feedback?.feedbackCount ?? 0,
          cost?.attempts ?? 0
        );

        const correctAnswers = accuracy?.correctPredictions ?? 0;
        const totalCost = cost?.totalCost ?? 0;
        const avgCost = cost?.avgCost ?? 0;
        const costPerCorrect = correctAnswers > 0 ? totalCost / correctAnswers : null;

        return {
          modelName,
          accuracy: accuracy?.accuracy ?? 0,
          trustworthiness: trustworthiness?.trustworthiness ?? 0,
          userSatisfaction: feedback?.userSatisfaction ?? 0,
          attempts,
          totalCost: this.round(totalCost, 6),
          avgCost: this.round(avgCost, 6),
          correctAnswers,
          costPerCorrectAnswer: costPerCorrect !== null ? this.round(costPerCorrect, 6) : null
        };
      })
      .sort((a, b) => b.accuracy - a.accuracy);
  }

  private normalizeAccuracyMap(
    accuracyMap: ModelAccuracyMap
  ): Map<string, { accuracy: number; attempts: number; correctPredictions: number }> {
    const normalized = new Map<string, { accuracy: number; attempts: number; correctPredictions: number }>();

    for (const [rawName, stats] of Object.entries(accuracyMap)) {
      const modelName = normalizeModelName(rawName);
      const attempts = stats?.attempts ?? 0;
      const correctPredictions = stats?.correctPredictions ?? 0;

      if (normalized.has(modelName)) {
        const existing = normalized.get(modelName)!;
        const mergedAttempts = existing.attempts + attempts;
        const mergedCorrect = existing.correctPredictions + correctPredictions;

        normalized.set(modelName, {
          attempts: mergedAttempts,
          correctPredictions: mergedCorrect,
          accuracy: mergedAttempts > 0 ? this.round((mergedCorrect / mergedAttempts) * 100, 2) : 0
        });
      } else {
        normalized.set(modelName, {
          attempts,
          correctPredictions,
          accuracy: attempts > 0 ? this.round((correctPredictions / attempts) * 100, 2) : 0
        });
      }
    }

    return normalized;
  }

  private normalizeTrustworthinessMap(
    trustworthinessMap: ModelTrustworthinessMap
  ): Map<string, { trustworthiness: number; attempts: number; avgConfidence: number }> {
    const normalized = new Map<string, { trustworthiness: number; attempts: number; avgConfidence: number }>();

    for (const [rawName, stats] of Object.entries(trustworthinessMap)) {
      const modelName = normalizeModelName(rawName);
      const attempts = stats?.attempts ?? 0;
      const trustworthiness = stats?.trustworthiness ?? 0;
      const avgConfidence = stats?.avgConfidence ?? 0;

      if (normalized.has(modelName)) {
        const existing = normalized.get(modelName)!;
        const mergedAttempts = existing.attempts + attempts;
        const aggregatedTrustworthiness =
          mergedAttempts > 0
            ? ((existing.trustworthiness * existing.attempts) + (trustworthiness * attempts)) / mergedAttempts
            : 0;
        const aggregatedConfidence =
          mergedAttempts > 0
            ? ((existing.avgConfidence * existing.attempts) + (avgConfidence * attempts)) / mergedAttempts
            : 0;

        normalized.set(modelName, {
          attempts: mergedAttempts,
          trustworthiness: this.round(aggregatedTrustworthiness, 4),
          avgConfidence: this.round(aggregatedConfidence, 2)
        });
      } else {
        normalized.set(modelName, {
          attempts,
          trustworthiness: this.round(trustworthiness, 4),
          avgConfidence: this.round(avgConfidence, 2)
        });
      }
    }

    return normalized;
  }

  private normalizeFeedbackMap(
    feedbackMap: ModelFeedbackMap
  ): Map<string, { userSatisfaction: number; feedbackCount: number; helpfulCount: number; notHelpfulCount: number }> {
    const normalized = new Map<
      string,
      { userSatisfaction: number; feedbackCount: number; helpfulCount: number; notHelpfulCount: number }
    >();

    for (const [rawName, stats] of Object.entries(feedbackMap)) {
      const modelName = normalizeModelName(rawName);
      const feedbackCount = stats?.feedbackCount ?? 0;
      const helpfulCount = stats?.helpfulCount ?? 0;
      const notHelpfulCount = stats?.notHelpfulCount ?? 0;

      if (normalized.has(modelName)) {
        const existing = normalized.get(modelName)!;
        const mergedFeedback = existing.feedbackCount + feedbackCount;
        const mergedHelpful = existing.helpfulCount + helpfulCount;
        const mergedNotHelpful = existing.notHelpfulCount + notHelpfulCount;

        normalized.set(modelName, {
          feedbackCount: mergedFeedback,
          helpfulCount: mergedHelpful,
          notHelpfulCount: mergedNotHelpful,
          userSatisfaction: mergedFeedback > 0 ? this.round((mergedHelpful / mergedFeedback) * 100, 2) : 0
        });
      } else {
        normalized.set(modelName, {
          feedbackCount,
          helpfulCount,
          notHelpfulCount,
          userSatisfaction: feedbackCount > 0 ? this.round((helpfulCount / feedbackCount) * 100, 2) : 0
        });
      }
    }

    return normalized;
  }

  private normalizeCostMap(
    costMap: ModelCostMap
  ): Map<string, { totalCost: number; avgCost: number; attempts: number }> {
    const normalized = new Map<string, { totalCost: number; avgCost: number; attempts: number }>();

    for (const [rawName, stats] of Object.entries(costMap)) {
      const modelName = normalizeModelName(rawName);
      const attempts = stats?.attempts ?? 0;
      const totalCost = stats?.totalCost ?? 0;
      const avgCost = stats?.avgCost ?? 0;

      if (normalized.has(modelName)) {
        const existing = normalized.get(modelName)!;
        const mergedAttempts = existing.attempts + attempts;
        const mergedTotalCost = existing.totalCost + totalCost;

        normalized.set(modelName, {
          attempts: mergedAttempts,
          totalCost: mergedTotalCost,
          avgCost: mergedAttempts > 0 ? this.round(mergedTotalCost / mergedAttempts, 6) : 0
        });
      } else {
        normalized.set(modelName, {
          attempts,
          totalCost,
          avgCost: this.round(avgCost, 6)
        });
      }
    }

    return normalized;
  }

  private round(value: number, precision: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
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

  async getModelComparison(models: string[], dataset: string): Promise<ModelComparisonResult> {
    return this.getMultiModelComparison(models, dataset);
  }
  private async getMultiModelComparison(models: string[], dataset: string): Promise<ModelComparisonResult> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty model comparison.', 'database');
      return {
        summary: {
          totalPuzzles: 0,
          model1Name: models[0] || '',
          model2Name: models[1] || '',
          model3Name: models[2] || '',
          model4Name: models[3] || '',
          dataset: dataset,
          allCorrect: 0,
          allIncorrect: 0,
          allNotAttempted: 0,
          model1OnlyCorrect: 0,
          model2OnlyCorrect: 0,
          modelPerformance: [],
          fullySolvedCount: 0,
          unsolvedCount: 0,
          winnerModel: null,
          mostEfficientModel: null,
          fastestModel: null,
        },
        details: [],
      };
    }

    try {
      const puzzleIds = await this.getPuzzleIdsForDataset(dataset);
      if (puzzleIds.length === 0) {
        logger.warn(`No puzzles found for dataset: ${dataset}`, 'metrics');
        return {
          summary: {
            totalPuzzles: 0,
            model1Name: models[0] || '',
            model2Name: models[1] || '',
            model3Name: models[2] || '',
            model4Name: models[3] || '',
            dataset,
            allCorrect: 0,
            allIncorrect: 0,
            allNotAttempted: 0,
            model1OnlyCorrect: 0,
            model2OnlyCorrect: 0,
            modelPerformance: [],
            fullySolvedCount: 0,
            unsolvedCount: 0,
            winnerModel: null,
            mostEfficientModel: null,
            fastestModel: null,
          },
          details: []
        };
      }

      logger.info(`Comparing ${models.length} models on ${puzzleIds.length} puzzles from ${dataset}`, 'metrics');

      // SIMPLIFIED APPROACH (following puzzleController.analyzeList pattern):
      // Fetch all explanations for these puzzles and models, then build matrix in JavaScript
      // This is more reliable than complex dynamic SQL
      
      const query = `
        SELECT DISTINCT ON (puzzle_id, model_name)
          puzzle_id,
          model_name,
          (is_prediction_correct = TRUE OR multi_test_all_correct = TRUE) as is_correct,
          created_at
        FROM explanations
        WHERE model_name = ANY($1::text[]) 
        AND puzzle_id = ANY($2::text[])
        ORDER BY puzzle_id, model_name, created_at DESC
      `;

      const result = await this.query(query, [models, puzzleIds]);
      
      // Build a map of puzzle_id -> model_name -> correctness
      const puzzleModelMap = new Map<string, Map<string, boolean | null>>();
      
      for (const row of result.rows) {
        if (!puzzleModelMap.has(row.puzzle_id)) {
          puzzleModelMap.set(row.puzzle_id, new Map());
        }
        puzzleModelMap.get(row.puzzle_id)!.set(row.model_name, row.is_correct);
      }

      // Initialize counters
      const summary = {
        allCorrect: 0,
        allIncorrect: 0,
        allNotAttempted: 0,
        threeCorrect: 0,
        twoCorrect: 0,
        oneCorrect: 0,
        model1OnlyCorrect: 0,
        model2OnlyCorrect: 0,
        model3OnlyCorrect: 0,
        model4OnlyCorrect: 0,
      };

      const details: PuzzleComparisonDetail[] = puzzleIds.map(puzzleId => {
        const modelResults = puzzleModelMap.get(puzzleId) || new Map();
        
        // Get result for each model
        const results = models.map((modelName) => {
          const isCorrect = modelResults.get(modelName);
          
          // undefined = never attempted (no DB entry), null/false = attempted but wrong/incomplete
          if (isCorrect === undefined) return 'not_attempted';
          if (isCorrect === true) return 'correct';
          return 'incorrect'; // Covers both false AND null cases
        });

        // Count correct models for this puzzle
        const correctCount = results.filter(r => r === 'correct').length;
        const incorrectCount = results.filter(r => r === 'incorrect').length;
        const notAttemptedCount = results.filter(r => r === 'not_attempted').length;

        // Update summary counters
        if (correctCount === models.length) summary.allCorrect++;
        else if (notAttemptedCount === models.length) summary.allNotAttempted++;
        else if (incorrectCount + notAttemptedCount === models.length) summary.allIncorrect++;
        else if (correctCount === 3 && models.length >= 3) summary.threeCorrect++;
        else if (correctCount === 2 && models.length >= 2) summary.twoCorrect++;
        else if (correctCount === 1) summary.oneCorrect++;

        // Count individual model "only correct" scenarios
        if (correctCount === 1) {
          const onlyCorrectIndex = results.findIndex(r => r === 'correct');
          if (onlyCorrectIndex >= 0 && onlyCorrectIndex < 4) {
            const key = `model${onlyCorrectIndex + 1}OnlyCorrect` as keyof typeof summary;
            if (typeof summary[key] === 'number') {
              (summary[key] as number)++;
            }
          }
        }

        return {
          puzzleId,
          model1Result: results[0] as 'correct' | 'incorrect' | 'not_attempted',
          model2Result: results[1] as 'correct' | 'incorrect' | 'not_attempted',
          ...(models.length >= 3 && { model3Result: results[2] as 'correct' | 'incorrect' | 'not_attempted' }),
          ...(models.length >= 4 && { model4Result: results[3] as 'correct' | 'incorrect' | 'not_attempted' }),
        };
      });

      logger.info(`Comparison complete: ${summary.allCorrect} all correct, ${summary.allIncorrect} all incorrect, ${summary.allNotAttempted} not attempted`, 'metrics');

      // Compute enriched per-model performance metrics
      const modelPerformance = await this.getModelPerformanceOnDataset(models, puzzleIds);

      // Compute head-to-head insights
      const fullySolvedCount = details.filter(d => {
        const results = [d.model1Result, d.model2Result, d.model3Result, d.model4Result]
          .filter(r => r !== undefined);
        return results.some(r => r === 'correct');
      }).length;

      const unsolvedCount = details.filter(d => {
        const results = [d.model1Result, d.model2Result, d.model3Result, d.model4Result]
          .filter(r => r !== undefined);
        return results.every(r => r === 'incorrect' || r === 'not_attempted');
      }).length;

      // Determine winners based on performance metrics
      const winnerModel = modelPerformance.length > 0
        ? modelPerformance.reduce((best, curr) =>
            curr.accuracyPercentage > best.accuracyPercentage ? curr : best
          ).modelName
        : null;

      const mostEfficientModel = modelPerformance
        .filter(m => m.costPerCorrectAnswer !== null && m.correctCount > 0)
        .reduce((best, curr) =>
          (curr.costPerCorrectAnswer! < (best.costPerCorrectAnswer ?? Infinity)) ? curr : best,
          { costPerCorrectAnswer: Infinity } as ModelPerformanceOnDataset
        ).modelName || null;

      const fastestModel = modelPerformance
        .filter(m => m.avgProcessingTime > 0)
        .reduce((best, curr) =>
          curr.avgProcessingTime < best.avgProcessingTime ? curr : best,
          { avgProcessingTime: Infinity } as ModelPerformanceOnDataset
        ).modelName || null;

      return {
        summary: {
          totalPuzzles: puzzleIds.length,
          model1Name: models[0] || '',
          model2Name: models[1] || '',
          model3Name: models[2] || '',
          model4Name: models[3] || '',
          dataset,
          ...summary,
          modelPerformance,
          fullySolvedCount,
          unsolvedCount,
          winnerModel,
          mostEfficientModel,
          fastestModel,
        },
        details
      };

    } catch (error) {
      logger.error(`Error in getModelComparison: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  private async getPuzzleIdsForDataset(dataset: string): Promise<string[]> {
      if (dataset === 'all') {
          const result = await this.query('SELECT DISTINCT puzzle_id FROM explanations ORDER BY puzzle_id');
          return result.rows.map(r => r.puzzle_id);
      }

      // SRP COMPLIANCE: Delegate to ModelDatasetRepository (single source of truth for dataset operations)
      // ModelDatasetRepository owns dataset-to-directory mapping and filesystem access
      // This fixes the bug where puzzleLoader's priority-based filtering excluded valid puzzles
      const { default: modelDatasetRepo } = await import('./ModelDatasetRepository.ts');
      const puzzleIds = modelDatasetRepo.getPuzzleIdsFromDataset(dataset);

      logger.info(`getPuzzleIdsForDataset: dataset=${dataset}, found ${puzzleIds.length} puzzles directly from filesystem`, 'metrics');

      return puzzleIds;
  }

  /**
   * Compute per-model performance metrics for a specific dataset
   * Uses MetricsQueryBuilder patterns for accurate calculations
   */
  private async getModelPerformanceOnDataset(
    models: string[],
    puzzleIds: string[]
  ): Promise<ModelPerformanceOnDataset[]> {
    if (!this.isConnected() || models.length === 0 || puzzleIds.length === 0) {
      return [];
    }

    try {
      const totalPuzzlesInDataset = puzzleIds.length;

      // Query per-model stats using MetricsQueryBuilder patterns
      const query = `
        SELECT
          e.model_name,
          COUNT(DISTINCT e.puzzle_id) as attempts,
          ${MetricsQueryBuilder.correctPredictionsCount()} as correct_count,
          COUNT(*) FILTER (WHERE NOT (${MetricsQueryBuilder.correctnessCalculation()} = 1)) as incorrect_count,
          ${MetricsQueryBuilder.accuracyPercentage(
            MetricsQueryBuilder.correctPredictionsCount(),
            'COUNT(DISTINCT e.puzzle_id)'
          )} as accuracy_percentage,
          AVG(e.api_processing_time_ms) as avg_processing_time,
          SUM(e.estimated_cost) as total_cost,
          AVG(e.estimated_cost) as avg_cost_per_attempt,
          AVG(e.confidence) as avg_confidence,
          AVG(CASE WHEN (${MetricsQueryBuilder.correctnessCalculation()} = 1) THEN e.confidence END) as confidence_when_correct
        FROM explanations e
        WHERE e.model_name = ANY($1::text[])
          AND e.puzzle_id = ANY($2::text[])
          AND ${MetricsQueryBuilder.modelFilter()}
          AND ${MetricsQueryBuilder.solverAttemptFilter()}
        GROUP BY e.model_name
      `;

      const result = await this.query(query, [models, puzzleIds]);

      return models.map(modelName => {
        const row = result.rows.find(r => r.model_name === modelName);

        if (!row) {
          // Model has no attempts on this dataset
          return {
            modelName,
            totalPuzzlesInDataset,
            attempts: 0,
            coveragePercentage: 0,
            correctCount: 0,
            incorrectCount: 0,
            notAttemptedCount: totalPuzzlesInDataset,
            accuracyPercentage: 0,
            avgProcessingTime: 0,
            totalCost: 0,
            avgCostPerAttempt: 0,
            costPerCorrectAnswer: null,
            avgConfidence: 0,
            confidenceWhenCorrect: null
          };
        }

        const attempts = parseInt(row.attempts) || 0;
        const correctCount = parseInt(row.correct_count) || 0;
        const incorrectCount = parseInt(row.incorrect_count) || 0;
        const totalCost = parseFloat(row.total_cost) || 0;
        const costPerCorrect = correctCount > 0 ? totalCost / correctCount : null;

        return {
          modelName,
          totalPuzzlesInDataset,
          attempts,
          coveragePercentage: this.round((attempts / totalPuzzlesInDataset) * 100, 2),
          correctCount,
          incorrectCount,
          notAttemptedCount: totalPuzzlesInDataset - attempts,
          accuracyPercentage: this.round(parseFloat(row.accuracy_percentage) || 0, 2),
          avgProcessingTime: this.round(parseFloat(row.avg_processing_time) || 0, 0),
          totalCost: this.round(totalCost, 6),
          avgCostPerAttempt: this.round(parseFloat(row.avg_cost_per_attempt) || 0, 6),
          costPerCorrectAnswer: costPerCorrect !== null ? this.round(costPerCorrect, 6) : null,
          avgConfidence: this.round(parseFloat(row.avg_confidence) || 0, 2),
          confidenceWhenCorrect: row.confidence_when_correct
            ? this.round(parseFloat(row.confidence_when_correct), 2)
            : null
        };
      });
    } catch (error) {
      logger.error(`Error getting model performance on dataset: ${error instanceof Error ? error.message : String(error)}`, 'metrics');
      return [];
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



}