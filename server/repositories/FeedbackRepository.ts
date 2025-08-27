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

  async getAccuracyStats(): Promise<{ totalExplanations: number; avgConfidence: number; modelAccuracy: any[] }> {
    if (!this.isConnected()) {
      return {
        totalExplanations: 0,
        avgConfidence: 0,
        modelAccuracy: []
      };
    }

    try {
      // Get basic explanation stats
      const basicStats = await this.query(`
        SELECT 
          COUNT(*) as total_explanations,
          ROUND(AVG(confidence), 1) as avg_confidence
        FROM explanations
        WHERE confidence IS NOT NULL
      `);

      // Get model accuracy based on feedback
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
        GROUP BY e.model_name
        HAVING COUNT(e.id) >= 5  -- Only include models with at least 5 explanations
        ORDER BY user_satisfaction_rate DESC, total_explanations DESC
      `);

      const stats = basicStats.rows[0];

      return {
        totalExplanations: parseInt(stats.total_explanations) || 0,
        avgConfidence: parseFloat(stats.avg_confidence) || 0,
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
}