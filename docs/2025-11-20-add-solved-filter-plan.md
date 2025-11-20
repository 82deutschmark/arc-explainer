Author: Claude Code using Sonnet 4.5
Date: 2025-11-20
PURPOSE: Implementation plan for adding "solved status" filter to PuzzleBrowser page. This filter will allow users to see puzzles that have never been solved by any LLM, or only those that have been solved.
SRP/DRY check: Pass - Following existing filter patterns from PuzzleBrowser, reusing filter UI patterns

# Implementation Plan: Add Solved Status Filter to PuzzleBrowser

## Overview
Add a new filter option to the PuzzleBrowser page that allows users to filter puzzles based on whether they have been solved by any LLM model.

**Definition of "Solved"**: A puzzle is considered "solved" if at least one AI model has produced a correct prediction for it (matching the logic in MetricsRepository.ts:897-901).

## Architecture Analysis

### Current State
- **Component**: `/client/src/pages/PuzzleBrowser.tsx` (431 lines)
- **Pattern**: Client-side filtering on enriched puzzle metadata
- **Template**: "Explanation Status" filter (lines 254-264) - perfect pattern to follow
- **Data Flow**:
  1. `usePuzzleList()` hook fetches puzzles
  2. `puzzleService.getPuzzleList()` enriches with explanation data
  3. `explanationRepository.getBulkExplanationStatus()` adds metadata fields
  4. Client applies filters to enriched data

### Solved Status Logic (from MetricsRepository.ts)
```typescript
// A puzzle is "solved" if ANY model got it correct
const isSolved = results.some(r => r === 'correct');
```

### Correctness Determination Rules
From `shared/utils/correctness.ts` and `CORRECTNESS_LOGIC_PATTERN.md`:
- **Single test**: Check `is_prediction_correct = true`
- **Multi-test**: Check `multi_test_all_correct = true`
- Use proper COALESCE handling for nullable fields

## Implementation Steps

### Step 1: Update Type Definitions
**File**: Check where `EnhancedPuzzleMetadata` is defined (likely in shared types or service)

**Action**: Add new field to interface
```typescript
interface EnhancedPuzzleMetadata extends PuzzleMetadata {
  // ... existing fields ...
  hasExplanation?: boolean;
  isSolved?: boolean;  // ← NEW: true if any model solved this puzzle
}
```

**SRP/DRY**: Reuses existing type extension pattern for metadata enrichment

---

### Step 2: Update ExplanationRepository Query
**File**: `/server/repositories/ExplanationRepository.ts`

**Target Method**: `getBulkExplanationStatus()` (find exact location during implementation)

**Action**: Add solved status check to the bulk query

**Query Pattern** (following CORRECTNESS_LOGIC_PATTERN.md):
```sql
-- Add to SELECT list:
CASE
  WHEN EXISTS (
    SELECT 1
    FROM explanations e2
    WHERE e2.puzzle_id = e.puzzle_id
    AND (
      (COALESCE(e2.has_multiple_predictions, false) = false
       AND COALESCE(e2.is_prediction_correct, false) = true)
      OR
      (COALESCE(e2.has_multiple_predictions, false) = true
       AND COALESCE(e2.multi_test_all_correct, false) = true)
    )
  ) THEN true
  ELSE false
END as is_solved
```

**Implementation Note**:
- Use parameterized queries
- Follow existing repository patterns for correctness checks
- Reference `ExplanationRepository.getExplanationSummariesForPuzzle()` (lines 246-268) for correctness logic template

**SRP/DRY**:
- Reuses existing correctness determination logic
- Centralizes "solved status" calculation in repository layer
- Pass: Uses shared correctness pattern

---

### Step 3: Update PuzzleService to Map Solved Status
**File**: `/server/services/puzzleService.ts`

**Target Method**: `getPuzzleList()` (lines 47-114)

**Action**: Map the `is_solved` field from explanation status to puzzle metadata

**Current Pattern** (lines 78-102):
```typescript
const explanationStatusMap = await repositoryService.explanations.getBulkExplanationStatus(puzzleIds);

puzzleList.forEach(puzzle => {
  const status = explanationStatusMap.get(puzzle.id);
  if (status) {
    puzzle.hasExplanation = true;
    puzzle.explanationId = status.id;
    // ... other mappings ...
  }
});
```

**New Mapping**:
```typescript
puzzleList.forEach(puzzle => {
  const status = explanationStatusMap.get(puzzle.id);
  if (status) {
    puzzle.hasExplanation = true;
    puzzle.isSolved = status.isSolved || false;  // ← NEW
    // ... other mappings ...
  } else {
    puzzle.isSolved = false;  // No explanations = not solved
  }
});
```

**SRP/DRY**: Pass - Follows existing mapping pattern, no duplication

---

### Step 4: Add Filter UI Component
**File**: `/client/src/pages/PuzzleBrowser.tsx`

**Location**: After "Explanation Status" filter (after line 264)

**Action**: Add new filter dropdown following exact same pattern

**Code Template** (based on lines 254-264):
```typescript
<div className="space-y-2">
  <Label className="text-sm font-medium">Solved Status</Label>
  <Select
    value={solvedFilter}
    onValueChange={(value: 'all' | 'unsolved' | 'solved') => setSolvedFilter(value)}
  >
    <SelectTrigger className="w-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Puzzles</SelectItem>
      <SelectItem value="unsolved">Never Solved by LLM</SelectItem>
      <SelectItem value="solved">Solved by at Least One LLM</SelectItem>
    </SelectContent>
  </Select>
</div>
```

