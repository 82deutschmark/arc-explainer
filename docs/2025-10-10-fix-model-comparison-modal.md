# Fix Model Comparison UI/UX and Data Bug

**Author:** Cascade using Claude Sonnet 4.5  
**Date:** 2025-10-10  
**Status:** In Progress

## Problems Identified

### 1. Critical Data Bug - No Comparison Results
**Root Cause:** `MetricsRepository.getPuzzleIdsForDataset()` uses LIKE pattern matching on `puzzle_id` field:
```sql
WHERE puzzle_id LIKE 'evaluation2%'
```

**Why This Fails:**
- Puzzle IDs in database are 8-character hex codes like `0520fde7`, `9aec4887`
- They do NOT contain dataset names like "evaluation2"
- Dataset names come from directory structure (`data/evaluation2/`) not puzzle ID content
- This returns 0 puzzles → empty comparison matrix

### 2. Poor UX - Results Hidden at Bottom
- Clicking "Compare Models" renders results at the bottom of the page
- User must scroll down to see results
- No visual feedback that comparison completed
- Previous dev implemented lazy inline rendering instead of proper modal

## Solution

### Backend Fix: Correct Dataset-to-Puzzle Mapping

**File:** `server/repositories/MetricsRepository.ts`

Replace filesystem LIKE matching with proper puzzle loader integration:

```typescript
private async getPuzzleIdsForDataset(dataset: string): Promise<string[]> {
    if (dataset === 'all') {
        const result = await this.query('SELECT DISTINCT puzzle_id FROM explanations ORDER BY puzzle_id');
        return result.rows.map(r => r.puzzle_id);
    }
    
    // Use puzzleLoader to get actual puzzle IDs for the dataset
    const { puzzleLoader } = await import('../services/puzzleLoader');
    const puzzles = puzzleLoader.getPuzzleList({ source: dataset as any });
    return puzzles.map(p => p.id).sort();
}
```

**Why This Works:**
- `puzzleLoader` already has correct directory→source mapping
- It reads actual files from `data/evaluation2/` etc.
- Returns real puzzle IDs that exist in the database

### Frontend Fix: Modal Dialog UI

**Create New Component:** `client/src/components/analytics/ModelComparisonDialog.tsx`

Features:
- shadcn/ui Dialog component
- Full-screen or large modal
- ModelComparisonResults inside
- Proper loading states
- Close button and escape key support

**Update:** `client/src/pages/AnalyticsOverview.tsx`
- Add dialog state management
- "Compare Models" button opens modal instead of inline render
- Remove inline ModelComparisonResults at bottom (lines 488-490)

## Implementation Checklist

- [ ] Fix `getPuzzleIdsForDataset()` to use puzzleLoader
- [ ] Create `ModelComparisonDialog.tsx` component
- [ ] Update AnalyticsOverview to use dialog
- [ ] Test with real data
- [ ] Git commit with detailed message
- [ ] Update CHANGELOG.md

## Testing Plan

1. Select evaluation2 dataset
2. Select 2-4 models
3. Click "Compare Models"
4. Verify modal opens with data
5. Verify puzzle counts match actual dataset size
6. Verify checkmarks/x's show correct results
7. Test close button and escape key
