# Leaderboard Restoration Plan

## Overview
Restore missing leaderboard functionality to PuzzleOverview.tsx that was present in the `overview` and `prompts` branches but lost during development of the `fixes` branch.

## Problem Analysis

### Missing Leaderboard Features
The current `fixes` branch has basic statistics but lacks the comprehensive leaderboard displays that users expect:

1. **Conditional Rendering Issue**: Leaderboards are hidden behind strict conditions (`accuracyStats.totalSolverAttempts > 0`) making them invisible when no solver data exists
2. **Missing Dual Leaderboards**: The rich "Accuracy Leaderboard" and "Trustworthiness Leaderboard" sections from other branches are missing
3. **Unused Component**: LeaderboardTable.tsx exists but is never imported or used
4. **Interface Mismatch**: AccuracyStats interface includes avgTrustworthiness but the UI doesn't use it properly

### What Other Branches Had

#### Overview Branch Features:
- Dual leaderboards showing both accuracy and trustworthiness scores
- Badges showing "X% puzzle success" AND "Y% trustworthiness"
- Saturn Visual Solver results section
- Detailed model performance breakdowns
- Always-visible leaderboards with proper fallback states

#### Prompts Branch Features:  
- Separate "Accuracy Leaderboard" and "Trustworthiness Leaderboard" sections
- Community Feedback Leaderboard alongside Solver Performance
- Database Insights panel with ARC dataset distribution
- Proper sorting by different metrics (accuracy vs trustworthiness)

## Implementation Phases

### Phase 1: Restore Missing Leaderboard Features ✅ IN PROGRESS
- [x] Replace basic solver stats with comprehensive dual leaderboards
- [x] Add "Accuracy Leaderboard" sorted by accuracyPercentage 
- [x] Add "Trustworthiness Leaderboard" sorted by avgTrustworthiness/avgAccuracyScore
- [x] Show both puzzle success % and trustworthiness % in badges
- [x] Make Community Feedback Leaderboard always visible
- [x] Remove strict conditional rendering that hides leaderboards

### Phase 2: Connect Unused Components
- [ ] Integrate existing LeaderboardTable.tsx component into main overview page
- [ ] Create dedicated leaderboard sections using the table format
- [ ] Ensure proper data mapping to LeaderboardTable interface

### Phase 3: Backend Interface Updates
- [ ] Verify FeedbackRepository returns avgTrustworthiness in accuracyByModel array
- [ ] Update AccuracyStats interface usage throughout frontend
- [ ] Test with realistic prediction accuracy scores

### Phase 4: Enhanced Display Features
- [ ] Add Database Insights panel from prompts branch with dataset distribution
- [ ] Consider adding Saturn Visual Solver results section if useful
- [ ] Improve fallback states when no data is available
- [ ] Add proper loading states for leaderboards

## Technical Details

### Current AccuracyStats Interface (shared/types.ts):
```typescript
export interface AccuracyStats {
  accuracyByModel: Array<{
    modelName: string;
    totalAttempts: number;
    correctPredictions: number;
    accuracyPercentage: number;
    avgAccuracyScore: number;
    avgConfidence: number;
    avgTrustworthiness: number;  // ✅ Available but not used properly
    // ... other fields
  }>;
  totalSolverAttempts: number;
  totalCorrectPredictions?: number;
}
```

### Leaderboard Sorting Logic:
- **Accuracy Leaderboard**: Sort by `accuracyPercentage` (descending)
- **Trustworthiness Leaderboard**: Sort by `avgTrustworthiness || avgAccuracyScore` (descending)
- **Community Feedback**: Sort by `helpfulPercentage` then `total` (descending)

### Display Strategy:
1. **Always show Community Feedback Leaderboard** - uses feedbackStats, independent of solver data
2. **Show Solver Leaderboards when data exists** - but with better fallback messaging
3. **Use dual badges** - both accuracy and trustworthiness scores visible
4. **Proper model name display** - include provider info where helpful

## Expected User Experience

### Before (Current Issues):
- User sees basic stats cards but no actual leaderboards
- Leaderboards completely hidden when no solver attempts exist  
- Missing trustworthiness scores and model comparisons
- User asks "where are these leaderboards? are they on tabs that dont exist?"

### After (Fixed):
- User immediately sees Community Feedback Leaderboard with model rankings
- When solver data exists, sees both Accuracy and Trustworthiness leaderboards
- Each model shows both puzzle success rate and trustworthiness score
- Clear fallback states explain when data will appear
- Rich leaderboards matching the quality from overview/prompts branches

## Files Modified

### Primary Changes:
- `client/src/components/overview/StatisticsCards.tsx` - Restored dual leaderboard sections
- `client/src/pages/PuzzleOverview.tsx` - Updated to pass proper props
- `server/repositories/FeedbackRepository.ts` - Ensured avgTrustworthiness is returned

### Supporting Files:
- `shared/types.ts` - AccuracyStats interface (already correct)
- `client/src/components/overview/LeaderboardTable.tsx` - Integration planned
- `docs/Leaderboard_Restoration_Plan.md` - This documentation

## Testing Strategy

1. **With No Data**: Verify proper fallback states show instead of blank sections
2. **With Feedback Only**: Community leaderboard should display, solver shows fallback
3. **With Full Data**: Both leaderboards should show with proper sorting and badges
4. **Model Display**: Ensure model names and providers display correctly
5. **Responsive**: Verify leaderboards work on different screen sizes

## Success Criteria

- [x] Leaderboards are visible and prominent on main overview page
- [ ] Both accuracy and trustworthiness metrics are displayed for each model
- [ ] Community feedback leaderboard always visible (when data exists)
- [ ] Solver performance leaderboards show when data exists with good fallbacks
- [ ] User can see comprehensive model comparisons similar to overview/prompts branches
- [ ] No more "where are the leaderboards?" confusion from users

## Notes

This restoration focuses on bringing back the useful leaderboard functionality while maintaining the database fixes and prediction accuracy improvements already implemented in the fixes branch. The goal is to combine the best of all branches: reliable data from fixes + rich UI from overview/prompts.