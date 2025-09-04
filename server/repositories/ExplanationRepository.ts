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
          model_name, reasoning_log, has_reasoning_log, reasoning_items, api_processing_time_ms, estimated_cost,
          temperature, reasoning_effort, reasoning_verbosity, reasoning_summary_type,
          input_tokens, output_tokens, reasoning_tokens, total_tokens,
          predicted_output_grid, multiple_predicted_outputs, multi_test_results,
          saturn_success, saturn_images, saturn_log, saturn_events,
          alien_meaning, alien_meaning_confidence,
          is_prediction_correct, prediction_accuracy_score,
          multi_test_all_correct, multi_test_average_accuracy, has_multiple_predictions,
          system_prompt_used, user_prompt_used, prompt_template_id, custom_prompt_text
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
          $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37
        ) RETURNING *
      `, [
        data.puzzleId, // Simplified - consistent with ExplanationData interface
        data.patternDescription,
        data.solvingStrategy || '',
        Array.isArray(data.hints) ? data.hints : [],
        this.normalizeConfidence(data.confidence),
        data.modelName || null,
        this.processReasoningLog(data.reasoningLog),
        !!data.reasoningLog,
        this.safeJsonStringify(data.reasoningItems),
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
        data.hasMultiplePredictions || null,
        // NEW: Prompt tracking fields for full traceability
        data.systemPromptUsed || null,
        data.userPromptUsed || null,
        data.promptTemplateId || null,
        data.customPromptText || null
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
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND feedback_type = 'helpful') AS "helpfulVotes",
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND feedback_type = 'not_helpful') AS "notHelpfulVotes"
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
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND feedback_type = 'helpful') AS "helpfulVotes",
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND feedback_type = 'not_helpful') AS "notHelpfulVotes"
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
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND feedback_type = 'helpful') AS "helpfulVotes",
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND feedback_type = 'not_helpful') AS "notHelpfulVotes"
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
        estimatedCost: null,
        alienMeaningConfidence: null,
        alienMeaning: null,
        reasoningLog: null,
        hasReasoningLog: null,
        providerResponseId: null,
        saturnImages: null,
        saturnLog: null,
        saturnEvents: null,
        saturnSuccess: null,
        predictedOutputGrid: null,
        isPredictionCorrect: null,
        predictionAccuracyScore: null,
        providerRawResponse: null,
        reasoningItems: null,
        temperature: null,
        reasoningEffort: null,
        reasoningVerbosity: null,
        reasoningSummaryType: null,
        inputTokens: null,
        outputTokens: null,
        reasoningTokens: null,
        totalTokens: null,
        multiplePredictedOutputs: null,
        multiTestResults: null,
        multiTestAllCorrect: null,
        multiTestAverageAccuracy: null,
        hasMultiplePredictions: null,
        multiTestPredictionGrids: null
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
          e.alien_meaning_confidence,
          e.alien_meaning,
          e.reasoning_log,
          e.has_reasoning_log,
          e.provider_response_id,
          e.saturn_images,
          e.saturn_log,
          e.saturn_events,
          e.saturn_success,
          e.predicted_output_grid,
          e.is_prediction_correct,
          e.prediction_accuracy_score,
          e.provider_raw_response,
          e.reasoning_items,
          e.temperature,
          e.reasoning_effort,
          e.reasoning_verbosity,
          e.reasoning_summary_type,
          e.input_tokens,
          e.output_tokens,
          e.reasoning_tokens,
          e.total_tokens,
          e.multiple_predicted_outputs,
          e.multi_test_results,
          e.multi_test_all_correct,
          e.multi_test_average_accuracy,
          e.has_multiple_predictions,
          e.multi_test_prediction_grids,
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
            estimatedCost: row.estimated_cost,
            alienMeaningConfidence: row.alien_meaning_confidence,
            alienMeaning: row.alien_meaning,
            reasoningLog: row.reasoning_log,
            hasReasoningLog: row.has_reasoning_log,
            providerResponseId: row.provider_response_id,
            saturnImages: row.saturn_images,
            saturnLog: row.saturn_log,
            saturnEvents: row.saturn_events,
            saturnSuccess: row.saturn_success,
            predictedOutputGrid: row.predicted_output_grid,
            isPredictionCorrect: row.is_prediction_correct,
            predictionAccuracyScore: row.prediction_accuracy_score,
            providerRawResponse: row.provider_raw_response,
            reasoningItems: row.reasoning_items,
            temperature: row.temperature,
            reasoningEffort: row.reasoning_effort,
            reasoningVerbosity: row.reasoning_verbosity,
            reasoningSummaryType: row.reasoning_summary_type,
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            reasoningTokens: row.reasoning_tokens,
            totalTokens: row.total_tokens,
            multiplePredictedOutputs: row.multiple_predicted_outputs,
            multiTestResults: row.multi_test_results,
            multiTestAllCorrect: row.multi_test_all_correct,
            multiTestAverageAccuracy: row.multi_test_average_accuracy,
            hasMultiplePredictions: row.has_multiple_predictions,
            multiTestPredictionGrids: row.multi_test_prediction_grids
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
    console.log(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] Input type: ${typeof reasoningLog}, isArray: ${Array.isArray(reasoningLog)}`);
    console.log(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] Input value preview:`, Array.isArray(reasoningLog) ? `Array(${reasoningLog.length})` : reasoningLog);

    // Handle null/undefined
    if (!reasoningLog) {
      return null;
    }

    // If already a string, return as-is
    if (typeof reasoningLog === 'string') {
      return reasoningLog.trim() || null;
    }

    // CRITICAL FIX: If it's an array of objects (reasoningItems), process each object properly
    if (Array.isArray(reasoningLog)) {
      console.log(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] Processing array with ${reasoningLog.length} items`);
      const processedItems = reasoningLog
        .map((item, index) => {
          console.log(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] Item ${index} type: ${typeof item}`, typeof item === 'object' ? Object.keys(item) : item);
          
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) {
            // Handle objects in arrays - extract text content if possible
            if (item.text) return item.text;
            if (item.content) return item.content;
            if (item.message) return item.message;
            if (item.thinking) return item.thinking;
            if (item.step) return item.step;
            if (item.analysis) return item.analysis;
            if (item.observation) return item.observation;
            
            // CRITICAL: Proper object stringification to avoid [object Object]
            try {
              const jsonString = JSON.stringify(item, null, 2);
              console.log(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] Item ${index} stringified successfully: ${jsonString.substring(0, 100)}...`);
              return jsonString;
            } catch (error) {
              console.error(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] Failed to stringify item ${index}:`, error);
              return `[Failed to parse reasoning item ${index}]`;
            }
          }
          return String(item);
        })
        .filter(Boolean);
      
      console.log(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] Processed ${processedItems.length} items successfully`);
      const result = processedItems.join('\n\n') || null;
      console.log(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] Final result length: ${result?.length || 0}`);
      return result;
    }

    // If it's an object, try to extract meaningful text content
    if (typeof reasoningLog === 'object' && reasoningLog !== null) {
      console.log(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] Processing single object with keys:`, Object.keys(reasoningLog));
      
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
        console.log(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] Object stringified successfully: ${stringified.substring(0, 100)}...`);
        // Avoid returning "[object Object]" or similar useless strings
        if (stringified && stringified !== '{}' && stringified !== 'null') {
          return stringified;
        }
      } catch (error) {
        console.warn('[ExplanationRepository] Failed to stringify reasoning log object:', error);
      }
    }

    // For any other type, convert to string and if it's [object Object], try to stringify as JSON
    const stringValue = String(reasoningLog);
    console.log(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] String conversion result: "${stringValue.substring(0, 50)}..."`);
    
    if (stringValue === '[object Object]') {
      console.error(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] DETECTED [object Object] corruption! Attempting to recover...`);
      try {
        const jsonString = JSON.stringify(reasoningLog, null, 2);
        if (jsonString && jsonString !== '{}' && jsonString !== 'null') {
          console.log(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] Recovery successful: ${jsonString.substring(0, 100)}...`);
          return jsonString;
        }
      } catch (error) {
        console.error(`🔍 [REASONING-LOG-CORRUPTION-DEBUG] Recovery failed:`, error);
      }
      return null;
    }
    if (stringValue && stringValue !== 'undefined') {
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
      multiplePredictedOutputs: row.multiplePredictedOutputs, // Boolean flag, not JSON data
      multiTestResults: this.safeJsonParse(row.multiTestResults, 'multiTestResults'),
      
      // Ensure boolean fields are properly typed
      hasReasoningLog: !!row.hasReasoningLog,
      saturnSuccess: row.saturnSuccess,
      isPredictionCorrect: row.isPredictionCorrect,
      multiTestAllCorrect: row.multiTestAllCorrect,
      hasMultiplePredictions: row.hasMultiplePredictions
    };
  }

  /**
   * Find entries that are missing multiple predictions data due to the bug
   */
  async findMissingMultiplePredictions(limit = 100): Promise<any[]> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - cannot find missing multiple predictions', 'repository');
      return [];
    }

    try {
      const queryText = `
        SELECT id, puzzle_id as "puzzleId", model_name as "modelName", provider_raw_response as "providerRawResponse"
        FROM explanations 
        WHERE has_multiple_predictions IS NULL 
          AND provider_raw_response IS NOT NULL
        ORDER BY id DESC
        LIMIT $1
      `;
      
      const result = await this.query(queryText, [limit]);
      return result.rows;
    } catch (error) {
      logger.error(`Error finding missing multiple predictions: ${error instanceof Error ? error.message : String(error)}`, 'repository');
      return [];
    }
  }

  /**
   * Update an explanation with multiple predictions data
   */
  async updateMultiplePredictions(explanationId: number, grids: any[]): Promise<void> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - cannot update multiple predictions', 'repository');
      return;
    }

    try {
      const queryText = `
        UPDATE explanations 
        SET has_multiple_predictions = true,
            multiple_predicted_outputs = $1
        WHERE id = $2
      `;
      
      await this.query(queryText, [this.safeJsonStringify(grids), explanationId]);
      logger.info(`Updated explanation ${explanationId} with ${grids.length} multiple predictions`, 'repository');
    } catch (error) {
      logger.error(`Error updating multiple predictions for ${explanationId}: ${error instanceof Error ? error.message : String(error)}`, 'repository');
      throw error;
    }
  }

  /**
   * Get statistics about multiple predictions recovery
   */
  async getMultiplePredictionsStats(): Promise<any> {
    if (!this.isConnected()) {
      return {
        totalExplanations: 0,
        withMultiplePredictions: 0,
        missingMultiplePredictions: 0,
        potentialRecoverable: 0
      };
    }

    try {
      const queryText = `
        SELECT 
          COUNT(*) as total_explanations,
          COUNT(CASE WHEN has_multiple_predictions = true THEN 1 END) as with_multiple_predictions,
          COUNT(CASE WHEN has_multiple_predictions IS NULL THEN 1 END) as missing_multiple_predictions,
          COUNT(CASE WHEN has_multiple_predictions IS NULL AND provider_raw_response IS NOT NULL THEN 1 END) as potential_recoverable
        FROM explanations
      `;
      
      const result = await this.query(queryText);
      const stats = result.rows[0];
      
      return {
        totalExplanations: parseInt(stats.total_explanations) || 0,
        withMultiplePredictions: parseInt(stats.with_multiple_predictions) || 0,
        missingMultiplePredictions: parseInt(stats.missing_multiple_predictions) || 0,
        potentialRecoverable: parseInt(stats.potential_recoverable) || 0
      };
    } catch (error) {
      logger.error(`Error getting multiple predictions stats: ${error instanceof Error ? error.message : String(error)}`, 'repository');
      throw error;
    }
  }

  /**
   * Get worst-performing puzzles based on composite scoring
   * Prioritizes incorrect predictions, low accuracy scores, and negative feedback
   * Supports accuracy range filtering
   */
  async getWorstPerformingPuzzles(
    limit: number = 20, 
    sortBy: string = 'composite',
    filters?: {
      minAccuracy?: number;
      maxAccuracy?: number;
      zeroAccuracyOnly?: boolean;
    }
  ): Promise<any[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      // Build the HAVING clause based on filters
      let havingConditions = ['COUNT(DISTINCT e.id) > 0'];
      const queryParams = [limit, sortBy];
      let paramIndex = 3;

      if (filters?.zeroAccuracyOnly) {
        // Only show puzzles with 0% accuracy
        havingConditions.push('AVG(COALESCE(e.prediction_accuracy_score, e.multi_test_average_accuracy, 0)) = 0');
      } else {
        // Apply accuracy range filters if provided
        if (filters?.minAccuracy !== undefined) {
          havingConditions.push(`AVG(COALESCE(e.prediction_accuracy_score, e.multi_test_average_accuracy, 0)) >= $${paramIndex}`);
          queryParams.push(filters.minAccuracy);
          paramIndex++;
        }
        
        if (filters?.maxAccuracy !== undefined) {
          havingConditions.push(`AVG(COALESCE(e.prediction_accuracy_score, e.multi_test_average_accuracy, 0)) <= $${paramIndex}`);
          queryParams.push(filters.maxAccuracy);
          paramIndex++;
        }
        
        // If no specific filters, keep original filter logic
        if (filters?.minAccuracy === undefined && filters?.maxAccuracy === undefined) {
          havingConditions.push(`(
            COUNT(CASE WHEN e.is_prediction_correct = false OR e.multi_test_all_correct = false THEN 1 END) > 0 OR
            AVG(COALESCE(e.prediction_accuracy_score, e.multi_test_average_accuracy, 0)) < 0.5 OR
            COUNT(f.id) FILTER (WHERE f.feedback_type = 'not_helpful') > 0
          )`);
        }
      }

      const result = await this.query(`
        SELECT *
        FROM (
          SELECT 
            e.puzzle_id,
            COUNT(CASE WHEN e.is_prediction_correct = false OR e.multi_test_all_correct = false THEN 1 END) as wrong_count,
            AVG(COALESCE(e.prediction_accuracy_score, e.multi_test_average_accuracy, 0)) as avg_accuracy,
            AVG(e.confidence) as avg_confidence,
            COUNT(DISTINCT e.id) as total_explanations,
            COUNT(f.id) FILTER (WHERE f.feedback_type = 'not_helpful') as negative_feedback,
            COUNT(f.id) as total_feedback,
            MAX(e.created_at) as latest_analysis,
            MIN(CASE WHEN e.is_prediction_correct = false OR e.multi_test_all_correct = false THEN e.id END) as worst_explanation_id,
            (
              COUNT(CASE WHEN e.is_prediction_correct = false OR e.multi_test_all_correct = false THEN 1 END) * 5.0 +
              CASE WHEN AVG(COALESCE(e.prediction_accuracy_score, e.multi_test_average_accuracy, 0)) < 0.6 THEN 10.0 ELSE 0.0 END +
              CASE WHEN AVG(e.confidence) < 50 THEN 3.0 ELSE 0.0 END +
              COUNT(f.id) FILTER (WHERE f.feedback_type = 'not_helpful') * 2.0
            ) as composite_score
          FROM explanations e
          LEFT JOIN feedback f ON e.id = f.explanation_id
          WHERE e.puzzle_id IS NOT NULL
          GROUP BY e.puzzle_id
          HAVING ${havingConditions.join(' AND ')}
        ) as performance_data
        ORDER BY 
          CASE WHEN $2 = 'composite' THEN performance_data.composite_score END DESC,
          CASE WHEN $2 = 'accuracy' THEN performance_data.avg_accuracy END ASC NULLS LAST,
          CASE WHEN $2 = 'feedback' THEN performance_data.negative_feedback END DESC NULLS LAST
        LIMIT $1
      `, queryParams);

      return result.rows.map(row => ({
        puzzleId: row.puzzle_id,
        wrongCount: parseInt(row.wrong_count) || 0,
        avgAccuracy: parseFloat(row.avg_accuracy) || 0,
        avgConfidence: parseFloat(row.avg_confidence) || 0,
        totalExplanations: parseInt(row.total_explanations) || 0,
        negativeFeedback: parseInt(row.negative_feedback) || 0,
        totalFeedback: parseInt(row.total_feedback) || 0,
        latestAnalysis: row.latest_analysis,
        worstExplanationId: row.worst_explanation_id,
        compositeScore: parseFloat(row.composite_score) || 0
      }));
    } catch (error) {
      logger.error(`Error getting worst-performing puzzles: ${error instanceof Error ? error.message : String(error)}`, 'explanation-repository');
      return [];
    }
  }

}