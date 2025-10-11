# Fix Plan: Correct "solved/failed" to "correct/incorrect" Terminology

**Author:** Cascade (GPT-4)  
**Date:** 2025-10-10  
**Priority:** HIGH - Affects data consistency and developer understanding

## Problem Statement

The project has inconsistent terminology for puzzle-solving accuracy:
- **Backend/Database**: Uses `correct`/`incorrect` (✓ CORRECT)
- **Frontend Hook**: Maps to `solved`/`failed` (✗ WRONG)
- **Frontend Components**: Mix of both terms causing confusion

### Semantic Confusion
- `correct`/`incorrect` = Puzzle-solving accuracy (intended meaning)
- `failed` = API call failure (technical error) - totally different concept
- `solved` = Not standard terminology in this project

## Root Cause

1. **Backend Repository** (`ModelDatasetRepository.ts`): Returns `correct`, `incorrect`, `notAttempted` ✓
2. **Backend Controller** (`modelDatasetController.ts`): 
   - Passes through correctly ✓
   - BUT has wrong documentation (line 6: "solved/failed") ✗
3. **Frontend Hook** (`useModelDatasetPerformance.ts`):
   - Lines 18-26: Interface uses `solved`/`failed` ✗
   - Lines 84-98: Unnecessary mapping from backend's correct terms ✗
4. **Frontend Component** (`AnalyticsOverview.tsx`):
   - Tried to use `correct`/`incorrect` but TypeScript errors forced wrong terms ✗

## Comprehensive Fix Plan

### Phase 1: Core Hook Fix (CRITICAL)
**File:** `client/src/hooks/useModelDatasetPerformance.ts`

1. Update `ModelDatasetPerformance` interface (lines 15-27):
   ```typescript
   export interface ModelDatasetPerformance {
     modelName: string;
     dataset: string;
     correct: string[];      // Was: solved
     incorrect: string[];    // Was: failed
     notAttempted: string[];
     summary: {
       correct: number;      // Was: solved
       incorrect: number;    // Was: failed
       notAttempted: number;
       totalPuzzles: number;
     };
   }
   ```

2. Remove unnecessary mapping (lines 84-98):
   ```typescript
   // BEFORE:
   solved: backendData.correct || [],
   failed: backendData.incorrect || [],
   
   // AFTER (just pass through):
   correct: backendData.correct || [],
   incorrect: backendData.incorrect || [],
   ```

### Phase 2: Component Fixes
**File:** `client/src/pages/AnalyticsOverview.tsx`

Already fixed in lines 361-432 - uses `correct`/`incorrect` ✓
Once hook is fixed, these will work properly.

### Phase 3: Documentation Fixes
**File:** `server/controllers/modelDatasetController.ts`

Update line 6 comment:
```typescript
// BEFORE:
// Provides REAL database queries showing which ARC evaluation puzzles each model solved/failed/hasn't attempted.

// AFTER:
// Provides REAL database queries showing which ARC evaluation puzzles each model got correct/incorrect/hasn't attempted.
```

### Phase 4: Scope Check - Other Files
**Files with "solved" or "failed":** 32 files with 124 matches

Need to check if they're:
- Related to puzzle accuracy (need fix) 
- Related to API errors (legitimate use)
- Different context (ignore)

**Priority files to check:**
1. `ModelBrowser.tsx` (17 matches) - HIGH PRIORITY
2. `useAnalysisResults.ts` (9 matches)
3. `ModelDebate.tsx` (8 matches)
4. `useGroverProgress.ts` (6 matches)

**Lower priority:** Progress hooks, batch components (may use "failed" for API errors legitimately)

## Implementation Order

1. ✅ Fix `useModelDatasetPerformance.ts` hook interface and mapping
2. ✅ Verify `AnalyticsOverview.tsx` works (already updated)
3. ✅ Fix controller documentation
4. ⏳ Check and fix high-priority files (ModelBrowser, etc.)
5. ⏳ Update CHANGELOG with comprehensive entry
6. ⏳ Test UI to ensure everything works

## Expected Outcome

- **Consistent terminology**: `correct`/`incorrect` for puzzle accuracy everywhere
- **Clear semantics**: `failed` reserved for API/technical errors only
- **Working UI**: AnalyticsOverview displays model performance correctly
- **Better DX**: No more confusion between puzzle accuracy and API errors

## Testing Checklist

- [ ] AnalyticsOverview page loads without errors
- [ ] Model performance stats display correctly
- [ ] Puzzle badges render in correct categories
- [ ] Model comparison dialog works
- [ ] No TypeScript errors in IDE

## Files to Commit

1. `client/src/hooks/useModelDatasetPerformance.ts`
2. `client/src/pages/AnalyticsOverview.tsx`
3. `server/controllers/modelDatasetController.ts`
4. `docs/2025-10-10-fix-solved-failed-terminology.md` (this file)
5. `CHANGELOG.md`

---

## Notes

The confusion likely started when a previous developer documented the API as "solved/failed" instead of "correct/incorrect", then implemented a hook that matched the wrong documentation instead of the actual backend data structure.
