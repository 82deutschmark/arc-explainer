# PuzzleDB Viewer & PuzzleCard Redesign Plan

**Author:** Claude Code using Sonnet 4.5
**Date:** 2025-11-20
**Status:** Ready for Implementation

## Executive Summary

This plan outlines two critical UI improvements to the ARC Explainer project:

1. **PuzzleDB Viewer Redesign**: Complete rewrite focused on displaying unsolved evaluation puzzles with ARC2-Eval as top priority
2. **PuzzleCard Enhancement**: Remove useless "Analyzed" status and add information-dense performance metrics

Both changes focus on providing **actionable, valuable data** to researchers instead of superficial status indicators.

---

## Part 1: PuzzleDB Viewer Redesign

### Current Problems

**File:** `/client/src/pages/PuzzleDBViewer.tsx`

❌ **Wrong UI Framework**: Uses DaisyUI instead of project standard shadcn/ui
❌ **Wrong Focus**: Shows performance metrics, "dangerous" vs "humble" classifications
❌ **Too Complex**: Overwhelming filters that users don't need
❌ **Missing Core Feature**: Doesn't prominently show UNSOLVED evaluation puzzles

### New Requirements

✅ **Primary Goal**: Show puzzle IDs from Arc 1 and Arc 2 **evaluation sets** that NO LLM has solved yet
✅ **Priority Order**:
   1. **ARC2 Evaluation (evaluation2)** - 120 puzzles total - **TOP PRIORITY**
   2. **ARC1 Evaluation (evaluation)** - 400 puzzles total - **SECOND PRIORITY**

✅ **UI Framework**: Use shadcn/ui components consistently
✅ **Simplicity**: Users want to see "what puzzles are unsolved?" - that's it

### Data Fetching Strategy

```typescript
// Hook: useWorstPerformingPuzzles from /client/src/hooks/usePuzzle.ts

// ARC2-Eval FIRST (TOP PRIORITY - 120 puzzles)
const { puzzles: arc2EvalUnsolved, isLoading: loading2, error: error2 } = useWorstPerformingPuzzles(
  200,           // High limit to get all unsolved from 120 total
  'accuracy',    // Sort by accuracy
  0,             // minAccuracy = 0
  0,             // maxAccuracy = 0
  true,          // zeroAccuracyOnly = TRUE (critical!)
  'ARC2-Eval',   // evaluation2 dataset - TOP PRIORITY!
  undefined,     // No multi-test filter
  false          // Don't need rich metrics
);

// ARC1-Eval SECOND (SECOND PRIORITY - 400 puzzles)
const { puzzles: arc1EvalUnsolved, isLoading: loading1, error: error1 } = useWorstPerformingPuzzles(
  500,           // High limit to get all unsolved from 400 total
  'accuracy',
  0,
  0,
  true,          // zeroAccuracyOnly = TRUE
  'ARC1-Eval',   // evaluation dataset - SECOND PRIORITY
  undefined,
  false
);
```

### Component Architecture

```
PuzzleDBViewer.tsx (NEW - complete rewrite)
├── Header Section (shadcn Card)
│   ├── Title: "Unsolved ARC Evaluation Puzzles"
│   ├── Description: Focus on ARC2-Eval → ARC1-Eval priority
│   └── Summary Stats (shadcn Badge)
│       ├── ARC2 Eval: XX / 120 unsolved
│       ├── ARC1 Eval: YY / 400 unsolved
│       └── Total: ZZ unsolved
│
├── Quick Filter Controls (shadcn Select/Input)
│   ├── Dataset Tabs: All | ARC2-Eval | ARC1-Eval
│   └── Search by Puzzle ID
│
└── Puzzle Display Section
    ├── ARC2 Evaluation Section (PRIMARY - shown first)
    │   ├── Header: "⭐ ARC2 Evaluation - PRIMARY FOCUS"
    │   ├── Subtitle: "THE HARDEST PUZZLES - Research Priority"
    │   ├── Count: "XX / 120 unsolved"
    │   └── Puzzle Grid (ClickablePuzzleBadge - 3-4 columns)
    │
    └── ARC1 Evaluation Section (SECONDARY - shown below)
        ├── Header: "✨ ARC1 Evaluation - SECONDARY"
        ├── Count: "YY / 400 unsolved"
        └── Puzzle Grid (ClickablePuzzleBadge - 3-4 columns)
```

