/**
 * puzzleFilterService.ts
 * 
 * Service for handling puzzle filtering and query processing.
 * Extracts filter building and validation logic from controller.
 * 
 * @author Claude Code
 */

import { logger } from '../utils/logger';

export interface PuzzleFilters {
  maxGridSize?: number;
  minGridSize?: number;
  difficulty?: string;
  gridSizeConsistent?: boolean;
  prioritizeUnexplained?: boolean;
  prioritizeExplained?: boolean;
  source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy';
  multiTestFilter?: 'single' | 'multi';
}

export interface OverviewFilters extends PuzzleFilters {
  // Additional filters specific to overview
  gridSizeMin?: number;
  gridSizeMax?: number;
  gridConsistency?: boolean;
}

export interface ExplanationFilters {
  modelName?: string;
  saturnFilter?: string;
  confidenceMin?: number;
  confidenceMax?: number;
  processingTimeMin?: number;
  processingTimeMax?: number;
  hasPredictions?: string;
  predictionAccuracy?: string;
  totalTokensMin?: number;
  totalTokensMax?: number;
  estimatedCostMin?: number;
  estimatedCostMax?: number;
  predictionAccuracyMin?: number;
  predictionAccuracyMax?: number;
}

export class PuzzleFilterService {
  /**
   * Build puzzle filters from query parameters for list endpoint
   */
  buildListFilters(query: any): PuzzleFilters {
    const { maxGridSize, minGridSize, difficulty, gridSizeConsistent, prioritizeUnexplained, prioritizeExplained, source, multiTestFilter } = query;
    
    logger.debug('Building list filters from query params: ' + JSON.stringify(query), 'puzzle-filter-service');
    
    const filters: PuzzleFilters = {};
    
    if (maxGridSize) filters.maxGridSize = parseInt(maxGridSize as string);
    if (minGridSize) filters.minGridSize = parseInt(minGridSize as string);
    if (difficulty) filters.difficulty = difficulty as string;
    if (gridSizeConsistent) filters.gridSizeConsistent = gridSizeConsistent === 'true';
    if (prioritizeUnexplained) filters.prioritizeUnexplained = prioritizeUnexplained === 'true';
    if (prioritizeExplained) filters.prioritizeExplained = prioritizeExplained === 'true';
    if (source && ['ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval', 'ARC-Heavy'].includes(source as string)) {
      filters.source = source as 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy';
    }
    if (multiTestFilter && ['single', 'multi'].includes(multiTestFilter as string)) {
      filters.multiTestFilter = multiTestFilter as 'single' | 'multi';
    }
    
    logger.debug('Built filters: ' + JSON.stringify(filters), 'puzzle-filter-service');
    return filters;
  }

  /**
   * Build overview filters from query parameters for overview endpoint
   */
  buildOverviewFilters(query: any): OverviewFilters {
    const { source, multiTestFilter, gridSizeMin, gridSizeMax, gridConsistency } = query;
    
    const filters: OverviewFilters = {};
    
    if (source && ['ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval', 'ARC-Heavy'].includes(source as string)) {
      filters.source = source as 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy';
    }
    if (multiTestFilter && ['single', 'multi'].includes(multiTestFilter as string)) {
      filters.multiTestFilter = multiTestFilter as 'single' | 'multi';
    }
    if (gridSizeMin) {
      filters.gridSizeMin = parseInt(gridSizeMin as string);
    }
    if (gridSizeMax) {
      filters.gridSizeMax = parseInt(gridSizeMax as string);
    }
    if (gridConsistency && ['true', 'false'].includes(gridConsistency as string)) {
      filters.gridSizeConsistent = gridConsistency === 'true';
    }
    
    return filters;
  }

