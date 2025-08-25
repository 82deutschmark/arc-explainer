/**
 * Clean Database Service - Pure Database Operations
 * 
 * Focused exclusively on PostgreSQL database operations for ARC-AGI Explainer.
 * Uses dataTransformers utilities for all parsing/serialization logic.
 * Maintains backward compatibility with existing API surface.
 * 
 * @author Cascade
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import type { Feedback, DetailedFeedback, FeedbackFilters, FeedbackStats } from '../../shared/types';
import { 
  normalizeConfidence, 
  safeJsonParse, 
  processHints,
} from '../utils/dataTransformers';
import { q, safeJsonStringify } from '../utils/dbQueryWrapper';

// PostgreSQL connection pool
let pool: Pool | null = null;

/**
 * Initialize database connection and create tables
 */
const initDb = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    logger.warn('DATABASE_URL not provided, using in-memory storage only', 'database');
    return false;
  }

  try {
    pool = new Pool({ connectionString: databaseUrl });
    
    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    // Create tables if they don't exist
    await createTablesIfNotExist();
    
    logger.info('Database connection established and tables verified', 'database');
    return true;
  } catch (error) {
    logger.error(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}`, 'database');
    pool = null;
    return false;
  }
};

/**
 * Create database tables with proper schema
 */
const createTablesIfNotExist = async () => {
  if (!pool) return;

  try {
    // Phase 0: Snapshot reality - Log the actual schema of key columns
    const schemaCheckQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'explanations'
        AND column_name IN (
          'predicted_output_grid',
          'reasoning_items',
          'saturn_images',
          'multiple_predicted_outputs',
          'multi_test_results'
        )
      ORDER BY column_name;
    `;
    const schemaResult = await pool.query(schemaCheckQuery);
    console.info('[DB Schema Snapshot] Actual data types for `explanations` table:', schemaResult.rows);
  } catch (error) {
    console.error('[DB Schema Snapshot] Failed to retrieve schema for `explanations` table:', error);
    // Proceed even if snapshot fails, but log the error.
  }
  
  const client = await pool.connect();
  
  try {
    // Create explanations table with comprehensive schema
    await client.query(`
      DO $$
      BEGIN
        -- Create explanations table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'explanations') THEN
          CREATE TABLE explanations (
            id SERIAL PRIMARY KEY,
            puzzle_id VARCHAR(255) NOT NULL,
            pattern_description TEXT NOT NULL,
            solving_strategy TEXT NOT NULL,
            hints TEXT[] DEFAULT '{}',
            confidence INTEGER DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
            alien_meaning_confidence INTEGER DEFAULT NULL CHECK (alien_meaning_confidence >= 0 AND alien_meaning_confidence <= 100),
            alien_meaning TEXT DEFAULT '',
            model_name VARCHAR(100) DEFAULT 'unknown',
            reasoning_log TEXT DEFAULT NULL,
            has_reasoning_log BOOLEAN DEFAULT FALSE,
            provider_response_id TEXT DEFAULT NULL,
            provider_raw_response JSONB DEFAULT NULL,
            reasoning_items JSONB DEFAULT NULL,
            api_processing_time_ms INTEGER DEFAULT NULL,
            saturn_images JSONB DEFAULT NULL,
            saturn_log JSONB DEFAULT NULL,
            saturn_events JSONB DEFAULT NULL,
            saturn_success BOOLEAN DEFAULT NULL,
            predicted_output_grid JSONB DEFAULT NULL,
            is_prediction_correct BOOLEAN DEFAULT NULL,
            prediction_accuracy_score FLOAT DEFAULT NULL,
            temperature FLOAT DEFAULT NULL,
            reasoning_effort TEXT DEFAULT NULL,
            reasoning_verbosity TEXT DEFAULT NULL,
            reasoning_summary_type TEXT DEFAULT NULL,
            input_tokens INTEGER DEFAULT NULL,
            output_tokens INTEGER DEFAULT NULL,
            reasoning_tokens INTEGER DEFAULT NULL,
            total_tokens INTEGER DEFAULT NULL,
            estimated_cost FLOAT DEFAULT NULL,
            has_multiple_predictions BOOLEAN DEFAULT NULL,
            multiple_predicted_outputs JSONB DEFAULT NULL,
            multi_test_prediction_grids JSONB DEFAULT NULL,
            multi_test_results JSONB DEFAULT NULL,
            multi_test_all_correct BOOLEAN DEFAULT NULL,
            multi_test_average_accuracy FLOAT DEFAULT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;

        -- Create feedback table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback') THEN
          CREATE TABLE feedback (
            id SERIAL PRIMARY KEY,
            explanation_id INTEGER NOT NULL REFERENCES explanations(id) ON DELETE CASCADE,
            vote_type VARCHAR(20) NOT NULL CHECK (vote_type IN ('helpful', 'not_helpful')),
            comment TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        END IF;

        -- Create batch analysis tables if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_analysis_sessions') THEN
          CREATE TABLE batch_analysis_sessions (
            session_id VARCHAR(255) PRIMARY KEY,
            total_puzzles INTEGER NOT NULL DEFAULT 0,
            completed_puzzles INTEGER NOT NULL DEFAULT 0,
            failed_puzzles INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            model_name VARCHAR(100) DEFAULT NULL,
            prompt_id VARCHAR(255) DEFAULT NULL,
            capture_reasoning BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_analysis_results') THEN
          CREATE TABLE batch_analysis_results (
            session_id VARCHAR(255) NOT NULL REFERENCES batch_analysis_sessions(session_id) ON DELETE CASCADE,
            puzzle_id VARCHAR(255) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            explanation_id INTEGER DEFAULT NULL REFERENCES explanations(id) ON DELETE SET NULL,
            processing_time_ms INTEGER DEFAULT NULL,
            accuracy_score FLOAT DEFAULT NULL,
            is_correct BOOLEAN DEFAULT NULL,
            error_message TEXT DEFAULT NULL,
            started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
            completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
            PRIMARY KEY (session_id, puzzle_id)
          );
        END IF;

        -- Migration: Add has_multiple_predictions column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'explanations'
                     AND column_name = 'has_multiple_predictions') THEN
          ALTER TABLE explanations ADD COLUMN has_multiple_predictions BOOLEAN DEFAULT NULL;
        END IF;
        
        -- Migration: Add multi_test_prediction_grids column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'explanations'
                     AND column_name = 'multi_test_prediction_grids') THEN
          ALTER TABLE explanations ADD COLUMN multi_test_prediction_grids JSONB DEFAULT NULL;
        END IF;

      END $$;
    `);

    logger.info('Database tables created/verified successfully', 'database');

    // COMPREHENSIVE schema verification to debug JSON syntax errors
    const schemaQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'explanations' 
      AND column_name IN (
        'predicted_output_grid', 'reasoning_items', 'saturn_images', 'saturn_log', 'saturn_events',
        'multiple_predicted_outputs', 'multi_test_results', 'has_multiple_predictions', 'multi_test_prediction_grids',
        'provider_raw_response', 'api_processing_time_ms', 'input_tokens', 'output_tokens', 'reasoning_tokens',
        'total_tokens', 'estimated_cost', 'temperature', 'reasoning_effort', 'reasoning_verbosity', 'reasoning_summary_type'
      )
      ORDER BY column_name;
    `;
    const schemaResult = await client.query(schemaQuery);
    logger.info(`[SCHEMA-VERIFICATION] Database column types for JSON error investigation:`, 'database');
    schemaResult.rows.forEach(row => {
      logger.info(`[SCHEMA-VERIFICATION] ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`, 'database');
    });
    
    // Check specifically for our new Option B column
    const optionBQuery = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'explanations' AND column_name = 'multi_test_prediction_grids'`;
    const optionBResult = await client.query(optionBQuery);
    if (optionBResult.rows.length === 0) {
      logger.error('[SCHEMA-ERROR] multi_test_prediction_grids column MISSING - migration may have failed!', 'database');
    } else {
      logger.info(`[SCHEMA-SUCCESS] multi_test_prediction_grids exists: ${optionBResult.rows[0].data_type}`, 'database');
    }
    
    // INVESTIGATE BACKGROUND OPERATIONS: Check for triggers that might cause ERROR vs 201 success contradiction
    const triggersQuery = `
      SELECT trigger_name, event_manipulation, action_timing, action_statement 
      FROM information_schema.triggers 
      WHERE event_object_table = 'explanations'
    `;
    const triggersResult = await client.query(triggersQuery);
    if (triggersResult.rows.length > 0) {
      logger.warn(`[TRIGGERS-FOUND] Database triggers on explanations table (potential source of JSON errors):`, 'database');
      triggersResult.rows.forEach(trigger => {
        logger.warn(`[TRIGGERS-FOUND] ${trigger.trigger_name}: ${trigger.action_timing} ${trigger.event_manipulation}`, 'database');
      });
    } else {
      logger.info(`[TRIGGERS-NONE] No database triggers on explanations table`, 'database');
    }
    
    // Check for foreign key constraints that might cause secondary operations
    const constraintsQuery = `
      SELECT constraint_name, constraint_type, table_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'explanations' AND constraint_type = 'FOREIGN KEY'
    `;
    const constraintsResult = await client.query(constraintsQuery);
    if (constraintsResult.rows.length > 0) {
      logger.info(`[CONSTRAINTS-FOUND] Foreign key constraints on explanations:`, 'database');
      constraintsResult.rows.forEach(constraint => {
        logger.info(`[CONSTRAINTS-FOUND] ${constraint.constraint_name}`, 'database');
      });
    } else {
      logger.info(`[CONSTRAINTS-NONE] No foreign key constraints on explanations table`, 'database');
    }
  } catch (error) {
    logger.error(`Failed to create tables: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Save puzzle explanation to database
 */
const saveExplanation = async (puzzleId: string, explanation: any): Promise<number | null> => {
  if (!pool) {
    logger.warn('No database connection, explanation not saved', 'database');
    return null;
  }

  const client = await pool.connect();
  let queryParams: any[] = [];
  let paramMap: { [key: number]: string } = {};
  
  try {
    const {
      patternDescription, solvingStrategy, hints: rawHints, confidence,
      alienMeaningConfidence, alienMeaning, modelName, reasoningLog, hasReasoningLog,
      providerResponseId, providerRawResponse, reasoningItems, apiProcessingTimeMs,
      saturnImages, saturnLog, saturnEvents, saturnSuccess,
      predictedOutputGrid, isPredictionCorrect, predictionAccuracyScore,
      temperature, reasoningEffort, reasoningVerbosity, reasoningSummaryType,
      inputTokens, outputTokens, reasoningTokens, totalTokens, estimatedCost,
      hasMultiplePredictions, multiplePredictedOutputs, multiTestResults, multiTestAllCorrect, multiTestAverageAccuracy
    } = explanation;

    const hints = processHints(rawHints);
    const shouldPersistRaw = process.env.RAW_RESPONSE_PERSIST !== 'false';

    const queryText = `
      INSERT INTO explanations 
       (puzzle_id, pattern_description, solving_strategy, hints,
        confidence, alien_meaning_confidence, alien_meaning, model_name,
        reasoning_log, has_reasoning_log, provider_response_id, provider_raw_response,
        reasoning_items, api_processing_time_ms, saturn_images, saturn_log,
        saturn_events, saturn_success, predicted_output_grid, is_prediction_correct,
        prediction_accuracy_score, temperature, reasoning_effort, reasoning_verbosity,
        reasoning_summary_type, input_tokens, output_tokens, reasoning_tokens,
        total_tokens, estimated_cost, has_multiple_predictions, multiple_predicted_outputs,
        multi_test_results, multi_test_all_correct, multi_test_average_accuracy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
               $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
               $31, $32, $33, $34, $35)
       RETURNING id`;

    const queryParams = [
      puzzleId,
      patternDescription || '',
      solvingStrategy || '',
      hints, // Already an array of strings
      normalizeConfidence(confidence),
      alienMeaningConfidence ? normalizeConfidence(alienMeaningConfidence) : null,
      alienMeaning || '',
      modelName || 'unknown',
      reasoningLog || null,
      hasReasoningLog || false,
      providerResponseId || null,
      shouldPersistRaw ? safeJsonStringify(providerRawResponse) : null,
      safeJsonStringify(reasoningItems),
      apiProcessingTimeMs || null,
      safeJsonStringify(saturnImages),
      safeJsonStringify(saturnLog),
      safeJsonStringify(saturnEvents),
      saturnSuccess ?? null,
      safeJsonStringify(predictedOutputGrid),
      isPredictionCorrect ?? null,
      predictionAccuracyScore || null,
      temperature || null,
      reasoningEffort || null,
      reasoningVerbosity || null,
      reasoningSummaryType || null,
      inputTokens || null,
      outputTokens || null,
      reasoningTokens || null,
      totalTokens || null,
      estimatedCost || null,
      hasMultiplePredictions ?? null,
      safeJsonStringify(multiplePredictedOutputs),
      safeJsonStringify(multiTestResults),
      multiTestAllCorrect ?? null,
      multiTestAverageAccuracy ?? null
    ];

    const paramMap = {
      1: 'puzzle_id', 2: 'pattern_description', 3: 'solving_strategy', 4: 'hints',
      5: 'confidence', 6: 'alien_meaning_confidence', 7: 'alien_meaning', 8: 'model_name',
      9: 'reasoning_log', 10: 'has_reasoning_log', 11: 'provider_response_id', 12: 'provider_raw_response',
      13: 'reasoning_items', 14: 'api_processing_time_ms', 15: 'saturn_images', 16: 'saturn_log',
      17: 'saturn_events', 18: 'saturn_success', 19: 'predicted_output_grid', 20: 'is_prediction_correct',
      21: 'prediction_accuracy_score', 22: 'temperature', 23: 'reasoning_effort', 24: 'reasoning_verbosity',
      25: 'reasoning_summary_type', 26: 'input_tokens', 27: 'output_tokens', 28: 'reasoning_tokens',
      29: 'total_tokens', 30: 'estimated_cost', 31: 'has_multiple_predictions', 32: 'multiple_predicted_outputs',
      33: 'multi_test_results', 34: 'multi_test_all_correct', 35: 'multi_test_average_accuracy'
    };

    // GRANULAR ERROR ISOLATION: Wrap the critical INSERT operation
    logger.info(`[OPERATION-START] Beginning INSERT for puzzle ${puzzleId}`, 'database');
    
    let result;
    try {
      result = await q(client, queryText, queryParams, 'explanations.insert', paramMap);
      logger.info(`[OPERATION-SUCCESS] INSERT completed for puzzle ${puzzleId}`, 'database');
    } catch (insertError) {
      logger.error(`[OPERATION-FAILURE] INSERT failed for puzzle ${puzzleId}: ${insertError instanceof Error ? insertError.message : String(insertError)}`, 'database');
      
      // Detailed JSON error analysis
      if (String(insertError).includes('invalid input syntax for type json')) {
        logger.error(`[JSON-ERROR-ANALYSIS] Investigating JSON syntax error for puzzle ${puzzleId}:`, 'database');
        logger.error(`[JSON-ERROR-ANALYSIS] Query: ${queryText.substring(0, 200)}...`, 'database');
        logger.error(`[JSON-ERROR-ANALYSIS] Parameter count: ${queryParams.length}`, 'database');
        
        // Log suspect JSONB parameters
        const jsonbParams = [
          { name: 'multiplePredictedOutputs', value: queryParams[31], index: 32 },
          { name: 'multiTestPredictionGrids', value: queryParams[32], index: 33 },
          { name: 'multiTestResults', value: queryParams[33], index: 34 },
          { name: 'predictedOutputGrid', value: queryParams[18], index: 19 },
          { name: 'reasoningItems', value: queryParams[12], index: 13 },
        ];
        
        jsonbParams.forEach(param => {
          logger.error(`[JSON-ERROR-ANALYSIS] ${param.name} ($${param.index}): ${typeof param.value} = ${JSON.stringify(param.value)}`, 'database');
        });
      }
      
      throw insertError; // Re-throw to maintain error flow
    }
    
    logger.info(`[OPERATION-COMPLETE] Saved explanation for puzzle ${puzzleId} with ID ${result.rows[0].id}`, 'database');
    return result.rows[0].id;
  } catch (error) {
    let errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[OUTER-ERROR] Error in saveExplanation for puzzle ${puzzleId}: ${errorMessage}`, 'database');
    
    if (errorMessage.includes('invalid input syntax for type json') || errorMessage.includes('undefined parameter')) {
      logger.error(`[Debug] Detailed parameter analysis for puzzle ${puzzleId}:`, 'database');
      queryParams.forEach((param: any, index: number) => {
        let paramName = paramMap[index + 1] || `param_${index + 1}`;
        logger.error(`- Param ${index + 1} (${paramName}): [${typeof param}] ${String(param)?.substring(0, 100)}`, 'database');
      });
    }
    
    return null;
  } finally {
    client.release();
  }
};

