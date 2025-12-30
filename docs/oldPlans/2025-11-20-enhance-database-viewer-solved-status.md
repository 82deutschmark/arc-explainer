Author: Claude Code using Sonnet 4.5
Date: 2025-11-20
PURPOSE: Enhancement plan for adding solved status tracking to PuzzleDBViewer (/puzzles/database page). Builds on the solved status implementation from PuzzleBrowser to provide researchers with better tools for identifying challenging unsolved puzzles across the entire ARC dataset.
SRP/DRY check: Pass - Reusing existing solved status logic from PuzzleBrowser implementation, following existing patterns in PuzzleDBViewer

# Enhancement Plan: Add Solved Status to PuzzleDBViewer

## Overview

Add solved status tracking to the PuzzleDBViewer page (`/puzzles/database`) to help researchers identify puzzles that have been attempted but never solved by any LLM. This enhancement leverages the `isSolved` field already implemented for PuzzleBrowser.

**Primary Goal**: Surface attempted-but-unsolved puzzles as highest priority for research on the database viewer page.

**Definition of "Solved"**: A puzzle is solved if at least one AI model produced a correct prediction (matching MetricsRepository.ts:897-901 and recent PuzzleBrowser implementation).

---

## Current State Analysis

### Page Details
- **File**: `/client/src/pages/PuzzleDBViewer.tsx` (1,098 lines)
- **Route**: `/puzzles/database`
- **Menu Label**: "Puzzle DB"
- **Purpose**: Individual puzzle database viewer showing explanation counts and binary accuracy
- **Data Source**: `/api/puzzles/stats` endpoint (returns 2,220+ puzzles from all datasets)

### Current Features

**Sort Options** (6 total):
1. `dangerous` - High confidence + wrong (≥80% conf, ≤30% acc)
2. `humble` - Lowest confidence first (<80%)
3. `research` - Most attempted (total attempts + model count)
4. `unexplored` - Zero attempts first
5. `accuracy` - Lowest accuracy first
6. `confidence` - Lowest confidence first

**Interest Level Badges** (5 categories):
1. `DANGEROUS` (Priority 1) - High confidence + wrong
2. `HUMBLE AI` (Priority 2) - Avg confidence <80%
3. `HOTSPOT` (Priority 3) - 15+ attempts (high research activity)
4. `UNEXPLORED` (Priority 4) - No attempts
5. `REGULAR` (Priority 5) - Standard puzzle

**Filter Toggles**:
- `showZeroOnly` - Unexplored puzzles only
- `dangerousOnly` - Overconfident failures only
- `humbleOnly` - Low confidence only
- `confidenceRange` - Range slider [0-100]
- `accuracyRange` - Range slider [0-100]
- `attemptRange` - Range slider [0-100]
- `sourceFilter` - Dataset selection
- `searchQuery` - Search by puzzle ID

### Current Gaps

**Missing Features**:
1. ❌ No "attempted but unsolved" sort option
2. ❌ No "ATTEMPTED BUT UNSOLVED" interest badge
3. ❌ No `isSolved` field in performance data from `/api/puzzles/stats`
4. ❌ No filter for solved vs unsolved status
5. ❌ No solved/unsolved statistics in aggregate data
6. ❌ No visual indicators for solved status on cards

**Problem**: Researchers can't easily identify puzzles that LLMs have tried but never solved - the most valuable targets for research!

---

## Proposed Enhancements

### Enhancement 1: Add 'unsolved_first' Sort Option

**File**: `/client/src/pages/PuzzleDBViewer.tsx`

**Location**: Add to sortBy options (line 109)

**Action**: Add new sort option with 3-tier priority matching PuzzleBrowser:

**Priority Order**:
1. **HIGHEST**: Attempted but unsolved (totalExplanations > 0, isSolved = false)
2. **MEDIUM**: Solved (totalExplanations > 0, isSolved = true)
3. **LOWEST**: Never attempted (totalExplanations = 0)

