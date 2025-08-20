/**
 * feedbackController.ts
 * 
 * Controller for feedback-related routes.
 * Handles HTTP requests and responses for feedback operations.
 * 
 * @author Cascade
 */

import { Request, Response } from 'express';
import { feedbackService } from '../services/feedbackService';
import { formatResponse } from '../utils/responseFormatter';
import { dbService } from '../services/dbService';
import type { FeedbackFilters } from '../../shared/types';

export const feedbackController = {
  /**
   * Create new feedback for an explanation
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async create(req: Request, res: Response) {
    const { explanationId, voteType, comment } = req.body;

    
    // Validate feedback data
    feedbackService.validateFeedback(explanationId, voteType, comment);
    
    // Add feedback to the database
    const result = await feedbackService.addFeedback(explanationId, voteType, comment);
    
    res.json(formatResponse.success({
      feedbackId: result.feedbackId
    }, result.message));
  },

  /**
   * Get feedback for a specific explanation
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getByExplanation(req: Request, res: Response) {
    const { explanationId } = req.params;
    const explanationIdNum = parseInt(explanationId);

    if (isNaN(explanationIdNum)) {
      return res.status(400).json(formatResponse.error('Invalid explanation ID', 'The explanation ID must be a valid number'));
    }

    const feedback = await dbService.getFeedbackForExplanation(explanationIdNum);
    res.json(formatResponse.success(feedback));
  },

  /**
   * Get feedback for a specific puzzle
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getByPuzzle(req: Request, res: Response) {
    const { puzzleId } = req.params;

    const feedback = await dbService.getFeedbackForPuzzle(puzzleId);
    res.json(formatResponse.success(feedback));
  },

  /**
   * Get all feedback with optional filtering
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getAll(req: Request, res: Response) {
    const filters: FeedbackFilters = {
      puzzleId: req.query.puzzleId as string,
      modelName: req.query.modelName as string,
      voteType: req.query.voteType as 'helpful' | 'not_helpful',
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof FeedbackFilters] === undefined) {
        delete filters[key as keyof FeedbackFilters];
      }
    });

    const feedback = await dbService.getAllFeedback(filters);
    res.json(formatResponse.success(feedback));
  },

  /**
   * Get feedback summary statistics
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getStats(req: Request, res: Response) {
    const stats = await dbService.getFeedbackSummaryStats();
    res.json(formatResponse.success(stats));
  }
};
