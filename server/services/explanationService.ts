/**
 * explanationService.ts
 * 
 * Service layer for explanation-related operations.
 * This service handles retrieving and saving puzzle explanations.
 * 
 * @author Cascade
 */

import { dbService } from './dbService';
import { AppError } from '../middleware/errorHandler';

export const explanationService = {
  /**
   * Get all explanations for a specific puzzle
   * 
   * @param puzzleId - The ID of the puzzle to get explanations for
   * @returns Array of explanations for the puzzle
   * @throws AppError if explanations cannot be retrieved
   */
  async getExplanationsForPuzzle(puzzleId: string) {
    const explanations = await dbService.getExplanationsForPuzzle(puzzleId);
    if (explanations === null) {
      throw new AppError(
        'Could not retrieve explanations due to a server error.',
        500, 
        'DATABASE_ERROR'
      );
    }
    return explanations;
  },

  /**
   * Get a single explanation for a specific puzzle
   * 
   * @param puzzleId - The ID of the puzzle to get the explanation for
   * @returns The explanation object or null if not found
   * @throws AppError if explanation cannot be retrieved
   */
  async getExplanationForPuzzle(puzzleId: string) {
    const explanation = await dbService.getExplanationForPuzzle(puzzleId);
    if (explanation === null) {
      return null; // No explanation found is not an error
    }
    return explanation;
  },

  /**
   * Save an explanation for a puzzle
   * 
   * @param puzzleId - The ID of the puzzle
   * @param explanations - The explanations to save
   * @returns Object with filepath and explanationId
   * @throws AppError if puzzle not found or explanation cannot be saved
   */
  async saveExplanation(puzzleId: string, explanations: Record<string, any>) {
    // First, get the puzzle to validate it exists
    const { puzzleLoader } = await import('./puzzleLoader');
    const task = await puzzleLoader.loadPuzzle(puzzleId);
    
    if (!task) {
      throw new AppError('Puzzle not found', 404, 'PUZZLE_NOT_FOUND');
    }

    if (!explanations || Object.keys(explanations).length === 0) {
      throw new AppError('No explanations provided', 400, 'VALIDATION_ERROR');
    }

    // Save to file system for backward compatibility
    const { puzzleExporter } = await import('./puzzleExporter');
    const filepath = await puzzleExporter.saveExplainedPuzzle(puzzleId, task, explanations);
    
    // Save to database if available (most recent explanation model only)
    let explanationId = null;
    const latestModelName = Object.keys(explanations).pop();
    
    if (latestModelName) {
      explanationId = await dbService.saveExplanation(puzzleId, {
        ...explanations[latestModelName],
        modelUsed: latestModelName
      });
    }
    
    return { 
      success: true, 
      message: `Explained puzzle saved as ${puzzleId}-EXPLAINED.json`,
      filepath,
      explanationId
    };
  }
};
