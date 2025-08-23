-- Migration 002: Schema Improvements
-- Author: Claude Code
-- Date: 2025-08-23
-- Purpose: Fix INTEGER overflow risk and standardize timestamp handling

-- Fix INTEGER overflow risk for processing time columns
-- Change processing_time_ms from INTEGER to BIGINT to handle large values
ALTER TABLE explanations 
ALTER COLUMN processing_time_ms TYPE BIGINT;

ALTER TABLE batch_results 
ALTER COLUMN processing_time_ms TYPE BIGINT;

ALTER TABLE batch_runs 
ALTER COLUMN total_processing_time_ms TYPE BIGINT;

-- Standardize timestamp handling - convert all TIMESTAMP to TIMESTAMPTZ
-- This ensures consistent timezone-aware timestamps across the system

ALTER TABLE explanations 
ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

ALTER TABLE feedback 
ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

ALTER TABLE saturn_log 
ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

ALTER TABLE saturn_events 
ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

ALTER TABLE batch_runs 
ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC';

ALTER TABLE batch_results 
ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Add performance comment for future reference
COMMENT ON COLUMN explanations.processing_time_ms IS 'Processing time in milliseconds - BIGINT to handle large batch operations';
COMMENT ON COLUMN batch_results.processing_time_ms IS 'Processing time in milliseconds - BIGINT to prevent overflow';
COMMENT ON COLUMN batch_runs.total_processing_time_ms IS 'Total batch processing time - BIGINT for large batches';
