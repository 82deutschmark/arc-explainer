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
import { repositoryService } from '../repositories/RepositoryService.ts';

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
    // REMOVED: All table creation moved to DatabaseSchema.ts to prevent duplication
    // Use centralized schema management instead
    const { DatabaseSchema } = await import('../repositories/database/DatabaseSchema.js');
    await DatabaseSchema.createTablesIfNotExist(pool);

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
 * REFACTORED: Now delegates to repositoryService
 */
const saveExplanation = async (puzzleId: string, explanation: any): Promise<number | null> => {
  try {
    // Add puzzleId to explanation data for repository
    const explanationData = { ...explanation, puzzleId };
    const result = await repositoryService.explanations.saveExplanation(explanationData);
    return result.id;
  } catch (error) {
    logger.error(`Error in dbService.saveExplanation for puzzle ${puzzleId}: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return null;
  }
};

/**
 * Get single explanation for a puzzle
 * REFACTORED: Now delegates to repositoryService
 */
const getExplanationForPuzzle = async (puzzleId: string) => {
  return await repositoryService.explanations.getExplanationForPuzzle(puzzleId);
};

/**
 * Get all explanations for a puzzle
 * REFACTORED: Now delegates to repositoryService
 */
const getExplanationsForPuzzle = async (puzzleId: string) => {
  return await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
};

/**
 * Get explanation by ID
 * REFACTORED: Now delegates to repositoryService
 */
const getExplanationById = async (explanationId: number) => {
  return await repositoryService.explanations.getExplanationById(explanationId);
};

/**
 * Check if explanation exists for puzzle
 * REFACTORED: Now delegates to repositoryService
 */
const hasExplanation = async (puzzleId: string): Promise<boolean> => {
  return await repositoryService.explanations.hasExplanation(puzzleId);
};

/**
 * Get bulk explanation status for multiple puzzles with detailed metadata
 * REFACTORED: Now delegates to repositoryService
 */
const getBulkExplanationStatus = async (puzzleIds: string[]) => {
  const statusMap = await repositoryService.explanations.getBulkExplanationStatus(puzzleIds);
  // Convert object to Map for backward compatibility
  const resultMap = new Map();
  Object.entries(statusMap).forEach(([puzzleId, status]) => {
    resultMap.set(puzzleId, status);
  });
  return resultMap;
};

/**
 * Add feedback for an explanation
 * REFACTORED: Now delegates to repositoryService
 */
const addFeedback = async (explanationId: number, voteType: 'helpful' | 'not_helpful', comment: string): Promise<boolean> => {
  try {
    const result = await repositoryService.feedback.addFeedback({ explanationId, voteType, comment });
    return result.success;
  } catch (error) {
    logger.error(`Error in dbService.addFeedback: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return false;
  }
};

/**
 * Get feedback for an explanation
 * REFACTORED: Now delegates to repositoryService
 */
const getFeedbackForExplanation = async (explanationId: number): Promise<Feedback[]> => {
  return await repositoryService.feedback.getFeedbackForExplanation(explanationId);
};

/**
 * Get feedback for a puzzle
 * REFACTORED: Now delegates to repositoryService
 */
const getFeedbackForPuzzle = async (puzzleId: string): Promise<DetailedFeedback[]> => {
  return await repositoryService.feedback.getFeedbackForPuzzle(puzzleId);
};

/**
 * Get all feedback with optional filters
 * REFACTORED: Now delegates to repositoryService
 */
const getAllFeedback = async (filters: FeedbackFilters = {}): Promise<DetailedFeedback[]> => {
  return await repositoryService.feedback.getAllFeedback(filters);
};

/**
 * Get feedback summary statistics
 * REFACTORED: Now delegates to repositoryService
 */
const getFeedbackSummaryStats = async (): Promise<FeedbackStats> => {
  return await repositoryService.feedback.getFeedbackSummaryStats();
};

/**
 * Check if database is connected
 */
const isConnected = () => {
  return pool !== null;
};

/**
 * Get accuracy statistics for solver mode
 * REFACTORED: Now delegates to repositoryService
 */
const getAccuracyStats = async () => {
  return await repositoryService.feedback.getAccuracyStats();
};

// Batch Analysis Functions (simplified implementations)

/**
 * REFACTORED: Now delegates to repositoryService
 */
const createBatchSession = async (sessionData: any) => {
  return await repositoryService.batchAnalysis.createBatchSession(sessionData);
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

const getAllBatchSessions = async () => {
  if (!pool) return [];

  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT * FROM batch_analysis_sessions ORDER BY created_at DESC`
    );
    return result.rows;
  } catch (error) {
    logger.error(`Error getting all batch sessions: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return [];
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
  getAllBatchSessions,
  createBatchResult,
  updateBatchResult,
  getBatchResults,
  isConnected
};