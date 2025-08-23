/**
 * Database service for Railway PostgreSQL integration
 * Handles database operations for storing puzzle explanations and user feedback
 * Now supports reasoning log storage for AI models that provide step-by-step reasoning
 * Also tracks and stores API processing time metrics for model performance analysis
 * @author Cascade
 */

import { Pool } from 'pg';
// Import proper logger utility
import { logger } from '../utils/logger';
import type { Feedback, DetailedFeedback, FeedbackFilters, FeedbackStats } from '../../shared/types';
// Inline normalizeConfidence function to avoid module resolution issues
// Handles both decimal (0-1) and percentage (0-100) formats
const normalizeConfidence = (confidence: any): number => {
  if (typeof confidence === 'string') {
    const parsed = parseFloat(confidence);
    if (!isNaN(parsed)) {
      // Convert to percentage if decimal, clamp to 0-100 range
      const normalized = parsed <= 1 ? parsed * 100 : parsed;
      return Math.round(Math.max(0, Math.min(100, normalized)));
    }
  }
  if (typeof confidence === 'number') {
    // Convert decimal confidence (0-1) to percentage (0-100)
    const normalized = confidence <= 1 ? confidence * 100 : confidence;
    return Math.round(Math.max(0, Math.min(100, normalized)));
  }
  return 50; // Default fallback
};

/**
 * Interface for puzzle explanations
 */
interface PuzzleExplanation {
  patternDescription: string;
  solvingStrategy: string;
  hints: string[];
  alienMeaning: string;
  confidence: number;
  alienMeaningConfidence?: number;
  modelName: string;
  reasoningLog?: string | null;
  hasReasoningLog?: boolean;
  // OpenAI Responses API identifiers and structured reasoning
  providerResponseId?: string | null;
  providerRawResponse?: any | null; // persisted only when RAW_RESPONSE_PERSIST=true
  reasoningItems?: any[] | null; // array of summarized reasoning steps
  apiProcessingTimeMs?: number;
  // Saturn-specific: optional list of image paths (stored as JSON in saturn_images TEXT)
  saturnImages?: string[];
  // Saturn-specific: full verbose log (stdout+stderr) aggregated by Node
  saturnLog?: string | null;
  // Saturn-specific: optional compressed NDJSON/JSON event trace
  saturnEvents?: string | null;
  // Saturn-specific: boolean indicating if puzzle was solved correctly
  saturnSuccess?: boolean | null;
  // Solver mode validation fields
  predictedOutputGrid?: number[][] | null;
  isPredictionCorrect?: boolean | null;
  predictionAccuracyScore?: number | null;
  // Analysis parameters used to generate this explanation
  temperature?: number | null;
  reasoningEffort?: string | null;
  reasoningVerbosity?: string | null;
  reasoningSummaryType?: string | null;
  // Token usage and cost tracking
  inputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  totalTokens?: number | null;
  estimatedCost?: number | null;
}

/**
 * Interface for feedback on explanations
 */
interface ExplanationFeedback {
  explanationId: number;
  voteType: 'helpful' | 'not_helpful';
  comment?: string | null;
}

// PostgreSQL connection pool
let pool: Pool | null = null;

// Initialize the database connection
const initDb = async () => {
  // Check if we have a DATABASE_URL from Railway
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    logger.info('No DATABASE_URL found in environment variables. Running in memory-only mode.', 'database');
    return false;
  }
  
  try {
    pool = new Pool({ connectionString });
    
    // Test connection
    const client = await pool.connect();
    logger.info('Successfully connected to PostgreSQL database');
    client.release();
    
    // Create tables if they don't exist
    await createTablesIfNotExist();
    
    return true;
  } catch (error) {
    logger.error(`Error connecting to database: ${error instanceof Error ? error.message : String(error)}`);
    pool = null;
    return false;
  }
};

