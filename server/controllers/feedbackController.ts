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

const VALID_FEEDBACK_TYPES = new Set<FeedbackFilters['feedbackType']>([
  'helpful',
  'not_helpful',
  'solution_explanation',
]);

const coerceQueryString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }

  return undefined;
};

const buildFiltersFromQuery = (query: Record<string, unknown>): FeedbackFilters => {
  const filters: FeedbackFilters = {};

  const puzzleId = coerceQueryString(query.puzzleId);
  if (puzzleId) {
    filters.puzzleId = puzzleId;
  }

  const modelName = coerceQueryString(query.modelName);
  if (modelName) {
    filters.modelName = modelName;
  }

  const feedbackType = coerceQueryString(query.feedbackType);
  if (feedbackType && VALID_FEEDBACK_TYPES.has(feedbackType as FeedbackFilters['feedbackType'])) {
    filters.feedbackType = feedbackType as FeedbackFilters['feedbackType'];
  }

  const limitString = coerceQueryString(query.limit);
  if (limitString) {
    const limit = parseInt(limitString, 10);
    if (!Number.isNaN(limit) && limit > 0 && limit <= 10_000) {
      filters.limit = limit;
    }
  }

  const offsetString = coerceQueryString(query.offset);
  if (offsetString) {
    const offset = parseInt(offsetString, 10);
    if (!Number.isNaN(offset) && offset >= 0) {
      filters.offset = offset;
    }
  }

  const fromDateString = coerceQueryString(query.fromDate);
  if (fromDateString) {
    const fromDate = new Date(fromDateString);
    if (!Number.isNaN(fromDate.getTime())) {
      filters.fromDate = fromDate;
    }
  }

  const toDateString = coerceQueryString(query.toDate);
  if (toDateString) {
    const toDate = new Date(toDateString);
    if (!Number.isNaN(toDate.getTime())) {
      filters.toDate = toDate;
    }
  }

  return filters;
};

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

      // Check if ID is within PostgreSQL integer range (-2,147,483,648 to 2,147,483,647)
      // Optimistic UI uses timestamps which exceed this range
      if (explanationIdNum > 2147483647 || explanationIdNum < -2147483648) {
        // Return empty feedback array for optimistic/timestamp IDs
        return res.json(formatResponse.success([]));
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
      const filters = buildFiltersFromQuery(req.query as Record<string, unknown>);
      if (filters.fromDate && typeof req.query.fromDate === 'string' && (!filters.startDate || filters.startDate.trim() === '')) {
        filters.startDate = req.query.fromDate;
      }
      if (filters.toDate && typeof req.query.toDate === 'string' && (!filters.endDate || filters.endDate.trim() === '')) {
        filters.endDate = req.query.toDate;
      }

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
   * Get accuracy statistics showing models needing improvement (low accuracy + low trustworthiness)
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getAccuracyStats(req: Request, res: Response) {
    try {
      // Get pure accuracy stats (lowest accuracy first - already sorted correctly)
      const stats = await repositoryService.accuracy.getPureAccuracyStats();
      res.json(formatResponse.success(stats));
    } catch (error) {
      console.error('Error getting accuracy stats:', error);
      res.status(500).json({ error: 'Failed to get accuracy stats', details: error });
    }
  },

  /**
   * Get accuracy statistics with minimum attempts filtering
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async getAccuracyStatsFiltered(req: Request, res: Response) {
    try {
      // Get min attempts from query parameter, default to 100
      const minAttempts = parseInt(req.query.minAttempts as string) || 100;

      // Validate minAttempts is reasonable (between 1 and 1000)
      if (minAttempts < 1 || minAttempts > 1000) {
        return res.status(400).json(formatResponse.error(
          'Invalid minimum attempts',
          'Minimum attempts must be between 1 and 1000'
        ));
      }

      const stats = await repositoryService.accuracy.getPureAccuracyStatsWithMinAttempts(minAttempts);
      res.json(formatResponse.success(stats));
    } catch (error) {
      console.error('Error getting filtered accuracy stats:', error);
      res.status(500).json(formatResponse.error(
        'Failed to get filtered accuracy stats',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },

  /**
   * Get overconfident models analysis - models with high confidence but poor accuracy
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async getOverconfidentModels(req: Request, res: Response) {
    try {
      // Get limit from query parameter, default to 15
      const limit = parseInt(req.query.limit as string) || 15;

      // Validate limit is reasonable (between 1 and 50)
      if (limit < 1 || limit > 50) {
        return res.status(400).json(formatResponse.error(
          'Invalid limit',
          'Limit must be between 1 and 50'
        ));
      }

      const overconfidentModels = await repositoryService.accuracy.getOverconfidentModels(limit);
      res.json(formatResponse.success(overconfidentModels));
    } catch (error) {
      console.error('Error getting overconfident models:', error);
      res.status(500).json(formatResponse.error(
        'Failed to get overconfident models',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },

  /**
   * Get debate accuracy statistics - ONLY for debate rebuttals/challenges
   *
   * This endpoint returns accuracy stats specifically for debate rebuttals,
   * excluding original solver attempts. Use this to understand which models
   * are good at challenging incorrect explanations.
   *
   * Comparison with getAccuracyStats():
   * - getAccuracyStats() → Pure solver attempts (rebutting_explanation_id IS NULL)
   * - getDebateAccuracyStats() → Debate challenges only (rebutting_explanation_id IS NOT NULL)
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async getDebateAccuracyStats(req: Request, res: Response) {
    try {
      // Get debate accuracy stats (best performers first - sorted DESC)
      const stats = await repositoryService.accuracy.getDebateAccuracyStats();
      res.json(formatResponse.success(stats));
    } catch (error) {
      console.error('Error getting debate accuracy stats:', error);
      res.status(500).json(formatResponse.error(
        'Failed to get debate accuracy stats',
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
      if (!isNaN(limit) && limit > 0 && limit <= 10000) {
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