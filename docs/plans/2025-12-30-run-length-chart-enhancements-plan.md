# Run Length Chart Enhancements Plan

**Author:** Cascade Codex 5.1 Max (Low Thinking) 
**Date:** 2025-12-30  
**Status:** In Progress  

## Overview

Enhance the `WormArenaRunLengthChart` component and `WormArenaDistributions` page with interactive filtering, improved chart interactions, and additional metrics overlays. The chart remains **fully populated by default** with all models visible.

## Goals

1. **All models shown by default** - Users see the complete picture immediately
2. **Discoverable filtering** - Clear UI affordance showing users can filter by model
3. **Interactive chart** - Clickable legend, hover highlights, enhanced tooltips
4. **Additional data dimensions** - Win rate overlay, reference lines, cumulative view toggle

---

## Phase I: Interactive Model Filtering

### Changes to `WormArenaRunLengthChart.tsx`

1. **Add `selectedModels` state** - Array of model slugs (defaults to ALL models)
2. **Add filter controls** - Rendered above the chart:
   - Search input with placeholder "Filter models..."
   - "Select All" / "Clear All" buttons
   - Chip display of filtered models (when not all selected)
3. **Visual indicator** - Badge showing "Filtering X of Y models" when filtered
4. **Legend enhancement** - Each legend item becomes clickable to toggle visibility

### UI Behavior

- **Default state**: All models selected, no filter chips shown, full chart displayed
- **Filtered state**: Only selected models' bars shown, chips display active filters
- **Search**: Real-time filter of model list in dropdown/popover

### Files Modified

- `client/src/components/wormArena/stats/WormArenaRunLengthChart.tsx`

---

## Phase II: Enhanced Chart Interactivity

### Clickable Legend

- Click legend item -> toggle that model's visibility
- Shift+click -> solo that model (hide all others)
- Visual feedback: dimmed legend items for hidden models

### Bar Hover Highlighting

- Hover over a bar segment -> highlight that model across ALL bars
- Other model segments become semi-transparent (opacity 0.3)
- Cursor changes to pointer on hoverable elements

### Enhanced Tooltip

Current tooltip shows: model name, W/L counts

Enhanced tooltip adds:
- **Win rate at this round**: `W / (W + L) * 100`%
- **% of model's games**: How many of this model's total games ended at this round
- **Comparison badge**: "Above/Below average" vs global mean rounds

### Files Modified

- `client/src/components/wormArena/stats/WormArenaRunLengthChart.tsx`

---

## Phase III: Additional Metrics Overlay

### View Mode Toggle

Add segmented control with three modes:
1. **Count** (default) - Current stacked bar view
2. **Win Rate** - Line chart overlay showing win rate at each round length
3. **Cumulative** - Shows cumulative % of games completed by round N

### Reference Lines

- **Global average round** - Dashed vertical line at mean game length
- **Selected model average** - Solid line (when single model filtered)

### Implementation

- Use Recharts `ReferenceLine` for vertical markers
- Use Recharts `Line` component for win rate overlay (composable with BarChart)
- State: `viewMode: 'count' | 'winRate' | 'cumulative'`

### Files Modified

- `client/src/components/wormArena/stats/WormArenaRunLengthChart.tsx`
- `client/src/pages/WormArenaDistributions.tsx` (minor - add view mode controls if needed)

---

## Component Props Changes

```typescript
interface WormArenaRunLengthChartProps {
  data: WormArenaRunLengthDistributionData;
  // New optional props for external control (if needed later)
  initialSelectedModels?: string[];
  onSelectionChange?: (selectedModels: string[]) => void;
}
```

---

## Testing Checklist

- [ ] Default view shows ALL models (no filtering applied)
- [ ] Filter search works with partial matching
- [ ] "Select All" restores full view
- [ ] "Clear All" shows empty chart with helpful message
- [ ] Clicking legend toggles model visibility
- [ ] Shift+click legend solos a model
- [ ] Bar hover highlights model across all bars
- [ ] Tooltip shows win rate and % of games
- [ ] View mode toggle switches between count/winRate/cumulative
- [ ] Reference lines appear correctly
- [ ] Mobile/responsive behavior maintained

---

## Estimated Time

- Phase I: ~1.5 hours
- Phase II: ~1.5 hours  
- Phase III: ~2 hours
- **Total**: ~5 hours

---

## Rollback Plan

All changes are isolated to the chart component. If issues arise, revert to previous version of `WormArenaRunLengthChart.tsx`.
