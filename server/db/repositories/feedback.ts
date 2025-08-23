/**
 * Feedback Repository
 * 
 * Handles all data access operations for user feedback with:
 * - Type-safe operations with Zod validation
 * - Aggregated statistics and analytics
 * - Advanced filtering and pagination
 * - Cross-explanation feedback analysis
 * 
 * @author Claude Code Assistant
 * @date August 23, 2025
 */

import { DatabaseConnection } from '../connection.js';
import { logger } from '../../utils/logger.js';
import {
  FeedbackRow,
  CreateFeedbackData,
  parseFeedbackRow,
  validateCreateFeedback
} from '../schemas.js';

/**
 * Feedback filters for advanced querying
 */
export interface FeedbackFilters {
  puzzleId?: string;
  modelName?: string;
  voteType?: 'helpful' | 'not_helpful';
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Detailed feedback with explanation context
 */
export interface DetailedFeedback {
  id: number;
  explanationId: number;
  voteType: 'helpful' | 'not_helpful';
  comment: string;
  createdAt: Date;
  puzzleId: string;
  modelName: string;
  confidence: number;
  patternDescription: string;
}

/**
 * Aggregated feedback statistics
 */
export interface FeedbackStats {
  totalFeedback: number;
  helpfulCount: number;
  notHelpfulCount: number;
  helpfulPercentage: number;
  avgRatingByModel: { modelName: string; helpfulPercentage: number; count: number }[];
  feedbackTrends: { date: string; helpfulCount: number; notHelpfulCount: number }[];
}

/**
 * Repository for feedback data access operations
 */
export class FeedbackRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Add new feedback with validation
   * @param data Validated feedback data
   * @returns Saved feedback row
   */
  async add(data: CreateFeedbackData): Promise<FeedbackRow> {
    const validated = validateCreateFeedback(data);

    const sql = `
      INSERT INTO feedback (explanation_id, vote_type, comment)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const params = [
      validated.explanationId,
      validated.voteType,
      validated.comment
    ];

    try {
      const [row] = await this.db.query<FeedbackRow>(sql, params);
      const parsed = parseFeedbackRow(row);

      logger.info(`Added ${validated.voteType} feedback for explanation ${validated.explanationId}`, {
        id: parsed.id,
        voteType: validated.voteType
      }, 'feedback-repo');

      return parsed;
    } catch (error) {
      logger.error('Failed to add feedback', {
        error: (error as Error).message,
        explanationId: validated.explanationId,
        voteType: validated.voteType
      }, 'feedback-repo');
      throw error;
    }
  }

  /**
   * Get all feedback for a specific explanation
   * @param explanationId Explanation ID
   * @returns Array of feedback rows
   */
  async getForExplanation(explanationId: number): Promise<FeedbackRow[]> {
    const sql = `
      SELECT * FROM feedback 
      WHERE explanation_id = $1 
      ORDER BY created_at DESC
    `;

    try {
      const rows = await this.db.query<FeedbackRow>(sql, [explanationId]);
      return rows.map(parseFeedbackRow);
    } catch (error) {
      logger.error(`Failed to get feedback for explanation ${explanationId}`, {
        error: (error as Error).message
      }, 'feedback-repo');
      throw error;
    }
  }

  /**
   * Get all feedback for explanations of a specific puzzle
   * @param puzzleId Puzzle ID
   * @returns Array of detailed feedback with explanation context
   */
  async getForPuzzle(puzzleId: string): Promise<DetailedFeedback[]> {
    const sql = `
      SELECT 
        f.id,
        f.explanation_id as "explanationId",
        f.vote_type as "voteType",
        f.comment,
        f.created_at as "createdAt",
        e.puzzle_id as "puzzleId",
        e.model_name as "modelName",
        e.confidence,
        e.pattern_description as "patternDescription"
      FROM feedback f
      JOIN explanations e ON f.explanation_id = e.id
      WHERE e.puzzle_id = $1
      ORDER BY f.created_at DESC
    `;

    try {
      const rows = await this.db.query<DetailedFeedback>(sql, [puzzleId]);
      
      logger.debug(`Retrieved ${rows.length} feedback items for puzzle ${puzzleId}`, 'feedback-repo');
      return rows;
    } catch (error) {
      logger.error(`Failed to get feedback for puzzle ${puzzleId}`, {
        error: (error as Error).message
      }, 'feedback-repo');
      throw error;
    }
  }

  /**
   * Get all feedback with advanced filtering
   * @param filters Filtering options
   * @returns Array of detailed feedback with explanation context
   */
  async getAllWithFilters(filters: FeedbackFilters = {}): Promise<DetailedFeedback[]> {
    let sql = `
      SELECT 
        f.id,
        f.explanation_id as "explanationId",
        f.vote_type as "voteType",
        f.comment,
        f.created_at as "createdAt",
        e.puzzle_id as "puzzleId",
        e.model_name as "modelName",
        e.confidence,
        e.pattern_description as "patternDescription"
      FROM feedback f
      JOIN explanations e ON f.explanation_id = e.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Apply filters
    if (filters.puzzleId) {
      sql += ` AND e.puzzle_id = $${paramIndex}`;
      params.push(filters.puzzleId);
      paramIndex++;
    }

    if (filters.modelName) {
      sql += ` AND e.model_name = $${paramIndex}`;
      params.push(filters.modelName);
      paramIndex++;
    }

    if (filters.voteType) {
      sql += ` AND f.vote_type = $${paramIndex}`;
      params.push(filters.voteType);
      paramIndex++;
    }

    if (filters.dateFrom) {
      sql += ` AND f.created_at >= $${paramIndex}`;
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      sql += ` AND f.created_at <= $${paramIndex}`;
      params.push(filters.dateTo);
      paramIndex++;
    }

    sql += ` ORDER BY f.created_at DESC`;

    if (filters.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      sql += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
    }

    try {
      const rows = await this.db.query<DetailedFeedback>(sql, params);
      
      logger.debug(`Retrieved ${rows.length} filtered feedback items`, {
        filters
      }, 'feedback-repo');
      
      return rows;
    } catch (error) {
      logger.error('Failed to get filtered feedback', {
        error: (error as Error).message,
        filters
      }, 'feedback-repo');
      throw error;
    }
  }

