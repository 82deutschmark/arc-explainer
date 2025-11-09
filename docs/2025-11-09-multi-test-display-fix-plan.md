# Multi-Test Display Fix - Investigation & Fix Plan

**Date**: 2025-11-09  
**Author**: Claude Code using Sonnet 4.5  
**Issue**: AnalysisResultCard and StreamingAnalysisPanel not displaying multi-test results correctly

## Executive Summary

**ROOT CAUSE IDENTIFIED**: The `/api/puzzle/{puzzleId}/explanations/summary` endpoint used by PuzzleExaminer.tsx is missing critical JSONB fields (`multiplePredictedOutputs`, `multiTestResults`, `multiTestPredictionGrids`) needed to display multi-test grids and validation data.

**Impact**:
- PuzzleExaminer page shows only summary flags (multiTestAllCorrect) without actual grid data
- Users cannot see individual test predictions or validation results
- StreamingAnalysisPanel doesn't display completed multi-test results

**Test Case**: Puzzle `6ea4a07e` has multiple tests with results stored correctly in database.

---

## 1. Root Cause Analysis

### 1.1 Database Storage (VERIFIED CORRECT ✓)

**Location**: `/server/repositories/ExplanationRepository.ts` (lines 36-106)

Multi-test data is stored correctly in PostgreSQL:
- `multiple_predicted_outputs` (JSONB) - Contains prediction objects with `predictedOutput1`, `predictedOutput2`, etc.
- `multi_test_prediction_grids` (JSONB) - Array of grid arrays `[grid1[][], grid2[][]]`
- `multi_test_results` (JSONB) - Validation results with correctness flags
- `multi_test_all_correct` (BOOLEAN) - Summary flag
- `has_multiple_predictions` (BOOLEAN) - Indicator flag

**Evidence**: Lines 75, 99 in ExplanationRepository.ts show proper JSONB storage using `safeJsonStringify()`.

### 1.2 Data Retrieval - Full Query (WORKS CORRECTLY ✓)

**Location**: `/server/repositories/ExplanationRepository.ts` (lines 344-385)

The `getExplanationById()` method DOES include all fields:
```sql
SELECT 
  ...
  multiple_predicted_outputs AS "multiplePredictedOutputs",
  multi_test_results AS "multiTestResults",
  multi_test_prediction_grids AS "multiTestPredictionGrids",
  ...
FROM explanations WHERE id = $1
```

### 1.3 Data Retrieval - Summary Query (BROKEN ✗)

**Location**: `/server/repositories/ExplanationRepository.ts` (lines 227-342)

The `getExplanationSummariesForPuzzle()` method is MISSING these fields:
```sql
SELECT
  id,
  puzzle_id AS "puzzleId",
  ...
  multi_test_all_correct AS "multiTestAllCorrect",
  multi_test_average_accuracy AS "multiTestAverageAccuracy",
  -- MISSING: multiplePredictedOutputs
  -- MISSING: multiTestResults
  -- MISSING: multiTestPredictionGrids
FROM explanations
```

**Lines affected**: 293-331

### 1.4 Frontend Component - AnalysisResultCard (CORRECT ✓)

**Location**: `/client/src/components/puzzle/AnalysisResultCard.tsx` (lines 51-84)

The component has comprehensive multi-test logic:
1. **Primary extraction** (lines 54-66): Looks for `predictedOutput1`, `predictedOutput2`, etc.
2. **Fallback 1** (lines 69-76): Checks `multiTestPredictionGrids` JSONB
3. **Fallback 2** (lines 79-81): Checks `multiplePredictedOutputs` array

**Multi-test stats calculation** (lines 98-137):
- Uses `multiValidation` array when available (lines 124-136)
- Falls back to `multiTestAllCorrect` boolean when validation missing (lines 102-121)
- Correctly computes accuracy levels: 'all_correct', 'some_incorrect', 'all_incorrect'

### 1.5 Frontend Data Flow (PARTIAL ✗)

**Location**: `/client/src/pages/PuzzleExaminer.tsx` (lines 100-114)

PuzzleExaminer uses `usePaginatedExplanationSummaries()` which:
- Calls `/api/puzzle/{puzzleId}/explanations/summary` endpoint
- Receives ONLY summary fields (no JSONB data)
- Cannot display grids because data is missing

**Location**: `/client/src/hooks/useExplanation.ts` (lines 81-85)

The mapping hook correctly maps fields when they exist, but summary endpoint doesn't provide them.

### 1.6 StreamingAnalysisPanel (INCOMPLETE ✗)

**Location**: `/client/src/components/puzzle/StreamingAnalysisPanel.tsx`

