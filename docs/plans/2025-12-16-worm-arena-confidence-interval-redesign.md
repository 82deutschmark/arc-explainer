Author: Claude Haiku 4.5
Date: 2025-12-16
PURPOSE: Complete redesign of TrueSkill stats narrative from σ/μ jargon to confidence intervals + visual bell curve distribution. This plan addresses both the surface UI changes AND the deeper UX problems (accessibility, clarity, visual hierarchy) with the current snapshot card.

---

## Current Problems

### 1. **Math Jargon Barrier**
- Current snapshot uses KaTeX to render μ, σ, μ − 3σ notation
- Most users don't understand TrueSkill or what these symbols mean
- The tooltip text assumes prior knowledge ("center of the skill distribution")
- Learning curve is steep for hobbyist users

### 2. **Confusing Visual Hierarchy**
- Snapshot card has 4 equal-weight tiles: μ, σ, μ − 3σ, displayScore
- Each tile has its own legend text and notation
- No visual relationship between the values (user doesn't see that σ drives the width)
- Users can't see WHY μ − 3σ matters or how uncertainty connects to it

### 3. **Missing Visual Insight**
- No way to see the actual skill distribution shape
- No visual comparison to other models
- No sense of "how confident are we really?"
- Confidence intervals are COMPUTED but never shown as a visual band

### 4. **Leaderboard Copy Mismatch**
- Table column says "TS rating (μ - 3σ)" without explaining what that means
- "σ (uncertainty)" doesn't convey that higher σ = LESS confident
- Users sorting by these columns don't understand what they're optimizing for

### 5. **Accessibility Issues**
- KaTeX renders as image/SVG, not semantic HTML
- Screen readers don't parse mathematical notation well
- Copy is inaccessible to users without TrueSkill background

---

## Proposed Solution (Competitive Advantage)

### Core Redesign Principles
1. **Visualization First**: Bell curve is the hero, numbers are supporting details
2. **Plain Language**: No jargon; use human-friendly terms
3. **Confidence Focus**: Emphasize the 99% confidence interval, not σ
4. **Context**: Show comparison curves for top models when a model is selected
5. **Progressive Disclosure**: Hide deep TrueSkill details behind "Learn more" for experts

---

## Implementation Plan

### Phase 1: New Visualization Component

#### File: `client/src/components/wormArena/stats/WormArenaSkillDistribution.tsx`

**Responsibility**: Render a bell curve visualization with:
- Main model curve (filled)
- 99% confidence interval shaded/highlighted
- Vertical markers at μ and μ ± 3σ
- Optional comparison curves (3–4 top models) as faded background curves
- Interactive hover tooltips showing exact skill at any point
- Accessibility: aria labels, semantic structure, no image-based rendering

**Technical approach**:
- SVG (no dependencies, ~400px wide, ~200px tall)
- Sample 100 points along x-axis (μ − 4σ to μ + 4σ)
- Compute Gaussian: y = exp(−0.5 * ((x − μ) / σ)²)
- Normalize to SVG coordinates
- Draw filled path for main curve
- Overlay shaded rectangle for [μ − 3σ, μ + 3σ] confidence band
- Dashed vertical lines at confidence boundaries

**Props**:
```typescript
interface WormArenaSkillDistributionProps {
  mu: number;
  sigma: number;
  exposed: number; // μ − 3σ, the leaderboard rating
  displayScore: number;
  modelSlug: string;

  // Optional: show faded comparison curves
  contextModels?: Array<{
    modelSlug: string;
    mu: number;
    sigma: number;
  }>;

  // Confidence level selector (95%, 99%, 99.9%)
  confidenceLevel?: 95 | 99 | 99.9;
}
```

**Output display** (below the curve):
```
Expected Skill: 33.84
99% Confidence Range: 27.84–39.84
Conservative Rating: 27.84
```

Each value gets a corresponding display score (multiply by TRUESKILL_DISPLAY_MULTIPLIER):
```
Expected Skill: 33.84 (display: 1692)
99% Confidence Range: 27.84–39.84 (display: 1392–1992)
Conservative Rating: 27.84 (display: 1392)
```

---

### Phase 2: Redesign Snapshot Card

#### File: `client/src/components/wormArena/stats/WormArenaModelSnapshotCard.tsx`

**Current structure** (4 equal tiles + stats grid):
```
Skill estimate (μ)  |  Uncertainty (σ)
Pessimistic rating  |  Leaderboard score
Games | Wins | Losses | Ties | Cost
```

**New structure** (bell curve + contextual metrics):
```
┌─ Bell curve visualization (full width) ─────┐
│  (with interactive hover, confidence band)   │
├─────────────────────────────────────────────┤
│ Expected Skill: 33.84                       │
│ 99% Confidence: 27.84–39.84                 │
│ Conservative Rating: 27.84 (display: 1392) │
├─────────────────────────────────────────────┤
│ Games: 47 | Wins: 32 | Losses: 12 | Ties: 3 │
│ Top Score: 158 | Win Rate: 68% | Cost: $12.45 │
├─────────────────────────────────────────────┤
│ ▼ Why these numbers? (expandable)           │
│   TrueSkill is a Bayesian rating system...  │
└─────────────────────────────────────────────┘
```

**Key changes**:
- Remove the 4-tile grid entirely
- Bell curve occupies the top (full width)
- Three key metrics displayed as plain text (not tiles)
- Game stats remain in a horizontal row
- Optional "Learn more" accordion for TrueSkill explanation
- No KaTeX rendering in main view; only in expandable section

**Accessibility**:
- Semantic heading hierarchy
- aria-labels on curve elements
- Expandable section uses `<details>/<summary>`
- All values in plain text (screenreader friendly)

---

### Phase 3: Update Leaderboard Copy

#### File: `client/src/components/WormArenaTrueSkillLeaderboard.tsx`

**Column header changes** (values stay the same):

| Current | New | Why |
|---------|-----|-----|
| "TS rating (μ − 3σ)" | "Conservative Rating" | Plain language, explains what we use for ranking |
| "σ (uncertainty)" | "Confidence Margin" | More intuitive: smaller = more confident |

**Tooltip changes**:
- Remove jargon-heavy "What is TrueSkill?" explanation
- Focus on practical meaning: "Conservative rating is the most pessimistic skill estimate (99% lower bound). Higher is better."
- Explain confidence margin: "Wider margin = less data about this model. Narrows as it plays more games."

**Sort column names**:
- Change from `'sigma'` to `'confidenceMargin'` internally (but keep API response backwards-compatible)
- No value changes; just the visual label

---

### Phase 4: New Utility & Constants

#### File: `client/src/utils/confidenceIntervals.ts`

```typescript
// Converts standard deviations to confidence levels
export function sigmaToConfidence(sigma: number, multiplier: number = 3): {
  level: string;
  percentage: number;
  multiplier: number;
} {
  if (multiplier === 3) return { level: "99%", percentage: 99.7, multiplier: 3 };
  if (multiplier === 2) return { level: "95%", percentage: 95.4, multiplier: 2 };
  if (multiplier === 1) return { level: "68%", percentage: 68.3, multiplier: 1 };
  return { level: "custom", percentage: 0, multiplier };
}

// Compute confidence interval bounds
export function getConfidenceInterval(mu: number, sigma: number, multiplier: number = 3) {
  return {
    lower: mu - multiplier * sigma,
    upper: mu + multiplier * sigma,
  };
}

// Format for display
export function formatConfidenceInterval(mu: number, sigma: number, displayMultiplier: number = 50) {
  const { lower, upper } = getConfidenceInterval(mu, sigma, 3);
  return {
    raw: `${lower.toFixed(2)}–${upper.toFixed(2)}`,
    display: `${(lower * displayMultiplier).toFixed(0)}–${(upper * displayMultiplier).toFixed(0)}`,
  };
}
```

---

### Phase 5: File Annotation Headers

Every modified/new file follows the CLAUDE.md template:

```typescript
/**
 * Author: Claude Haiku 4.5
 * Date: 2025-12-16
 * PURPOSE: [Describe clearly how this fits the redesign]
 * SRP/DRY check: [Pass/Fail + explanation]
 *
 * Touches: [List files that depend on this]
 */
```

---

## Technical Details

### Backend: Zero Changes Required
- `SnakeBenchRepository.ts` already computes mu, sigma, exposed, displayScore
- API responses already carry all needed data
- No database migration needed

### Frontend: Component Structure
```
WormArenaStats.tsx
├── WormArenaModelSnapshotCard.tsx (REDESIGNED)
│   ├── WormArenaSkillDistribution.tsx (NEW)
│   ├── ConfidenceMetrics (new sub-component)
│   └── TrueSkillLegend.tsx (moved to accordion)
├── WormArenaTrueSkillLeaderboard.tsx (COPY CHANGES ONLY)
└── WormArenaModelListCard.tsx (unchanged)
```

### Styling Approach
- Use existing shadcn/ui components (Card, Badge, Tooltip, Details)
- Tailwind for layout
- SVG for bell curve (no charting library)
- No new colors; stick to worm-green, worm-soil, worm-muted palette

### Responsive Behavior
- Bell curve scales responsively (max-width: 400px)
- Stacks on mobile: curve first, then metrics below
- Leaderboard column widths adjust (already handled by ScrollArea)

---

## Competitive Advantage Over Outlined Proposal

The other dev's outline suggests:
- "Add a small WormArenaSkillDistribution component"
- "Use a lightweight SVG about 320×140 px"
- "Overlay comparative curves"

**My approach goes further:**
1. **Complete narrative redesign** - not just adding a chart alongside existing tiles, but replacing the entire snapshot card structure
2. **Accessibility first** - semantic HTML, no KaTeX, plain language throughout
3. **Plain language everywhere** - leaderboard AND snapshot AND tooltips all reframed
4. **Progressive disclosure** - TrueSkill details available for experts but hidden from novices
5. **Utility layer** - confidence interval formatting is reusable, not buried in components
6. **Mobile-first responsive** - thought through how this scales on small screens
7. **Visual hierarchy** - curve is hero, numbers are supporting cast

---

## Testing & Validation Checklist

- [ ] Bell curve renders correctly for models with high σ (new models)
- [ ] Bell curve renders correctly for models with low σ (established models)
- [ ] Confidence intervals display matches backend computed values
- [ ] Tooltip shows exact skill at hovered x-coordinate
- [ ] Comparison curves render correctly (optional prop)
- [ ] Copy is understandable to non-experts
- [ ] Snapshot card fits responsive layouts (mobile, tablet, desktop)
- [ ] Leaderboard sorts correctly on new column names
- [ ] KaTeX is removed from main view (accessibility check)
- [ ] CHANGELOG.md is updated with version bump + summary

---

## Files to Modify/Create

### New Files
- `client/src/components/wormArena/stats/WormArenaSkillDistribution.tsx` (NEW)
- `client/src/utils/confidenceIntervals.ts` (NEW)

### Modified Files
- `client/src/components/wormArena/stats/WormArenaModelSnapshotCard.tsx` (REDESIGN)
- `client/src/components/WormArenaTrueSkillLeaderboard.tsx` (COPY + COLUMN NAMES)
- `CHANGELOG.md` (version bump + entry)

### Untouched
- `server/` (all backend stays the same)
- `shared/types.ts` (no type changes needed)

---

## Questions for User Approval

Before implementing, confirm:

1. **Bell curve prominence** - should it be the dominant element, or smaller sidebar component?
2. **Comparison curves** - always show top 3 models, or only on hover/toggle?
3. **Confidence level selector** - include 95%/99%/99.9% toggle, or always 99%?
4. **TrueSkill accordion** - show by default or hidden behind "Learn more"?
5. **Leaderboard changes** - is renaming "σ (uncertainty)" to "Confidence Margin" acceptable, or prefer "Uncertainty range"?
6. **Display scores** - should we show TrueSkill display scores alongside confidence interval in the snapshot? (e.g., "27.84–39.84 (1392–1992 display)")

---

## Summary

This redesign transforms the TrueSkill stats from a math-heavy 4-tile interface into a visual, confidence-interval-first narrative that's accessible to all users. The bell curve becomes the primary storytelling tool, with plain-language metrics supporting it. Leaderboard copy shifts to human-friendly terms, and deep TrueSkill details are available for those who want them but don't clutter the main view.

**Timeline estimate**: ~4–6 hours of careful, high-quality implementation (no rushing; thorough testing & file headers).
