# Fix Model Dataset Performance Logic - Analysis and Plan

**Author:** Cascade  
**Date:** 2025-09-26T20:43:42-04:00  
**Issue:** Critical logic error in ModelDatasetRepository determining "incorrect" vs "not attempted" puzzles

## Problem Analysis

The previous developer (me) made a fundamental misunderstanding of how the database stores puzzle attempt results, leading to incorrect classification of puzzle attempts.

### Current Broken Logic in ModelDatasetRepository.ts

**Lines 145-149:** The current SQL query incorrectly categorizes attempts:

```sql
CASE
  -- CORRECT: Either single-test OR multi-test correct
  WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 'correct'
  
  -- INCORRECT: Everything else that was attempted (has prediction grids)  
  ELSE 'incorrect'
END as result
```

**The Problem:** This assumes that if an attempt has prediction grids but isn't marked as correct, it must be incorrect. But this ignores the actual data structure.

### How the Database Actually Works

From examining existing working code in `puzzle-analysis.ts`, `AccuracyRepository.ts`, and the database schema:

**Database Schema Reality:**
- `is_prediction_correct: boolean | null` - Can be true, false, or NULL
- `multi_test_all_correct: boolean | null` - Can be true, false, or NULL  
- `predicted_output_grid: any | null` - Contains the prediction if attempted
- `multi_test_prediction_grids: any | null` - Contains multi-test predictions if attempted

**Correct Logic Pattern from Existing Code:**
- **CORRECT:** `is_prediction_correct = true OR multi_test_all_correct = true`
- **INCORRECT:** `is_prediction_correct = false OR multi_test_all_correct = false` (explicit false values)
- **NOT ATTEMPTED:** No database entry OR no prediction grids

### Evidence from Working Code

**puzzle-analysis.ts (lines 52, 102):**
```sql
-- For finding CORRECT solutions
WHERE is_prediction_correct = true OR multi_test_all_correct = true
```

**AccuracyRepository.ts (lines 138, 167):**
```sql  
-- For counting CORRECT predictions
SUM(CASE WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 1 ELSE 0 END)
```

**Analysis Result Components:**
The frontend `AnalysisResultCard.tsx` already elegantly displays correctness status per puzzle by checking these exact boolean flags. We're reinventing logic that already exists and works.

## Root Cause

The user said: **"for something to be marked as 'incorrect' it should be: is_prediction_correct = false OR multi_test_all_correct = false"**

I was treating NULL values as "incorrect" when they should be "not applicable". An entry can have prediction grids but still have NULL correctness flags if the validation hasn't been completed or failed.

## Solution Plan

### 1. Fix the SQL Query Logic

Replace the broken CASE statement in `ModelDatasetRepository.ts` with proper three-way classification:

```sql
CASE
  -- CORRECT: Either single-test OR multi-test explicitly correct
  WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 'correct'
  
  -- INCORRECT: Either single-test OR multi-test explicitly incorrect (false values)
  WHEN is_prediction_correct = false OR multi_test_all_correct = false THEN 'incorrect'
  
  -- INDETERMINATE: Has predictions but correctness not determined (NULLs)
  ELSE 'indeterminate'
END as result
```

### 2. Handle the "Indeterminate" Category

We need to decide how to handle puzzles that have prediction grids but no correctness determination:
- **Option A:** Count as "not attempted" (since correctness validation failed)
- **Option B:** Create separate "indeterminate" category 
- **Option C:** Exclude from analysis entirely

Based on user requirements, **Option A** seems most appropriate - if we can't determine correctness, treat as not successfully attempted.

### 3. Update Query to Match Existing Patterns

Follow the exact same patterns used in `AccuracyRepository.ts` and `puzzle-analysis.ts`:

```sql
-- Filter for actual solver attempts (has predictions)
WHERE model_name ILIKE $1
AND puzzle_id = ANY($2)
AND (predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL)

-- Then classify results properly
CASE
  WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 'correct'
  WHEN is_prediction_correct = false OR multi_test_all_correct = false THEN 'incorrect'
  ELSE 'indeterminate'  -- Has predictions but no correctness determination
END
```

### 4. Align with Existing Frontend Patterns

The `AnalysisResultCard.tsx` component already handles this correctly by checking boolean flags. We should follow the same patterns instead of creating new inconsistent logic.

### 5. Testing Strategy

**Test Cases to Verify:**
1. Puzzle with `is_prediction_correct = true` → Should be "correct"
2. Puzzle with `multi_test_all_correct = true` → Should be "correct"  
3. Puzzle with `is_prediction_correct = false` → Should be "incorrect"
4. Puzzle with `multi_test_all_correct = false` → Should be "incorrect"
5. Puzzle with prediction grids but NULL correctness → Should be "not attempted" 
6. Puzzle with no database entry → Should be "not attempted"

## Implementation Steps

1. **Fix ModelDatasetRepository.ts query logic** (high priority)
2. **Update the CASE statement** to use explicit false checks
3. **Handle indeterminate cases** appropriately
4. **Test against known puzzle datasets** to verify results
5. **Update documentation** to reflect correct logic

## Files to Modify

1. `server/repositories/ModelDatasetRepository.ts` - Fix the broken SQL logic
2. `client/src/pages/AnalyticsOverview.tsx` - Update descriptions to reflect correct logic  
3. Update any unit tests that may depend on the broken logic

## Lessons Learned

- **Read existing working code first** before implementing new logic
- **Understand database schema reality** vs assumptions
- **Follow established patterns** in the codebase
- **NULL != false** in database logic - critical distinction
