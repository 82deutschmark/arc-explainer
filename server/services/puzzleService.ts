/**
 * puzzleService.ts
 * 
 * Service layer for puzzle-related operations.
 * This service handles puzzle data retrieval and manipulation.
 * 
 * @author Cascade
 */

import { puzzleLoader } from './puzzleLoader';
import { AppError } from '../middleware/errorHandler';

interface PuzzleFilters {
  maxGridSize?: number;
  minGridSize?: number;
  difficulty?: string;
  gridSizeConsistent?: boolean;
}

export const puzzleService = {
  /**
   * Get a filtered list of available puzzles
   * 
   * @param filters - Optional filters to apply to the puzzle list
   * @returns Array of puzzles matching the filters
   */
  async getPuzzleList(filters: PuzzleFilters = {}) {
    return puzzleLoader.getPuzzleList(filters);
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
