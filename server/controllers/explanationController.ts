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
    const { puzzleId } = req.params;
    const explanations = await explanationService.getExplanationsForPuzzle(puzzleId);
    res.json(formatResponse.success(explanations));
  },

  /**
   * Get a single explanation for a puzzle
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getOne(req: Request, res: Response) {
    const { puzzleId } = req.params;
    const explanation = await explanationService.getExplanationForPuzzle(puzzleId);
    
    if (!explanation) {
      return res.status(404).json(formatResponse.error(
        'NOT_FOUND', 
        'No explanation found for this puzzle'
      ));
    }
    
    res.json(formatResponse.success(explanation));
  },

  /**
   * Create a new explanation for a puzzle
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async create(req: Request, res: Response) {
    const { puzzleId } = req.params;
    const { explanations } = req.body;
    
    const result = await explanationService.saveExplanation(puzzleId, explanations);
    res.json(formatResponse.success(result, result.message));
  }
};
