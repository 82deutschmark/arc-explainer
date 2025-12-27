# 2025-12-03 Compact Puzzle Card Extraction Plan

**Goal:** Promote the inline `CompactPuzzleCard` inside `client/src/pages/PuzzleDBViewer.tsx` to a shared component (similar to `PuzzleCard`) so other views can reuse the lazy TinyGrid preview + metrics layout without duplicating logic.

## Scope

1. Create a dedicated component file (e.g., `client/src/components/puzzle/CompactPuzzleCard.tsx`) with the existing layout, TinyGrid preview, and metric rows.
2. Standardize props so PuzzleDBViewer and future pages can pass puzzle metadata without reimplementing the fetch/lazy logic.
3. Preserve the current lazy-loading behavior (IntersectionObserver + `/api/puzzle/task/:id` fetch) but make it optional through props so callers that already have `ARCTask` data can skip the fetch.
4. Update PuzzleDBViewer to import and use the shared component, deleting the inline definition.

## Implementation Steps

1. **Define Props & Types**
   - Reuse the `PuzzleDBStats` type from `usePuzzleDBStats`.
   - Add optional props:
     - `prefetchedTask?: ARCTask` – allows bypassing the fetch.
     - `lazyLoadGrid?: boolean` – default `true`, controls IntersectionObserver behavior.
     - `showMetrics?: boolean` – future-proof toggling of the metrics stack.
     - `onOpenDetails?: () => void` – optional custom action button handler.
2. **Extract Component**
   - Copy the existing JSX/state into `client/src/components/puzzle/CompactPuzzleCard.tsx`.
   - Replace hard-coded fetch references with the new props.
   - Keep the TinyGrid selection logic that prefers the first test output.
   - Export the component for reuse.
3. **Update PuzzleDBViewer**
   - Remove the inline `CompactPuzzleCard`.
   - Import the new shared component and pass `puzzle` directly.
   - Ensure props like `lazyLoadGrid` remain defaulted to maintain current behavior.
4. **Future Reuse Hooks**
   - After extraction, flag `PuzzleDiscussion` and any upcoming dashboards as potential adopters by referencing this plan in future tickets (not part of this change).

## Verification

1. Load `/puzzles/database` and confirm:
   - Cards render identically.
   - TinyGrid preview still uses the first test output fallback logic.
   - Lazy loading plus fetch calls occur only when cards enter view.
2. Run `npm run lint` (or relevant checks) to confirm no TypeScript errors.

## SRP/DRY Check

- SRP: The new component focuses solely on rendering a compact puzzle summary card.
- DRY: Eliminates inline duplication, enabling other pages to reuse the exact visuals.
