# Multi-Test Database Columns Investigation

**Author:** Claude Code using Sonnet 4.5
**Date:** 2025-10-07
**PURPOSE:** Investigation into whether multi-test columns are missing from database schema migrations

---

## Columns in Question

These columns exist in the `CREATE TABLE` statement but may not have migrations:

```sql
has_multiple_predictions BOOLEAN DEFAULT NULL
multiple_predicted_outputs JSONB DEFAULT NULL
multi_test_prediction_grids JSONB DEFAULT NULL
multi_test_results JSONB DEFAULT NULL
multi_test_all_correct BOOLEAN DEFAULT NULL
multi_test_average_accuracy FLOAT DEFAULT NULL
```

## Historical Context

**Commit 4328d28** (Aug 25, 2025) - "DATABASE MIGRATION: Add missing has_multiple_predictions column"
- This commit added a migration for `has_multiple_predictions`
- It was added to the OLD `server/services/dbService.ts` file
- When the codebase was refactored to use `DatabaseSchema.ts`, this migration may have been lost

## Current State

**DatabaseSchema.ts** (lines 56-104):
- ✅ All multi-test columns ARE in CREATE TABLE statement
- ❓ NO migrations in `applySchemaMigrations()` for these columns

## Risk Assessment

**Low Risk if database created recently:**
- If your database was created AFTER the repository refactor (commit cea8c04, Aug 27, 2025), all columns exist

**High Risk if database created before Aug 25, 2025:**
- Multi-test features may be broken
- Saves may fail silently or return errors

## Investigation Steps Needed

1. Check actual database schema: `\d explanations` in psql
2. Look for errors in logs related to multi-test puzzles
3. Test a multi-test puzzle analysis to see if it saves correctly
4. If columns missing, add migrations similar to Responses API fix

## Recommendation

**DO NOT fix this immediately** - separate concern from Responses API issue.
Investigate separately after Responses API columns are fixed and tested.

---

## Notes

This is a SEPARATE issue from the Responses API columns. The Responses API columns (provider_response_id, provider_raw_response, reasoning_items) are CRITICAL and blocking the discussion page RIGHT NOW.

Multi-test columns need investigation but are not blocking any immediate user-facing features.