/**
 * Get single explanation for a puzzle
 */
const getExplanationForPuzzle = async (puzzleId: string) => {
  if (!pool) return null;

  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT 
         id, puzzle_id AS "puzzleId", pattern_description AS "patternDescription",
         solving_strategy AS "solvingStrategy", hints, confidence,
         alien_meaning_confidence AS "alienMeaningConfidence",
         alien_meaning AS "alienMeaning", model_name AS "modelName",
         reasoning_log AS "reasoningLog", has_reasoning_log AS "hasReasoningLog",
         provider_response_id AS "providerResponseId",
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
         (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND vote_type = 'helpful') AS "helpful_votes",
         (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND vote_type = 'not_helpful') AS "not_helpful_votes"
       FROM explanations 
       WHERE puzzle_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [puzzleId]
    );

    if (result.rows.length === 0) return null;

    // Parse JSON fields using utility
    const row = result.rows[0];
    return {
      ...row,
      saturnImages: safeJsonParse(row.saturnImages, 'saturnImages'),
      predictedOutputGrid: safeJsonParse(row.predictedOutputGrid, 'predictedOutputGrid'),
      // JSONB fields come back as objects automatically
      multiplePredictedOutputs: row.multiplePredictedOutputs,
      multiTestResults: row.multiTestResults
    };
  } catch (error) {
    logger.error(`Error getting explanation for puzzle ${puzzleId}: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return null;
  } finally {
    client.release();
  }
};

/**
 * Get all explanations for a puzzle
 */
const getExplanationsForPuzzle = async (puzzleId: string) => {
  if (!pool) return null;

  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT 
         id, puzzle_id AS "puzzleId", pattern_description AS "patternDescription",
         solving_strategy AS "solvingStrategy", hints, confidence,
         model_name AS "modelName", reasoning_log AS "reasoningLog",
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
         (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND vote_type = 'helpful') AS "helpful_votes",
         (SELECT COUNT(*) FROM feedback WHERE explanation_id = explanations.id AND vote_type = 'not_helpful') AS "not_helpful_votes"
       FROM explanations 
       WHERE puzzle_id = $1 
       ORDER BY created_at DESC`,
      [puzzleId]
    );

    // JSONB columns are automatically parsed by the driver, so no extra parsing is needed.
    return result.rows;
  } catch (error) {
    logger.error(`Error getting explanations for puzzle ${puzzleId}: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return null;
  } finally {
    client.release();
  }
};

/**
 * Get explanation by ID
 */
const getExplanationById = async (explanationId: number) => {
  if (!pool) return null;

  const client = await pool.connect();
  
  try {
    const result = await client.query('SELECT * FROM explanations WHERE id = $1', [explanationId]);

    if (result.rows.length === 0) {
      return null;
    }

    const explanation = result.rows[0];

    // JSONB columns are automatically parsed by the driver. No manual parsing is needed.
    return explanation;
  } catch (error) {
    logger.error(`Error getting explanation by ID ${explanationId}: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return null;
  } finally {
    client.release();
  }
};

