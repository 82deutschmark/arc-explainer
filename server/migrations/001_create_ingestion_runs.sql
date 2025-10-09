/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-01
 * PURPOSE: Create ingestion_runs table to track HuggingFace dataset ingestion history.
 *          This table stores metadata about each ingestion run for auditing and display
 *          in the admin interface.
 * SRP/DRY check: Pass - Single responsibility (ingestion run tracking)
 * shadcn/ui: N/A - Database migration
 */

-- Create ingestion_runs table for tracking HuggingFace dataset imports
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id SERIAL PRIMARY KEY,

  -- Dataset identification
  dataset_name VARCHAR(255) NOT NULL,
  base_url TEXT NOT NULL,
  source VARCHAR(50), -- ARC1, ARC1-Eval, ARC2, ARC2-Eval, ARC-Heavy, ConceptARC

  -- Run statistics
  total_puzzles INTEGER NOT NULL,
  successful INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,

  -- Performance metrics
  duration_ms INTEGER NOT NULL,
  accuracy_percent DECIMAL(5,2),

  -- Run configuration
  dry_run BOOLEAN DEFAULT FALSE,

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Error logging
  error_log TEXT
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_dataset ON ingestion_runs(dataset_name);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_started ON ingestion_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source ON ingestion_runs(source);

-- Add comment for documentation
COMMENT ON TABLE ingestion_runs IS 'Tracks HuggingFace dataset ingestion runs for admin interface';
COMMENT ON COLUMN ingestion_runs.dataset_name IS 'Model folder name from HuggingFace dataset (becomes model name in explanations)';
COMMENT ON COLUMN ingestion_runs.base_url IS 'Full HuggingFace dataset URL used for ingestion';
COMMENT ON COLUMN ingestion_runs.source IS 'Auto-detected or manually specified ARC source filter';
COMMENT ON COLUMN ingestion_runs.accuracy_percent IS 'Overall accuracy percentage across all attempts in this run';
COMMENT ON COLUMN ingestion_runs.dry_run IS 'Whether this was a preview run (no database writes)';
