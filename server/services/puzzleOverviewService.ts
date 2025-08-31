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
   * Get worst-performing puzzles with enriched metadata
   */
  async getWorstPerformingPuzzles(limit: number, sortBy: string): Promise<any[]> {
    if (!repositoryService.isConnected()) {
      logger.warn('Database not connected - returning empty list for worst-performing puzzles', 'puzzle-overview-service');
      return [];
    }

    const worstPuzzles = await repositoryService.explanations.getWorstPerformingPuzzles(limit, sortBy);
    
    // Enrich each puzzle with metadata
    const enrichedPuzzles = await Promise.all(
      worstPuzzles.map(async (puzzleData) => {
        try {
          const puzzleMetadata = await puzzleService.getPuzzleById(puzzleData.puzzleId);
          return {
            ...puzzleMetadata,
            id: puzzleData.puzzleId, // Ensure id field is always present and correct
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