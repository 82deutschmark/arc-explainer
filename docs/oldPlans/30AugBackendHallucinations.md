# Backend Hallucinated Metrics Fix Plan
**Date**: August 30, 2025  
**Priority**: HIGH - Remove Nonsensical Metrics  





## Previous Problem Statement   FIXED!!!

The `/api/puzzle/performance-stats` endpoint contains mathematically meaningless calculated metrics that were hallucinated during development. These appear in ModelDebugModal and other components.

## Identified Nonsensical Metrics

1. **`costPerTrustworthiness`** 
   - **Calculation**: `SUM(cost) / AVG(trustworthiness) / COUNT(*)`
   - **Issue**: Dividing cost by prediction accuracy produces meaningless number
   - **Action**: Remove entirely

2. **`tokensPerTrustworthiness`**
   - **Calculation**: `SUM(tokens) / AVG(trustworthiness) / COUNT(*)`  
   - **Issue**: No logical relationship between token count and accuracy score
   - **Action**: Remove entirely

3. **`calibrationError`**
   - **Calculation**: `ABS(AVG(confidence) - (AVG(trustworthiness) * 100))`
   - **Issue**: Unclear if this is valid statistical measure
   - **Action**: Remove unless proven mathematically sound

## Investigation Steps

### 1. Examine Database Schema
Reference existing documentation: `d:\1Projects\arc-explainer\docs\Database_Schema_Mismatch_Analysis.md`

### 2. Review SQL Queries  
**Location**: `server/repositories/FeedbackRepository.ts`
- Line with `cost_per_trustworthiness` calculation
- Line with `tokens_per_trustworthiness` calculation  
- Line with `calibration_error` calculation

### 3. Clean Up Code

#### Remove from SQL queries:
```sql
-- Remove these calculated fields:
cost_per_trustworthiness
tokens_per_trustworthiness  
calibration_error (if not statistically valid)
```

#### Remove from Type definitions:
**File**: `shared/types.ts`
```typescript
// Remove these fields from interfaces
costPerTrustworthiness: number;
tokensPerTrustworthiness: number;
calibrationError: number; // if removing
```

#### Remove from Frontend display:
**File**: `client/src/components/ModelDebugModal.tsx`
- Remove display of these metrics from UI
- Remove "Aggregate Raw Stats (All Models)" section entirely

#### Check other components:
**File**: `client/src/components/overview/LeaderboardTable.tsx`
- Remove any references to these metrics

## Files to Modify

1. `server/repositories/FeedbackRepository.ts` - Remove SQL calculations
2. `shared/types.ts` - Remove type definitions  
3. `client/src/components/ModelDebugModal.tsx` - Remove UI display
4. `client/src/components/overview/LeaderboardTable.tsx` - Check for usage
5. Any other files found via grep for these metric names

## Keep Only Valid Metrics

- `avgTrustworthiness` (if this is actual prediction accuracy)
- `avgProcessingTime` 
- `avgTokens`
- `avgCost`
- `totalCost`
- `totalAttempts`

## Validation

After removal, verify:
- [x ] No references to removed metrics in codebase
- [ x] API endpoints return clean data
- [x ] Frontend components display without errors
- [ x] No TypeScript compilation errors

---
**Root Cause**: Hallucinated metrics during development without mathematical validation  
**Fix**: Remove nonsensical calculated ratios, keep only basic aggregate statistics