### shadcn/ui Components to Use

Reference: `/client/src/pages/AnalyticsOverview.tsx` (lines 26-34)

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
```

### Visual Layout Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  🗂️ Unsolved ARC Evaluation Puzzles                         │
│  Focus: ARC2 Eval (120 total) → ARC1 Eval (400 total)      │
│                                                              │
│  🎯 ARC2 Eval: 87 unsolved  │  ARC1 Eval: 245 unsolved     │
│  📊 Total: 332 unsolved evaluation puzzles                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Dataset: [All ▼]    Search: [______________] 🔍            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ⭐ ARC2 Evaluation - PRIMARY FOCUS (87 / 120 unsolved)     │
│  THE HARDEST PUZZLES - These are your research priority     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [9d9a15e8] [b7cb93ac] [4c177718] [a5313dff]         │  │
│  │ [3906de3d] [d511f180] [1e0a9b12] [6cf79266]         │  │
│  │ [7fe24cdd] [c9e6f938] [ae3edfdc] [b91ae062]         │  │
│  │ ... (all ARC2-Eval unsolved puzzles)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ✨ ARC1 Evaluation - SECONDARY (245 / 400 unsolved)        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [1a2e2828] [358ba94e] [f25fbde4] [bbc9ae5d]         │  │
│  │ [f8ff0b80] [017c7c7b] [19bb5feb] [1e32b0e9]         │  │
│  │ ... (all ARC1-Eval unsolved puzzles)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### File Header Template

```typescript
/**
 * PuzzleDBViewer.tsx
 *
 * Author: {Your Name/Model}
 * Date: {timestamp}
 * PURPOSE: Displays Arc 1 and Arc 2 evaluation puzzles that NO LLM has solved correctly (0% accuracy).
 * Shows exact puzzle IDs organized by dataset with ARC2-Eval as top priority for research focus.
 * Uses useWorstPerformingPuzzles hook with zeroAccuracyOnly filter to query unsolved puzzles.
 *
 * PRIORITY ORDER:
 * 1. ARC2 Evaluation (evaluation2) - 120 puzzles - PRIMARY FOCUS
 * 2. ARC1 Evaluation (evaluation) - 400 puzzles - SECONDARY FOCUS
 *
 * SRP/DRY check: Pass - Single responsibility (display unsolved eval puzzles), reuses existing hooks
 * shadcn/ui: Pass - Uses shadcn/ui components (Card, Badge, Select, Button, Input, Alert)
 */
```

### Implementation Steps

1. **DELETE** existing `/client/src/pages/PuzzleDBViewer.tsx` completely
2. **CREATE** new file with fresh implementation
3. **Import** required shadcn/ui components from AnalyticsOverview pattern
4. **Implement** dual data fetching for ARC2-Eval and ARC1-Eval
5. **Style** ARC2-Eval section with prominent gradient or larger badges
6. **Test** with real data to ensure unsolved puzzles display correctly

---

## Part 2: PuzzleCard Enhancement

### Current Problems

**File:** `/client/src/components/puzzle/PuzzleCard.tsx`

❌ **Lines 151-163**: Useless "Analyzed" status takes up valuable space
❌ **No performance metrics**: Users can't see solve rates, attempts, model counts
❌ **Not actionable**: Can't identify unsolved or difficult puzzles at a glance

```typescript
// REMOVE THIS SECTION (Lines 151-163):
{/* Analysis Status */}
<div className="flex items-center gap-2 text-lg">
  {isExplained ? (
    <>
      <span className="font-semibold text-emerald-600">✓ Analyzed</span>
      {puzzle.modelName && (
        <span className="text-gray-500">by {puzzle.modelName.split('/').pop()}</span>
      )}
    </>
  ) : (
    <span className="font-medium text-gray-500">Awaiting explanation</span>
  )}
