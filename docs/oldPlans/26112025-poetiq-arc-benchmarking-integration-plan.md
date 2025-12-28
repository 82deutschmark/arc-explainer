# Poetiq Solver - 10 Puzzle Test Run Plan
**Author**: Claude Code (Sonnet 4.5)
**Date**: 2025-11-26
**Status**: Planning Phase

## Objective
Run the Poetiq solver against 10 puzzle IDs using the existing project infrastructure, ensuring results are saved to the project database. Previous submission files from November 25th runs are lost, so we're starting fresh.

## Research Questions
1. Where is the new Poetiq endpoint located?
2. Where is the Arc AGI benchmarking sub-module?
3. What format are the benchmarking results in?
4. How many puzzles were solved and by which solver?
5. What is the current database schema for puzzle attempts/results?
6. Are there existing import/migration scripts we should follow?

## Research Findings

### 1. Poetiq Endpoint Location
- **Controller**: `server/controllers/poetiqController.ts`
- **Service**: `server/services/poetiq/poetiqService.ts`
- **Python Wrapper**: `server/python/poetiq_wrapper.py`
- **Endpoints**:
  - `POST /api/poetiq/solve/:taskId` - Solve single puzzle
  - `POST /api/poetiq/batch` - Batch solve dataset
  - `GET /api/poetiq/status/:sessionId` - Get progress
  - `GET /api/poetiq/models` - List supported models

### 2. Arc AGI Benchmarking Sub-modules
- **poetiq-solver**: Git submodule at `poetiq-solver/` (github.com/82deutschmark/poetiq-arc-agi-solver)
- **arc-agi-benchmarking**: Git submodule at `arc-agi-benchmarking/` (github.com/82deutschmark/arc-agi-benchmarking)
- **Documentation**: Found in `poetiq-solver/docs/`:
  - `puzzle_status_2025-11-25.md` - Comprehensive status report
  - `smoke_test_20_puzzles_2025-11-25.md` - Run 2 audit (10 puzzles completed)
  - `test_run_extrapolation_2025-11-25.md` - Run 1 audit (10 puzzles)
  - `audit_report_2025-11-25.md` - Run 1 critical assessment

### 3. Benchmarking Results Format
**26 puzzles tested total (not 16 as initially stated):**

**PASS (9 puzzles - fully solved):**
- 136b0064, 16de56c4, 1818057f (Run 1: Gemini 3 Pro Preview)
- d8e07eb2, db0c5428, e3721c99, e376de54, e8686506, f931b4a8 (Run 2: Gemini 3 Pro Preview)

**PARTIAL (2 puzzles):**
- 1ae2feb7 (score: 0.67 - 2 of 3 test cases)
- dd6b8c4b (score: 0.50 - 1 of 2 test cases)

**FAIL (14 puzzles):**
- 0934a4d8, 135a2760, 13e47133, 142ca369, 16b78196, 195c6913 (Run 1)
- db695cfb, dbff022c, dfadab01, e12f9a14, edb79dae, eee78d87, faa9f03d, fc7cae8d (Run 2)

**ERROR (1 puzzle):**
- de809cff (Windows temp file permission error)

**Aggregate Stats:**
- Total score: 10.17 / 25 valid attempts
- Accuracy: 40.7%
- Model: gemini/gemini-3-pro-preview (via LiteLLM)

### 4. Database Schema
- **Table**: `explanations` (see `server/repositories/database/DatabaseSchema.ts`)
- **Key fields for Poetiq results**:
  - puzzle_id, model_name, is_prediction_correct
  - multi_test_results, multi_test_all_correct, multi_test_average_accuracy
  - predicted_output_grid, multi_test_prediction_grids
  - provider_raw_response (JSONB) - stores Poetiq-specific data (iterations, code, config)
- **Existing service**: `explanationService.saveExplanation()` handles persistence
- **Transformation**: `poetiqService.transformToExplanationData()` converts Poetiq format

### 5. Missing Submission Files
**CRITICAL ISSUE**: The actual result data is missing!
- `poetiq-solver/output/` directory does NOT exist
- `analyze_results.py` references:
  - `output/submission_2025-11-25_11-31-40.json` (Run 1)
  - `output/submission_2025-11-25_15-01-00.json` (Run 2)
- These JSON files contain the actual prediction grids needed for database import
- The audit reports only document high-level statistics, not the raw predictions

**Question for User**: Where are the actual submission JSON files with prediction grids?

## Implementation Plan

### Approach: Use Existing Poetiq API Infrastructure
The project already has a complete Poetiq integration that saves to the database:

**Option 1: Batch API Endpoint** (Recommended)
- Use `POST /api/poetiq/batch` endpoint
- Pass a subset of 10 puzzle IDs from the untested list
- Results automatically save to database via `explanationService.saveExplanation()`
- WebSocket progress tracking included

