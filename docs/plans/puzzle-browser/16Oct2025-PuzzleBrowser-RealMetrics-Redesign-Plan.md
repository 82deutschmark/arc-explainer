# PuzzleBrowser Real Metrics Redesign Plan

**Date:** 2025-10-16 02:50 UTC  
**Author:** Cascade (GPT-5-Codex)

---

## 🎯 Goal
Deliver a research-centric `PuzzleBrowser` page that surfaces *real* analysis metrics (accuracy, coverage, cost) and provides clear, actionable navigation without corporate “hero/CTA” fluff.

## Pain Points Observed
- Generic hero & CTA elements dominate first screen without value.
- Badges/buttons lack affordance → unclear that they’re clickable.
- Imaginary placeholder metrics erode trust ("0 analysis" etc.).
- Excessive white space; critical data pushed below the fold.
- Community/Knowledge Hub sections distract from core workflow.

## UX Principles
- **Information density**: Key stats visible first screen on 1280×720.
- **Progressive disclosure**: Secondary info collapsible (community, docs).
- **Affordance**: Interactive elements styled as buttons/chips.
- **Consistency**: Re-use analytics cards/components from `AnalyticsOverview`.

## High-Level Layout
```text
┌──────────────────────────────────────────────────────────────┐
│ Dataset / Model Quick Stats (sticky header)                 │
│ ─ Accuracy • Coverage • Cost • Avg Time   [Change Dataset] │
└──────────────────────────────────────────────────────────────┘
Filters Row  ▸ chips summarising active filters + toggle panel
Progress Bar ▸ Correct / Incorrect / Not attempted (dataset)
Puzzle Grid  ▸ 3-column cards with name + tiny grid + badges
                        ↳ Accuracy badges per model (hover details)
Side Drawer  ▸ Appears when card clicked for deep dive (keeps context)
```

## API / Data Requirements
- `GET /api/metrics/dataset-summary?dataset=<id>`  → overall stats.
- `GET /api/metrics/model-summary?model=<name>&dataset=<id>` → per-model stats (reuse existing hook `useModelDatasetPerformance`).
- Optional: `GET /api/metrics/cost-summary` for monetary metrics.

## Component Breakdown
- **`PuzzleBrowserHeader.tsx`**  
  Sticky bar with dataset selector + stat badges (accuracy, coverage, cost).
- **`StatBadge.tsx` (💰, ⏱️, ✅)**  
  Tiny reusable badge with icon + value; colour coded.
- **`DatasetProgressBar.tsx`**  
  Visual correct/incorrect/not-attempted bar (reuse logic from analytics).
- **`FilterChips.tsx`**  
  Horizontal scrollable chip list showing active filters, each removable.
- **`PuzzleCard.tsx` (update)**  
  a) Make entire card clickable.  
  b) Replace white background with subtle slate border + hover shadow.  
  c) Add Tooltip with "Open puzzle".
- **`PuzzleSideDrawer.tsx`** *(NEW later)*  
  Renders on the right for deep dive while keeping scroll position.

## Visual Design Tokens (Tailwind)
- Primary interactive colour: `indigo-600` hover `indigo-700`.
- Success / error same as analytics page.
- Background: `slate-50` body, `white` cards.

## Implementation Steps
1. **Create header + badges**  
   Move existing hero quick-stats into new sticky `PuzzleBrowserHeader`.
2. **Introduce dataset summary hook** (`useDatasetSummary`) hitting new endpoint.
3. **Replace hero & community sections** with header + progress bar.
4. **FilterChips**: render chips summarising current filters; clicking X removes.
5. **Align PuzzleCard styles** with analytics badges; add hover ring.
6. **Deprecate Community/Knowledge Hub sections** (move to About page).
7. **QA** on 1280×720, 1024×768, mobile.

## File List & Responsibilities
- `client/src/components/puzzle/PuzzleCard.tsx` – style update only.
- `client/src/components/browser/PuzzleBrowserHeader.tsx` – NEW.
- `client/src/components/ui/StatBadge.tsx` – NEW.
- `client/src/components/browser/DatasetProgressBar.tsx` – NEW.
- `client/src/components/browser/FilterChips.tsx` – NEW.
- `client/src/hooks/useDatasetSummary.ts` – NEW API hook.
- `client/src/pages/PuzzleBrowser.tsx` – remove hero/community; integrate new comps.
- `server/controllers/metricsController.ts` – datasetSummary endpoint.
- `docs/CHANGELOG.md` – entry for redesign.

## TODO Checklist
- [ ] Implement new API endpoint & hook  
- [ ] Build `StatBadge` + `DatasetProgressBar` components  
- [ ] Build sticky header & integrate summaries  
- [ ] Add FilterChips & improve filter UX  
- [ ] Refactor `PuzzleBrowser.tsx` layout  
- [ ] Remove or relocate community sections  
- [ ] UX polish & responsiveness pass  
- [ ] Update tests / storybook  
- [ ] Solicit user feedback

---

*End of plan – ready for execution once approved.*
