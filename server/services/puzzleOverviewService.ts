/**
 * puzzleOverviewService.ts
 * 
 * Service for handling puzzle overview data processing.
 * Extracts complex overview logic from controller including sorting, pagination, and data enrichment.
 * 
 * @author Claude Code
 */

import { repositoryService } from '../repositories/RepositoryService';
import { puzzleService } from './puzzleService';
import { puzzleFilterService } from './puzzleFilterService';
import { logger } from '../utils/logger';
import type { ExplanationFilters } from './puzzleFilterService';

export interface OverviewResult {
  puzzles: any[];
  total: number;
  hasMore: boolean;
}

export interface SortOptions {
  sortBy: string;
  sortOrder: string;
}

export class PuzzleOverviewService {
  /**
   * Create basic puzzle overview structure (for when database is not available)
   */
  createBasicOverview(allPuzzles: any[], offset: number, limit: number): OverviewResult {
    const basicResults = allPuzzles.map(puzzle => ({
      ...puzzle,
      explanations: [],
      totalExplanations: 0,
      latestExplanation: null,
      hasExplanation: false
    }));
    
    return {
      puzzles: basicResults.slice(offset, offset + limit),
      total: basicResults.length,
      hasMore: basicResults.length > offset + limit
    };
  }

  /**
   * Sort overview results based on sort parameters
   */
  sortOverviewResults(results: any[], sortOptions: SortOptions): any[] {
    const { sortBy, sortOrder } = sortOptions;
    
    return results.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'puzzleId':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'explanationCount':
          aValue = a.totalExplanations;
          bValue = b.totalExplanations;
          break;
        case 'latestConfidence':
          aValue = a.latestExplanation?.confidence || 0;
          bValue = b.latestExplanation?.confidence || 0;
          break;
        case 'createdAt':
        default:
          aValue = a.latestExplanation?.createdAt || '1970-01-01';
          bValue = b.latestExplanation?.createdAt || '1970-01-01';
          break;
      }
      