**Implementation** (add around line 190):
```typescript
case 'unsolved_first':
  return sortedPuzzles.sort((a, b) => {
    const getPriority = (puzzle: PuzzleWithPerformance) => {
      const hasAttempts = puzzle.performanceData && puzzle.performanceData.totalExplanations > 0;
      if (hasAttempts && !puzzle.performanceData.isSolved) return 1; // Attempted but unsolved
      if (hasAttempts && puzzle.performanceData.isSolved) return 2;  // Solved
      return 3; // Never attempted
    };

    const aPriority = getPriority(a);
    const bPriority = getPriority(b);

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    return a.id.localeCompare(b.id); // Secondary sort by ID
  });
```

**UI Update** (line ~880 - sort dropdown):
```typescript
<option value="unsolved_first">Unsolved First (Attempted) ⭐ NEW</option>
<option value="dangerous">Dangerous (Overconfident Failures)</option>
<option value="humble">Humble AI (Low Confidence)</option>
<option value="research">Research Hotspots (Most Attempts)</option>
<option value="unexplored">Unexplored (Zero Attempts)</option>
<option value="accuracy">Lowest Accuracy</option>
<option value="confidence">Lowest Confidence</option>
```

**SRP/DRY**: Pass - Reuses exact same priority logic as PuzzleBrowser's 'unsolved_first' sort

---

### Enhancement 2: Add "ATTEMPTED BUT UNSOLVED" Interest Badge

**File**: `/client/src/pages/PuzzleDBViewer.tsx`

**Location**: Update `getPuzzleInterestLevel()` function (lines 23-78)

**Action**: Add new highest-priority badge for attempted-but-unsolved puzzles

**Current Priority Order**:
1. DANGEROUS (confidence ≥80%, accuracy ≤30%)
2. HUMBLE AI (confidence <80%)
3. HOTSPOT (15+ attempts)
4. UNEXPLORED (0 attempts)
5. REGULAR (everything else)

**New Priority Order**:
1. **UNSOLVED** (attempts > 0, isSolved = false) ← NEW!
2. DANGEROUS (confidence ≥80%, accuracy ≤30%)
3. HUMBLE AI (confidence <80%)
4. HOTSPOT (15+ attempts)
5. UNEXPLORED (0 attempts)
6. REGULAR (everything else)

**Implementation**:
```typescript
function getPuzzleInterestLevel(performanceData: PerformanceData | null) {
  if (!performanceData || performanceData.totalExplanations === 0) {
    return {
      variant: 'ghost' as const,
      text: 'UNEXPLORED',
      icon: '🔍',
      description: 'No attempts yet',
      priority: 6
    };
  }

  // NEW: Priority 1 - Attempted but never solved (highest research value!)
  if (performanceData.totalExplanations > 0 && !performanceData.isSolved) {
    return {
      variant: 'warning' as const,  // Orange/amber color
      text: 'UNSOLVED',
      icon: '🧩',
      description: 'Attempted but never solved by any LLM',
      priority: 1
    };
  }

  // Priority 2 - Dangerous (overconfident failures)
  if (performanceData.avgConfidence >= 80 && performanceData.avgAccuracy <= 0.30) {
    return {
      variant: 'error' as const,
      text: 'DANGEROUS',
      icon: '⚠️',
      description: 'High confidence but wrong',
      priority: 2
    };
  }

  // Priority 3 - Humble AI
  if (performanceData.avgConfidence < 80) {
    return {
      variant: 'info' as const,
      text: 'HUMBLE AI',
      icon: '🤔',
      description: 'Modest confidence',
      priority: 3
    };
  }

  // Priority 4 - Hotspot
  if (performanceData.totalExplanations >= 15) {
    return {
      variant: 'accent' as const,
      text: 'HOTSPOT',
      icon: '🔥',
      description: 'High research activity',
      priority: 4
    };
  }

  // Priority 5 - Solved (newly identified!)
  if (performanceData.isSolved) {
    return {
      variant: 'success' as const,
      text: 'SOLVED',
      icon: '✅',
      description: 'At least one model solved this',
      priority: 5
    };
  }

  // Priority 6 - Regular
  return {
    variant: 'ghost' as const,
    text: 'REGULAR',
    icon: '📝',
    description: 'Standard puzzle',
    priority: 6
  };
}
```

