/**
 * eloController.ts
 *
 * Controller for Elo rating system routes.
 * Handles HTTP requests and responses for explanation comparison operations.
 * Follows established patterns from other controllers in the project.
 *
 * @author Claude
 * @date 2025-09-16
 */

import { Request, Response } from 'express';
import { eloService } from '../services/eloService.ts';
import { formatResponse } from '../utils/responseFormatter.ts';
import { logger } from '../utils/logger.ts';

export const eloController = {
  /**
   * Get a pair of explanations for comparison
   *
   * GET /api/elo/comparison/:puzzleId?
   * Query params: sessionId (optional)
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async getComparison(req: Request, res: Response) {
    try {
      const puzzleId = req.params.puzzleId;
      const sessionId = req.query.sessionId as string;

      logger.info('Getting comparison pair', { puzzleId, sessionId });

      const result = await eloService.getComparisonPair({
        puzzleId,
        sessionId
      });

      res.json(formatResponse.success(result, 'Comparison pair retrieved successfully'));

    } catch (error) {
      logger.error('Error getting comparison pair:', error);

      if (error instanceof Error && error.message.includes('404')) {
        res.status(404).json(formatResponse.error(
          'No suitable explanations found for comparison',
          error.message
        ));
      } else {
        res.status(500).json(formatResponse.error(
          'Failed to get comparison pair',
          error instanceof Error ? error.message : 'Unknown error'
        ));
      }
    }
  },

  /**
   * Record a user vote and update Elo ratings
   *
   * POST /api/elo/vote
   * Body: { sessionId, explanationAId, explanationBId, winnerId, puzzleId }
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async recordVote(req: Request, res: Response) {
    try {
      const { sessionId, explanationAId, explanationBId, winnerId, puzzleId } = req.body;

      logger.info('Recording vote', {
        sessionId,
        explanationAId,
        explanationBId,
        winnerId,
        puzzleId
      });

      const result = await eloService.recordVote({
        sessionId,
        explanationAId: parseInt(explanationAId, 10),
        explanationBId: parseInt(explanationBId, 10),
        winnerId: parseInt(winnerId, 10),
        puzzleId
      }, req.get('User-Agent'));

      res.json(formatResponse.success(result, 'Vote recorded successfully'));

    } catch (error) {
      logger.error('Error recording vote:', error);

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('409')) {
          res.status(409).json(formatResponse.error(
            'Duplicate comparison detected',
            'These explanations have already been compared in this session'
          ));
        } else if (error.message.includes('400')) {
          res.status(400).json(formatResponse.error(
            'Invalid vote data',
            error.message
          ));
        } else {
          res.status(500).json(formatResponse.error(
            'Failed to record vote',
            error.message
          ));
        }
      } else {
        res.status(500).json(formatResponse.error(
          'Failed to record vote',
          'Unknown error'
        ));
      }
    }
  },

  /**
   * Get explanation leaderboard based on Elo ratings
   *
   * GET /api/elo/leaderboard
   * Query params: limit (optional, default 50, max 500)
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async getLeaderboard(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 50;

      logger.info('Getting explanation leaderboard', { limit });

      const result = await eloService.getExplanationLeaderboard(limit);

      res.json(formatResponse.success({
        leaderboard: result,
        count: result.length,
        limit
      }, 'Leaderboard retrieved successfully'));

    } catch (error) {
      logger.error('Error getting leaderboard:', error);

      if (error instanceof Error && error.message.includes('400')) {
        res.status(400).json(formatResponse.error(
          'Invalid limit parameter',
          error.message
        ));
      } else {
        res.status(500).json(formatResponse.error(
          'Failed to get leaderboard',
          error instanceof Error ? error.message : 'Unknown error'
        ));
      }
    }
  },

  /**
   * Get model-level Elo statistics
   *
   * GET /api/elo/models
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async getModelStats(req: Request, res: Response) {
    try {
      logger.info('Getting model Elo statistics');

      const result = await eloService.getModelEloStats();

      res.json(formatResponse.success({
        modelStats: result,
        count: result.length
      }, 'Model statistics retrieved successfully'));

    } catch (error) {
      logger.error('Error getting model stats:', error);

      res.status(500).json(formatResponse.error(
        'Failed to get model statistics',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },

  /**
   * Get comprehensive Elo system statistics
   *
   * GET /api/elo/stats
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async getSystemStats(req: Request, res: Response) {
    try {
      logger.info('Getting Elo system statistics');

      const result = await eloService.getEloSystemStats();

      res.json(formatResponse.success(result, 'System statistics retrieved successfully'));

    } catch (error) {
      logger.error('Error getting system stats:', error);

      res.status(500).json(formatResponse.error(
        'Failed to get system statistics',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  },

  /**
   * Get a random comparison (no specific puzzle)
   *
   * GET /api/elo/comparison
   * Query params: sessionId (optional)
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async getRandomComparison(req: Request, res: Response) {
    try {
      const sessionId = req.query.sessionId as string;

      logger.info('Getting random comparison pair', { sessionId });

      const result = await eloService.getComparisonPair({
        sessionId
      });

      res.json(formatResponse.success(result, 'Random comparison pair retrieved successfully'));

    } catch (error) {
      logger.error('Error getting random comparison:', error);

      if (error instanceof Error && error.message.includes('404')) {
        res.status(404).json(formatResponse.error(
          'No suitable explanations found for comparison',
          error.message
        ));
      } else {
        res.status(500).json(formatResponse.error(
          'Failed to get random comparison',
          error instanceof Error ? error.message : 'Unknown error'
        ));
      }
    }
  }
};