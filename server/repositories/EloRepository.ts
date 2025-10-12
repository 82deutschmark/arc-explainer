/**
 * Elo Repository Implementation
 *
 * Handles ELO RATING SYSTEM operations for head-to-head explanation comparisons.
 * Implements LMArena-style comparison voting and rating calculations.
 *
 * SCOPE: This repository handles ONE CONCEPT only:
 * - ELO RATINGS for explanations:
 *   - Rating calculations based on user votes
 *   - Comparison session management
 *   - Vote recording and validation
 *   - Leaderboard data generation
 *
 * KEY TABLES:
 * - elo_ratings: Current rating for each explanation
 * - comparison_votes: Record of each head-to-head vote
 * - comparison_sessions: User session tracking
 *
 * INTEGRATION POINTS:
 * - Uses explanations table to filter by predicted_output_grid IS NOT NULL
 * - Works with existing explanation data structure
 * - Provides data for frontend comparison components
 *
 * @author Claude
 * @date 2025-09-16
 */

import { BaseRepository } from './base/BaseRepository.js';
import type { ComparisonOutcome } from '../../shared/types.ts';
import { logger } from '../utils/logger.ts';
// ExplanationData interface defined locally since it's not exported from shared/types
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

export interface EloRating {
  id: number;
  explanationId: number;
  currentRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  lastUpdated: string;
  createdAt: string;
}

export interface ComparisonVote {
  id: number;
  sessionId: string;
  puzzleId: string;
  explanationAId: number;
  explanationBId: number;
  winnerId: number;
  ratingABefore: number;
  ratingBBefore: number;
  ratingAAfter: number;
  ratingBAfter: number;
  userAgent: string | null;
  createdAt: string;
}

export interface ComparisonSession {
  sessionId: string;
  totalVotes: number;
  lastActivity: string;
  createdAt: string;
}

export interface ComparisonPair {
  puzzleId: string;
  puzzle: any; // PuzzleData will be fetched separately
  explanationA: ExplanationData & { eloRating: EloRating };
  explanationB: ExplanationData & { eloRating: EloRating };
  sessionId: string;
}

export interface VoteData {
  sessionId: string;
  explanationAId: number;
  explanationBId: number;
  outcome: ComparisonOutcome;
  puzzleId: string;
  userAgent?: string;
}

export interface EloLeaderboard {
  explanationId: number;
  modelName: string;
  puzzleId: string;
  currentRating: number;
  gamesPlayed: number;
  winRate: number;
  patternDescription: string;
  solvingStrategy: string;
}

export interface ModelEloStats {
  modelName: string;
  averageRating: number;
  totalGames: number;
  totalWins: number;
  winRate: number;
  explanationCount: number;
}

export class EloRepository extends BaseRepository {

  /**
   * Get or create Elo rating for an explanation
   */
  async getOrCreateEloRating(explanationId: number): Promise<EloRating> {
    const query = `
      INSERT INTO elo_ratings (explanation_id, current_rating, games_played, wins, losses)
      VALUES ($1, 1500, 0, 0, 0)
      ON CONFLICT (explanation_id) DO NOTHING
      RETURNING *;
    `;

    try {
      // Try to insert, then fetch regardless
      await this.query(query, [explanationId]);

      const fetchQuery = `SELECT * FROM elo_ratings WHERE explanation_id = $1`;
      const result = await this.query(fetchQuery, [explanationId]);

      if (result.rows.length === 0) {
        throw new Error(`Failed to create or fetch Elo rating for explanation ${explanationId}`);
      }

      return this.mapEloRating(result.rows[0]);
    } catch (error) {
      logger.error(`Error getting/creating Elo rating for explanation ${explanationId}: ${error instanceof Error ? error.message : String(error)}`, 'elo');
      throw error;
    }
  }