</div>
```

### New Requirements

✅ **Information-dense**: Show 6-8 valuable metrics at a glance
✅ **Keep beautiful design**: Maintain existing gradient card styling
✅ **Actionable data**: Users can prioritize puzzles based on real statistics
✅ **Flexible**: Works for both analyzed and unanalyzed puzzles

### Enhanced Data Structure

```typescript
interface PuzzleCardProps {
  puzzle: {
    id: string;
    source?: string;
    maxGridSize: number;
    gridSizeConsistent: boolean;
    hasExplanation?: boolean;
    modelName?: string;
    hasMultiplePredictions?: boolean;

    // NEW: Performance data (add this to API response)
    performanceData?: {
      avgAccuracy: number;           // 0.0 - 1.0
      totalExplanations: number;     // Total attempts
      modelsAttempted?: string[];    // List of model names
      avgCost?: number;              // Average cost per attempt
      avgConfidence?: number;        // Average confidence (0-1)
      avgProcessingTime?: number;    // Milliseconds
      wrongCount?: number;           // Number of incorrect attempts
    };
  };
  showGridPreview?: boolean;
}
```

### New Metrics Section

**Replace lines 151-163 with this:**

```typescript
{/* Performance Metrics - Information Dense */}
<div className="space-y-3">
  {/* Row 1: Solve Rate & Attempts */}
  <div className="flex items-center justify-between gap-4">
    <div className="flex-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Solve Rate</p>
      <p className="text-2xl font-bold text-gray-900">
        {puzzle.performanceData?.totalExplanations > 0
          ? `${(puzzle.performanceData.avgAccuracy * 100).toFixed(1)}%`
          : 'Unsolved'}
      </p>
    </div>
    <div className="flex-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Attempts</p>
      <p className="text-2xl font-bold text-gray-900">
        {puzzle.performanceData?.totalExplanations || 0}
      </p>
    </div>
  </div>

  {/* Row 2: Models & Test Cases */}
  <div className="flex items-center justify-between gap-4">
    <div className="flex-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Models Tested</p>
      <p className="text-lg font-bold text-gray-900">
        {puzzle.performanceData?.modelsAttempted?.length || 0}
      </p>
    </div>
    <div className="flex-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Test Cases</p>
      <p className="text-lg font-bold text-gray-900">
        {puzzle.hasMultiplePredictions ? 'Multi' : 'Single'}
      </p>
    </div>
  </div>

  {/* Row 3: Status Badges */}
  <div className="flex flex-wrap gap-2">
    {/* Unsolved Badge - Highest Priority */}
    {puzzle.performanceData?.avgAccuracy === 0 && puzzle.performanceData?.totalExplanations > 0 && (
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
        🔥 UNSOLVED - 0% Success
      </span>
    )}

    {/* Solved by All Badge */}
    {puzzle.performanceData?.avgAccuracy === 1.0 && puzzle.performanceData?.totalExplanations > 0 && (
      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
        ✅ Solved by all models
      </span>
    )}

    {/* Cost Badge */}
    {puzzle.performanceData?.avgCost && (
      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
        💰 ${puzzle.performanceData.avgCost.toFixed(3)} avg
      </span>
    )}

    {/* Confidence Badge */}
    {puzzle.performanceData?.avgConfidence && (
      <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800">
        🎯 {(puzzle.performanceData.avgConfidence * 100).toFixed(0)}% confidence
      </span>
    )}
  </div>
</div>
```

### Visual Mockup - Enhanced Card

```
┌────────────────────────────────────────────┐
│  GRADIENT BORDER (keep existing style)     │
│ ┌──────────────────────────────────────┐  │
│ │                   [Needs Analysis]    │  │  ← Keep existing status badge
│ │                                       │  │
│ │  The Grid Dancer                      │  │  ← Keep existing name/ID
│ │  1a2e2828                             │  │
│ │  [ARC2-Eval]                          │  │  ← Keep existing source badge
│ │                                       │  │
│ │  ┌─────────────────────────────────┐ │  │
│ │  │ INPUT  →  OUTPUT (grid preview) │ │  │  ← Keep existing grid preview
│ │  └─────────────────────────────────┘ │  │
│ │                                       │  │
│ │  ┌─────────────────────────────────┐ │  │
│ │  │ Solve Rate        Attempts      │ │  │  ← NEW!
│ │  │ **23.5%**         **47**        │ │  │
│ │  │                                 │ │  │
│ │  │ Models Tested     Test Cases    │ │  │  ← NEW!
│ │  │ **12**            **Multi**     │ │  │
│ │  │                                 │ │  │
│ │  │ [💰 $0.023] [🎯 85% confidence] │ │  │  ← NEW badges!
│ │  └─────────────────────────────────┘ │  │
│ │                                       │  │
│ │  Grid: 15×15     Variable grid        │  │  ← Keep existing grid info
│ │                                       │  │
│ │  [Examine Puzzle →]                   │  │  ← Keep existing button
│ └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

