# Interactive Multi-Model Skill Analysis Visualization

**Date:** 2025-12-17
**Author:** Claude Haiku 4.5
**Status:** Ready for Implementation

## Overview

Replace the current static "Poster View" bell curves with a new interactive visualization that leverages the rich TrueSkill data available (150+ models with mu, sigma, wins, losses, games, etc.). The new "Comparison View" will feature:

- **Interactive scatter plot** showing all models with mu (skill) on X-axis, sigma (uncertainty) on Y-axis
- **Click-to-select** up to 5 models simultaneously
- **Multi-curve overlay** displaying bell curves for selected models
- **Cross-highlighting** between scatter points and curves
- **Search/filter** functionality for model discovery

The old static "Poster View" will be preserved via a tabbed interface for users who prefer the simpler single-model comparison.

## User Requirements

✅ Leverage rich multi-dimensional data (mu, sigma, winRate, gamesPlayed, etc.)
✅ Interactive model selection and comparison (3-5 models simultaneously)
✅ Real data only - no mocks or simulations
✅ Memorable, distinctive aesthetic fitting Worm Arena theme
✅ Keep old "Poster View" accessible via tabs

## Technical Approach

### Architecture: Hybrid Scatter + Multi-Curve

```
WormArenaSkillAnalysis.tsx (Modified)
├── Tabs: "Poster View" | "Comparison View"
├── Poster View → WormArenaSkillHeroGraphic (existing, unchanged)
└── Comparison View → WormArenaSkillComparison (NEW)
    ├── Search input + selection counter
    ├── WormArenaSkillScatterPlot (NEW)
    │   └── SVG scatter: all 150+ models, click-to-select
    └── WormArenaMultiCurveOverlay (NEW)
        └── Stacked bell curves for selected models
```

### Data Flow

- Page already fetches `leaderboard` via `useWormArenaTrueSkillLeaderboard(150, 3)`
- Pass entire leaderboard array to new comparison component
- Component maintains local state for `selectedModelSlugs: string[]` (max 5)
- No additional API calls required

### Visual Design

**Color Palette for Multiple Models:**
- Model 1: `#31708F` (current blue)
- Model 2: `#2E7D32` (worm-green variant)
- Model 3: `#F5A623` (worm-orange)
- Model 4: `#C85A3A` (worm-red)
- Model 5: `#7B3FE4` (purple accent)
- Unselected: `#D4B5A0` (worm-border, 30% opacity)

**Layout Composition (600px wide):**
```
┌───────────────────────────────────┐
│ [Poster View] [Comparison View]   │ ← Tabs (40px)
├───────────────────────────────────┤
│ 🔍 [Search models...] 3/5 selected│ ← Search bar (50px)
├───────────────────────────────────┤
│                                   │
│    Scatter Plot (600×350)         │ ← Interactive selection
│    • All models as points         │
│    • mu (X) vs sigma (Y)          │
│    • Click to select/deselect     │
│                                   │
├───────────────────────────────────┤
│ ════ Model 1 Bell Curve           │ ← Stacked curves
│ ════ Model 2 Bell Curve           │   (100px each)
│ ════ Model 3 Bell Curve           │   Max 5 × 100 = 500px
└───────────────────────────────────┘
```

**Interaction Model:**
- **Click scatter point:** Add to selection (or remove if already selected)
- **Hover scatter point:** Tooltip with modelSlug, μ, σ, winRate, gamesPlayed
- **Hover curve:** Highlight corresponding scatter point
- **Search box:** Filter visible points (pinned selections remain visible)
- **Max 5 selections:** 6th click removes oldest selection

**Animations:**
- Scatter points: 200ms ease-out scale + opacity on selection
- Curves: 300ms fade-in when model selected
- Crosshair: 150ms stroke-dashoffset animation
- NO auto-animation on mount (avoid motion sickness)

## Implementation Plan

### Phase 1: Component Structure & Tabs (Day 1)

**1.1 Add Tabs to WormArenaSkillAnalysis.tsx**