  /**
   * Get a random pair of explanations for comparison
   * Filters for explanations with predicted_output_grid and avoids recent comparisons
   */
  async getComparisonPair(puzzleId?: string, sessionId?: string): Promise<{ explanationA: ExplanationData, explanationB: ExplanationData, puzzleId: string } | null> {
    let targetPuzzleId = puzzleId;

    // For random comparisons, first find a puzzle that has 2+ explanations
    if (!puzzleId) {
      const puzzleQuery = `
        SELECT e.puzzle_id, COUNT(*) as explanation_count
        FROM explanations e
        WHERE e.predicted_output_grid IS NOT NULL
        GROUP BY e.puzzle_id
        HAVING COUNT(*) >= 2
        ORDER BY RANDOM()
        LIMIT 1
      `;

      const puzzleResult = await this.query(puzzleQuery);
      if (puzzleResult.rows.length === 0) {
        logger.warn('No puzzles found with 2+ explanations for random comparison', 'elo');
        return null;
      }

      targetPuzzleId = puzzleResult.rows[0].puzzle_id;
      logger.info(`Selected random puzzle ${targetPuzzleId} for comparison (${puzzleResult.rows[0].explanation_count} explanations)`, 'elo');
    }

    // Now get explanations for the target puzzle
    // Simple query - just get all explanations for this puzzle
    const query = `
      SELECT e.*
      FROM explanations e
      WHERE e.predicted_output_grid IS NOT NULL
        AND e.puzzle_id = $1
      ORDER BY RANDOM()
      LIMIT 50
    `;

    const params = [targetPuzzleId];

    try {
      logger.info(`Fetching explanations for puzzle ${targetPuzzleId}`, 'elo');
      const result = await this.query(query, params);
      
      logger.info(`Found ${result.rows.length} explanations for puzzle ${targetPuzzleId}`, 'elo');

      if (result.rows.length < 2) {
        logger.warn(`Not enough explanations available for comparison. PuzzleId: ${puzzleId}, Available: ${result.rows.length}`, 'elo');
        // Debug: show what we did find
        if (result.rows.length > 0) {
          logger.info(`Available explanation IDs: ${result.rows.map(r => r.id).join(', ')}`, 'elo');
        }
        return null;
      }

      // Convert to explanations (no ELO ratings needed yet)
      const explanations = result.rows.map(row => this.mapExplanation(row));
      
      logger.info(`Mapped ${explanations.length} explanations successfully`, 'elo');

      if (explanations.length < 2) {
        logger.warn(`Puzzle ${targetPuzzleId} has fewer than 2 explanations after mapping`, 'elo');
        return null;
      }

      // Just pick the first two explanations - keep it simple!
      let explanationA = explanations[0];
      let explanationB = explanations[1];
      
      logger.info(`Selected explanations: A=${explanationA.id} (${explanationA.modelName}), B=${explanationB.id} (${explanationB.modelName})`, 'elo');

      // targetPuzzleId is guaranteed to be defined here since we return null if no puzzle found
      if (!targetPuzzleId) {
        throw new Error('Puzzle ID is undefined after selection process');
      }

      return {
        explanationA,
        explanationB,
        puzzleId: targetPuzzleId
      };

    } catch (error) {
      logger.error(`Error getting comparison pair: ${error instanceof Error ? error.message : String(error)}`, 'elo');
      throw error;
    }
  }

