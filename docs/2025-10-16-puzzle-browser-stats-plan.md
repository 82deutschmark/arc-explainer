# Puzzle Browser Stats Integration Plan (2025-10-16)

## Goal
Display authoritative ARC dataset statistics and filtered puzzle counts within `PuzzleBrowser` by consuming the `/api/puzzles/stats?includeRichMetrics=true` endpoint while preserving a responsive DaisyUI experience.

## Steps
1. **Audit existing utilities/hooks**
   - Confirm whether a shared stats hook exists; if not, plan to add a local TanStack Query call inside `PuzzleBrowser` using `apiRequest` helper for consistent auth/error handling.
   - Review endpoint shape from server controller (via `puzzleController.getPuzzleStats`) to know available fields (totals, explained/unexplained counts, dataset breakdown).

2. **Implement stats query**
   - Use `useQuery` with a descriptive key (e.g., `['puzzle-stats','rich']`) and configure `staleTime`/`cacheTime` for revisit caching.
   - Handle loading state with a skeleton shimmer in the hero stats area, and render an inline `alert-error` on failure while keeping the rest of the page usable.

3. **Revise hero metrics layout**
   - Replace the existing three-count grid with a two-column structure:
     - Left: overall dataset totals (total puzzles, explained, unexplained, dataset distribution) using stats data.
     - Right: filtered list context (in-view count, named, has analysis) derived from current filters.
   - Ensure responsiveness and DaisyUI compliance.

4. **QA & polish**
   - Validate TypeScript types align with API response.
   - Confirm fallbacks (e.g., stats missing) degrade gracefully.
   - Run `npm run lint -- --max-warnings=0` if available, otherwise ensure `tsc --noEmit` cleanliness visually.

## Notes
- Keep hero copy intact, only restructure metrics block.
- Document query errors via `console.error`? prefer toast? We'll show inline alert per requirement.
