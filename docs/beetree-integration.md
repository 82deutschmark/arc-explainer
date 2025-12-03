# BeeTree ARC Solver Integration Plan

Author: Claude Code using Sonnet 4.5
Date: 2025-01-12
PURPOSE: Complete specification for ingesting BeeTree multi-model ensemble solver results into the arc-explainer database. This document outlines BeeTree's architecture, output formats, and a concrete field-by-field mapping to the existing `explanations` table schema.

This plan was revised to address critical requirements:
- Extract real LLM explanations from winning models (NOT generic placeholders)
- Preserve ensemble metadata (voting, model contributions, costs)
- Use model naming that reflects BeeTree's meta-solver nature
- Include cost/token tracking in Phase 1
- Robust validation, duplicate handling, and error recovery

---

## 1. What BeeTree is actually doing

At a high level, BeeTree is a **multi‑model, multi‑step ARC meta-solver** that:

- **Loads one ARC task** (JSON) and one **test index** at a time.
- Builds prompts from `train` + the selected `test` example.
- **Runs many models in parallel** (`claude-sonnet-4.5`, `claude-opus-4.5`, `gpt‑5.1`, `gemini‑3`, etc.) across several steps:
  - **Step 1**: shallow search with multiple models.
  - **Step 2**: evaluate whether we're already "solved".
  - **Step 3**: second round of models if needed.
  - **Step 4**: evaluate again.
  - **Step 5**: heavy search (deep thinking, image-based, and hint-based runs in parallel).
- Each individual model call returns:
  - A **predicted grid** for the test (`grid`).
  - Whether that grid matches ground truth when available (`is_correct`).
  - Token counts and **cost** (via `calculate_cost` in poetiq_wrapper.py).
  - The full prompt and **full raw LLM response** text.

All these individual calls are merged into a **candidate pool**:

```python
candidates_object[grid_tuple] = {
  "grid": predicted_grid,        # 2D int array
  "count": how many runs produced this grid,
  "models": [run_id1, run_id2…], # which runs produced it
  "is_correct": True/False/None  # ground‑truth comparison
}
```

Then BeeTree:

- Uses `is_solved(candidates_object)` to decide if it's confident:
  - Top grid > 25% of all runs,
  - Top grid seen at least 4 times,
  - All other grids have count == 1.
- Uses `pick_solution(candidates_object)` to:
  - Sort candidate groups by **frequency** and then **model priority**
    (`claude-opus-4.5` > `gemini-3-high` > `gpt‑5.1‑high` > `claude-sonnet-4.5`).
  - Return the **top 1–2 candidate groups** and an overall **solved?** flag.

So conceptually, **BeeTree is a meta‑solver** that:

- Runs a *lot* of LLM calls.
- Votes them into a few candidate grids.
- Chooses the best 1–2 candidates with a fixed priority rule.

---

## 2. What BeeTree outputs on disk

When you run `beetreeARC/run.py` in batch mode (`--task-directory` + `--solver`):

### 2.1 Per‑task/test results (used for ingestion)

From `batch_processing.run_batch_execution` and `execution.execute_task`:

- Each worker returns:
  `task_id, test_index, predictions`

For solver mode, `predictions` is what `solver_engine.run_solver_mode` returns:

- `run_solver_mode` → `finalize_result` → `pick_solution`
- So:

```python
predictions == picked_solutions
```

Where `picked_solutions` is the **top 1–2 candidate groups**, e.g.:

```json
[
  {
    "grid": [[1,0],[0,1]],
    "count": 7,
    "models": [
      "claude-opus-4.5-thinking-60000_1_step_1",
      "gpt-5.1-high_2_step_3",
      "gemini-3-high_3_step_5_image",
      ...
    ],
    "is_correct": true
  },
  {
    "grid": [[0,1],[1,0]],
    "count": 3,
    "models": [...],
    "is_correct": false
  }
]
```

`run.py` collects all `(task_id, test_idx, predictions)` triples into `final_results` and then calls:

```python
generate_submission(final_results, args.submissions_directory, run_timestamp)
```

### 2.2 Submission files (`submissions/`)

`src/submission.py` does two things:

1. **Per‑test JSONs**
   For each `(task_id, test_idx, preds)`:

   - Writes:
     `submissions/{run_timestamp}_{task_id}_{test_idx}.json`
   - Content: exactly the `preds` list above (candidate groups with `grid`, `count`, `models`, `is_correct`).

