# 2025-11-23 – Model Comparison Attempt Union Plan

## 1. Overview & Goals

**Objective:** For ARC evaluation datasets (e.g. `evaluation2`), when comparing two model runs like `gemini-3-deep-think-preview-attempt1` and `gemini-3-deep-think-preview-attempt2`, compute and display:

- The **union of puzzles solved correctly by either attempt**.
- The corresponding **union accuracy percentage** over the full dataset.
- A **canonical, reusable metric** that other analytics views can consume.

This plan intentionally implements **both**:

- **Option A – Frontend derivation** using existing `/api/metrics/compare` data.
- **Option B – Backend summary field** in `MetricsRepository` so the union metric is available to any client.

No behavior is left ambiguous: this document specifies concrete data shapes, locations, and steps a junior developer can follow.

---

## 2. Terminology & Invariants

- **Dataset** – Any dataset supported by the comparison API (e.g. `evaluation2`, `evaluation`, `training2`). We will **not** special-case a single dataset; the logic must work for all.
- **Attempt models** – Model names that follow the existing ARC Prize naming convention:
  - Pattern: `<base-name>-attemptN` where `N` is a positive integer (`1`, `2`, ...).
  - Example base model name: `gemini-3-deep-think-preview`.
  - Example attempt names:
    - `gemini-3-deep-think-preview-attempt1`
    - `gemini-3-deep-think-preview-attempt2`
- **Base model name** – The portion of the string before the trailing `-attemptN` suffix.
  - Example: base model name for `gemini-3-deep-think-preview-attempt2` is `gemini-3-deep-think-preview`.
- **Union-of-correct metric** (per base model):
  - For a fixed dataset and a set of attempts for one base model:
    - Let `totalPuzzles` = number of puzzles in the dataset (from `summary.totalPuzzles`).
    - For each puzzle, if **any attempt** for that base model has result `correct`, count that puzzle once.
    - Let `unionCorrectCount` = number of such puzzles.
    - Let `unionAccuracyPercentage` = `(unionCorrectCount / totalPuzzles) * 100`.
  - **Important invariant:** Each puzzle is counted **at most once** per base model, even if multiple attempts solved it.

The union metric is **per base model across its attempts**, not across arbitrary models.

---

## 3. Existing Data Flow (Reference Only)

You will be wiring into these existing pieces; do **not** rewrite them:

- **Frontend comparison flow**
  - `client/src/pages/AnalyticsOverview.tsx`
    - Builds query params `model1`, `model2`, `dataset`.
    - Calls `/api/metrics/compare`.
    - Navigates to `/model-comparison?...` with `comparisonData` in history state.
  - `client/src/pages/ModelComparisonPage.tsx`
    - Reads `dataset` and `model1..model4` from the URL.
    - Fetches `/api/metrics/compare` on demand.
    - Renders:
      - A per-model stats table using `summary.modelPerformance`.
      - A “unique solves” widget using `summary.modelXOnlyCorrect`.
      - A detailed puzzle × model grid using `NewModelComparisonResults`.
  - `client/src/components/analytics/NewModelComparisonResults.tsx`
    - Uses `ModelComparisonResult.details` to render puzzle columns and model rows.

- **Shared comparison types**
  - `client/src/pages/AnalyticsOverview.tsx` exports:
    - `PuzzleComparisonDetail` – per-puzzle results for up to four models.
    - `ModelPerformanceOnDataset` – per-model metrics on a dataset.
    - `ModelComparisonSummary` – overall summary including per-model performance.
    - `ModelComparisonResult` – `{ summary, details }`.
  - `server/repositories/MetricsRepository.ts` defines **matching** server-side interfaces with the same names.

- **Comparison API**
  - `GET /api/metrics/compare` (see `server/controllers/metricsController.ts`).
  - Implementation: `MetricsRepository.getModelComparison()` → `getMultiModelComparison()`.
  - `getMultiModelComparison()` currently:
    - Loads dataset puzzle IDs.
    - For each `(puzzle_id, model_name)`, fetches the latest attempt and determines `is_correct`.
    - Builds `details: PuzzleComparisonDetail[]` with `model1Result`, `model2Result`, etc.
    - Fills `summary` including `modelPerformance` and cross-model counts.

