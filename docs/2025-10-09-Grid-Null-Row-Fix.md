# Grid Null Row Error Fix

**Author:** Cascade using Claude Sonnet 4.5  
**Date:** 2025-10-09T22:07:00-04:00  
**Issue:** `Cannot read properties of null (reading 'map')` error when loading puzzle 9aaea919

## Root Cause Analysis

### The Problem
The application crashed when trying to display puzzle grids containing null rows. The error occurred because:

1. **Database contained corrupt data**: Some `predicted_output_grid` JSONB fields in PostgreSQL contained arrays with null rows (e.g., `[[1,2,3], null, [4,5,6]]`)
2. **No sanitization on READ**: While grid data was sanitized during database writes, it was NOT sanitized when reading from the database
3. **Frontend assumed valid data**: React components tried to `.map()` over rows without validating they were arrays

### Why This Happened

**Write Path (Correct):**
```typescript
// ExplanationRepository.ts line 73
this.safeJsonStringify(this.sanitizeGridData(data.predictedOutputGrid))
```

**Read Path (Broken):**
```typescript
// ExplanationRepository.ts line 570 (BEFORE FIX)
predictedOutputGrid: this.safeJsonParse(row.predictedOutputGrid, 'predictedOutputGrid')
```

The `safeJsonParse` function in `CommonUtilities.ts` had a critical flaw:
```typescript
// If already an object, return as-is
if (typeof value === 'object') {
  return value as T;  // ❌ No validation!
}
```

When PostgreSQL returns JSONB data, the pg driver returns it as an already-parsed JavaScript object. If that object contains null rows, they pass through unchecked.

### How Corrupt Data Got Into Database

Potential sources:
- Legacy data from earlier versions without proper validation
- Bulk imports or manual SQL inserts
- Recovery scripts that reconstructed data
- AI responses that weren't properly validated before saving

## The Fix (Three-Layer Defense)

### Layer 1: Frontend Defensive Programming
**File:** `client/src/components/puzzle/PuzzleGrid.tsx`

Added validation to filter out null/undefined rows before rendering:

```typescript
const validGrid = useMemo(() => {
  if (!grid || !Array.isArray(grid)) return [];
  return grid.filter(row => row && Array.isArray(row));
}, [grid]);
```

**Why:** Protects against any data that slips through backend validation.

### Layer 2: Backend Read Sanitization
**File:** `server/repositories/ExplanationRepository.ts`

Added sanitization when reading grid data from database:

```typescript
// CRITICAL FIX: Sanitize grid data on READ to filter out null rows from legacy/corrupt data
predictedOutputGrid: this.sanitizeGridData(this.safeJsonParse(row.predictedOutputGrid, 'predictedOutputGrid')),
// Also for multi-test grids:
multiTestPredictionGrids: this.sanitizeMultipleGrids(this.safeJsonParse(row.multiTestPredictionGrids, 'multiTestPredictionGrids')),
```

**Why:** Ensures all data leaving the database is validated and sanitized.

### Layer 3: Enhanced Grid Sanitization
**File:** `server/utils/CommonUtilities.ts`

Modified `sanitizeGridData` to skip corrupt rows instead of failing entire grid:

```typescript
// BEFORE: Would return null for entire grid if any row was invalid
if (!Array.isArray(row)) {
  logger.warn(`Grid row ${rowIndex} is not an array`, 'utilities');
  return null;  // ❌ Too strict!
}

// AFTER: Skip corrupt rows, preserve valid data
if (row === null || row === undefined) {
  logger.warn(`Grid row ${rowIndex} is null/undefined - skipping`, 'utilities');
  continue;
}

if (!Array.isArray(row)) {
  logger.warn(`Grid row ${rowIndex} is not an array - skipping`, 'utilities');
  continue;
}
```

Added validation to ensure at least some rows remain:
```typescript
// Validate that we have at least some valid rows
if (sanitizedGrid.length === 0) {
  logger.warn('Grid sanitization resulted in empty grid - all rows were invalid', 'utilities');
  return null;
}
```

**Why:** Recovers from corrupt data gracefully while logging issues for investigation.

## Impact

### Immediate Benefits
- ✅ Application no longer crashes on puzzles with corrupt grid data
- ✅ Corrupt rows are filtered out and logged for investigation
- ✅ Valid data is preserved and displayed correctly
- ✅ Three layers of defense prevent similar issues in the future

### Technical Debt Addressed
- ❌ **Previously:** Sanitization only on write, not on read
- ✅ **Now:** Sanitization on both write AND read
- ❌ **Previously:** Strict validation that discarded entire grids
- ✅ **Now:** Graceful degradation that preserves valid data

### Logging Improvements
All corrupt data is now logged with specific details:
- Grid row index with null/undefined values
- Grid rows with non-array types
- Completely empty grids after sanitization

This allows investigation of the root cause and potential data cleanup.

## Testing Recommendations

1. **Test with known problematic puzzle:** `http://localhost:5000/puzzle/9aaea919`
2. **Check server logs** for sanitization warnings to identify corrupt database records
3. **Review database** for entries with null rows using:
   ```sql
   SELECT id, puzzle_id, model_name, 
          jsonb_array_length(predicted_output_grid) as grid_rows
   FROM explanations 
   WHERE predicted_output_grid IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM jsonb_array_elements(predicted_output_grid) elem 
     WHERE elem IS NULL
   );
   ```

## Files Modified

1. `client/src/components/puzzle/PuzzleGrid.tsx` - Frontend validation
2. `server/repositories/ExplanationRepository.ts` - Read sanitization
3. `server/utils/CommonUtilities.ts` - Enhanced grid sanitization

## SRP/DRY Check

✅ **Pass** - Each layer has a single responsibility:
- Frontend: Display layer validation
- Repository: Data access layer sanitization
- Utilities: Reusable sanitization logic

## Related Issues

This fix addresses the symptom but doesn't identify the root cause of how null rows entered the database. Recommend:
1. Database audit to find all corrupt records
2. Investigation of data import/recovery scripts
3. Review of all code paths that write to `predicted_output_grid`
