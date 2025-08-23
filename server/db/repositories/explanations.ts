/**
 * Explanations Repository
 * 
 * Handles all data access operations for puzzle explanations with:
 * - Type-safe queries with Zod validation
 * - Optimized joins replacing correlated subqueries  
 * - Saturn solver integration
 * - Comprehensive error handling
 * - Performance monitoring
 * 
 * @author Claude Code Assistant
 * @date August 23, 2025
 */

import { DatabaseConnection } from '../connection.js';
import { logger } from '../../utils/logger.js';
import {
  ExplanationRow,
  ExplanationWithFeedback,
  CreateExplanationData,
  parseExplanationRow,
  validateCreateExplanation,
  ExplanationWithFeedbackSchema
} from '../schemas.js';

/**
 * Bulk status result for multiple puzzles
 */
export interface BulkStatusResult {
  puzzle_id: string;
  explanation_count: number;
  correct_count: number;
  avg_confidence: number;
  latest_explanation: Date | null;
}

/**
 * Repository for explanation data access operations
 */
export class ExplanationsRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Safely parse JSON field with fallback for legacy text data
   */
  private parseJsonField(value: any, fallback: any = null): any {
    if (!value) return fallback;
    if (typeof value === 'object') return value; // Already parsed
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        // Legacy text data - special handling based on field type
        if (Array.isArray(fallback)) {
          return [value]; // Convert text to array for hints
        }
        // For reasoningItems, convert string items to objects
        if (fallback && typeof fallback[0] === 'object') {
          return [{ content: value, step: 1 }]; // Wrap string as structured object
        }
        return fallback;
      }
    }
    // Handle arrays with mixed string/object content (reasoningItems)
    if (Array.isArray(value)) {
      return value.map((item: any, index: number) => {
        if (typeof item === 'string') {
          return { content: item, step: index + 1, type: 'reasoning' }; // Convert strings to objects
        }
        return item;
      });
    }
    return fallback;
  }

  /**
   * Save a new explanation with full validation
   * @param data Validated explanation data
   * @returns Saved explanation row
   */
  async save(data: CreateExplanationData): Promise<ExplanationRow> {
    const validated = validateCreateExplanation(data);

    // Prepare data for insertion, ensuring JSON fields are correctly stringified
    const preparedData = {
      ...validated,
      providerRawResponse: validated.providerRawResponse ? JSON.stringify(validated.providerRawResponse) : null,
      reasoningItems: validated.reasoningItems ? JSON.stringify(validated.reasoningItems) : null,
      saturnImages: validated.saturnImages ? JSON.stringify(validated.saturnImages) : null,
      predictedOutputGrid: validated.predictedOutputGrid ? JSON.stringify(validated.predictedOutputGrid) : null,
    };
    
    const sql = `
      INSERT INTO explanations (
        puzzle_id, model_name, pattern_description, solving_strategy,
        confidence, hints, alien_meaning, alien_meaning_confidence,
        provider_response_id, provider_raw_response, reasoning_items,
        api_processing_time_ms, input_tokens, output_tokens, reasoning_tokens,
        total_tokens, estimated_cost, temperature, reasoning_effort,
        reasoning_verbosity, reasoning_summary_type, saturn_images,
        saturn_log, saturn_events, saturn_success, predicted_output_grid,
        is_prediction_correct, prediction_accuracy_score
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb,
        $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
        $22::jsonb, $23, $24, $25, $26::jsonb, $27, $28
      )
      RETURNING *
    `;

    const params = [
      preparedData.puzzleId,
      preparedData.modelName,
      preparedData.patternDescription,
      preparedData.solvingStrategy,
      preparedData.confidence,
      preparedData.hints || [], // Pass array directly for TEXT[] column
      preparedData.alienMeaning,
      preparedData.alienMeaningConfidence,
      preparedData.providerResponseId,
      preparedData.providerRawResponse,
      preparedData.reasoningItems,
      preparedData.apiProcessingTimeMs,
      preparedData.inputTokens,
      preparedData.outputTokens,
      preparedData.reasoningTokens,
      preparedData.totalTokens,
      preparedData.estimatedCost,
      preparedData.temperature,
      preparedData.reasoningEffort,
      preparedData.reasoningVerbosity,
      preparedData.reasoningSummaryType,
      preparedData.saturnImages,
      preparedData.saturnLog,
      preparedData.saturnEvents,
      preparedData.saturnSuccess,
      preparedData.predictedOutputGrid,
      preparedData.isPredictionCorrect,
      preparedData.predictionAccuracyScore
    ];

    try {
      const [row] = await this.db.query<ExplanationRow>(sql, params);
      const parsed = parseExplanationRow({
        ...row,
        hints: row.hints || [], // Already an array from the DB driver
        saturn_images: this.parseJsonField(row.saturn_images, null),
        predicted_output_grid: this.parseJsonField(row.predicted_output_grid, null),
        provider_raw_response: row.provider_raw_response,
        reasoning_items: row.reasoning_items
      });

      logger.info(`Saved explanation: ${JSON.stringify({ id: parsed.id, puzzleId: validated.puzzleId, model: validated.modelName })}`, 'explanations-repo');

      return parsed;
    } catch (error) {
      logger.error(`Failed to save explanation for puzzle ${validated.puzzleId}: ${JSON.stringify({ error: (error as Error).message, modelName: validated.modelName })}`, 'explanations-repo');
      throw error;
    }
  }

  /**
   * Get ALL explanations with optimized feedback counts.
   * This is a crucial method for the main puzzle overview page.
   * @returns All explanations with their associated feedback statistics.
   */
  async getAllWithFeedbackCounts(): Promise<ExplanationWithFeedback[]> {
    const sql = `
      SELECT 
        e.*,
        COALESCE(f.helpful_count, 0)::integer as helpful_count,
        COALESCE(f.not_helpful_count, 0)::integer as not_helpful_count,
        COALESCE(f.total_feedback, 0)::integer as total_feedback
      FROM explanations e
      LEFT JOIN (
        SELECT 
          explanation_id,
          COUNT(*) FILTER (WHERE vote_type = 'helpful')::integer as helpful_count,
          COUNT(*) FILTER (WHERE vote_type = 'not_helpful')::integer as not_helpful_count,
          COUNT(*)::integer as total_feedback
        FROM feedback
        GROUP BY explanation_id
      ) f ON e.id = f.explanation_id
      ORDER BY e.created_at DESC
    `;

    try {
      const rows = await this.db.query(sql);
      return rows.map(row => {
        const transformedRow = {
          ...row,
          hints: row.hints || [], // Already an array from the DB driver
          saturn_images: this.parseJsonField(row.saturn_images, null),
          predicted_output_grid: this.parseJsonField(row.predicted_output_grid, null),
          helpful_count: parseInt(String(row.helpful_count)) || 0,
          not_helpful_count: parseInt(String(row.not_helpful_count)) || 0,
          total_feedback: parseInt(String(row.total_feedback)) || 0,
          api_processing_time_ms: row.api_processing_time_ms ?? 0
        };
        return ExplanationWithFeedbackSchema.parse(transformedRow);
      });
    } catch (error) {
      logger.error(`Failed to get all explanations with feedback counts: ${(error as Error).message}`, 'explanations-repo');
      throw error;
    }
  }

  /**
   * Get explanation by ID with type safety
   * @param id Explanation ID
   * @returns Parsed explanation row or null
   */
  async getById(id: number): Promise<ExplanationRow | null> {
    const sql = `
      SELECT * FROM explanations WHERE id = $1
    `;

    try {
      const row = await this.db.queryOne<ExplanationRow>(sql, [id]);
      if (!row) return null;

      return parseExplanationRow({
        ...row,
        hints: row.hints || [], // Already an array from the DB driver
        saturn_images: this.parseJsonField(row.saturn_images, null),
        predicted_output_grid: this.parseJsonField(row.predicted_output_grid, null)
      });
    } catch (error) {
      logger.error(`Failed to get explanation by id ${id}: ${(error as Error).message}`, 'explanations-repo');
      throw error;
    }
  }

  /**
   * Get all explanations for a puzzle with optimized feedback counts
   * CRITICAL FIX: Replaces correlated subqueries with single aggregated JOIN
   * @param puzzleId Puzzle ID
   * @returns Explanations with feedback statistics
   */
  async getWithFeedbackCounts(puzzleId: string): Promise<ExplanationWithFeedback[]> {
    const sql = `
      SELECT 
        e.*,
        COALESCE(f.helpful_count, 0)::integer as helpful_count,
        COALESCE(f.not_helpful_count, 0)::integer as not_helpful_count,
        COALESCE(f.total_feedback, 0)::integer as total_feedback
      FROM explanations e
      LEFT JOIN (
        SELECT 
          explanation_id,
          COUNT(*) FILTER (WHERE vote_type = 'helpful')::integer as helpful_count,
          COUNT(*) FILTER (WHERE vote_type = 'not_helpful')::integer as not_helpful_count,
          COUNT(*)::integer as total_feedback
        FROM feedback
        GROUP BY explanation_id
      ) f ON e.id = f.explanation_id
      WHERE e.puzzle_id = $1
      ORDER BY e.created_at DESC
    `;

    try {
      const rows = await this.db.query(sql, [puzzleId]);
      
      return rows.map(row => {
        // Debug: log the actual types returned by PostgreSQL
        console.log('DEBUG: Raw row data types:', {
          helpful_count: typeof row.helpful_count, 
          helpful_count_value: row.helpful_count,
          not_helpful_count: typeof row.not_helpful_count,
          not_helpful_count_value: row.not_helpful_count,
          total_feedback: typeof row.total_feedback,
          total_feedback_value: row.total_feedback
        });
        
        // Transform row data with manual type conversion
        const transformedRow = {
          ...row,
          hints: row.hints || [], // Already an array from the DB driver
          saturn_images: this.parseJsonField(row.saturn_images, null),
          predicted_output_grid: this.parseJsonField(row.predicted_output_grid, null),
          // Force convert to integers manually
          helpful_count: parseInt(String(row.helpful_count)) || 0,
          not_helpful_count: parseInt(String(row.not_helpful_count)) || 0,
          total_feedback: parseInt(String(row.total_feedback)) || 0,
          api_processing_time_ms: row.api_processing_time_ms ?? 0
        };
        
        return ExplanationWithFeedbackSchema.parse(transformedRow);
      });
    } catch (error) {
      logger.error(`Failed to get explanations for puzzle ${puzzleId}: ${(error as Error).message}`, 'explanations-repo');
      throw error;
    }
  }

  /**
   * Check if explanation exists for puzzle/model combination
   * @param puzzleId Puzzle ID
   * @param modelName Model name (optional)
   * @returns Boolean indicating existence
   */
  async exists(puzzleId: string, modelName?: string): Promise<boolean> {
    let sql = `SELECT 1 FROM explanations WHERE puzzle_id = $1`;
    const params: any[] = [puzzleId];

    if (modelName) {
      sql += ` AND model_name = $2`;
      params.push(modelName);
    }

    sql += ` LIMIT 1`;

    try {
      const row = await this.db.queryOne(sql, params);
      return !!row;
    } catch (error) {
      logger.error(`Failed to check explanation existence for ${puzzleId}: ${(error as Error).message}`, 'explanations-repo');
      return false;
    }
  }

  /**
   * Get bulk status for multiple puzzles - OPTIMIZED
   * Replaces individual subqueries with efficient aggregation
   * @param puzzleIds Array of puzzle IDs
   * @returns Bulk status results
   */
  async getBulkStatus(puzzleIds: string[]): Promise<BulkStatusResult[]> {
    if (puzzleIds.length === 0) return [];

    const sql = `
      SELECT 
        e.puzzle_id,
        COUNT(DISTINCT e.id) as explanation_count,
        COUNT(DISTINCT CASE WHEN e.is_prediction_correct = true THEN e.id END) as correct_count,
        AVG(e.confidence) as avg_confidence,
        MAX(e.created_at) as latest_explanation
      FROM explanations e
      WHERE e.puzzle_id = ANY($1)
      GROUP BY e.puzzle_id
    `;

    try {
      const rows = await this.db.query<BulkStatusResult>(sql, [puzzleIds]);
      
      logger.debug(`Retrieved bulk status for ${rows.length}/${puzzleIds.length} puzzles`, 'explanations-repo');

      return rows;
    } catch (error) {
      logger.error(`Failed to get bulk status for ${puzzleIds.length} puzzles: ${(error as Error).message}`, 'explanations-repo');
      throw error;
    }
  }

  /**
   * Update Saturn-specific fields for an explanation
   * @param id Explanation ID
   * @param saturnData Saturn solver data
   */
  async updateSaturnData(
    id: number,
    saturnData: {
      images?: string[];
      log?: string;
      events?: string;
      success?: boolean;
    }
  ): Promise<void> {
    const setParts: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    if (saturnData.images !== undefined) {
      setParts.push(`saturn_images = $${paramIndex}::jsonb`);
      params.push(JSON.stringify(saturnData.images));
      paramIndex++;
    }

    if (saturnData.log !== undefined) {
      setParts.push(`saturn_log = $${paramIndex}`);
      params.push(saturnData.log);
      paramIndex++;
    }

    if (saturnData.events !== undefined) {
      setParts.push(`saturn_events = $${paramIndex}`);
      params.push(saturnData.events);
      paramIndex++;
    }

    if (saturnData.success !== undefined) {
      setParts.push(`saturn_success = $${paramIndex}`);
      params.push(saturnData.success);
      paramIndex++;
    }

    if (setParts.length === 0) return;

    const sql = `
      UPDATE explanations 
      SET ${setParts.join(', ')}, updated_at = NOW()
      WHERE id = $1
    `;

    try {
      await this.db.query(sql, params);
      logger.info(`Updated Saturn data for explanation ${id}: ${Object.keys(saturnData).filter(k => saturnData[k as keyof typeof saturnData] !== undefined).join(', ')}`, 'explanations-repo');
    } catch (error) {
      logger.error(`Failed to update Saturn data for explanation ${id}: ${(error as Error).message}`, 'explanations-repo');
      throw error;
    }
  }

  /**
   * Get latest explanation for each puzzle (for homepage/overview)
   * Uses DISTINCT ON for optimal performance
   * @param limit Maximum number of results
   * @returns Latest explanations per puzzle
   */
  async getLatestPerPuzzle(limit: number = 50): Promise<ExplanationWithFeedback[]> {
    const sql = `
      SELECT DISTINCT ON (e.puzzle_id)
        e.*,
        COALESCE(f.helpful_count, 0)::integer as helpful_count,
        COALESCE(f.not_helpful_count, 0)::integer as not_helpful_count,
        COALESCE(f.total_feedback, 0)::integer as total_feedback
      FROM explanations e
      LEFT JOIN (
        SELECT 
          explanation_id,
          COUNT(*) FILTER (WHERE vote_type = 'helpful')::integer as helpful_count,
          COUNT(*) FILTER (WHERE vote_type = 'not_helpful')::integer as not_helpful_count,
          COUNT(*)::integer as total_feedback
        FROM feedback
        GROUP BY explanation_id
      ) f ON e.id = f.explanation_id
      ORDER BY e.puzzle_id, e.created_at DESC
      LIMIT $1
    `;

    try {
      const rows = await this.db.query(sql, [limit]);
      
      return rows.map(row => ExplanationWithFeedbackSchema.parse({
        ...row,
        hints: row.hints || [], // Already an array from the DB driver
        saturn_images: this.parseJsonField(row.saturn_images, null),
        predicted_output_grid: this.parseJsonField(row.predicted_output_grid, null)
      }));
    } catch (error) {
      logger.error(`Failed to get latest explanations per puzzle: ${(error as Error).message}`, 'explanations-repo');
      throw error;
    }
  }

  /**
   * Get solver mode accuracy statistics
   * @returns Accuracy metrics
   */
  async getAccuracyStats(): Promise<{
    totalSolverAttempts: number;
    correctPredictions: number;
    accuracyPercentage: number;
    avgConfidenceCorrect: number;
    avgConfidenceIncorrect: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total_solver_attempts,
        COUNT(*) FILTER (WHERE is_prediction_correct = true) as correct_predictions,
        AVG(confidence) FILTER (WHERE is_prediction_correct = true) as avg_confidence_correct,
        AVG(confidence) FILTER (WHERE is_prediction_correct = false) as avg_confidence_incorrect
      FROM explanations
      WHERE predicted_output_grid IS NOT NULL
    `;

    try {
      const [row] = await this.db.query(sql);
      
      const totalSolverAttempts = parseInt(row.total_solver_attempts || '0');
      const correctPredictions = parseInt(row.correct_predictions || '0');
      const accuracyPercentage = totalSolverAttempts > 0 
        ? (correctPredictions / totalSolverAttempts) * 100 
        : 0;

      return {
        totalSolverAttempts,
        correctPredictions,
        accuracyPercentage: Math.round(accuracyPercentage * 100) / 100,
        avgConfidenceCorrect: Math.round((row.avg_confidence_correct || 0) * 100) / 100,
        avgConfidenceIncorrect: Math.round((row.avg_confidence_incorrect || 0) * 100) / 100
      };
    } catch (error) {
      logger.error(`Failed to get accuracy stats: ${(error as Error).message}`, 'explanations-repo');
      throw error;
    }
  }
}