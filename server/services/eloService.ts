/**
 * eloService.ts
 *
 * Service layer for Elo rating system operations.
 * Handles business logic for explanation comparisons and voting.
 * Coordinates between repository layer and controllers.
 *
 * @author Claude
 * @date 2025-09-16
 */

import { repositoryService } from '../repositories/RepositoryService.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { puzzleService } from './puzzleService.ts';
import { logger } from '../utils/logger.ts';
import type { EloRating, ComparisonPair, VoteData, EloLeaderboard, ModelEloStats } from '../repositories/EloRepository.ts';
import type { ExplanationData, PuzzleData } from '../../shared/types.ts';
import { v4 as uuidv4 } from 'uuid';

export interface ComparisonRequest {
  puzzleId?: string;
  sessionId?: string;
}

export interface VoteRequest {
  sessionId: string;
  explanationAId: number;
  explanationBId: number;
  winnerId: number;
  puzzleId: string;
}

export interface ComparisonResponse {
  puzzleId: string;
  puzzle: PuzzleData;
  explanationA: ExplanationData & { eloRating: EloRating };
  explanationB: ExplanationData & { eloRating: EloRating };
  sessionId: string;
}

export interface VoteResponse {
  newRatingA: number;
  newRatingB: number;
  ratingChangeA: number;
  ratingChangeB: number;
  voteRecorded: boolean;
}

