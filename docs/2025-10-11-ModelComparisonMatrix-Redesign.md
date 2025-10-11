# Model Comparison Matrix Redesign

**Author:** Cascade using Claude Sonnet 4.5  
**Date:** 2025-10-11T16:09:00-04:00  
**Purpose:** Fix bugs and redesign model comparison matrix for maximum data density and usability

---

## Problems to Fix

### 1. Not Attempted vs Incorrect Logic Bug
**Location:** `server/repositories/MetricsRepository.ts` line 748-760

**Current Bug:**
```sql
SELECT DISTINCT ON (puzzle_id, model_name)
  puzzle_id,
  model_name,
  (is_prediction_correct = TRUE OR multi_test_all_correct = TRUE) as is_correct,
  created_at
FROM explanations
WHERE model_name = ANY($1::text[]) 
AND puzzle_id = ANY($2::text[])
```

Problem: Returns ALL explanations, even non-solver entries. NULL correctness → FALSE → marked "incorrect"

**Fix:** Add prediction filter (following `ModelDatasetRepository` pattern):
```sql
AND (predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL)
```

---

### 2. Poor Visual Design
**Problem:** 120-column horizontal table, sea of ❌, rare ✅ invisible

**Solution:** Grouped badge sections showing:
- Model A Only Correct (5 puzzles) ← MOST INTERESTING
- Model B Only Correct (4 puzzles)
- Model C Only Correct (3 puzzles)
- All Models Correct (2 puzzles)
- All Models Incorrect (108 puzzles, collapsed by default)

Uses `ClickablePuzzleBadge` in dense grids for maximum data density.

---

### 3. Wrong Default Models
**Current:** Auto-selects `grok-4` or first available
**Fix:** Default to:
- Primary: `gpt-5-pro-attempt1`
- Secondary: `claude-4-5-sonnet-32k`

---

### 4. Hardcoded Model Limits
**Current:** Types limited to model1-4, logic breaks with more models
**Fix:** Use dynamic arrays, no hardcoded limits

---

## Implementation Plan

### Phase 1: Backend Fix (MetricsRepository)
- [ ] Add prediction filter to query
- [ ] Update result mapping to handle dynamic model count
- [ ] Update types to support unlimited models

### Phase 2: Frontend Types
- [ ] Remove model1-4 hardcoding from types
- [ ] Use dynamic model arrays

### Phase 3: Default Model Selection
- [ ] Update AnalyticsOverview to default to specified models

### Phase 4: Matrix Redesign
- [ ] Create grouped section layout
- [ ] Use ClickablePuzzleBadge grids
- [ ] Add collapse/expand for large sections
- [ ] Show counts in section headers

### Phase 5: Testing
- [ ] Test with 2 models
- [ ] Test with 3+ models
- [ ] Verify "not attempted" logic
- [ ] Check data density

---

## Technical Details

### New Comparison Result Structure
```typescript
interface ModelComparisonResult {
  summary: {
    totalPuzzles: number;
    modelNames: string[]; // Dynamic array
    dataset: string;
    allCorrect: number;
    allIncorrect: number;
    allNotAttempted: number;
    modelOnlyCorrect: { [modelName: string]: number }; // Dynamic
  };
  details: PuzzleComparisonDetail[];
}

interface PuzzleComparisonDetail {
  puzzleId: string;
  results: { [modelName: string]: 'correct' | 'incorrect' | 'not_attempted' };
}
```

### Grouped Sections Logic
```typescript
// Group puzzles by result pattern
const groupedPuzzles = {
  modelOnlyCorrect: { [modelName: string]: string[] },
  allCorrect: string[],
  allIncorrect: string[],
  mixedResults: string[] // Some correct, some incorrect
};
```

---

## Files to Modify

1. `server/repositories/MetricsRepository.ts` - Query fix, dynamic models
2. `shared/types.ts` or `client/src/pages/AnalyticsOverview.tsx` - Type updates
3. `client/src/pages/AnalyticsOverview.tsx` - Default model selection
4. `client/src/components/analytics/NewModelComparisonResults.tsx` - Complete redesign
5. `client/src/pages/ModelComparisonPage.tsx` - Update to pass new data structure

---

## Success Criteria

✅ No hardcoded model limits (works with 2, 3, 10+ models)  
✅ "Not attempted" only shows when NO prediction exists  
✅ Defaults to gpt-5-pro-attempt1 + claude-4-5-sonnet-32k  
✅ Grouped sections show interesting disagreements first  
✅ Maximum data density using ClickablePuzzleBadge grids  
✅ All correct/incorrect sections collapsible
