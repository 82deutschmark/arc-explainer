-- Migration script to add reasoning log columns to explanations table
-- This adds support for storing AI reasoning logs from models that provide step-by-step reasoning
-- Author: Cascade

-- Add reasoning_log column to store the actual reasoning text
ALTER TABLE explanations 
ADD COLUMN IF NOT EXISTS reasoning_log TEXT;

-- Add has_reasoning_log column to indicate if reasoning log is available
ALTER TABLE explanations 
ADD COLUMN IF NOT EXISTS has_reasoning_log BOOLEAN DEFAULT FALSE;

-- Add saturn_log column to store Saturn Visual Solver verbose output
ALTER TABLE explanations 
ADD COLUMN IF NOT EXISTS saturn_log TEXT;

-- Update existing records to set has_reasoning_log to false
UPDATE explanations 
SET has_reasoning_log = FALSE 
WHERE has_reasoning_log IS NULL;

-- Create index for faster queries on has_reasoning_log
CREATE INDEX IF NOT EXISTS idx_explanations_has_reasoning_log 
ON explanations(has_reasoning_log);

-- Verify the migration
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'explanations' 
AND column_name IN ('reasoning_log', 'has_reasoning_log');