**Current behavior**:
- Shows test input/output grids (lines 120-143)
- Shows reasoning and text output (lines 165-186)
- Does NOT show prediction grids or validation results
- Does NOT extract or display multi-test results from `structuredJson`

---

## 2. Component Usage Audit

### 2.1 Direct AnalysisResultCard Usage

**Files using AnalysisResultCard**:
1. `/client/src/components/puzzle/AnalysisResultListCard.tsx` - List view
2. `/client/src/pages/SaturnVisualSolver.tsx` - Saturn solver results
3. `/client/src/pages/PuzzleFeedback.tsx` - Feedback view
4. `/client/src/pages/EloComparison.tsx` - ELO comparison
5. `/client/src/components/puzzle/refinement/IterationCard.tsx` - Iteration display
6. `/client/src/components/puzzle/debate/*` - Debate components (3 files)

### 2.2 Data Source Analysis

| Component | Data Source | Has Multi-Test Fields? | Status |
|-----------|-------------|------------------------|--------|
| AnalysisResults (via PuzzleExaminer) | Summary API | ✗ NO | BROKEN |
| AnalysisResultListCard | Full fetch via loadFullResult | ✓ YES | WORKS |
| SaturnVisualSolver | Direct explanation fetch | ✓ YES | WORKS |
| EloComparison | Full explanation fetch | ✓ YES | WORKS |
| Debate components | Full explanation fetch | ✓ YES | WORKS |

**Key Finding**: Only PuzzleExaminer's summary view is affected because it uses the lightweight summary endpoint.

---

## 3. Data Structure Verification

### 3.1 ExplanationData Type (CORRECT ✓)

**Location**: `/client/src/types/puzzle.ts` (lines 90-163)

The type includes all necessary fields:
- `multiplePredictedOutputs` (line 140)
- `multiTestResults` (line 141)
- `multiTestAllCorrect` (line 142)
- `multiTestAverageAccuracy` (line 143)
- `hasMultiplePredictions` (line 144)
- `multiValidation` (lines 129-136) - Frontend-computed validation array
- `predictedOutputGrids` (line 128) - Frontend-computed grids array

### 3.2 Database Schema Mapping (CORRECT ✓)

**Location**: `/server/repositories/ExplanationRepository.ts` (lines 678-709)

The `mapRowToExplanation()` method correctly:
- Parses JSONB fields using `safeJsonParse()` (lines 694-697)
- Sanitizes grid data to remove null rows (lines 689, 697)
- Preserves boolean flags (lines 706-707)

### 3.3 API Response Type (MISSING FIELDS ✗)

**Location**: `/server/repositories/interfaces/IExplanationRepository.ts`

Need to verify that `ExplanationSummaryPage` type includes multi-test fields or create a separate fuller summary type.

---

## 4. Specific Investigation Points

### 4.1 Test Puzzle Data Verification

**Action**: Query database for puzzle `6ea4a07e` to verify data integrity.

```sql
SELECT 
  id, 
  puzzle_id, 
  model_name,
  has_multiple_predictions,
  multi_test_all_correct,
  jsonb_array_length(multi_test_prediction_grids) as grid_count,
  jsonb_typeof(multiplePredictedOutputs) as mult_pred_type,
  jsonb_typeof(multi_test_results) as results_type
FROM explanations 
WHERE puzzle_id = '6ea4a07e'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**: Should show JSONB arrays with multiple grids.

### 4.2 API Response Inspection

**Action**: Test the summary API endpoint directly.

```bash
curl http://localhost:5000/api/puzzle/6ea4a07e/explanations/summary?limit=1
```

**Expected**: Should be missing `multiplePredictedOutputs` and `multiTestPredictionGrids` fields.

### 4.3 Full Explanation Fetch Test

**Action**: Test the full explanation endpoint.

```bash
curl http://localhost:5000/api/explanations/{id}
```

**Expected**: Should include all multi-test JSONB fields.

### 4.4 JSONB Deserialization Test

**Action**: Verify PostgreSQL returns parsed JSON (not strings).

Check `mapRowToExplanation` debug logs to see if `row.multiplePredictedOutputs` is:
- Already an object (good - PostgreSQL auto-parses)
- A string (needs JSON.parse - should be handled by safeJsonParse)

---

## 5. Proposed Fix Strategy

### Priority 1: Fix Summary API Endpoint (CRITICAL)

**File**: `/server/repositories/ExplanationRepository.ts`  
**Method**: `getExplanationSummariesForPuzzle()` (lines 293-331)  
**Change**: Add missing JSONB fields to SELECT clause

```typescript
// BEFORE (line 293-324):
SELECT
  id,
  ...
  multi_test_all_correct AS "multiTestAllCorrect",
  multi_test_average_accuracy AS "multiTestAverageAccuracy",
  created_at AS "createdAt"
FROM explanations

