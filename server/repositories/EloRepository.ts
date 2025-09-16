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

import { BaseRepository } from './base/BaseRepository.ts';
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
  predictionAccuracyScore?: number;
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
  winnerId: number;
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
  async getComparisonPair(puzzleId?: string, sessionId?: string): Promise<{ explanationA: ExplanationData & { eloRating: EloRating }, explanationB: ExplanationData & { eloRating: EloRating }, puzzleId: string } | null> {
    let query = `
      SELECT e.*, er.current_rating, er.games_played, er.wins, er.losses, er.last_updated as elo_last_updated, er.created_at as elo_created_at
      FROM explanations e
      LEFT JOIN elo_ratings er ON e.id = er.explanation_id
      WHERE e.predicted_output_grid IS NOT NULL
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (puzzleId) {
      paramCount++;
      query += ` AND e.puzzle_id = $${paramCount}`;
      params.push(puzzleId);
    }

    // Avoid explanations recently compared in this session
    if (sessionId) {
      paramCount++;
      query += ` AND e.id NOT IN (
        SELECT DISTINCT explanation_a_id FROM comparison_votes WHERE session_id = $${paramCount}
        UNION
        SELECT DISTINCT explanation_b_id FROM comparison_votes WHERE session_id = $${paramCount}
      )`;
      params.push(sessionId);
    }

    query += ` ORDER BY RANDOM() LIMIT 100`; // Get larger pool for better pairing

    try {
      const result = await this.query(query, params);

      if (result.rows.length < 2) {
        logger.warn(`Not enough explanations available for comparison. PuzzleId: ${puzzleId}, SessionId: ${sessionId}, Available: ${result.rows.length}`, 'elo');
        return null;
      }

      // Create Elo ratings for explanations that don't have them
      const explanationsWithRatings = await Promise.all(
        result.rows.map(async (row) => {
          let eloRating: EloRating;

          if (row.current_rating !== null) {
            // Existing rating
            eloRating = {
              id: row.explanation_id,
              explanationId: row.id,
              currentRating: row.current_rating,
              gamesPlayed: row.games_played,
              wins: row.wins,
              losses: row.losses,
              lastUpdated: row.elo_last_updated,
              createdAt: row.elo_created_at
            };
          } else {
            // Create new rating
            eloRating = await this.getOrCreateEloRating(row.id);
          }

          return {
            ...this.mapExplanation(row),
            eloRating
          };
        })
      );

      // Select two explanations with similar ratings when possible
      explanationsWithRatings.sort((a, b) => a.eloRating.currentRating - b.eloRating.currentRating);

      // Try to find explanations from different models if possible
      let explanationA = explanationsWithRatings[0];
      let explanationB = explanationsWithRatings[1];

      // Look for a better pairing (different models, similar ratings)
      for (let i = 1; i < Math.min(explanationsWithRatings.length, 10); i++) {
        const candidate = explanationsWithRatings[i];
        if (candidate.modelName !== explanationA.modelName &&
            Math.abs(candidate.eloRating.currentRating - explanationA.eloRating.currentRating) <= 400) {
          explanationB = candidate;
          break;
        }
      }

      const finalPuzzleId = puzzleId || explanationA.puzzleId;

      return {
        explanationA,
        explanationB,
        puzzleId: finalPuzzleId
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
      // Get current ratings
      const ratingAResult = await client.query('SELECT * FROM elo_ratings WHERE explanation_id = $1', [voteData.explanationAId]);
      const ratingBResult = await client.query('SELECT * FROM elo_ratings WHERE explanation_id = $1', [voteData.explanationBId]);

      if (ratingAResult.rows.length === 0 || ratingBResult.rows.length === 0) {
        throw new Error('One or both explanations do not have Elo ratings');
      }

      const ratingA = this.mapEloRating(ratingAResult.rows[0]);
      const ratingB = this.mapEloRating(ratingBResult.rows[0]);

      // Calculate new ratings using Elo algorithm
      const outcome = voteData.winnerId === voteData.explanationAId ? 1 : 0;
      const [newRatingA, newRatingB] = this.calculateElo(ratingA.currentRating, ratingB.currentRating, outcome, ratingA.gamesPlayed, ratingB.gamesPlayed);

      // Update ratings
      await client.query(`
        UPDATE elo_ratings
        SET current_rating = $1, games_played = games_played + 1,
            wins = wins + $2, losses = losses + $3, last_updated = CURRENT_TIMESTAMP
        WHERE explanation_id = $4
      `, [newRatingA, outcome, 1 - outcome, voteData.explanationAId]);

      await client.query(`
        UPDATE elo_ratings
        SET current_rating = $1, games_played = games_played + 1,
            wins = wins + $2, losses = losses + $3, last_updated = CURRENT_TIMESTAMP
        WHERE explanation_id = $4
      `, [newRatingB, 1 - outcome, outcome, voteData.explanationBId]);

      // Record the vote
      await client.query(`
        INSERT INTO comparison_votes
        (session_id, puzzle_id, explanation_a_id, explanation_b_id, winner_id,
         rating_a_before, rating_b_before, rating_a_after, rating_b_after, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        voteData.sessionId, voteData.puzzleId, voteData.explanationAId, voteData.explanationBId,
        voteData.winnerId, ratingA.currentRating, ratingB.currentRating, newRatingA, newRatingB,
        voteData.userAgent
      ]);

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
      predictionAccuracyScore: row.prediction_accuracy_score,
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