-- Add status column to explanations table
-- This script is part of the ingest-and-process pipeline refactor.

ALTER TABLE explanations
ADD COLUMN status VARCHAR(20) DEFAULT 'parsed';

-- Update existing NULL statuses to 'parsed' for backward compatibility
UPDATE explanations
SET status = 'parsed'
WHERE status IS NULL;

-- Make the column NOT NULL after populating existing rows
ALTER TABLE explanations
ALTER COLUMN status SET NOT NULL;

COMMENT ON COLUMN explanations.status IS 'The processing status of the AI response (e.g., raw, processing, parsed, failed).';
