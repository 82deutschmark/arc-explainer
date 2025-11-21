# 2025-11-20 PuzzleDBViewer metrics + grid fix plan

Author: Codex (GPT-5)  
Date: 2025-11-20  
Purpose: Stop the PuzzleDBViewer cards from showing hallucinated solve rates, zeroed model counts, and badly sized grids. This plan aligns backend correctness data with the UI, ensures the right metrics are fetched, and makes grid previews resilient to unusual aspect ratios.

## Problems observed
- Solve rate shown on cards is derived from `avgAccuracy` (trustworthiness/multi-test averages), not the binary success rate, so zero-accuracy puzzles still show ~25%+ “solve rate.”  THIS IS A COMPLETE BULLSHIT METRIC THAT SHOULD NOT EXIST!!!!!!!!!
- Models tested is always `0` because the page calls `/api/puzzle/worst-performing` without `includeRichMetrics`, which omits `modelsAttemptedCount`.
- The grid preview containers are fixed-size; tall or wide grids stretch the layout and overflow the card.

## Definitions to enforce
- `correctAttemptCount`: `COUNT(DISTINCT e.id)` where `is_prediction_correct = true OR multi_test_all_correct = true`.
- `incorrectAttemptCount`: existing `wrongCount`.
- `totalAttemptCount`: `COUNT(DISTINCT e.id)` (all attempts).
- `solveRate`: `correctAttemptCount / NULLIF(totalAttemptCount, 0)` clamped to `[0,1]`. This replaces the UI use of `avgAccuracy` for “solve rate.”
- `modelsTested`: `COUNT(DISTINCT e.model_name)` should be available without needing the rich-metrics flag when used by PuzzleDBViewer cards.

## Plan
1) Backend data correctness (server)
   - Update `ExplanationRepository.getWorstPerformingPuzzles` to return `correctAttemptCount` and `solveRate` (binary success), and ensure `modelsAttemptedCount` is always selected for this endpoint when the client requests card data.
   - Propagate the new fields through `puzzleOverviewService.getAllPuzzleStats` and the controller so `/api/puzzle/worst-performing` and `/api/puzzles/stats` both expose the corrected metrics.
   - Keep `avgAccuracy` available for research views but stop presenting it as “solve rate” in this page.
   - Add defensive null/zero guards and clamp `solveRate` to `[0,1]`.

2) Frontend data plumbing (client)
   - Extend `PuzzlePerformanceData` (in `usePuzzleDBStats` and any shared types) with `correctAttemptCount` and `solveRate`.
   - Update `useWorstPerformingPuzzles` calls in `PuzzleDBViewer.tsx` to request `includeRichMetrics=true` (or new lightweight flag) so `modelsAttemptedCount` and `multiTest` counts arrive.
   - Adjust `PuzzleCard` to render solve rate from `solveRate` (binary) with fallback to `avgAccuracy` only when `solveRate` is absent, and to show a helpful “No attempts yet” state when totals are zero.
   - Ensure “Test cases” reflects multi-test counts if available (single vs multi).

3) Layout fixes for unusual grids
   - Wrap `TinyGrid` instances in a responsive square container (CSS `aspect-square`, `max-h/max-w`, `object-fit: contain` style) so very tall/wide grids scale down without stretching the card.
   - Add a min-height guard so tiny grids don’t collapse, and cap heights to keep the card actions visible.
   - Verify both Input/Output previews in `PuzzleCard` and the compact TinyGrid previews in `PuzzleDBViewer` use the same container sizing helper for consistency.

4) QA/Validation
   - Console-check sample puzzles (e.g., the IDs shown in the report) to confirm `correctAttemptCount` = 0 yields `solveRate 0%` with a non-zero attempts display.
   - Smoke-test /puzzles/database for ARC1/ARC2 with and without search filters; confirm model counts populate and cards stay aligned for tall grids.
   - Add a lightweight unit test (or assertion) around the SQL aggregation helper to ensure `solveRate` matches `correctAttemptCount/totalAttemptCount`.

## Target files
- server/controllers/puzzleController.ts
- server/services/puzzleOverviewService.ts
- server/repositories/ExplanationRepository.ts
- client/src/hooks/usePuzzle.ts (for request flags)
- client/src/hooks/usePuzzleDBStats.ts
- client/src/components/puzzle/PuzzleCard.tsx
- client/src/components/puzzle/TinyGrid.tsx (container sizing helper)
- client/src/pages/PuzzleDBViewer.tsx