/**
 * Check if explanation exists for puzzle
 */
const hasExplanation = async (puzzleId: string): Promise<boolean> => {
  if (!pool) return false;

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT 1 FROM explanations WHERE puzzle_id = $1 LIMIT 1',
      [puzzleId]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error(`Error checking for explanation for puzzle ${puzzleId}: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return false;
  } finally {
    client.release();
  }
};

/**
 * Get bulk explanation status for multiple puzzles
 */
const getBulkExplanationStatus = async (puzzleIds: string[]) => {
  if (!pool || puzzleIds.length === 0) return new Map();

  const client = await pool.connect();
  
  try {
    let resultMap = new Map();
    
    // Initialize all as false
    puzzleIds.forEach(id => resultMap.set(id, false));
    
    // Check which ones exist
    let placeholders = puzzleIds.map((_, index) => `$${index + 1}`).join(',');
    const result = await client.query(
      `SELECT DISTINCT puzzle_id FROM explanations WHERE puzzle_id IN (${placeholders})`,
      puzzleIds
    );
    
    // Mark existing ones as true
    result.rows.forEach(row => resultMap.set(row.puzzle_id, true));
    
    return resultMap;
  } catch (error) {
    logger.error(`Error getting bulk explanation status: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return new Map();
  } finally {
    client.release();
  }
};

