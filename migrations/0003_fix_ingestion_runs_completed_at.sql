-- Migration: Fix ingestion_runs.completed_at to allow NULL
-- Author: Cascade using GPT-5-Pro
-- Date: 2025-10-09
-- Purpose: Allow completed_at to be NULL when ingestion starts (only populated on completion)
-- SRP/DRY check: Pass - Single schema fix for ingestion tracking

-- Remove NOT NULL constraint from completed_at
ALTER TABLE ingestion_runs 
  ALTER COLUMN completed_at DROP NOT NULL;

-- Also make duration_ms nullable since it's initialized to 0 and updated later
ALTER TABLE ingestion_runs 
  ALTER COLUMN duration_ms DROP NOT NULL;
