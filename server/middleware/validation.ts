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
import { logger } from '../utils/logger.js';

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
    logger.debug('Received feedback request: ' + JSON.stringify({ 
      body: req.body, 
      params: req.params,
      query: req.query,
      path: req.path
    }), 'validation');
    
    // Extract explanationId from either body or params
    // This makes the API more flexible - it can accept the ID from either source
    let explanationId = req.body.explanationId;
    const { voteType, comment } = req.body;
    
    // If explanationId is missing from body but present in params, use that one
    if ((!explanationId && explanationId !== 0) && req.params.explanationId) {
      explanationId = parseInt(req.params.explanationId, 10);
      logger.debug('Using explanationId from params: ' + explanationId, 'validation');
      // Add it to the body for the controller
      req.body.explanationId = explanationId;
    }
    
    const MINIMUM_COMMENT_LENGTH = 20;
    
    // Final validation check
    if ((!explanationId && explanationId !== 0)) {
      logger.warn('explanationId validation failed. Not found in body or params', 'validation');
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
  },

  /**
   * Validates puzzle analysis request parameters
   */
  puzzleAnalysis: (req: Request, res: Response, next: NextFunction) => {
    const { taskId, model } = req.params;
    const { temperature, promptId } = req.body;

    if (!taskId || taskId.trim() === '') {
      throw new AppError('Missing required parameter: taskId', 400, 'VALIDATION_ERROR');
    }

    if (!model || model.trim() === '') {
      throw new AppError('Missing required parameter: model', 400, 'VALIDATION_ERROR');
    }

    // Validate temperature if provided
    if (temperature !== undefined) {
      const temp = parseFloat(temperature);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        throw new AppError('Temperature must be a number between 0 and 2', 400, 'VALIDATION_ERROR');
      }
    }

    // Validate promptId if provided
    if (promptId !== undefined && typeof promptId !== 'string') {
      throw new AppError('promptId must be a string', 400, 'VALIDATION_ERROR');
    }

    next();
  },

  /**
   * Validates batch analysis request parameters
   */
  batchAnalysis: (req: Request, res: Response, next: NextFunction) => {
    const { modelKey, dataset, promptId, customPrompt, temperature, batchSize } = req.body;

    if (!modelKey || typeof modelKey !== 'string') {
      throw new AppError('Missing or invalid required field: modelKey', 400, 'VALIDATION_ERROR');
    }

    if (!dataset || typeof dataset !== 'string') {
      throw new AppError('Missing or invalid required field: dataset', 400, 'VALIDATION_ERROR');
    }

    const validDatasets = ['ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval', 'All'];
    if (!validDatasets.includes(dataset)) {
      throw new AppError(`Invalid dataset. Must be one of: ${validDatasets.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    if (promptId === 'custom' && (!customPrompt || typeof customPrompt !== 'string')) {
      throw new AppError('customPrompt is required when promptId is "custom"', 400, 'VALIDATION_ERROR');
    }

    if (temperature !== undefined) {
      const temp = parseFloat(temperature);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        throw new AppError('Temperature must be a number between 0 and 2', 400, 'VALIDATION_ERROR');
      }
    }

    if (batchSize !== undefined) {
      const size = parseInt(batchSize);
      if (isNaN(size) || size < 1 || size > 50) {
        throw new AppError('batchSize must be a number between 1 and 50', 400, 'VALIDATION_ERROR');
      }
    }

    next();
  },

  /**
   * Validates Saturn analysis request parameters
   */
  saturnAnalysis: (req: Request, res: Response, next: NextFunction) => {
    const { taskId } = req.params;
    
    if (!taskId || taskId.trim() === '') {
      throw new AppError('Missing required parameter: taskId', 400, 'VALIDATION_ERROR');
    }

    next();
  },

  /**
   * Validates prompt preview request parameters
   */
  promptPreview: (req: Request, res: Response, next: NextFunction) => {
    const { provider, taskId } = req.params;
    const validProviders = ['openai', 'anthropic', 'gemini', 'grok', 'deepseek', 'openrouter'];

    if (!provider || !validProviders.includes(provider)) {
      throw new AppError(`Invalid provider. Must be one of: ${validProviders.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    if (!taskId || taskId.trim() === '') {
      throw new AppError('Missing required parameter: taskId', 400, 'VALIDATION_ERROR');
    }

    next();
  },

  /**
   * Validates explanation creation request
   */
  explanationCreate: (req: Request, res: Response, next: NextFunction) => {
    const { puzzleId } = req.params;
    const { patternDescription, solvingStrategy } = req.body;

    if (!puzzleId || puzzleId.trim() === '') {
      throw new AppError('Missing required parameter: puzzleId', 400, 'VALIDATION_ERROR');
    }

    if (!patternDescription || typeof patternDescription !== 'string' || patternDescription.trim().length < 10) {
      throw new AppError('patternDescription must be a string with at least 10 characters', 400, 'VALIDATION_ERROR');
    }

    if (!solvingStrategy || typeof solvingStrategy !== 'string' || solvingStrategy.trim().length < 10) {
      throw new AppError('solvingStrategy must be a string with at least 10 characters', 400, 'VALIDATION_ERROR');
    }

    next();
  },

  /**
   * Validates batch control request parameters
   */
  batchControl: (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const { action } = req.body;

    if (!sessionId || sessionId.trim() === '') {
      throw new AppError('Missing required parameter: sessionId', 400, 'VALIDATION_ERROR');
    }

    const validActions = ['pause', 'resume', 'cancel'];
    if (!action || !validActions.includes(action)) {
      throw new AppError(`Invalid action. Must be one of: ${validActions.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    next();
  }
};