// AFTER:
SELECT
  id,
  ...
  multi_test_all_correct AS "multiTestAllCorrect",
  multi_test_average_accuracy AS "multiTestAverageAccuracy",
  multiple_predicted_outputs AS "multiplePredictedOutputs",      // ADD
  multi_test_results AS "multiTestResults",                       // ADD
  multi_test_prediction_grids AS "multiTestPredictionGrids",     // ADD
  predicted_output_grid AS "predictedOutputGrid",                 // ADD (for single-test)
  is_prediction_correct AS "isPredictionCorrect",                 // ADD (for single-test)
  created_at AS "createdAt"
FROM explanations
```

**Impact**: 
- Fixes PuzzleExaminer multi-test display
- Adds ~1-5KB per explanation (grids are stored as JSONB)
- Performance impact minimal (already fetching 12 rows by default)

### Priority 2: Enhance StreamingAnalysisPanel (HIGH)

**File**: `/client/src/components/puzzle/StreamingAnalysisPanel.tsx`  
**Lines to modify**: After line 91 (where `visibleOutput` is computed)

**Add logic to**:
1. Extract prediction data from `structuredJson.analysis` when streaming completes
2. Display predicted grids using GridDisplay component
3. Show validation results if available
4. Use AnalysisResultGrid component for consistency

**New props needed**:
```typescript
interface StreamingAnalysisPanelProps {
  // ... existing props
  predictionData?: {
    predictedGrid?: number[][];
    predictedGrids?: number[][][];
    multiValidation?: Array<{ isPredictionCorrect: boolean; ... }>;
  };
}
```

**Alternative**: Reuse AnalysisResultCard after streaming completes instead of custom display.

### Priority 3: Add Loading State for Full Data (MEDIUM)

**File**: `/client/src/components/puzzle/AnalysisResults.tsx` (likely exists)

**Enhancement**: When user clicks to expand a summary card:
1. Call `loadFullResult(explanationId)` to fetch complete data
2. Show loading spinner during fetch
3. Replace summary data with full data once loaded
4. Cache full data to avoid re-fetching

**Current behavior** (from PuzzleExaminer.tsx line 188-198):
```typescript
const loadFullExplanation = useCallback(
  async (explanationId: number) => {
    const data = await queryClient.fetchQuery({
      queryKey: ['explanation-by-id', explanationId],
      queryFn: () => fetchExplanationById(explanationId)
    });
    return data;
  },
  [queryClient]
);
```

This function exists but might not be used for multi-test display.

### Priority 4: Type Safety Updates (LOW)

**Files to update**:
1. `/server/repositories/interfaces/IExplanationRepository.ts` - Update `ExplanationSummaryPage.items` type
2. `/shared/types.ts` - Ensure `ExplanationRecord` has all fields
3. `/client/src/types/puzzle.ts` - Already correct

---

## 6. Implementation Checklist

### Phase 1: Database & API Layer (30 min)
- [ ] Update `getExplanationSummariesForPuzzle()` SQL query to include JSONB fields
- [ ] Test SQL query directly in PostgreSQL with puzzle `6ea4a07e`
- [ ] Verify JSONB fields are properly parsed by `mapRowToExplanation()`
- [ ] Test API endpoint returns complete data: `GET /api/puzzle/6ea4a07e/explanations/summary`

### Phase 2: Frontend Display (45 min)
- [ ] Test PuzzleExaminer page with puzzle `6ea4a07e`
- [ ] Verify AnalysisResultCard shows multi-test grids
- [ ] Verify multi-test stats display correctly (N/M correct)
- [ ] Check diff masks highlight mismatched cells

### Phase 3: Streaming Panel Enhancement (60 min)
- [ ] Extract prediction data from streaming `structuredJson`
- [ ] Add prediction grid display to StreamingAnalysisPanel
- [ ] Show validation results when available
- [ ] Test with multi-test puzzle streaming analysis

### Phase 4: Edge Cases & Testing (30 min)
- [ ] Test puzzle with single test case (backward compatibility)
- [ ] Test puzzle with no predictions (explanations only)
- [ ] Test puzzle with partial multi-test data (some grids missing)
- [ ] Test puzzle with all tests correct
- [ ] Test puzzle with some tests incorrect
- [ ] Test puzzle with all tests incorrect

---

## 7. Verification Plan

### 7.1 Database Verification
```sql
-- Check that puzzle 6ea4a07e has multi-test data
SELECT id, model_name, has_multiple_predictions, 
       jsonb_array_length(multi_test_prediction_grids) as num_grids
FROM explanations 
WHERE puzzle_id = '6ea4a07e';
```

### 7.2 API Verification
```bash
# Test summary endpoint (before fix - should be missing fields)
curl -s localhost:5000/api/puzzle/6ea4a07e/explanations/summary | jq '.data.items[0] | keys'