**Impact**: This immediately highlights the most valuable research targets at the top of the page!

**SRP/DRY**: Pass - Extends existing categorization pattern with minimal changes

---

### Enhancement 3: Add `isSolved` Field to API Response

**Files to Modify**:
1. `/server/services/puzzleOverviewService.ts`
2. `/server/repositories/interfaces/IPuzzleOverviewRepository.ts` (if exists)

**Location**: `getAllPuzzleStats()` method (lines 157-272 in puzzleOverviewService.ts)

**Current Query** (simplified):
```sql
SELECT
  p.puzzle_id,
  COUNT(e.id) as total_explanations,
  AVG(CASE WHEN e.is_prediction_correct ... END) as avg_accuracy,
  AVG(e.confidence) as avg_confidence,
  -- ... more fields
FROM puzzle_metadata p
LEFT JOIN explanations e ON p.puzzle_id = e.puzzle_id
GROUP BY p.puzzle_id
```

**Add `isSolved` Calculation**:
```sql
SELECT
  p.puzzle_id,
  COUNT(e.id) as total_explanations,
  AVG(CASE WHEN ... END) as avg_accuracy,
  AVG(e.confidence) as avg_confidence,
  -- ... existing fields ...

  -- NEW: Check if puzzle has at least one correct solution
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM explanations e2
      WHERE e2.puzzle_id = p.puzzle_id
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

FROM puzzle_metadata p
LEFT JOIN explanations e ON p.puzzle_id = e.puzzle_id
GROUP BY p.puzzle_id
```

**TypeScript Interface Update**:
```typescript
interface PerformanceData {
  totalExplanations: number;
  avgAccuracy: number;
  avgConfidence: number;
  wrongCount: number;
  // ... existing fields ...
  isSolved?: boolean; // NEW: Whether any model solved this puzzle
}
```

**SRP/DRY**: Pass - Uses same correctness logic from ExplanationRepository.getBulkExplanationStatus()

---

### Enhancement 4: Add Solved/Unsolved Filter Toggle

**File**: `/client/src/pages/PuzzleDBViewer.tsx`

**Location**: Add to state (around line 115) and filter section (around line 750)

**State Variable**:
```typescript
const [unsolvedOnly, setUnsolvedOnly] = useState(false);
```

**Filter Logic** (add to filtering section around line 135):
```typescript
// Apply unsolved filter
if (unsolvedOnly) {
  filtered = filtered.filter(puzzle => {
    if (!puzzle.performanceData) return true; // Keep unexplored
    return !puzzle.performanceData.isSolved;  // Keep only unsolved
  });
}
```

**UI Toggle** (add to filter panel around line 750):
```typescript
<div className="form-control">
  <label className="label cursor-pointer">
    <span className="label-text">🧩 Unsolved Only (Attempted but Never Solved)</span>
    <input
      type="checkbox"
      checked={unsolvedOnly}
      onChange={(e) => setUnsolvedOnly(e.target.checked)}
      className="checkbox checkbox-warning"
    />
  </label>
</div>
```

**Active Filter Badge** (add around line 845):
```typescript
{unsolvedOnly && (
  <div className="badge badge-warning gap-2">
    🧩 Unsolved Only
    <button onClick={() => setUnsolvedOnly(false)}>✕</button>
  </div>
)}
```

**SRP/DRY**: Pass - Follows existing filter toggle pattern (dangerousOnly, humbleOnly, showZeroOnly)

---

### Enhancement 5: Add Solved/Unsolved Statistics

**File**: `/client/src/pages/PuzzleDBViewer.tsx`

**Location**: Stats display section (around lines 220-250)

**Current Stats**:
- Total Puzzles
- Analyzed Puzzles
- Unexplored Puzzles
- Average Confidence
- Average Accuracy