2. **Aggregated submission file (ARC‑AGI style)**

   It then recomputes a **formatted submission** grouped by `task_id`:

   ```json
   {
     "00576224": [
       { "attempt_1": [[...]], "attempt_2": [[...]] },  // test case 1
       { "attempt_1": [[...]], "attempt_2": [[...]] }   // test case 2
     ],
     "009d5c81": [
       ...
     ]
   }
   ```

   - For each `(task_id, test_idx)`:

     - It looks at the `preds` list of candidate groups.
     - Extracts all candidate `grid`s in order.
     - Sets:
       - `attempt_1` = first candidate grid if any, else `[[0]]`
       - `attempt_2` = second grid if available, else repeats the first (or `[[0]]` fallback)

   - Writes a single file:

     - `submissions/{run_timestamp}_submission.json`

**This `*_submission.json` is the clean, compact "2 attempts per test" format** and is the primary ingestion source, very similar to the HuggingFace datasets already handled.

### 2.3 Logs (`logs/`)

**CRITICAL for Phase 1 ingestion** (not optional):

- `logs/{timestamp}_{task_id}_{test_index}_step_1.json` etc.
- `logs/{timestamp}_{task_id}_{test_index}_step_finish.json` contains:

  ```json
  {
    "candidates_object": { "...": {...}, ... },
    "picked_solutions": [...],     // same shape as per‑test preds
    "result": "PASS" | "FAIL" | "SUBMITTED",
    "correct_solution": [[...]]    // ground truth grid if available
  }
  ```

- Individual step logs (`step_1.json`, `step_3.json`, `step_5.json`) contain per-model runs with:
  - `run_id`, `model_name`, `step`
  - `input_tokens`, `output_tokens`, `cached_tokens`, `cost`
  - `"Full raw LLM response"` text
  - `"Predicted grid"`, `"Is correct"`, timing data

**Phase 1 must read these logs** to extract real explanations, token counts, and costs.

---

## 3. Your current database & ingestion pattern

### 3.1 The `explanations` table (core fields we care about)

From [DatabaseSchema.createExplanationsTable](server/repositories/database/DatabaseSchema.ts:58-106):

- **Identity / metadata**
  - `id`
  - `puzzle_id` (string)
  - `model_name` (string)
  - timestamps etc.

- **Text fields (required)**
  Both **NOT NULL**:
  - `pattern_description TEXT NOT NULL`
  - `solving_strategy TEXT NOT NULL`
  - `hints TEXT[] DEFAULT '{}'`
  - `confidence INTEGER` (0–100) – can be `NULL`

- **Prediction fields**
  - Single‑test:
    - `predicted_output_grid JSONB`
    - `is_prediction_correct BOOLEAN`
  - Multi‑test:
    - `has_multiple_predictions BOOLEAN`
    - `multiple_predicted_outputs JSONB`
    - `multi_test_prediction_grids JSONB`
    - `multi_test_results JSONB`
    - `multi_test_all_correct BOOLEAN`
    - `multi_test_average_accuracy FLOAT`

- **LLM / cost / telemetry (all optional)**
  - `reasoning_log`, `reasoning_items`
  - `input_tokens`, `output_tokens`, `reasoning_tokens`, `total_tokens`
  - `estimated_cost`
  - `system_prompt_used`, `user_prompt_used`, `prompt_template_id`, `custom_prompt_text`
  - `provider_response_id`, `provider_raw_response`

Accuracy and metrics repositories compute model stats entirely from:

- `puzzle_id`
- `model_name`
- `predicted_output_grid` / `multi_test_prediction_grids`
- `is_prediction_correct` / `multi_test_all_correct`
- tokens & cost if present.

### 3.2 Existing ingestion flow (HuggingFace script)

[server/scripts/ingest-huggingface-dataset.ts](server/scripts/ingest-huggingface-dataset.ts) shows the pattern we must mirror:

- Reads **external submission JSON** where each puzzle has **two attempts** (`attempt_1`, `attempt_2`) per test case.
- Aggregates per attempt across all tests → **one DB row per attempt**:
  - For multi‑test puzzles, builds `multiplePredictedOutputs` (one grid per test).
  - Runs `validateSolverResponseMulti` or `validateSolverResponse` to compute:
    - `isPredictionCorrect` and/or `multiTestAllCorrect`
    - `multiTestResults`, `multiTestAverageAccuracy`
  - Builds an `enrichedData` object mapping HF metadata to:
    - `puzzleId`, `modelName`, `predictedOutputGrid` / `multiTestPredictionGrids`, correctness flags.
    - Tokens & cost.
    - `patternDescription`, `reasoningLog`, etc. from HF's assistant messages.
  - Saves via `repositoryService.explanations.saveExplanation(enrichedData)`.
