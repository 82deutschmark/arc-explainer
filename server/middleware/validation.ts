/**
 * validation.ts
 * 
 * Middleware for validating incoming requests.
 * Provides reusable validation functions for common validation tasks
 * across different API endpoints.
 * 
 * @author Cascade
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export const validation = {
  /**
   * Validates required request parameters
   * @param params Array of parameter names to check
   * @param location 'body', 'params', or 'query' to specify where to look for the parameters
   */
  required: (params: string[], location: 'body' | 'params' | 'query' = 'body') => {
    return (req: Request, res: Response, next: NextFunction) => {
      const source = req[location];
      const missing = params.filter(param => !source[param]);
      
      if (missing.length > 0) {
        throw new AppError(
          `Missing required ${location} parameters: ${missing.join(', ')}`,
          400,
          'VALIDATION_ERROR'
        );
      }
      
      next();
    };
  },

  /**
   * Validates feedback submission
   */
  feedback: (req: Request, res: Response, next: NextFunction) => {
    console.log('Received feedback request:', { 
      body: req.body, 
      params: req.params,
      query: req.query,
      path: req.path
    });
    
    // Extract explanationId from either body or params
    // This makes the API more flexible - it can accept the ID from either source
    let explanationId = req.body.explanationId;
    const { voteType, comment } = req.body;
    
    // If explanationId is missing from body but present in params, use that one
    if ((!explanationId && explanationId !== 0) && req.params.explanationId) {
      explanationId = parseInt(req.params.explanationId, 10);
      console.log('Using explanationId from params:', explanationId);
      // Add it to the body for the controller
      req.body.explanationId = explanationId;
    }
    
    const MINIMUM_COMMENT_LENGTH = 20;
    
    // Final validation check
    if ((!explanationId && explanationId !== 0)) {
      console.log('explanationId validation failed. Not found in body or params');
      throw new AppError('Missing required field: explanationId', 400, 'VALIDATION_ERROR');
    }
    
    if (!voteType) {
      throw new AppError('Missing required field: voteType', 400, 'VALIDATION_ERROR');
    }
    
    if (voteType !== 'helpful' && voteType !== 'not_helpful') {
      throw new AppError('Invalid vote type. Must be "helpful" or "not_helpful"', 400, 'VALIDATION_ERROR');
    }
    
    if (!comment || comment.trim().length < MINIMUM_COMMENT_LENGTH) {
      throw new AppError(
        `A meaningful comment of at least ${MINIMUM_COMMENT_LENGTH} characters is required`,
        400, 
        'VALIDATION_ERROR'
      );
    }
    
    next();
  }
};
