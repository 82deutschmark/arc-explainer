# Beetree Submission Ingestion & Visualization Plan

**Author:** Codex (GPT-5)  
**Date:** 2025-12-03  
**Purpose:** Define how to ingest the BeeTree solver run stored in `submission.json` and surface its results to end users alongside the existing Hugging Face model data.  
**SRP/DRY check:** Pass — this document scopes the ingestion + visualization workflow without redefining validation or analytics logic that already exists elsewhere.

---

## 1. Goals
- Treat the BeeTree aggregated submission exactly like the Hugging Face two-attempt datasets so that metrics, comparisons, and dashboards can read the data with **no special cases**.
- Preserve BeeTree-specific metadata (ensemble votes, per-model costs, explanations) so we meet the database’s non-null text requirements and keep provenance.
- Make the imported BeeTree attempts selectable everywhere users already browse models (`/scoring`, `/model-comparison`, analytics tables) without building a brand-new page.

---

## 2. Observations About `submission.json`
1. The file lives at repo root (`d:\GitHub\arc-explainer\submission.json`, ~3.4 MB) and follows the pattern:
   ```json
   {
     "fc7cae8d": [
       { "attempt_1": [[...]], "attempt_2": [[...]] }, // test 0
       { "attempt_1": [[...]], "attempt_2": [[...]] }  // test 1
     ],
     "e12f9a14": [ ... ]
   }
   ```
   - Each top-level key is an ARC puzzle ID.
   - Each value is an array whose length matches the number of **test** grids for that puzzle.
   - Every element only contains **raw grids**, no metadata (providers, explanations, tokens, etc.).
2. BeeTree logs for the same run already exist in `logs/` with filenames like `beetree_<timestamp>_<puzzleId>_<testIdx>_step_finish.json`. These files include:
   - `picked_solutions` with the same winning grids used to build the submission file.
   - `candidates_object`, contributing model IDs, costs, token counts, and raw LLM responses needed to satisfy explanation + provenance requirements.
3. Hugging Face ingestion currently fetches per-puzzle JSON files remotely. Aside from the transport differences, the aggregation logic (per attempt, across tests) we need for BeeTree is identical.

---

## 3. Proposed Implementation

### 3.1 Parsing & Validation
1. **Submission parser utility** (new module, e.g. `server/services/beetree/beetreeSubmissionParser.ts`)
   - Accept a local file path.
   - Validate top-level shape is `Record<string, BeeTreeTestEntry[]>`.
   - Validate each `attempt_n` grid matches ARC constraints using the existing grid validator (integers 0–9, rectangular).
   - Normalize into:
     ```ts
     type AggregatedAttempts = {
       attempt1: number[][][];
       attempt2: number[][][];
     };
     ```
   - Track the source timestamp or label for logging + ingestion_runs metadata.
2. **Puzzle availability check**
   - Use `PuzzleLoader` (already leveraged by the HF script) to ensure every puzzleId in the submission exists in whichever dataset we’re targeting (ARC public eval unless specified).
   - Record `notFoundErrors` when a puzzle ID has no local ground truth.

### 3.2 Metadata & Explanation Enrichment
1. **Log indexing helper** (`server/services/beetree/beetreeLogParser.ts`)
   - Scan the provided logs directory once and index files by `puzzleId + testIndex`.
   - Provide methods to fetch:
     - `picked_solutions` entries for attempt 1 or 2.
     - Candidate pool data and `models[]` arrays.
   - Provide random access to per-step log entries (e.g., `step_1.json`) by `run_id` so we can extract:
     - Raw assistant responses (`reasoning_log`).
     - Input/output token counts plus `cost`.
2. **Explanation extractor** (`server/services/beetree/beetreeExplanationExtractor.ts`)
   - Given a raw LLM response, derive `pattern_description` and `solving_strategy`.
   - Reuse heuristics from other code paths if available (search repo for similar extraction logic) to avoid duplication.
   - Always fall back to storing the entire assistant response in `reasoning_log`.
3. **Cost aggregator**
   - Sum tokens + monetary cost across every `run_id` tied to the winning attempt (across all tests).
   - Populate `input_tokens`, `output_tokens`, `total_tokens`, and `estimated_cost` on the explanation rows.
4. **Provider metadata blob**
   - Build a JSON structure that captures BeeTree-specific details (`candidates_object`, contributing models, vote counts, timing).
   - Store inside `provider_raw_response` so downstream tools can inspect the ensemble later.

### 3.3 Persistence Workflow
1. **New CLI script** `server/scripts/ingest-beetree-results.ts`
   - Mirror the structure + options from `ingest-huggingface-dataset.ts`, but source data from:
     - `--submission-file <path>` (required).
     - `--logs-directory <path>` (required for explanations/costs).
   - Additional useful flags:
     - `--dataset-name beetree-ensemble-v1` (used for `ingestion_runs` + base model name prefix).
     - `--label <string>` so multiple BeeTree configurations can co-exist (`beetree-ensemble-v1-prod-attempt1`).
     - `--skip-duplicates` / `--force-overwrite` parity with HF ingestion.
     - `--resume-from`, `--only-missing`, `--stop-on-error`, `--dry-run`.
   - Workflow per puzzle:
     1. Aggregate attempt grids across tests.
     2. Compare with ground truth via `validateSolverResponse` or `validateSolverResponseMulti`.
     3. Pull explanations/token data out of logs for the winning attempt.
     4. Construct the `ExplanationInsert` payload (pattern text, predictions, accuracy flags, costs, metadata).
     5. Insert into DB inside a transaction (delete existing row first if overwriting).
   - Update `ingestion_runs` at start/end so the admin UI automatically records the BeeTree import just like HF runs.
