# 2025-11-20 PuzzleDBViewer metrics + grid fix plan

Author: Codex (GPT-5)  
Date: 2025-11-20  
Purpose: Replace misleading "solve rate" / difficulty-style metrics in PuzzleDBViewer with concrete cost and resource-use metrics, and fix grid previews. This plan keeps correctness semantics aligned with the trading cards, avoids trust/confidence-derived numbers, and makes the cards show the actual dollars, tokens, and time spent per puzzle.

## Problems observed
- PuzzleDBViewer cards currently show a pseudo "solve rate" based on `avgAccuracy` / trust-style aggregates, not true binary success. Puzzles that are actually 0% solved can display non-zero percentages. For this page we do **not** want any difficulty or "solve rate" metric at all.
- Models tested is always `0` because the page calls `/api/puzzle/worst-performing` without `includeRichMetrics`, which omits `modelsAttemptedCount`.
- None of the existing per-puzzle cost, token, or latency metrics are surfaced in the UI, even though they are already aggregated on the backend.
- The grid preview containers are fixed-size; tall or wide grids stretch the layout and overflow the card.

## Metrics to enforce (cost & resource only)

- `totalAttemptCount`: number of distinct explanation rows for a puzzle. This is the existing `totalExplanations` aggregation.
- `avgCostPerAttempt`: mean `estimated_cost` per attempt, as already computed by the rich-metrics aggregation.
- `totalSpendApprox`: `avgCostPerAttempt × totalAttemptCount`. This is an approximation that is good enough for dashboard use.
- `avgTotalTokensPerAttempt`: mean `total_tokens` per attempt (`avgTotalTokens`).
- `totalTokensApprox`: `avgTotalTokensPerAttempt × totalAttemptCount`.
- `avgLatencyMs`: mean `api_processing_time_ms` per attempt (`avgProcessingTime`).
- `modelsTested`: number of distinct models that have attempted this puzzle (`modelsAttemptedCount`).
- *(Optional)* `costPerSuccessfulSolve`: `totalSpendApprox / correctAttemptCount` where `correctAttemptCount = totalAttemptCount - wrongCount` and `wrongCount` is the same binary incorrect-count used by the trading cards. This may be used for efficiency analysis, but it is **not** a difficulty score and should not be presented as such.

Hard constraint: **no** metric used on PuzzleDBViewer may be derived from `trustworthiness_score` or `confidence`, and nothing on this page should be labeled “difficulty”, “dangerous”, or “overconfident”.

## Plan

1) Backend metrics wiring (server)
   - Confirm `ExplanationRepository.getWorstPerformingPuzzles` already returns the rich metrics needed for cards when `includeRichMetrics=true`: `avgCost`, `avgProcessingTime`, `avgTotalTokens`, `modelsAttemptedCount`, `wrongCount`, and `totalExplanations`.
   - Ensure `puzzleOverviewService.getAllPuzzleStats` and `puzzleOverviewService.getWorstPerformingPuzzles` copy these fields into `performanceData` whenever `includeRichMetrics=true` is passed from the controller.
   - Keep `avgAccuracy` available for research views and analytics dashboards, but do **not** expose it as "solve rate" or difficulty on PuzzleDBViewer.
   - Do **not** add any new trustworthiness/ confidence based metrics for PuzzleDBViewer. All new work for this page must use only cost, tokens, time, and plain attempt counts.
   - *(Optional)* If we later want "max single-run time" per puzzle, extend the same aggregation to compute `MAX(api_processing_time_ms)` and pipe it through as an additional latency metric.

2) Frontend data plumbing (client)
   - In `useWorstPerformingPuzzles`, ensure the calls from `PuzzleDBViewer.tsx` pass `includeRichMetrics=true` for both ARC2-Eval and ARC1-Eval unsolved lists so `performanceData` includes cost, tokens, time, and `modelsAttemptedCount`.
   - In `usePuzzleDBStats` / `usePuzzleStats`, ensure the `PuzzlePerformanceData` / `PuzzlePerformanceSnapshot` types expose at least: `avgCost`, `avgProcessingTime`, `avgTotalTokens`, `modelsAttemptedCount`, `totalExplanations`, and `wrongCount`.
   - Do **not** add any new `solveRate` or difficulty fields for PuzzleDBViewer; any correctness-based metrics that are needed should use the existing trading-card semantics (`wrongCount` / `totalExplanations`) and remain clearly separate from cost/resource metrics.