File: `D:\GitHub\arc-explainer\client\src\pages\WormArenaSkillAnalysis.tsx`

Changes:
- **Lines 110-115:** Add state management
  ```typescript
  const [viewMode, setViewMode] = useState<'poster' | 'comparison'>('poster');
  const [selectedModelSlugs, setSelectedModelSlugs] = useState<string[]>([
    selectedModelSlug ?? '',
    referenceSlug ?? ''
  ].filter(Boolean));
  ```

- **Lines 226-243:** Replace middle column with tabs
  ```tsx
  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'poster' | 'comparison')}>
    <TabsList className="w-full">
      <TabsTrigger value="poster">Poster View</TabsTrigger>
      <TabsTrigger value="comparison">Comparison View</TabsTrigger>
    </TabsList>

    <TabsContent value="poster">
      {/* Existing WormArenaSkillHeroGraphic code */}
    </TabsContent>

    <TabsContent value="comparison">
      <WormArenaSkillComparison
        leaderboard={leaderboard}
        selectedModels={selectedModelSlugs}
        onSelectionChange={setSelectedModelSlugs}
      />
    </TabsContent>
  </Tabs>
  ```

- **Imports to add:**
  - `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs`
  - `WormArenaSkillComparison` (new component)

**1.2 Create WormArenaSkillComparison.tsx (Orchestrator)**

File: `D:\GitHub\arc-explainer\client\src\components\wormArena\stats\WormArenaSkillComparison.tsx` (NEW, ~200 LOC)

Structure:
```typescript
interface WormArenaSkillComparisonProps {
  leaderboard: SnakeBenchTrueSkillLeaderboardEntry[];
  selectedModels: string[];
  onSelectionChange: (slugs: string[]) => void;
}

export default function WormArenaSkillComparison({
  leaderboard,
  selectedModels,
  onSelectionChange
}: WormArenaSkillComparisonProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  // Filter leaderboard by search, keeping selected models pinned
  const filteredLeaderboard = useMemo(() => { /* ... */ }, [leaderboard, searchFilter]);

  // Extract full model details for selected slugs
  const selectedModelDetails = useMemo(() => { /* ... */ }, [leaderboard, selectedModels]);

  // Handle click on scatter point
  const handlePointClick = useCallback((modelSlug: string) => {
    if (selectedModels.includes(modelSlug)) {
      // Remove from selection
      onSelectionChange(selectedModels.filter(s => s !== modelSlug));
    } else if (selectedModels.length < 5) {
      // Add to selection
      onSelectionChange([...selectedModels, modelSlug]);
    } else {
      // Max 5: remove oldest, add new
      onSelectionChange([...selectedModels.slice(1), modelSlug]);
    }
  }, [selectedModels, onSelectionChange]);

  return (
    <div className="space-y-4">
      {/* Search bar + selection counter */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search models..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="flex-1"
        />
        <Badge variant="secondary">
          {selectedModels.length}/5 selected
        </Badge>
      </div>

      {/* Scatter plot */}
      <WormArenaSkillScatterPlot
        leaderboard={filteredLeaderboard}
        selectedModels={selectedModels}
        hoveredModel={hoveredModel}
        onPointClick={handlePointClick}
        onPointHover={setHoveredModel}
      />

      {/* Multi-curve overlay */}
      {selectedModelDetails.length > 0 && (
        <WormArenaMultiCurveOverlay
          models={selectedModelDetails}
          hoveredModel={hoveredModel}
          onCurveHover={setHoveredModel}
        />
      )}

      {/* Empty state */}
      {selectedModels.length === 0 && (
        <div className="text-center py-8 text-worm-muted">
          Click scatter points above to select models for comparison
        </div>
      )}
    </div>
  );
}
```

**Key responsibilities:**
- State management for search filter and hover
- Selection logic (add/remove, enforce max 5)
- Coordinate scatter plot and curve overlay

### Phase 2: Scatter Plot Foundation (Day 1-2)

**2.1 Create WormArenaSkillScatterPlot.tsx**

