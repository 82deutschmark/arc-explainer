-- Migration: Rename prediction_accuracy_score to trustworthiness_score
-- Date: 2025-09-11
-- Purpose: Fix misleading field name that suggests accuracy but stores trustworthiness

-- Start transaction for atomic operation
BEGIN;

-- Step 1: Add new column with correct name
ALTER TABLE explanations 
ADD COLUMN trustworthiness_score FLOAT DEFAULT NULL;

-- Step 2: Copy data from old column to new column
UPDATE explanations 
SET trustworthiness_score = prediction_accuracy_score 
WHERE prediction_accuracy_score IS NOT NULL;

-- Step 3: Verify data migration (should return 0 if successful)
-- This query will show any rows where the migration failed
DO $$
DECLARE
    mismatch_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO mismatch_count
    FROM explanations 
    WHERE (prediction_accuracy_score IS NULL AND trustworthiness_score IS NOT NULL)
       OR (prediction_accuracy_score IS NOT NULL AND trustworthiness_score IS NULL)
       OR (prediction_accuracy_score != trustworthiness_score);
    
    IF mismatch_count > 0 THEN
        RAISE EXCEPTION 'Data migration failed: % rows have mismatched values', mismatch_count;
    END IF;
    
    RAISE NOTICE 'Data migration successful: All % rows migrated correctly', 
        (SELECT COUNT(*) FROM explanations WHERE trustworthiness_score IS NOT NULL);
END $$;

-- Step 4: Drop old column (commented out for safety - run manually after verification)
-- ALTER TABLE explanations DROP COLUMN prediction_accuracy_score;

-- Step 5: Add comment to document the field purpose
COMMENT ON COLUMN explanations.trustworthiness_score IS 'AI confidence reliability score combining confidence claims with actual correctness. Higher scores indicate better correlation between AI confidence and actual performance. This is the primary research metric.';

COMMIT;

-- Rollback script (run if migration needs to be reversed):
/*
BEGIN;
ALTER TABLE explanations ADD COLUMN prediction_accuracy_score FLOAT DEFAULT NULL;
UPDATE explanations SET prediction_accuracy_score = trustworthiness_score WHERE trustworthiness_score IS NOT NULL;
ALTER TABLE explanations DROP COLUMN trustworthiness_score;
COMMIT;
*/