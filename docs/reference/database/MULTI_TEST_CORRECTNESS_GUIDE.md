# Multi-Test Correctness & Display Guide

## Purpose & Audience

This document explains how **multi-test puzzle correctness** is represented, validated, and displayed across ARC Explainer. It is written for developers who need to:

- Add new analytics or visualizations that depend on correctness.
- Touch streaming / validation code for multi-test predictions.
- Change UI labels like `Correct` / `Incorrect` / `All correct` for multi-test puzzles.

It focuses on **data flow and invariants**, not historical bugs or release notes.

---

## Core Concepts & Fields

At the explanation level we track correctness through a small set of fields:

- **`has_multiple_predictions: boolean | null`**
  - `true`  → multi-test puzzle; use the multi-test path.
  - `false`/`null` → single-test puzzle; use the single-test path.

- **`is_prediction_correct: boolean | null`**
  - Single-test correctness flag.
  - Only meaningful when `has_multiple_predictions` is `false` or `null`.

- **`multi_test_all_correct: boolean | null`**
  - Multi-test correctness flag.
  - `true`  → *every* test case passed.
  - `false` → **at least one** test case failed (may be 0/N or "some" correct).
  - Only meaningful when `has_multiple_predictions` is `true`.

- **Prediction grids**
  - `predicted_output_grid` – single-test prediction.
  - `multi_test_prediction_grids` – array of per-test predictions.
  - `multiplePredictedOutputs` / `predictedOutput1..3` – legacy / fallback formats that are still respected when present.

- **Derived metrics (do not misuse for counts)**
  - `multiTestAverageAccuracy` – **calibration / trustworthiness-style score**, not a literal correct-count fraction.

For **aggregation queries** and database-facing logic, follow the patterns in `CORRECTNESS_LOGIC_PATTERN.md`. This guide focuses on **end-to-end flow and UI semantics**.

---

## End-to-End Multi-Test Pipeline

High level pipeline for a multi-test puzzle run:

1. **Model generates outputs**
   - For each test case the model produces a predicted grid (or fails to produce one).

2. **Validation layer (server)**
   - Normalizes raw responses into a consistent structure.
   - Computes:
     - `has_multiple_predictions`
     - `multi_test_all_correct`
     - `multi_test_prediction_grids` (and fallbacks where necessary)
     - supporting metrics like `multiTestAverageAccuracy`.
   - This validation must run for **both streaming and non-streaming** analysis paths before anything is saved.

3. **Persistence (database)**
   - Validated results are stored with the fields above.
   - Downstream analytics and UI rely on these fields being **non-NULL** and semantically correct.

4. **Shared correctness utilities (TypeScript)**
   - `shared/utils/correctness.ts` exposes helpers such as `determineCorrectness(...)` that:
     - Accept the normalized fields.
     - Return a canonical correctness classification that UIs should use.

5. **Aggregations & analytics**
   - SQL queries in repositories (Accuracy, Trustworthiness, ModelDataset, Metrics) use the patterns in `MetricsQueryBuilder` + `CORRECTNESS_LOGIC_PATTERN.md` to combine single-test and multi-test predictions safely.

6. **UI components**
   - Consumer components (e.g. `AnalysisResultCard`, `ExplanationResultsSection`, `AnalysisResultGrid`, streaming panels, Model Browser, etc.)
     - **Should not invent their own correctness logic.**
     - Should treat shared utilities as the single source of truth.

---

## Display Semantics for Multi-Test Puzzles

The key rule: **we intentionally collapse all multi-test failures into a single `Incorrect` state.**

We currently distinguish three display cases:

1. **Single-test puzzles**
   - Source: `is_prediction_correct` (when `has_multiple_predictions` is `false`/`null`).
   - Canonical labels:
     - `true`  → `Correct`
     - `false` → `Incorrect`
     - `null`  → `No prediction` / `Not evaluated` (context-specific wording)

2. **Multi-test puzzles: all tests passed**
   - Source: `multi_test_all_correct === true` with `has_multiple_predictions === true`.
   - Canonical labels:
     - Status label: `All correct`
     - Optional count: `N/N correct` (where `N` is the number of test cases).

3. **Multi-test puzzles: one or more tests failed**
   - Source: `multi_test_all_correct === false` with `has_multiple_predictions === true`.
   - Canonical labels:
     - Status label: `Incorrect`
     - Count:
       - We treat the run as **0/N correct** for display and aggregation.
       - We do **not** try to distinguish `0/N` from `some/N` without explicit per-test correctness data.

### Why we do not show "Some incorrect"

Earlier designs attempted to represent a tri-state:

- `All correct`
- `Some incorrect`
- `All incorrect`

However, the actual data we store at the explanation level is **only a single boolean** `multi_test_all_correct`. It does **not** tell us how many tests failed; it only tells us whether they **all** passed.

