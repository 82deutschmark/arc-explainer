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
  apiProcessingTimeMs?: number;
  // Saturn-specific: optional list of image paths (stored as JSON in saturn_images TEXT)
  saturnImages?: string[];
  // Saturn-specific: full verbose log (stdout+stderr) aggregated by Node
  saturnLog?: string | null;
  // Saturn-specific: optional compressed NDJSON/JSON event trace
  saturnEvents?: string | null;
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
        api_processing_time_ms INTEGER,
        saturn_images TEXT,
        -- New columns for Saturn verbose persistence
        saturn_log TEXT,
        saturn_events TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Add alien_meaning_confidence column if it doesn't exist
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'explanations' 
                     AND column_name = 'alien_meaning_confidence') 
        THEN
          ALTER TABLE explanations ADD COLUMN alien_meaning_confidence INTEGER;
        END IF;
        
        -- Add api_processing_time_ms column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'explanations' 
                     AND column_name = 'api_processing_time_ms') 
        THEN
          ALTER TABLE explanations ADD COLUMN api_processing_time_ms INTEGER;
        END IF;

        -- Add saturn_images column if it doesn't exist (stores JSON string of image paths)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'explanations' 
                     AND column_name = 'saturn_images') 
        THEN
          ALTER TABLE explanations ADD COLUMN saturn_images TEXT;
        END IF;

        -- Add saturn_log column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'explanations'
                     AND column_name = 'saturn_log')
        THEN
          ALTER TABLE explanations ADD COLUMN saturn_log TEXT;
        END IF;

        -- Add saturn_events column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'explanations'
                     AND column_name = 'saturn_events')
        THEN
          ALTER TABLE explanations ADD COLUMN saturn_events TEXT;
        END IF;
      END $$;
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
      hints,
      alienMeaning,
      confidence,
      alienMeaningConfidence,
      modelName,
      reasoningLog,
      hasReasoningLog,
      apiProcessingTimeMs,
      saturnImages
    } = explanation;
    
    const result = await client.query(
      `INSERT INTO explanations 
       (puzzle_id, pattern_description, solving_strategy, hints,
        confidence, alien_meaning_confidence, alien_meaning, model_name,
        reasoning_log, has_reasoning_log, api_processing_time_ms, saturn_images,
        saturn_log, saturn_events)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        puzzleId,
        patternDescription || '',
        solvingStrategy || '',
        hints || [],
        confidence || 0,
        alienMeaningConfidence || null,
        alienMeaning || '',
        modelName || 'unknown',
        reasoningLog || null,
        hasReasoningLog || false,
        apiProcessingTimeMs || null,
        saturnImages && saturnImages.length > 0 ? JSON.stringify(saturnImages) : null,
        explanation.saturnLog || null,
        explanation.saturnEvents || null
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
         e.created_at              AS "createdAt",
         (SELECT COUNT(*) FROM feedback WHERE explanation_id = e.id AND vote_type = 'helpful')      AS "helpful_votes",
         (SELECT COUNT(*) FROM feedback WHERE explanation_id = e.id AND vote_type = 'not_helpful') AS "not_helpful_votes"
       FROM explanations e
       WHERE e.puzzle_id = $1
       ORDER BY e.created_at DESC`,
      [puzzleId]
    );

    return result.rows.length > 0 ? result.rows : [];
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
         e.created_at              AS "createdAt"
       FROM explanations e
       WHERE e.id = $1`,
      [explanationId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error(`Error getting explanation by ID ${explanationId}: ${error instanceof Error ? error.message : String(error)}`, 'database');
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
  // Helpers
  isConnected: () => !!pool,
};