  /**
   * Get comprehensive feedback statistics
   * @returns Aggregated feedback analytics
   */
  async getSummaryStats(): Promise<FeedbackStats> {
    try {
      // Get overall stats
      const overallSql = `
        SELECT 
          COUNT(*) as total_feedback,
          COUNT(*) FILTER (WHERE vote_type = 'helpful') as helpful_count,
          COUNT(*) FILTER (WHERE vote_type = 'not_helpful') as not_helpful_count
        FROM feedback
      `;

      const [overallRow] = await this.db.query(overallSql);
      
      const totalFeedback = parseInt(overallRow.total_feedback || '0');
      const helpfulCount = parseInt(overallRow.helpful_count || '0');
      const notHelpfulCount = parseInt(overallRow.not_helpful_count || '0');
      const helpfulPercentage = totalFeedback > 0 
        ? (helpfulCount / totalFeedback) * 100 
        : 0;

      // Get stats by model
      const modelStatsSql = `
        SELECT 
          e.model_name as model_name,
          COUNT(*) as total_count,
          COUNT(*) FILTER (WHERE f.vote_type = 'helpful') as helpful_count
        FROM feedback f
        JOIN explanations e ON f.explanation_id = e.id
        GROUP BY e.model_name
        ORDER BY total_count DESC
      `;

      const modelRows = await this.db.query(modelStatsSql);
      
      const avgRatingByModel = modelRows.map(row => ({
        modelName: row.model_name,
        helpfulPercentage: Math.round(((row.helpful_count / row.total_count) * 100) * 100) / 100,
        count: parseInt(row.total_count)
      }));

      // Get feedback trends (last 30 days)
      const trendsSql = `
        SELECT 
          DATE(f.created_at) as feedback_date,
          COUNT(*) FILTER (WHERE f.vote_type = 'helpful') as helpful_count,
          COUNT(*) FILTER (WHERE f.vote_type = 'not_helpful') as not_helpful_count
        FROM feedback f
        WHERE f.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(f.created_at)
        ORDER BY feedback_date DESC
        LIMIT 30
      `;

      const trendRows = await this.db.query(trendsSql);
      
      const feedbackTrends = trendRows.map(row => ({
        date: row.feedback_date,
        helpfulCount: parseInt(row.helpful_count || '0'),
        notHelpfulCount: parseInt(row.not_helpful_count || '0')
      }));

      const stats = {
        totalFeedback,
        helpfulCount,
        notHelpfulCount,
        helpfulPercentage: Math.round(helpfulPercentage * 100) / 100,
        avgRatingByModel,
        feedbackTrends
      };

      logger.info('Generated feedback summary stats', {
        totalFeedback: stats.totalFeedback,
        helpfulPercentage: stats.helpfulPercentage,
        modelCount: stats.avgRatingByModel.length
      }, 'feedback-repo');

      return stats;
    } catch (error) {
      logger.error('Failed to get feedback summary stats', {
        error: (error as Error).message
      }, 'feedback-repo');
      throw error;
    }
  }

  /**
   * Get feedback count for specific explanation
   * @param explanationId Explanation ID
   * @returns Feedback counts by type
   */
  async getCountsForExplanation(explanationId: number): Promise<{
    helpfulCount: number;
    notHelpfulCount: number;
    totalFeedback: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) FILTER (WHERE vote_type = 'helpful') as helpful_count,
        COUNT(*) FILTER (WHERE vote_type = 'not_helpful') as not_helpful_count,
        COUNT(*) as total_feedback
      FROM feedback
      WHERE explanation_id = $1
    `;

    try {
      const [row] = await this.db.query(sql, [explanationId]);
      
      return {
        helpfulCount: parseInt(row.helpful_count || '0'),
        notHelpfulCount: parseInt(row.not_helpful_count || '0'),
        totalFeedback: parseInt(row.total_feedback || '0')
      };
    } catch (error) {
      logger.error(`Failed to get feedback counts for explanation ${explanationId}`, {
        error: (error as Error).message
      }, 'feedback-repo');
      throw error;
    }
  }

  /**
   * Delete feedback by ID (admin function)
   * @param id Feedback ID
   * @returns Boolean indicating success
   */
  async delete(id: number): Promise<boolean> {
    const sql = `DELETE FROM feedback WHERE id = $1`;

    try {
      const rows = await this.db.query(sql, [id]);
      const deleted = (rows as any).affectedRows > 0;
      
      if (deleted) {
        logger.info(`Deleted feedback ${id}`, 'feedback-repo');
      } else {
        logger.warn(`Feedback ${id} not found for deletion`, 'feedback-repo');
      }
      
      return deleted;
    } catch (error) {
      logger.error(`Failed to delete feedback ${id}`, {
        error: (error as Error).message
      }, 'feedback-repo');
      throw error;
    }
  }
}