You will **reuse** this API and structure; no new endpoint is required.

---

## 4. Data Shape Extensions for Attempt Union (Backend & Frontend)

To support Option B and keep Option A simple, we define a single reusable structure:

- **New interface: `AttemptUnionStats`** (server and client, matching exactly):
  - `baseModelName: string`
  - `attemptModelNames: string[]` (all attempt model names included in the union, e.g. `['...-attempt1', '...-attempt2']`)
  - `totalPuzzles: number` (copied from `summary.totalPuzzles`)
  - `unionCorrectCount: number`
  - `unionAccuracyPercentage: number` (0–100, rounded to 2 decimal places)

- **New field on `ModelComparisonSummary` (server and client):**
  - `attemptUnionStats: AttemptUnionStats[]` (array, possibly empty)
  - For the initial use case, this will normally contain **0 or 1 entries**, but the array form allows future extension to more than one base model per comparison.

**Rule:** `attemptUnionStats` is always present on the summary (as an array). It may be empty; it must never be `undefined`.

---

## 5. Phase 1 – Frontend-Only Union Metric (Option A)

This phase adds a reusable frontend utility and page-level display that compute union-of-correct metrics **purely from existing fields**, without relying on `attemptUnionStats` yet.

### 5.1. Add frontend utility for attempt union

**File:** `client/src/utils/modelComparison.ts`

1. **Add a pure helper** (no React hooks) with the following responsibilities:
   - Input:
     - `result: ModelComparisonResult`.
     - A list of model indices to include in the union (e.g. `[0, 1]` for `model1Result` and `model2Result`).
   - Behavior:
     - Validate that `result.details` length equals `result.summary.totalPuzzles` (if not, still proceed but log a warning in dev-only conditions).
     - For each `PuzzleComparisonDetail` in `result.details`:
       - Look up the selected model results by index: `model1Result`, `model2Result`, etc.
       - If **any** selected result is `"correct"`, count that puzzle once.
     - Compute `unionCorrectCount` and `unionAccuracyPercentage`.
   - Output:
     - A small plain object describing union metrics:
       - `unionCorrectCount: number`
       - `totalPuzzles: number`
       - `unionAccuracyPercentage: number`

2. **Do not change existing utilities** (`formatModelNames`, `computeUniqueSolves`, `hasComparisonSummary`). Only add the new helper.

3. **Unit testing (frontend)**
   - Add tests (in the same folder or appropriate test folder) covering:
     - No attempts correct → unionCorrectCount = 0.
     - Only attempt1 correct on some puzzles.
     - Only attempt2 correct on some puzzles.
     - Both attempts correct on overlapping puzzles (ensure no double counting).
     - Mixed `correct`, `incorrect`, `not_attempted` values.

### 5.2. Detect attempt pairs on the comparison page

**File:** `client/src/pages/ModelComparisonPage.tsx`

1. **Introduce a small, local helper function** in this file to:
   - Accept a model name string.
   - Return one of:
     - `{ baseModelName: string; attemptNumber: number }` if the name matches the `-attemptN` pattern.
     - `null` otherwise.

2. **After `summary` is available**, derive the currently active models in order:
   - Use `summary.modelPerformance` and/or `summary.model1Name` / `summary.model2Name` / etc to get the model names in the same order as `details`.

3. **Identify attempt groups:**
   - Group active model names by `baseModelName` (from the helper above).
   - For this feature, focus on groups where:
     - The base model has **at least two attempts** in the current comparison.
     - At minimum, ensure support for exactly two attempts, e.g. `attempt1` and `attempt2`.

4. For the initial UI, support **exactly one base model group** for display:
   - If more than one base model in the comparison has multiple attempts, choose the one whose attempts occupy the first two positions in the `models` array (this is deterministic and avoids ambiguity).

### 5.3. Compute union metrics and display them

**Still in:** `client/src/pages/ModelComparisonPage.tsx`

1. Once the relevant base model group is identified:
   - Determine the indices (0-based) of those attempts in the comparison order (`model1`, `model2`, etc.).
   - Call the new utility from `client/src/utils/modelComparison.ts` with `ModelComparisonResult` and these indices.

