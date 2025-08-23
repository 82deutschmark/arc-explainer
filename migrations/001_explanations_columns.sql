-- Migration 001: Add missing columns to explanations table
-- This migration adds all the dynamic columns that were previously added via runtime DO $$ blocks
-- Run this migration during a maintenance window after backing up the database

BEGIN;

-- Add alien_meaning_confidence column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'explanations' 
               AND column_name = 'alien_meaning_confidence') 
  THEN
    ALTER TABLE explanations ADD COLUMN alien_meaning_confidence INTEGER;
  END IF;
  
  -- Add provider_response_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'explanations' 
               AND column_name = 'provider_response_id') 
  THEN
    ALTER TABLE explanations ADD COLUMN provider_response_id TEXT;
  END IF;

  -- Add provider_raw_response column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'explanations' 
               AND column_name = 'provider_raw_response') 
  THEN
    ALTER TABLE explanations ADD COLUMN provider_raw_response JSONB;
  END IF;

  -- Add reasoning_items column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'explanations' 
               AND column_name = 'reasoning_items') 
  THEN
    ALTER TABLE explanations ADD COLUMN reasoning_items JSONB;
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

  -- Add predicted_output_grid column if it doesn't exist (for solver mode validation)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'explanations'
               AND column_name = 'predicted_output_grid')
  THEN
    ALTER TABLE explanations ADD COLUMN predicted_output_grid TEXT;
  END IF;

  -- Add is_prediction_correct column if it doesn't exist (for solver mode validation)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'explanations'
               AND column_name = 'is_prediction_correct')
  THEN
    ALTER TABLE explanations ADD COLUMN is_prediction_correct BOOLEAN;
  END IF;

  -- Add prediction_accuracy_score column if it doesn't exist (for solver mode validation)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'explanations'
               AND column_name = 'prediction_accuracy_score')
  THEN
    ALTER TABLE explanations ADD COLUMN prediction_accuracy_score FLOAT;
  END IF;

  -- Add saturn_success column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'explanations'
               AND column_name = 'saturn_success')
  THEN
    ALTER TABLE explanations ADD COLUMN saturn_success BOOLEAN;
  END IF;

  -- Add temperature column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'explanations'
               AND column_name = 'temperature')
  THEN
    ALTER TABLE explanations ADD COLUMN temperature FLOAT;
  END IF;

  -- Add reasoning_effort column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'explanations'
               AND column_name = 'reasoning_effort')
  THEN
    ALTER TABLE explanations ADD COLUMN reasoning_effort TEXT;
  END IF;

  -- Add reasoning_verbosity column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'explanations'
               AND column_name = 'reasoning_verbosity')
  THEN
    ALTER TABLE explanations ADD COLUMN reasoning_verbosity TEXT;
  END IF;

  -- Add reasoning_summary_type column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'explanations'
               AND column_name = 'reasoning_summary_type')
  THEN
    ALTER TABLE explanations ADD COLUMN reasoning_summary_type TEXT;
  END IF;

  -- Add token usage columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'explanations'
               AND column_name = 'input_tokens')
  THEN
    ALTER TABLE explanations ADD COLUMN input_tokens INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'explanations'
               AND column_name = 'output_tokens')
  THEN
    ALTER TABLE explanations ADD COLUMN output_tokens INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'explanations'
               AND column_name = 'reasoning_tokens')
  THEN
    ALTER TABLE explanations ADD COLUMN reasoning_tokens INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'explanations'
               AND column_name = 'total_tokens')
  THEN
    ALTER TABLE explanations ADD COLUMN total_tokens INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'explanations'
               AND column_name = 'estimated_cost')
  THEN
    ALTER TABLE explanations ADD COLUMN estimated_cost DECIMAL(10, 6);
  END IF;
END $$;

COMMIT;