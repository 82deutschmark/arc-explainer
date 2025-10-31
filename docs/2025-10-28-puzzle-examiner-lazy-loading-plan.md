# 2025-10-28 Puzzle Examiner Lazy Loading Plan

## Goal
Speed up the `/puzzle/:id` examiner view by deferring heavyweight explanation payloads until a user expands an item, while still supporting batching, filter counts, and deep-link highlights.

## Key Changes
- **Backend pagination endpoint**: expose `/api/puzzle/:puzzleId/explanations/summary` with `limit`, `offset`, and `correctness` query params plus count metadata.
- **Repository support**: add `getExplanationSummariesForPuzzle` returning lightweight rows (no grid JSON) and total counts.
- **Frontend data hook**: implement `usePaginatedExplanationSummaries` (React Query `useInfiniteQuery`) emitting flattened summaries, counts, and refetch helper for `useAnalysisResults`.
- **Lazy detail fetch**: extend `useExplanationById` to allow manual enable and export `fetchExplanationById` for imperative loading when an item expands.
- **UI updates**:
  - Rework `AnalysisResults` to consume paginated summaries, show counts from API metadata, and request more pages on demand.
  - Enhance `AnalysisResultListCard` with optional `loadFullResult` callback that fetches detail before rendering the expanded grid, showing a spinner/error state when necessary.
  - Update `PuzzleExaminer` to use the paginated hook, forward `loadFullResult`, and ensure highlight deep-link pins the requested explanation if it is outside the current page window.

## Tasks
1. **Server**
   - Update `IExplanationRepository` interface and `ExplanationRepository` implementation with a summary query + total count.
   - Add `getExplanationSummariesForPuzzle` to `explanationService` and new controller handler `getSummary`.
   - Register `/api/puzzle/:puzzleId/explanations/summary` route in `server/routes.ts`.
2. **Client hooks**
   - Add `fetchExplanationById` helper and optional `enabled` flag to `useExplanationById`.
   - Implement `usePaginatedExplanationSummaries` in `useExplanation.ts`.
3. **Components**
   - Adjust `AnalysisResultListCard` for async expansion (`loadFullResult`).
   - Rewrite `AnalysisResults` to accept paginated props, handle highlight pinning, and trigger lazy detail fetches.
   - Update `PuzzleExaminer` to wire new hook, manage filter state, and pass load/refetch handlers to `AnalysisResults`.

## Open Questions / Follow-ups
- Should we stream-in highlight detail if missing from current page? For now, pin the fetched record until its page loads to avoid duplication.
- Consider future virtualization if list lengths still cause layout thrash once payload sizes shrink.