export const eloService = {
  /**
   * Get a pair of explanations for comparison
   *
   * @param request - Comparison request parameters
   * @returns ComparisonResponse with puzzle data and explanation pair
   * @throws AppError if no suitable explanations found
   */
  async getComparisonPair(request: ComparisonRequest): Promise<ComparisonResponse> {
    try {
      // Generate session ID if not provided
      const sessionId = request.sessionId || uuidv4();

      // Get comparison pair from repository
      const pair = await repositoryService.elo.getComparisonPair(request.puzzleId, sessionId);

      if (!pair) {
        throw new AppError(404, 'No suitable explanations found for comparison', {
          puzzleId: request.puzzleId,
          reason: 'insufficient_explanations'
        });
      }

      // Fetch puzzle data
      const puzzle = await puzzleService.getTaskById(pair.puzzleId);
      if (!puzzle) {
        throw new AppError(404, `Puzzle ${pair.puzzleId} not found`);
      }

      // Validate that both explanations have predicted grids
      if (!pair.explanationA.predictedOutputGrid || !pair.explanationB.predictedOutputGrid) {
        logger.warn('One or both explanations missing predicted output grid', {
          explanationA: pair.explanationA.id,
          explanationB: pair.explanationB.id,
          puzzleId: pair.puzzleId
        });
        throw new AppError(400, 'Selected explanations do not have predicted output grids');
      }

      return {
        puzzleId: pair.puzzleId,
        puzzle,
        explanationA: pair.explanationA,
        explanationB: pair.explanationB,
        sessionId
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error getting comparison pair:', error);
      throw new AppError(500, 'Failed to get comparison pair', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  /**
   * Record a user vote and update Elo ratings
   *
   * @param request - Vote request data
   * @param userAgent - User agent string for tracking
   * @returns VoteResponse with new ratings and changes
   * @throws AppError if vote is invalid or cannot be recorded
   */
  async recordVote(request: VoteRequest, userAgent?: string): Promise<VoteResponse> {
    try {
      this.validateVoteRequest(request);

      // Check for recent comparison to prevent duplicate votes
      const hasRecent = await repositoryService.elo.hasRecentComparison(
        request.sessionId,
        request.explanationAId,
        request.explanationBId
      );

      if (hasRecent) {
        throw new AppError(409, 'These explanations have already been compared in this session');
      }

      // Ensure winner is one of the compared explanations
      if (request.winnerId !== request.explanationAId && request.winnerId !== request.explanationBId) {
        throw new AppError(400, 'Winner must be one of the compared explanations');
      }

      // Record the vote and update ratings
      const voteData: VoteData = {
        sessionId: request.sessionId,
        explanationAId: request.explanationAId,
        explanationBId: request.explanationBId,
        winnerId: request.winnerId,
        puzzleId: request.puzzleId,
        userAgent
      };

      const result = await repositoryService.elo.recordVote(voteData);

      logger.info('Vote recorded successfully', {
        sessionId: request.sessionId,
        winner: request.winnerId,
        ratingChanges: {
          explanationA: result.ratingChangeA,
          explanationB: result.ratingChangeB
        }
      });

      return {
        ...result,
        voteRecorded: true
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error recording vote:', error);
      throw new AppError(500, 'Failed to record vote', { originalError: error instanceof Error ? error.message : String(error) });
    }
  },

  /**
   * Get explanation leaderboard based on Elo ratings
   *
   * @param limit - Maximum number of results to return
   * @returns Array of top-rated explanations
   */
  async getExplanationLeaderboard(limit: number = 50): Promise<EloLeaderboard[]> {
    try {
      if (limit < 1 || limit > 500) {
        throw new AppError(400, 'Limit must be between 1 and 500');
      }

      return await repositoryService.elo.getExplanationLeaderboard(limit);

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error getting explanation leaderboard:', error);
      throw new AppError(500, 'Failed to get explanation leaderboard');
    }
  },

  /**
   * Get model-level Elo statistics
   *
   * @returns Array of model statistics with average ratings
   */
  async getModelEloStats(): Promise<ModelEloStats[]> {
    try {
      return await repositoryService.elo.getModelEloStats();

    } catch (error) {
      logger.error('Error getting model Elo stats:', error);
      throw new AppError(500, 'Failed to get model Elo statistics');
    }
  },

  /**
   * Get comprehensive Elo system statistics
   *
   * @returns Overall system statistics
   */
  async getEloSystemStats(): Promise<{
    totalComparisons: number;
    activeExplanations: number;
    averageRating: number;
    topModels: ModelEloStats[];
    recentActivity: number;
  }> {
    try {
      // This would require additional repository methods, but for now return basic stats
      const modelStats = await repositoryService.elo.getModelEloStats();

      const totalComparisons = modelStats.reduce((sum, model) => sum + model.totalGames, 0);
      const activeExplanations = modelStats.reduce((sum, model) => sum + model.explanationCount, 0);
      const averageRating = modelStats.length > 0
        ? modelStats.reduce((sum, model) => sum + model.averageRating, 0) / modelStats.length
        : 1500;

      return {
        totalComparisons,
        activeExplanations,
        averageRating: Math.round(averageRating),
        topModels: modelStats.slice(0, 10),
        recentActivity: 0 // Would need additional query for recent votes
      };

    } catch (error) {
      logger.error('Error getting Elo system stats:', error);
      throw new AppError(500, 'Failed to get system statistics');
    }
  },

  /**
   * Validate vote request data
   */
  validateVoteRequest(request: VoteRequest): void {
    if (!request.sessionId) {
      throw new AppError(400, 'Session ID is required');
    }

    if (!request.explanationAId || !request.explanationBId) {
      throw new AppError(400, 'Both explanation IDs are required');
    }

    if (request.explanationAId === request.explanationBId) {
      throw new AppError(400, 'Cannot compare an explanation with itself');
    }

    if (!request.winnerId) {
      throw new AppError(400, 'Winner ID is required');
    }

    if (!request.puzzleId) {
      throw new AppError(400, 'Puzzle ID is required');
    }

    // Validate ID types
    if (!Number.isInteger(request.explanationAId) || !Number.isInteger(request.explanationBId) || !Number.isInteger(request.winnerId)) {
      throw new AppError(400, 'Explanation and winner IDs must be integers');
    }

    if (request.explanationAId < 1 || request.explanationBId < 1 || request.winnerId < 1) {
      throw new AppError(400, 'Explanation and winner IDs must be positive integers');
    }
  }
};