File: `D:\GitHub\arc-explainer\client\src\components\wormArena\stats\WormArenaSkillScatterPlot.tsx` (NEW, ~250-300 LOC)

Structure:
```typescript
interface WormArenaSkillScatterPlotProps {
  leaderboard: SnakeBenchTrueSkillLeaderboardEntry[];
  selectedModels: string[];
  hoveredModel: string | null;
  onPointClick: (modelSlug: string) => void;
  onPointHover: (modelSlug: string | null) => void;
}

export default function WormArenaSkillScatterPlot({
  leaderboard,
  selectedModels,
  hoveredModel,
  onPointClick,
  onPointHover
}: WormArenaSkillScatterPlotProps) {
  // SVG dimensions
  const WIDTH = 600;
  const HEIGHT = 350;
  const MARGIN = { top: 20, right: 20, bottom: 50, left: 60 };
  const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
  const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

  // Data bounds
  const muRange = useMemo(() => {
    const muVals = leaderboard.map(m => m.mu);
    return { min: Math.min(...muVals), max: Math.max(...muVals) };
  }, [leaderboard]);

  const sigmaRange = useMemo(() => {
    const sigmaVals = leaderboard.map(m => m.sigma);
    return { min: 0, max: Math.max(...sigmaVals) };
  }, [leaderboard]);

  // Scale functions
  const xScale = (mu: number) =>
    ((mu - muRange.min) / (muRange.max - muRange.min)) * PLOT_WIDTH;

  const yScale = (sigma: number) =>
    PLOT_HEIGHT - ((sigma - sigmaRange.min) / (sigmaRange.max - sigmaRange.min)) * PLOT_HEIGHT;

  // Color assignment
  const MODEL_COLORS = ['#31708F', '#2E7D32', '#F5A623', '#C85A3A', '#7B3FE4'];
  const UNSELECTED_COLOR = '#D4B5A0';

  const getPointColor = (modelSlug: string): string => {
    const idx = selectedModels.indexOf(modelSlug);
    return idx >= 0 ? MODEL_COLORS[idx] : UNSELECTED_COLOR;
  };

  const getPointRadius = (modelSlug: string): number => {
    if (hoveredModel === modelSlug) return 8;
    return selectedModels.includes(modelSlug) ? 6 : 4;
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-worm-border">
      <svg width={WIDTH} height={HEIGHT}>
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {/* Grid lines */}
          {/* X-axis */}
          {/* Y-axis */}
          {/* Axis labels */}

          {/* Scatter points */}
          {leaderboard.map((model) => (
            <Tooltip key={model.modelSlug}>
              <TooltipTrigger asChild>
                <circle
                  cx={xScale(model.mu)}
                  cy={yScale(model.sigma)}
                  r={getPointRadius(model.modelSlug)}
                  fill={getPointColor(model.modelSlug)}
                  opacity={selectedModels.includes(model.modelSlug) ? 1 : 0.4}
                  onClick={() => onPointClick(model.modelSlug)}
                  onMouseEnter={() => onPointHover(model.modelSlug)}
                  onMouseLeave={() => onPointHover(null)}
                  className="cursor-pointer transition-all duration-200"
                  style={{
                    transformOrigin: `${xScale(model.mu)}px ${yScale(model.sigma)}px`,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  <div className="font-semibold">{model.modelSlug}</div>
                  <div>μ: {model.mu.toFixed(2)}</div>
                  <div>σ: {model.sigma.toFixed(2)}</div>
                  <div>Win Rate: {((model.wins / model.gamesPlayed) * 100).toFixed(1)}%</div>
                  <div>Games: {model.gamesPlayed}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </g>
      </svg>
    </div>
  );
}
```

**Key features:**
- Automatic scale calculation from leaderboard bounds
- Color assignment based on selection order
- Size variation for selected/hovered states
- shadcn/ui Tooltip for hover info
- Click handler for selection
- Smooth transitions via CSS

**Utilities to reuse:**
- None needed - simple linear scales

### Phase 3: Multi-Curve Overlay (Day 2-3)

