/**
 * feedbackController.ts
 * 
 * Controller for feedback-related routes.
 * Refactored to use Repository pattern instead of monolithic DbService.
 * Handles HTTP requests and responses for feedback operations.
 * 
 * @author Cascade (original), Claude (refactor)
 */

import { Request, Response } from 'express';
import { feedbackService } from '../services/feedbackService.js';
import { formatResponse } from '../utils/responseFormatter.js';
import { repositoryService } from '../repositories/RepositoryService.js';
import type { FeedbackFilters } from '../../shared/types.js';

export const feedbackController = {
  /**
   * Create new feedback for an explanation
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async create(req: Request, res: Response) {
    try {
      const { explanationId, voteType, comment } = req.body;

      // Validate feedback data
      feedbackService.validateFeedback(explanationId, voteType, comment);
      
      // Add feedback using repository
      const result = await feedbackService.addFeedback(explanationId, voteType, comment);
      
      res.json(formatResponse.success({
        feedbackId: result.feedbackId
      }, result.message));
    } catch (error) {
      console.error('Error creating feedback:', error);
      res.status(500).json(formatResponse.error(
        'Failed to create feedback',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },

  /**
   * Get feedback for a specific explanation
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getByExplanation(req: Request, res: Response) {
    try {
      const { explanationId } = req.params;
      const explanationIdNum = parseInt(explanationId);

      if (isNaN(explanationIdNum)) {
        return res.status(400).json(formatResponse.error(
          'Invalid explanation ID', 
          'The explanation ID must be a valid number'
        ));
      }

      // Use feedback repository instead of dbService
      const feedback = await repositoryService.feedback.getFeedbackForExplanation(explanationIdNum);
      res.json(formatResponse.success(feedback));
    } catch (error) {
      console.error('Error getting feedback by explanation:', error);
      res.status(500).json(formatResponse.error(
        'Failed to retrieve feedback',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },

  /**
   * Get feedback for a specific puzzle
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getByPuzzle(req: Request, res: Response) {
    try {
      const { puzzleId } = req.params;

      if (!puzzleId) {
        return res.status(400).json(formatResponse.error(
          'Invalid puzzle ID',
          'Puzzle ID is required'
        ));
      }

      // Use feedback repository instead of dbService
      const feedback = await repositoryService.feedback.getFeedbackForPuzzle(puzzleId);
      res.json(formatResponse.success(feedback));
    } catch (error) {
      console.error('Error getting feedback by puzzle:', error);
      res.status(500).json(formatResponse.error(
        'Failed to retrieve feedback',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },

  /**
   * Get all feedback with optional filtering
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getAll(req: Request, res: Response) {
    try {
      // Build filters object from query parameters
      const filters: FeedbackFilters = this.buildFiltersFromQuery(req.query);

      // Use feedback repository instead of dbService
      const feedback = await repositoryService.feedback.getAllFeedback(filters);
      res.json(formatResponse.success(feedback));
    } catch (error) {
      console.error('Error getting all feedback:', error);
      res.status(500).json(formatResponse.error(
        'Failed to retrieve feedback',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },

  /**
   * Get feedback summary statistics
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getStats(req: Request, res: Response) {
    try {
      // Use feedback repository instead of dbService
      const stats = await repositoryService.feedback.getFeedbackSummaryStats();
      res.json(formatResponse.success(stats));
    } catch (error) {
      console.error('Error getting feedback stats:', error);
      res.status(500).json(formatResponse.error(
        'Failed to retrieve feedback statistics',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },

  /**
   * Get accuracy statistics for models based on feedback
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getAccuracyStats(req: Request, res: Response) {
    try {
      // Use feedback repository instead of dbService
      const stats = await repositoryService.feedback.getAccuracyStats();
      res.json(formatResponse.success(stats));
    } catch (error) {
      console.error('Error getting accuracy stats:', error);
      res.status(500).json(formatResponse.error(
        'Failed to retrieve accuracy statistics',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },

  /**
   * Health check endpoint for feedback system
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async healthCheck(req: Request, res: Response) {
    try {
      const healthStatus = await repositoryService.healthCheck();
      
      const status = healthStatus.status === 'healthy' ? 200 : 
                    healthStatus.status === 'degraded' ? 207 : 503;
      
      res.status(status).json(formatResponse.success({
        status: healthStatus.status,
        message: healthStatus.message,
        details: healthStatus.details,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error in feedback health check:', error);
      res.status(503).json(formatResponse.error(
        'Health check failed',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },

  /**
   * Helper method to build filters from query parameters
   * 
   * @param query - Express query object
   * @returns Cleaned FeedbackFilters object
   */
  buildFiltersFromQuery(query: any): FeedbackFilters {
    const filters: FeedbackFilters = {};

    // String filters
    if (query.puzzleId && typeof query.puzzleId === 'string') {
      filters.puzzleId = query.puzzleId;
    }
    if (query.modelName && typeof query.modelName === 'string') {
      filters.modelName = query.modelName;
    }

    // Vote type filter with validation
    if (query.voteType && ['helpful', 'not_helpful'].includes(query.voteType)) {
      filters.voteType = query.voteType as 'helpful' | 'not_helpful';
    }

    // Numeric filters with validation
    if (query.limit) {
      const limit = parseInt(query.limit as string);
      if (!isNaN(limit) && limit > 0 && limit <= 1000) {
        filters.limit = limit;
      }
    }
    
    if (query.offset) {
      const offset = parseInt(query.offset as string);
      if (!isNaN(offset) && offset >= 0) {
        filters.offset = offset;
      }
    }

    // Date filters with validation
    if (query.fromDate) {
      const fromDate = new Date(query.fromDate as string);
      if (!isNaN(fromDate.getTime())) {
        filters.fromDate = fromDate;
      }
    }
    
    if (query.toDate) {
      const toDate = new Date(query.toDate as string);
      if (!isNaN(toDate.getTime())) {
        filters.toDate = toDate;
      }
    }

    return filters;
  }
};