# After fix - should include multiplePredictedOutputs
curl -s localhost:5000/api/puzzle/6ea4a07e/explanations/summary | \
  jq '.data.items[0].multiplePredictedOutputs'
```

### 7.3 Frontend Verification
1. Navigate to `/puzzle/6ea4a07e`
2. Scroll to explanation card
3. Verify "Multi-Test Results (N/M correct)" section displays
4. Verify individual test grids are shown
5. Verify correctness indicators (✓/✗) appear
6. Toggle diff view and verify highlighting

### 7.4 Streaming Verification
1. Run new analysis on puzzle `6ea4a07e` with streaming model
2. Wait for completion
3. Verify streaming panel shows prediction grids
4. Close modal and verify results saved correctly

---

## 8. Performance Considerations

### 8.1 Data Size Impact
- Single grid (30x30 max): ~3.6KB JSON
- Multi-test (3 grids): ~11KB JSON
- Current summary fetch (12 items): +132KB worst case
- **Conclusion**: Acceptable overhead for better UX

### 8.2 Optimization Options (Future)
1. **Lazy loading**: Fetch grids on card expand (like `loadFullResult`)
2. **Pagination**: Already implemented (12 items per page)
3. **Grid compression**: Store as base64 strings (20% smaller)
4. **Separate endpoint**: `/summary-with-grids` vs `/summary-minimal`

---

## 9. Rollback Plan

If issues arise:
1. Revert `getExplanationSummariesForPuzzle()` changes
2. Users will see summary stats only (current behavior)
3. Full data still available via `loadFullResult()` mechanism
4. No data loss - all data remains in database

---

## 10. Success Criteria

- [ ] PuzzleExaminer displays multi-test grids for puzzle `6ea4a07e`
- [ ] Multi-test stats show "N/M correct" accurately
- [ ] Individual test validation results display
- [ ] Diff masks work for each test case
- [ ] StreamingAnalysisPanel shows prediction results
- [ ] No performance regression (page load < 2s)
- [ ] No console errors or warnings
- [ ] All existing tests pass

---

## Appendix A: Key File Locations

| Component | File Path | Lines of Interest |
|-----------|-----------|-------------------|
| Summary API SQL | `/server/repositories/ExplanationRepository.ts` | 293-331 |
| Full fetch SQL | `/server/repositories/ExplanationRepository.ts` | 344-385 |
| Data mapper | `/server/repositories/ExplanationRepository.ts` | 678-709 |
| AnalysisResultCard | `/client/src/components/puzzle/AnalysisResultCard.tsx` | 51-137 |
| PuzzleExaminer | `/client/src/pages/PuzzleExaminer.tsx` | 100-114 |
| StreamingPanel | `/client/src/components/puzzle/StreamingAnalysisPanel.tsx` | 37-197 |
| Type definitions | `/client/src/types/puzzle.ts` | 90-163 |

---

## Appendix B: Example Data Structure

### Database Row (PostgreSQL)
```json
{
  "id": 123,
  "puzzle_id": "6ea4a07e",
  "has_multiple_predictions": true,
  "multi_test_all_correct": false,
  "multiplePredictedOutputs": {
    "predictedOutput1": [[0,1],[1,0]],
    "predictedOutput2": [[1,0],[0,1]],
    "predictedOutput3": [[0,0],[1,1]]
  },
  "multi_test_prediction_grids": [
    [[0,1],[1,0]],
    [[1,0],[0,1]],
    [[0,0],[1,1]]
  ],
  "multi_test_results": [
    {"index": 0, "isPredictionCorrect": true, "trustworthinessScore": 0.95},
    {"index": 1, "isPredictionCorrect": false, "trustworthinessScore": 0.45},
    {"index": 2, "isPredictionCorrect": false, "trustworthinessScore": 0.50}
  ]
}
```

### Frontend ExplanationData
```typescript
{
  id: 123,
  puzzleId: "6ea4a07e",
  hasMultiplePredictions: true,
  multiTestAllCorrect: false,
  multiplePredictedOutputs: [
    [[0,1],[1,0]],
    [[1,0],[0,1]],
    [[0,0],[1,1]]
  ],
  multiValidation: [
    {index: 0, predictedGrid: [[0,1],[1,0]], isPredictionCorrect: true, trustworthinessScore: 0.95},
    {index: 1, predictedGrid: [[1,0],[0,1]], isPredictionCorrect: false, trustworthinessScore: 0.45},
    {index: 2, predictedGrid: [[0,0],[1,1]], isPredictionCorrect: false, trustworthinessScore: 0.50}
  ]
}
```

---

**END OF INVESTIGATION PLAN**