**3.1 Create WormArenaMultiCurveOverlay.tsx**

File: `D:\GitHub\arc-explainer\client\src\components\wormArena\stats\WormArenaMultiCurveOverlay.tsx` (NEW, ~200-250 LOC)

Structure:
```typescript
interface WormArenaMultiCurveOverlayProps {
  models: SnakeBenchTrueSkillLeaderboardEntry[];
  hoveredModel: string | null;
  onCurveHover: (modelSlug: string | null) => void;
}

export default function WormArenaMultiCurveOverlay({
  models,
  hoveredModel,
  onCurveHover
}: WormArenaMultiCurveOverlayProps) {
  const CURVE_HEIGHT = 100;
  const CURVE_WIDTH = 600;
  const MODEL_COLORS = ['#31708F', '#2E7D32', '#F5A623', '#C85A3A', '#7B3FE4'];

  // Calculate global x-axis range across all models
  const globalRange = useMemo(() => {
    const allMus = models.map(m => m.mu);
    const allSigmas = models.map(m => m.sigma);
    const minX = Math.min(...models.map((m, i) => m.mu - 3.5 * m.sigma));
    const maxX = Math.max(...models.map((m, i) => m.mu + 3.5 * m.sigma));
    return { minX, maxX };
  }, [models]);

  return (
    <div className="space-y-2 bg-white rounded-lg p-4 border border-worm-border">
      {models.map((model, idx) => {
        const color = MODEL_COLORS[idx];
        const isHovered = hoveredModel === model.modelSlug;

        return (
          <div
            key={model.modelSlug}
            className="transition-opacity duration-200"
            style={{ opacity: hoveredModel && !isHovered ? 0.3 : 1 }}
            onMouseEnter={() => onCurveHover(model.modelSlug)}
            onMouseLeave={() => onCurveHover(null)}
          >
            {/* Model label + stats pill */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold" style={{ color }}>
                {model.modelSlug}
              </span>
              <div className="text-xs text-worm-muted">
                μ: {model.mu.toFixed(2)} | σ: {model.sigma.toFixed(2)} |
                {model.wins}W–{model.losses}L ({((model.wins/model.gamesPlayed)*100).toFixed(1)}%)
              </div>
            </div>

            {/* Bell curve SVG */}
            <svg width={CURVE_WIDTH} height={CURVE_HEIGHT}>
              {/* Render bell curve using confidenceIntervals utilities */}
              {/* Use generateBellCurvePath or manual path generation */}
              {/* X-axis with shared scale */}
            </svg>
          </div>
        );
      })}
    </div>
  );
}
```

**Key features:**
- Stacked vertical layout (100px per curve)
- Shared x-axis scale across all curves
- Color-coded by selection order (matches scatter)
- Hover interaction (dim others, highlight hovered)
- Stats pill at right side of each curve

**Utilities to reuse:**
- `generateBellCurvePath()` from `confidenceIntervals.ts`
- `gaussianPDF()` for custom rendering
- `getConfidenceInterval()` for bounds

### Phase 4: Polish & Integration (Day 3-4)

**4.1 Performance Optimizations**

Add to all components:
- `useMemo` for computed data (scales, filtered lists, paths)
- `useCallback` for event handlers
- Stable keys for all `.map()` iterations
- Avoid inline object creation in render

**4.2 Accessibility**

- Add ARIA labels to scatter points: `aria-label="Model: {slug}, μ: {mu}, σ: {sigma}"`
- Keyboard navigation: Tab to cycle, Enter to select
- Focus indicators on interactive elements
- Screen reader announcements for selection changes

**4.3 Edge Cases**

- Empty leaderboard: Show "No models available"
- No selections: Show prompt "Click scatter points to compare"
- Single model: Still render scatter + curve
- Sigma = 0: Render vertical line instead of curve
- Overlapping labels: Offset collision detection

**4.4 Loading States**

In WormArenaSkillComparison:
- Show skeleton scatter while `leaderboard` loading
- Disable interactions during loading
- Smooth transition when data arrives

