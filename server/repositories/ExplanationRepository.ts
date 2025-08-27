/**
 * Explanation Repository Implementation
 * 
 * Handles all explanation-related database operations.
 * Extracted from monolithic DbService to follow Single Responsibility Principle.
 * 
 * @author Claude
 * @date 2025-08-27
 */

import { BaseRepository } from './base/BaseRepository.js';
import { 
  IExplanationRepository, 
  ExplanationData, 
  ExplanationResponse, 
  BulkExplanationStatus 
} from './interfaces/IExplanationRepository.js';
import { logger } from '../utils/logger.js';

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
          is_prediction_correct, prediction_accuracy_score, extraction_method,
          all_predictions_correct, average_prediction_accuracy_score,
          multi_test_all_correct, multi_test_average_accuracy
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
          $26, $27, $28, $29, $30, $31, $32, $33, $34
        ) RETURNING *
      `, [
        data.puzzleId || data.taskId, // Support both field names during transition
        data.patternDescription,
        data.solvingStrategy || '',
        Array.isArray(data.hints) ? data.hints : [],
        this.normalizeConfidence(data.confidence),
        data.modelName || null,
        data.reasoningLog ? this.safeJsonStringify(data.reasoningLog) : null,
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
        // New fields for alien communication and validation
        data.alienMeaning || null,
        data.alienMeaningConfidence || null,
        data.isPredictionCorrect || null,
        data.predictionAccuracyScore || null,
        data.extractionMethod || null,
        data.allPredictionsCorrect || null,
        data.averagePredictionAccuracyScore || null,
        data.multiTestAllCorrect || null,
        data.multiTestAverageAccuracy || null
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
      SELECT e.*, 
             COALESCE(f.helpful_votes, 0) as helpful_votes,
             COALESCE(f.not_helpful_votes, 0) as not_helpful_votes
      FROM explanations e
      LEFT JOIN (
        SELECT explanation_id, 
               COUNT(CASE WHEN vote_type = 'helpful' THEN 1 END) as helpful_votes,
               COUNT(CASE WHEN vote_type = 'not_helpful' THEN 1 END) as not_helpful_votes
        FROM feedback 
        GROUP BY explanation_id
      ) f ON e.id = f.explanation_id
      WHERE e.puzzle_id = $1 
      ORDER BY e.created_at DESC 
      LIMIT 1
    `, [puzzleId]);

    return result.rows.length > 0 ? this.mapRowToExplanation(result.rows[0]) : null;
  }

  async getExplanationsForPuzzle(puzzleId: string): Promise<ExplanationResponse[]> {
    if (!this.isConnected()) {
      return [];
    }

    const result = await this.query(`
      SELECT e.*, 
             COALESCE(f.helpful_votes, 0) as helpful_votes,
             COALESCE(f.not_helpful_votes, 0) as not_helpful_votes
      FROM explanations e
      LEFT JOIN (
        SELECT explanation_id, 
               COUNT(CASE WHEN vote_type = 'helpful' THEN 1 END) as helpful_votes,
               COUNT(CASE WHEN vote_type = 'not_helpful' THEN 1 END) as not_helpful_votes
        FROM feedback 
        GROUP BY explanation_id
      ) f ON e.id = f.explanation_id
      WHERE e.puzzle_id = $1 
      ORDER BY e.created_at DESC
    `, [puzzleId]);

    return result.rows.map(row => this.mapRowToExplanation(row));
  }

  async getExplanationById(id: number): Promise<ExplanationResponse | null> {
    if (!this.isConnected()) {
      return null;
    }

    const result = await this.query(`
      SELECT e.*, 
             COALESCE(f.helpful_votes, 0) as helpful_votes,
             COALESCE(f.not_helpful_votes, 0) as not_helpful_votes
      FROM explanations e
      LEFT JOIN (
        SELECT explanation_id, 
               COUNT(CASE WHEN vote_type = 'helpful' THEN 1 END) as helpful_votes,
               COUNT(CASE WHEN vote_type = 'not_helpful' THEN 1 END) as not_helpful_votes
        FROM feedback 
        GROUP BY explanation_id
      ) f ON e.id = f.explanation_id
      WHERE e.id = $1
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
   * Enhanced to include ALL fields that frontend components expect
   */
  private mapRowToExplanation(row: any): ExplanationResponse {
    // Parse multi-test results to extract computed validation fields
    const multiTestResults = this.safeJsonParse(row.multi_test_results, 'multiTestResults');
    const multiplePredictedOutputs = this.safeJsonParse(row.multiple_predicted_outputs, 'multiplePredictedOutputs');
    
    // Compute solver validation fields from stored data
    const computedFields = this.computeSolverValidationFields(row, multiTestResults, multiplePredictedOutputs);

    return {
      id: row.id,
      puzzleId: row.puzzle_id, // PRIMARY: Frontend and API expect this field name
      taskId: row.puzzle_id,   // DEPRECATED: Backward compatibility alias
      patternDescription: row.pattern_description || '',
      solvingStrategy: row.solving_strategy || '',
      hints: this.processHints(row.hints),
      confidence: this.normalizeConfidence(row.confidence),
      modelName: row.model_name,
      reasoningLog: row.reasoning_log,
      hasReasoningLog: !!row.has_reasoning_log,
      createdAt: row.created_at,
      apiProcessingTimeMs: row.api_processing_time_ms,
      estimatedCost: row.estimated_cost,
      temperature: row.temperature,
      reasoningEffort: row.reasoning_effort,
      reasoningVerbosity: row.reasoning_verbosity,
      reasoningSummaryType: row.reasoning_summary_type,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      reasoningTokens: row.reasoning_tokens,
      totalTokens: row.total_tokens,
      predictedOutputGrid: this.safeJsonParse(row.predicted_output_grid, 'predictedOutputGrid'),
      multiplePredictedOutputs: multiplePredictedOutputs,
      multiTestResults: multiTestResults,
      saturnSuccess: row.saturn_success,
      saturnImages: this.safeJsonParse(row.saturn_images, 'saturnImages', []),
      saturnLog: row.saturn_log,
      saturnEvents: row.saturn_events,
      
      // MISSING FIELDS: Add alien communication fields
      alienMeaning: row.alien_meaning || '',
      alienMeaningConfidence: this.normalizeConfidence(row.alien_meaning_confidence),
      
      // MISSING FIELDS: Add feedback counts (populated by separate query)
      helpfulVotes: row.helpful_votes || 0,
      notHelpfulVotes: row.not_helpful_votes || 0,
      
      // MISSING FIELDS: Add computed solver validation fields
      ...computedFields,
      
      // MISSING FIELDS: Add database raw multi-test fields for frontend compatibility
      multiTestAllCorrect: computedFields.allPredictionsCorrect,
      multiTestAverageAccuracy: computedFields.averagePredictionAccuracyScore
    };
  }

  /**
   * Get solver validation fields from stored database values
   * Now that we persist validation results, we primarily use stored values
   */
  private computeSolverValidationFields(row: any, multiTestResults: any, multiplePredictedOutputs: any) {
    // Use stored validation results when available
    const storedIsPredictionCorrect = row.is_prediction_correct;
    const storedPredictionAccuracyScore = row.prediction_accuracy_score;
    const storedExtractionMethod = row.extraction_method;
    const storedAllPredictionsCorrect = row.all_predictions_correct;
    const storedAveragePredictionAccuracyScore = row.average_prediction_accuracy_score;
    
    const hasMultiplePredictions = Array.isArray(multiplePredictedOutputs) && multiplePredictedOutputs.length > 0;
    
    if (hasMultiplePredictions) {
      // Multi-test case: use stored values or fall back to computed values
      const allCorrect = storedAllPredictionsCorrect !== null ? storedAllPredictionsCorrect : 
        (Array.isArray(multiTestResults) ? multiTestResults.every(result => result.isPredictionCorrect === true) : false);
      
      const averageAccuracy = storedAveragePredictionAccuracyScore !== null ? storedAveragePredictionAccuracyScore :
        (Array.isArray(multiTestResults) ? this.calculateAverageAccuracy(multiTestResults) : 0);

      return {
        isPredictionCorrect: undefined, // Not applicable for multi-test
        predictionAccuracyScore: averageAccuracy,
        extractionMethod: storedExtractionMethod || (Array.isArray(multiTestResults) ? multiTestResults[0]?.extractionMethod : 'unknown'),
        predictedOutputGrids: multiplePredictedOutputs,
        multiValidation: multiTestResults,
        allPredictionsCorrect: allCorrect,
        averagePredictionAccuracyScore: averageAccuracy
      };
    } else {
      // Single-test case: use stored values
      return {
        isPredictionCorrect: storedIsPredictionCorrect,
        predictionAccuracyScore: storedPredictionAccuracyScore,
        extractionMethod: storedExtractionMethod,
        predictedOutputGrids: undefined,
        multiValidation: undefined,
        allPredictionsCorrect: undefined,
        averagePredictionAccuracyScore: undefined
      };
    }
  }

  /**
   * Helper method to calculate average accuracy from multi-test results
   */
  private calculateAverageAccuracy(multiTestResults: any[]): number {
    const accuracyScores = multiTestResults
      .map(result => result.predictionAccuracyScore)
      .filter(score => typeof score === 'number');
    
    return accuracyScores.length > 0 
      ? accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length 
      : 0;
  }
}