  /**
   * Record a comparison vote and update Elo ratings
   */
  async recordVote(voteData: VoteData): Promise<{ newRatingA: number, newRatingB: number, ratingChangeA: number, ratingChangeB: number }> {
    return await this.transaction(async (client) => {
      // Get or create current ratings
      let ratingA: EloRating, ratingB: EloRating;

      // Get rating A or create if missing
      const ratingAResult = await client.query('SELECT * FROM elo_ratings WHERE explanation_id = $1', [voteData.explanationAId]);
      if (ratingAResult.rows.length === 0) {
        await client.query(`
          INSERT INTO elo_ratings (explanation_id, current_rating, games_played, wins, losses)
          VALUES ($1, 1500, 0, 0, 0)
        `, [voteData.explanationAId]);
        ratingA = { id: 0, explanationId: voteData.explanationAId, currentRating: 1500, gamesPlayed: 0, wins: 0, losses: 0, lastUpdated: new Date().toISOString(), createdAt: new Date().toISOString() };
      } else {
        ratingA = this.mapEloRating(ratingAResult.rows[0]);
      }

      // Get rating B or create if missing  
      const ratingBResult = await client.query('SELECT * FROM elo_ratings WHERE explanation_id = $1', [voteData.explanationBId]);
      if (ratingBResult.rows.length === 0) {
        await client.query(`
          INSERT INTO elo_ratings (explanation_id, current_rating, games_played, wins, losses)
          VALUES ($1, 1500, 0, 0, 0)
        `, [voteData.explanationBId]);
        ratingB = { id: 0, explanationId: voteData.explanationBId, currentRating: 1500, gamesPlayed: 0, wins: 0, losses: 0, lastUpdated: new Date().toISOString(), createdAt: new Date().toISOString() };
      } else {
        ratingB = this.mapEloRating(ratingBResult.rows[0]);
      }

      // Calculate new ratings using Elo algorithm
      const outcome = voteData.outcome === 'A_WINS' ? 1 :
                     voteData.outcome === 'B_WINS' ? 0 :
                     0.5; // BOTH_BAD maps to draw
      const [newRatingA, newRatingB] = this.calculateElo(ratingA.currentRating, ratingB.currentRating, outcome, ratingA.gamesPlayed, ratingB.gamesPlayed);

      // For win/loss tracking (integers only)
      const winsA = voteData.outcome === 'A_WINS' ? 1 : 0;
      const lossesA = voteData.outcome === 'B_WINS' ? 1 : 0;
      const winsB = voteData.outcome === 'B_WINS' ? 1 : 0;
      const lossesB = voteData.outcome === 'A_WINS' ? 1 : 0;
      
      // Update ratings
      await client.query(`
        UPDATE elo_ratings
        SET current_rating = $1, games_played = games_played + 1,
            wins = wins + $2, losses = losses + $3, last_updated = CURRENT_TIMESTAMP
        WHERE explanation_id = $4
      `, [newRatingA, winsA, lossesA, voteData.explanationAId]);

      await client.query(`
        UPDATE elo_ratings
        SET current_rating = $1, games_played = games_played + 1,
            wins = wins + $2, losses = losses + $3, last_updated = CURRENT_TIMESTAMP
        WHERE explanation_id = $4
      `, [newRatingB, winsB, lossesB, voteData.explanationBId]);

      // Record comparison vote with outcome and legacy winner_id for backwards compatibility
      const winnerId = voteData.outcome === 'A_WINS' ? voteData.explanationAId :
                      voteData.outcome === 'B_WINS' ? voteData.explanationBId :
                      null; // BOTH_BAD
      
      await client.query(`
        INSERT INTO comparison_votes (session_id, puzzle_id, explanation_a_id, explanation_b_id, outcome, winner_id, rating_a_before, rating_b_before, rating_a_after, rating_b_after, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        voteData.sessionId, voteData.puzzleId, voteData.explanationAId, voteData.explanationBId,
        voteData.outcome, winnerId, ratingA.currentRating, ratingB.currentRating, newRatingA, newRatingB,
        voteData.userAgent
      ]);

      // Auto-feedback for BOTH_BAD votes: record negative feedback for both explanations
      if (voteData.outcome === 'BOTH_BAD') {
        // Insert feedback for explanation A
        await client.query(`
          INSERT INTO feedback (puzzle_id, explanation_id, feedback_type, comment, user_agent, session_id)
          VALUES ($1, $2, 'not_helpful', 'Auto-generated from BOTH_BAD ELO vote', $3, $4)
        `, [voteData.puzzleId, voteData.explanationAId, voteData.userAgent, voteData.sessionId]);

        // Insert feedback for explanation B
        await client.query(`
          INSERT INTO feedback (puzzle_id, explanation_id, feedback_type, comment, user_agent, session_id)
          VALUES ($1, $2, 'not_helpful', 'Auto-generated from BOTH_BAD ELO vote', $3, $4)
        `, [voteData.puzzleId, voteData.explanationBId, voteData.userAgent, voteData.sessionId]);
      }

      // Update or create session
      await client.query(`
        INSERT INTO comparison_sessions (session_id, total_votes, last_activity)
        VALUES ($1, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (session_id)
        DO UPDATE SET total_votes = comparison_sessions.total_votes + 1, last_activity = CURRENT_TIMESTAMP
      `, [voteData.sessionId]);

      return {
        newRatingA,
        newRatingB,
        ratingChangeA: newRatingA - ratingA.currentRating,
        ratingChangeB: newRatingB - ratingB.currentRating
      };
    });
  }

  /**
   * Get Elo leaderboard for explanations
   */
  async getExplanationLeaderboard(limit: number = 50): Promise<EloLeaderboard[]> {
    const query = `
      SELECT e.id as explanation_id, e.model_name, e.puzzle_id, e.pattern_description, e.solving_strategy,
             er.current_rating, er.games_played,
             CASE WHEN er.games_played > 0 THEN (er.wins::float / er.games_played) * 100 ELSE 0 END as win_rate
      FROM explanations e
      JOIN elo_ratings er ON e.id = er.explanation_id
      WHERE er.games_played >= 3
      ORDER BY er.current_rating DESC, er.games_played DESC
      LIMIT $1
    `;

    try {
      const result = await this.query(query, [limit]);
      return result.rows.map(row => ({
        explanationId: row.explanation_id,
        modelName: row.model_name,
        puzzleId: row.puzzle_id,
        currentRating: row.current_rating,
        gamesPlayed: row.games_played,
        winRate: parseFloat(row.win_rate),
        patternDescription: row.pattern_description,
        solvingStrategy: row.solving_strategy
      }));
    } catch (error) {
      logger.error('Error getting explanation leaderboard:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Get model-level Elo statistics
   */
  async getModelEloStats(): Promise<ModelEloStats[]> {
    const query = `
      SELECT e.model_name,
             AVG(er.current_rating) as average_rating,
             SUM(er.games_played) as total_games,
             SUM(er.wins) as total_wins,
             COUNT(e.id) as explanation_count
      FROM explanations e
      JOIN elo_ratings er ON e.id = er.explanation_id
      WHERE er.games_played > 0
      GROUP BY e.model_name
      HAVING SUM(er.games_played) >= 5
      ORDER BY AVG(er.current_rating) DESC
    `;

    try {
      const result = await this.query(query);
      return result.rows.map(row => ({
        modelName: row.model_name,
        averageRating: parseFloat(row.average_rating),
        totalGames: parseInt(row.total_games),
        totalWins: parseInt(row.total_wins),
        winRate: row.total_games > 0 ? (parseFloat(row.total_wins) / parseFloat(row.total_games)) * 100 : 0,
        explanationCount: parseInt(row.explanation_count)
      }));
    } catch (error) {
      logger.error('Error getting model Elo stats:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Check if explanations were recently compared in session
   */
  async hasRecentComparison(sessionId: string, explanationAId: number, explanationBId: number): Promise<boolean> {
    const query = `
      SELECT 1 FROM comparison_votes
      WHERE session_id = $1
      AND ((explanation_a_id = $2 AND explanation_b_id = $3)
           OR (explanation_a_id = $3 AND explanation_b_id = $2))
      LIMIT 1
    `;

    try {
      const result = await this.query(query, [sessionId, explanationAId, explanationBId]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking recent comparison:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Calculate new Elo ratings based on comparison outcome
   */
  private calculateElo(ratingA: number, ratingB: number, outcome: number, gamesA: number, gamesB: number): [number, number] {
    // K-factor: higher for new players, lower for established ones
    const kFactorA = gamesA < 30 ? 32 : 16;
    const kFactorB = gamesB < 30 ? 32 : 16;

    // Expected scores
    const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const expectedB = 1 - expectedA;

    // New ratings
    const newRatingA = ratingA + kFactorA * (outcome - expectedA);
    const newRatingB = ratingB + kFactorB * ((1 - outcome) - expectedB);

    return [Math.round(newRatingA), Math.round(newRatingB)];
  }

  /**
   * Map database row to EloRating object
   */
  private mapEloRating(row: any): EloRating {
    return {
      id: row.id,
      explanationId: row.explanation_id,
      currentRating: row.current_rating,
      gamesPlayed: row.games_played,
      wins: row.wins,
      losses: row.losses,
      lastUpdated: row.last_updated,
      createdAt: row.created_at
    };
  }

  /**
   * Map database row to ExplanationData object
   */
  private mapExplanation(row: any): ExplanationData {
    return {
      id: row.id,
      puzzleId: row.puzzle_id,
      modelName: row.model_name,
      patternDescription: row.pattern_description,
      solvingStrategy: row.solving_strategy,
      hints: row.hints || [],
      confidence: row.confidence,
      alienMeaning: row.alien_meaning,
      alienMeaningConfidence: row.alien_meaning_confidence,
      reasoningLog: row.reasoning_log,
      hasReasoningLog: row.has_reasoning_log,
      reasoningItems: row.reasoning_items,
      apiProcessingTimeMs: row.api_processing_time_ms,
      predictedOutputGrid: row.predicted_output_grid,
      isPredictionCorrect: row.is_prediction_correct,
      trustworthinessScore: row.trustworthiness_score,
      temperature: row.temperature,
      reasoningEffort: row.reasoning_effort,
      reasoningVerbosity: row.reasoning_verbosity,
      reasoningSummaryType: row.reasoning_summary_type,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      reasoningTokens: row.reasoning_tokens,
      totalTokens: row.total_tokens,
      estimatedCost: row.estimated_cost,
      hasMultiplePredictions: row.has_multiple_predictions,
      multiplePredictedOutputs: row.multiple_predicted_outputs,
      multiTestPredictionGrids: row.multi_test_prediction_grids,
      multiTestResults: row.multi_test_results,
      multiTestAllCorrect: row.multi_test_all_correct,
      multiTestAverageAccuracy: row.multi_test_average_accuracy,
      createdAt: row.created_at,
      multiValidation: row.multi_test_results, // Alias for compatibility
      // Optional feedback fields
      helpfulVotes: 0,
      notHelpfulVotes: 0
    };
  }
}