**Add New Stats**:
```typescript
const solvedCount = filteredPuzzles.filter(p =>
  p.performanceData &&
  p.performanceData.totalExplanations > 0 &&
  p.performanceData.isSolved
).length;

const unsolvedCount = filteredPuzzles.filter(p =>
  p.performanceData &&
  p.performanceData.totalExplanations > 0 &&
  !p.performanceData.isSolved
).length;

const solveRate = analyzedCount > 0
  ? ((solvedCount / analyzedCount) * 100).toFixed(1)
  : '0.0';
```

**UI Display** (add to stats section):
```typescript
<div className="stat">
  <div className="stat-figure text-success">✅</div>
  <div className="stat-title">Solved Puzzles</div>
  <div className="stat-value text-success">{solvedCount}</div>
  <div className="stat-desc">At least one correct solution</div>
</div>

<div className="stat">
  <div className="stat-figure text-warning">🧩</div>
  <div className="stat-title">Unsolved Puzzles</div>
  <div className="stat-value text-warning">{unsolvedCount}</div>
  <div className="stat-desc">Attempted but never solved</div>
</div>

<div className="stat">
  <div className="stat-figure text-info">📊</div>
  <div className="stat-title">Solve Rate</div>
  <div className="stat-value text-info">{solveRate}%</div>
  <div className="stat-desc">Of analyzed puzzles</div>
</div>
```

**SRP/DRY**: Pass - Follows existing stats display pattern

---

### Enhancement 6: Add Visual Indicators on Puzzle Cards

**File**: `/client/src/pages/PuzzleDBViewer.tsx`

**Location**: Puzzle card rendering (around lines 600-800)

**Action**: Add solved status badge to each puzzle card

**Implementation** (add to card header):
```typescript
<div className="card-body">
  <div className="flex items-center justify-between">
    <h2 className="card-title">{puzzle.id}</h2>

    <div className="flex gap-2">
      {/* Interest Level Badge */}
      <div className={`badge badge-${interestLevel.variant}`}>
        {interestLevel.icon} {interestLevel.text}
      </div>

      {/* NEW: Solved Status Badge */}
      {puzzle.performanceData && puzzle.performanceData.totalExplanations > 0 && (
        <div className={`badge ${puzzle.performanceData.isSolved ? 'badge-success' : 'badge-warning'}`}>
          {puzzle.performanceData.isSolved ? '✅ Solved' : '🧩 Unsolved'}
        </div>
      )}

      {/* Source Badge */}
      <div className="badge badge-outline">{puzzle.source}</div>
    </div>
  </div>

  {/* ... rest of card ... */}
</div>
```

**Alternative**: Color-coded border for entire card
```typescript
<div className={`card bg-base-100 shadow-xl ${
  puzzle.performanceData?.totalExplanations > 0 && !puzzle.performanceData.isSolved
    ? 'border-2 border-warning'  // Orange border for unsolved
    : puzzle.performanceData?.isSolved
    ? 'border border-success'     // Green border for solved
    : ''
}`}>
```

**SRP/DRY**: Pass - Extends existing badge pattern on cards

---

### Enhancement 7: Update Multi-Puzzle Analysis Section

**File**: `/client/src/pages/PuzzleDBViewer.tsx`

**Location**: Difficulty Distribution (lines 497-539)

**Current Categories**:
- Dangerous count
- Humble AI count
- Hotspot count
- Unexplored count

**Add New Category**:
```typescript
const unsolvedCount = selectedPuzzles.filter(p =>
  p.performanceData &&
  p.performanceData.totalExplanations > 0 &&
  !p.performanceData.isSolved
).length;

const solvedCount = selectedPuzzles.filter(p =>
  p.performanceData?.isSolved
).length;
```

**UI Display** (add to distribution section):
```typescript
<div className="stat">
  <div className="stat-figure text-warning">🧩</div>
  <div className="stat-title">Unsolved</div>
  <div className="stat-value text-warning">{unsolvedCount}</div>
  <div className="stat-desc">Attempted but never solved</div>
</div>

<div className="stat">
  <div className="stat-figure text-success">✅</div>
  <div className="stat-title">Solved</div>
  <div className="stat-value text-success">{solvedCount}</div>
  <div className="stat-desc">At least one correct solution</div>
</div>
```

