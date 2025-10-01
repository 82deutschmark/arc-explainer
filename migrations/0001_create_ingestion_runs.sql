-- Migration: Create ingestion_runs table
-- Author: Cascade using GPT-4.1
-- Date: 2025-10-01
-- Purpose: Track HuggingFace dataset ingestion runs for the admin dashboard

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
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_dataset ON ingestion_runs(dataset_name);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_started ON ingestion_runs(started_at DESC);
