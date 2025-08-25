/**
 * explanationController.ts
 * 
 * Controller for explanation-related routes.
 * Handles HTTP requests and responses for explanation operations.
 * 
 * @author Cascade
 */

import { Request, Response } from 'express';
import { explanationService } from '../services/explanationService';
import { formatResponse } from '../utils/responseFormatter';

export const explanationController = {
  /**
   * Get all explanations for a puzzle
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getAll(req: Request, res: Response) {
    try {
      const { puzzleId } = req.params;
      const explanations = await explanationService.getExplanationsForPuzzle(puzzleId);
      
      if (explanations === null) {
        // Database is not connected, return an empty array instead of null
        return res.json(formatResponse.success([]));
      }
      
      res.json(formatResponse.success(explanations));
    } catch (error) {
      console.error('Error in explanationController.getAll:', error);
      res.status(500).json(formatResponse.error(
        'INTERNAL_ERROR', 
        'Failed to retrieve explanations',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  },

  /**
   * Get a single explanation for a puzzle
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getOne(req: Request, res: Response) {
    try {
      const { puzzleId } = req.params;
      const explanation = await explanationService.getExplanationForPuzzle(puzzleId);
      
      if (!explanation) {
        return res.status(404).json(formatResponse.error(
          'NOT_FOUND', 
          'No explanation found for this puzzle'
        ));
      }
      
      res.json(formatResponse.success(explanation));
    } catch (error) {
      console.error('Error in explanationController.getOne:', error);
      res.status(500).json(formatResponse.error(
        'INTERNAL_ERROR', 
        'Failed to retrieve explanation',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  },

  /**
   * Create a new explanation for a puzzle
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async create(req: Request, res: Response) {
    try {
      const { puzzleId } = req.params;
      const { explanations } = req.body;
      
      const result = await explanationService.saveExplanation(puzzleId, explanations);

      if (result.success) {
        res.status(201).json(formatResponse.success({ explanationIds: result.explanationIds }, 'Explanation saved successfully.'));
      } else {
        // Handle controlled failures, e.g., validation errors from the service
        res.status(400).json(formatResponse.error('SAVE_FAILED', result.message || 'Failed to save explanation due to invalid data.'));
      }
    } catch (error) {
      const { puzzleId } = req.params;
      console.error(`Error in explanationController.create for puzzle ${puzzleId}:`, error);
      res.status(500).json(formatResponse.error(
        'INTERNAL_ERROR',
        'An unexpected error occurred while saving the explanation.',
        { error: error instanceof Error ? error.message : 'Unknown database error' }
      ));
    }
  }
};
