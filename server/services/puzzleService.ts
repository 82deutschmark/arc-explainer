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
      const explanationStatusMap = await dbService.getBulkExplanationStatus(puzzleIds);
      
      // Update each puzzle with its explanation status
      enhancedPuzzles.forEach(puzzle => {
        const status = explanationStatusMap.get(puzzle.id);
        if (status) {
          puzzle.hasExplanation = status.hasExplanation;
          puzzle.explanationId = status.explanationId;
          puzzle.feedbackCount = status.feedbackCount;
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
  async getPuzzleById(puzzleId: string) {
    const puzzle = await puzzleLoader.loadPuzzle(puzzleId);
    if (!puzzle) {
      throw new AppError(
        `Puzzle ${puzzleId} not found. Try one of the available puzzles or check if the ID is correct.`,
        404, 
        'PUZZLE_NOT_FOUND'
      );
    }
    return puzzle;
  },

  /**
   * Check if a puzzle has an explanation
   * 
   * @param puzzleId - The ID of the puzzle to check
   * @returns Boolean indicating if the puzzle has an explanation
   */
  async hasPuzzleExplanation(puzzleId: string) {
    const { getDatabaseService } = await import('../db/index.js');
    return getDatabaseService().hasExplanation(puzzleId);
  }
};
