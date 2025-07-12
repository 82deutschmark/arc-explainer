/**
 * puzzleService.ts
 * 
 * Service layer for puzzle-related operations.
 * This service handles puzzle data retrieval and manipulation.
 * 
 * @author Cascade
 */

import { puzzleLoader } from './puzzleLoader';
import { PuzzleMetadata, ARCTask } from '@shared/types';
import { AppError } from '../middleware/errorHandler';

interface PuzzleFilters {
  maxGridSize?: number;
  minGridSize?: number;
  difficulty?: string;
  gridSizeConsistent?: boolean;
}

// Remove local interface and use the imported one from shared types

export const puzzleService = {
  /**
   * Get list of puzzles with optional filtering
   * 
   * @param filters - Optional filters for puzzles
   * @returns Array of puzzle metadata
   */
  async getPuzzleList(filters: PuzzleFilters = {}): Promise<PuzzleMetadata[]> {
    console.log('puzzleService.getPuzzleList called with filters:', filters);
    const puzzleList = await puzzleLoader.getPuzzleList(filters);
    console.log(`puzzleService: puzzleLoader returned ${puzzleList.length} puzzles`);
    
    if (puzzleList.length === 0) {
      console.warn('WARNING: puzzleLoader returned zero puzzles!');
    } else {
      console.log('Sample puzzle metadata:', puzzleList[0]);
    }
    
    return puzzleList.map(puzzle => ({
      id: puzzle.id,
      gridSizeConsistent: puzzle.gridSizeConsistent,
      patternType: puzzle.patternType,
      maxGridSize: puzzle.maxGridSize,
      inputSize: puzzle.inputSize,
      outputSize: puzzle.outputSize,
      hasExplanation: puzzle.hasExplanation,
      source: puzzle.source
    }));
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
    const { dbService } = await import('./dbService');
    return dbService.hasExplanation(puzzleId);
  }
};
