# Fix PuzzleCard Fabricated Metrics and Layout Issues

**Author:** Claude Code using Sonnet 4.5
**Date:** 2025-11-22
**PURPOSE:** Emergency fix for critical PuzzleCard UI regressions including fabricated "% Solved" metric, layout collisions, and missing rich metrics integration.

---

## Critical Issues

### 1. **FABRICATED "% Solved" METRIC** ❌
**File:** `client/src/components/puzzle/PuzzleCard.tsx:162-168`

**Current Code:**
```typescript
<div className="text-sm font-semibold text-card-foreground">
  {!hasAttempts ? "Never Tried" : isSolved ? `${(accuracy * 100).toFixed(0)}% Solved` : "Unsolved"}
</div>
```

**Why This Is Wrong:**
- `avgAccuracy` (range: 0.0-1.0) is the **average accuracy across all model attempts**, NOT a solve percentage
- Displaying "25% Solved" misleads users into thinking "25% of models solved this puzzle"
- The actual meaning is "the average accuracy across attempts was 0.25"
- This metric **DOES NOT EXIST** in the backend - it's a hallucination

**What avgAccuracy Actually Means:**
From `docs/reference/api/WORST_PERFORMING_PUZZLES_ENDPOINT.md:132-138`:
```sql
AVG(COALESCE(trustworthiness_score, multi_test_average_accuracy, 0))
```
- Averages confidence-weighted correctness scores across ALL attempts
- Not a percentage of models that solved it
- Not a binary "solved/unsolved" indicator
- Just an average accuracy metric

**Correct Display Logic:**
```typescript
// Show actual correctness status without fabricating percentages
{!hasAttempts ? "Never Attempted" : (accuracy > 0 ? "Partially Correct" : "All Wrong")}
```

OR better yet, show the actual accuracy value:
```typescript
{!hasAttempts ? "Never Attempted" : `${(accuracy * 100).toFixed(0)}% Accuracy`}
```

---

### 2. **LAYOUT COLLISION** 🚨
**File:** `client/src/components/puzzle/PuzzleCard.tsx:148-203`

**Current Code:**
```typescript
<div className="flex gap-3 flex-1">
  {/* Grid Preview - Left Side */}
  {showGridPreview && firstTrainingExample && (
    <div className="shrink-0" style={{ width: '80px', height: '80px' }}>
      <TinyGrid grid={firstTrainingExample.input} style={{ width: '80px', height: '80px' }} />
    </div>
  )}

  {/* Metrics Table - Right Side */}
  <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
    ...
  </div>
</div>
```

**Problems:**
- TinyGrid can render grids with varying aspect ratios (tall, wide, square)
- No `max-width` or `object-fit` constraints on the grid container
- Stats section uses `flex-1 min-w-0` but lacks explicit width constraints
- When grids are wide (e.g., 3x10 or 10x3), they overflow and obscure text

**Developer Report:**
> "In card `7491f3cf` (bottom middle), the wide grid visualization completely obscures the 'CORRECTNESS,' 'ATTEMPTS,' and 'MODELS' data."

**Recommended Fix:**
```typescript
{/* Grid Preview - Left Side - STRICT CONSTRAINTS */}
{showGridPreview && firstTrainingExample && (
  <div className="shrink-0 w-20 h-20 flex items-center justify-center bg-white rounded border">
    <TinyGrid
      grid={firstTrainingExample.input}
      style={{
        maxWidth: '80px',
        maxHeight: '80px',
        objectFit: 'contain'
      }}
    />
  </div>
)}
```

Use `grid` layout instead of `flex` for more predictable spacing:
```typescript
<div className="grid grid-cols-[80px_1fr] gap-3 flex-1">
  {/* Grid: 80px fixed column */}
  {/* Stats: remaining space */}
</div>
```

---

### 3. **STRAY "x" IN GRID DIMENSIONS** 🐛
**File:** `client/src/components/puzzle/PuzzleCard.tsx:191`

**Current Code:**
```typescript
<div className="text-sm font-semibold text-card-foreground">
  {puzzle.maxGridSize}×{puzzle.maxGridSize}
</div>
```

**Problem:**
If `puzzle.maxGridSize` is `undefined` or `null`, this renders as just "×"

**Fix:**
```typescript
<div className="text-sm font-semibold text-card-foreground">
  {puzzle.maxGridSize ? `${puzzle.maxGridSize}×${puzzle.maxGridSize}` : 'N/A'}
</div>
```

---

### 4. **TEXT LEGIBILITY & CONTRAST** 📝
**File:** `client/src/components/puzzle/PuzzleCard.tsx:160-203`

**Current Issues:**
- No padding between grid and text (gap-3 = 12px may not be enough)
- Text uses `text-[10px]` which is very small
- Stats section needs more breathing room

**Recommended Fixes:**
```typescript
// Increase gap
<div className="grid grid-cols-[80px_1fr] gap-4 flex-1">

// Increase label size slightly
<div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
```

---

### 5. **MISSING RICH METRICS INTEGRATION** 💰
**Current State:**
- PuzzleCard accepts `performanceData` with optional rich metrics
- But the hook (`usePuzzleStats`) requests `includeRichMetrics=true`
- PuzzleCard doesn't display: `avgCost`, `avgProcessingTime`, `modelsAttemptedCount`

**Potential Enhancement (Optional):**
Add a small cost badge or processing time indicator:
```typescript
{puzzle.performanceData?.avgCost && puzzle.performanceData.avgCost > 0 && (
  <Badge variant="outline" className="text-[9px]">
    ${puzzle.performanceData.avgCost.toFixed(3)}
  </Badge>
)}
```

---

