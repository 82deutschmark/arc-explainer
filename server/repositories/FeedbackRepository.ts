/**
 * Feedback Repository Implementation
 * 
 * Handles all feedback-related database operations.
 * Extracted from monolithic DbService to follow Single Responsibility Principle.
 * 
 * IMPORTANT: This repository handles TWO COMPLETELY DIFFERENT TYPES OF DATA:
 * 
 * 1. USER FEEDBACK (explanation quality ratings):
 *    - How good/helpful an AI model's explanation was
 *    - Stored in 'feedback' table with vote_type: 'helpful' | 'not_helpful'  
 *    - A model can solve a puzzle WRONG but give a great explanation → helpful feedback
 *    - A model can solve a puzzle RIGHT but give a terrible explanation → not helpful feedback
 *    - Used for: Community feedback stats, explanation quality rankings
 * 
 * 2. PREDICTION ACCURACY (puzzle-solving performance):
 *    - Whether an AI model actually solved the puzzle correctly
 *    - Stored in 'explanations' table fields:
 *      * is_prediction_correct (boolean) - single test correctness
 *      * multi_test_all_correct (boolean) - multi-test correctness  
 *      * predicted_output_grid - the model's actual prediction
 *      * multi_test_prediction_grids - multi-test predictions
 *    - Used for: Solver performance stats, accuracy leaderboards
 * 
 * These are SEPARATE METRICS and should never be confused!
 * - getAccuracyStats() = prediction accuracy (puzzle solving)
 * - getFeedbackStats() = user feedback (explanation quality)
 * 
 * @author Claude
 * @date 2025-08-27
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';
import type { Feedback, DetailedFeedback, FeedbackFilters, FeedbackStats } from '../../shared/types.ts';

export interface AddFeedbackData {
  explanationId: number;
  voteType: 'helpful' | 'not_helpful';
  comment: string;
  userAgent?: string;
  sessionId?: string;
}

export class FeedbackRepository extends BaseRepository {
  
  async addFeedback(data: AddFeedbackData): Promise<{ success: boolean; feedback?: Feedback }> {
    if (!this.isConnected()) {
      throw new Error('Database not available');
    }

    const client = await this.getClient();
    
    try {
      const result = await this.query(`
        INSERT INTO feedback (explanation_id, vote_type, comment, user_agent, session_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        data.explanationId,
        data.voteType,
        data.comment,
        data.userAgent || null,
        data.sessionId || null
      ], client);

      if (result.rows.length === 0) {
        throw new Error('Failed to add feedback');
      }

      const feedback: Feedback = {
        id: result.rows[0].id,
        explanationId: result.rows[0].explanation_id,
        voteType: result.rows[0].vote_type,
        comment: result.rows[0].comment,
        createdAt: result.rows[0].created_at,
        userAgent: result.rows[0].user_agent,
        sessionId: result.rows[0].session_id
      };

      return { success: true, feedback };
    } catch (error) {
      logger.error(`Error adding feedback: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    } finally {
      client.release();
    }
  }

  async getFeedbackForExplanation(explanationId: number): Promise<Feedback[]> {
    if (!this.isConnected()) {
      return [];
    }

    const result = await this.query(`
      SELECT * FROM feedback 
      WHERE explanation_id = $1 
      ORDER BY created_at DESC
    `, [explanationId]);

    return result.rows.map(row => ({
      id: row.id,
      explanationId: row.explanation_id,
      voteType: row.vote_type,
      comment: row.comment,
      createdAt: row.created_at,
      userAgent: row.user_agent,
      sessionId: row.session_id
    }));
  }

  async getFeedbackForPuzzle(taskId: string): Promise<DetailedFeedback[]> {
    if (!this.isConnected()) {
      return [];
    }

    const result = await this.query(`
      SELECT 
        f.*,
        e.puzzle_id,
        e.model_name,
        e.confidence,
        e.pattern_description
      FROM feedback f
      JOIN explanations e ON f.explanation_id = e.id
      WHERE e.puzzle_id = $1
      ORDER BY f.created_at DESC
    `, [taskId]);

    return result.rows.map(row => ({
      id: row.id,
      explanationId: row.explanation_id,
      voteType: row.vote_type,
      comment: row.comment,
      createdAt: row.created_at,
      userAgent: row.user_agent,
      sessionId: row.session_id,
      puzzleId: row.puzzle_id,
      modelName: row.model_name,
      confidence: parseFloat(row.confidence) || 0,
      patternDescription: row.pattern_description?.substring(0, 100) || ''
    }));
  }

  async getAllFeedback(filters: FeedbackFilters = {}): Promise<DetailedFeedback[]> {
    if (!this.isConnected()) {
      return [];
    }

    let query = `
      SELECT 
        f.*,
        e.puzzle_id,
        e.model_name,
        e.confidence,
        e.pattern_description
      FROM feedback f
      JOIN explanations e ON f.explanation_id = e.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramCount = 0;

    if (filters.voteType) {
      query += ` AND f.vote_type = $${++paramCount}`;
      params.push(filters.voteType);
    }

    if (filters.modelName) {
      query += ` AND e.model_name = $${++paramCount}`;
      params.push(filters.modelName);
    }

    if (filters.puzzleId) {
      query += ` AND e.puzzle_id = $${++paramCount}`;
      params.push(filters.puzzleId);
    }

    if (filters.fromDate) {
      query += ` AND f.created_at >= $${++paramCount}`;
      params.push(filters.fromDate);
    }

    if (filters.toDate) {
      query += ` AND f.created_at <= $${++paramCount}`;
      params.push(filters.toDate);
    }

    query += ` ORDER BY f.created_at DESC`;

    if (filters.limit && filters.limit > 0) {
      query += ` LIMIT $${++paramCount}`;
      params.push(filters.limit);
    }

    const result = await this.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      explanationId: row.explanation_id,
      voteType: row.vote_type,
      comment: row.comment,
      createdAt: row.created_at,
      userAgent: row.user_agent,
      sessionId: row.session_id,
      puzzleId: row.puzzle_id,
      modelName: row.model_name,
      confidence: parseFloat(row.confidence) || 0,
      patternDescription: row.pattern_description?.substring(0, 100) || ''
    }));
  }

  async getFeedbackSummaryStats(): Promise<FeedbackStats> {
    if (!this.isConnected()) {
      return {
        totalFeedback: 0,
        helpfulCount: 0,
        notHelpfulCount: 0,
        helpfulPercentage: 0,
        notHelpfulPercentage: 0,
        averageCommentLength: 0,
        topModels: [],
        feedbackTrends: {
          daily: [],
          weekly: []
        },
        feedbackByModel: {},
        feedbackByDay: []
      };
    }

    try {
      // Get basic stats
      const basicStats = await this.query(`
        SELECT 
          COUNT(*) as total_feedback,
          SUM(CASE WHEN vote_type = 'helpful' THEN 1 ELSE 0 END) as helpful_count,
          SUM(CASE WHEN vote_type = 'not_helpful' THEN 1 ELSE 0 END) as not_helpful_count,
          AVG(LENGTH(comment)) as avg_comment_length
        FROM feedback
      `);

      // Get top models by feedback volume
      const topModels = await this.query(`
        SELECT 
          e.model_name,
          COUNT(*) as feedback_count,
          SUM(CASE WHEN f.vote_type = 'helpful' THEN 1 ELSE 0 END) as helpful_count,
          SUM(CASE WHEN f.vote_type = 'not_helpful' THEN 1 ELSE 0 END) as not_helpful_count,
          AVG(e.confidence) as avg_confidence
        FROM feedback f
        JOIN explanations e ON f.explanation_id = e.id
        WHERE e.model_name IS NOT NULL
        GROUP BY e.model_name
        ORDER BY feedback_count DESC
        LIMIT 10
      `);

      // Get daily trends (last 30 days)
      const dailyTrends = await this.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          SUM(CASE WHEN vote_type = 'helpful' THEN 1 ELSE 0 END) as helpful_count
        FROM feedback
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      const stats = basicStats.rows[0];
      const totalFeedback = parseInt(stats.total_feedback) || 0;
      const helpfulCount = parseInt(stats.helpful_count) || 0;
      const notHelpfulCount = parseInt(stats.not_helpful_count) || 0;

      return {
        totalFeedback,
        helpfulCount,
        notHelpfulCount,
        helpfulPercentage: totalFeedback > 0 ? Math.round((helpfulCount / totalFeedback) * 100) : 0,
        notHelpfulPercentage: totalFeedback > 0 ? Math.round((notHelpfulCount / totalFeedback) * 100) : 0,
        averageCommentLength: Math.round(parseFloat(stats.avg_comment_length) || 0),
        topModels: topModels.rows.map(row => ({
          modelName: row.model_name,
          feedbackCount: parseInt(row.feedback_count),
          helpfulCount: parseInt(row.helpful_count),
          helpfulPercentage: parseInt(row.feedback_count) > 0 
            ? Math.round((parseInt(row.helpful_count) / parseInt(row.feedback_count)) * 100) 
            : 0,
          avgConfidence: Math.round((parseFloat(row.avg_confidence) || 0) * 10) / 10
        })),
        feedbackTrends: {
          daily: dailyTrends.rows.map(row => ({
            date: row.date,
            count: parseInt(row.count),
            helpful: parseInt(row.helpful_count),
            notHelpful: parseInt(row.count) - parseInt(row.helpful_count)
          })),
          weekly: [] // Could be implemented if needed
        },
        feedbackByModel: topModels.rows.reduce((acc, row) => {
          acc[row.model_name] = {
            helpful: parseInt(row.helpful_count) || 0,
            notHelpful: parseInt(row.not_helpful_count) || 0,
            total: parseInt(row.feedback_count) || 0
          };
          return acc;
        }, {} as Record<string, { helpful: number; notHelpful: number; total: number }>),
        feedbackByDay: dailyTrends.rows.map(row => ({
          date: row.date,
          helpful: parseInt(row.helpful_count),
          notHelpful: parseInt(row.count) - parseInt(row.helpful_count),
          total: parseInt(row.count)
        }))
      };
    } catch (error) {
      logger.error(`Error getting feedback summary stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get GENERAL MODEL STATS (all explanations, not just solver mode)
   * 
   * Shows all models that have created explanations, regardless of solver mode.
   * Uses avgAccuracyScore as trustworthiness when prediction_accuracy_score available.
   */
  async getGeneralModelStats(): Promise<{ totalExplanations: number; avgConfidence: number; totalSolverAttempts: number; totalCorrectPredictions: number; modelAccuracy: any[]; accuracyByModel: any[] }> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty general model stats.', 'database');
      return {
        totalExplanations: 0,
        avgConfidence: 0,
        totalSolverAttempts: 0,
        totalCorrectPredictions: 0,
        modelAccuracy: [],
        accuracyByModel: []
      };
    }

    try {
      // Get basic explanation stats - ALL explanations with confidence
      const basicStats = await this.query(`
        SELECT 
          COUNT(*) as total_explanations,
          AVG(confidence) as avg_confidence,
          COUNT(CASE WHEN predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL THEN 1 END) as total_solver_attempts,
          SUM(CASE WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct_predictions
        FROM explanations
        WHERE confidence IS NOT NULL 
      `);

      // Get model performance for ALL models with explanations
      const modelStats = await this.query(`
        SELECT 
          e.model_name,
          COUNT(e.id) as total_attempts,
          AVG(e.confidence) as avg_confidence,
          
          -- Solver mode stats (subset of total attempts)
          COUNT(CASE WHEN e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL THEN 1 END) as solver_attempts,
          SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) as correct_predictions,
          
          -- Trustworthiness scores (when available)
          AVG(e.prediction_accuracy_score) as avg_trustworthiness_score,
          MIN(e.prediction_accuracy_score) as min_trustworthiness_score,
          MAX(e.prediction_accuracy_score) as max_trustworthiness_score,
          COUNT(CASE WHEN e.prediction_accuracy_score IS NOT NULL THEN 1 END) as trustworthiness_entries,
          
          -- Calculate accuracy percentage for solver attempts only
          CASE 
            WHEN COUNT(CASE WHEN e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL THEN 1 END) > 0 
            THEN (SUM(CASE WHEN e.is_prediction_correct = true OR e.multi_test_all_correct = true THEN 1 ELSE 0 END) * 100.0 / 
                  COUNT(CASE WHEN e.predicted_output_grid IS NOT NULL OR e.multi_test_prediction_grids IS NOT NULL THEN 1 END))
            ELSE 0 
          END as solver_accuracy_percentage
        FROM explanations e
        WHERE e.model_name IS NOT NULL
          AND e.confidence IS NOT NULL
        GROUP BY e.model_name
        HAVING COUNT(e.id) >= 1  -- Only include models with at least 1 explanation
        ORDER BY solver_accuracy_percentage DESC, total_attempts DESC
      `);

      const stats = basicStats.rows[0];

      return {
        totalExplanations: parseInt(stats.total_explanations) || 0,
        avgConfidence: parseFloat(stats.avg_confidence) || 0,
        totalSolverAttempts: parseInt(stats.total_solver_attempts) || 0,
        totalCorrectPredictions: parseInt(stats.total_correct_predictions) || 0,
        accuracyByModel: modelStats.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts) || 0,
          totalExplanations: parseInt(row.total_attempts) || 0,
          avgConfidence: Math.round((parseFloat(row.avg_confidence) || 0) * 10) / 10,
          
          // Solver-specific data (subset of total)
          solverAttempts: parseInt(row.solver_attempts) || 0,
          correctPredictions: parseInt(row.correct_predictions) || 0,
          accuracyPercentage: Math.round((parseFloat(row.solver_accuracy_percentage) || 0) * 10) / 10,
          
          // Trustworthiness scores (when available)
          avgTrustworthiness: Math.round((parseFloat(row.avg_trustworthiness_score) || 0) * 10000) / 10000,
          avgAccuracyScore: Math.round((parseFloat(row.avg_trustworthiness_score) || 0) * 10000) / 10000, // Backward compatibility
          minTrustworthiness: Math.round((parseFloat(row.min_trustworthiness_score) || 0) * 10000) / 10000,
          maxTrustworthiness: Math.round((parseFloat(row.max_trustworthiness_score) || 0) * 10000) / 10000,
          trustworthinessEntries: parseInt(row.trustworthiness_entries) || 0,
          
          // For compatibility
          successfulPredictions: parseInt(row.correct_predictions) || 0,
          predictionSuccessRate: Math.round((parseFloat(row.solver_accuracy_percentage) || 0) * 10) / 10
        })),
        modelAccuracy: modelStats.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts) || 0,
          avgConfidence: parseFloat(row.avg_confidence) || 0,
          correctPredictions: parseInt(row.correct_predictions) || 0,
          accuracyPercentage: parseFloat(row.solver_accuracy_percentage) || 0
        }))
      };
    } catch (error) {
      logger.error(`Error getting general model stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get PREDICTION ACCURACY STATS (puzzle-solving performance)
   * 
   * NOT user feedback! This measures how well models actually solve puzzles.
   * 
   * SOLVER ATTEMPT CRITERIA:
   * - Must have predicted_output_grid OR multi_test_prediction_grids (model made predictions)
   * 
   * CORRECTNESS CRITERIA:  
   * - is_prediction_correct = true (single test correct)
   * - multi_test_all_correct = true (multi-test correct)
   */
  async getAccuracyStats(): Promise<{ totalExplanations: number; avgConfidence: number; totalSolverAttempts: number; totalCorrectPredictions: number; modelAccuracy: any[]; accuracyByModel: any[] }> {
    if (!this.isConnected()) {
      return {
        totalExplanations: 0,
        avgConfidence: 0,
        totalSolverAttempts: 0,
        totalCorrectPredictions: 0,
        
        modelAccuracy: [],
        accuracyByModel: []
      };
    }

    try {
      // Get basic explanation stats - only count actual solver attempts (entries with prediction grids)
      const basicStats = await this.query(`
        SELECT 
          COUNT(*) as total_solver_attempts,
          AVG(confidence) as avg_confidence,
          SUM(CASE WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 1 ELSE 0 END) as total_correct_predictions
        FROM explanations
        WHERE confidence IS NOT NULL 
          AND (predicted_output_grid IS NOT NULL 
               OR multi_test_prediction_grids IS NOT NULL)
      `);

      // Get model accuracy based on ACTUAL prediction correctness - not user feedback
      const modelAccuracy = await this.query(`
        SELECT 
          e.model_name,
          COUNT(e.id) as total_attempts,
          AVG(e.confidence) as avg_confidence,
          
          -- Single test accuracy (using is_prediction_correct)
          COUNT(CASE WHEN e.is_prediction_correct IS NOT NULL THEN 1 END) as single_test_attempts,
          SUM(CASE WHEN e.is_prediction_correct = true THEN 1 ELSE 0 END) as single_correct_predictions,
          
          -- Multi test accuracy (using multi_test_all_correct and multi_test_average_accuracy)  
          COUNT(CASE WHEN e.multi_test_all_correct IS NOT NULL THEN 1 END) as multi_test_attempts,
          SUM(CASE WHEN e.multi_test_all_correct = true THEN 1 ELSE 0 END) as multi_all_correct,
          AVG(e.multi_test_average_accuracy) as avg_multi_test_accuracy,
          
          -- Overall accuracy combining both single and multi tests
          (SUM(CASE WHEN e.is_prediction_correct = true THEN 1 ELSE 0 END) + 
           SUM(CASE WHEN e.multi_test_all_correct = true THEN 1 ELSE 0 END)) as total_correct_predictions,
          
          -- Overall accuracy score using prediction_accuracy_score field (trustworthiness)
          AVG(e.prediction_accuracy_score) as avg_trustworthiness_score,
          MIN(e.prediction_accuracy_score) as min_trustworthiness_score,
          MAX(e.prediction_accuracy_score) as max_trustworthiness_score,
          
          -- Calculate overall accuracy percentage
          CASE 
            WHEN COUNT(e.id) > 0 
            THEN ((SUM(CASE WHEN e.is_prediction_correct = true THEN 1 ELSE 0 END) + 
                   SUM(CASE WHEN e.multi_test_all_correct = true THEN 1 ELSE 0 END)) * 100.0 / COUNT(e.id))
            ELSE 0 
          END as actual_accuracy_percentage
        FROM explanations e
        WHERE e.model_name IS NOT NULL
          AND (e.predicted_output_grid IS NOT NULL 
               OR e.multi_test_prediction_grids IS NOT NULL)
          AND e.prediction_accuracy_score IS NOT NULL
          AND e.confidence IS NOT NULL
          AND NOT (e.prediction_accuracy_score = 1.0 AND e.confidence = 0) -- Exclude corrupted perfect scores with 0 confidence
        GROUP BY e.model_name
        HAVING COUNT(e.id) >= 1  -- Only include models with at least 1 solver attempt
        ORDER BY avg_trustworthiness_score DESC, total_attempts DESC
      `);

      const stats = basicStats.rows[0];

      return {
        totalExplanations: parseInt(stats.total_solver_attempts) || 0,
        avgConfidence: Math.round((parseFloat(stats.avg_confidence) || 0) * 10) / 10,
        totalSolverAttempts: parseInt(stats.total_solver_attempts) || 0,
        totalCorrectPredictions: parseInt(stats.total_correct_predictions) || 0,
        accuracyByModel: modelAccuracy.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts),
          totalExplanations: parseInt(row.total_attempts),
          avgConfidence: Math.round((parseFloat(row.avg_confidence) || 0) * 10) / 10,
          
          // Real prediction accuracy data
          singleTestAttempts: parseInt(row.single_test_attempts) || 0,
          singleCorrectPredictions: parseInt(row.single_correct_predictions) || 0,
          multiTestAttempts: parseInt(row.multi_test_attempts) || 0,  
          multiAllCorrect: parseInt(row.multi_all_correct) || 0,
          avgMultiTestAccuracy: Math.round((parseFloat(row.avg_multi_test_accuracy) || 0) * 10000) / 10000,
          
          // Overall accuracy metrics
          correctPredictions: parseInt(row.total_correct_predictions) || 0,
          accuracyPercentage: Math.round((parseFloat(row.actual_accuracy_percentage) || 0) * 10) / 10,
          
          // Trustworthiness scores (prediction_accuracy_score)
          avgTrustworthiness: Math.round((parseFloat(row.avg_trustworthiness_score) || 0) * 10000) / 10000,
          avgAccuracyScore: Math.round((parseFloat(row.avg_trustworthiness_score) || 0) * 10000) / 10000, // Keep for backward compatibility
          minTrustworthiness: Math.round((parseFloat(row.min_trustworthiness_score) || 0) * 10000) / 10000,
          maxTrustworthiness: Math.round((parseFloat(row.max_trustworthiness_score) || 0) * 10000) / 10000,
          
          // Remove fake "successful extractions" terminology
          successfulPredictions: parseInt(row.total_correct_predictions) || 0,
          predictionSuccessRate: Math.round((parseFloat(row.actual_accuracy_percentage) || 0) * 10) / 10
        })),
        modelAccuracy: modelAccuracy.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts),
          avgConfidence: parseFloat(row.avg_confidence) || 0,
          correctPredictions: parseInt(row.total_correct_predictions) || 0,
          accuracyPercentage: parseFloat(row.actual_accuracy_percentage) || 0
        }))
      };
    } catch (error) {
      logger.error(`Error getting accuracy stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  async getRawDatabaseStats(): Promise<{
    totalExplanations: number;
    avgProcessingTime: number;
    maxProcessingTime: number;
    avgPredictionAccuracy: number;
    totalTokens: number;
    avgTokens: number;
    maxTokens: number;
    totalEstimatedCost: number;
    avgEstimatedCost: number;
    maxEstimatedCost: number;
    explanationsWithTokens: number;
    explanationsWithCost: number;
    explanationsWithAccuracy: number;
    explanationsWithProcessingTime: number;
  }> {
    if (!this.isConnected()) {
      return {
        totalExplanations: 0,
        avgProcessingTime: 0,
        maxProcessingTime: 0,
        avgPredictionAccuracy: 0,
        totalTokens: 0,
        avgTokens: 0,
        maxTokens: 0,
        totalEstimatedCost: 0,
        avgEstimatedCost: 0,
        maxEstimatedCost: 0,
        explanationsWithTokens: 0,
        explanationsWithCost: 0,
        explanationsWithAccuracy: 0,
        explanationsWithProcessingTime: 0
      };
    }

    try {
      const stats = await this.query(`
        SELECT 
          COUNT(*) as total_explanations,
          AVG(api_processing_time_ms) as avg_processing_time,
          MAX(api_processing_time_ms) as max_processing_time,
          AVG(prediction_accuracy_score) as avg_prediction_accuracy,
          SUM(total_tokens) as total_tokens,
          AVG(total_tokens) as avg_tokens,
          MAX(total_tokens) as max_tokens,
          SUM(estimated_cost) as total_estimated_cost,
          AVG(estimated_cost) as avg_estimated_cost,
          MAX(estimated_cost) as max_estimated_cost,
          COUNT(total_tokens) FILTER (WHERE total_tokens IS NOT NULL) as explanations_with_tokens,
          COUNT(estimated_cost) FILTER (WHERE estimated_cost IS NOT NULL) as explanations_with_cost,
          COUNT(prediction_accuracy_score) FILTER (WHERE prediction_accuracy_score IS NOT NULL) as explanations_with_accuracy,
          COUNT(api_processing_time_ms) FILTER (WHERE api_processing_time_ms IS NOT NULL) as explanations_with_processing_time
        FROM explanations
      `);

      const row = stats.rows[0];
      return {
        totalExplanations: parseInt(row.total_explanations) || 0,
        avgProcessingTime: Math.round((parseFloat(row.avg_processing_time) || 0) * 100) / 100,
        maxProcessingTime: parseInt(row.max_processing_time) || 0,
        avgPredictionAccuracy: Math.round((parseFloat(row.avg_prediction_accuracy) || 0) * 10000) / 10000,
        totalTokens: parseInt(row.total_tokens) || 0,
        avgTokens: Math.round(parseFloat(row.avg_tokens) || 0),
        maxTokens: parseInt(row.max_tokens) || 0,
        totalEstimatedCost: Math.round((parseFloat(row.total_estimated_cost) || 0) * 10000) / 10000,
        avgEstimatedCost: Math.round((parseFloat(row.avg_estimated_cost) || 0) * 1000000) / 1000000,
        maxEstimatedCost: Math.round((parseFloat(row.max_estimated_cost) || 0) * 1000000) / 1000000,
        explanationsWithTokens: parseInt(row.explanations_with_tokens) || 0,
        explanationsWithCost: parseInt(row.explanations_with_cost) || 0,
        explanationsWithAccuracy: parseInt(row.explanations_with_accuracy) || 0,
        explanationsWithProcessingTime: parseInt(row.explanations_with_processing_time) || 0
      };
    } catch (error) {
      logger.error(`Error getting raw database stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }
/// THIS function contains some odd hallucinations... needs to be fixed and checked.
  async getRealPerformanceStats(): Promise<{
    trustworthinessLeaders: Array<{
      modelName: string;
      totalAttempts: number;
      avgTrustworthiness: number;
      avgConfidence: number;
      avgProcessingTime: number;
      avgTokens: number;
      avgCost: number;
      totalCost: number;
    }>;
    speedLeaders: Array<{
      modelName: string;
      avgProcessingTime: number;
      totalAttempts: number;
      avgTrustworthiness: number;
    }>;
    efficiencyLeaders: Array<{
      modelName: string;
      costEfficiency: number;
      tokenEfficiency: number;
      avgTrustworthiness: number;
      totalAttempts: number;
    }>;
    overallTrustworthiness: number;
  }> {
    if (!this.isConnected()) {
      return {
        trustworthinessLeaders: [],
        speedLeaders: [],
        efficiencyLeaders: [],
        overallTrustworthiness: 0
      };
    }

    try {
      // Get trustworthiness leaders using the existing prediction_accuracy_score field 
      // (which already factors in both correctness and confidence)
      const trustworthinessQuery = await this.query(`
        SELECT 
          e.model_name,
          COUNT(*) as total_attempts,
          AVG(e.prediction_accuracy_score) as avg_trustworthiness,
          AVG(e.confidence) as avg_confidence,
          AVG(e.api_processing_time_ms) as avg_processing_time,
          AVG(e.total_tokens) as avg_tokens,
          AVG(e.estimated_cost) as avg_cost,
          SUM(e.estimated_cost) as total_cost
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.prediction_accuracy_score IS NOT NULL
          AND e.confidence IS NOT NULL
          AND NOT (e.prediction_accuracy_score = 1.0 AND e.confidence = 0) -- Exclude corrupted perfect scores with 0 confidence
        GROUP BY e.model_name
        HAVING COUNT(*) >= 1
        ORDER BY avg_trustworthiness DESC, total_attempts DESC
        LIMIT 10
      `);

      // Get speed leaders (fastest processing times with decent trustworthiness)
      const speedQuery = await this.query(`
        SELECT 
          e.model_name,
          AVG(e.api_processing_time_ms) as avg_processing_time,
          COUNT(*) as total_attempts,
          AVG(e.prediction_accuracy_score) as avg_trustworthiness
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.api_processing_time_ms IS NOT NULL
          AND e.prediction_accuracy_score IS NOT NULL
        GROUP BY e.model_name
        HAVING COUNT(*) >= 1
        ORDER BY avg_processing_time ASC
        LIMIT 10
      `);


      // Get efficiency leaders (best cost and token efficiency relative to trustworthiness)
      const efficiencyQuery = await this.query(`
        SELECT 
          e.model_name,
          (
            CASE 
              WHEN AVG(e.prediction_accuracy_score) > 0.01 
              THEN AVG(e.estimated_cost) / AVG(e.prediction_accuracy_score)
              ELSE 999999 
            END
          ) as cost_efficiency,
          (
            CASE 
              WHEN AVG(e.prediction_accuracy_score) > 0.01 
              THEN AVG(e.total_tokens) / AVG(e.prediction_accuracy_score)
              ELSE 999999 
            END
          ) as token_efficiency,
          AVG(e.prediction_accuracy_score) as avg_trustworthiness,
          COUNT(*) as total_attempts
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.prediction_accuracy_score IS NOT NULL
          AND e.estimated_cost IS NOT NULL
          AND e.total_tokens IS NOT NULL
        GROUP BY e.model_name
        HAVING COUNT(*) >= 1
        ORDER BY cost_efficiency ASC
        LIMIT 10
      `);

      // Get overall trustworthiness stats
      const overallQuery = await this.query(`
        SELECT 
          COUNT(*) as total_trustworthiness_attempts,
          AVG(prediction_accuracy_score) as overall_trustworthiness
        FROM explanations
        WHERE prediction_accuracy_score IS NOT NULL
      `);

      const overallStats = overallQuery.rows[0];

      return {
        trustworthinessLeaders: trustworthinessQuery.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts) || 0,
          avgTrustworthiness: Math.round((parseFloat(row.avg_trustworthiness) || 0) * 10000) / 10000,
          avgConfidence: Math.round((parseFloat(row.avg_confidence) || 0) * 10) / 10,
          avgProcessingTime: Math.round(parseFloat(row.avg_processing_time) || 0),
          avgTokens: Math.round(parseFloat(row.avg_tokens) || 0),
          avgCost: Math.round((parseFloat(row.avg_cost) || 0) * 1000000) / 1000000,
          totalCost: Math.round((parseFloat(row.total_cost) || 0) * 10000) / 10000,
        })),
        speedLeaders: speedQuery.rows.map(row => ({
          modelName: row.model_name,
          avgProcessingTime: Math.round(parseFloat(row.avg_processing_time) || 0),
          totalAttempts: parseInt(row.total_attempts) || 0,
          avgTrustworthiness: Math.round((parseFloat(row.avg_trustworthiness) || 0) * 10000) / 10000
        })),
        efficiencyLeaders: efficiencyQuery.rows.map(row => ({
          modelName: row.model_name,
          costEfficiency: Math.round((parseFloat(row.cost_efficiency) || 0) * 1000000) / 1000000,
          tokenEfficiency: Math.round(parseFloat(row.token_efficiency) || 0),
          avgTrustworthiness: Math.round((parseFloat(row.avg_trustworthiness) || 0) * 10000) / 10000,
          totalAttempts: parseInt(row.total_attempts) || 0
        })),
        overallTrustworthiness: Math.round((parseFloat(overallStats.overall_trustworthiness) || 0) * 10000) / 10000
      };
    } catch (error) {
      logger.error(`Error getting real performance stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }
}