2. **Optional REST hook**
   - If we want UI parity with `/admin/ingest-hf`, extend `adminController.ts` + `server/routes.ts` with a POST route that triggers the BeeTree CLI via `worker_threads` or spawns a process.
   - For the immediate need (local ingestion), running the CLI manually is sufficient; we can defer UI wiring if time-constrained.

### 3.4 Surfacing BeeTree Results to Users
1. **Model naming convention**
   - `beetree-ensemble-v1-attempt1`
   - `beetree-ensemble-v1-attempt2`
   - Optional suffix when `--label` is supplied.
   - Guarantees these entries automatically appear anywhere we list models.
2. **Official scoring page (`client/src/pages/HuggingFaceUnionAccuracy.tsx`)**
   - This page sources its data from the explanations DB filtered by the union accuracy helper.
   - Once BeeTree rows exist, they will appear as selectable models with no code changes.
   - Verify that the dataset dropdown includes the BeeTree prefix; if not, extend whatever service builds the attempt list (likely `server/controllers/metricsController.ts` or a repository method) to include `model_name LIKE 'beetree%'`.
3. **Model comparison page (`client/src/pages/ModelComparisonPage.tsx`)**
   - Uses `/api/metrics/compare`. Ensure `useAvailableModels` pulls the BeeTree names (should already happen if we don’t filter by provider).
   - Add copy tweaks (if desired) clarifying that BeeTree entries represent an ensemble meta-solver, but this is optional—data visibility works as soon as ingestion succeeds.
4. **Changelog / Docs**
   - Document the ingestion command, model names, and how to re-run imports inside `CHANGELOG.md` and potentially `docs/beetree-integration.md`.

---

## 4. Target Files & To‑Dos

| File/Directory | Action |
| -------------- | ------ |
| `server/scripts/ingest-beetree-results.ts` | New CLI entry mirroring the Hugging Face script but reading local submission/logs inputs. |
| `server/services/beetree/beetreeSubmissionParser.ts` | Parse + validate `submission.json`, aggregate attempts. |
| `server/services/beetree/beetreeLogParser.ts` | Index BeeTree logs, expose helpers to pull picked solutions, candidate metadata, and raw LLM responses. |
| `server/services/beetree/beetreeExplanationExtractor.ts` | Convert raw assistant text into `pattern_description` + `solving_strategy` while storing the full reasoning log. |
| `server/services/beetree/beetreeCostAggregator.ts` (or combined with parser) | Sum tokens and costs per attempt. |
| `server/controllers/adminController.ts` & `server/routes.ts` (optional) | Add endpoint to trigger BeeTree ingestion from the admin UI if we want parity with HF ingestion. |
| `client/src/pages/HuggingFaceIngestion.tsx` (optional) | Surface a “BeeTree file ingestion” section pointing to the new CLI/endpoint if we expose it via UI. |
| `docs/beetree-integration.md` | Update with the finalized ingestion workflow + command examples once implemented. |
| `CHANGELOG.md` | Record the addition of the BeeTree ingestion pipeline + UI visibility so users know how to use it. |

---

## 5. Open Questions / Risks
1. **Log completeness:** The submission file alone lacks explanation text. If any `step_finish` or `step_n` logs are missing for a puzzle, we cannot satisfy the NOT NULL text fields. Mitigation: treat as a validation error and skip insertion (logging the gap) until logs are regenerated.
2. **Runtime:** BeeTree logs are large; parsing them repeatedly per puzzle could be slow. We should build the log index once (map filenames → metadata) to keep ingestion time reasonable.
3. **Data consistency:** Ensure the `run_timestamp` embedded in file names matches the submission we ingest so we don’t accidentally mix logs from different runs. CLI should enforce both paths reference the same timestamp prefix.
4. **User-facing messaging:** Once BeeTree appears in public pages, we should add short descriptive text (e.g., “BeeTree ensemble run from Dec 3, 2025”) so hobbyist users know why two “attempt” models per BeeTree exist.

---

## 6. Next Steps
1. Implement the parser + log utilities (Sections 3.1 & 3.2).
2. Build the CLI ingestion script and run a dry-run to verify validations.
3. Execute a full ingestion, confirm new model names show up in `/scoring` and `/model-comparison`.
4. Update docs + changelog so other contributors can repeat the process.
5. (Optional) Add admin UI hook if we want one-click BeeTree imports later.

This plan keeps the BeeTree ingestion path aligned with the Hugging Face workflow while satisfying the richer metadata requirements outlined in `docs/beetree-integration.md`.
