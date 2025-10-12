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
import type { ComparisonOutcome, ARCTask } from '../../shared/types.ts';

// Use the local ExplanationData type from EloRepository
interface ExplanationData {
  id: number;
  puzzleId: string;
  modelName: string;
  patternDescription: string;
  solvingStrategy: string;
  hints: string[];
  confidence: number;
  alienMeaning?: string;
  alienMeaningConfidence?: number;
  reasoningLog?: string;
  hasReasoningLog: boolean;
  reasoningItems?: any;
  apiProcessingTimeMs?: number;
  predictedOutputGrid?: any;
  isPredictionCorrect?: boolean;
  trustworthinessScore?: number;
  temperature?: number;
  reasoningEffort?: string;
  reasoningVerbosity?: string;
  reasoningSummaryType?: string;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  hasMultiplePredictions?: boolean;
  multiplePredictedOutputs?: any;
  multiTestPredictionGrids?: any;
  multiTestResults?: any;
  multiTestAllCorrect?: boolean;
  multiTestAverageAccuracy?: number;
  createdAt: string;
  multiValidation?: any;
  helpfulVotes?: number;
  notHelpfulVotes?: number;
}
import { v4 as uuidv4 } from 'uuid';

export interface ComparisonRequest {
  puzzleId?: string;
  sessionId?: string;
}

export interface VoteRequest {
  sessionId: string;
  explanationAId: number;
  explanationBId: number;
  outcome: ComparisonOutcome;
  puzzleId: string;
}

export interface ComparisonResponse {
  puzzleId: string;
  puzzle: ARCTask;
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
        throw new AppError('No suitable explanations found for comparison', 404, JSON.stringify({
          puzzleId: request.puzzleId,
          reason: 'insufficient_explanations'
        }));
      }

      // Fetch puzzle data
      const puzzle = await puzzleService.getPuzzleById(pair.puzzleId);
      if (!puzzle) {
        throw new AppError(`Puzzle ${pair.puzzleId} not found`, 404);
      }

      // Validate that both explanations have predicted grids
      if (!pair.explanationA.predictedOutputGrid || !pair.explanationB.predictedOutputGrid) {
        logger.warn('One or both explanations missing predicted output grid', JSON.stringify({
          explanationA: pair.explanationA.id,
          explanationB: pair.explanationB.id,
          puzzleId: pair.puzzleId
        }));
        throw new AppError('Selected explanations do not have predicted output grids', 400);
      }

      // Get ELO ratings for both explanations
      const [eloRatingA, eloRatingB] = await Promise.all([
        repositoryService.elo.getOrCreateEloRating(pair.explanationA.id),
        repositoryService.elo.getOrCreateEloRating(pair.explanationB.id)
      ]);

      return {
        puzzleId: pair.puzzleId,
        puzzle,
        explanationA: { ...pair.explanationA, eloRating: eloRatingA },
        explanationB: { ...pair.explanationB, eloRating: eloRatingB },
        sessionId
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error getting comparison pair:', error instanceof Error ? error.message : String(error));
      throw new AppError('Failed to get comparison pair', 500, JSON.stringify({ originalError: error instanceof Error ? error.message : String(error) }));
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
        throw new AppError('These explanations have already been compared in this session', 409);
      }

      // Validate outcome
      if (!['A_WINS', 'B_WINS', 'BOTH_BAD'].includes(request.outcome)) {
        throw new AppError('Invalid outcome. Must be A_WINS, B_WINS, or BOTH_BAD', 400);
      }

      // Record the vote and update ratings
      const voteData: VoteData = {
        sessionId: request.sessionId,
        explanationAId: request.explanationAId,
        explanationBId: request.explanationBId,
        outcome: request.outcome,
        puzzleId: request.puzzleId,
        userAgent
      };

      const result = await repositoryService.elo.recordVote(voteData);

      logger.info(`Vote recorded successfully: session=${request.sessionId}, outcome=${request.outcome}, ratingChangeA=${result.ratingChangeA}, ratingChangeB=${result.ratingChangeB}`);

      return {
        ...result,
        voteRecorded: true
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error recording vote:', error instanceof Error ? error.message : String(error));
      throw new AppError('Failed to record vote', 500, JSON.stringify({ originalError: error instanceof Error ? error.message : String(error) }));
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
        throw new AppError('Limit must be between 1 and 500', 400);
      }

      return await repositoryService.elo.getExplanationLeaderboard(limit);

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error getting explanation leaderboard:', error instanceof Error ? error.message : String(error));
      throw new AppError('Failed to get explanation leaderboard', 500);
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
      logger.error('Error getting model Elo stats:', error instanceof Error ? error.message : String(error));
      throw new AppError('Failed to get model Elo statistics', 500);
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
      logger.error('Error getting Elo system stats:', error instanceof Error ? error.message : String(error));
      throw new AppError('Failed to get system statistics', 500);
    }
  },

  /**
   * Validate vote request data
   */
  validateVoteRequest(request: VoteRequest): void {
    if (!request.sessionId) {
      throw new AppError('Session ID is required', 400);
    }

    if (!request.explanationAId || !request.explanationBId) {
      throw new AppError('Both explanation IDs are required', 400);
    }

    if (request.explanationAId === request.explanationBId) {
      throw new AppError('Cannot compare an explanation with itself', 400);
    }

    if (!request.outcome) {
      throw new AppError('Outcome is required', 400);
    }

    if (!['A_WINS', 'B_WINS', 'BOTH_BAD'].includes(request.outcome)) {
      throw new AppError('Invalid outcome. Must be A_WINS, B_WINS, or BOTH_BAD', 400);
    }

    if (!request.puzzleId) {
      throw new AppError('Puzzle ID is required', 400);
    }

    // Validate ID types
    if (!Number.isInteger(request.explanationAId) || !Number.isInteger(request.explanationBId)) {
      throw new AppError('Explanation IDs must be integers', 400);
    }

    if (request.explanationAId < 1 || request.explanationBId < 1) {
      throw new AppError('Explanation IDs must be positive integers', 400);
    }
  }
};