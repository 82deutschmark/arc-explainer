Author: Claude Code using Sonnet 4.5
Date: 2025-11-20
PURPOSE: Implementation plan for adding "solved status" tracking and changing default sort behavior on PuzzleBrowser page. The primary goal is to show puzzles that have been ATTEMPTED but NEVER SOLVED first (highest priority for research), with never-attempted puzzles showing last.
SRP/DRY check: Pass - Following existing sort patterns from PuzzleBrowser, reusing sort logic patterns

# Implementation Plan: Add Solved Status Tracking and Change Default Sort

## Overview
Add solved status tracking to puzzle metadata and change the default sort behavior to prioritize puzzles that are most interesting for research:

**NEW DEFAULT PRIORITY ORDER:**
1. **HIGHEST**: Attempted but unsolved (has explanations, but all are incorrect)
2. **MEDIUM**: Solved by at least one LLM (has explanations, at least one correct)
3. **LOWEST**: Never attempted (no explanations at all)

**Current Problem**: Default sort is `'unexplained_first'` (line 50 of PuzzleBrowser.tsx), which shows never-attempted puzzles first - the OPPOSITE of what we want!

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

### Step 4: Create New Sort Option 'unsolved_first'
**File**: `/client/src/pages/PuzzleBrowser.tsx`

**Location**: Add new case to sort switch statement (after line 104)

**Action**: Add new sort logic that prioritizes attempted-but-unsolved puzzles

**Current Context** (lines 94-104):
```typescript
// Apply sorting
if (sortBy !== 'default') {
  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'unexplained_first':
        // Sort unexplained puzzles first, then by puzzle ID
        const aHasExplanation = a.hasExplanation ? 1 : 0;
        const bHasExplanation = b.hasExplanation ? 1 : 0;
        if (aHasExplanation !== bHasExplanation) {
          return aHasExplanation - bHasExplanation; // Unexplained (0) comes before explained (1)
        }
        return a.id.localeCompare(b.id);
```

**New Sort Case** (add after 'unexplained_first'):
```typescript
case 'unsolved_first':
  // Priority 1: Attempted but unsolved (hasExplanation=true, isSolved=false)
  // Priority 2: Solved (hasExplanation=true, isSolved=true)
  // Priority 3: Never attempted (hasExplanation=false)

  // Calculate priority score (lower is higher priority)
  const getPriority = (puzzle: EnhancedPuzzleMetadata) => {
    if (puzzle.hasExplanation && !puzzle.isSolved) return 1; // Attempted but unsolved
    if (puzzle.hasExplanation && puzzle.isSolved) return 2;  // Solved
    return 3; // Never attempted
  };

  const aPriority = getPriority(a);
  const bPriority = getPriority(b);

  if (aPriority !== bPriority) {
    return aPriority - bPriority; // Lower priority number comes first
  }
  return a.id.localeCompare(b.id); // Secondary sort by puzzle ID
```

**SRP/DRY**:
- Pass: Follows existing sort pattern structure
- Pass: Reuses same switch/case organization

---

### Step 5: Change Default Sort to 'unsolved_first'
**File**: `/client/src/pages/PuzzleBrowser.tsx`

**Location**: Line 50

**Action**: Change default sortBy from 'unexplained_first' to 'unsolved_first'

**Current Code** (line 50):
```typescript
const [sortBy, setSortBy] = useState<string>('unexplained_first');
```

**Updated Code**:
```typescript
const [sortBy, setSortBy] = useState<string>('unsolved_first');
```

**Impact**: This immediately changes the default behavior to show attempted-but-unsolved puzzles first!

**SRP/DRY**: Pass - Simple config change, no duplication

---

### Step 6: Add 'Unsolved First' to Sort Dropdown UI
**File**: `/client/src/pages/PuzzleBrowser.tsx`

**Location**: Find the sort dropdown SelectContent (around lines 310-324)

**Action**: Add new option for 'unsolved_first' sort

**Example Pattern**:
```typescript
<SelectContent>
  <SelectItem value="unsolved_first">Unsolved First (Attempted)</SelectItem>  {/* ← NEW */}
  <SelectItem value="unexplained_first">Unexplained First</SelectItem>
  <SelectItem value="processing_time">Processing Time</SelectItem>
  <SelectItem value="confidence">Confidence</SelectItem>
  <SelectItem value="cost">Cost</SelectItem>
  <SelectItem value="created_at">Created At</SelectItem>
  <SelectItem value="least_analysis_data">Least Analysis Data</SelectItem>
</SelectContent>
```

**Label**: Use "Unsolved First (Attempted)" to clarify it prioritizes puzzles that have been tried but not solved

**SRP/DRY**: Pass - Adds new option to existing dropdown, follows pattern

---

### Step 7: (Optional) Add Solved Status Filter for Manual Filtering
**File**: `/client/src/pages/PuzzleBrowser.tsx`

**Location**: After "Explanation Status" filter (after line 264)

**Action**: Optionally add filter dropdown for users who want to manually filter

