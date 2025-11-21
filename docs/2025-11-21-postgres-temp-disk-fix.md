/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-21T01:24:00Z
 * PURPOSE: Documentation of PostgreSQL temporary disk space overflow fix
 * SRP/DRY check: Pass - Documentation only
 */

# PostgreSQL Temporary Disk Space Overflow Fix

## Problem Summary
The `/api/puzzles/stats?limit=4000&includeRichMetrics=true` endpoint was causing PostgreSQL to run out of temporary disk space (`/tmp`). This affected the PuzzleTradingCards and PuzzleBrowser pages.

## Root Cause
The `getWorstPerformingPuzzles` query in `ExplanationRepository.ts` (lines 923-967) used expensive `STRING_AGG` operations to aggregate model names and reasoning efforts across 4000+ puzzles:

```sql
STRING_AGG(DISTINCT e.model_name, ', ' ORDER BY e.model_name) as models_attempted,
STRING_AGG(DISTINCT e.reasoning_effort, ', ' ORDER BY e.reasoning_effort) as reasoning_efforts
```

When processing thousands of puzzles with multiple explanations each, these operations created massive temporary files that exceeded available `/tmp` space.

## Solution
Replaced `STRING_AGG` operations with `COUNT(DISTINCT)` operations, which are much more efficient:

```sql
COUNT(DISTINCT e.model_name) as models_attempted_count,
COUNT(DISTINCT e.reasoning_effort) as reasoning_efforts_count
```

This provides the essential information (how many unique models/efforts) without creating large temporary strings.

## Files Changed

### Backend (Database Query Optimization)
1. **server/repositories/ExplanationRepository.ts** (lines 908-923, 985-1000)
   - Changed `STRING_AGG` to `COUNT(DISTINCT)` for models and reasoning efforts
   - Updated result mapping to return counts instead of arrays
   - Added optimization comments

2. **server/services/puzzleOverviewService.ts** (lines 217-229, 252-264, 337-349)
   - Updated to use `modelsAttemptedCount` and `reasoningEffortsCount`
   - Removed array spreading for empty default values

### Frontend (Type & UI Updates)
3. **client/src/hooks/usePuzzleStats.ts** (lines 34-37)
   - Updated `PuzzlePerformanceSnapshot` interface
   - Changed from `modelsAttempted?: string[]` to `modelsAttemptedCount?: number`
   - Changed from `reasoningEfforts?: string[]` to `reasoningEffortsCount?: number`

4. **client/src/hooks/usePuzzleDBStats.ts** (lines 32-34)
   - Updated `PuzzlePerformanceData` interface with same changes

5. **client/src/utils/puzzleCardHelpers.ts** (lines 173-174)
   - Updated `formatPuzzleStats` to return `modelsAttemptedCount`

6. **client/src/components/puzzle/PuzzleTradingCard.tsx** (lines 219-242)
   - Display model count instead of individual model badges
   - Show count with helpful message to view full details on puzzle page

7. **client/src/components/analytics/DifficultPuzzlesSection.tsx** (lines 649-659)
   - Updated to use `modelsAttemptedCount`
   - Removed tooltip with model names (no longer available)

8. **client/src/pages/PuzzleDBViewer.tsx** (lines 210-215, 325-326)
   - Updated stats display to use count
   - Updated research sorting to use count

## Performance Impact
- **Before**: Query created large temporary files (exceeded disk space with 4000 puzzles)
- **After**: Query uses minimal temporary space (only counts, no string aggregation)
- **Trade-off**: Individual model names no longer available in bulk stats (can still be viewed on individual puzzle pages)

## Testing Notes
- The UI still shows all relevant information (model count)
- Users can view full model list by clicking through to individual puzzle details
- Query execution should be significantly faster
- Temp disk usage should stay well below limits even with full 4000+ puzzle dataset

## Immediate Action Required (Production)
Before deploying these changes, clear the PostgreSQL temp files on the database server:

```bash
ssh to-database-server
rm -rf /var/lib/postgresql/data/base/pgsql_tmp/*
```

## Future Considerations
If individual model names are needed in the trading cards view, consider:
1. Lazy loading model names only when card is expanded
2. Separate endpoint to fetch model list for a specific puzzle
3. Client-side caching of model lists
4. Using a materialized view with pre-aggregated data
