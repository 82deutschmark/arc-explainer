 * 
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T18:25:07-04:00
 * PURPOSE: Task checklist for implementing Grover log backfill end-to-end.
 * SRP/DRY check: Pass - Fresh implementation plan, no overlap with existing docs.
 * shadcn/ui: Pass - Backend architecture only.

# Grover Log Backfill Implementation Tasks

## 1. Parser Hardening
- [ ] Convert `scripts/backfill-grover-logs.ts` prototype into reusable modules (e.g., `scripts/grover/backfill/parser.ts`).
- [ ] Add unit tests covering:
  - Multiple execution summaries per run.
  - Cases with no test success (ensure final attempt is selected and marked incorrect).
  - Mapping between `generated_program_*.py` and execution summaries.
  - Grid parsing resilience (skip malformed rows, maintain order).
- [ ] Support multi-test puzzles: group `test_prediction_<idx>` rows and produce ordered arrays.

## 2. Program Replay
- [ ] Integrate with `pythonBridge.runGroverExecution` to execute the recovered program against official test inputs.
- [ ] Ensure replay failures are captured:
  - On failure, store the original parsed grid and set `isPredictionCorrect = false`.
  - Log error details to assist manual audits.
- [ ] Add CLI flag to skip replay when debugging parser (`--skip-replay`).

## 3. Payload Construction
- [ ] Build a `createBackfillPayload` helper that returns an object compatible with `explanationService.transformRawExplanation`.
- [ ] Populate:
  - `predictedOutput` / `multiplePredictedOutputs`
  - `hasMultiplePredictions`, `isPredictionCorrect`
  - `groverIterations`, `groverBestProgram`, `iterationCount`
  - Narrative fields (patternDescription, solvingStrategy, reasoningItems) from summarizer text.
- [ ] Leave trustworthiness-related fields (`predictionAccuracyScore`, `multiTestAverageAccuracy`) null.

## 4. Persistence Workflow
- [ ] Implement `scripts/backfill-grover-logs.ts` CLI:
  - Flags: `--root`, `--task`, `--limit`, `--resume`, `--dry-run`, `--skip-replay`.
  - In non-dry-run mode:
    1. Check for existing explanation rows using `repositoryService.explanations.getExplanationsForPuzzle`.
    2. Persist via `explanationService.saveExplanation` with a synthetic model name (e.g., `grover-log-backfill`).
    3. Record processed runs in a manifest (`.json`) to make the operation idempotent.
- [ ] Provide structured logging (JSON lines or CSV) summarizing processed runs.

## 5. Safety & Verification
- [ ] Add dry-run summary output (counts of skipped/inserted/correct/incorrect).
- [ ] Create a script to spot-check inserted rows (e.g., `scripts/backfill-grover-verify.ts` showing DB row summaries vs log predictions).
- [ ] Document known limitations (e.g., inability to reconstruct reasoning tokens).

## 6. Documentation & Handoff
- [ ] Update `docs/2025-10-09-grover-log-backfill-plan.md` with execution instructions (CLI examples for dry-run and live modes).
- [ ] Produce a short “Operator Guide” snippet (how to run, how to resume, expected runtime).
- [ ] After implementation, add a changelog entry summarizing the backfill capability.
