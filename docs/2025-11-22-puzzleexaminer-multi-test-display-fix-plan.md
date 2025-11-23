# PuzzleExaminer Multi-Test Display – Fix Plan

**Date:** 2025-11-22  
**Owner:** Cascade  
**Context:** PuzzleExaminer’s analysis result cards often misrepresent multi-test runs: correctness badges are present, but the per-test grids and N/M stats are missing or show `0 predictions`. This plan describes how to fix that without changing core UI semantics.

---

## 1. Problem Statement

- PuzzleExaminer uses `usePaginatedExplanationSummaries` → `/api/puzzle/:id/explanations/summary`.
- The summary endpoint historically omitted heavy JSONB fields:
  - `multiple_predicted_outputs`
  - `multi_test_results`
  - `multi_test_prediction_grids`
  - sometimes `predicted_output_grid` / `is_prediction_correct`.
- `AnalysisResultCard` / `AnalysisResultGrid` are written assuming those fields exist.
- Result: multi-test blocks render as **0 predictions** / “No prediction” even when the DB has full multi-test data and the correctness flags are set.

Non-goals:
- No redesign of AnalysisResultCard layout.
- No change to correctness semantics from `MULTI_TEST_CORRECTNESS_GUIDE.md`.

---

## 2. Current Data Flow (Summary)

1. **Backend storage** – `ExplanationRepository` and DB already persist:
   - `multiple_predicted_outputs` (JSONB array-of-grids)
   - `multi_test_results` (JSONB validation array)
   - `multi_test_prediction_grids` (JSONB; legacy / alt source)
   - `multi_test_all_correct`, `multi_test_average_accuracy`, `has_multiple_predictions` (booleans / numeric).
2. **Full explanation fetch** – `getExplanationById` and `/api/explanations/:id` return all the above and work correctly.
3. **Summary fetch** – `getExplanationSummariesForPuzzle` and `/api/puzzle/:id/explanations/summary`:
   - return booleans (`has_multiple_predictions`, `multi_test_all_correct`) and counts
   - but **drop the JSONB grid + validation fields** for many entries.
4. **Frontend**:
   - PuzzleExaminer → `usePaginatedExplanationSummaries` → `AnalysisResults` → `AnalysisResultListCard` → `AnalysisResultCard`.
   - `AnalysisResultCard` tries:
     - numbered `predictedOutputN` fields,
     - else `multiTestPredictionGrids`,
     - else `multiplePredictedOutputs`.
   - If none exist, `predictedGrids` is empty and the multi-test UI collapses.

Only views that always use the full explanation endpoint (or that lazy-load via `loadFullResult`) currently render multi-test grids correctly.

---

## 3. Goals

- **G1 – Accurate multi-test visualisation in PuzzleExaminer list view**  
  Show per-test predicted grids, expected grids, N/M correct summary, and diff masks when data exists.

- **G2 – Preserve existing correctness semantics**  
  Treat any failing test as “Incorrect” per `MULTI_TEST_CORRECTNESS_GUIDE.md`, with no partial credit in the top-line correctness badge.

- **G3 – Minimal API surface change**  
  Prefer enriching the existing summary endpoint over creating a new one, unless payload size proves problematic.

---

## 4. Options Considered

### Option A – Enrich the Summary Endpoint (Chosen)

- Add JSONB multi-test fields (and single-test prediction fields) to `getExplanationSummariesForPuzzle` and its DTO.
- Let PuzzleExaminer summaries carry enough data for `AnalysisResultCard` to work as-is.

Pros:
- Simple mental model: “summary rows are real explanations, just paginated/filtered.”
- No extra client code paths; cards reuse existing logic.

Cons:
- Slightly larger payloads (up to ~100–150 KB worst case per 12-item page).

### Option B – Lazy-Load Full Explanation on Expand Only

- Keep summary payload lean; when a user expands a card, call `/api/explanations/:id` and hydrate `AnalysisResultListCard` with full data (already partially implemented via `loadFullResult`).

Pros:
- Small initial payload, especially helpful on mobile / slow networks.

Cons:
- Multi-test section in **collapsed** cards still cannot show real grids or N/M stats, only booleans.
- More complex UX (spinner on expand, extra state handling).

### Option C – New “rich-summary” Endpoint

- Introduce `/api/puzzle/:id/explanations/summary-with-grids` specifically for grid-heavy views.

Pros:
- Lets us tune payload size per feature.

Cons:
- More API surface to maintain; likely overkill for 4–5 users.

**Decision:** Implement **Option A now**, keep **Option B** as an optimisation lever if payload size becomes an issue.

---

## 5. Implementation Plan

### 5.1 Backend – Explanation Summaries

**Files:**
- `server/repositories/ExplanationRepository.ts`
- `server/repositories/interfaces/IExplanationRepository.ts`
- `shared/types.ts` (if summary types are shared)

**Steps:**

1. **Extend SQL SELECT for summaries**  
   In `getExplanationSummariesForPuzzle`:
   - Add the following fields to the SELECT list:
     - `multiple_predicted_outputs AS "multiplePredictedOutputs"`
     - `multi_test_results AS "multiTestResults"`
     - `multi_test_prediction_grids AS "multiTestPredictionGrids"`
     - `predicted_output_grid AS "predictedOutputGrid"` (for single-test)
     - `is_prediction_correct AS "isPredictionCorrect"`.