Because of that, any attempt to render `Some incorrect` requires inventing extra semantics (for example, inferring counts from `multiTestAverageAccuracy`) and leads to:

- Inconsistent labels between components.
- Confusing combinations like `0/2 correct` + `Some incorrect`.
- Coupling correctness display to secondary metrics.

The current rule is therefore:

> For multi-test puzzles, treat any failure (`multi_test_all_correct === false`) as plain **`Incorrect`**, and do not expose a separate `Some incorrect` state.

---

## `multiTestAverageAccuracy` and Trustworthiness

`multiTestAverageAccuracy` is a **derived metric**, not a direct correctness counter. Internally it behaves more like a **trustworthiness / calibration score**:

- For internal model runs with confidence scores, it reflects how well confidence aligns with correctness across tests.
- For some external datasets it may approximate a correctness rate, but that is a property of the **data source**, not a guarantee of the field itself.

**Do not:**

- Use `multiTestAverageAccuracy` to reconstruct `correctCount` or to decide whether a run is correct vs incorrect.
- Drive UI labels like `Some incorrect` or `All incorrect` from this field.

**Do:**

- Use it only in contexts that are explicitly about confidence / calibration / trustworthiness.
- Keep correctness decisions based on `is_prediction_correct`, `has_multiple_predictions`, and `multi_test_all_correct` only.

---

## Common Anti-Patterns (Avoid These)

- **Re-implementing correctness logic in UI components**
  - Problem: Components drift from the shared definition and disagree with analytics.
  - Fix: Always call the shared utility (e.g. `determineCorrectness`) instead of duplicating logic.

- **Inferring per-test correctness from `multiTestAverageAccuracy`**
  - Problem: Treats a trustworthiness-style score as a ground-truth count; produces mismatches like "0/2 correct" + `Some incorrect`.
  - Fix: For display, stick to the simple triad: `Correct` / `Incorrect` / `All correct` as defined above.

- **Skipping validation in streaming paths**
  - Problem: Leaves `has_multiple_predictions`, `multi_test_all_correct`, `multi_test_prediction_grids` as `NULL`, which breaks both analytics and UI.
  - Fix: Ensure all streaming harnesses wrap the base runner in the same validation step as non-streaming analysis before persisting or emitting final summaries.

- **Hard-coding to the first test case only**
  - Problem: Hides additional test cases and produces misleading "single-test" visuals for genuinely multi-test puzzles.
  - Fix: When rendering grids, always consider the full `multi_test_prediction_grids` (or its fallbacks) and design layouts that handle 1, 2, or 3+ tests gracefully.

---

## Recommended Patterns for New Code

When you add new features that touch correctness:

1. **For SQL and repository code**
   - Use `MetricsQueryBuilder` utilities and the patterns in `CORRECTNESS_LOGIC_PATTERN.md` for **all aggregation logic**.
   - Treat `has_multiple_predictions` as the switch between single- and multi-test conditions.

2. **For application services and streaming**
   - Ensure validation runs in exactly one place and is reused by both streaming and non-streaming flows.
   - Confirm that after validation, the three key fields follow these invariants:
     - `has_multiple_predictions` is never `NULL` in new code paths.
     - If `has_multiple_predictions === false`, multi-test-only fields are either `NULL` or ignored.
     - If `has_multiple_predictions === true`, `multi_test_all_correct` is non-NULL and based on the full test set.

3. **For UI components**
   - Call shared correctness helpers instead of rolling your own boolean / label logic.
   - When you need counts for display (e.g. `N/N correct`), use the **actual number of test cases** plus the `multi_test_all_correct` flag; do not derive counts from calibration metrics.
   - Reuse existing grid and layout components that already handle multi-test puzzles where possible.

4. **For new metrics**
   - Be explicit: is the metric about **correctness**, **confidence**, or **trustworthiness**?
   - Keep correctness and calibration concerns separate in naming and implementation.

---

## Quick Checklist

Before merging changes that touch multi-test puzzles, verify:

- [ ] I am using `has_multiple_predictions`, `is_prediction_correct`, and `multi_test_all_correct` in a way that matches this guide.
- [ ] No UI component is inferring correctness from `multiTestAverageAccuracy` or other derived metrics.
- [ ] Streaming and non-streaming flows both run the same validation logic before persisting data.
- [ ] Aggregation queries follow the patterns in `CORRECTNESS_LOGIC_PATTERN.md`.
- [ ] New visualizations for multi-test puzzles handle 1, 2, and 3+ test cases without special-casing only the first test.

If in doubt, prefer to:

- Reuse existing helpers and patterns.
- Keep correctness logic centralized.
- Avoid introducing new states beyond `Correct` / `Incorrect` / `All correct` for multi-test runs.