**SRP/DRY**: Pass - Follows existing distribution stats pattern

---

## Implementation Steps

### Step 1: Update Backend API to Include `isSolved`

**Files**:
- `/server/services/puzzleOverviewService.ts` (lines 157-272)

**Action**: Add `is_solved` calculation to SQL query in `getAllPuzzleStats()`

**Estimated Changes**: ~15 lines (SQL query + mapping)

---

### Step 2: Update TypeScript Interfaces

**Files**:
- `/client/src/pages/PuzzleDBViewer.tsx` (PerformanceData interface)

**Action**: Add `isSolved?: boolean` field

**Estimated Changes**: ~1 line

---

### Step 3: Add 'unsolved_first' Sort Option

**Files**:
- `/client/src/pages/PuzzleDBViewer.tsx` (sort logic + dropdown)

**Action**:
1. Add new case to sort switch statement
2. Add option to dropdown
3. Update default sort if desired

**Estimated Changes**: ~20 lines

---

### Step 4: Update Interest Level Badge Logic

**Files**:
- `/client/src/pages/PuzzleDBViewer.tsx` (`getPuzzleInterestLevel()` function)

**Action**: Add UNSOLVED as highest-priority badge

**Estimated Changes**: ~15 lines

---

### Step 5: Add Unsolved Filter Toggle

**Files**:
- `/client/src/pages/PuzzleDBViewer.tsx` (state + filter logic + UI)

**Action**: Add checkbox filter and filtering logic

**Estimated Changes**: ~10 lines

---

### Step 6: Add Solved/Unsolved Statistics

**Files**:
- `/client/src/pages/PuzzleDBViewer.tsx` (stats calculation + display)

**Action**: Add solved count, unsolved count, and solve rate to stats section

**Estimated Changes**: ~30 lines

---

### Step 7: Add Visual Indicators to Cards

**Files**:
- `/client/src/pages/PuzzleDBViewer.tsx` (card rendering)

**Action**: Add solved status badge to each card

**Estimated Changes**: ~10 lines

---

### Step 8: Update Multi-Puzzle Analysis

**Files**:
- `/client/src/pages/PuzzleDBViewer.tsx` (difficulty distribution)

**Action**: Add solved/unsolved counts to analysis section

**Estimated Changes**: ~20 lines

---

## Files to Modify

| File | Purpose | Est. Lines Changed |
|------|---------|-------------------|
| `/server/services/puzzleOverviewService.ts` | Add isSolved to SQL query | ~15 |
| `/client/src/pages/PuzzleDBViewer.tsx` | All frontend enhancements | ~120 |

**Total Estimated Changes**: ~135 lines across 2 files

---

## Testing Plan

### 1. Backend Testing
- [ ] Verify `/api/puzzles/stats` returns `isSolved` field
- [ ] Check correctness logic works for single-test puzzles
- [ ] Check correctness logic works for multi-test puzzles
- [ ] Verify performance (query time with EXISTS subquery)

### 2. Sort Testing
- [ ] Load page, verify 'unsolved_first' sort works
- [ ] Verify Priority 1 (unsolved) appears first
- [ ] Verify Priority 2 (solved) appears in middle
- [ ] Verify Priority 3 (never attempted) appears last
- [ ] Test other sort options still work

### 3. Badge Testing
- [ ] Verify UNSOLVED badge appears on attempted-but-unsolved puzzles
- [ ] Verify SOLVED badge appears on solved puzzles
- [ ] Verify UNEXPLORED badge appears on never-attempted puzzles
- [ ] Verify DANGEROUS badge still works correctly
- [ ] Check badge priority order is correct

### 4. Filter Testing
- [ ] Enable "Unsolved Only" filter
- [ ] Verify only attempted-but-unsolved + unexplored puzzles show
- [ ] Combine with other filters (dangerous, humble, etc.)
- [ ] Verify active filter badge appears

### 5. Statistics Testing
- [ ] Verify solved count is accurate
- [ ] Verify unsolved count is accurate
- [ ] Verify solve rate calculation is correct
- [ ] Check stats update when filters change