**State Management**:
```typescript
const [solvedFilter, setSolvedFilter] = useState<'all' | 'unsolved' | 'solved'>('all');
```

**SRP/DRY**:
- Pass: Reuses existing Select component from shadcn/ui
- Pass: Follows exact same pattern as explanationFilter

---

### Step 5: Add Client-Side Filtering Logic
**File**: `/client/src/pages/PuzzleBrowser.tsx`

**Location**: After explanation filter logic (after line 91)

**Action**: Add solved status filtering

**Code** (based on lines 86-91):
```typescript
// Apply explanation filter
if (explanationFilter === 'unexplained') {
  filtered = filtered.filter(puzzle => !puzzle.hasExplanation);
} else if (explanationFilter === 'explained') {
  filtered = filtered.filter(puzzle => puzzle.hasExplanation);
}

// Apply solved status filter ← NEW
if (solvedFilter === 'unsolved') {
  filtered = filtered.filter(puzzle => !puzzle.isSolved);
} else if (solvedFilter === 'solved') {
  filtered = filtered.filter(puzzle => puzzle.isSolved);
}
```

**SRP/DRY**: Pass - Uses same filter pattern, no code duplication

---

### Step 6: Update Active Filters Display
**File**: `/client/src/pages/PuzzleBrowser.tsx`

**Location**: Active filters section (lines 328-346)

**Action**: Add badge for solved filter when active

**Code** (following existing badge pattern):
```typescript
{solvedFilter !== 'all' && (
  <Badge variant="secondary" className="flex items-center gap-1">
    {solvedFilter === 'unsolved' ? 'Never Solved' : 'Solved by LLM'}
    <Button
      variant="ghost"
      size="sm"
      className="h-4 w-4 p-0 hover:bg-transparent"
      onClick={() => setSolvedFilter('all')}
    >
      <X className="h-3 w-3" />
    </Button>
  </Badge>
)}
```

**SRP/DRY**: Pass - Reuses Badge and Button components, follows existing pattern

---

### Step 7: Testing Plan
1. **Manual Testing**:
   - Verify "All Puzzles" shows everything
   - Filter by "Never Solved by LLM" - should show only unsolved
   - Filter by "Solved by at Least One LLM" - should show only solved
   - Combine with other filters (explanation status, grid size, etc.)
   - Verify active filter badges work correctly

2. **Data Verification**:
   - Check database for known solved puzzles (correctness = true)
   - Verify those puzzles appear when "Solved" filter is active
   - Check that puzzles with no correct predictions appear in "Unsolved"

3. **Performance**:
   - Monitor query performance with `getBulkExplanationStatus()` changes
   - Ensure client-side filtering remains fast with new field

4. **Edge Cases**:
   - Puzzles with no explanations at all (should be "unsolved")
   - Puzzles with multiple explanations, only some correct (should be "solved")
   - Puzzles with only incorrect explanations (should be "unsolved")

---

## Files to Modify

| File | Purpose | Estimated Lines Changed |
|------|---------|------------------------|
| `server/repositories/ExplanationRepository.ts` | Add solved status query | ~20 lines |
| `server/services/puzzleService.ts` | Map isSolved field | ~5 lines |
| `client/src/pages/PuzzleBrowser.tsx` | Add filter UI and logic | ~30 lines |
| `shared/types/` or service file | Add isSolved to type def | ~1 line |

**Total Estimated Changes**: ~60 lines across 4 files

---

## Potential Issues & Solutions

### Issue 1: Performance with Large Dataset
**Problem**: Checking solved status for all puzzles might be slow
**Solution**: The subquery pattern with EXISTS should be efficient. If needed, could add a materialized view or cache

### Issue 2: Correctness Logic Complexity
**Problem**: Multi-test vs single-test logic is complex
**Solution**: Already well-established in codebase. Use CORRECTNESS_LOGIC_PATTERN.md and existing reference implementations

### Issue 3: Type Mismatches
**Problem**: TypeScript might complain if type definitions are spread across files
**Solution**: Ensure EnhancedPuzzleMetadata type is updated in all relevant locations (shared types, service returns, component props)

---

## Success Criteria
- [ ] Users can filter for "Never Solved by LLM" puzzles
- [ ] Users can filter for "Solved by at Least One LLM" puzzles
- [ ] Filter combines correctly with existing filters
- [ ] Active filter badge displays when solved filter is active
- [ ] No performance degradation on puzzle list page
- [ ] TypeScript compiles without errors
- [ ] Manual testing confirms correct filtering behavior

---

## Future Enhancements (Out of Scope)
- Add "Solve Rate %" to puzzle cards (requires additional aggregation)
- Show which specific model(s) solved each puzzle
- Add "Difficulty Score" based on solve rate and model confidence
- Server-side filtering option for better performance with large datasets

---

## Notes
- This filter is particularly valuable for researchers wanting to focus on unsolved puzzles
- Could be extended to show "solve rate" or "number of models that solved"
- The client-side filtering approach keeps the implementation simple and consistent with existing patterns
- Query pattern follows established correctness logic from CORRECTNESS_LOGIC_PATTERN.md
