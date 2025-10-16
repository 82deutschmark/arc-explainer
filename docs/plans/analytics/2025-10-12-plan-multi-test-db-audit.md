 *
 * Author: Codex using GPT-5-high
 * Date: 2025-10-11T02:30:00Z
 * PURPOSE: VERBOSE DETAILS ABOUT HOW MULTI-TEST PREDICTION FIELDS FLOW FROM VALIDATORS THROUGH PERSISTENCE INTO CLIENT VIEWS, INCLUDING TRUSTWORTHINESS SCORE ALIASING AND REMAINING RISKS
 * SRP/DRY check: Pass - Dedicated research log, no overlapping functionality with existing docs after confirming via repo search
 * shadcn/ui: Pass - Documentation only, no UI components used

## Overview
- Multi-test persistence flows from validation (`server/services/responseValidator.ts`) through enrichment (`server/services/puzzleAnalysisService.ts`, `server/services/streamingValidator.ts`) into storage (`server/repositories/ExplanationRepository.ts`) and final transformation (`client/src/utils/typeTransformers.ts`).
- `multiTestAverageAccuracy` is treated as the trustworthiness score for multi-test runs; both validators set `trustworthinessScore = multiTestAverageAccuracy`, ensuring the DB `trustworthiness_score` column mirrors that metric.
- `predictionAccuracyScore` remains as the client-facing property mapped from `trustworthiness_score` for backward compatibility; there are no lingering references to the old database column name.

## Field Usage Trace
- `hasMultiplePredictions`: enforced during validation and persistence (`server/services/responseValidator.ts:48`, `server/services/puzzleAnalysisService.ts:346`, `server/services/streamingValidator.ts:62`, `server/repositories/ExplanationRepository.ts:100`, `client/src/utils/typeTransformers.ts:29`).
- `multiplePredictedOutputs`: captured as the array of predicted grids (`server/services/responseValidator.ts:49`, `server/services/puzzleAnalysisService.ts:345`, `server/services/streamingValidator.ts:63`, `server/repositories/ExplanationRepository.ts:100`, `client/src/utils/typeTransformers.ts:30`).
- `multiTestResults`: stores per-test validation detail (`server/services/responseValidator.ts:50`, `server/services/puzzleAnalysisService.ts:347`, `server/services/streamingValidator.ts:64`, `server/services/explanationService.ts:60`, `server/repositories/ExplanationRepository.ts:100`, `client/src/utils/typeTransformers.ts:31`).
- `multiTestAllCorrect`: boolean gate for multi-test success (`server/services/responseValidator.ts:51`, `server/services/puzzleAnalysisService.ts:352`, `server/services/streamingValidator.ts:65`, `server/repositories/ExplanationRepository.ts:100`, `client/src/utils/typeTransformers.ts:32`).
- `multiTestAverageAccuracy`: average trustworthiness / correctness rate (`server/services/responseValidator.ts:52`, `server/services/puzzleAnalysisService.ts:353`, `server/services/streamingValidator.ts:69`, `server/repositories/ExplanationRepository.ts:100`, `client/src/utils/typeTransformers.ts:33`).
- `predictedOutputGrid` (single-test fallback or first grid): validated and sanitized for both modes (`server/services/responseValidator.ts:97`, `server/services/puzzleAnalysisService.ts:366`, `server/services/streamingValidator.ts:82`, `server/repositories/ExplanationRepository.ts:100`, `client/src/utils/typeTransformers.ts:23`).
- Trustworthiness aliasing: multi-test validation sets `trustworthinessScore` from `multiTestAverageAccuracy` (`server/services/puzzleAnalysisService.ts:358`, `server/services/streamingValidator.ts:74`); repository stores it in `trustworthiness_score`, exposed as `predictionAccuracyScore` (`server/repositories/ExplanationRepository.ts:141-144`, `client/src/utils/typeTransformers.ts:25`).

## Data Flow Notes
- Validator distinguishes multi-test scenarios via `multiplePredictedOutputs === true` then reconstructs actual grid arrays using `extractPredictions` (`server/services/responseValidator.ts:600-704`). Partial captures are allowed and null-padded.
- `puzzleAnalysisService.validateAndEnrichResult` mirrors streaming validator logic, ensuring both synchronous and streaming pipelines persist identical schema (`server/services/puzzleAnalysisService.ts:329-379` vs `server/services/streamingValidator.ts:36-101`).
- `explanationService.transformRawExplanation` ensures ingestion and backfill scripts feed precomputed fields directly to the repository without schema translation (`server/services/explanationService.ts:35-78`).
- Repository writes jsonb fields using `safeJsonStringify` to avoid Postgres text coercion, while read path sanitizes grids to filter legacy null rows (`server/repositories/ExplanationRepository.ts:82-115`, `server/repositories/ExplanationRepository.ts:560-585`).

## Risks & Questions
- Accuracy flag semantics: front-end still labels `trustworthiness_score` as `predictionAccuracyScore`, which can mislead unless UI copy clarifies it is a blended trustworthiness metric (`client/src/components/puzzle/AnalysisResultContent.tsx:112`).
- Multi-test detection relies on models flagging `multiplePredictedOutputs === true`; if providers emit arrays without the boolean sentinel, validation falls back to raw extraction but logs partial success (`server/services/responseValidator.ts:624-676`). Continue monitoring for provider regressions.
- No residual database references to the deprecated `prediction_accuracy_score` column name were found; aliasing exists only at the TypeScript level for compatibility (`shared/types.ts:74`, `client/src/types/puzzle.ts:19`).
- Consider documenting for the user-facing UI that `multiTestAverageAccuracy` equals trustworthiness to avoid confusion when comparing with single-test `trustworthinessScore`.