/**
 * Add feedback for an explanation
 */
const addFeedback = async (explanationId: number, voteType: 'helpful' | 'not_helpful', comment: string): Promise<boolean> => {
  if (!pool) return false;

  const client = await pool.connect();
  
  try {
    await client.query(
      `INSERT INTO feedback (explanation_id, vote_type, comment) VALUES ($1, $2, $3)`,
      [explanationId, voteType, comment]
    );
    return true;
  } catch (error) {
    logger.error(`Error adding feedback: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return false;
  } finally {
    client.release();
  }
};

/**
 * Get feedback for an explanation
 */
const getFeedbackForExplanation = async (explanationId: number): Promise<Feedback[]> => {
  if (!pool) return [];

  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT id, explanation_id AS "explanationId", vote_type AS "voteType", 
              comment, created_at AS "createdAt"
       FROM feedback 
       WHERE explanation_id = $1 
       ORDER BY created_at DESC`,
      [explanationId]
    );
    return result.rows;
  } catch (error) {
    logger.error(`Error getting feedback: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return [];
  } finally {
    client.release();
  }
};

/**
 * Get feedback for a puzzle
 */
const getFeedbackForPuzzle = async (puzzleId: string): Promise<DetailedFeedback[]> => {
  if (!pool) return [];

  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT f.id, f.explanation_id AS "explanationId", f.vote_type AS "voteType",
              f.comment, f.created_at AS "createdAt",
              e.puzzle_id AS "puzzleId", e.model_name AS "modelName"
       FROM feedback f
       JOIN explanations e ON f.explanation_id = e.id
       WHERE e.puzzle_id = $1
       ORDER BY f.created_at DESC`,
      [puzzleId]
    );
    return result.rows;
  } catch (error) {
    logger.error(`Error getting puzzle feedback: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return [];
  } finally {
    client.release();
  }
};

/**
 * Get all feedback with optional filters
 */
const getAllFeedback = async (filters: FeedbackFilters = {}): Promise<DetailedFeedback[]> => {
  if (!pool) return [];

  const client = await pool.connect();
  
  try {
    let query = `
      SELECT f.id, f.explanation_id AS "explanationId", f.vote_type AS "voteType",
             f.comment, f.created_at AS "createdAt",
             e.puzzle_id AS "puzzleId", e.model_name AS "modelName"
      FROM feedback f
      JOIN explanations e ON f.explanation_id = e.id
    `;
    
    let conditions: string[] = [];
    let queryParams: any[] = [];
    
    if (filters.voteType) {
      conditions.push(`f.vote_type = $${queryParams.length + 1}`);
      queryParams.push(filters.voteType);
    }
    
    if (filters.modelName) {
      conditions.push(`e.model_name = $${queryParams.length + 1}`);
      queryParams.push(filters.modelName);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY f.created_at DESC';
    
    if (filters.limit) {
      query += ` LIMIT $${queryParams.length + 1}`;
      queryParams.push(filters.limit);
    }
    
    const result = await client.query(query, queryParams);
    return result.rows;
  } catch (error) {
    logger.error(`Error getting all feedback: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return [];
  } finally {
    client.release();
  }
};

/**
 * Get feedback summary statistics
 */
const getFeedbackSummaryStats = async (): Promise<FeedbackStats> => {
  const defaultStats: FeedbackStats = {
    totalFeedback: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
    helpfulPercentage: 0,
    notHelpfulPercentage: 0,
    feedbackByModel: {},
    feedbackByDay: []
  };

  if (!pool) return defaultStats;

  const client = await pool.connect();
  
  try {
    // Get overall stats
    const totalResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN vote_type = 'helpful' THEN 1 END) as helpful,
        COUNT(CASE WHEN vote_type = 'not_helpful' THEN 1 END) as not_helpful
      FROM feedback
    `);
    
    const { total, helpful, not_helpful: notHelpful } = totalResult.rows[0];
    const helpfulPercentage = total > 0 ? (helpful / total) * 100 : 0;
    const notHelpfulPercentage = total > 0 ? (notHelpful / total) * 100 : 0;

    // Get stats by model
    const modelResult = await client.query(`
      SELECT 
        e.model_name,
        COUNT(*) as total,
        COUNT(CASE WHEN f.vote_type = 'helpful' THEN 1 END) as helpful
      FROM feedback f
      JOIN explanations e ON f.explanation_id = e.id
      GROUP BY e.model_name
      ORDER BY total DESC
    `);
    
    const feedbackByModel: Record<string, { helpful: number; notHelpful: number }> = {};
    modelResult.rows.forEach(row => {
      feedbackByModel[row.model_name] = {
        helpful: parseInt(row.helpful),
        notHelpful: parseInt(row.total) - parseInt(row.helpful)
      };
    });

    // Get daily stats for last 30 days
    const dailyResult = await client.query(`
      SELECT 
        DATE(f.created_at) as date,
        COUNT(*) as total,
        COUNT(CASE WHEN f.vote_type = 'helpful' THEN 1 END) as helpful
      FROM feedback f
      WHERE f.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(f.created_at)
      ORDER BY date DESC
    `);
    
    const feedbackByDay = dailyResult.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      helpful: parseInt(row.helpful),
      notHelpful: parseInt(row.total) - parseInt(row.helpful)
    }));

    return {
      totalFeedback: parseInt(total),
      helpfulCount: parseInt(helpful),
      notHelpfulCount: parseInt(notHelpful),
      helpfulPercentage: Math.round(helpfulPercentage * 10) / 10,
      notHelpfulPercentage: Math.round(notHelpfulPercentage * 10) / 10,
      feedbackByModel,
      feedbackByDay
    };
  } catch (error) {
    logger.error(`Error getting feedback stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return defaultStats;
  } finally {
    client.release();
  }
};