- Tracks run‑level stats in `ingestion_runs` for admin dashboards (`dataset_name`, `base_url`, counts, `accuracy_percent`).

We **reuse this exact pattern**, just with BeeTree instead of HF.

---

## 4. Revised ingestion design for BeeTree

### 4.1 High‑level approach

- **Input**:
  - One BeeTree `*_submission.json` file (primary data source for grids/attempts)
  - Corresponding `logs/` directory (required for explanations, costs, metadata)
- **Transformation**:
  - For each puzzle (`task_id`), reorganize BeeTree's **per‑test** `attempt_1` / `attempt_2` grids into **per‑attempt** lists of grids across all tests.
  - **Read BeeTree logs** to extract:
    - Real LLM explanation text from winning model(s)
    - Token counts and costs aggregated across all contributing model runs
    - Ensemble metadata (candidates_object, voting data)
  - Validate those predictions against our local puzzle data using existing validators.
  - Validate submission file structure before processing.
- **Output**: 2 `explanations` rows per puzzle:
  - `model_name = "beetree-ensemble-v1-attempt1"`
  - `model_name = "beetree-ensemble-v1-attempt2"`
  - Predictions & correctness stored exactly like HF imports.
  - **Real explanation text** from winning models, not placeholders.
  - **Cost and token tracking** in Phase 1.
  - **Ensemble metadata** preserved in `provider_raw_response`.
- **Tracking**: Create an `ingestion_runs` record for the BeeTree batch.

This makes BeeTree show up automatically in all existing accuracy dashboards and comparisons, with full cost visibility and real explanations.

---

## 5. Field‑by‑field mapping (REVISED)

### 5.1 From BeeTree submission → per‑attempt predictions

Given `submission` structure:

```ts
type BeeTreeTestEntry = { attempt_1: number[][]; attempt_2: number[][] };

type BeeTreeSubmission = {
  [taskId: string]: BeeTreeTestEntry[];
};
```

For each `taskId`:

- Let `tests = submission[taskId]` (length N).
- Build:

```ts
attempt1Grids = tests.map(t => t.attempt_1); // length N
attempt2Grids = tests.map(t => t.attempt_2); // length N
```

We now have exactly the same structure as HF's `predictedGrids` per attempt.

### 5.2 Validation: Submission structure (new requirement)

Before processing any puzzle, validate the submission file:

- Top-level is an object `{ [taskId: string]: Array<{attempt_1, attempt_2}> }`.
- Each `attempt_1` / `attempt_2` is a **valid ARC grid**:
  - 2D array of integers 0–9.
  - Reuse `validateGrid` logic from [server/services/schemas/solver.ts:132-146](server/services/schemas/solver.ts:132-146).
- For each puzzle:
  - Non-empty test array.
- If validation fails:
  - Log clear errors with puzzle ID and specific issue.
  - Count as a **validation error** (separate from processing failures).
  - Respect `--stop-on-error` flag.

### 5.3 Validation: Predictions using existing code

For each `taskId`:

- Load puzzle: `puzzleData = puzzleLoader.loadPuzzle(taskId)`
  - `expectedOutputs = puzzleData.test.map(t => t.output)`

For each attempt `k` (1 or 2):

- If `N > 1` (multi‑test):

  - Construct:

    ```ts
    const multiResponse = {
      multiplePredictedOutputs: attemptKGrids,
      predictedOutput1: attemptKGrids[0],
      predictedOutput2: attemptKGrids[1], // etc up to N
      ...
    };
    ```

  - Call:

    ```ts
    validationResult = validateSolverResponseMulti(
      multiResponse,
      expectedOutputs,
      'external-beetree',
      null // no confidence
    );
    ```

  - Use:
    - `multiTestResults`
    - `multiTestAllCorrect`
    - `multiTestAverageAccuracy`

