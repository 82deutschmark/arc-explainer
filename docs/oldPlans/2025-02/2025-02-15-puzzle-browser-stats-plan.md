# Puzzle Browser Stats Hero Plan

## Objective
Introduce global puzzle statistics via TanStack Query and surface them in the Puzzle Browser hero while preserving existing filtering behaviours.

## Scope & Files
- `client/src/hooks/usePuzzleStats.ts`: new hook to fetch `/api/puzzles/stats` and compute aggregate metrics (totals, analyzed counts, dataset/source breakdown).
- `client/src/pages/PuzzleBrowser.tsx`: consume the new hook, replace static hero metrics with data-driven presentation, add loading/error states, and relocate filter-specific counts into a "Current view" sub-card.
- `docs/2025-02-15-puzzle-browser-stats-plan.md`: planning document (this file).

## Tasks
1. Design hook types based on `puzzleOverviewService.getAllPuzzleStats` output; include memoized aggregations for totals, analyzed coverage, backlog, dataset splits, and fallback defaults.
2. Implement the TanStack Query hook with proper error propagation, caching, and stale time aligned with other stats hooks.
3. Update `PuzzleBrowser` hero UI to display global metrics (total puzzles, analyzed percentage/progress, backlog counts) while gracefully handling loading and error states.
4. Introduce a "Current view" card that shows filter-specific counts using existing `filteredPuzzles` data to avoid confusion with global numbers.
5. Smoke test by running the Puzzle Browser locally (conceptually) to ensure metrics align with filters and that no regressions are introduced.