2. **Ensure mapping logic handles new fields**  
   - Confirm the summary query feeds into the same `mapRowToExplanation` (or an equivalent mapper) that already:
     - `safeJsonParse`s JSONB
     - normalises grid shapes and removes null rows.
   - If summaries use a lighter DTO, extend that DTO to include the new fields and reuse parsing helpers to avoid duplication.

3. **Update repository interfaces**  
   - In `IExplanationRepository.ts`, update the `ExplanationSummaryPage` / item type so that it:
     - includes the new fields mentioned above,
     - remains assignable to (or easily convertible into) the frontend’s `ExplanationData`.

4. **Verify API response shape**  
   - Hit `/api/puzzle/:puzzleId/explanations/summary?limit=1` for a puzzle with known multi-tests (e.g. `6ea4a07e`).
   - Confirm the first `items[0]` includes:
     - `multiplePredictedOutputs` as an array-of-grids
     - `multiTestResults` as an array of objects
     - `multiTestPredictionGrids` where present
     - `predictedOutputGrid` and `isPredictionCorrect` for single-test rows.

### 5.2 Frontend – Wiring Summary Data into Cards

**Files:**
- `client/src/hooks/useExplanation.ts`
- `client/src/components/puzzle/AnalysisResults.tsx`
- `client/src/components/puzzle/AnalysisResultListCard.tsx`
- `client/src/components/puzzle/AnalysisResultCard.tsx` (verification only)

**Steps:**

1. **Ensure `ExplanationSummaryResponse.items` uses `ExplanationData`**  
   - In `usePaginatedExplanationSummaries`, keep `ExplanationSummaryResponse.items: ExplanationData[]`.
   - With the enriched backend, those `ExplanationData` objects should now contain the multi-test fields without extra mapping.

2. **Confirm pass-through to `AnalysisResultListCard` / `AnalysisResultCard`**  
   - Check `AnalysisResults` props: ensure it passes the summary `result` objects directly into `AnalysisResultListCard`.
   - Confirm `AnalysisResultListCard` uses `result` as the `AnalysisResultCard`’s `result` when expanded or when full details already exist.

3. **Verify multi-test logic is already correct**  
   - `AnalysisResultCard` should already:
     - derive `predictedGrids` from `multiTestPredictionGrids`/`multiplePredictedOutputs`/numbered fields;
     - compute `multiValidation` from `multiTestResults` or a pre-computed field;
     - fall back to `multiTestAllCorrect` when validation is missing.
   - No change expected here beyond verifying that the enriched summaries satisfy its assumptions.

4. **Edge-case handling**  
   - For historical corrupted rows (if any remain) where JSON is absent or unparsable:
     - rely on existing `try/catch` + fallback to an empty `multiValidation` array.
     - ensure UI degrades to showing booleans only, with no crashes.

### 5.3 Optional – Lazy Full Fetch on Expand (If Needed)

If summary payloads become too heavy:

- Keep summary endpoint enriched but **omit** the heaviest fields (e.g. `multi_test_prediction_grids`) and fetch them on-demand:
  - Use `AnalysisResultListCard.loadFullResult` (already wired to `/api/explanations/:id`) to hydrate `detailState.data`.
  - Continue to show boolean-based correctness in collapsed view; show full grid detail only when expanded.

This optimisation is not required for the initial fix.

---

## 6. Testing & Verification

### 6.1 Backend

- Use SQL or curl to inspect a known multi-test puzzle (e.g. `6ea4a07e`):
  - Verify `multiple_predicted_outputs`, `multi_test_results`, `multi_test_prediction_grids` are non-null for at least one explanation.
  - Confirm the summary endpoint now exposes these fields in JSON.

### 6.2 Frontend – Manual QA

For a puzzle with multi-tests:

1. Open `/puzzle/:puzzleId` → PuzzleExaminer.
2. Check the explanation list:
   - Each multi-test explanation should show:
     - "Multi-Test Results (N predictions, M tests – X/Y correct)" with N ≥ M when all predictions are present;
     - individual rows with predicted vs expected grids and ✓ / ✗ indicators.
3. Toggle any available diff/highlight modes and confirm mismatches are highlighted cell-wise.
4. Expand a card:
   - Ensure expanded view matches the collapsed summary (no contradictions in correctness).

### 6.3 Regression Checks

- Single-test explanations still display correctly (no changes to their correctness badges or grids).
- Other consumers of the summary endpoint (if any) continue to function with the enriched payload.
- No console errors about JSON parsing or missing fields.

---

## 7. Success Criteria

- PuzzleExaminer multi-test cards display per-test predicted grids and N/M correctness without requiring a separate click-through or debugging.
- All correctness labels are consistent with `MULTI_TEST_CORRECTNESS_GUIDE.md` and backend flags.
- No noticeable performance regression in PuzzleExaminer initial load for typical puzzles.
- No new schema or API breaking changes for other pages.