### 6. Visual Indicators Testing
- [ ] Verify solved badge appears on solved puzzle cards
- [ ] Verify unsolved badge appears on unsolved puzzle cards
- [ ] Check color scheme matches design system
- [ ] Test responsive layout on different screen sizes

### 7. Multi-Puzzle Analysis Testing
- [ ] Select multiple puzzles for analysis
- [ ] Verify unsolved count in difficulty distribution
- [ ] Verify solved count in difficulty distribution
- [ ] Check interaction with other distribution stats

---

## Success Criteria

- [ ] **Primary**: 'unsolved_first' sort prioritizes attempted-but-unsolved puzzles
- [ ] **Primary**: UNSOLVED badge appears on relevant puzzles (highest priority)
- [ ] **Primary**: Solved/unsolved statistics display correctly
- [ ] API returns `isSolved` field for all puzzles
- [ ] Sort dropdown includes "Unsolved First (Attempted)" option
- [ ] Filter toggle for "Unsolved Only" works correctly
- [ ] Visual indicators (badges) clearly distinguish solved vs unsolved
- [ ] Multi-puzzle analysis includes solved/unsolved breakdown
- [ ] No performance degradation on page load
- [ ] TypeScript compiles without errors
- [ ] All existing functionality continues to work

---

## Comparison: PuzzleBrowser vs PuzzleDBViewer

| Feature | PuzzleBrowser (After Enhancement) | PuzzleDBViewer (Proposed) |
|---------|-----------------------------------|---------------------------|
| **Solved Status Sort** | ✅ 'unsolved_first' (default) | ✅ 'unsolved_first' (proposed) |
| **Interest Badges** | ❌ None | ✅ UNSOLVED, DANGEROUS, HUMBLE, etc. |
| **Solved Filter** | ❌ None (could be optional) | ✅ "Unsolved Only" toggle |
| **Solved Statistics** | ❌ None | ✅ Solved count, Unsolved count, Solve rate |
| **Visual Indicators** | ❌ None | ✅ Badges on cards |
| **Multi-Puzzle Analysis** | ❌ N/A | ✅ Unsolved breakdown |
| **Data Source** | `/api/puzzle/list` | `/api/puzzles/stats` |
| **Primary Use Case** | Browse and select puzzles | Analyze puzzle difficulty patterns |

**Synergy**: Both pages now provide complementary views of the same underlying data with consistent "solved status" logic!

---

## Future Enhancements (Out of Scope)

1. **Solve Timeline**: Show when puzzles were first solved
2. **Model Solve Rate**: Which models solve the most puzzles
3. **Difficulty Progression**: Track how puzzle difficulty changes over time
4. **Unsolved Leaderboard**: Rank models by how many unsolved puzzles they've attempted
5. **Solve Prediction**: ML model to predict which unsolved puzzles are solvable
6. **Export Feature**: Export filtered list of unsolved puzzles for batch analysis
7. **Collaboration**: Tag puzzles for team review or discussion

---

## Benefits

1. **Research Focus**: Immediately surfaces the most valuable research targets
2. **Progress Tracking**: Clear metrics on how many puzzles remain unsolved
3. **Pattern Discovery**: Easier to identify characteristics of unsolvable puzzles
4. **Consistency**: Matches PuzzleBrowser's solved status logic and UI patterns
5. **Minimal Changes**: Leverages existing infrastructure and patterns
6. **No Breaking Changes**: All existing functionality preserved

---

## Notes

- This enhancement builds directly on the PuzzleBrowser implementation
- Uses identical correctness logic for consistency
- Maintains backwards compatibility with existing features
- DaisyUI components used throughout (matching current implementation)
- The UNSOLVED badge becomes the highest-priority research indicator
- Solve rate metric provides quick overview of dataset progress
- Multi-puzzle analysis section gains valuable solved/unsolved breakdown

**Key Insight**: The database viewer is the perfect place to highlight unsolved puzzles because it shows ALL puzzles from all datasets in a single comprehensive view - ideal for identifying research gaps!
