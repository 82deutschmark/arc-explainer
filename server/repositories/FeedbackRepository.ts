/**
 * Feedback Repository Implementation
 * 
 * Handles USER FEEDBACK operations only - explanation quality ratings.
 * Previously was a monolithic repository handling multiple concerns, now focused solely on feedback.
 * 
 * SCOPE: This repository handles ONE CONCEPT only:
 * - USER FEEDBACK (explanation quality ratings):
 *   - How good/helpful an AI model's explanation was
 *   - Stored in 'feedback' table with vote_type: 'helpful' | 'not_helpful'  
 *   - A model can solve a puzzle WRONG but give a great explanation → helpful feedback
 *   - A model can solve a puzzle RIGHT but give a terrible explanation → not helpful feedback
 *   - Used for: Community feedback stats, explanation quality rankings
 * 
 * WHAT THIS REPOSITORY DOES NOT HANDLE:
 * - PURE ACCURACY: Moved to AccuracyRepository (is_prediction_correct, multi_test_all_correct)
 * - TRUSTWORTHINESS: Moved to TrustworthinessRepository (prediction_accuracy_score, confidence analysis)
 * - MIXED ANALYTICS: Will be handled by MetricsRepository (aggregated metrics)
 * 
 * This separation eliminates the previous confusion between:
 * - User feedback about explanation quality vs actual puzzle-solving accuracy
 * - Accuracy vs trustworthiness vs user satisfaction
 * 
 * @author Claude
 * @date 2025-08-27
 * @updated 2025-08-31 - Refactored to focus only on user feedback (Single Responsibility Principle)
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';
import type { Feedback, DetailedFeedback, FeedbackFilters, FeedbackStats } from '../../shared/types.ts';

export interface AddFeedbackData {
  puzzleId: string;
  explanationId?: number;
  feedbackType: 'helpful' | 'not_helpful' | 'solution_explanation';
  comment?: string;
  userAgent?: string;
  sessionId?: string;
}

export class FeedbackRepository extends BaseRepository {
  
  /**
   * Add new user feedback for an explanation
   */
  async addFeedback(data: AddFeedbackData): Promise<{ success: boolean; feedback?: Feedback }> {
    if (!this.isConnected()) {
      throw new Error('Database not available');
    }

    const client = await this.getClient();
    
    try {
      const result = await this.query(`
        INSERT INTO feedback (puzzle_id, explanation_id, feedback_type, comment, user_agent, session_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        data.puzzleId,
        data.explanationId || null,
        data.feedbackType,
        data.comment || null,
        data.userAgent || null,
        data.sessionId || null
      ], client);

      if (result.rows.length === 0) {
        throw new Error('Failed to add feedback');
      }

      const feedback: Feedback = {
        id: result.rows[0].id,
        puzzleId: result.rows[0].puzzle_id,
        explanationId: result.rows[0].explanation_id,
        feedbackType: result.rows[0].feedback_type,
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

  /**
   * Get all feedback for a specific explanation
   */
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
      puzzleId: row.puzzle_id,
      explanationId: row.explanation_id,
      feedbackType: row.feedback_type,
      comment: row.comment,
      createdAt: row.created_at,
      userAgent: row.user_agent,
      sessionId: row.session_id
    }));
  }

  /**
   * Get all feedback for a specific puzzle with explanation context
   */
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
      feedbackType: row.feedback_type,
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

  /**
   * Get all feedback with optional filtering
   */
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

    if (filters.feedbackType) {
      query += ` AND f.feedback_type = $${++paramCount}`;
      params.push(filters.feedbackType);
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
      feedbackType: row.feedback_type,
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

  /**
   * Get comprehensive feedback statistics and trends
   * Focuses purely on user feedback about explanation quality
   */
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
      // Get basic feedback stats
      const basicStats = await this.query(`
        SELECT 
          COUNT(*) as total_feedback,
          SUM(CASE WHEN feedback_type = 'helpful' THEN 1 ELSE 0 END) as helpful_count,
          SUM(CASE WHEN feedback_type = 'not_helpful' THEN 1 ELSE 0 END) as not_helpful_count,
          AVG(LENGTH(comment)) as avg_comment_length
        FROM feedback
      `);

      // Get top models by feedback volume
      const topModels = await this.query(`
        SELECT 
          e.model_name,
          COUNT(*) as feedback_count,
          SUM(CASE WHEN f.feedback_type = 'helpful' THEN 1 ELSE 0 END) as helpful_count,
          SUM(CASE WHEN f.feedback_type = 'not_helpful' THEN 1 ELSE 0 END) as not_helpful_count,
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
          SUM(CASE WHEN feedback_type = 'helpful' THEN 1 ELSE 0 END) as helpful_count
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
   * Get feedback count for a specific explanation
   */
  async getFeedbackCount(explanationId: number): Promise<{ helpful: number; notHelpful: number; total: number }> {
    if (!this.isConnected()) {
      return { helpful: 0, notHelpful: 0, total: 0 };
    }

    try {
      const result = await this.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN feedback_type = 'helpful' THEN 1 ELSE 0 END) as helpful,
          SUM(CASE WHEN feedback_type = 'not_helpful' THEN 1 ELSE 0 END) as not_helpful
        FROM feedback
        WHERE explanation_id = $1
      `, [explanationId]);

      const row = result.rows[0];
      return {
        helpful: parseInt(row.helpful) || 0,
        notHelpful: parseInt(row.not_helpful) || 0,
        total: parseInt(row.total) || 0
      };
    } catch (error) {
      logger.error(`Error getting feedback count for explanation ${explanationId}: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get recent feedback activity
   */
  async getSolutionsForPuzzle(puzzleId: string): Promise<Feedback[]> {
    if (!this.isConnected()) {
      return [];
    }

    const result = await this.query(`
      SELECT * FROM feedback 
      WHERE puzzle_id = $1 AND feedback_type = 'solution_explanation'
      ORDER BY created_at DESC
    `, [puzzleId]);

    return result.rows.map(row => ({
      id: row.id,
      puzzleId: row.puzzle_id,
      explanationId: row.explanation_id,
      feedbackType: row.feedback_type,
      comment: row.comment,
      createdAt: row.created_at,
      userAgent: row.user_agent,
      sessionId: row.session_id
    }));
  }

  /**
   * Get recent feedback activity
   */
  async getRecentFeedback(limit: number = 20): Promise<DetailedFeedback[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      const result = await this.query(`
        SELECT 
          f.*,
          e.puzzle_id,
          e.model_name,
          e.confidence,
          e.pattern_description
        FROM feedback f
        JOIN explanations e ON f.explanation_id = e.id
        ORDER BY f.created_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        id: row.id,
        explanationId: row.explanation_id,
        feedbackType: row.feedback_type,
        comment: row.comment,
        createdAt: row.created_at,
        userAgent: row.user_agent,
        sessionId: row.session_id,
        puzzleId: row.puzzle_id,
        modelName: row.model_name,
        confidence: parseFloat(row.confidence) || 0,
        patternDescription: row.pattern_description?.substring(0, 100) || ''
      }));
    } catch (error) {
      logger.error(`Error getting recent feedback: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }
}