/**
 * Get accuracy statistics for solver mode
 */
const getAccuracyStats = async () => {
  if (!pool) return null;

  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        model_name,
        COUNT(*) as total_predictions,
        COUNT(CASE WHEN is_prediction_correct = true THEN 1 END) as correct_predictions,
        ROUND(AVG(CASE WHEN prediction_accuracy_score IS NOT NULL THEN prediction_accuracy_score ELSE 0 END)::numeric, 3) as avg_accuracy_score,
        ROUND(AVG(CASE WHEN confidence IS NOT NULL THEN confidence ELSE 50 END)::numeric, 1) as avg_confidence,
        COUNT(CASE WHEN predicted_output_grid IS NOT NULL THEN 1 END) as successful_extractions
      FROM explanations 
      WHERE is_prediction_correct IS NOT NULL
      GROUP BY model_name
      ORDER BY correct_predictions DESC, total_predictions DESC
    `);

    const totalResult = await client.query(`
      SELECT COUNT(*) as total FROM explanations WHERE is_prediction_correct IS NOT NULL
    `);

    const accuracyByModel = result.rows.map(row => ({
      model: row.model_name,
      totalPredictions: parseInt(row.total_predictions),
      correctPredictions: parseInt(row.correct_predictions),
      accuracyPercentage: parseFloat(((row.correct_predictions / row.total_predictions) * 100).toFixed(1)),
      avgAccuracyScore: parseFloat(row.avg_accuracy_score),
      avgConfidence: parseFloat(row.avg_confidence),
      successfulExtractions: parseInt(row.successful_extractions)
    }));

    return {
      totalPredictions: parseInt(totalResult.rows[0].total),
      accuracyByModel
    };
  } catch (error) {
    logger.error(`Error getting accuracy stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return null;
  } finally {
    client.release();
  }
};

