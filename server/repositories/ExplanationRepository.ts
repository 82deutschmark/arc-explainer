/**
 * Explanation Repository Implementation
 * 
 * Handles all explanation-related database operations.
 * Extracted from monolithic DbService to follow Single Responsibility Principle.
 * 
 * @author Claude
 * @date 2025-08-27
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { 
  IExplanationRepository, 
  ExplanationData, 
  ExplanationResponse, 
  BulkExplanationStatus 
} from './interfaces/IExplanationRepository.ts';
import { logger } from '../utils/logger.ts';

export class ExplanationRepository extends BaseRepository implements IExplanationRepository {
  
  async saveExplanation(data: ExplanationData): Promise<ExplanationResponse> {
    if (!this.isConnected()) {
      throw new Error('Database not available');
    }

    const client = await this.getClient();
    
    try {
      const result = await this.query(`
        INSERT INTO explanations (
          puzzle_id, pattern_description, solving_strategy, hints, confidence,
          model_name, reasoning_log, has_reasoning_log, api_processing_time_ms, estimated_cost,
          temperature, reasoning_effort, reasoning_verbosity, reasoning_summary_type,
          input_tokens, output_tokens, reasoning_tokens, total_tokens,
          predicted_output_grid, multiple_predicted_outputs, multi_test_results,
          saturn_success, saturn_images, saturn_log, saturn_events,
          alien_meaning, alien_meaning_confidence,
          is_prediction_correct, prediction_accuracy_score,
          multi_test_all_correct, multi_test_average_accuracy, has_multiple_predictions
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
          $26, $27, $28, $29, $30, $31, $32
        ) RETURNING *
      `, [
        data.puzzleId || data.taskId, // Support both field names during transition
        data.patternDescription,
        data.solvingStrategy || '',
        Array.isArray(data.hints) ? data.hints : [],
        this.normalizeConfidence(data.confidence),
        data.modelName || null,
        this.processReasoningLog(data.reasoningLog),
        !!data.reasoningLog,
        data.apiProcessingTimeMs || null,
        data.estimatedCost || null,
        data.temperature || null,
        data.reasoningEffort || null,
        data.reasoningVerbosity || null,
        data.reasoningSummaryType || null,
        data.inputTokens || null,
        data.outputTokens || null,
        data.reasoningTokens || null,
        data.totalTokens || null,
        this.safeJsonStringify(data.predictedOutputGrid),
        this.safeJsonStringify(data.multiplePredictedOutputs),
        this.safeJsonStringify(data.multiTestResults),
        data.saturnSuccess || null,
        this.safeJsonStringify(data.saturnImages),
        data.saturnLog || null,
        data.saturnEvents || null,
        // Alien communication fields
        data.alienMeaning || null,
        data.alienMeaningConfidence || null,
        // Validation fields using actual schema column names
        data.isPredictionCorrect || null,
        data.predictionAccuracyScore || null,
        // Multi-test fields using actual schema column names
        data.multiTestAllCorrect || null,
        data.multiTestAverageAccuracy || null,
        data.hasMultiplePredictions || null
      ], client);

      if (result.rows.length === 0) {
        throw new Error('Failed to save explanation');
      }

      return this.mapRowToExplanation(result.rows[0]);
    } catch (error) {
      logger.error(`Error saving explanation: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    } finally {
      client.release();
    }
  }

  async getExplanationForPuzzle(puzzleId: string): Promise<ExplanationResponse | null> {
    if (!this.isConnected()) {
      return null;
    }

    const result = await this.query(`
      SELECT 
        id, puzzle_id AS "puzzleId", pattern_description AS "patternDescription",
        solving_strategy AS "solvingStrategy", hints, confidence,
        alien_meaning_confidence AS "alienMeaningConfidence",
        alien_meaning AS "alienMeaning", model_name AS "modelName",
        reasoning_log AS "reasoningLog", has_reasoning_log AS "hasReasoningLog",
        provider_response_id AS "providerResponseId",
        api_processing_time_ms AS "apiProcessingTimeMs",
        input_tokens AS "inputTokens", output_tokens AS "outputTokens",
        reasoning_tokens AS "reasoningTokens", total_tokens AS "totalTokens",
        estimated_cost AS "estimatedCost", temperature,
        reasoning_effort AS "reasoningEffort", reasoning_verbosity AS "reasoningVerbosity",
        reasoning_summary_type AS "reasoningSummaryType",
        saturn_images AS "saturnImages", saturn_log AS "saturnLog",
        saturn_events AS "saturnEvents", saturn_success AS "saturnSuccess",
        predicted_output_grid AS "predictedOutputGrid",
        is_prediction_correct AS "isPredictionCorrect",
        prediction_accuracy_score AS "predictionAccuracyScore",
        has_multiple_predictions AS "hasMultiplePredictions",
        multiple_predicted_outputs AS "multiplePredictedOutputs",
        multi_test_results AS "multiTestResults",
        multi_test_all_correct AS "multiTestAllCorrect",
        multi_test_average_accuracy AS "multiTestAverageAccuracy",
        created_at AS "createdAt",
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND vote_type = 'helpful') AS "helpfulVotes",
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND vote_type = 'not_helpful') AS "notHelpfulVotes"
      FROM explanations 
      WHERE puzzle_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [puzzleId]);

    return result.rows.length > 0 ? this.mapRowToExplanation(result.rows[0]) : null;
  }

  async getExplanationsForPuzzle(puzzleId: string): Promise<ExplanationResponse[]> {
    if (!this.isConnected()) {
      return [];
    }

    const result = await this.query(`
      SELECT 
        id, puzzle_id AS "puzzleId", pattern_description AS "patternDescription",
        solving_strategy AS "solvingStrategy", hints, confidence,
        alien_meaning_confidence AS "alienMeaningConfidence",
        alien_meaning AS "alienMeaning", model_name AS "modelName",
        reasoning_log AS "reasoningLog", has_reasoning_log AS "hasReasoningLog",
        provider_response_id AS "providerResponseId",
        api_processing_time_ms AS "apiProcessingTimeMs",
        input_tokens AS "inputTokens", output_tokens AS "outputTokens",
        reasoning_tokens AS "reasoningTokens", total_tokens AS "totalTokens",
        estimated_cost AS "estimatedCost", temperature,
        reasoning_effort AS "reasoningEffort", reasoning_verbosity AS "reasoningVerbosity",
        reasoning_summary_type AS "reasoningSummaryType",
        saturn_images AS "saturnImages", saturn_log AS "saturnLog",
        saturn_events AS "saturnEvents", saturn_success AS "saturnSuccess",
        predicted_output_grid AS "predictedOutputGrid",
        is_prediction_correct AS "isPredictionCorrect",
        prediction_accuracy_score AS "predictionAccuracyScore",
        has_multiple_predictions AS "hasMultiplePredictions",
        multiple_predicted_outputs AS "multiplePredictedOutputs",
        multi_test_results AS "multiTestResults",
        multi_test_all_correct AS "multiTestAllCorrect",
        multi_test_average_accuracy AS "multiTestAverageAccuracy",
        created_at AS "createdAt",
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND vote_type = 'helpful') AS "helpfulVotes",
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND vote_type = 'not_helpful') AS "notHelpfulVotes"
      FROM explanations 
      WHERE puzzle_id = $1 
      ORDER BY created_at DESC
    `, [puzzleId]);

    return result.rows.map(row => this.mapRowToExplanation(row));
  }

  async getExplanationById(id: number): Promise<ExplanationResponse | null> {
    if (!this.isConnected()) {
      return null;
    }

    const result = await this.query(`
      SELECT 
        id, puzzle_id AS "puzzleId", pattern_description AS "patternDescription",
        solving_strategy AS "solvingStrategy", hints, confidence,
        alien_meaning_confidence AS "alienMeaningConfidence",
        alien_meaning AS "alienMeaning", model_name AS "modelName",
        reasoning_log AS "reasoningLog", has_reasoning_log AS "hasReasoningLog",
        provider_response_id AS "providerResponseId",
        api_processing_time_ms AS "apiProcessingTimeMs",
        input_tokens AS "inputTokens", output_tokens AS "outputTokens",
        reasoning_tokens AS "reasoningTokens", total_tokens AS "totalTokens",
        estimated_cost AS "estimatedCost", temperature,
        reasoning_effort AS "reasoningEffort", reasoning_verbosity AS "reasoningVerbosity",
        reasoning_summary_type AS "reasoningSummaryType",
        saturn_images AS "saturnImages", saturn_log AS "saturnLog",
        saturn_events AS "saturnEvents", saturn_success AS "saturnSuccess",
        predicted_output_grid AS "predictedOutputGrid",
        is_prediction_correct AS "isPredictionCorrect",
        prediction_accuracy_score AS "predictionAccuracyScore",
        has_multiple_predictions AS "hasMultiplePredictions",
        multiple_predicted_outputs AS "multiplePredictedOutputs",
        multi_test_results AS "multiTestResults",
        multi_test_all_correct AS "multiTestAllCorrect",
        multi_test_average_accuracy AS "multiTestAverageAccuracy",
        created_at AS "createdAt",
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND vote_type = 'helpful') AS "helpfulVotes",
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND vote_type = 'not_helpful') AS "notHelpfulVotes"
      FROM explanations 
      WHERE id = $1
    `, [id]);

    return result.rows.length > 0 ? this.mapRowToExplanation(result.rows[0]) : null;
  }

  async hasExplanation(puzzleId: string): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    const result = await this.query(`
      SELECT 1 FROM explanations 
      WHERE puzzle_id = $1 
      LIMIT 1
    `, [puzzleId]);

    return result.rows.length > 0;
  }

  async getBulkExplanationStatus(puzzleIds: string[]): Promise<BulkExplanationStatus> {
    if (!this.isConnected() || puzzleIds.length === 0) {
      return {};
    }

    // Initialize all puzzles with default status
    const status: BulkExplanationStatus = {};
    puzzleIds.forEach(puzzleId => {
      status[puzzleId] = {
        hasExplanation: false,
        explanationId: null,
        feedbackCount: 0,
        apiProcessingTimeMs: null,
        modelName: null,
        createdAt: null,
        confidence: null,
        estimatedCost: null
      };
    });

    try {
      const placeholders = puzzleIds.map((_, i) => `$${i + 1}`).join(', ');
      
      const result = await this.query(`
        SELECT DISTINCT ON (e.puzzle_id)
          e.puzzle_id,
          e.id as explanation_id,
          e.api_processing_time_ms,
          e.model_name,
          e.created_at,
          e.confidence,
          e.estimated_cost,
          COALESCE(f.feedback_count, 0)::integer as feedback_count
        FROM explanations e
        LEFT JOIN (
          SELECT explanation_id, COUNT(*) as feedback_count
          FROM feedback
          GROUP BY explanation_id
        ) f ON e.id = f.explanation_id
        WHERE e.puzzle_id IN (${placeholders})
        ORDER BY e.puzzle_id, e.created_at DESC
      `, puzzleIds);

      // Update status for puzzles that have explanations
      result.rows.forEach(row => {
        if (status[row.puzzle_id]) {
          status[row.puzzle_id] = {
            hasExplanation: true,
            explanationId: row.explanation_id,
            feedbackCount: parseInt(row.feedback_count) || 0,
            apiProcessingTimeMs: row.api_processing_time_ms,
            modelName: row.model_name,
            createdAt: row.created_at,
            confidence: row.confidence,
            estimatedCost: row.estimated_cost
          };
        }
      });

      return status;
    } catch (error) {
      logger.error(`Error getting bulk explanation status: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return status; // Return default status on error
    }
  }

  /**
   * Map database row to ExplanationResponse object
   * SQL aliases already provide correct camelCase field names
   */
  /**
   * Process reasoning log to ensure it's stored as readable text
   * Handles strings, arrays, and objects appropriately to prevent "[object Object]" corruption
   */
  private processReasoningLog(reasoningLog: any): string | null {
    // Handle null/undefined
    if (!reasoningLog) {
      return null;
    }

    // If already a string, return as-is
    if (typeof reasoningLog === 'string') {
      return reasoningLog.trim() || null;
    }

    // If it's an array, join with newlines for readability
    if (Array.isArray(reasoningLog)) {
      return reasoningLog
        .map(item => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) {
            // Handle objects in arrays - extract text content if possible
            if (item.text) return item.text;
            if (item.content) return item.content;
            if (item.message) return item.message;
            // As last resort, stringify the object properly
            return JSON.stringify(item, null, 2);
          }
          return String(item);
        })
        .filter(Boolean)
        .join('\n\n') || null;
    }

    // If it's an object, try to extract meaningful text content
    if (typeof reasoningLog === 'object' && reasoningLog !== null) {
      // Common text fields in reasoning objects
      if (reasoningLog.text) return reasoningLog.text;
      if (reasoningLog.content) return reasoningLog.content;
      if (reasoningLog.message) return reasoningLog.message;
      if (reasoningLog.summary) return reasoningLog.summary;
      
      // If it has an array of items, process them
      if (Array.isArray(reasoningLog.items)) {
        return this.processReasoningLog(reasoningLog.items);
      }

      // As a last resort, stringify the object with proper formatting
      try {
        const stringified = JSON.stringify(reasoningLog, null, 2);
        // Avoid returning "[object Object]" or similar useless strings
        if (stringified && stringified !== '{}' && stringified !== 'null') {
          return stringified;
        }
      } catch (error) {
        console.warn('[ExplanationRepository] Failed to stringify reasoning log object:', error);
      }
    }

    // For any other type, convert to string if meaningful
    const stringValue = String(reasoningLog);
    if (stringValue && stringValue !== '[object Object]' && stringValue !== 'undefined') {
      return stringValue;
    }

    return null;
  }

  private mapRowToExplanation(row: any): ExplanationResponse {
    return {
      // Basic fields (already camelCase from SQL aliases)
      ...row,
      
      // Parse JSON fields that need to be objects/arrays
      hints: this.processHints(row.hints),
      confidence: this.normalizeConfidence(row.confidence),
      alienMeaningConfidence: this.normalizeConfidence(row.alienMeaningConfidence),
      saturnImages: this.safeJsonParse(row.saturnImages, 'saturnImages', []),
      predictedOutputGrid: this.safeJsonParse(row.predictedOutputGrid, 'predictedOutputGrid'),
      multiplePredictedOutputs: this.safeJsonParse(row.multiplePredictedOutputs, 'multiplePredictedOutputs'),
      multiTestResults: this.safeJsonParse(row.multiTestResults, 'multiTestResults'),
      
      // Ensure boolean fields are properly typed
      hasReasoningLog: !!row.hasReasoningLog,
      saturnSuccess: row.saturnSuccess,
      isPredictionCorrect: row.isPredictionCorrect,
      multiTestAllCorrect: row.multiTestAllCorrect,
      hasMultiplePredictions: row.hasMultiplePredictions
    };
  }

}