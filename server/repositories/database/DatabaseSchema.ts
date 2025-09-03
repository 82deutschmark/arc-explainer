/**
 * Database Schema Management Utilities
 * 
 * Handles database initialization, table creation, and schema migrations.
 * Extracted from monolithic DbService for better organization and maintainability.
 * 
 * @author Claude
 * @date 2025-08-27
 */

import { Pool, PoolClient } from 'pg';
import { logger } from '../../utils/logger.ts';

export class DatabaseSchema {
  
  /**
   * Create all required tables with proper schema
   */
  static async createTablesIfNotExist(pool: Pool): Promise<void> {
    const client = await pool.connect();
    
    try {
      // Phase 0: Log current schema for debugging
      await this.logCurrentSchema(client);
      
      // Create explanations table with comprehensive schema
      await this.createExplanationsTable(client);
      
      // Create feedback table
      await this.createFeedbackTable(client);
      
      // Create batch analysis sessions table
      await this.createBatchSessionsTable(client);
      
      // Create batch analysis results table
      await this.createBatchResultsTable(client);
      
      // Apply any missing column migrations
      await this.applyMissingColumnMigrations(client);
      
      logger.info('All database tables verified and created if necessary', 'database');
      
    } catch (error) {
      logger.error(`Error creating database tables: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Log current schema for debugging purposes
   */
  private static async logCurrentSchema(client: PoolClient): Promise<void> {
    try {
      const schemaResult = await client.query(`
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
        ORDER BY column_name
      `);
      
      if (schemaResult.rows.length > 0) {
        logger.info('[DB Schema Snapshot] Current explanations table structure:', 'database');
        schemaResult.rows.forEach(row => {
          logger.info(`  ${row.column_name}: ${row.data_type}`, 'database');
        });
      }
    } catch (error) {
      logger.warn('Failed to retrieve schema snapshot - table may not exist yet', 'database');
    }
  }

  /**
   * Create explanations table with complete schema
   */
  private static async createExplanationsTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS explanations (
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
      )
    `);
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_explanations_puzzle_id 
      ON explanations(puzzle_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_explanations_model_name 
      ON explanations(model_name)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_explanations_created_at 
      ON explanations(created_at)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_explanations_has_reasoning_log 
      ON explanations(has_reasoning_log)
    `);
  }

  /**
   * Create feedback table
   */
  private static async createFeedbackTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        puzzle_id VARCHAR(255) DEFAULT NULL,
        explanation_id INTEGER DEFAULT NULL REFERENCES explanations(id) ON DELETE CASCADE,
        feedback_type VARCHAR(50) DEFAULT 'helpful' CHECK (feedback_type IN ('helpful', 'not_helpful', 'solution_explanation')),
        comment TEXT DEFAULT NULL,
        user_agent TEXT DEFAULT NULL,
        session_id VARCHAR(255) DEFAULT NULL,
        reference_feedback_id INTEGER DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_explanation_id 
      ON feedback(explanation_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_puzzle_id 
      ON feedback(puzzle_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_feedback_type 
      ON feedback(feedback_type)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_created_at 
      ON feedback(created_at)
    `);
  }

  /**
   * Create batch analysis sessions table
   */
  private static async createBatchSessionsTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS batch_analysis_sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        total_puzzles INTEGER NOT NULL DEFAULT 0,
        completed_puzzles INTEGER NOT NULL DEFAULT 0,
        successful_puzzles INTEGER NOT NULL DEFAULT 0,
        failed_puzzles INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        model_key VARCHAR(100) NOT NULL,
        dataset VARCHAR(100) NOT NULL,
        prompt_id VARCHAR(100) DEFAULT NULL,
        custom_prompt TEXT DEFAULT NULL,
        temperature FLOAT DEFAULT NULL,
        reasoning_effort VARCHAR(50) DEFAULT NULL,
        reasoning_verbosity VARCHAR(50) DEFAULT NULL,
        reasoning_summary_type VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
      )
    `);
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_batch_sessions_status 
      ON batch_analysis_sessions(status)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_batch_sessions_model_key 
      ON batch_analysis_sessions(model_key)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_batch_sessions_created_at 
      ON batch_analysis_sessions(created_at)
    `);
  }

  /**
   * Create batch analysis results table
   */
  private static async createBatchResultsTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS batch_analysis_results (
        session_id VARCHAR(255) NOT NULL REFERENCES batch_analysis_sessions(session_id) ON DELETE CASCADE,
        puzzle_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        explanation_id INTEGER DEFAULT NULL REFERENCES explanations(id) ON DELETE SET NULL,
        error TEXT DEFAULT NULL,
        processing_time_ms INTEGER DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        PRIMARY KEY (session_id, puzzle_id)
      )
    `);
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_batch_results_session_id 
      ON batch_analysis_results(session_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_batch_results_status 
      ON batch_analysis_results(status)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_batch_results_puzzle_id 
      ON batch_analysis_results(puzzle_id)
    `);
  }

  /**
   * Apply any missing column migrations
   */
  private static async applyMissingColumnMigrations(client: PoolClient): Promise<void> {
    try {
      // First, handle vote_type to feedback_type rename
      const voteTypeColumn = await client.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='feedback' AND column_name='vote_type'
      `);

      if (voteTypeColumn && voteTypeColumn.rowCount && voteTypeColumn.rowCount > 0) {
        const feedbackTypeColumn = await client.query(`
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='feedback' AND column_name='feedback_type'
        `);
        
        if (!feedbackTypeColumn || feedbackTypeColumn.rowCount === 0) {
          await client.query(`ALTER TABLE feedback RENAME COLUMN vote_type TO feedback_type;`);
          logger.info('Renamed vote_type to feedback_type.', 'database');
        } else {
          await client.query(`ALTER TABLE feedback DROP COLUMN vote_type;`);
          logger.info('Dropped legacy vote_type column as feedback_type already exists.', 'database');
        }
      }

      // Add missing columns to feedback table
      await client.query(`
        ALTER TABLE feedback 
        ADD COLUMN IF NOT EXISTS user_agent TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS session_id VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS puzzle_id VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS feedback_type VARCHAR(50) DEFAULT 'helpful',
        ADD COLUMN IF NOT EXISTS reference_feedback_id INTEGER DEFAULT NULL;
      `);
      
      // Populate puzzle_id from explanations table for existing records
      await client.query(`
        UPDATE feedback f
        SET puzzle_id = e.puzzle_id
        FROM explanations e
        WHERE f.explanation_id = e.id
          AND f.puzzle_id IS NULL;
      `);

      // Set default feedback_type for any NULL values
      await client.query(`
        UPDATE feedback 
        SET feedback_type = COALESCE(feedback_type, 'helpful') 
        WHERE feedback_type IS NULL;
      `);
      
      // Add constraint for feedback_type
      await client.query(`
        ALTER TABLE feedback 
        DROP CONSTRAINT IF EXISTS feedback_type_check;
      `);
      
      await client.query(`
        ALTER TABLE feedback 
        ADD CONSTRAINT feedback_type_check 
        CHECK (feedback_type IN ('helpful', 'not_helpful', 'solution_explanation'));
      `);

      // Make sure explanation_id and comment are nullable
      await client.query(`ALTER TABLE feedback ALTER COLUMN explanation_id DROP NOT NULL;`);
      await client.query(`ALTER TABLE feedback ALTER COLUMN comment DROP NOT NULL;`);
      
      logger.info('Successfully applied feedback table migrations', 'database');

      // Add updated_at column to batch_analysis_sessions if missing
      await client.query(`
        ALTER TABLE batch_analysis_sessions 
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      `);

      // Add system prompt tracking columns to explanations table
      await client.query(`
        ALTER TABLE explanations 
        ADD COLUMN IF NOT EXISTS system_prompt_used TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS user_prompt_used TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS prompt_template_id VARCHAR(50) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS custom_prompt_text TEXT DEFAULT NULL
      `);

      // Create indexes for prompt analysis
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_explanations_prompt_template 
        ON explanations(prompt_template_id) 
        WHERE prompt_template_id IS NOT NULL
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_explanations_custom_prompt_hash
        ON explanations(MD5(custom_prompt_text)) 
        WHERE custom_prompt_text IS NOT NULL
      `);
      
      logger.info('Applied missing column migrations including system prompt tracking', 'database');
    } catch (error) {
      logger.error(`Error applying column migrations: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Check if all required tables exist
   */
  static async validateSchema(pool: Pool): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      const requiredTables = [
        'explanations',
        'feedback',
        'batch_analysis_sessions',
        'batch_analysis_results'
      ];
      
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = ANY($1)
      `, [requiredTables]);
      
      const existingTables = result.rows.map(row => row.table_name);
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));
      
      if (missingTables.length > 0) {
        logger.error(`Missing required tables: ${missingTables.join(', ')}`, 'database');
        return false;
      }
      
      logger.info('All required database tables exist', 'database');
      return true;
    } catch (error) {
      logger.error(`Error validating schema: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Get database statistics for monitoring
   */
  static async getDatabaseStats(pool: Pool): Promise<{
    totalExplanations: number;
    totalFeedback: number;
    totalBatchSessions: number;
    totalBatchResults: number;
    lastExplanationAt: Date | null;
    lastFeedbackAt: Date | null;
  }> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM explanations) as total_explanations,
          (SELECT COUNT(*) FROM feedback) as total_feedback,
          (SELECT COUNT(*) FROM batch_analysis_sessions) as total_batch_sessions,
          (SELECT COUNT(*) FROM batch_analysis_results) as total_batch_results,
          (SELECT MAX(created_at) FROM explanations) as last_explanation_at,
          (SELECT MAX(created_at) FROM feedback) as last_feedback_at
      `);
      
      const stats = result.rows[0];
      
      return {
        totalExplanations: parseInt(stats.total_explanations) || 0,
        totalFeedback: parseInt(stats.total_feedback) || 0,
        totalBatchSessions: parseInt(stats.total_batch_sessions) || 0,
        totalBatchResults: parseInt(stats.total_batch_results) || 0,
        lastExplanationAt: stats.last_explanation_at,
        lastFeedbackAt: stats.last_feedback_at
      };
    } catch (error) {
      logger.error(`Error getting database stats: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    } finally {
      client.release();
    }
  }
}