- If `N === 1` (single test):

  - Call:

    ```ts
    validationResult = validateSolverResponse(
      { predictedOutput: attemptKGrids[0] },
      expectedOutputs[0],
      'external-beetree',
      null
    );
    ```

  - Use:
    - `isPredictionCorrect`
    - `predictionAccuracyScore`

Either way, we can also pass the result to `determineCorrectness` (from [shared/utils/correctness.ts:39-84](shared/utils/correctness.ts:39-84)) for reporting/summary.

### 5.4 Extracting real explanations from BeeTree logs (CRITICAL)

**Requirement**: `pattern_description` and `solving_strategy` are NOT NULL and must contain meaningful, puzzle-specific text.

For each `(taskId, attemptNumber)`:

1. **Locate the winning model's response**:
   - Read `logs/{run_timestamp}_{task_id}_{test_index}_step_finish.json` for each test in the puzzle.
   - Match the `attempt_k` grid to a candidate in `picked_solutions[k-1]`.
   - Get the first `run_id` from `picked_solutions[k-1].models[]`.
   - Find that `run_id` in the appropriate step log (`step_1.json`, `step_3.json`, or `step_5.json`).

2. **Extract explanation text**:
   - From the matching run entry, use `"Full raw LLM response"`.
   - Parse or extract:
     - **`pattern_description`**: First substantial paragraph or section that describes the pattern (e.g., sections labeled "Pattern:", "Observation:", or first 200-500 chars of substantive text).
     - **`solving_strategy`**: Section describing how to solve (e.g., "Steps:", "Strategy:", "Approach:", or a distilled summary if not explicitly labeled).
   - Store the **full untruncated response** in `reasoning_log`.

3. **Fallback strategy**:
   - If we cannot locate a winning response for a specific test:
     - Try the next `run_id` in the `models[]` list.
     - If no responses are available at all (data corruption/missing logs):
       - Count as a **validation error**.
       - Do NOT insert a row with placeholder text.
       - Log the error clearly and move to next puzzle.

**This ensures every row has real, puzzle-specific explanation text, not generic boilerplate.**

### 5.5 Aggregating cost and token data (Phase 1 requirement)

For each `(taskId, attemptNumber)`:

1. **Identify contributing model runs**:
   - For each test in the puzzle, read the `step_finish.json` to get `picked_solutions[attemptNumber-1].models[]`.
   - Collect all unique `run_id`s across all tests for this attempt.

2. **Sum costs and tokens**:
   - For each `run_id`, locate it in the appropriate step log.
   - Extract:
     - `input_tokens`
     - `output_tokens`
     - `cached_tokens` (if present)
     - `cost`
   - Aggregate across all runs:
     - `total_input_tokens = sum(input_tokens)`
     - `total_output_tokens = sum(output_tokens)`
     - `total_tokens = total_input_tokens + total_output_tokens`
     - `estimated_cost = sum(cost)`

3. **Store in `explanations`**:
   - `input_tokens = total_input_tokens`
   - `output_tokens = total_output_tokens`
   - `total_tokens = total_tokens`
   - `estimated_cost = estimated_cost`

**This gives immediate cost visibility for BeeTree in dashboards.**

### 5.6 Preserving ensemble metadata (Phase 1 requirement)

For each `explanations` row, populate `provider_raw_response` (JSONB) with:

```json
{
  "beetree_metadata": {
    "version": "v1",
    "candidates_object": { /* full candidates_object from step_finish */ },
    "picked_solution": { /* the specific picked_solutions entry for this attempt */ },
    "contributing_models": [
      {
        "run_id": "claude-opus-4.5-thinking-60000_1_step_1",
        "model_name": "claude-opus-4.5",
        "step": 1,
        "input_tokens": 1234,
        "output_tokens": 567,
        "cost": 0.0234,
        "duration_seconds": 12.5,
        "grid": [[...]]
      },
      // ... more runs
    ],
    "vote_count": 7,
    "total_runs": 15,
    "agreement_rate": 0.467
  }
}
```

This preserves:
- Which specific models contributed
- Vote counts and confidence metrics
- Per-model cost breakdown
- Raw candidate pool data

All available for future analytics without requiring re-processing logs.

### 5.7 Mapping into `explanations` rows (REVISED)

For each `(taskId, attemptNumber)` and its validation result:

- **Identity & model naming**
  - `puzzleId`: `taskId`
  - `modelName`:
    - `"beetree-ensemble-v1-attempt1"`
    - `"beetree-ensemble-v1-attempt2"`
    - Or if `--label <name>` is provided: `"beetree-ensemble-v1-{label}-attempt{N}"`