// Batch Analysis Functions (simplified implementations)

const createBatchSession = async (sessionData: any) => {
  if (!pool) return false;

  const client = await pool.connect();
  
  try {
    await client.query(
      `INSERT INTO batch_analysis_sessions 
       (session_id, total_puzzles, model_name, prompt_id, capture_reasoning)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionData.sessionId, sessionData.totalPuzzles, sessionData.modelName, 
       sessionData.promptId, sessionData.captureReasoning]
    );
    return true;
  } catch (error) {
    logger.error(`Error creating batch session: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return false;
  } finally {
    client.release();
  }
};

const updateBatchSession = async (sessionId: string, updates: any) => {
  if (!pool) return false;

  const client = await pool.connect();
  
  try {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    Object.entries(updates).forEach(([key, value]) => {
      const dbColumn = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      setParts.push(`${dbColumn} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    });
    
    if (setParts.length > 0) {
      values.push(sessionId);
      await client.query(
        `UPDATE batch_analysis_sessions SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE session_id = $${paramIndex}`,
        values
      );
    }
    
    return true;
  } catch (error) {
    logger.error(`Error updating batch session: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return false;
  } finally {
    client.release();
  }
};

const getBatchSession = async (sessionId: string) => {
  if (!pool) return null;

  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT * FROM batch_analysis_sessions WHERE session_id = $1`,
      [sessionId]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error(`Error getting batch session: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return null;
  } finally {
    client.release();
  }
};

const createBatchResult = async (sessionId: string, puzzleId: string) => {
  if (!pool) return false;

  const client = await pool.connect();
  
  try {
    await client.query(
      `INSERT INTO batch_analysis_results (session_id, puzzle_id, status)
       VALUES ($1, $2, 'pending')`,
      [sessionId, puzzleId]
    );
    return true;
  } catch (error) {
    logger.error(`Error creating batch result: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return false;
  } finally {
    client.release();
  }
};

const updateBatchResult = async (sessionId: string, puzzleId: string, updates: any) => {
  if (!pool) return false;

  const client = await pool.connect();
  
  try {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    Object.entries(updates).forEach(([key, value]) => {
      const dbColumn = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      setParts.push(`${dbColumn} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    });
    
    if (setParts.length > 0) {
      values.push(sessionId, puzzleId);
      await client.query(
        `UPDATE batch_analysis_results SET ${setParts.join(', ')} WHERE session_id = $${paramIndex} AND puzzle_id = $${paramIndex + 1}`,
        values
      );
    }
    
    return true;
  } catch (error) {
    logger.error(`Error updating batch result: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return false;
  } finally {
    client.release();
  }
};

const getBatchResults = async (sessionId: string) => {
  if (!pool) return [];

  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT * FROM batch_analysis_results WHERE session_id = $1 ORDER BY completed_at DESC`,
      [sessionId]
    );
    return result.rows;
  } catch (error) {
    logger.error(`Error getting batch results: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return [];
  } finally {
    client.release();
  }
};

// Export clean database service
export const dbService = {
  init: initDb, // Maintain backward compatibility
  saveExplanation,
  getExplanationForPuzzle,
  getExplanationsForPuzzle,
  getExplanationById,
  hasExplanation,
  getBulkExplanationStatus,
  addFeedback,
  getFeedbackForExplanation,
  getFeedbackForPuzzle,
  getAllFeedback,
  getFeedbackSummaryStats,
  getAccuracyStats,
  createBatchSession,
  updateBatchSession,
  getBatchSession,
  createBatchResult,
  updateBatchResult,
  getBatchResults,
  isConnected: () => !!pool,
};