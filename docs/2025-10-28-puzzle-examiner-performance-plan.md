# Puzzle Examiner Rendering Performance Plan (2025-10-28)

## Goal
Speed up the `/puzzle/:taskId` experience for puzzles with dozens of saved explanations by reducing the amount of heavy UI we mount on initial load.

## Key Observations
- `AnalysisResults` eagerly renders a full `AnalysisResultCard` (with multiple puzzle grids, diff views, and toggle panels) for every explanation.
- Some puzzles accumulate 80-120 explanations, multiplying the expensive grid renders and React state initialisers.
- We already have a compact `AnalysisResultListCard` that shows a lightweight summary and only mounts the heavy card after the user expands it.

## Planned Changes
1. **Introduce Compact Mode in `AnalysisResults`:**
   - Detect when explanation counts exceed a threshold (e.g., 24) and default to a dense list layout.
   - Provide a quick toggle so power users can switch back to the full detailed grid if desired.
   - Batch the compact list rendering (e.g., show 20 at a time with "Load more") to avoid 100 DOM nodes mounting at once.
2. **Enhance `AnalysisResultListCard`:**
   - Allow callers to set an initial expanded/highlighted state so deep links (`?highlight=`) still auto-expand the targeted explanation.
   - Ensure each card exposes the `explanation-{id}` anchor so existing scroll/highlight logic keeps working.
3. **Plumb highlight state through `PuzzleExaminer` → `AnalysisResults`:**
   - Parse the query param once, memoise it, and pass it down so compact mode can expand/highlight the targeted card without querying the DOM.

## Affected Files
- `client/src/pages/PuzzleExaminer.tsx`
- `client/src/components/puzzle/AnalysisResults.tsx`
- `client/src/components/puzzle/AnalysisResultListCard.tsx`

## Testing Plan
- Smoke-test the puzzle page in dev mode with a seeded puzzle that has many explanations (verify compact mode loads quickly, toggles work, load-more works, and highlight deep links expand the correct card).
- Check that puzzles with only a few explanations still show the rich card layout by default.
