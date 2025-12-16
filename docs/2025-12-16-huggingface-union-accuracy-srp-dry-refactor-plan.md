# 2025-12-16 HuggingFaceUnionAccuracy SRP/DRY Refactor Plan

## Goal
Refactor `client/src/pages/HuggingFaceUnionAccuracy.tsx` (currently ~1000+ lines) into a small orchestration page composed of focused components and hooks, while preserving current behavior and UX.

Approved UX direction: auto-fetch on dataset / model-pair change (no manual Calculate gating).

## Primary Problems (Current State)
- The page mixes:
  - data fetching (`/api/metrics/compare`, external system prompt fetches)
  - domain transformations (attempt grouping, union metric derivation)
  - large content blocks (disclaimers / explainers / worked examples)
  - UI state machine (collapsibles, loading, error)
- `/api/metrics/compare` fetch logic is duplicated (see `client/src/pages/ModelComparisonPage.tsx`).
- Attempt union metric presentation is duplicated (see `client/src/components/analytics/ModelComparisonDialog.tsx`).

## Scope
### In-scope
- Split `HuggingFaceUnionAccuracy.tsx` into:
  - a small page component
  - a shared comparison fetch service
  - a dedicated union-comparison hook
  - small presentational components for each large UI section
- Remove duplicated math / request-building by reusing shared helpers.
- Preserve existing routing, visual output, and existing API usage.

### Out-of-scope
- Backend scoring changes.
- Redesigning page copy.
- Adding pagination/search for puzzle badges.

## Target Architecture

### A) Shared service for /api/metrics/compare
Create:
- `client/src/services/metrics/compareService.ts`

Responsibilities:
- Build query params for `model1..model4` and `dataset` consistently.
- Execute fetch.
- Parse and return `ModelComparisonResult`.
- Centralize error handling (server message extraction).

Primary consumers:
- `ModelComparisonPage.tsx`
- `HuggingFaceUnionAccuracy.tsx` (via a hook below)

### B) Dedicated hook for attempt-union comparisons (auto-fetch)
Create:
- `client/src/hooks/useAttemptUnionComparison.ts`

Recommended approach:
- Use `@tanstack/react-query` (`useQuery`) to naturally support auto-fetch on change.

Inputs:
- `dataset: string | null`
- `attemptModelNames: [string, string] | null`

Outputs:
- `unionMetrics` (the backend attempt-union stats for the selected base model)
- `unionPuzzleIds` (as currently displayed)
- `comparisonResult` (optional, for debug / future UI)
- `loading`, `error`

Notes:
- The hook should call `compareService.fetchMetricsCompare()`.
- The hook should be the only place that understands:
  - where `attemptUnionStats` lives in the response
  - how to derive any extra view-specific computed data

### C) Extract AttemptUnionCard to a shared component
Move:
- `AttemptUnionCard` out of `client/src/components/analytics/ModelComparisonDialog.tsx`

Create:
- `client/src/components/analytics/AttemptUnionCard.tsx`

Then:
- `ModelComparisonDialog.tsx` imports and renders it.
- `HuggingFaceUnionAccuracy.tsx` (or a results component) imports and renders it.

Goal:
- One canonical union-metrics UI presentation.

### D) Extract large sections into focused components
Create folder:
- `client/src/components/huggingFaceUnionAccuracy/`

Suggested components:
- `UnionAccuracyHeader.tsx`
  - top title and high-level disclaimers
- `UnionAccuracyControls.tsx`
  - dataset selection + attempt pair selection
  - no fetching logic; only selection UI
- `UnionAccuracyResults.tsx`
  - renders `AttemptUnionCard`, badges, and cost metrics card
- `UnionAccuracyExplainers.tsx`
  - scoring explanation content + worked example tables
- `HarnessDetailsAccordion.tsx`
  - the harness explanation section (TinyGrid example, etc.)
- `ProviderSystemPromptsPanel.tsx`
  - owns external fetch to GitHub raw URLs + display (loading/error)

Page responsibility after extraction:
- Own selected dataset and selected base model.
- Build attempt-pair options from `useAvailableModels()`.
- Pass selected attempt names into `useAttemptUnionComparison()`.
- Compose the UI sections.

### E) Deduplicate dataset display name mapping
Currently duplicated in multiple pages.

Create:
- `client/src/constants/datasets.ts`

Exports:
- `DATASET_DISPLAY_NAME_MAP`
- optionally a helper: `getDatasetDisplayName(name: string): string`

## Milestones (Implementation Order)

### Milestone 1: Introduce compareService and reuse it
Files:
- create `client/src/services/metrics/compareService.ts`
- update `client/src/pages/ModelComparisonPage.tsx` to call it

Validation:
- Model comparison page still fetches and displays comparisons correctly.

### Milestone 2: Create useAttemptUnionComparison hook (auto-fetch)
Files:
- create `client/src/hooks/useAttemptUnionComparison.ts`
- update `HuggingFaceUnionAccuracy.tsx` to use the hook

Validation:
- Changing dataset or model pair triggers a new request automatically.
- Loading state and errors still surface.

### Milestone 3: Extract AttemptUnionCard to shared component
Files:
- create `client/src/components/analytics/AttemptUnionCard.tsx`
- update `ModelComparisonDialog.tsx` to import it
- update union page results to import it

Validation:
- Dialog and union page render identical union metrics UI.

### Milestone 4: Split HuggingFaceUnionAccuracy into sections
Files:
- create `client/src/components/huggingFaceUnionAccuracy/*`
- reduce `client/src/pages/HuggingFaceUnionAccuracy.tsx` to orchestration

Validation:
- No visual regressions.
- Collapsible behaviors remain intact.

### Milestone 5: Deduplicate dataset display-name mapping
Files:
- create `client/src/constants/datasets.ts`
- update union page and any other touched pages to import it

Validation:
- TypeScript builds.
- Dataset labels still match previous UI.

## Open Questions (Need Confirmation)
1. Puzzle badges meaning on the union page:
   - Option 1: show only puzzles fully solved by the union (all test pairs solved)
   - Option 2: keep current behavior (badge if either attempt is puzzle-level correct in `details`)

Recommendation: Option 1, because it matches the harness concept of fully solved puzzles and avoids confusion on multi-test-pair puzzles.

## Testing / Verification Checklist
- Load union page and confirm it auto-fetches on:
  - dataset change
  - model pair change
- Confirm no request loop (react-query should prevent accidental double fetch).
- Confirm provider system prompts still load and render.
- Confirm `ModelComparisonDialog` still renders union metrics.

## Files Expected to Change (Implementation)
- `client/src/pages/HuggingFaceUnionAccuracy.tsx`
- `client/src/pages/ModelComparisonPage.tsx`
- `client/src/components/analytics/ModelComparisonDialog.tsx`

New files:
- `client/src/services/metrics/compareService.ts`
- `client/src/hooks/useAttemptUnionComparison.ts`
- `client/src/components/analytics/AttemptUnionCard.tsx`
- `client/src/components/huggingFaceUnionAccuracy/*`
- `client/src/constants/datasets.ts`

## Notes
- Keep all existing copy and UI layout unless explicitly changed.
- Prefer extracting code without changing behavior first, then tighten semantics (badges meaning) once confirmed.