  /**
   * Apply explanation filters to explanation list
   */
  applyExplanationFilters(explanations: any[], filters: ExplanationFilters): any[] {
    const {
      modelName, saturnFilter, confidenceMin, confidenceMax,
      processingTimeMin, processingTimeMax, hasPredictions, predictionAccuracy,
      totalTokensMin, totalTokensMax, estimatedCostMin, estimatedCostMax,
      predictionAccuracyMin, predictionAccuracyMax
    } = filters;
    
    let filtered = explanations;
    
    // Filter by model
    if (modelName) {
      filtered = filtered.filter(exp => exp.modelName === modelName);
    }
    
    // Filter by Saturn status
    if (saturnFilter) {
      if (saturnFilter === 'solved') {
        filtered = filtered.filter(exp => exp.saturnSuccess === true);
      } else if (saturnFilter === 'failed') {
        filtered = filtered.filter(exp => exp.saturnSuccess === false);
      } else if (saturnFilter === 'attempted') {
        filtered = filtered.filter(exp => exp.saturnSuccess !== undefined);
      }
    }
    
    // Filter by confidence range
    if (confidenceMin || confidenceMax) {
      filtered = filtered.filter(exp => {
        const confidence = exp.confidence || 0;
        if (confidenceMin && confidence < confidenceMin) return false;
        if (confidenceMax && confidence > confidenceMax) return false;
        return true;
      });
    }
    
    // Filter by processing time
    if (processingTimeMin || processingTimeMax) {
      filtered = filtered.filter(exp => {
        const processingTime = exp.apiProcessingTimeMs || 0;
        if (processingTimeMin && processingTime < processingTimeMin) return false;
        if (processingTimeMax && processingTime > processingTimeMax) return false;
        return true;
      });
    }
    
    // Filter by total tokens
    if (totalTokensMin || totalTokensMax) {
      filtered = filtered.filter(exp => {
        const totalTokens = exp.totalTokens || 0;
        if (totalTokensMin && totalTokens < totalTokensMin) return false;
        if (totalTokensMax && totalTokens > totalTokensMax) return false;
        return true;
      });
    }
    
    // Filter by estimated cost
    if (estimatedCostMin || estimatedCostMax) {
      filtered = filtered.filter(exp => {
        const estimatedCost = exp.estimatedCost || 0;
        if (estimatedCostMin && estimatedCost < estimatedCostMin) return false;
        if (estimatedCostMax && estimatedCost > estimatedCostMax) return false;
        return true;
      });
    }
    
    // Filter by prediction accuracy score
    if (predictionAccuracyMin || predictionAccuracyMax) {
      filtered = filtered.filter(exp => {
        const accuracyScore = exp.predictionAccuracyScore || 0;
        if (predictionAccuracyMin && accuracyScore < predictionAccuracyMin) return false;
        if (predictionAccuracyMax && accuracyScore > predictionAccuracyMax) return false;
        return true;
      });
    }
    
    // Filter by predictions
    if (hasPredictions === 'true') {
      filtered = filtered.filter(exp => exp.predictedOutputGrid || exp.multiplePredictedOutputs);
    } else if (hasPredictions === 'false') {
      filtered = filtered.filter(exp => !exp.predictedOutputGrid && !exp.multiplePredictedOutputs);
    }
    
    // Filter by prediction accuracy
    if (predictionAccuracy === 'correct') {
      filtered = filtered.filter(exp => exp.isPredictionCorrect === true || exp.multiTestAllCorrect === true);
    } else if (predictionAccuracy === 'incorrect') {
      filtered = filtered.filter(exp => exp.isPredictionCorrect === false || exp.multiTestAllCorrect === false);
    } else if (predictionAccuracy === 'low_accuracy') {
      filtered = filtered.filter(exp => {
        // Check prediction accuracy score (0.0 to 1.0 scale)
        const accuracyScore = exp.predictionAccuracyScore;
        if (accuracyScore !== null && accuracyScore !== undefined) {
          return accuracyScore < 0.25;
        }
        
        // Check multi-test average accuracy (0.0 to 1.0 scale)
        const multiTestAccuracy = exp.multiTestAverageAccuracy;
        if (multiTestAccuracy !== null && multiTestAccuracy !== undefined) {
          return multiTestAccuracy < 0.25;
        }
        
        // If both accuracy metrics are missing, exclude the explanation
        return false;
      });
    }
    
    return filtered;
  }

  /**
   * Apply search filter to puzzle list
   */
  applySearchFilter(puzzles: any[], search: string): any[] {
    if (!search || typeof search !== 'string') {
      return puzzles;
    }
    
    const searchLower = search.toLowerCase();
    return puzzles.filter(puzzle => 
      puzzle.id.toLowerCase().includes(searchLower)
    );
  }

  /**
   * Apply hasExplanation filter
   */
  applyHasExplanationFilter(puzzles: any[], hasExplanation: string): any[] {
    if (hasExplanation === 'true') {
      return puzzles.filter(puzzle => puzzle.hasExplanation);
    } else if (hasExplanation === 'false') {
      return puzzles.filter(puzzle => !puzzle.hasExplanation);
    }
    return puzzles;
  }

  /**
   * Apply hasFeedback filter
   */
  applyHasFeedbackFilter(puzzles: any[], hasFeedback: string): any[] {
    if (hasFeedback === 'true') {
      return puzzles.filter(puzzle => puzzle.feedbackCount && puzzle.feedbackCount > 0);
    } else if (hasFeedback === 'false') {
      return puzzles.filter(puzzle => !puzzle.feedbackCount || puzzle.feedbackCount === 0);
    }
    return puzzles;
  }

  /**
   * Validate sort parameters
   */
  validateSortParameters(sortBy?: string, sortOrder?: string): { sortBy: string, sortOrder: string } {
    const validSortOptions = ['puzzleId', 'explanationCount', 'latestConfidence', 'createdAt'];
    const validSortOrder = ['asc', 'desc'];
    
    return {
      sortBy: validSortOptions.includes(sortBy || '') ? sortBy! : 'createdAt',
      sortOrder: validSortOrder.includes(sortOrder || '') ? sortOrder! : 'desc'
    };
  }

  /**
   * Validate worst puzzle sort parameters
   */
  validateWorstPuzzleSortParameters(sortBy?: string): string {
    const validSortOptions = ['composite', 'feedback', 'accuracy'];
    return validSortOptions.includes(sortBy || '') ? sortBy! : 'composite';
  }

  /**
   * Validate and sanitize limit parameter
   */
  validateLimit(limit: any, defaultLimit: number = 50, maxLimit: number = 50): number {
    const parsedLimit = parseInt(limit) || defaultLimit;
    return Math.min(Math.max(parsedLimit, 1), maxLimit);
  }

  /**
   * Validate and sanitize offset parameter
   */
  validateOffset(offset: any): number {
    return Math.max(parseInt(offset) || 0, 0);
  }
}

export const puzzleFilterService = new PuzzleFilterService();