- **Predictions & correctness**
  - If multi‑test (`N > 1`):
    - `hasMultiplePredictions = true`
    - `multiplePredictedOutputs = attemptKGrids`
    - `multiTestPredictionGrids = attemptKGrids`
    - `multiTestResults = validationResult.multiTestResults`
    - `multiTestAllCorrect = validationResult.multiTestAllCorrect`
    - `multiTestAverageAccuracy = validationResult.multiTestAverageAccuracy`
    - `predicted_output_grid = attemptKGrids[0]` (first test, for convenience)
    - `is_prediction_correct = validationResult.multiTestResults[0].isPredictionCorrect`
  - If single‑test (`N === 1`):
    - `predicted_output_grid = attemptKGrids[0]`
    - `is_prediction_correct = validationResult.isPredictionCorrect`
    - `hasMultiplePredictions = false`
    - Multi‑test fields left `NULL`.

- **Required text fields (extracted from logs)**
  - `pattern_description`: Extracted from winning model's LLM response (see §5.4).
  - `solving_strategy`: Extracted from winning model's LLM response (see §5.4).
  - `reasoning_log`: Full untruncated LLM response text.
  - `hints = []`
  - `confidence = NULL` (do NOT synthesize from vote counts; leave NULL to avoid confusion)

- **Cost and token fields (aggregated from logs)**
  - `input_tokens`: Sum of all contributing runs (see §5.5).
  - `output_tokens`: Sum of all contributing runs.
  - `total_tokens`: `input_tokens + output_tokens`.
  - `estimated_cost`: Sum of all contributing run costs.
  - `reasoning_tokens = NULL` (BeeTree doesn't separately track reasoning tokens per run)

- **Ensemble metadata**
  - `provider_raw_response`: Structured JSONB with candidates, votes, per-model stats (see §5.6).

- **Other optional fields**
  - `system_prompt_used = NULL` (BeeTree uses multiple prompts)
  - `user_prompt_used = NULL` (varies per model/step)
  - `prompt_template_id = 'external-beetree'`
  - `custom_prompt_text = NULL`
  - `provider_response_id = NULL` (no single provider conversation ID for ensemble)

---

## 6. Concrete implementation steps (REVISED)

### Phase 1 – Full ingestion with real explanations, costs, and metadata

1. **Add a new script** `server/scripts/ingest-beetree-results.ts` that:
   - Mirrors the structure of [ingest-huggingface-dataset.ts](server/scripts/ingest-huggingface-dataset.ts).
   - CLI options:
     - `--submission-file <path>` (required): Path to `*_submission.json`.
     - `--logs-directory <path>` (required): Path to BeeTree `logs/` directory.
     - `--dataset-name <string>` (default: `beetree-ensemble-v1`).
     - `--label <string>` (optional): Additional label for model name (e.g., `prod`, `test`).
     - `--source <ARC1|ARC2|ARC-Heavy|ConceptARC|...>` (optional).
     - `--limit <N>` (optional, like HF script).
     - `--dry-run`, `--verbose`, `--force-overwrite`, `--skip-duplicates` (default), `--no-skip-duplicates`, `--stop-on-error`.
     - `--resume-from <puzzleId>` (optional): Skip puzzles until this ID is reached.
     - `--only-missing` (optional): Only process puzzles not already in DB for this model.

2. **Inside the script**:
   - Initialize DB via `repositoryService.initialize()`.
   - Load local puzzles via `PuzzleLoader` with the same `source` options the HF script uses.
   - **Validate submission file structure** (see §5.2) before any DB operations.
   - Parse the BeeTree submission JSON into an in‑memory `BeeTreeSubmission`.
   - Index the logs directory to quickly locate step files by `(task_id, test_index)`.

3. **Create `ingestion_runs` entry at start**:
   - `dataset_name = config.datasetName` (e.g. `"beetree-ensemble-v1"` or `"beetree-ensemble-v1-{label}"`).
   - `base_url = 'local:beetreeARC'` or absolute path to submission file.
   - `source = config.source`.
   - `status = 'in_progress'`.
   - `started_at = NOW()`.

4. **For each `puzzleId` in the BeeTree submission**:
   - Confirm it exists in `PuzzleLoader` (otherwise count as `notFoundError` and continue).
   - Build `attempt1Grids`, `attempt2Grids` arrays.
   - For each attempt (1 and 2):

     a. **Check for duplicates**:
        - Query: `repositoryService.explanations.getExplanationsForPuzzle(puzzleId)`
        - Filter by `modelName` (e.g., `beetree-ensemble-v1-attempt1`).
        - Behavior:
          - `--skip-duplicates` (default): If exists, mark `skipped++` and continue to next attempt.
          - `--force-overwrite`: Delete existing row(s), proceed with insertion.
          - `--no-skip-duplicates`: Count as error and respect `--stop-on-error`.

     b. **Extract explanation from logs** (see §5.4):
        - Read `step_finish.json` files for all tests.
        - Locate winning `run_id` for this attempt.
        - Read step logs to find the full LLM response.
        - Parse to extract `pattern_description` and `solving_strategy`.
        - Store full response as `reasoning_log`.
        - If extraction fails, count as `validationError` and skip this row (do NOT insert placeholder).

     c. **Aggregate costs and tokens** (see §5.5):
        - Identify all contributing `run_id`s for this attempt across all tests.
        - Read step logs to collect token/cost data.
        - Sum to get `input_tokens`, `output_tokens`, `total_tokens`, `estimated_cost`.

     d. **Build ensemble metadata** (see §5.6):
        - Construct `provider_raw_response` JSONB with candidates_object, picked_solution, and per-model stats.

     e. **Validate predictions** (see §5.3):
        - Call `validateSolverResponse` / `validateSolverResponseMulti`.
        - Get correctness flags and accuracy metrics.

     f. **Build `enrichedData` object**:
        - Map all fields per §5.7.
        - Include extracted explanations, aggregated costs, predictions, metadata.

     g. **Save to database**:
        - Wrap in transaction:
          - If `--force-overwrite`: Delete existing row first.
          - Call `repositoryService.explanations.saveExplanation(enrichedData)`.
        - On success: `successful++`
        - On error: `failed++`, log error, respect `--stop-on-error`.

5. **Update `ingestion_runs` entry at end**:
   - Set:
     - `total_puzzles`
     - `successful`
     - `failed`
     - `skipped`
     - `validationErrors` (new counter)
     - `notFoundErrors` (new counter)
     - `accuracy_percent` (calculate from successful rows)
     - `status = 'completed'` or `'failed'`
     - `completed_at = NOW()`

6. **Result**:
   - BeeTree appears in Accuracy dashboards as:
     - Models: `"beetree-ensemble-v1-attempt1"`, `"beetree-ensemble-v1-attempt2"`.
     - Fully comparable to HF imports and any other solver.
     - **With real explanations** specific to each puzzle.
     - **With cost and token data** for analytics.
     - **With ensemble metadata** for future analysis.

### Phase 2 – Future enhancements (optional)

- **Per-step cost breakdown**: Store granular per-step timing and cost in a separate JSON field or table.
- **Confidence scoring**: Derive ensemble confidence metric from vote agreement and store separately (not in `confidence` field).
- **Alternative explanation strategies**: If primary model's explanation is poor, try secondary contributing models.
- **Batch parallel processing**: Process multiple puzzles in parallel for faster ingestion.

---

## 7. Key design decisions (REVISED)

### 7.1 Treat BeeTree as a meta-solver with clear naming

- **Model naming**: `beetree-ensemble-vX-attemptY` (not `beetree-solver`).
  - Clearly conveys this is an ensemble/meta-solver.
  - Distinguishes from individual base models (GPT-5.1, Claude, etc.).
  - Supports versioning and labeling (`beetree-ensemble-v1-prod-attempt1`).

### 7.2 Real explanations, not placeholders

- **Hard requirement**: Extract actual LLM explanation text from winning model responses.
- Do NOT use generic placeholder text.
- If extraction fails, treat as validation error and do NOT insert row.
- This respects the NOT NULL constraint's intent and provides actual value.

### 7.3 Preserve ensemble metadata in Phase 1

- Store full voting/candidate data in `provider_raw_response`.
- Enables future analysis without re-processing logs.
- Captures which models contributed, vote counts, agreement rates.

### 7.4 Include cost/token tracking in Phase 1

- BeeTree is expensive (runs many frontier models in parallel).
- Cost data is critical for evaluating cost-effectiveness.
- All data is available in logs, so aggregating it in Phase 1 is straightforward.
- Populates standard `input_tokens`, `output_tokens`, `total_tokens`, `estimated_cost` fields.

### 7.5 Explicit duplicate detection and versioning

- **Duplicate key**: `puzzle_id + model_name`.
- Default behavior: `--skip-duplicates` (matches HF ingestion).
- When BeeTree configuration changes materially, change the model label:
  - `beetree-ensemble-v1` → `beetree-ensemble-v2`
  - Or use `--label` flag: `beetree-ensemble-v1-config-a` vs `beetree-ensemble-v1-config-b`
- This naturally creates separate model entries without clobbering old data.

### 7.6 Robust error handling and resumability

- **Per-puzzle processing unit**: Each puzzle is independent.
- **Transaction per puzzle**: Delete + insert wrapped in single transaction (atomic).
- **Error categories**:
  - `successful`: Puzzle processed and saved.
  - `failed`: DB or processing error (logged with details).
  - `skipped`: Duplicate found and `--skip-duplicates` active.
  - `validationErrors`: Malformed grids, missing logs, failed explanation extraction.
  - `notFoundErrors`: Puzzle not in local dataset.
- **Resume capability**: `--resume-from <puzzleId>` or `--only-missing`.
- **Progress tracking**: Log progress every N puzzles, update `ingestion_runs` table.

### 7.7 Validate everything upfront

- **Submission file structure**: Validate JSON schema before processing.
- **Grid validation**: Reuse existing `validateGrid` logic.
- **Log availability**: Check that required step logs exist before processing puzzle.
- Clear, actionable error messages for all validation failures.

### 7.8 Align with existing architecture

- **AccuracyRepository / MetricsRepository**: Work without changes (standard prediction fields populated).
- **CostRepository**: Works without changes (standard token/cost fields populated).
- **Trustworthiness**: Do NOT synthesize confidence from vote counts; leave `confidence` and `trustworthiness_score` as NULL.
- **Ensemble-specific analytics**: Build on top of `provider_raw_response` metadata in future if desired.

---

## 8. Summary of requirements

Phase 1 ingestion **MUST**:

✅ Extract real explanations from winning model responses (NOT placeholders)
✅ Validate submission file structure before processing
✅ Aggregate and store token counts and costs from logs
✅ Preserve ensemble metadata in `provider_raw_response`
✅ Use meta-solver naming: `beetree-ensemble-vX-attemptY`
✅ Implement clear duplicate detection on `puzzle_id + model_name`
✅ Support `--skip-duplicates`, `--force-overwrite`, `--no-skip-duplicates`
✅ Provide robust error handling with categories and transaction safety
✅ Support resume capability (`--resume-from`, `--only-missing`)
✅ Track ingestion run in `ingestion_runs` table
✅ Respect `--stop-on-error` flag

Phase 1 ingestion **MUST NOT**:

❌ Use generic placeholder text for `pattern_description` or `solving_strategy`
❌ Defer cost/token tracking to Phase 2
❌ Discard ensemble voting metadata
❌ Synthesize fake confidence scores from vote counts
❌ Process puzzles without validating submission structure first

---

## 9. Next steps

To implement this plan:

1. Create `server/scripts/ingest-beetree-results.ts` following the exact patterns from [ingest-huggingface-dataset.ts](server/scripts/ingest-huggingface-dataset.ts).
2. Add BeeTree-specific log parsing utilities:
   - `beetreeLogParser.ts`: Read step logs, extract responses, aggregate costs.
   - `beetreeExplanationExtractor.ts`: Parse LLM responses to extract pattern/strategy text.
3. Add submission file validation utilities:
   - `beetreeSubmissionValidator.ts`: Validate JSON structure and grid formats.
4. Update types in `shared/` if needed for BeeTree-specific metadata structures.
5. Add unit tests for:
   - Log parsing and explanation extraction.
   - Cost aggregation logic.
   - Duplicate detection and transaction handling.
6. Add integration tests:
   - Dry-run ingestion with sample BeeTree submission + logs.
   - Verify database state after ingestion.
   - Test error scenarios (missing logs, malformed grids, etc.).
7. Document CLI usage in README or separate docs.
8. Run first production ingestion with `--dry-run` to validate, then execute for real.

---

**Document Status**: ✅ Ready for implementation
**Reviewed**: 2025-01-12
**Approved for**: Phase 1 implementation with all critical requirements addressed
