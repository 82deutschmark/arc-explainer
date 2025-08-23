/**
 * puzzleService.ts
 * 
 * Service layer for puzzle-related operations.
 * This service handles puzzle data retrieval and manipulation.
 * Includes support for fetching explanation data and feedback counts.
 * 
 * @author Cascade - Claude 3.7 Sonnet Thinking
 */

import { puzzleLoader } from './puzzleLoader';
import { PuzzleMetadata, ARCTask } from '@shared/types';
import { AppError } from '../middleware/errorHandler';

interface PuzzleFilters {
  maxGridSize?: number;
  minGridSize?: number;
  difficulty?: string;
  gridSizeConsistent?: boolean;
  prioritizeUnexplained?: boolean;
  prioritizeExplained?: boolean;
  source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval';
}

// Additional interface for enhanced puzzle metadata with feedback info
interface EnhancedPuzzleMetadata extends PuzzleMetadata {
  explanationId?: number;
  feedbackCount?: number;
}

// Interface for the formatted explanation object in the overview
interface ExplanationOverview {
  id: number;
  puzzleId: string;
  modelName: string;
  patternDescription: string;
  solvingStrategy: string;
  confidence: number;
  createdAt: string; // Sticking to string to match DB output before parsing
  saturnSuccess: boolean | null;
  isPredictionCorrect: boolean | null;
  helpfulCount: number;
  notHelpfulCount: number;
  totalFeedback: number;
}

// Interface for the puzzle object used within the getPuzzleOverview method
interface PuzzleOverview extends PuzzleMetadata {
  explanations: ExplanationOverview[];
  totalExplanations: number;
  latestExplanation: ExplanationOverview | null;
  hasExplanation: boolean;
  feedbackCount: number;
}

// Remove local interface and use the imported one from shared types