## Implementation Plan

### Step 1: Remove Fabricated "% Solved" Metric
**File:** `client/src/components/puzzle/PuzzleCard.tsx:162-168`

**BEFORE:**
```typescript
{!hasAttempts ? "Never Tried" : isSolved ? `${(accuracy * 100).toFixed(0)}% Solved` : "Unsolved"}
```

**AFTER:**
```typescript
{!hasAttempts ? "Never Attempted" : `${(accuracy * 100).toFixed(0)}% Avg`}
```

**Rationale:**
- Shows the actual metric (average accuracy) without fabricating a solve percentage
- Clear, concise, accurate
- "Avg" indicates it's an averaged metric

### Step 2: Fix Layout Collision
**File:** `client/src/components/puzzle/PuzzleCard.tsx:148-157`

**BEFORE:**
```typescript
<div className="flex gap-3 flex-1">
  {showGridPreview && firstTrainingExample && (
    <div className="shrink-0" style={{ width: '80px', height: '80px' }}>
```

**AFTER:**
```typescript
<div className="grid grid-cols-[80px_1fr] gap-4 flex-1">
  {showGridPreview && firstTrainingExample && (
    <div className="w-20 h-20 flex items-center justify-center bg-white rounded border overflow-hidden">
```

**Changes:**
- `flex` → `grid` with explicit `grid-cols-[80px_1fr]` for predictable column widths
- `gap-3` → `gap-4` for more breathing room
- Added `overflow-hidden` to prevent grid overflow
- Wrapped in flex container to center the grid properly

### Step 3: Add TinyGrid Aspect Ratio Constraint
**File:** `client/src/components/puzzle/PuzzleCard.tsx:152-156`

**BEFORE:**
```typescript
<TinyGrid
  grid={firstTrainingExample.input}
  style={{ width: '80px', height: '80px' }}
/>
```

**AFTER:**
```typescript
<TinyGrid
  grid={firstTrainingExample.input}
  style={{
    maxWidth: '80px',
    maxHeight: '80px',
    width: 'auto',
    height: 'auto'
  }}
/>
```

**Rationale:**
- Allows TinyGrid to maintain aspect ratio while respecting max constraints
- Prevents wide grids (10x3) from breaking layout
- Centers within the 80x80 container

### Step 4: Fix Grid Dimension Null Check
**File:** `client/src/components/puzzle/PuzzleCard.tsx:189-193`

**BEFORE:**
```typescript
<div className="text-sm font-semibold text-card-foreground">
  {puzzle.maxGridSize}×{puzzle.maxGridSize}
</div>
```

**AFTER:**
```typescript
<div className="text-sm font-semibold text-card-foreground">
  {puzzle.maxGridSize ? `${puzzle.maxGridSize}×${puzzle.maxGridSize}` : 'N/A'}
</div>
```

### Step 5: Improve Visual Hierarchy
**File:** `client/src/components/puzzle/PuzzleCard.tsx:160-203`

**Changes:**
- Increase gap from `gap-3` to `gap-4`
- Increase label font size from `text-[10px]` to `text-[11px]`
- Add more padding to card content if needed

---

## Testing Plan

### 1. Visual Regression Testing
Test with these specific puzzle IDs mentioned in the bug report:
- `7491f3cf` - Wide grid that obscured stats
- `97d7923e` - Tall/vertical grid
- `5545f144` - Standard rectangle grid
- `78332cb0` - Floating alignment issues

### 2. Data Validation
- Puzzle with 0 attempts → Should show "Never Attempted"
- Puzzle with 0% accuracy → Should show "0% Avg"
- Puzzle with 25% accuracy → Should show "25% Avg" (NOT "25% Solved")
- Puzzle with no maxGridSize → Should show "N/A"

### 3. Layout Testing
- Wide grids (10x3) should not overflow
- Tall grids (3x10) should not overflow
- Stats should always be readable
- Minimum 12-16px gap between grid and text

---

## Files to Modify

1. **`client/src/components/puzzle/PuzzleCard.tsx`**
   - Lines 148-157: Layout structure
   - Lines 152-156: TinyGrid constraints
   - Lines 162-168: Correctness display logic
   - Lines 189-193: Grid dimension null check
   - Lines 160-203: Visual hierarchy improvements

2. **`CHANGELOG.md`**
   - Add Version 5.17.2 entry documenting the fixes

3. **`docs/2025-11-22-fix-puzzle-card-fabricated-metrics.md`** (this file)
   - Implementation documentation

---

## Success Criteria

✅ **Metric Accuracy:**
- NO "% Solved" language anywhere in the UI
- Display shows "X% Avg" or "X% Accuracy" to indicate average accuracy metric
- "Never Attempted" for puzzles with 0 attempts

✅ **Layout Stability:**
- Grid preview constrained to 80x80px maximum
- No overlap between grid and stats text
- Consistent spacing regardless of grid aspect ratio

✅ **Visual Polish:**
- All text is readable with proper contrast
- Adequate spacing between UI elements
- Grid dimensions show "N/A" when data is missing

✅ **Theme Compatibility:**
- Works in both light and dark modes
- Uses shadcn/ui CSS variables correctly

---

## Related Documentation

- **API Endpoint:** `/docs/reference/api/WORST_PERFORMING_PUZZLES_ENDPOINT.md`
- **Correctness Logic:** `/docs/reference/database/CORRECTNESS_LOGIC_PATTERN.md`
- **Professional Redesign Plan:** `/docs/2025-11-21-puzzlecard-professional-redesign-plan.md`
- **Metrics Fix Plan:** `/docs/2025-11-20-puzzledbviewer-metrics-fix-plan.md`