      if (sortOrder === 'desc') {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });
  }

  /**
   * Apply pagination to results
   */
  applyPagination(results: any[], offset: number, limit: number): OverviewResult {
    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);
    
    return {
      puzzles: paginatedResults,
      total: total,
      hasMore: total > offset + limit
    };
  }

  /**
   * Build puzzle map with explanation metadata
   */
  async buildPuzzleMap(puzzles: any[]): Promise<Map<string, any>> {
    const puzzleIds = puzzles.map(p => p.id);
    const explanationStatusMap = await repositoryService.explanations.getBulkExplanationStatus(puzzleIds);
    
    const puzzleMap = new Map();
    puzzles.forEach(puzzle => {
      const status = explanationStatusMap[puzzle.id];
      puzzleMap.set(puzzle.id, {
        ...puzzle,
        explanations: [],
        totalExplanations: 0,
        latestExplanation: null,
        hasExplanation: status?.hasExplanation || false,
        explanationId: status?.explanationId || null,
        feedbackCount: status?.feedbackCount || 0,
        apiProcessingTimeMs: status?.apiProcessingTimeMs || null,
        modelName: status?.modelName || null,
        createdAt: status?.createdAt || null,
        confidence: status?.confidence || null,
        estimatedCost: status?.estimatedCost || null
      });
    });
    
    return puzzleMap;
  }

  /**
   * Enrich puzzles with detailed explanation data
   */
  async enrichPuzzlesWithExplanations(puzzles: any[], explanationFilters: ExplanationFilters): Promise<void> {
    for (const puzzle of puzzles) {
      if (puzzle.hasExplanation && puzzle.explanationId) {
        try {
          const explanations = await repositoryService.explanations.getExplanationsForPuzzle(puzzle.id);
          if (explanations && explanations.length > 0) {
            const filteredExplanations = puzzleFilterService.applyExplanationFilters(explanations, explanationFilters);
            
            puzzle.explanations = filteredExplanations;
            puzzle.totalExplanations = filteredExplanations.length;
            puzzle.latestExplanation = filteredExplanations[0] || null;
          }
        } catch (error) {
          logger.error(`Error getting explanations for puzzle ${puzzle.id}: ${error instanceof Error ? error.message : String(error)}`, 'puzzle-overview-service');
          // Keep puzzle in results but without detailed explanation data
          puzzle.explanations = [];
          puzzle.totalExplanations = 0;
          puzzle.latestExplanation = null;
        }
      }
    }
  }

  /**
   * Get ALL puzzle statistics - includes both analyzed and unexplored puzzles
   * This shows the true picture of your dataset: all 2,220+ puzzles, not just analyzed ones
   */
  async getAllPuzzleStats(
    limit: number = 3000,
    filters?: {
      includeRichMetrics?: boolean;
    }
  ): Promise<any[]> {
    if (!repositoryService.isConnected()) {
      logger.warn('Database not connected - returning puzzle list without performance data', 'puzzle-overview-service');
      // Fallback: return all puzzles from puzzle service with empty performance data
      const allPuzzles = await puzzleService.getPuzzleList({});
      return allPuzzles.map(puzzle => ({
        ...puzzle,
        performanceData: {
          wrongCount: 0,
          avgAccuracy: 0,
          avgConfidence: 0,
          totalExplanations: 0,
          negativeFeedback: 0,
          totalFeedback: 0,
          latestAnalysis: null,
          worstExplanationId: null,
          compositeScore: 0
        }
      }));
    }

    // Get ALL puzzles from the puzzle service (includes all datasets)
    const allPuzzles = await puzzleService.getPuzzleList({});
    logger.debug(`Found ${allPuzzles.length} total puzzles from all datasets`, 'puzzle-overview-service');

    // Get performance data for puzzles that have been analyzed (this only gets puzzles WITH explanations)
    const analyzedPuzzleData = await repositoryService.explanations.getWorstPerformingPuzzles(10000, 'composite', filters);
    
    // Create a map of performance data by puzzle ID
    const performanceMap = new Map();
    analyzedPuzzleData.forEach((data: any) => {
      performanceMap.set(data.puzzleId, data);
    });

    logger.debug(`Performance map contains ${performanceMap.size} analyzed puzzles out of ${allPuzzles.length} total puzzles`, 'puzzle-overview-service');

    // Combine all puzzles with their performance data (or default empty data)
    const enrichedPuzzles = allPuzzles.map((puzzle: any) => {
      const performanceData = performanceMap.get(puzzle.id);
      
      if (performanceData) {
        // Puzzle has been analyzed - use actual performance data
        const basePerformanceData = {
          wrongCount: performanceData.wrongCount,
          avgAccuracy: performanceData.avgAccuracy,
          avgConfidence: performanceData.avgConfidence,
          totalExplanations: performanceData.totalExplanations,
          negativeFeedback: performanceData.negativeFeedback,
          totalFeedback: performanceData.totalFeedback,
          latestAnalysis: performanceData.latestAnalysis,
          worstExplanationId: performanceData.worstExplanationId,
          compositeScore: performanceData.compositeScore
        };

        // Add rich metrics if available
        const richMetrics = filters?.includeRichMetrics ? {
          avgCost: performanceData.avgCost,
          avgProcessingTime: performanceData.avgProcessingTime,
          avgReasoningTokens: performanceData.avgReasoningTokens,
          avgInputTokens: performanceData.avgInputTokens,
          avgOutputTokens: performanceData.avgOutputTokens,
          avgTotalTokens: performanceData.avgTotalTokens,
          multiTestCount: performanceData.multiTestCount,
          singleTestCount: performanceData.singleTestCount,
          lowestNonZeroConfidence: performanceData.lowestNonZeroConfidence,
          modelsAttempted: performanceData.modelsAttempted,
          reasoningEfforts: performanceData.reasoningEfforts
        } : {};

        return {
          ...puzzle,
          performanceData: {
            ...basePerformanceData,
            ...richMetrics
          }
        };
      } else {
        // Unexplored puzzle - use empty performance data
        return {
          ...puzzle,
          performanceData: {
            wrongCount: 0,
            avgAccuracy: 0,
            avgConfidence: 0,
            totalExplanations: 0,
            negativeFeedback: 0,
            totalFeedback: 0,
            latestAnalysis: null,
            worstExplanationId: null,
            compositeScore: 0,
            ...(filters?.includeRichMetrics ? {
              avgCost: 0,
              avgProcessingTime: 0,
              avgReasoningTokens: 0,
              avgInputTokens: 0,
              avgOutputTokens: 0,
              avgTotalTokens: 0,
              multiTestCount: 0,
              singleTestCount: 0,
              lowestNonZeroConfidence: null,
              modelsAttempted: [],
              reasoningEfforts: []
            } : {})
          }
        };
      }
    });

    logger.debug(`Enriched ${enrichedPuzzles.length} puzzles with performance data (${performanceMap.size} analyzed, ${enrichedPuzzles.length - performanceMap.size} unexplored)`, 'puzzle-overview-service');
    return enrichedPuzzles;
  }

  /**
   * Get worst-performing puzzles with enriched metadata
   */
  async getWorstPerformingPuzzles(
    limit: number, 
    sortBy: string, 
    filters?: {
      minAccuracy?: number;
      maxAccuracy?: number;
      zeroAccuracyOnly?: boolean;
      source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy' | 'ConceptARC';
      multiTestFilter?: 'single' | 'multi';
      includeRichMetrics?: boolean;
    }
  ): Promise<any[]> {
    if (!repositoryService.isConnected()) {
      logger.warn('Database not connected - returning empty list for worst-performing puzzles', 'puzzle-overview-service');
      return [];
    }

    // If source filtering is requested, we need to get the puzzle list first to get the source-filtered puzzles
    let sourceFilteredPuzzleIds: string[] | undefined = undefined;
    if (filters?.source) {
      try {
        const allPuzzles = await puzzleService.getPuzzleList({ source: filters.source });
        sourceFilteredPuzzleIds = allPuzzles.map(p => p.id);
        logger.debug(`Found ${sourceFilteredPuzzleIds.length} puzzles from source ${filters.source}`, 'puzzle-overview-service');
      } catch (error) {
        logger.warn(`Failed to get puzzles for source ${filters.source}: ${error instanceof Error ? error.message : String(error)}`, 'puzzle-overview-service');
      }
    }

    const worstPuzzles = await repositoryService.explanations.getWorstPerformingPuzzles(limit * 3, sortBy, filters);
    
    // Filter by source if needed and enrich with metadata
    let puzzlesToProcess = worstPuzzles;
    if (sourceFilteredPuzzleIds) {
      puzzlesToProcess = worstPuzzles.filter(p => sourceFilteredPuzzleIds!.includes(p.puzzleId));
      logger.debug(`Filtered to ${puzzlesToProcess.length} puzzles matching source ${filters?.source}`, 'puzzle-overview-service');
    }

    // Take only the requested limit after source filtering
    puzzlesToProcess = puzzlesToProcess.slice(0, limit);

    const enrichedPuzzles = await Promise.all(
      puzzlesToProcess.map(async (puzzleData) => {
        try {
          const puzzleMetadata = await puzzleService.getPuzzleById(puzzleData.puzzleId);
          
          // Build performance data with base metrics
          const basePerformanceData = {
            wrongCount: puzzleData.wrongCount,
            avgAccuracy: puzzleData.avgAccuracy,
            avgConfidence: puzzleData.avgConfidence,
            totalExplanations: puzzleData.totalExplanations,
            negativeFeedback: puzzleData.negativeFeedback,
            totalFeedback: puzzleData.totalFeedback,
            latestAnalysis: puzzleData.latestAnalysis,
            worstExplanationId: puzzleData.worstExplanationId,
            compositeScore: puzzleData.compositeScore
          };

          // Add rich metrics if available
          const richMetrics = filters?.includeRichMetrics ? {
            avgCost: puzzleData.avgCost,
            avgProcessingTime: puzzleData.avgProcessingTime,
            avgReasoningTokens: puzzleData.avgReasoningTokens,
            avgInputTokens: puzzleData.avgInputTokens,
            avgOutputTokens: puzzleData.avgOutputTokens,
            avgTotalTokens: puzzleData.avgTotalTokens,
            multiTestCount: puzzleData.multiTestCount,
            singleTestCount: puzzleData.singleTestCount,
            lowestNonZeroConfidence: puzzleData.lowestNonZeroConfidence,
            modelsAttempted: puzzleData.modelsAttempted,
            reasoningEfforts: puzzleData.reasoningEfforts
          } : {};

          return {
            ...puzzleMetadata,
            id: puzzleData.puzzleId, // Ensure id field is always present and correct
            performanceData: {
              ...basePerformanceData,
              ...richMetrics
            }
          };
        } catch (error) {
          logger.warn(`Could not load metadata for puzzle ${puzzleData.puzzleId}: ${error instanceof Error ? error.message : String(error)}`, 'puzzle-overview-service');
          // Return basic structure if puzzle metadata fails
          return {
            id: puzzleData.puzzleId,
            error: 'Puzzle metadata not available',
            performanceData: {
              wrongCount: puzzleData.wrongCount,
              avgAccuracy: puzzleData.avgAccuracy,
              avgConfidence: puzzleData.avgConfidence,
              totalExplanations: puzzleData.totalExplanations,
              negativeFeedback: puzzleData.negativeFeedback,
              totalFeedback: puzzleData.totalFeedback,
              latestAnalysis: puzzleData.latestAnalysis,
              worstExplanationId: puzzleData.worstExplanationId,
              compositeScore: puzzleData.compositeScore
            }
          };
        }
      })
    );

    logger.debug(`Found ${enrichedPuzzles.length} worst-performing puzzles`, 'puzzle-overview-service');
    return enrichedPuzzles;
  }

  /**
   * Process complete puzzle overview with all filters, sorting, and pagination
   */
  async processOverview(query: any): Promise<OverviewResult> {
    const { 
      search, hasExplanation, hasFeedback, modelName, saturnFilter,
      processingTimeMin, processingTimeMax, hasPredictions, predictionAccuracy,
      confidenceMin, confidenceMax, limit = 50, offset = 0,
      sortBy = 'createdAt', sortOrder = 'desc',
      totalTokensMin, totalTokensMax, estimatedCostMin, estimatedCostMax,
      predictionAccuracyMin, predictionAccuracyMax
    } = query;

    logger.debug('Processing puzzle overview with filters: ' + JSON.stringify(query), 'puzzle-overview-service');

    // Build puzzle filters and get base puzzle list
    const puzzleFilters = puzzleFilterService.buildOverviewFilters(query);
    const allPuzzles = await puzzleService.getPuzzleList(puzzleFilters);
    
    // If no database connection, return basic overview
    if (!repositoryService.isConnected()) {
      const offsetNum = puzzleFilterService.validateOffset(offset);
      const limitNum = puzzleFilterService.validateLimit(limit);
      return this.createBasicOverview(allPuzzles, offsetNum, limitNum);
    }

    // Apply search filter early to reduce dataset
    let filteredPuzzles = puzzleFilterService.applySearchFilter(allPuzzles, search);

    // Build puzzle map with explanation metadata
    const puzzleMap = await this.buildPuzzleMap(filteredPuzzles);
    let results = Array.from(puzzleMap.values());
    
    // Apply hasExplanation and hasFeedback filters
    results = puzzleFilterService.applyHasExplanationFilter(results, hasExplanation);
    results = puzzleFilterService.applyHasFeedbackFilter(results, hasFeedback);

    // Validate and apply sorting
    const sortOptions = puzzleFilterService.validateSortParameters(sortBy, sortOrder);
    const sortedResults = this.sortOverviewResults(results, sortOptions);
    
    // Apply pagination BEFORE fetching detailed explanation data
    const offsetNum = puzzleFilterService.validateOffset(offset);
    const limitNum = puzzleFilterService.validateLimit(limit);
    const paginatedResults = this.applyPagination(sortedResults, offsetNum, limitNum);
    
    // Build explanation filters
    const explanationFilters: ExplanationFilters = {
      modelName, saturnFilter, confidenceMin, confidenceMax,
      processingTimeMin, processingTimeMax, hasPredictions, predictionAccuracy,
      totalTokensMin, totalTokensMax, estimatedCostMin, estimatedCostMax,
      predictionAccuracyMin, predictionAccuracyMax
    };

    // Enrich only the paginated results with detailed explanation data
    await this.enrichPuzzlesWithExplanations(paginatedResults.puzzles, explanationFilters);

    return paginatedResults;
  }
}

export const puzzleOverviewService = new PuzzleOverviewService();
