/**
 * Database Schema Management Utilities
 * 
 * Handles database initialization, table creation, and schema migrations.
 * This version is refactored for clarity and robustness, ensuring migrations
 * are separated into schema and data phases to prevent race conditions.
 * 
 * @author Cascade
 * @date 2025-09-03
 */

import { Pool, PoolClient } from 'pg';
import { logger } from '../../utils/logger.ts';

export class DatabaseSchema {
  
  /**
   * Create all required tables and apply migrations.
   */
  static async initialize(pool: Pool): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); // Start transaction

      // Phase 1: Create all tables if they don't exist. Schemas are the definitive, final version.
      await this.createExplanationsTable(client);
      await this.createFeedbackTable(client);
      await this.createBatchSessionsTable(client);
      await this.createBatchResultsTable(client);
      await this.createEloRatingsTable(client);
      await this.createComparisonVotesTable(client);
      await this.createComparisonSessionsTable(client);
      await this.createIngestionRunsTable(client);
      await this.createArc3SessionsTable(client);
      await this.createArc3FramesTable(client);
      await this.createArcContributorsTable(client);
      logger.info('Core tables verified/created.', 'database');

      // Phase 2: Apply schema-altering migrations for older database instances.
      await this.applySchemaMigrations(client);
      logger.info('Schema migrations applied.', 'database');

      // Phase 3: Apply data migrations to populate new columns in existing rows.
      await this.applyDataMigrations(client);
      logger.info('Data migrations applied.', 'database');

      await client.query('COMMIT'); // Commit transaction
      logger.info('Database initialization and migration successful.', 'database');

    } catch (error) {
      await client.query('ROLLBACK'); // Rollback on error
      logger.error(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    } finally {
      client.release();
    }
  }

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
        trustworthiness_score FLOAT DEFAULT NULL,
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
        system_prompt_used TEXT DEFAULT NULL,
        user_prompt_used TEXT DEFAULT NULL,
        prompt_template_id VARCHAR(50) DEFAULT NULL,
        custom_prompt_text TEXT DEFAULT NULL,
        rebutting_explanation_id INTEGER DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private static async createFeedbackTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        explanation_id INTEGER DEFAULT NULL REFERENCES explanations(id) ON DELETE CASCADE,
        comment TEXT DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        puzzle_id VARCHAR(255) DEFAULT NULL,
        feedback_type VARCHAR(50) DEFAULT 'helpful',
        user_agent TEXT DEFAULT NULL,
        session_id VARCHAR(255) DEFAULT NULL,
        reference_feedback_id INTEGER DEFAULT NULL
      )
    `);
  }

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
  }

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
  }

  private static async createEloRatingsTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS elo_ratings (
        id SERIAL PRIMARY KEY,
        explanation_id INTEGER NOT NULL REFERENCES explanations(id) ON DELETE CASCADE,
        current_rating INTEGER DEFAULT 1500,
        games_played INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(explanation_id)
      )
    `);
  }

  private static async createComparisonVotesTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS comparison_votes (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        puzzle_id VARCHAR(255) NOT NULL,
        explanation_a_id INTEGER NOT NULL REFERENCES explanations(id) ON DELETE CASCADE,
        explanation_b_id INTEGER NOT NULL REFERENCES explanations(id) ON DELETE CASCADE,
        outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('A_WINS', 'B_WINS', 'BOTH_BAD')),
        winner_id INTEGER DEFAULT NULL REFERENCES explanations(id) ON DELETE CASCADE,
        rating_a_before INTEGER NOT NULL,
        rating_b_before INTEGER NOT NULL,
        rating_a_after INTEGER NOT NULL,
        rating_b_after INTEGER NOT NULL,
        user_agent TEXT DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_winner_legacy CHECK (winner_id IS NULL OR winner_id IN (explanation_a_id, explanation_b_id))
      )
    `);
  }

  private static async createComparisonSessionsTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS comparison_sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        total_votes INTEGER DEFAULT 0,
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private static async createIngestionRunsTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ingestion_runs (
        id SERIAL PRIMARY KEY,
        dataset_name VARCHAR(255) NOT NULL,
        base_url TEXT NOT NULL,
        source VARCHAR(50),
        total_puzzles INTEGER NOT NULL,
        successful INTEGER NOT NULL,
        failed INTEGER NOT NULL,
        skipped INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        dry_run BOOLEAN DEFAULT FALSE,
        accuracy_percent DECIMAL(5,2),
        started_at TIMESTAMP WITH TIME ZONE NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
        error_log TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Create indexes for ingestion_runs table
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ingestion_runs_dataset ON ingestion_runs(dataset_name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ingestion_runs_started ON ingestion_runs(started_at DESC)`);
  }

  private static async createArc3SessionsTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS arc3_sessions (
        id SERIAL PRIMARY KEY,
        game_id VARCHAR(255) NOT NULL,
        guid VARCHAR(255) NOT NULL UNIQUE,
        state VARCHAR(50) NOT NULL DEFAULT 'NOT_PLAYED',
        final_score INTEGER DEFAULT 0,
        win_score INTEGER DEFAULT 0,
        total_frames INTEGER DEFAULT 0,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for arc3_sessions table
    await client.query(`CREATE INDEX IF NOT EXISTS idx_arc3_sessions_game_id ON arc3_sessions(game_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_arc3_sessions_guid ON arc3_sessions(guid)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_arc3_sessions_started ON arc3_sessions(started_at DESC)`);
  }

  private static async createArc3FramesTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS arc3_frames (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES arc3_sessions(id) ON DELETE CASCADE,
        frame_number INTEGER NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        action_params JSONB DEFAULT '{}',
        caption TEXT DEFAULT NULL,
        state VARCHAR(50) NOT NULL,
        score INTEGER DEFAULT 0,
        win_score INTEGER DEFAULT 0,
        frame_data JSONB NOT NULL,
        pixels_changed INTEGER DEFAULT 0,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, frame_number)
      )
    `);

    // Create indexes for arc3_frames table
    await client.query(`CREATE INDEX IF NOT EXISTS idx_arc3_frames_session ON arc3_frames(session_id, frame_number)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_arc3_frames_timestamp ON arc3_frames(timestamp DESC)`);
  }

  private static async createArcContributorsTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS arc_contributors (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        handle VARCHAR(100),
        affiliation TEXT,
        achievement TEXT NOT NULL,
        description TEXT NOT NULL,
        year_start INTEGER,
        year_end INTEGER,
        score VARCHAR(50),
        approach TEXT,
        unique_technique TEXT,
        links JSONB DEFAULT '{}',
        team_name VARCHAR(100),
        category VARCHAR(50) NOT NULL,
        image_url VARCHAR(500),
        rank INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for arc_contributors table
    await client.query(`CREATE INDEX IF NOT EXISTS idx_arc_contributors_category ON arc_contributors(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_arc_contributors_year ON arc_contributors(year_start DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_arc_contributors_rank ON arc_contributors(rank) WHERE rank IS NOT NULL`);
  }

  /**
   * Applies schema-altering migrations to bring older database schemas up to date.
   */
  private static async applySchemaMigrations(client: PoolClient): Promise<void> {
    // Migration: Add all potentially missing columns to 'feedback' using a single ALTER TABLE
    await client.query(`
      ALTER TABLE feedback
      ADD COLUMN IF NOT EXISTS user_agent TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS session_id VARCHAR(255) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS puzzle_id VARCHAR(255) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS feedback_type VARCHAR(50) DEFAULT 'helpful',
      ADD COLUMN IF NOT EXISTS reference_feedback_id INTEGER DEFAULT NULL;
    `);

    // Migration: Add all potentially missing columns to 'explanations' using a single ALTER TABLE
    await client.query(`
      ALTER TABLE explanations
      ADD COLUMN IF NOT EXISTS system_prompt_used TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS user_prompt_used TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS prompt_template_id VARCHAR(50) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS custom_prompt_text TEXT DEFAULT NULL;
    `);

    // Migration: Add Responses API conversation chaining columns
    await client.query(`
      ALTER TABLE explanations
      ADD COLUMN IF NOT EXISTS provider_response_id TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS provider_raw_response JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS reasoning_items JSONB DEFAULT NULL;
    `);

    // Migration: Add 'updated_at' to 'batch_analysis_sessions'
    await client.query(`ALTER TABLE batch_analysis_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`);

    // Migration: Ensure 'explanation_id' and 'comment' in 'feedback' are nullable
    await client.query(`ALTER TABLE feedback ALTER COLUMN explanation_id DROP NOT NULL;`);
    await client.query(`ALTER TABLE feedback ALTER COLUMN comment DROP NOT NULL;`);

    // Migration: Add/Update CHECK constraint for 'feedback_type'
    await client.query(`ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_type_check;`);
    await client.query(`ALTER TABLE feedback ADD CONSTRAINT feedback_type_check CHECK (feedback_type IN ('helpful', 'not_helpful', 'solution_explanation'));`);

    // Migration: Create indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_explanations_prompt_template ON explanations(prompt_template_id) WHERE prompt_template_id IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_explanations_custom_prompt_hash ON explanations(MD5(custom_prompt_text)) WHERE custom_prompt_text IS NOT NULL`);

    // Migration: Add outcome column to comparison_votes for BOTH_BAD voting
    await client.query(`ALTER TABLE comparison_votes ADD COLUMN IF NOT EXISTS outcome VARCHAR(20) DEFAULT NULL`);
    await client.query(`ALTER TABLE comparison_votes DROP CONSTRAINT IF EXISTS outcome_check`);
    await client.query(`ALTER TABLE comparison_votes ADD CONSTRAINT outcome_check CHECK (outcome IN ('A_WINS', 'B_WINS', 'BOTH_BAD'))`);
    await client.query(`ALTER TABLE comparison_votes ALTER COLUMN winner_id DROP NOT NULL`);
    await client.query(`ALTER TABLE comparison_votes DROP CONSTRAINT IF EXISTS valid_winner`);
    // Add constraint only if it doesn't exist (table may have been created with it already)
    const constraintExists = await client.query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'comparison_votes' AND constraint_name = 'valid_winner_legacy'
    `);
    if (constraintExists.rows.length === 0) {
      await client.query(`ALTER TABLE comparison_votes ADD CONSTRAINT valid_winner_legacy CHECK (winner_id IS NULL OR winner_id IN (explanation_a_id, explanation_b_id))`);
    }

    // Migration: Create Elo system indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_elo_ratings_rating ON elo_ratings(current_rating DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_elo_ratings_explanation ON elo_ratings(explanation_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comparison_votes_session ON comparison_votes(session_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_explanations_predicted_grid ON explanations(id) WHERE predicted_output_grid IS NOT NULL`);

    // Migration: Create cost calculation indexes for CostRepository optimization
    await client.query(`CREATE INDEX IF NOT EXISTS idx_explanations_cost_model ON explanations(model_name, estimated_cost) WHERE estimated_cost IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_explanations_cost_date ON explanations(created_at, estimated_cost, model_name) WHERE estimated_cost IS NOT NULL`);

    // Migration: Add rebuttal tracking column
    await client.query(`ALTER TABLE explanations ADD COLUMN IF NOT EXISTS rebutting_explanation_id INTEGER DEFAULT NULL`);

    // Migration: Add foreign key constraint for rebuttal tracking
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_rebutting_explanation'
          AND table_name = 'explanations'
        ) THEN
          ALTER TABLE explanations
          ADD CONSTRAINT fk_rebutting_explanation
          FOREIGN KEY (rebutting_explanation_id)
          REFERENCES explanations(id)
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Migration: Add index for rebuttal tracking queries
    await client.query(`CREATE INDEX IF NOT EXISTS idx_explanations_rebutting_explanation_id ON explanations(rebutting_explanation_id) WHERE rebutting_explanation_id IS NOT NULL`);

    // Migration: Add Grover iteration tracking columns
    await client.query(`
      ALTER TABLE explanations
      ADD COLUMN IF NOT EXISTS grover_iterations JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS grover_best_program TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS iteration_count INTEGER DEFAULT NULL;
    `);

    // Migration: Add indexes for Grover queries
    await client.query(`CREATE INDEX IF NOT EXISTS idx_explanations_iteration_count ON explanations(iteration_count) WHERE iteration_count IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_explanations_grover_iterations ON explanations USING GIN(grover_iterations) WHERE grover_iterations IS NOT NULL`);

    // Migration: Add Beetree ensemble solver columns
    await client.query(`
      ALTER TABLE explanations
      ADD COLUMN IF NOT EXISTS beetree_stage VARCHAR(100) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS beetree_consensus_count INTEGER DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS beetree_model_results JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS beetree_cost_breakdown JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS beetree_token_usage JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS beetree_run_timestamp VARCHAR(255) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS beetree_mode VARCHAR(20) DEFAULT NULL CHECK (beetree_mode IN ('testing', 'production')),
      ADD COLUMN IF NOT EXISTS beetree_consensus_strength FLOAT DEFAULT NULL CHECK (beetree_consensus_strength >= 0 AND beetree_consensus_strength <= 1),
      ADD COLUMN IF NOT EXISTS beetree_diversity_score FLOAT DEFAULT NULL CHECK (beetree_diversity_score >= 0 AND beetree_diversity_score <= 1);
    `);

    // Migration: Add indexes for Beetree queries
    await client.query(`CREATE INDEX IF NOT EXISTS idx_explanations_beetree_mode ON explanations(beetree_mode) WHERE beetree_mode IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_explanations_beetree_timestamp ON explanations(beetree_run_timestamp) WHERE beetree_run_timestamp IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_explanations_beetree_consensus ON explanations(beetree_consensus_strength DESC) WHERE beetree_consensus_strength IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_explanations_beetree_model_results ON explanations USING GIN(beetree_model_results) WHERE beetree_model_results IS NOT NULL`);
  }

  /**
   * Populates data in newly created/altered columns for existing rows.
   */
  private static async applyDataMigrations(client: PoolClient): Promise<void> {
    // Data Migration: Populate 'puzzle_id' in 'feedback' from associated 'explanations'
    await client.query(`
      UPDATE feedback f
      SET puzzle_id = e.puzzle_id
      FROM explanations e
      WHERE f.explanation_id = e.id AND f.puzzle_id IS NULL;
    `);

    // Data Migration: Ensure 'feedback_type' has a default value for any old rows
    await client.query(`UPDATE feedback SET feedback_type = 'helpful' WHERE feedback_type IS NULL;`);
  }
}