// Create required tables if they don't exist
const createTablesIfNotExist = async () => {
  if (!pool) return;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Explanations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS explanations (
        id SERIAL PRIMARY KEY,
        puzzle_id TEXT NOT NULL,
        pattern_description TEXT,
        solving_strategy TEXT,
        hints TEXT[],
        alien_meaning TEXT,
        confidence INTEGER,
        alien_meaning_confidence INTEGER,
        model_name TEXT,
        reasoning_log TEXT,
        has_reasoning_log BOOLEAN DEFAULT FALSE,
        -- Responses API fields
        provider_response_id TEXT,
        provider_raw_response JSONB,
        reasoning_items JSONB,
        api_processing_time_ms INTEGER,
        saturn_images TEXT,
        -- New columns for Saturn verbose persistence
        saturn_log TEXT,
        saturn_events TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- NOTE: Additional columns added via migration 001_explanations_columns.sql
      -- Schema modifications have been moved to proper migration files for production safety
    `);
    logger.info('Explanations table created or already exists', 'database');
    
    // Feedback table
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        explanation_id INTEGER REFERENCES explanations(id),
        vote_type VARCHAR CHECK (vote_type IN ('helpful', 'not_helpful')),
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Saturn log table - stores solver session metadata
    await client.query(`
      CREATE TABLE IF NOT EXISTS saturn_log (
        id SERIAL PRIMARY KEY,
        request_id VARCHAR(100) NOT NULL UNIQUE,
        explanation_id INTEGER REFERENCES explanations(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed'
        total_events INTEGER DEFAULT 0,
        session_data JSONB -- metadata about the solver session
      )
    `);

    // Saturn events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saturn_events (
        id SERIAL PRIMARY KEY,
        saturn_log_id INTEGER REFERENCES saturn_log(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL, -- e.g., 'api_call_start', 'api_call_end'
        timestamp TIMESTAMP NOT NULL,
        provider VARCHAR(50),
        model VARCHAR(100),
        phase VARCHAR(50),
        request_id VARCHAR(100),
        data JSONB -- compressed event details
      )
    `);

    // Batch testing tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS batch_runs (
        id SERIAL PRIMARY KEY,
        status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'stopped', 'error')),
        model VARCHAR(50) NOT NULL,
        dataset_path VARCHAR(200) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        total_puzzles INTEGER NOT NULL,
        processed_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        average_accuracy DECIMAL(5,2),
        total_processing_time_ms BIGINT DEFAULT 0,
        config JSONB -- stores rate limiting, retry settings, etc.
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS batch_results (
        id SERIAL PRIMARY KEY,
        batch_run_id INTEGER REFERENCES batch_runs(id) ON DELETE CASCADE,
        puzzle_id VARCHAR(50) NOT NULL,
        explanation_id INTEGER REFERENCES explanations(id),
        processing_time_ms INTEGER,
        accuracy_score DECIMAL(5,2),
        success BOOLEAN NOT NULL,
        error_message TEXT,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    logger.info('Database tables created or confirmed', 'database');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error creating tables: ${error instanceof Error ? error.message : String(error)}`, 'database');
  } finally {
    client.release();
  }
};

/**
 * Save an explanation to the database
 * 
 * @param puzzleId The ID of the puzzle being explained
 * @param explanation The explanation data object
 * @returns The ID of the saved explanation or null if in memory-only mode
 */
const saveExplanation = async (puzzleId: string, explanation: PuzzleExplanation): Promise<number | null> => {
  // If no database connection, return null
  if (!pool) {
    logger.info('No database connection. Skipping explanation save.', 'database');
    return null;
  }
  
  const client = await pool.connect();
  try {
    // Extract fields from explanation
    const {
      patternDescription,
      solvingStrategy,
      hints: rawHints,
      alienMeaning,
      confidence,
      alienMeaningConfidence,
      modelName,
      reasoningLog,
      hasReasoningLog,
      providerResponseId,
      providerRawResponse,
      reasoningItems,
      apiProcessingTimeMs,
      saturnImages,
      temperature,
      reasoningEffort,
      reasoningVerbosity,
      reasoningSummaryType,
      inputTokens,
      outputTokens,
      reasoningTokens,
      totalTokens,
      estimatedCost
    } = explanation;
    
    // Ensure hints is always an array of strings
    const hints = Array.isArray(rawHints) 
      ? rawHints.filter(hint => typeof hint === 'string')
      : typeof rawHints === 'string' 
        ? [rawHints] 
        : [];
    
    // Dev=Prod parity: default to true when unset (can be explicitly disabled with 'false')
    const rawFlag = process.env.RAW_RESPONSE_PERSIST;
    const shouldPersistRaw = rawFlag === undefined ? true : rawFlag === 'true';

    const result = await client.query(
      `INSERT INTO explanations 
       (puzzle_id, pattern_description, solving_strategy, hints,
        confidence, alien_meaning_confidence, alien_meaning, model_name,
        reasoning_log, has_reasoning_log,
        provider_response_id, provider_raw_response, reasoning_items,
        api_processing_time_ms, saturn_images,
        saturn_log, saturn_events, saturn_success,
        predicted_output_grid, is_prediction_correct, prediction_accuracy_score,
        temperature, reasoning_effort, reasoning_verbosity, reasoning_summary_type,
        input_tokens, output_tokens, reasoning_tokens, total_tokens, estimated_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
       RETURNING id`,
      [
        puzzleId,
        patternDescription || '',
        solvingStrategy || '',
        hints || [],
        normalizeConfidence(confidence),
        alienMeaningConfidence ? normalizeConfidence(alienMeaningConfidence) : null,
        alienMeaning || '',
        modelName || 'unknown',
        reasoningLog || null,
        hasReasoningLog || false,
        providerResponseId || null,
        shouldPersistRaw ? (providerRawResponse ?? null) : null,
        reasoningItems ? JSON.stringify(reasoningItems) : null,
        apiProcessingTimeMs || null,
        saturnImages && saturnImages.length > 0 ? JSON.stringify(saturnImages) : null,
        explanation.saturnLog || null,
        explanation.saturnEvents || null,
        explanation.saturnSuccess ?? null,
        explanation.predictedOutputGrid ? JSON.stringify(explanation.predictedOutputGrid) : null,
        explanation.isPredictionCorrect ?? null,
        explanation.predictionAccuracyScore ?? null,
        temperature ?? null,
        reasoningEffort || null,
        reasoningVerbosity || null,
        reasoningSummaryType || null,
        inputTokens ?? null,
        outputTokens ?? null,
        reasoningTokens ?? null,
        totalTokens ?? null,
        estimatedCost ?? null
      ]
    );
    
    logger.info(`Saved explanation for puzzle ${puzzleId} with ID ${result.rows[0].id}`, 'database');
    return result.rows[0].id;
  } catch (error) {
    logger.error(`Error saving explanation: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Add feedback for an explanation
 * 
 * @param explanationId The ID of the explanation being rated
 * @param voteType Either 'helpful' or 'not_helpful'
 * @param comment Optional comment text
 * @returns The ID of the created feedback or null if in memory-only mode
 */
const addFeedback = async (
  explanationId: number,
  voteType: 'helpful' | 'not_helpful',
  comment?: string | null
): Promise<number | null> => {
  // If no database connection, return null
  if (!pool) {
    logger.info('No database connection. Skipping feedback save.', 'database');
    return null;
  }
  
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO feedback (explanation_id, vote_type, comment)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [explanationId, voteType, comment || null]
    );
    
    logger.info(`Added feedback for explanation ${explanationId} with ID ${result.rows[0].id}`, 'database');
    return result.rows[0].id;
  } catch (error) {
    logger.error(`Error adding feedback: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get explanation for a puzzle
 * 
 * @param puzzleId The ID of the puzzle
 * @returns The explanation data with feedback stats or null if not found
 */
const getExplanationForPuzzle = async (puzzleId: string) => {
  // If no database connection, return null
  if (!pool) {
    logger.info('No database connection. Cannot retrieve explanation.', 'database');
    return null;
  }
  
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
         e.id,
         e.puzzle_id               AS "puzzleId",
         e.pattern_description     AS "patternDescription",
         e.solving_strategy        AS "solvingStrategy",
         e.hints                   AS "hints",
         e.alien_meaning           AS "alienMeaning",
         e.confidence              AS "confidence",
         e.alien_meaning_confidence AS "alienMeaningConfidence",
         e.model_name              AS "modelName",
         e.reasoning_log           AS "reasoningLog",
         e.has_reasoning_log       AS "hasReasoningLog",
         e.api_processing_time_ms  AS "apiProcessingTimeMs",
         e.saturn_images           AS "saturnImages",
         e.saturn_log              AS "saturnLog",
         e.saturn_events           AS "saturnEvents",
         e.created_at              AS "createdAt",
         (SELECT COUNT(*) FROM feedback WHERE explanation_id = e.id AND vote_type = 'helpful')      AS "helpful_votes",
         (SELECT COUNT(*) FROM feedback WHERE explanation_id = e.id AND vote_type = 'not_helpful') AS "not_helpful_votes",
         (SELECT json_agg(json_build_object('id', f.id, 'vote_type', f.vote_type, 'comment', f.comment, 'created_at', f.created_at))
          FROM feedback f
          WHERE f.explanation_id = e.id AND f.comment IS NOT NULL
          ORDER BY f.created_at DESC
          LIMIT 5)
         AS "recent_comments"
       FROM explanations e
       WHERE e.puzzle_id = $1
       ORDER BY e.created_at DESC
       LIMIT 1`,
      [puzzleId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error(`Error getting explanation: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Check if an explanation exists for a puzzle
 * 
 * @param puzzleId The ID of the puzzle
 * @returns Boolean indicating if an explanation exists
 */
const hasExplanation = async (puzzleId: string): Promise<boolean> => {
  // If no database connection, return false
  if (!pool) {
    logger.info('No database connection. Cannot check for explanation.', 'database');
    return false;
  }
  
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT EXISTS(SELECT 1 FROM explanations WHERE puzzle_id = $1)',
      [puzzleId]
    );
    
    const exists = result.rows[0].exists;
    logger.info(`Checked existence for puzzle ${puzzleId}: ${exists}`, 'database');
    return exists;
  } catch (error) {
    logger.error(`Error checking for explanation: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return false;
  } finally {
    client.release();
  }
};

/**
 * Get explanation status for multiple puzzles in a single query - optimizes performance
 * 
 * @param puzzleIds Array of puzzle IDs to check
 * @returns Map of puzzle ID to explanation data (hasExplanation, explanationId, feedbackCount)
 */
const getBulkExplanationStatus = async (puzzleIds: string[]) => {
  if (!pool || puzzleIds.length === 0) {
    logger.info('No database connection or empty puzzle list. Cannot retrieve bulk explanation status.', 'database');
    return new Map();
  }

  const client = await pool.connect();
  try {
    // Create a map to store results
    const resultMap = new Map();
    
    // Initialize all puzzles as having no explanation
    puzzleIds.forEach(id => {
      resultMap.set(id, {
        hasExplanation: false,
        explanationId: undefined,
        feedbackCount: 0
      });
    });

    // Get explanation data for puzzles that have explanations
    const result = await client.query(
      `SELECT 
         e.puzzle_id,
         e.id as explanation_id,
         (SELECT COUNT(*) FROM feedback WHERE explanation_id = e.id AND vote_type = 'helpful') +
         (SELECT COUNT(*) FROM feedback WHERE explanation_id = e.id AND vote_type = 'not_helpful') AS feedback_count
       FROM explanations e
       WHERE e.puzzle_id = ANY($1)
       AND e.id IN (
         SELECT MAX(id) FROM explanations 
         WHERE puzzle_id = ANY($1) 
         GROUP BY puzzle_id
       )`,
      [puzzleIds]
    );

    // Update the map with actual explanation data
    result.rows.forEach(row => {
      resultMap.set(row.puzzle_id, {
        hasExplanation: true,
        explanationId: row.explanation_id,
        feedbackCount: parseInt(row.feedback_count) || 0
      });
    });

    logger.info(`Retrieved bulk explanation status for ${puzzleIds.length} puzzles, ${result.rows.length} have explanations`, 'database');
    return resultMap;
  } catch (error) {
    logger.error(`Error getting bulk explanation status: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return new Map();
  } finally {
    client.release();
  }
};

/**
 * Get all explanations for a puzzle  Gemini 2.5 Pro 
 * 
 * @param puzzleId The ID of the puzzle
 * @returns An array of explanation data with feedback stats or null if not found
 */
const getExplanationsForPuzzle = async (puzzleId: string) => {
  if (!pool) {
    logger.info('No database connection. Cannot retrieve explanations.', 'database');
    return null;
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
         e.id,
         e.puzzle_id               AS "puzzleId",
         e.pattern_description     AS "patternDescription",
         e.solving_strategy        AS "solvingStrategy",
         e.hints                   AS "hints",
         e.alien_meaning           AS "alienMeaning",
         e.confidence              AS "confidence",
         e.alien_meaning_confidence AS "alienMeaningConfidence",
         e.model_name              AS "modelName",
         e.reasoning_log           AS "reasoningLog",
         e.has_reasoning_log       AS "hasReasoningLog",
         e.api_processing_time_ms  AS "apiProcessingTimeMs",
         e.saturn_images           AS "saturnImages",
         e.saturn_log              AS "saturnLog",
         e.saturn_events           AS "saturnEvents",
         e.saturn_success          AS "saturnSuccess",
         e.predicted_output_grid   AS "predictedOutputGrid",
         e.is_prediction_correct   AS "isPredictionCorrect",
         e.prediction_accuracy_score AS "predictionAccuracyScore",
         e.temperature             AS "temperature",
         e.reasoning_effort        AS "reasoningEffort",
         e.reasoning_verbosity     AS "reasoningVerbosity",
         e.reasoning_summary_type  AS "reasoningSummaryType",
         e.input_tokens            AS "inputTokens",
         e.output_tokens           AS "outputTokens",
         e.reasoning_tokens        AS "reasoningTokens",
         e.total_tokens            AS "totalTokens",
         e.estimated_cost          AS "estimatedCost",
         e.created_at              AS "createdAt",
         (SELECT COUNT(*) FROM feedback WHERE explanation_id = e.id AND vote_type = 'helpful')      AS "helpful_votes",
         (SELECT COUNT(*) FROM feedback WHERE explanation_id = e.id AND vote_type = 'not_helpful') AS "not_helpful_votes"
       FROM explanations e
       WHERE e.puzzle_id = $1
       ORDER BY e.created_at DESC`,
      [puzzleId]
    );

    // Parse JSON fields for Saturn data and validation
    const processedRows = result.rows.map(row => ({
      ...row,
      saturnImages: row.saturnImages ? JSON.parse(row.saturnImages) : null,
      predictedOutputGrid: row.predictedOutputGrid ? JSON.parse(row.predictedOutputGrid) : null,
    }));
    
    return processedRows.length > 0 ? processedRows : [];
  } catch (error) {
    logger.error(`Error getting explanations for puzzle ${puzzleId}: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get a specific explanation by ID
 * 
 * @param explanationId The ID of the explanation to retrieve
 * @returns The explanation data or null if not found
 */
const getExplanationById = async (explanationId: number) => {
  if (!pool) {
    logger.info('No database connection. Cannot retrieve explanation.', 'database');
    return null;
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
         e.id,
         e.puzzle_id               AS "puzzleId",
         e.pattern_description     AS "patternDescription",
         e.solving_strategy        AS "solvingStrategy",
         e.hints                   AS "hints",
         e.alien_meaning           AS "alienMeaning",
         e.confidence              AS "confidence",
         e.alien_meaning_confidence AS "alienMeaningConfidence",
         e.model_name              AS "modelName",
         e.reasoning_log           AS "reasoningLog",
         e.has_reasoning_log       AS "hasReasoningLog",
         e.api_processing_time_ms  AS "apiProcessingTimeMs",
         e.saturn_images           AS "saturnImages",
         e.saturn_log              AS "saturnLog",
         e.saturn_events           AS "saturnEvents",
         e.saturn_success          AS "saturnSuccess",
         e.predicted_output_grid   AS "predictedOutputGrid",
         e.is_prediction_correct   AS "isPredictionCorrect",
         e.prediction_accuracy_score AS "predictionAccuracyScore",
         e.created_at              AS "createdAt"
       FROM explanations e
       WHERE e.id = $1`,
      [explanationId]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      // Parse JSON fields for Saturn data and validation
      return {
        ...row,
        saturnImages: row.saturnImages ? JSON.parse(row.saturnImages) : null,
        predictedOutputGrid: row.predictedOutputGrid ? JSON.parse(row.predictedOutputGrid) : null,
      };
    }
    return null;
  } catch (error) {
    logger.error(`Error getting explanation by ID ${explanationId}: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get feedback for a specific explanation
 * 
 * @param explanationId The ID of the explanation
 * @returns Array of feedback or empty array if none found
 */
const getFeedbackForExplanation = async (explanationId: number): Promise<Feedback[]> => {
  if (!pool) {
    logger.info('No database connection. Cannot retrieve feedback.', 'database');
    return [];
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
         f.id,
         f.explanation_id AS "explanationId",
         f.vote_type AS "voteType",
         f.comment,
         f.created_at AS "createdAt"
       FROM feedback f
       WHERE f.explanation_id = $1
       ORDER BY f.created_at DESC`,
      [explanationId]
    );

    logger.info(`Retrieved ${result.rows.length} feedback items for explanation ${explanationId}`, 'database');
    return result.rows;
  } catch (error) {
    logger.error(`Error getting feedback for explanation: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get feedback for a specific puzzle (all explanations for that puzzle)
 * 
 * @param puzzleId The ID of the puzzle
 * @returns Array of detailed feedback with explanation context
 */
const getFeedbackForPuzzle = async (puzzleId: string): Promise<DetailedFeedback[]> => {
  if (!pool) {
    logger.info('No database connection. Cannot retrieve feedback.', 'database');
    return [];
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
         f.id,
         f.explanation_id AS "explanationId",
         f.vote_type AS "voteType",
         f.comment,
         f.created_at AS "createdAt",
         e.puzzle_id AS "puzzleId",
         e.model_name AS "modelName",
         e.confidence,
         e.pattern_description AS "patternDescription"
       FROM feedback f
       JOIN explanations e ON f.explanation_id = e.id
       WHERE e.puzzle_id = $1
       ORDER BY f.created_at DESC`,
      [puzzleId]
    );

    logger.info(`Retrieved ${result.rows.length} feedback items for puzzle ${puzzleId}`, 'database');
    return result.rows;
  } catch (error) {
    logger.error(`Error getting feedback for puzzle: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get all feedback with optional filtering
 * 
 * @param filters Filtering options
 * @returns Array of detailed feedback with explanation context
 */
const getAllFeedback = async (filters: FeedbackFilters = {}): Promise<DetailedFeedback[]> => {
  if (!pool) {
    logger.info('No database connection. Cannot retrieve feedback.', 'database');
    return [];
  }

  const client = await pool.connect();
  try {
    let query = `
      SELECT 
        f.id,
        f.explanation_id AS "explanationId",
        f.vote_type AS "voteType",
        f.comment,
        f.created_at AS "createdAt",
        e.puzzle_id AS "puzzleId",
        e.model_name AS "modelName",
        e.confidence,
        e.pattern_description AS "patternDescription"
      FROM feedback f
      JOIN explanations e ON f.explanation_id = e.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramCount = 0;

    // Apply filters
    if (filters.puzzleId) {
      query += ` AND e.puzzle_id = $${++paramCount}`;
      queryParams.push(filters.puzzleId);
    }

    if (filters.modelName) {
      query += ` AND e.model_name = $${++paramCount}`;
      queryParams.push(filters.modelName);
    }

    if (filters.voteType) {
      query += ` AND f.vote_type = $${++paramCount}`;
      queryParams.push(filters.voteType);
    }

    if (filters.startDate) {
      query += ` AND f.created_at >= $${++paramCount}`;
      queryParams.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND f.created_at <= $${++paramCount}`;
      queryParams.push(filters.endDate);
    }

    query += ` ORDER BY f.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${++paramCount}`;
      queryParams.push(filters.limit);
    }

    if (filters.offset) {
      query += ` OFFSET $${++paramCount}`;
      queryParams.push(filters.offset);
    }

    const result = await client.query(query, queryParams);

    logger.info(`Retrieved ${result.rows.length} feedback items with filters`, 'database');
    return result.rows;
  } catch (error) {
    logger.error(`Error getting filtered feedback: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get feedback summary statistics
 * 
 * @returns Feedback statistics object
 */
const getFeedbackSummaryStats = async (): Promise<FeedbackStats> => {
  if (!pool) {
    logger.info('No database connection. Cannot retrieve feedback stats.', 'database');
    return {
      totalFeedback: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
      helpfulPercentage: 0,
      notHelpfulPercentage: 0,
      feedbackByModel: {},
      feedbackByDay: []
    };
  }

  const client = await pool.connect();
  try {
    // Get total counts
    const totalResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN vote_type = 'helpful' THEN 1 END) as helpful,
        COUNT(CASE WHEN vote_type = 'not_helpful' THEN 1 END) as not_helpful
      FROM feedback
    `);

    const total = parseInt(totalResult.rows[0].total);
    const helpful = parseInt(totalResult.rows[0].helpful);
    const notHelpful = parseInt(totalResult.rows[0].not_helpful);

    // Get feedback by model
    const modelResult = await client.query(`
      SELECT 
        e.model_name,
        COUNT(CASE WHEN f.vote_type = 'helpful' THEN 1 END) as helpful,
        COUNT(CASE WHEN f.vote_type = 'not_helpful' THEN 1 END) as not_helpful
      FROM feedback f
      JOIN explanations e ON f.explanation_id = e.id
      GROUP BY e.model_name
    `);

    const feedbackByModel: Record<string, { helpful: number; notHelpful: number }> = {};
    modelResult.rows.forEach(row => {
      feedbackByModel[row.model_name] = {
        helpful: parseInt(row.helpful),
        notHelpful: parseInt(row.not_helpful)
      };
    });

    // Get feedback by day (last 30 days)
    const dailyResult = await client.query(`
      SELECT 
        DATE(f.created_at) as date,
        COUNT(CASE WHEN f.vote_type = 'helpful' THEN 1 END) as helpful,
        COUNT(CASE WHEN f.vote_type = 'not_helpful' THEN 1 END) as not_helpful
      FROM feedback f
      WHERE f.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(f.created_at)
      ORDER BY date DESC
    `);

    const feedbackByDay = dailyResult.rows.map(row => ({
      date: row.date,
      helpful: parseInt(row.helpful),
      notHelpful: parseInt(row.not_helpful)
    }));

    const stats: FeedbackStats = {
      totalFeedback: total,
      helpfulCount: helpful,
      notHelpfulCount: notHelpful,
      helpfulPercentage: total > 0 ? Math.round((helpful / total) * 100) : 0,
      notHelpfulPercentage: total > 0 ? Math.round((notHelpful / total) * 100) : 0,
      feedbackByModel,
      feedbackByDay
    };

    logger.info(`Retrieved feedback stats: ${total} total feedback items`, 'database');
    return stats;
  } catch (error) {
    logger.error(`Error getting feedback stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get solver mode accuracy statistics for leaderboards
 * 
 * @returns Object containing accuracy stats by model
 */
const getAccuracyStats = async () => {
  if (!pool) {
    logger.info('No database connection. Cannot retrieve accuracy stats.', 'database');
    return { accuracyByModel: [], totalSolverAttempts: 0 };
  }

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        model_name,
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN is_prediction_correct = true THEN 1 END) as correct_predictions,
        AVG(CASE WHEN prediction_accuracy_score IS NOT NULL THEN prediction_accuracy_score ELSE 0 END) as avg_accuracy_score,
        AVG(CASE WHEN confidence IS NOT NULL THEN confidence ELSE 50 END) as avg_confidence,
        COUNT(CASE WHEN predicted_output_grid IS NOT NULL THEN 1 END) as successful_extractions
      FROM explanations 
      WHERE is_prediction_correct IS NOT NULL
      GROUP BY model_name
      ORDER BY avg_accuracy_score DESC, correct_predictions DESC
    `);

    const totalResult = await client.query(`
      SELECT COUNT(*) as total_solver_attempts
      FROM explanations 
      WHERE is_prediction_correct IS NOT NULL
    `);

    const accuracyByModel = result.rows.map(row => ({
      modelName: row.model_name,
      totalAttempts: parseInt(row.total_attempts),
      correctPredictions: parseInt(row.correct_predictions),
      accuracyPercentage: row.total_attempts > 0 ? Math.round((row.correct_predictions / row.total_attempts) * 100) : 0,
      avgAccuracyScore: parseFloat(row.avg_accuracy_score) || 0,
      avgConfidence: Math.round(parseFloat(row.avg_confidence) || 50),
      successfulExtractions: parseInt(row.successful_extractions),
      extractionSuccessRate: row.total_attempts > 0 ? Math.round((row.successful_extractions / row.total_attempts) * 100) : 0
    }));

    logger.info(`Retrieved accuracy stats for ${accuracyByModel.length} models`, 'database');
    
    return {
      accuracyByModel,
      totalSolverAttempts: parseInt(totalResult.rows[0].total_solver_attempts) || 0
    };
  } catch (error) {
    logger.error(`Error retrieving accuracy stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return { accuracyByModel: [], totalSolverAttempts: 0 };
  } finally {
    client.release();
  }
};

// Batch testing database operations
const createBatchRun = async (model: string, datasetPath: string, totalPuzzles: number, config: any = {}) => {
  if (!pool) {
    logger.info('No database connection. Cannot create batch run.', 'database');
    return null;
  }
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO batch_runs (status, model, dataset_path, total_puzzles, config) 
       VALUES ('running', $1, $2, $3, $4) RETURNING *`,
      [model, datasetPath, totalPuzzles, JSON.stringify(config)]
    );
    logger.info(`Created batch run ${result.rows[0].id} for ${totalPuzzles} puzzles with model ${model}`, 'database');
    return result.rows[0];
  } finally {
    client.release();
  }
};

const updateBatchRun = async (id: number, updates: Partial<{ status: string; processed_count: number; success_count: number; error_count: number; average_accuracy: number; total_processing_time_ms: number; completed_at: Date }>) => {
  if (!pool) {
    logger.info('No database connection. Cannot update batch run.', 'database');
    return null;
  }
  const client = await pool.connect();
  try {
    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [id, ...Object.values(updates)];
    
    const result = await client.query(
      `UPDATE batch_runs SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

const getBatchRun = async (id: number) => {
  if (!pool) {
    logger.info('No database connection. Cannot retrieve batch run.', 'database');
    return null;
  }
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM batch_runs WHERE id = $1', [id]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

const getAllBatchRuns = async (limit = 50, offset = 0) => {
  if (!pool) {
    logger.info('No database connection. Cannot retrieve batch runs.', 'database');
    return [];
  }
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM batch_runs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  } finally {
    client.release();
  }
};

const addBatchResult = async (batchRunId: number, puzzleId: string, explanationId: number | null, processingTimeMs: number, accuracyScore: number | null, success: boolean, errorMessage: string | null = null) => {
  if (!pool) {
    logger.info('No database connection. Cannot add batch result.', 'database');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO batch_results (batch_run_id, puzzle_id, explanation_id, processing_time_ms, accuracy_score, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [batchRunId, puzzleId, explanationId, processingTimeMs, accuracyScore, success, errorMessage]
    );
  } finally {
    client.release();
  }
};

const getBatchResults = async (batchRunId: number) => {
  if (!pool) {
    logger.info('No database connection. Cannot retrieve batch results.', 'database');
    return [];
  }
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT br.*, e.pattern_description, e.confidence 
       FROM batch_results br 
       LEFT JOIN explanations e ON br.explanation_id = e.id 
       WHERE br.batch_run_id = $1 
       ORDER BY br.processed_at ASC`,
      [batchRunId]
    );
    return result.rows;
  } finally {
    client.release();
  }
};

/**
 * Create a new Saturn solver session log
 * @param requestId Unique identifier for the solver session
 * @param explanationId Optional link to explanation being processed
 * @returns Saturn log ID
 */
const createSaturnLog = async (requestId: string, explanationId?: number): Promise<number> => {
  if (!pool) {
    throw new Error('No database connection available');
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO saturn_log (request_id, explanation_id, status, session_data)
       VALUES ($1, $2, 'running', $3)
       RETURNING id`,
      [requestId, explanationId || null, JSON.stringify({ started_at: new Date().toISOString() })]
    );

    const logId = result.rows[0].id;
    logger.info(`Created Saturn log session: ${requestId} (ID: ${logId})`, 'database');
    return logId;
  } catch (error) {
    logger.error(`Failed to create Saturn log: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Add an event to a Saturn solver session
 * @param saturnLogId The saturn_log ID
 * @param eventType Type of event (e.g., 'api_call_start', 'image_generated', 'solve_complete')
 * @param data Event data
 * @param provider Optional provider name
 * @param model Optional model name
 * @param phase Optional phase identifier
 * @param requestId Optional request identifier
 */
const addSaturnEvent = async (
  saturnLogId: number,
  eventType: string,
  data: any,
  provider?: string,
  model?: string,
  phase?: string,
  requestId?: string
): Promise<void> => {
  if (!pool) {
    throw new Error('No database connection available');
  }

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO saturn_events (saturn_log_id, event_type, timestamp, provider, model, phase, request_id, data)
       VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7)`,
      [saturnLogId, eventType, provider, model, phase, requestId, JSON.stringify(data)]
    );

    // Update event counter in saturn_log
    await client.query(
      `UPDATE saturn_log SET total_events = total_events + 1, updated_at = NOW() WHERE id = $1`,
      [saturnLogId]
    );

    logger.debug(`Added Saturn event: ${eventType} to session ${saturnLogId}`, 'database');
  } catch (error) {
    logger.error(`Failed to add Saturn event: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Complete a Saturn solver session
 * @param saturnLogId The saturn_log ID
 * @param status Final status ('completed' or 'failed')
 * @param finalData Optional final session data
 */
const completeSaturnLog = async (saturnLogId: number, status: 'completed' | 'failed', finalData?: any): Promise<void> => {
  if (!pool) {
    throw new Error('No database connection available');
  }

  const client = await pool.connect();
  try {
    const sessionData = finalData ? JSON.stringify({
      ...finalData,
      completed_at: new Date().toISOString()
    }) : null;

    await client.query(
      `UPDATE saturn_log 
       SET status = $1, updated_at = NOW(), session_data = COALESCE($2, session_data)
       WHERE id = $3`,
      [status, sessionData, saturnLogId]
    );

    logger.info(`Completed Saturn log session ${saturnLogId} with status: ${status}`, 'database');
  } catch (error) {
    logger.error(`Failed to complete Saturn log: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get Saturn solver session with all events
 * @param requestId The request ID to look up
 * @returns Saturn log with events
 */
const getSaturnSession = async (requestId: string): Promise<any> => {
  if (!pool) {
    throw new Error('No database connection available');
  }

  const client = await pool.connect();
  try {
    // Get log details
    const logResult = await client.query(
      `SELECT * FROM saturn_log WHERE request_id = $1`,
      [requestId]
    );

    if (logResult.rows.length === 0) {
      return null;
    }

    const log = logResult.rows[0];

    // Get all events for this session
    const eventsResult = await client.query(
      `SELECT * FROM saturn_events WHERE saturn_log_id = $1 ORDER BY timestamp ASC`,
      [log.id]
    );

    return {
      ...log,
      events: eventsResult.rows
    };
  } catch (error) {
    logger.error(`Failed to get Saturn session: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  } finally {
    client.release();
  }
};

// Export the database service
export const dbService = {
  init: initDb,
  saveExplanation,
  addFeedback,
  getExplanationForPuzzle,
  getExplanationsForPuzzle,
  getExplanationById,
  hasExplanation,
  getBulkExplanationStatus,
  // New feedback retrieval methods
  getFeedbackForExplanation,
  getFeedbackForPuzzle,
  getAllFeedback,
  getFeedbackSummaryStats,
  // Solver mode accuracy stats
  getAccuracyStats,
  // Batch testing methods
  createBatchRun,
  updateBatchRun,
  getBatchRun,
  getAllBatchRuns,
  addBatchResult,
  getBatchResults,
  // Saturn solver session management
  createSaturnLog,
  addSaturnEvent,
  completeSaturnLog,
  getSaturnSession,
  // Helpers
  isConnected: () => !!pool,
};
