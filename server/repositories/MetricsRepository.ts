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

export interface AttemptUnionStats {
  baseModelName: string;
  attemptModelNames: string[];
  totalPuzzles: number;
  totalTestPairs: number;
  unionCorrectCount: number;
  unionAccuracyPercentage: number;
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
  accuracyLeaderModel: string | null; // model with highest accuracy
  // NEW: Attempt union stats for comparing attempts of the same base model
  attemptUnionStats: AttemptUnionStats[];
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
    accuracyMap: ModelAccuracyMap,
    preserveRawNames: boolean = false
  ): Map<string, { accuracy: number; attempts: number; correctPredictions: number }> {
    const normalized = new Map<string, { accuracy: number; attempts: number; correctPredictions: number }>();

    for (const [rawName, stats] of Object.entries(accuracyMap)) {
      const modelName = preserveRawNames ? rawName : normalizeModelName(rawName);
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
    trustworthinessMap: ModelTrustworthinessMap,
    preserveRawNames: boolean = false
  ): Map<string, { trustworthiness: number; attempts: number; avgConfidence: number }> {
    const normalized = new Map<string, { trustworthiness: number; attempts: number; avgConfidence: number }>();

    for (const [rawName, stats] of Object.entries(trustworthinessMap)) {
      const modelName = preserveRawNames ? rawName : normalizeModelName(rawName);
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
    feedbackMap: ModelFeedbackMap,
    preserveRawNames: boolean = false
  ): Map<string, { userSatisfaction: number; feedbackCount: number; helpfulCount: number; notHelpfulCount: number }> {
    const normalized = new Map<
      string,
      { userSatisfaction: number; feedbackCount: number; helpfulCount: number; notHelpfulCount: number }
    >();

    for (const [rawName, stats] of Object.entries(feedbackMap)) {
      const modelName = preserveRawNames ? rawName : normalizeModelName(rawName);
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
    costMap: ModelCostMap,
    preserveRawNames: boolean = false
  ): Map<string, { totalCost: number; avgCost: number; attempts: number }> {
    const normalized = new Map<string, { totalCost: number; avgCost: number; attempts: number }>();

    for (const [rawName, stats] of Object.entries(costMap)) {
      const modelName = preserveRawNames ? rawName : normalizeModelName(rawName);
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
  /**
   * Parse a model name to extract base model name and attempt number.
   * Returns null if the model name doesn't follow the attempt pattern.
   */
  private parseAttemptModelName(
    modelName: string,
  ): { baseModelName: string; attemptNumber: number } | null {
    const match = modelName.match(/^(.+)-attempt(\d+)$/);
    if (!match) return null;

    const [, baseModelName, attemptNumberStr] = match;
    const attemptNumber = parseInt(attemptNumberStr, 10);
    
    if (isNaN(attemptNumber) || attemptNumber < 1) return null;

    return { baseModelName, attemptNumber };
  }

  /**
   * Compute attempt union statistics for models that follow the attempt pattern.
   * Returns an array of AttemptUnionStats for each base model with multiple attempts.
   */
  private computeAttemptUnionStats(
    details: PuzzleComparisonDetail[],
    models: string[],
    totalPuzzles: number,
    puzzleRows: Array<{
      puzzle_id: string;
      model_name: string;
      is_correct: boolean | null;
      multi_test_results?: unknown;
    }>,
  ): AttemptUnionStats[] {
    if (details.length === 0 || models.length < 2) {
      return [];
    }

    // Parse model names to identify attempt groups
    const attemptGroups = new Map<string, { modelName: string; attemptNumber: number; index: number }[]>();
    
    models.forEach((modelName, index) => {
      const parsed = this.parseAttemptModelName(modelName);
      if (parsed) {
        if (!attemptGroups.has(parsed.baseModelName)) {
          attemptGroups.set(parsed.baseModelName, []);
        }
        attemptGroups.get(parsed.baseModelName)!.push({
          modelName,
          attemptNumber: parsed.attemptNumber,
          index,
        });
      }
    });

    const attemptUnionStats: AttemptUnionStats[] = [];

    // For each base model group with at least 2 attempts, compute union metrics
    for (const [baseModelName, attempts] of attemptGroups) {
      if (attempts.length >= 2) {
        // Sort by attempt number to ensure consistent ordering
        attempts.sort((a, b) => a.attemptNumber - b.attemptNumber);
        
        // Use the first two attempts for union calculation
        const modelIndices = attempts.slice(0, 2).map(a => a.index);
        const attemptModelNames = attempts.slice(0, 2).map(a => a.modelName);
        
        let unionCorrectCount = 0;
        let totalTestPairs = 0;

        // Iterate through each puzzle and check per-pair correctness (ARC harness style)
        for (const detail of details) {
          const puzzleId = detail.puzzleId;

          // Gather per-attempt results for this puzzle
          const attemptPairs: boolean[][] = modelIndices.map(idx => {
            const modelName = models[idx];
            const row = puzzleRows.find(r => r.puzzle_id === puzzleId && r.model_name === modelName);

            if (!row) return [];

            // Parse multi_test_results if present
            let parsedResults: any[] = [];
            if (Array.isArray(row.multi_test_results)) {
              parsedResults = row.multi_test_results as any[];
            } else if (typeof row.multi_test_results === 'string') {
              try {
                const parsed = JSON.parse(row.multi_test_results);
                if (Array.isArray(parsed)) {
                  parsedResults = parsed;
                }
              } catch (err) {
                logger.warn(`Failed to parse multi_test_results for ${modelName} on ${puzzleId}: ${String(err)}`, 'metrics');
              }
            }

            if (parsedResults.length > 0) {
              return parsedResults.map((r: any) => r?.isPredictionCorrect === true);
            }

            // Fallback to single-test correctness if no multi-test data
            if (typeof row.is_correct === 'boolean') {
              return [row.is_correct];
            }

            return [];
          });

          const pairsForPuzzle = Math.max(...attemptPairs.map(p => p.length), 0);
          if (pairsForPuzzle === 0) {
            continue;
          }

          totalTestPairs += pairsForPuzzle;

          for (let i = 0; i < pairsForPuzzle; i++) {
            const anyAttemptCorrect = attemptPairs.some(pairs => pairs[i] === true);
            if (anyAttemptCorrect) {
              unionCorrectCount++;
            }
          }
        }

        const unionAccuracyPercentage = totalTestPairs > 0 
          ? Math.round((unionCorrectCount / totalTestPairs) * 10000) / 100  // Round to 2 decimal places
          : 0;

        attemptUnionStats.push({
          baseModelName,
          attemptModelNames,
          totalPuzzles,
          totalTestPairs,
          unionCorrectCount,
          unionAccuracyPercentage,
        });
      }
    }

    return attemptUnionStats;
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
          accuracyLeaderModel: null,
          attemptUnionStats: [],
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
            accuracyLeaderModel: null,
            attemptUnionStats: [],
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
          multi_test_results,
          created_at
        FROM explanations
        WHERE model_name = ANY($1::text[]) 
        AND puzzle_id = ANY($2::text[])
        ORDER BY puzzle_id, model_name, created_at DESC
      `;

      const result = await this.query(query, [models, puzzleIds]);

      // CRITICAL FIX: Validate that returned puzzle_ids are actually in our dataset
      // This prevents counting puzzles that exist in DB but not in current dataset
      const validPuzzleIds = new Set(puzzleIds);
      const filteredRows = result.rows.filter(row => validPuzzleIds.has(row.puzzle_id));

      // Log discrepancies for debugging
      const returnedPuzzleIds = new Set(result.rows.map(r => r.puzzle_id));
      const invalidPuzzleIds = Array.from(returnedPuzzleIds).filter(id => !validPuzzleIds.has(id));

      if (invalidPuzzleIds.length > 0) {
        logger.warn(`Found ${invalidPuzzleIds.length} puzzle_ids in DB that don't exist in dataset ${dataset}: ${invalidPuzzleIds.slice(0, 5).join(', ')}${invalidPuzzleIds.length > 5 ? '...' : ''}`, 'metrics');
      }

      logger.info(`Query returned ${result.rows.length} rows, ${filteredRows.length} valid puzzle attempts for ${puzzleIds.length} dataset puzzles`, 'metrics');

      // Build a map of puzzle_id -> model_name -> correctness
      const puzzleModelMap = new Map<string, Map<string, boolean | null>>();

      for (const row of filteredRows) {
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

      // Compute attempt union statistics for attempt models
      const attemptUnionStats = this.computeAttemptUnionStats(details, models, puzzleIds.length, filteredRows);

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
          accuracyLeaderModel: winnerModel,
          attemptUnionStats,
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

      // Fetch the most recent attempt per puzzle/model (matches drilldown logic)
      const attemptQuery = `
        SELECT DISTINCT ON (e.puzzle_id, e.model_name)
          e.puzzle_id,
          e.model_name,
          (e.is_prediction_correct = TRUE OR e.multi_test_all_correct = TRUE) as is_correct,
          e.api_processing_time_ms,
          e.estimated_cost,
          e.confidence
        FROM explanations e
        WHERE e.model_name = ANY($1::text[])
          AND e.puzzle_id = ANY($2::text[])
          AND ${MetricsQueryBuilder.modelFilter()}
          AND ${MetricsQueryBuilder.solverAttemptFilter()}
        ORDER BY e.puzzle_id, e.model_name, e.created_at DESC
      `;

      const attemptResult = await this.query(attemptQuery, [models, puzzleIds]);

      type ModelAccumulator = {
        attempts: number;
        correct: number;
        incorrect: number;
        totalCost: number;
        processingTimeSum: number;
        processingTimeCount: number;
        confidenceSum: number;
        confidenceCount: number;
        correctConfidenceSum: number;
        correctConfidenceCount: number;
      };

      const statsByModel = new Map<string, ModelAccumulator>();

      for (const row of attemptResult.rows) {
        const modelName: string = row.model_name;
        const isCorrect = row.is_correct === true;
        const processingTime = row.api_processing_time_ms !== null ? parseFloat(row.api_processing_time_ms) || 0 : 0;
        const cost = row.estimated_cost !== null ? parseFloat(row.estimated_cost) || 0 : 0;
        const confidence = row.confidence !== null ? parseFloat(row.confidence) : null;

        if (!statsByModel.has(modelName)) {
          statsByModel.set(modelName, {
            attempts: 0,
            correct: 0,
            incorrect: 0,
            totalCost: 0,
            processingTimeSum: 0,
            processingTimeCount: 0,
            confidenceSum: 0,
            confidenceCount: 0,
            correctConfidenceSum: 0,
            correctConfidenceCount: 0
          });
        }

        const stats = statsByModel.get(modelName)!;
        stats.attempts += 1;
        if (isCorrect) {
          stats.correct += 1;
        } else {
          stats.incorrect += 1;
        }

        stats.totalCost += cost;

        if (!Number.isNaN(processingTime)) {
          stats.processingTimeSum += processingTime;
          stats.processingTimeCount += 1;
        }

        if (confidence !== null && !Number.isNaN(confidence)) {
          stats.confidenceSum += confidence;
          stats.confidenceCount += 1;

          if (isCorrect) {
            stats.correctConfidenceSum += confidence;
            stats.correctConfidenceCount += 1;
          }
        }
      }

      return models.map(modelName => {
        const stats = statsByModel.get(modelName);

        if (!stats) {
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

        const attempts = stats.attempts;
        const correctCount = stats.correct;
        const incorrectCount = stats.incorrect;
        const totalCost = stats.totalCost;
        const costPerCorrect = correctCount > 0 ? totalCost / correctCount : null;
        const avgProcessingTime = stats.processingTimeCount > 0
          ? stats.processingTimeSum / stats.processingTimeCount
          : 0;
        const avgConfidence = stats.confidenceCount > 0
          ? stats.confidenceSum / stats.confidenceCount
          : 0;
        const confidenceWhenCorrect = stats.correctConfidenceCount > 0
          ? stats.correctConfidenceSum / stats.correctConfidenceCount
          : null;

        return {
          modelName,
          totalPuzzlesInDataset,
          attempts,
          coveragePercentage: this.round((attempts / totalPuzzlesInDataset) * 100, 2),
          correctCount,
          incorrectCount,
          notAttemptedCount: totalPuzzlesInDataset - attempts,
          accuracyPercentage: attempts > 0 ? this.round((correctCount / attempts) * 100, 2) : 0,
          avgProcessingTime: this.round(avgProcessingTime, 0),
          totalCost: this.round(totalCost, 6),
          avgCostPerAttempt: attempts > 0 ? this.round(totalCost / attempts, 6) : 0,
          costPerCorrectAnswer: costPerCorrect !== null ? this.round(costPerCorrect, 6) : null,
          avgConfidence: this.round(avgConfidence, 2),
          confidenceWhenCorrect: confidenceWhenCorrect !== null ? this.round(confidenceWhenCorrect, 2) : null
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

  /**
   * MOVED FROM ExplanationRepository (Phase 2 architectural fix)
   * Get worst-performing puzzles based on composite scoring
   * Prioritizes incorrect predictions, low accuracy scores, and negative feedback
   * Supports accuracy range filtering
   *
   * This is ANALYTICS work that aggregates across explanations + feedback,
   * not CRUD operations on explanations. Belongs in MetricsRepository.
   */
  async getWorstPerformingPuzzles(
    limit: number = 20,
    sortBy: string = 'composite',
    filters?: {
      minAccuracy?: number;
      maxAccuracy?: number;
      zeroAccuracyOnly?: boolean;
      source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy' | 'ConceptARC';
      multiTestFilter?: 'single' | 'multi';
      includeRichMetrics?: boolean;
    }
  ): Promise<any[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      // Build the HAVING clause based on filters
      let havingConditions = ['COUNT(DISTINCT e.id) > 0'];
      const queryParams = [limit, sortBy];
      let paramIndex = 3;

      if (filters?.zeroAccuracyOnly) {
        // Only show puzzles with zero correct explanations (binary correctness check)
        havingConditions.push(`COUNT(DISTINCT e.id) FILTER (
          WHERE (COALESCE(e.has_multiple_predictions, false) = false AND COALESCE(e.is_prediction_correct, false) = true)
            OR (COALESCE(e.has_multiple_predictions, false) = true AND COALESCE(e.multi_test_all_correct, false) = true)
        ) = 0`);
      } else {
        // Apply accuracy range filters if provided
        if (filters?.minAccuracy !== undefined) {
          havingConditions.push(`AVG(COALESCE(e.trustworthiness_score, e.multi_test_average_accuracy, 0)) >= $${paramIndex}`);
          queryParams.push(filters.minAccuracy);
          paramIndex++;
        }

        if (filters?.maxAccuracy !== undefined) {
          havingConditions.push(`AVG(COALESCE(e.trustworthiness_score, e.multi_test_average_accuracy, 0)) <= $${paramIndex}`);
          queryParams.push(filters.maxAccuracy);
          paramIndex++;
        }

        // If no specific filters, apply different filter logic based on sort type
        if (filters?.minAccuracy === undefined && filters?.maxAccuracy === undefined) {
          if (sortBy === 'confidence') {
            // For confidence sorting, show puzzles with low confidence (1-25%) and exclude 0/null
            havingConditions.push('AVG(e.confidence) > 0 AND AVG(e.confidence) <= 25');
          } else {
            // Original filter logic for other sort types
            havingConditions.push(`(
              COUNT(DISTINCT e.id) FILTER (
                WHERE (COALESCE(e.has_multiple_predictions, false) = false AND COALESCE(e.is_prediction_correct, false) = false)
                  OR (COALESCE(e.has_multiple_predictions, false) = true AND COALESCE(e.multi_test_all_correct, false) = false)
              ) > 0 OR
              AVG(COALESCE(e.trustworthiness_score, e.multi_test_average_accuracy, 0)) < 0.5 OR
              COUNT(f.id) FILTER (WHERE f.feedback_type = 'not_helpful') > 0
            )`);
          }
        }
      }

      // Add source filtering and rich metrics to the query
      let whereConditions = ['e.puzzle_id IS NOT NULL'];

      if (filters?.source) {
        // We need to join with puzzle metadata to filter by source
        // For now, we'll use a subquery to get puzzles from the puzzle service
        // This is a temporary approach until we have puzzle metadata in the database
        whereConditions.push(`e.puzzle_id IN (
          SELECT DISTINCT puzzle_id
          FROM explanations
          WHERE puzzle_id IS NOT NULL
        )`);
      }

      if (filters?.multiTestFilter) {
        if (filters.multiTestFilter === 'single') {
          whereConditions.push('e.has_multiple_predictions = false OR e.has_multiple_predictions IS NULL');
        } else if (filters.multiTestFilter === 'multi') {
          whereConditions.push('e.has_multiple_predictions = true');
        }
      }

      // Build rich metrics selection based on flag
      // OPTIMIZATION: Use COUNT(DISTINCT) instead of STRING_AGG to avoid temp disk overflow
      // STRING_AGG creates large temporary files when aggregating across 4000+ puzzles
      const richMetricsColumns = filters?.includeRichMetrics ? `
        AVG(e.estimated_cost) as avg_cost,
        AVG(e.api_processing_time_ms) as avg_processing_time,
        AVG(e.reasoning_tokens) as avg_reasoning_tokens,
        AVG(e.input_tokens) as avg_input_tokens,
        AVG(e.output_tokens) as avg_output_tokens,
        AVG(e.total_tokens) as avg_total_tokens,
        COUNT(CASE WHEN e.has_multiple_predictions = true THEN 1 END) as multi_test_count,
        COUNT(CASE WHEN e.has_multiple_predictions = false OR e.has_multiple_predictions IS NULL THEN 1 END) as single_test_count,
        MIN(CASE WHEN e.confidence > 0 THEN e.confidence END) as lowest_non_zero_confidence,
        COUNT(DISTINCT e.model_name) as models_attempted_count,
        COUNT(DISTINCT e.reasoning_effort) FILTER (WHERE e.reasoning_effort IS NOT NULL) as reasoning_efforts_count,` : `
        NULL as avg_cost,
        NULL as avg_processing_time,`;

      const result = await this.query(`
        SELECT *
        FROM (
          SELECT
            e.puzzle_id,
            -- CORRECT logic: Use COUNT(DISTINCT) with FILTER to avoid JOIN duplication
            -- Count unique incorrect explanations (puzzle wins = LLM failures)
            COUNT(DISTINCT e.id) FILTER (
              WHERE (COALESCE(e.has_multiple_predictions, false) = false AND COALESCE(e.is_prediction_correct, false) = false)
                OR (COALESCE(e.has_multiple_predictions, false) = true AND COALESCE(e.multi_test_all_correct, false) = false)
            ) as wrong_count,
            AVG(COALESCE(e.trustworthiness_score, e.multi_test_average_accuracy, 0)) as avg_accuracy,
            AVG(e.confidence) as avg_confidence,
            COUNT(DISTINCT e.id) as total_explanations,
            COUNT(f.id) FILTER (WHERE f.feedback_type = 'not_helpful') as negative_feedback,
            COUNT(f.id) as total_feedback,
            MAX(e.created_at) as latest_analysis,
            MIN(e.id) FILTER (
              WHERE (COALESCE(e.has_multiple_predictions, false) = false AND COALESCE(e.is_prediction_correct, false) = false)
                OR (COALESCE(e.has_multiple_predictions, false) = true AND COALESCE(e.multi_test_all_correct, false) = false)
            ) as worst_explanation_id,${richMetricsColumns}
            (
              COUNT(DISTINCT e.id) FILTER (
                WHERE (COALESCE(e.has_multiple_predictions, false) = false AND COALESCE(e.is_prediction_correct, false) = false)
                  OR (COALESCE(e.has_multiple_predictions, false) = true AND COALESCE(e.multi_test_all_correct, false) = false)
              ) * 5.0 +
              CASE WHEN AVG(COALESCE(e.trustworthiness_score, e.multi_test_average_accuracy, 0)) < 0.6 THEN 10.0 ELSE 0.0 END +
              CASE WHEN AVG(e.confidence) < 50 THEN 3.0 ELSE 0.0 END +
              COUNT(f.id) FILTER (WHERE f.feedback_type = 'not_helpful') * 2.0
            ) as composite_score
          FROM explanations e
          LEFT JOIN feedback f ON e.id = f.explanation_id
          WHERE ${whereConditions.join(' AND ')}
          GROUP BY e.puzzle_id
          HAVING ${havingConditions.join(' AND ')}
        ) as performance_data
        ORDER BY
          CASE WHEN $2 = 'composite' THEN performance_data.composite_score END DESC,
          CASE WHEN $2 = 'accuracy' THEN performance_data.avg_accuracy END ASC NULLS LAST,
          CASE WHEN $2 = 'confidence' THEN performance_data.avg_confidence END ASC NULLS LAST,
          CASE WHEN $2 = 'feedback' THEN performance_data.negative_feedback END DESC NULLS LAST,
          CASE WHEN $2 = 'cost' THEN performance_data.avg_cost END DESC NULLS LAST,
          CASE WHEN $2 = 'processing_time' THEN performance_data.avg_processing_time END DESC NULLS LAST
        LIMIT $1
      `, queryParams);

      return result.rows.map(row => {
        const rawAvgAccuracy = parseFloat(row.avg_accuracy);
        const clampedAvgAccuracy = isNaN(rawAvgAccuracy)
          ? 0
          : Math.min(1, Math.max(0, rawAvgAccuracy));

        const baseData = {
          puzzleId: row.puzzle_id,
          wrongCount: parseInt(row.wrong_count) || 0,
          avgAccuracy: clampedAvgAccuracy,
          avgConfidence: parseFloat(row.avg_confidence) || 0,
          totalExplanations: parseInt(row.total_explanations) || 0,
          negativeFeedback: parseInt(row.negative_feedback) || 0,
          totalFeedback: parseInt(row.total_feedback) || 0,
          latestAnalysis: row.latest_analysis,
          worstExplanationId: row.worst_explanation_id,
          compositeScore: parseFloat(row.composite_score) || 0
        };

        // Add rich metrics if requested
        if (filters?.includeRichMetrics) {
          return {
            ...baseData,
            avgCost: parseFloat(row.avg_cost) || 0,
            avgProcessingTime: parseInt(row.avg_processing_time) || 0,
            avgReasoningTokens: parseInt(row.avg_reasoning_tokens) || 0,
            avgInputTokens: parseInt(row.avg_input_tokens) || 0,
            avgOutputTokens: parseInt(row.avg_output_tokens) || 0,
            avgTotalTokens: parseInt(row.avg_total_tokens) || 0,
            multiTestCount: parseInt(row.multi_test_count) || 0,
            singleTestCount: parseInt(row.single_test_count) || 0,
            lowestNonZeroConfidence: parseFloat(row.lowest_non_zero_confidence) || null,
            modelsAttemptedCount: parseInt(row.models_attempted_count) || 0,
            reasoningEffortsCount: parseInt(row.reasoning_efforts_count) || 0
          };
        }

        return baseData;
      });
    } catch (error) {
      logger.error(`Error getting worst-performing puzzles: ${error instanceof Error ? error.message : String(error)}`, 'metrics-repository');
      return [];
    }
  }

}
