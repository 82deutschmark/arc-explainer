# 2025-11-27 Poetiq Model-Agnostic Plan

## Goal
Fix Poetiq’s habit of persisting every run as “Gemini 3 Pro” in the database by threading the actual model metadata (provider + model id) through the controller → service → persistence path so it matches user selection, similar to how Saturn and Grover preserve their underlying model context.

## Key References
- `server/controllers/poetiqController.ts` – builds runtime options and saves explanations.
- `server/services/poetiq/poetiqService.ts` – runs Python bridge and transforms results for DB storage.
- `server/python/poetiq_wrapper.py` – emits run metadata from the solver (already exposes `model` in start metadata).
- `docs/plans/2025-11-27-poetiq-visibility-debug-plan.md`, `server/services/saturnVisualService.ts`, `server/services/grover.ts` – examples of solver-specific persistence that keep model context intact.

## Tasks
1. **Audit request flow**
   - Confirm `usePoetiqProgress` and `poetiqController` pass the selected `model` and `provider`.
   - Verify Poetiq batch endpoint also records the requested model.
2. **Preserve run config inside `PoetiqService`**
   - When the Python bridge emits a final result, merge in sanitized run options so `result.config.model` (and related fields) are always populated without leaking API keys.
   - Ensure both real-time runs and batch runs receive the enriched metadata before persistence.
3. **Normalize persisted model names**
   - Update `transformToExplanationData` to derive the `modelName` slug from the full model identifier (e.g., `openrouter/google/gemini-3-pro-preview` → `poetiq-openrouter-google-gemini-3-pro-preview`) instead of stripping to the last segment.
   - Include the resolved model id in `providerRawResponse.config` so downstream tooling (progress grids, audits) can distinguish models.
4. **Verification**
   - Manually inspect the updated code paths to ensure `explanationService.saveExplanation` receives unique keys per model selection.
   - Update `CHANGELOG.md` with the new semantic version entry summarizing the fix.

## Expected Outcome
Each Poetiq run (single puzzle or batch) is saved under a model-specific key (e.g., `poetiq-openrouter-google-gemini-3-pro-preview`, `poetiq-openai-gpt-4.1`) so analytics, leaderboards, and community reports can differentiate accuracy/cost metrics by the actual model powering Poetiq, matching Saturn/Grover parity.

