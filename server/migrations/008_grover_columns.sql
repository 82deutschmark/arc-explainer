-- Grover-ARC iteration tracking columns
-- Author: Sonnet 4.5
-- Date: 2025-10-08

ALTER TABLE explanations ADD COLUMN IF NOT EXISTS
  grover_iterations JSONB,              -- Full iteration history
  grover_best_program TEXT,             -- Final winning program code
  iteration_count INTEGER;              -- Total iterations used

-- Index for querying high-iteration analyses
CREATE INDEX IF NOT EXISTS idx_explanations_iteration_count
  ON explanations(iteration_count)
  WHERE iteration_count IS NOT NULL;

-- Index for Grover-specific queries
CREATE INDEX IF NOT EXISTS idx_explanations_grover_iterations
  ON explanations USING GIN(grover_iterations)
  WHERE grover_iterations IS NOT NULL;