2. Display the resulting metrics in a **compact summary section**, e.g. directly above or below the existing per-model stats table:
   - Show at least:
     - Base model name.
     - Attempt model names included in the union.
     - `unionCorrectCount` and `totalPuzzles`.
     - `unionAccuracyPercentage` with `%` formatting.
   - Use existing typography and layout conventions from the page; do not introduce new custom components.

3. Ensure the section is only rendered when **both** of these are true:
   - The comparison includes a base model with at least two attempts.
   - The union helper returns a meaningful result (i.e. `totalPuzzles > 0`).

4. **Edge case handling:**
   - If exactly one attempt for a base model is present, **do not** show a union row for that base.
   - If `details` is empty but `summary.totalPuzzles > 0`, treat this as an unexpected state and show no union metrics (optionally log to console in development).

### 5.4. Expose union metrics in the comparison dialog

**File:** `client/src/components/analytics/ModelComparisonDialog.tsx`

1. Reuse the same detection logic as `ModelComparisonPage` **via a shared helper** to avoid duplication.
   - Either:
     - Extract a small utility into `client/src/utils/modelComparison.ts` for “find attempt groups”, and use it in both the page and the dialog.
     - Or implement a thin wrapper in the dialog that calls the shared helper.

2. Compute union metrics using the same frontend utility.

3. Display a concise union stats line in the dialog header area or just above the `NewModelComparisonResults` table:
   - Example data: `Gemini 3 Deep Think (attempt1+attempt2): X/Y puzzles (Z% union accuracy)`.

4. Ensure dialog behavior stays responsive and accessible (no changes to existing shadcn/ui wiring).

---

## 6. Phase 2 – Backend Canonical Union Stats (Option B)

This phase adds `attemptUnionStats` to the backend summary and wires it through to the client types, so other consumers can reuse the metric without reimplementing the union logic.

### 6.1. Extend server-side types

**File:** `server/repositories/MetricsRepository.ts`

1. Add the `AttemptUnionStats` interface exactly as defined in section 4.

2. Update `ModelComparisonSummary` to include:
   - `attemptUnionStats: AttemptUnionStats[];`

3. Ensure the **"no database"** and **"no puzzles in dataset"** fallback paths return a `summary` that includes:
   - `attemptUnionStats: []` (empty array).

### 6.2. Extend client-side types

**File:** `client/src/pages/AnalyticsOverview.tsx`

1. Mirror the `AttemptUnionStats` interface with the same field names and types.

2. Update the client-side `ModelComparisonSummary` type to include:
   - `attemptUnionStats: AttemptUnionStats[];`

3. Verify that all places using `ModelComparisonSummary` still compile and that the new field is optional from a usage standpoint but always present in the runtime payload.

### 6.3. Compute attempt union stats in `getMultiModelComparison`

**File:** `server/repositories/MetricsRepository.ts` – inside `getMultiModelComparison()`

1. After `details: PuzzleComparisonDetail[]` is constructed and **before** returning the final `ModelComparisonResult`, compute `attemptUnionStats` as follows:

   - Step 1 – Build a mapping from index → model name:
     - Derive an array `orderedModels` in the same order used to populate `model1Result` / `model2Result` / etc (this is the existing `models` argument in `getMultiModelComparison`).

   - Step 2 – Identify attempt groups by base model:
     - For each entry in `orderedModels`:
       - Parse out `baseModelName` and `attemptNumber` if the name ends with `-attemptN`.
       - Group by `baseModelName`.
     - For each base model group, collect the full attempt model names and their original indices.

   - Step 3 – For each base model group with **two or more attempts**:
     - Initialize `unionCorrectCount` to zero.
     - For each `PuzzleComparisonDetail` in `details`:
       - For each attempt index in the group, read the corresponding `modelXResult` value.
       - If **any** of those values is `"correct"`, count that puzzle once.
     - After processing all puzzles, compute `unionAccuracyPercentage` using `summary.totalPuzzles`.

   - Step 4 – Construct one `AttemptUnionStats` entry per base model:
     - `baseModelName` set to the parsed base name.
     - `attemptModelNames` set to the list of full attempt model names in the group.
     - `totalPuzzles`, `unionCorrectCount`, `unionAccuracyPercentage` as computed above.

