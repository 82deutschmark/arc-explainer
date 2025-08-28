/**
 * Feedback Repository Implementation
 * 
 * Handles all feedback-related database operations.
 * Extracted from monolithic DbService to follow Single Responsibility Principle.
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
          ROUND(AVG(e.confidence), 1) as avg_confidence
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
          avgConfidence: parseFloat(row.avg_confidence) || 0
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
        feedbackByModel: {},
        feedbackByDay: []
      };
    } catch (error) {
      logger.error(`Error getting feedback summary stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  async getAccuracyStats(): Promise<{ totalExplanations: number; avgConfidence: number; totalSolverAttempts: number; modelAccuracy: any[]; accuracyByModel: any[] }> {
    if (!this.isConnected()) {
      return {
        totalExplanations: 0,
        avgConfidence: 0,
        totalSolverAttempts: 0,
        modelAccuracy: [],
        accuracyByModel: []
      };
    }

    try {
      // Get basic explanation stats - only count solver attempts with correctness flags
      const basicStats = await this.query(`
        SELECT 
          COUNT(*) as total_explanations,
          ROUND(AVG(confidence), 1) as avg_confidence
        FROM explanations
        WHERE confidence IS NOT NULL 
          AND (is_prediction_correct IS NOT NULL 
               OR multi_test_all_correct IS NOT NULL)
      `);

      // Get model accuracy based on feedback - only for solver attempts with correctness flags
      const modelAccuracy = await this.query(`
        SELECT 
          e.model_name,
          COUNT(e.id) as total_explanations,
          ROUND(AVG(e.confidence), 1) as avg_confidence,
          COUNT(f.id) as feedback_count,
          SUM(CASE WHEN f.vote_type = 'helpful' THEN 1 ELSE 0 END) as helpful_count,
          ROUND(
            CASE 
              WHEN COUNT(f.id) > 0 
              THEN (SUM(CASE WHEN f.vote_type = 'helpful' THEN 1 ELSE 0 END) * 100.0 / COUNT(f.id))
              ELSE 0 
            END, 1
          ) as user_satisfaction_rate
        FROM explanations e
        LEFT JOIN feedback f ON e.id = f.explanation_id
        WHERE e.model_name IS NOT NULL
          AND (e.is_prediction_correct IS NOT NULL 
               OR e.multi_test_all_correct IS NOT NULL)
        GROUP BY e.model_name
        HAVING COUNT(e.id) >= 1  -- Only include models with at least 1 solver attempt
        ORDER BY user_satisfaction_rate DESC, total_explanations DESC
      `);

      const stats = basicStats.rows[0];

      return {
        totalExplanations: parseInt(stats.total_explanations) || 0,
        avgConfidence: parseFloat(stats.avg_confidence) || 0,
        totalSolverAttempts: parseInt(stats.total_explanations) || 0,
        accuracyByModel: modelAccuracy.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_explanations),
          totalExplanations: parseInt(row.total_explanations),
          avgConfidence: parseFloat(row.avg_confidence) || 0,
          feedbackCount: parseInt(row.feedback_count) || 0,
          helpfulCount: parseInt(row.helpful_count) || 0,
          userSatisfactionRate: parseFloat(row.user_satisfaction_rate) || 0,
          correctPredictions: parseInt(row.helpful_count) || 0,
          accuracyPercentage: parseFloat(row.user_satisfaction_rate) || 0,
          avgAccuracyScore: parseFloat(row.user_satisfaction_rate) / 100 || 0,
          successfulExtractions: parseInt(row.helpful_count) || 0,
          extractionSuccessRate: parseFloat(row.user_satisfaction_rate) || 0
        })),
        modelAccuracy: modelAccuracy.rows.map(row => ({
          modelName: row.model_name,
          totalExplanations: parseInt(row.total_explanations),
          avgConfidence: parseFloat(row.avg_confidence) || 0,
          feedbackCount: parseInt(row.feedback_count) || 0,
          helpfulCount: parseInt(row.helpful_count) || 0,
          userSatisfactionRate: parseFloat(row.user_satisfaction_rate) || 0
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
          ROUND(AVG(processing_time), 2) as avg_processing_time,
          MAX(processing_time) as max_processing_time,
          ROUND(AVG(accuracy), 4) as avg_prediction_accuracy,
          SUM(total_tokens) as total_tokens,
          ROUND(AVG(total_tokens), 0) as avg_tokens,
          MAX(total_tokens) as max_tokens,
          ROUND(SUM(cost), 4) as total_estimated_cost,
          ROUND(AVG(cost), 6) as avg_estimated_cost,
          ROUND(MAX(cost), 6) as max_estimated_cost,
          COUNT(total_tokens) FILTER (WHERE total_tokens IS NOT NULL) as explanations_with_tokens,
          COUNT(cost) FILTER (WHERE cost IS NOT NULL) as explanations_with_cost,
          COUNT(accuracy) FILTER (WHERE accuracy IS NOT NULL) as explanations_with_accuracy,
          COUNT(processing_time) FILTER (WHERE processing_time IS NOT NULL) as explanations_with_processing_time
        FROM explanations
      `);

      const row = stats.rows[0];
      return {
        totalExplanations: parseInt(row.total_explanations) || 0,
        avgProcessingTime: parseFloat(row.avg_processing_time) || 0,
        maxProcessingTime: parseInt(row.max_processing_time) || 0,
        avgPredictionAccuracy: parseFloat(row.avg_prediction_accuracy) || 0,
        totalTokens: parseInt(row.total_tokens) || 0,
        avgTokens: parseInt(row.avg_tokens) || 0,
        maxTokens: parseInt(row.max_tokens) || 0,
        totalEstimatedCost: parseFloat(row.total_estimated_cost) || 0,
        avgEstimatedCost: parseFloat(row.avg_estimated_cost) || 0,
        maxEstimatedCost: parseFloat(row.max_estimated_cost) || 0,
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

  async getRealPerformanceStats(): Promise<{
    trustworthinessLeaders: Array<{
      modelName: string;
      totalAttempts: number;
      avgTrustworthiness: number;
      avgConfidence: number;
      calibrationError: number;
      avgProcessingTime: number;
      avgTokens: number;
      avgCost: number;
      totalCost: number;
      costPerTrustworthiness: number;
      tokensPerTrustworthiness: number;
      trustworthinessRange: { min: number; max: number; };
    }>;
    speedLeaders: Array<{
      modelName: string;
      avgProcessingTime: number;
      totalAttempts: number;
      avgTrustworthiness: number;
    }>;
    calibrationLeaders: Array<{
      modelName: string;
      calibrationError: number;
      totalAttempts: number;
      avgTrustworthiness: number;
      avgConfidence: number;
    }>;
    efficiencyLeaders: Array<{
      modelName: string;
      costEfficiency: number;
      tokenEfficiency: number;
      avgTrustworthiness: number;
      totalAttempts: number;
    }>;
    totalTrustworthinessAttempts: number;
    overallTrustworthiness: number;
  }> {
    if (!this.isConnected()) {
      return {
        trustworthinessLeaders: [],
        speedLeaders: [],
        calibrationLeaders: [],
        efficiencyLeaders: [],
        totalTrustworthinessAttempts: 0,
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
          ROUND(AVG(e.prediction_accuracy_score), 4) as avg_trustworthiness,
          ROUND(AVG(e.confidence), 1) as avg_confidence,
          ROUND(AVG(e.api_processing_time_ms), 0) as avg_processing_time,
          ROUND(AVG(e.total_tokens), 0) as avg_tokens,
          ROUND(AVG(e.estimated_cost), 6) as avg_cost,
          ROUND(SUM(e.estimated_cost), 4) as total_cost,
          ROUND(MIN(e.prediction_accuracy_score), 4) as min_trustworthiness,
          ROUND(MAX(e.prediction_accuracy_score), 4) as max_trustworthiness,
          ROUND(
            CASE 
              WHEN AVG(e.prediction_accuracy_score) > 0 
              THEN SUM(e.estimated_cost) / AVG(e.prediction_accuracy_score) / COUNT(*)
              ELSE 0 
            END, 6
          ) as cost_per_trustworthiness,
          ROUND(
            CASE 
              WHEN AVG(e.prediction_accuracy_score) > 0 
              THEN SUM(e.total_tokens) / AVG(e.prediction_accuracy_score) / COUNT(*)
              ELSE 0 
            END, 0
          ) as tokens_per_trustworthiness,
          ROUND(
            ABS(AVG(e.confidence) - (AVG(e.prediction_accuracy_score) * 100)), 2
          ) as calibration_error
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.prediction_accuracy_score IS NOT NULL
          AND e.confidence IS NOT NULL
        GROUP BY e.model_name
        HAVING COUNT(*) >= 3
        ORDER BY avg_trustworthiness DESC, total_attempts DESC
      `);

      // Get speed leaders (fastest processing times with decent trustworthiness)
      const speedQuery = await this.query(`
        SELECT 
          e.model_name,
          ROUND(AVG(e.api_processing_time_ms), 0) as avg_processing_time,
          COUNT(*) as total_attempts,
          ROUND(AVG(e.prediction_accuracy_score), 4) as avg_trustworthiness
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.api_processing_time_ms IS NOT NULL
          AND e.prediction_accuracy_score IS NOT NULL
        GROUP BY e.model_name
        HAVING COUNT(*) >= 5 AND AVG(e.prediction_accuracy_score) >= 0.3
        ORDER BY avg_processing_time ASC
        LIMIT 10
      `);

      // Get calibration leaders (best alignment between confidence and trustworthiness)
      const calibrationQuery = await this.query(`
        SELECT 
          e.model_name,
          ROUND(ABS(AVG(e.confidence) - (AVG(e.prediction_accuracy_score) * 100)), 2) as calibration_error,
          COUNT(*) as total_attempts,
          ROUND(AVG(e.prediction_accuracy_score), 4) as avg_trustworthiness,
          ROUND(AVG(e.confidence), 1) as avg_confidence
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.prediction_accuracy_score IS NOT NULL
          AND e.confidence IS NOT NULL
        GROUP BY e.model_name
        HAVING COUNT(*) >= 5
        ORDER BY calibration_error ASC
        LIMIT 10
      `);

      // Get efficiency leaders (best cost and token efficiency relative to trustworthiness)
      const efficiencyQuery = await this.query(`
        SELECT 
          e.model_name,
          ROUND(
            CASE 
              WHEN AVG(e.prediction_accuracy_score) > 0 
              THEN AVG(e.estimated_cost) / AVG(e.prediction_accuracy_score)
              ELSE 999999 
            END, 6
          ) as cost_efficiency,
          ROUND(
            CASE 
              WHEN AVG(e.prediction_accuracy_score) > 0 
              THEN AVG(e.total_tokens) / AVG(e.prediction_accuracy_score)
              ELSE 999999 
            END, 0
          ) as token_efficiency,
          ROUND(AVG(e.prediction_accuracy_score), 4) as avg_trustworthiness,
          COUNT(*) as total_attempts
        FROM explanations e
        WHERE e.model_name IS NOT NULL 
          AND e.prediction_accuracy_score IS NOT NULL
          AND e.estimated_cost IS NOT NULL
          AND e.total_tokens IS NOT NULL
        GROUP BY e.model_name
        HAVING COUNT(*) >= 5 AND AVG(e.prediction_accuracy_score) >= 0.2
        ORDER BY cost_efficiency ASC
        LIMIT 10
      `);

      // Get overall trustworthiness stats
      const overallQuery = await this.query(`
        SELECT 
          COUNT(*) as total_trustworthiness_attempts,
          ROUND(AVG(prediction_accuracy_score), 4) as overall_trustworthiness
        FROM explanations
        WHERE prediction_accuracy_score IS NOT NULL
      `);

      const overallStats = overallQuery.rows[0];

      return {
        trustworthinessLeaders: trustworthinessQuery.rows.map(row => ({
          modelName: row.model_name,
          totalAttempts: parseInt(row.total_attempts) || 0,
          avgTrustworthiness: parseFloat(row.avg_trustworthiness) || 0,
          avgConfidence: parseFloat(row.avg_confidence) || 0,
          calibrationError: parseFloat(row.calibration_error) || 0,
          avgProcessingTime: parseInt(row.avg_processing_time) || 0,
          avgTokens: parseInt(row.avg_tokens) || 0,
          avgCost: parseFloat(row.avg_cost) || 0,
          totalCost: parseFloat(row.total_cost) || 0,
          costPerTrustworthiness: parseFloat(row.cost_per_trustworthiness) || 0,
          tokensPerTrustworthiness: parseInt(row.tokens_per_trustworthiness) || 0,
          trustworthinessRange: { 
            min: parseFloat(row.min_trustworthiness) || 0, 
            max: parseFloat(row.max_trustworthiness) || 0 
          }
        })),
        speedLeaders: speedQuery.rows.map(row => ({
          modelName: row.model_name,
          avgProcessingTime: parseInt(row.avg_processing_time) || 0,
          totalAttempts: parseInt(row.total_attempts) || 0,
          avgTrustworthiness: parseFloat(row.avg_trustworthiness) || 0
        })),
        calibrationLeaders: calibrationQuery.rows.map(row => ({
          modelName: row.model_name,
          calibrationError: parseFloat(row.calibration_error) || 0,
          totalAttempts: parseInt(row.total_attempts) || 0,
          avgTrustworthiness: parseFloat(row.avg_trustworthiness) || 0,
          avgConfidence: parseFloat(row.avg_confidence) || 0
        })),
        efficiencyLeaders: efficiencyQuery.rows.map(row => ({
          modelName: row.model_name,
          costEfficiency: parseFloat(row.cost_efficiency) || 0,
          tokenEfficiency: parseInt(row.token_efficiency) || 0,
          avgTrustworthiness: parseFloat(row.avg_trustworthiness) || 0,
          totalAttempts: parseInt(row.total_attempts) || 0
        })),
        totalTrustworthinessAttempts: parseInt(overallStats.total_trustworthiness_attempts) || 0,
        overallTrustworthiness: parseFloat(overallStats.overall_trustworthiness) || 0
      };
    } catch (error) {
      logger.error(`Error getting real performance stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }
}