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
  }
};