2. Attach the resulting `AttemptUnionStats[]` array to the returned `summary`.

3. Ensure the behavior is consistent even when:
   - Some attempts did not attempt any puzzles (their results will be `not_attempted`).
   - Only one attempt for a base model is present (no union entry is created for that base).

### 6.4. Add backend tests

1. Introduce or extend tests around `getModelComparison` / `getMultiModelComparison` with a small synthetic dataset to verify that:
   - A base model with two attempts produces exactly one `AttemptUnionStats` entry.
   - Overlapping correct puzzles are counted once.
   - Union accuracy matches manual expectations.
   - A base model with only one attempt produces no entry.

2. Keep test fixtures small and readable (3–5 puzzles, 2 attempts) to make reasoning about expected values trivial.

---

## 7. Phase 3 – Wire Frontend to Backend Union Stats

Once Option B is implemented and the API returns `attemptUnionStats`, the frontend should prefer backend values but remain robust if they are absent (for compatibility during rollout).

### 7.1. Update the frontend utility to prefer backend stats

**File:** `client/src/utils/modelComparison.ts`

1. Update the union helper added in Phase 1 so that:
   - It accepts an optional `AttemptUnionStats` entry (or array) from `summary.attemptUnionStats`.
   - If a matching `AttemptUnionStats` entry exists for the requested base model and attempts:
     - Return its `unionCorrectCount`, `totalPuzzles`, and `unionAccuracyPercentage` directly.
   - Otherwise, fall back to the existing derivation from `details`.

2. The matching logic should ensure that the set of `attemptModelNames` matches the models you are computing the union for (order does not matter, but membership must).

### 7.2. Avoid duplication of business logic

1. Ensure that **all frontend displays** (page + dialog) obtain their union metrics exclusively via the shared utility.

2. Do **not** re-implement union logic directly in components.

---

## 8. Testing & Validation Checklist

Before merging the implementation, confirm all of the following:

1. **API behavior**
   - `/api/metrics/compare` still returns valid data for existing use cases with no attempt pairs.
   - When comparing two attempt models of the same base on any dataset, `summary.attemptUnionStats` contains one correctly populated entry.

2. **Frontend behavior – ModelComparisonPage**
   - When comparing a base model’s `attempt1` and `attempt2` on `evaluation2`:
     - Per-model rows show the expected individual accuracies.
     - The new union summary row appears with correct `unionCorrectCount` and `unionAccuracyPercentage`.
   - When comparing models without `-attemptN` names, no union row appears and the page looks unchanged.

3. **Frontend behavior – ModelComparisonDialog**
   - The dialog shows a concise union summary for attempt pairs, consistent with the main page numbers.

4. **Edge cases**
   - Only `attempt1` present → no union stats.
   - Only `attempt2` present → no union stats.
   - Two attempts present but one has zero attempts on the dataset → union stats still computed correctly.

5. **Type safety & compilation**
   - Server builds successfully after adding `AttemptUnionStats` and `attemptUnionStats`.
   - Client builds successfully with the extended `ModelComparisonSummary` type.

6. **Documentation & CHANGELOG**
   - This plan document is already recorded in `CHANGELOG.md`.
   - When you later implement the code, add a **new** semantic version entry describing the code changes (do not reuse the documentation-only entry).

---

## 9. Files to Touch During Implementation

When you implement this plan, you will touch at least the following files:

- **Frontend**
  - `client/src/utils/modelComparison.ts`
  - `client/src/pages/ModelComparisonPage.tsx`
  - `client/src/components/analytics/ModelComparisonDialog.tsx`

- **Shared types (client-side)**
  - `client/src/pages/AnalyticsOverview.tsx` (extension of `ModelComparisonSummary` and new `AttemptUnionStats` type).

- **Backend**
  - `server/repositories/MetricsRepository.ts` (new `AttemptUnionStats`, `attemptUnionStats` field, and computation logic).
  - Backend test files for `MetricsRepository` and/or metrics controllers, as appropriate in this repo.

Follow this plan step-by-step, keep changes small and focused, and always update the CHANGELOG with a **new** version entry when implementing actual code changes beyond this document.