**Note**: This is **optional** since the new default sort already prioritizes unsolved puzzles. However, it could be useful for users who want to see ONLY unsolved or ONLY solved puzzles.

**Code Template** (same as original plan):
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

**Filter Logic** (add after line 91):
```typescript
// Apply solved status filter (if implemented)
if (solvedFilter === 'unsolved') {
  filtered = filtered.filter(puzzle => !puzzle.isSolved);
} else if (solvedFilter === 'solved') {
  filtered = filtered.filter(puzzle => puzzle.isSolved);
}
```

**SRP/DRY**: Pass - Reuses existing filter patterns

---

### Step 8: Testing Plan
1. **Default Sort Behavior** (MOST IMPORTANT):
   - Load PuzzleBrowser page (should default to 'unsolved_first' sort)
   - Verify first puzzles shown have `hasExplanation=true` and `isSolved=false` (attempted but unsolved)
   - Scroll down to verify solved puzzles appear next
   - Scroll further to verify never-attempted puzzles appear last
   - **Expected Order**: Attempted-but-unsolved → Solved → Never-attempted

2. **Sort Dropdown Testing**:
   - Select "Unsolved First (Attempted)" - should maintain new priority order
   - Select "Unexplained First" - should show old behavior (never-attempted first)
   - Switch between different sort options to verify they all work
   - Verify secondary sort by puzzle ID works within each priority group

3. **Data Verification**:
   - Check database for known solved puzzles (correctness = true)
   - Verify those puzzles appear in "Priority 2" group
   - Check puzzles with only incorrect explanations appear in "Priority 1" group
   - Verify puzzles with no explanations appear in "Priority 3" group

4. **Performance**:
   - Monitor query performance with `getBulkExplanationStatus()` changes
   - Ensure client-side sorting remains fast with new field
   - Test with full dataset to ensure no lag

5. **Edge Cases**:
   - Puzzle with no explanations → should be Priority 3 (never attempted)
   - Puzzle with multiple explanations, all incorrect → Priority 1 (attempted but unsolved)
   - Puzzle with multiple explanations, at least one correct → Priority 2 (solved)
   - Puzzle with single correct explanation → Priority 2 (solved)

6. **(Optional) Filter Testing** (if Step 7 implemented):
   - Filter by "Never Solved by LLM" - should show only Priority 1 + Priority 3
   - Filter by "Solved by at Least One LLM" - should show only Priority 2
   - Combine with other filters (explanation status, grid size, etc.)

---

## Files to Modify

| File | Purpose | Estimated Lines Changed |
|------|---------|------------------------|
| `server/repositories/ExplanationRepository.ts` | Add solved status query | ~20 lines |
| `server/services/puzzleService.ts` | Map isSolved field | ~5 lines |
| `client/src/pages/PuzzleBrowser.tsx` | Add sort logic + change default | ~25 lines |
| `shared/types/` or service file | Add isSolved to type def | ~1 line |
| `client/src/pages/PuzzleBrowser.tsx` (optional) | Add filter UI for manual filtering | ~30 lines (optional) |

**Total Estimated Changes**: ~51 lines across 4 files (core), +30 optional for filter UI

**Key Changes**:
1. **Backend**: Add `isSolved` status to puzzle metadata
2. **Frontend**: New 'unsolved_first' sort option with 3-tier priority
3. **Default Behavior**: Change from 'unexplained_first' to 'unsolved_first' (1 line change!)
4. **(Optional)**: Add manual filter UI for solved status

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
- [ ] **Primary**: Default sort shows attempted-but-unsolved puzzles first
- [ ] **Primary**: Solved puzzles appear in middle (Priority 2)
- [ ] **Primary**: Never-attempted puzzles appear last (Priority 3)
- [ ] New 'unsolved_first' sort option appears in dropdown
- [ ] Sort option labeled clearly: "Unsolved First (Attempted)"
- [ ] Users can still select other sort options (processing time, confidence, etc.)
- [ ] No performance degradation on puzzle list page
- [ ] TypeScript compiles without errors
- [ ] Manual testing confirms correct 3-tier priority ordering
- [ ] **(Optional)**: Manual filter UI for solved status (if Step 7 implemented)

---

## Future Enhancements (Out of Scope)
- Add "Solve Rate %" to puzzle cards (requires additional aggregation)
- Show which specific model(s) solved each puzzle
- Add "Difficulty Score" based on solve rate and model confidence
- Add visual indicators (badges, colors) for solved vs unsolved puzzles
- Server-side sorting option for better performance with large datasets
- Analytics: track which puzzles are most commonly attempted but never solved

---

## Notes
- This new default sort is particularly valuable for researchers wanting to focus on challenging unsolved puzzles
- The 3-tier priority system automatically surfaces the most interesting puzzles
- Could be extended to show "solve rate" or "number of models that solved"
- The client-side sorting approach keeps the implementation simple and consistent with existing patterns
- Query pattern follows established correctness logic from CORRECTNESS_LOGIC_PATTERN.md
- **Key Insight**: Attempted-but-unsolved puzzles are more valuable than never-attempted ones for research purposes!
