/**
 * Database service for Railway PostgreSQL integration
 * @author Cascade
 * 
 * Handles database operations for storing puzzle explanations and user feedback
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
  modelName: string;
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
        model_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
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
      modelName
    } = explanation;
    
    const result = await client.query(
      `INSERT INTO explanations 
       (puzzle_id, pattern_description, solving_strategy, hints,
        confidence, alien_meaning, model_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        puzzleId,
        patternDescription || '',
        solvingStrategy || '',
        hints || [],
        confidence || 0,
        alienMeaning || '',
        modelName || 'unknown'
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
      `SELECT e.*,
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = e.id AND vote_type = 'helpful') as helpful_votes,
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = e.id AND vote_type = 'not_helpful') as not_helpful_votes,
        (SELECT json_agg(json_build_object('id', f.id, 'vote_type', f.vote_type, 'comment', f.comment, 'created_at', f.created_at))
         FROM (
           SELECT * FROM feedback 
           WHERE explanation_id = e.id AND comment IS NOT NULL
           ORDER BY created_at DESC
           LIMIT 5
         ) AS f
        ) as recent_comments
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
      `SELECT e.*,
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = e.id AND vote_type = 'helpful') as helpful_votes,
        (SELECT COUNT(*) FROM feedback WHERE explanation_id = e.id AND vote_type = 'not_helpful') as not_helpful_votes
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

// Export the database service
export const dbService = {
  init: initDb,
  saveExplanation,
  addFeedback,
  getExplanationForPuzzle,
  getExplanationsForPuzzle, // Add new function here
  hasExplanation,
};
