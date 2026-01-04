-- Delete specific record from explanations table
-- Record ID: 34462
-- Run this in Railway PostgreSQL Query Editor FIRST

DELETE FROM explanations WHERE id = 34462;

-- Verify deletion
SELECT COUNT(*) as remaining_count FROM explanations WHERE id = 34462;
-- Should return 0 if deletion was successful