export const puzzleService = {
  /**
   * Get list of puzzles with optional filtering
   * 
   * @param filters - Optional filters for puzzles
   * @returns Array of puzzle metadata with explanation and feedback info
   */
  async getPuzzleList(filters: PuzzleFilters = {}): Promise<EnhancedPuzzleMetadata[]> {
    console.log('puzzleService.getPuzzleList called with filters:', filters);
    const puzzleList = await puzzleLoader.getPuzzleList(filters);
    console.log(`puzzleService: puzzleLoader returned ${puzzleList.length} puzzles`);
    
    if (puzzleList.length === 0) {
      console.warn('WARNING: puzzleLoader returned zero puzzles!');
    } else {
      console.log('Sample puzzle metadata:', puzzleList[0]);
    }
    
    // Import database service here to avoid circular dependency
    const { getDatabaseService } = await import('../db/index.js');
    
    // Create a base puzzle list with metadata
    const enhancedPuzzles = puzzleList.map(puzzle => ({
      id: puzzle.id,
      gridSizeConsistent: puzzle.gridSizeConsistent,
      patternType: puzzle.patternType,
      maxGridSize: puzzle.maxGridSize,
      inputSize: puzzle.inputSize,
      outputSize: puzzle.outputSize,
      hasExplanation: false, // Will update this with accurate data
      source: puzzle.source,
      explanationId: undefined,
      feedbackCount: 0
    }));
    
    try {
      // Use bulk query to get explanation status for all puzzles at once - optimizes performance
      const puzzleIds = enhancedPuzzles.map(p => p.id);
      const dbService = getDatabaseService();
      const bulkStatusResults = await dbService.explanations.getBulkStatus(puzzleIds);
      const statusMap = new Map(bulkStatusResults.map(s => [s.puzzle_id, s]));

      // Update each puzzle with its explanation status
      enhancedPuzzles.forEach(puzzle => {
        const status = statusMap.get(puzzle.id);
        if (status) {
          puzzle.hasExplanation = status.explanation_count > 0;
          // Note: explanationId and feedbackCount are not available in getBulkStatus
          // and will be populated in more detailed views like getPuzzleOverview.
        }
      });
      
      console.log(`Enhanced ${enhancedPuzzles.length} puzzles with explanation data in single bulk query`);
    } catch (error) {
      console.error('Error fetching bulk explanation data:', error);
      // Continue with partial data if there's an error
    }
    
    // Sort puzzles based on the 'prioritizeUnexplained' filter
    if (filters.prioritizeUnexplained) {
      enhancedPuzzles.sort((a, b) => {
        if (a.hasExplanation && !b.hasExplanation) return 1;
        if (!a.hasExplanation && b.hasExplanation) return -1;
        return 0;
      });
    }

    return enhancedPuzzles;
  },

  /**
   * Get a specific puzzle by ID
   * 
   * @param puzzleId - The ID of the puzzle to retrieve
   * @returns The puzzle object
   * @throws AppError if puzzle not found
   */
  async getPuzzleById(taskId: string): Promise<ARCTask> {
    const puzzle = await puzzleLoader.loadPuzzle(taskId);
    if (!puzzle) {
      throw new AppError(`Puzzle with ID ${taskId} not found`, 404, 'NOT_FOUND');
    }
    return puzzle;
  },

  /**
   * Get solver mode accuracy statistics for leaderboards
   * 
   * @returns An object with accuracy statistics
   */
  async getAccuracyStats() {
    const { getDatabaseService } = await import('../db/index.js');
    return await getDatabaseService().explanations.getAccuracyStats();
  },

  /**
   * Check if a puzzle has an explanation
   * 
   * @param puzzleId - The ID of the puzzle to check
   * @returns Boolean indicating if the puzzle has an explanation
   */
  async hasPuzzleExplanation(puzzleId: string) {
    const { getDatabaseService } = await import('../db/index.js');
    return getDatabaseService().explanations.exists(puzzleId);
  },

  /**
   * Get a comprehensive overview of all puzzles with explanations and feedback.
   * This method encapsulates the complex filtering and sorting logic for the main overview page.
   * 
   * @param filters - Filters for search, explanation status, feedback, etc.
   * @returns Paginated list of puzzles with detailed explanation data.
   */
  async getPuzzleOverview(filters: any) {
    const { getDatabaseService } = await import('../db/index.js');
    const db = getDatabaseService();

    // 1. Get all puzzles from the file system loader
    const allPuzzles = await puzzleLoader.getPuzzleList({});
    const puzzleMap = new Map<string, PuzzleOverview>(
      allPuzzles.map(p => [p.id, { ...p, explanations: [], totalExplanations: 0, latestExplanation: null, hasExplanation: false, feedbackCount: 0 }])
    );

    // 2. Get all explanations from the database
    const allExplanations = await db.explanations.getAllWithFeedbackCounts();

    // 3. Merge explanations into the puzzle map
    allExplanations.forEach((exp: any) => {
      const puzzle = puzzleMap.get(exp.puzzle_id);
      if (puzzle) {
        const formattedExp = {
          id: exp.id,
          puzzleId: exp.puzzle_id,
          modelName: exp.model_name,
          patternDescription: exp.pattern_description,
          solvingStrategy: exp.solving_strategy,
          confidence: exp.confidence,
          createdAt: exp.created_at,
          saturnSuccess: exp.saturn_success,
          isPredictionCorrect: exp.is_prediction_correct,
          helpfulCount: exp.helpful_count,
          notHelpfulCount: exp.not_helpful_count,
          totalFeedback: exp.total_feedback
        };
        puzzle.explanations.push(formattedExp);
      }
    });

    // 4. Process and filter the merged data
    let results = Array.from(puzzleMap.values());

    results.forEach(puzzle => {
      if (puzzle.explanations.length > 0) {
        puzzle.hasExplanation = true;
        puzzle.totalExplanations = puzzle.explanations.length;
        // Sort by creation date to find the latest
        puzzle.explanations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        puzzle.latestExplanation = puzzle.explanations[0];
        puzzle.feedbackCount = puzzle.explanations.reduce((acc, exp) => acc + (exp.totalFeedback || 0), 0);
      }
    });

    // Apply filters from the controller
    if (filters.search) {
      results = results.filter(p => p.id.toLowerCase().includes(filters.search.toLowerCase()));
    }
    if (filters.hasExplanation === 'true') {
      results = results.filter(p => p.hasExplanation);
    } else if (filters.hasExplanation === 'false') {
      results = results.filter(p => !p.hasExplanation);
    }
    // Add other filters (modelName, confidence, etc.) here as needed

    // 5. Sort the final results
    results.sort((a, b) => {
      const aValue = a.latestExplanation?.createdAt || '1970-01-01';
      const bValue = b.latestExplanation?.createdAt || '1970-01-01';
      return new Date(bValue).getTime() - new Date(aValue).getTime();
    });

    // 6. Paginate
    const total = results.length;
    const offset = parseInt(filters.offset || '0');
    const limit = parseInt(filters.limit || '50');
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      puzzles: paginatedResults,
      total,
      hasMore: total > offset + limit
    };
  }
};
