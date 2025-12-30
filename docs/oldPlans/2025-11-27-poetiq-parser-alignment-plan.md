# 2025-11-27 Poetiq Parser Alignment Plan

## Goal
Reuse the existing solver response parser/validator pipeline for Poetiq results so newline-heavy predictions and multi-test arrays are normalized before we persist them.

## Why
- Poetiq currently bypasses `responseValidator.ts`, so predictions are saved verbatim (including stray newline escapes).
- The shared validator already uses `jsonParser` + regex fallbacks to clean grids, pad multi-test predictions, and compute metadata.
- Aligning Poetiq with that flow keeps downstream analytics (multi-test stats, extraction methods, etc.) consistent with Saturn/Grover.

## Tasks
1. **Thread task context → transformer**
   - Update `poetiqService.transformToExplanationData` to accept the loaded `ARCTask`.
   - Controllers already have the task when saving results, so just pass it through.
2. **Invoke shared validator**
   - Build a synthetic response object with Poetiq predictions, solving strategy text, and generated code.
   - Call `validateSolverResponse` (single-test) or `validateSolverResponseMulti` (multi-test) when ground-truth outputs exist.
   - Prefer sanitized grids/multi-test data from the validator when constructing the explanation payload; fall back to raw Poetiq data if validation isn’t possible.
   - Store validation metadata inside `providerRawResponse` for auditing.
3. **Document + changelog**
   - Mention the parser alignment in CHANGELOG so auditors know Poetiq data now flows through the same sanitizer stack.

## Expected Outcome
Poetiq explanations will have the same cleaned `predictedOutputGrid`, `multiplePredictedOutputs`, and `multiTest*` fields as every other solver, eliminating stray newline sequences and ensuring consistency across analytics.

