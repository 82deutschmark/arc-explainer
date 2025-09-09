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
import { feedbackService } from '../services/feedbackService.ts';
import { formatResponse } from '../utils/responseFormatter.ts';
import { repositoryService } from '../repositories/RepositoryService.ts';
import type { FeedbackFilters } from '../../shared/types.ts';

export const feedbackController = {
  /**
   * Create new feedback for an explanation
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async create(req: Request, res: Response) {
    try {
      const { puzzleId, explanationId, feedbackType, comment } = req.body;

      // The service layer will handle validation.
      const result = await feedbackService.addFeedback({
        puzzleId,
        explanationId,
        feedbackType,
        comment,
        userAgent: req.get('User-Agent'),
        sessionId: undefined,
      });
      
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

      // Get feedback from repository
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

      // Get feedback from repository
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

      // Get feedback from repository
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
      // Get feedback from repository
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
   * Get dangerous models statistics - models with high confidence but wrong predictions
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getAccuracyStats(req: Request, res: Response) {
    try {
      // Get dangerous models data instead of accuracy stats
      const dangerousModels = await repositoryService.accuracy.getDangerousModels(8);
      
      // Map dangerous models data to the existing AccuracyStats interface for compatibility
      const mappedStats = {
        totalSolverAttempts: dangerousModels.reduce((sum, model) => sum + model.totalAttempts, 0),
        totalCorrectPredictions: dangerousModels.reduce((sum, model) => sum + (model.totalAttempts - model.wrongHighConfidencePredictions), 0),
        overallAccuracyPercentage: dangerousModels.length > 0 ? 
          Math.round((dangerousModels.reduce((sum, model) => sum + model.overallAccuracy, 0) / dangerousModels.length) * 10) / 10 : 0,
        modelAccuracyRankings: dangerousModels.map(model => ({
          modelName: model.modelName,
          totalAttempts: model.totalHighConfidenceAttempts, // Show high-confidence attempts
          correctPredictions: model.totalHighConfidenceAttempts - model.wrongHighConfidencePredictions, // Correct high-confidence predictions
          accuracyPercentage: 100 - model.dangerLevel, // Invert danger level to show "accuracy" for high confidence attempts
          singleTestAccuracy: model.overallAccuracy, // Use overall accuracy for context
          multiTestAccuracy: model.avgConfidence, // Show average confidence in this field for dangerous models context
        }))
      };
      
      res.json(formatResponse.success(mappedStats));
    } catch (error) {
      console.error('Error getting dangerous models stats:', error);
      res.status(500).json({ error: 'Failed to get dangerous models stats', details: error });
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
   * Get user-submitted solutions for a puzzle (solution_explanation feedback type)
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getSolutions(req: Request, res: Response) {
    try {
      const { puzzleId } = req.params;

      if (!puzzleId) {
        return res.status(400).json(formatResponse.error(
          'Invalid puzzle ID',
          'Puzzle ID is required'
        ));
      }

      // Get solution explanations from repository
      const solutions = await repositoryService.feedback.getSolutionsForPuzzle(puzzleId);
      res.json(formatResponse.success(solutions));
    } catch (error) {
      console.error('Error getting solutions:', error);
      res.status(500).json(formatResponse.error(
        'Failed to retrieve solutions',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },

  /**
   * Submit a new user solution for a puzzle
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async submitSolution(req: Request, res: Response) {
    try {
      const { puzzleId } = req.params;
      const { comment } = req.body;

      if (!puzzleId) {
        return res.status(400).json(formatResponse.error(
          'Invalid puzzle ID',
          'Puzzle ID is required'
        ));
      }

      if (!comment || comment.trim().length === 0) {
        return res.status(400).json(formatResponse.error(
          'Invalid solution',
          'Solution explanation is required'
        ));
      }

      // Submit solution as feedback with solution_explanation type
      const result = await feedbackService.addFeedback({
        puzzleId,
        explanationId: null, // No explanation ID for user solutions
        feedbackType: 'solution_explanation',
        comment: comment.trim(),
        userAgent: req.get('User-Agent'),
        sessionId: undefined,
      });
      
      res.json(formatResponse.success({
        feedbackId: result.feedbackId
      }, result.message));
    } catch (error) {
      console.error('Error submitting solution:', error);
      res.status(500).json(formatResponse.error(
        'Failed to submit solution',
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
  /**
   * Vote on a solution (helpful or not helpful)
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async voteSolution(req: Request, res: Response) {
    try {
      const { solutionId } = req.params;
      const { voteType } = req.body;
      
      if (!solutionId) {
        return res.status(400).json(formatResponse.error(
          'Invalid solution ID',
          'Solution ID is required'
        ));
      }

      // Validate vote type
      if (!voteType || !['helpful', 'not_helpful'].includes(voteType)) {
        return res.status(400).json(formatResponse.error(
          'Invalid vote type',
          'Vote type must be either "helpful" or "not_helpful"'
        ));
      }

      // Submit vote as feedback on the solution
      const result = await feedbackService.addFeedback({
        puzzleId: undefined, // Will be retrieved from the solution feedback
        explanationId: null, // No explanation ID for solution votes
        feedbackType: voteType as 'helpful' | 'not_helpful',
        comment: null,
        userAgent: req.get('User-Agent'),
        sessionId: undefined,
        referenceFeedbackId: parseInt(solutionId) // Reference to the solution being voted on
      });
      
      res.json(formatResponse.success({
        feedbackId: result.feedbackId
      }, 'Vote recorded successfully'));
    } catch (error) {
      console.error('Error voting on solution:', error);
      res.status(500).json(formatResponse.error(
        'Failed to record vote',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },

  /**
   * Get vote counts for a solution
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getSolutionVotes(req: Request, res: Response) {
    try {
      const { solutionId } = req.params;
      
      if (!solutionId) {
        return res.status(400).json(formatResponse.error(
          'Invalid solution ID',
          'Solution ID is required'
        ));
      }

      // Get vote counts from repository
      const votes = await repositoryService.feedback.getSolutionVotes(parseInt(solutionId));
      res.json(formatResponse.success(votes));
    } catch (error) {
      console.error('Error getting solution votes:', error);
      res.status(500).json(formatResponse.error(
        'Failed to retrieve vote counts',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },
  
  buildFiltersFromQuery(query: any): FeedbackFilters {
    const filters: FeedbackFilters = {};

    // String filters
    if (query.puzzleId && typeof query.puzzleId === 'string') {
      filters.puzzleId = query.puzzleId;
    }
    if (query.modelName && typeof query.modelName === 'string') {
      filters.modelName = query.modelName;
    }

    // Feedback type filter with validation
    if (query.feedbackType && ['helpful', 'not_helpful', 'solution_explanation'].includes(query.feedbackType)) {
      filters.feedbackType = query.feedbackType as 'helpful' | 'not_helpful' | 'solution_explanation';
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