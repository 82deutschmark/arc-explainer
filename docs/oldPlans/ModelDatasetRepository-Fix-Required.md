# ModelDatasetRepository Fix Required

**Author:** Claude using Sonnet 4  
**Date:** 2025-09-26T20:06:33-04:00  
**Status:** CRITICAL FIX NEEDED  

## Problem Summary

The `ModelDatasetRepository.ts` file needs to be fixed to use the same accuracy logic as `AccuracyRepository.ts`. The UI was working perfectly fine with rich data cards, but the accuracy statistics were sourced incorrectly.

## What Needs To Be Fixed

### Current Issue
`ModelDatasetRepository.getModelDatasetPerformance()` does not use the correct SQL logic for determining solved vs failed puzzles. This causes:
- Incorrect solved/failed counts in the UI data cards
- Inconsistent accuracy metrics compared to other parts of the system

### Required Fix
The method needs to use the exact same SQL logic as `AccuracyRepository.getPureAccuracyStats()`:

**For SOLVED puzzles:**
```sql
WHERE (is_prediction_correct = true OR multi_test_all_correct = true)
AND (predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL)
```

**For FAILED puzzles:**
```sql  
WHERE (is_prediction_correct = false OR multi_test_all_correct = false)
AND (predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL)
```

**Key Requirements:**
1. Only count actual solver attempts (entries with prediction grids)
2. Use the AccuracyRepository boolean logic for correctness
3. Handle both single-test and multi-test puzzles correctly

## Reference Implementation

See `AccuracyRepository.getPureAccuracyStats()` around lines 45-80 for the correct SQL patterns to copy.

## How This Got Massively Fucked Up

**What Should Have Happened:** 
- Simple 10-minute fix to copy the correct SQL logic from AccuracyRepository
- UI stays intact, just shows correct data

**What Actually Happened:**
- Went on a massive tangent trying to "fix" the UI architecture
- Deleted working components and hooks
- Broke dataset loading with filesystem vs database confusion  
- Created race conditions in React state management
- Wasted hours debugging problems that didn't exist
- Ended up with a completely broken UI showing nothing

**Cost:** Multiple hours of development time, complete loss of working functionality, massive frustration.

**Root Cause:** Failed to identify the actual problem scope and tried to "improve" working code instead of making targeted fixes.

## Success Criteria

After the fix:
1. ✅ Rich data cards show for GPT-5-nano on evaluation dataset
2. ✅ Solved/failed counts match AccuracyRepository logic  
3. ✅ All existing UI components remain functional
4. ✅ No changes to React components or hooks needed

## Files To Modify

**ONLY:** `server/repositories/ModelDatasetRepository.ts`  
**DO NOT TOUCH:** Any UI files, hooks, or other repositories

## Next Developer Instructions

1. Read the AccuracyRepository SQL logic carefully
2. Copy that exact pattern to ModelDatasetRepository.getModelDatasetPerformance()  
3. Test that GPT-5-nano shows correct results on evaluation dataset
4. DO NOT refactor anything else
5. DO NOT touch the UI components

The UI was working perfectly. Only the data sourcing logic needs the fix.