3) Card UI updates (client)
   - **CompactPuzzleCard in `PuzzleDBViewer.tsx`**
     - Remove the "interest level" / "dangerous" / "hotspot" badges and any logic that depends on `avgConfidence` or `avgAccuracy`.
     - Replace the metrics area with a cost/resource-focused layout that shows:
       - *Total Spend* (USD): uses `totalSpendApprox`.
       - *Avg Cost / Attempt* (USD): uses `avgCostPerAttempt`.
       - *Avg Total Tokens / Attempt*: uses `avgTotalTokensPerAttempt`.
       - *Approx Total Tokens Used*: uses `totalTokensApprox`.
       - *Models Tested*: uses `modelsTested`.
       - *Avg Latency / Attempt*: uses `avgLatencyMs`, formatted in seconds.
     - For puzzles with `totalAttemptCount = 0`, show a clear "No attempts yet" state and hide cost/resource numbers.

   - **PuzzleCard**
     - Keep existing correctness display and call-to-action behaviour unchanged.
     - Add a compact "Resources" strip that reuses the same three core metrics per puzzle:
       - *Avg Cost / Attempt*.
       - *Avg Total Tokens / Attempt*.
       - *Avg Latency / Attempt*.
     - Do not introduce any new difficulty/solve-rate messaging on this card.

   - **PuzzleTradingCard**
     - Leave the existing win/loss record and badge logic as-is, since they already use the correct `wrongCount` / `totalExplanations` semantics.
     - In the expanded (back) view, add a small "Cost & Resources" block containing:
       - *Total Spend* (approximate).
       - *Avg Cost / Attempt*.
       - *Avg Total Tokens / Attempt*.
     - Ensure this block is clearly labeled as cost/resource, not difficulty.

4) Layout fixes for unusual grids
   - Wrap `TinyGrid` instances in a responsive square-ish container so very tall/wide grids scale down without stretching the card (e.g., using a shared sizing helper component or utility classes).
   - Add a minimum height so tiny grids don’t collapse, and cap grid preview height to keep the card actions visible without scrolling.
   - Ensure both Input/Output previews in `PuzzleCard` and the compact `TinyGrid` previews in `PuzzleDBViewer` reuse the same container sizing pattern for consistency.

5) QA/Validation
   - For a handful of sample puzzles, compare the API responses from `/api/puzzle/worst-performing?includeRichMetrics=true` and `/api/puzzles/stats?includeRichMetrics=true` against the UI:
     - Verify `avgCost`, `avgProcessingTime`, `avgTotalTokens`, `modelsAttemptedCount`, `totalExplanations`, and `wrongCount` are present in the data.
     - Manually compute `totalSpendApprox` and `totalTokensApprox` and confirm the card values are consistent with those approximations.
   - Confirm PuzzleDBViewer cards no longer display any "solve rate", "difficulty", "dangerous", or confidence/trustworthiness-based messaging.
   - Confirm "Models tested" is non-zero for puzzles that have actually been attempted by multiple models once `includeRichMetrics=true` is wired through.
   - Smoke-test the PuzzleDBViewer grid for ARC1-Eval and ARC2-Eval (with and without search filters) to verify grid previews stay within card bounds and tall/wide grids no longer distort the layout.

## Target files
- server/controllers/puzzleController.ts
- server/services/puzzleOverviewService.ts
- server/repositories/ExplanationRepository.ts
- client/src/hooks/usePuzzle.ts (for request flags)
- client/src/hooks/usePuzzleDBStats.ts
- client/src/components/puzzle/PuzzleCard.tsx
- client/src/components/puzzle/TinyGrid.tsx (container sizing helper)
- client/src/pages/PuzzleDBViewer.tsx
- client/src/hooks/usePuzzleStats.ts
- client/src/components/puzzle/PuzzleTradingCard.tsx
- client/src/utils/puzzleCardHelpers.ts