### Data API Enhancement Required

**File:** `/client/src/hooks/usePuzzle.ts` or relevant puzzle list hook

The `usePuzzleList` hook needs to fetch enhanced data. This likely requires:

1. **Backend Enhancement**: Ensure `/api/puzzle/list` endpoint returns `performanceData`
2. **Hook Update**: Map the response to include performance metrics

**Reference:** Look at how `/client/src/hooks/usePuzzleDBStats.ts` fetches performance data and apply similar pattern to `usePuzzleList`.

### Implementation Steps

1. **Update Data Layer**:
   - Verify `/api/puzzle/list` returns performance data
   - If not, update backend to include stats from `explanations` table
   - Update hook to properly type the response

2. **Update PuzzleCard Component**:
   - Add `performanceData` to interface
   - Delete lines 151-163 (useless "Analyzed" section)
   - Add new metrics section code above
   - Test with puzzles that have data AND puzzles without data

3. **Test Cases**:
   - Card with full performance data ✓
   - Card with zero attempts (show "Unsolved" / "0") ✓
   - Card with partial data (some metrics missing) ✓

---

## Key Benefits

### PuzzleDB Viewer
✅ **Clear focus**: Shows exactly what researchers need - unsolved evaluation puzzles
✅ **Priority-driven**: ARC2-Eval first (hardest 120), then ARC1-Eval
✅ **Simple UX**: No complex filters, just the puzzle IDs users want
✅ **Project standards**: Uses shadcn/ui consistently

### PuzzleCard Enhancement
✅ **Information-dense**: 6-8 valuable metrics vs 1 useless status
✅ **Actionable**: Users can immediately identify unsolved puzzles
✅ **Beautiful**: Keeps gorgeous gradient design
✅ **Research-ready**: Shows solve rates, model counts, costs at a glance

---

## Files to Modify

### Create New
- `/client/src/pages/PuzzleDBViewer.tsx` (complete rewrite)

### Modify Existing
- `/client/src/components/puzzle/PuzzleCard.tsx` (lines 151-163 replacement)
- Backend: Ensure `/api/puzzle/list` returns `performanceData` (if not already)
- `/client/src/hooks/usePuzzle.ts` (if data mapping needed)

---

## Testing Checklist

- [ ] PuzzleDB Viewer shows ARC2-Eval section first
- [ ] PuzzleDB Viewer shows ARC1-Eval section second
- [ ] Unsolved puzzles (0% accuracy) are correctly filtered
- [ ] Puzzle IDs are clickable and navigate to `/puzzle/{id}`
- [ ] Search by ID works correctly
- [ ] Dataset filter works (All / ARC2-Eval / ARC1-Eval)
- [ ] PuzzleCard displays solve rate correctly
- [ ] PuzzleCard displays attempt count correctly
- [ ] PuzzleCard displays model count correctly
- [ ] PuzzleCard shows UNSOLVED badge for 0% accuracy puzzles
- [ ] PuzzleCard works for puzzles with no performance data
- [ ] All shadcn/ui components render correctly
- [ ] Mobile responsive layout works

---

## References

- **AnalyticsOverview.tsx**: `/client/src/pages/AnalyticsOverview.tsx` - shadcn/ui patterns
- **DifficultPuzzlesSection.tsx**: `/client/src/components/analytics/DifficultPuzzlesSection.tsx` - puzzle querying
- **ClickablePuzzleBadge**: `/client/src/components/ui/ClickablePuzzleBadge.tsx` - puzzle ID display
- **usePuzzle Hook**: `/client/src/hooks/usePuzzle.ts` - data fetching patterns
- **useWorstPerformingPuzzles**: Hook used for querying unsolved puzzles

---

## Success Criteria

**PuzzleDB Viewer:**
- Users can immediately see which evaluation puzzles are unsolved
- ARC2-Eval puzzles are prominently shown as top priority
- Page loads in < 2 seconds with all puzzle data
- Zero DaisyUI components, 100% shadcn/ui

**PuzzleCard:**
- Every card shows 6-8 valuable metrics
- Unsolved puzzles (0% accuracy) are visually prominent with 🔥 badge
- No "Analyzed" or "Awaiting explanation" text anywhere
- Beautiful gradient design maintained

---

**End of Plan**
