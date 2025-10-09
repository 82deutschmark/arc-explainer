 * 
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T18:12:24-04:00
 * PURPOSE: Step-by-step plan to ingest Grover Python logs and backfill explanation entries without relying on derived trustworthiness scores.
 * SRP/DRY check: Pass - New plan specific to log backfill workflow.
 * shadcn/ui: Pass - Documentation only.

# Goals
- Transform archived Grover logs into explanation records that include predicted grids and binary correctness.
- Reuse existing persistence utilities so the database stays consistent with live solver runs.
- Keep the process idempotent and safe to rerun.

# Data Model Targets
- `predictedOutput` / `multiplePredictedOutputs`
- `hasMultiplePredictions`, `isPredictionCorrect`
- `groverIterations`, `groverBestProgram`, `iterationCount`
- Reasoning metadata from the final summarizer (optional but useful)

# Pipeline Phases

## 1. Discovery & Manifest
- Scan `solver/grover-arc/logs` for `{taskId}/{timestamp}` directories.
- Produce a manifest JSON (taskId, timestamp, path, existing DB status).
- Allow include/exclude lists to support incremental runs.

## 2. Log Parsing
- For each directory:
  - Read `log.txt` streaming; record each attempt with:
    - Iteration index, stage markers
    - Graded summary (ends with `MARK ATTEMPT GRADE`)
    - Execution summaries (train/test matches)
    - Raw output grids text
  - Map PNGs (`train_prediction_*`, `test_prediction_*`) to attempts via numeric suffix.
  - Load final `generated_program_*.py` for the selected attempt.

## 3. Candidate Selection
- Prefer the last attempt where `Test matches: True`.
- If none exists, take the final attempt (highest timestamp) and mark `isPredictionCorrect = false`.
- Record iterationCount and excerpt from `prev_attempts` for reasoningItems.

## 4. Reconstruction
- Fetch the official puzzle JSON (`puzzleLoader`) to retrieve test inputs.
- Execute the recovered program against the test grids using `pythonBridge.runGroverExecution` in test mode to verify the parsed output and generate canonical JSON.
- Build a normalized response object matching the structure expected by `explanationService.transformRawExplanation`, filling only the binary correctness fields (skip trustworthiness).

## 5. Persistence
- Call an internal helper (new script) that:
  1. Checks if an explanation for `{taskId, modelName='grover-log-backfill', timestamp}` already exists.
  2. Inserts via `repositoryService.explanations.saveExplanation`.
  3. Logs success/failure with manifest updates.
- Support dry-run mode that prints would-be inserts without touching the DB.

## 6. Audit & Reporting
- Summarize processed counts, successes, failures, skipped due to duplicates.
- Emit CSV/JSON for BI usage (taskId, timestamp, correct flag).
- Optionally copy PNGs to permanent storage for UI reference.

# Utilities To Build
- `scripts/backfill-grover-logs.ts`
  - CLI flags: `--manifest`, `--limit`, `--dry-run`, `--resume`.
  - Uses Node FS to parse logs, `pythonBridge` for execution, `explanationService` for persistence.
- Helper parser module with unit tests for:
  - Execution summary extraction
  - Grid parsing from log text
  - Program selection logic

# Risks & Mitigation
- **Parsing drift**: Logs may vary between runs. Mitigate via robust regex + fallback heuristics; add tests against sample directories.
- **Program replay failures**: sandbox may error on invalid code. Capture failure, mark record as `isPredictionCorrect=false`, and persist with diagnostic note.
- **Duplicate rows**: enforce manifest tracking + DB existence checks to maintain idempotency.

# Next Steps
1. Implement log parser library with unit tests using a subset of logs.
2. Create backfill CLI script (dry-run first) and verify output on a single puzzle.
3. Expand to batch processing with manifest control and full DB writes.

# Current Tooling Snapshot
- `scripts/backfill-grover-logs.ts` (dry-run prototype):
  ```
  node --import tsx scripts/backfill-grover-logs.ts --task 0934a4d8 --limit 1 --dry-run --verbose
  ```
  Prints the attempt that would be persisted for a given puzzle/run directory. Persistence hooks will be added in a later iteration.