**Option 2: Individual API Calls**
- Call `POST /api/poetiq/solve/:taskId` for each of 10 puzzles
- More granular control but requires 10 separate requests

**Option 3: Direct Python Execution** (Not Recommended)
- Run `poetiq-solver/main.py` directly
- Would require manual database import afterward
- Bypasses existing project infrastructure

### Selected Approach: Batch API Endpoint
This leverages existing, tested code and ensures database persistence.

### Puzzle Selection Strategy
From the 94 untested puzzles documented in `puzzle_status_2025-11-25.md`, select 10 puzzles:

**Strategy Options:**
1. **First 10** - Quick, systematic: `['20270e3b', '20a9e565', '21897d95', '221dfab4', '247ef758', '269e22fb', '271d71e2', '28a6681f', '291dc1e1', '2b83f449']`
2. **Random 10** - Better statistical validity
3. **Specific difficulty range** - If puzzle metadata exists

**Recommendation**: Use first 10 for simplicity and reproducibility.

### Model Selection
Based on `poetiqController.ts` supported models:
- **Recommended**: `openrouter/google/gemini-3-pro-preview` (avoids direct API rate limits)
- **Fallback**: `gemini/gemini-3-pro-preview` (direct API, may hit quota)

### Configuration Parameters
- **maxIterations**: 10 (default, matches previous runs)
- **numExperts**: 1 (default)
- **temperature**: 1.0 (default)
- **dataset**: Create custom list or use API directly

## Implementation Steps

### Step 1: Review Current Poetiq Integration
- [x] Review `server/controllers/poetiqController.ts`
- [x] Review `server/services/poetiq/poetiqService.ts`
- [ ] Review `server/python/poetiq_wrapper.py`
- [ ] Verify database schema supports all Poetiq result fields

### Step 2: Prepare Execution Environment
- [ ] Verify Poetiq solver submodule is up to date: `git submodule update --remote poetiq-solver`
- [ ] Check Python dependencies in poetiq-solver: `pip install -r poetiq-solver/requirements.txt`
- [ ] Verify API keys configured (GEMINI_API_KEY or OPENROUTER_API_KEY)
- [ ] Ensure dev server is running: `npm run dev`

### Step 3: Execute 10 Puzzle Batch
- [ ] Select 10 puzzle IDs from untested list
- [ ] Call batch API endpoint via curl/Postman/Thunder Client:
  ```bash
  POST http://localhost:5000/api/poetiq/batch
  {
    "puzzleIds": ["20270e3b", "20a9e565", "21897d95", "221dfab4", "247ef758", "269e22fb", "271d71e2", "28a6681f", "291dc1e1", "2b83f449"],
    "model": "openrouter/google/gemini-3-pro-preview",
    "maxIterations": 10
  }
  ```
- [ ] Monitor WebSocket progress via sessionId
- [ ] Wait for completion (~2 hours based on previous runs)

### Step 4: Verify Database Storage
- [ ] Query `explanations` table for the 10 puzzle IDs
- [ ] Verify fields populated: `is_prediction_correct`, `provider_raw_response`, etc.
- [ ] Check Poetiq-specific data in `provider_raw_response` JSONB field

### Step 5: Analyze Results
- [ ] Count: PASS / PARTIAL / FAIL / ERROR
- [ ] Calculate accuracy percentage
- [ ] Compare to previous 26-puzzle results (40.7% accuracy)
- [ ] Document findings in CHANGELOG.md

## Trade-offs and Considerations

### Why Not Import Lost Files?
- Original submission JSONs are gone
- Audit reports only have high-level stats, not prediction grids
- Re-running ensures we have complete, verifiable data in database

### Why Use Batch API vs Direct Python?
- **Batch API Pros**:
  - ✅ Automatic database persistence
  - ✅ WebSocket progress tracking
  - ✅ Tested, production code path
  - ✅ No manual import needed
- **Direct Python Pros**:
  - ✅ Slightly faster (no HTTP overhead)
  - ❌ Requires manual database import script
  - ❌ Bypasses existing infrastructure

### API Rate Limit Risk
- Previous runs hit Gemini quota exhaustion
- **Mitigation**: Use OpenRouter proxy (`openrouter/google/gemini-3-pro-preview`)
- **Fallback**: If OpenRouter fails, try direct Gemini with lower concurrency

### Time Estimate
- Based on previous runs: ~722 seconds average per puzzle
- 10 puzzles × 12 min = ~2 hours
- Add buffer for API delays: **3 hours total**

## Next Steps After Plan Approval
1. Check `poetiqController.ts` batch endpoint implementation
2. Review `poetiqService.ts` transformation logic
3. Verify Python wrapper handles progress events correctly
4. Prepare API request payload
5. Execute and monitor run