### Phase 5: Testing & Documentation (Day 4)

**5.1 Manual Testing Checklist**

- [ ] Select 1-5 models, verify curves render correctly
- [ ] Click 6th model, verify oldest is removed
- [ ] Hover scatter point, verify tooltip appears
- [ ] Hover curve, verify scatter point highlights
- [ ] Search for model, verify filtering works
- [ ] Search while models selected, verify pinned selections remain
- [ ] Toggle between Poster/Comparison views, verify state preservation


**5.2 Code Quality**

- [ ] Add file headers (Author, Date, PURPOSE, SRP/DRY check)
- [ ] Extract magic numbers to named constants
- [ ] Add JSDoc comments for exported functions
- [ ] Remove console.log statements
- [ ] Run `npm run build` to verify no TypeScript errors

**5.3 Update CHANGELOG.md**

Add new semantic version entry:
```markdown
## v3.7.0 - 2025-12-17

### Added
- Interactive multi-model skill comparison visualization on Skill Analysis page
- Scatter plot showing all models with mu (skill) vs sigma (uncertainty)
- Click-to-select up to 5 models for detailed bell curve comparison
- Search/filter functionality for model discovery
- Cross-highlighting between scatter points and curves
- Preserved old "Poster View" via tabbed interface

### Modified
- `client/src/pages/WormArenaSkillAnalysis.tsx` (lines 110-115, 226-243): Added tabs and state management

### Added Files
- `client/src/components/wormArena/stats/WormArenaSkillComparison.tsx` (~200 LOC)
- `client/src/components/wormArena/stats/WormArenaSkillScatterPlot.tsx` (~250-300 LOC)
- `client/src/components/wormArena/stats/WormArenaMultiCurveOverlay.tsx` (~200-250 LOC)
```

## Critical Files

### To Modify
- `D:\GitHub\arc-explainer\client\src\pages\WormArenaSkillAnalysis.tsx`
  - Lines 110-115: Add state management
  - Lines 226-243: Replace middle column with tabs
  - Add imports for Tabs components and WormArenaSkillComparison

### To Create
- `D:\GitHub\arc-explainer\client\src\components\wormArena\stats\WormArenaSkillComparison.tsx` (~200 LOC)
- `D:\GitHub\arc-explainer\client\src\components\wormArena\stats\WormArenaSkillScatterPlot.tsx` (~250-300 LOC)
- `D:\GitHub\arc-explainer\client\src\components\wormArena\stats\WormArenaMultiCurveOverlay.tsx` (~200-250 LOC)

### To Reference (No Changes)
- `D:\GitHub\arc-explainer\client\src\utils\confidenceIntervals.ts` (Gaussian utilities)
- `D:\GitHub\arc-explainer\client\src\components\wormArena\stats\WormArenaSkillSelector.tsx` (Interaction patterns)
- `D:\GitHub\arc-explainer\shared\types.ts` (Type definitions)

## Success Criteria

✅ Users can see all 150+ models in a scatter plot (mu vs sigma)
✅ Users can click points to select/deselect models (max 5)
✅ Selected models show overlaid bell curves below scatter
✅ Hover interactions cross-highlight scatter points and curves
✅ Search box filters visible points while keeping selections pinned
✅ Old "Poster View" remains accessible via tabs
✅ All data is real (no mocks or simulations)
✅ Performance is smooth with 150+ models
✅ Aesthetic matches Worm Arena theme (warm browns, clean typography)

## Risks & Mitigations

**Risk:** Scatter plot becomes cluttered with 150+ points
**Mitigation:** Use opacity for unselected points, large size for selected, search filtering

**Risk:** Overlapping bell curves hard to read
**Mitigation:** Stacked vertical layout (not overlaid), color-coded by selection order

**Risk:** User forgets what each color means
**Mitigation:** Model label + stats pill inline with each curve, hover cross-highlighting

**Risk:** Performance issues with SVG rendering
**Mitigation:** useMemo for paths, useCallback for handlers, React keys for optimization

