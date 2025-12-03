-- Migration: Add Beetree ensemble solver columns to explanations table
-- Author: Cascade
-- Date: 2025-12-01
-- Purpose: Support Beetree multi-model ensemble solver data storage

ALTER TABLE explanations
ADD COLUMN IF NOT EXISTS beetree_stage TEXT,
ADD COLUMN IF NOT EXISTS beetree_consensus_count INTEGER,
ADD COLUMN IF NOT EXISTS beetree_model_results JSONB,
ADD COLUMN IF NOT EXISTS beetree_cost_breakdown JSONB,
ADD COLUMN IF NOT EXISTS beetree_token_usage JSONB,
ADD COLUMN IF NOT EXISTS beetree_run_timestamp TEXT,
ADD COLUMN IF NOT EXISTS beetree_mode TEXT,
ADD COLUMN IF NOT EXISTS beetree_consensus_strength REAL,
ADD COLUMN IF NOT EXISTS beetree_diversity_score REAL;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_explanations_beetree_mode ON explanations(beetree_mode) WHERE beetree_mode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_explanations_beetree_run_timestamp ON explanations(beetree_run_timestamp) WHERE beetree_run_timestamp IS NOT NULL;
