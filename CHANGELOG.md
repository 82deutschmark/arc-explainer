# New entires at the top, use proper SemVer!

### Version 6.4.1  Dec 16, 2025

- **Build fix: Missing closing brace in adminController.ts** (Author: Cascade)
  - Fixed syntax error at line 746 where `syncOpenRouterConfig` function was missing closing brace.
  - **Files Modified**: `server/controllers/adminController.ts`

### Version 6.4.0  Dec 16, 2025

- **ARC-AGI multi-test-pair scoring: harness-aligned accuracy + clearer UI metrics** (Author: Cascade)
  - **Critical scoring fix**: dataset score is the average of per-puzzle scores (each puzzle weighted equally), not a pair-weighted ratio.
  - **Backend**:
    - Added public `GET /api/accuracy/harness` endpoint returning harness-aligned accuracy for `{baseModelName}-attempt1/-attempt2`.
    - Added `AccuracyRepository.getHarnessAlignedAccuracyStats()` returning both harness score and pair-weighted transparency metrics.
    - Added pure scoring utilities `server/utils/harnessScoring.ts` to keep math testable and DRY.
    - Extended `MetricsRepository.computeAttemptUnionStats()` to return `puzzlesCounted`, `puzzlesFullySolved`, and `puzzlesFullySolvedIds`.
  - **Database**:
    - Added `num_test_pairs` column (plus index + backfill) to support multi-test-pair scoring and aggregation.
    - Updated `ExplanationRepository.saveExplanation()` to persist `num_test_pairs` on insert.
  - **Frontend**:
    - Removed client-side attempt-union scoring fallback (cannot compute harness score without per-pair data).
    - All three metrics now displayed side-by-side: **Harness Score** (official), **Puzzles Solved** (fully correct), **Test Pairs** (pair-weighted).
    - Three-metric grid layout on `/scoring`, `ModelComparisonPage`, and `ModelComparisonDialog`.
    - Added `computePuzzlePassFailRate()` helper in `modelComparison.ts` for puzzle-level pass/fail rate.
  - **Documentation Audit**:
    - Updated `AccuracyRepository` header to clarify two accuracy concepts (puzzle-level vs harness-aligned).
    - Updated `AccuracyLeaderboard` and `Leaderboards` descriptions to clarify puzzle-level accuracy is NOT harness score.
  - **Tests**:
    - Added unit tests demonstrating harness score differs from pair-weighted accuracy when puzzles have different numbers of test pairs.
    - Added controller test for `GET /api/accuracy/harness` input validation + delegation.
  - **Files Created**: `server/controllers/accuracyController.ts`, `server/utils/harnessScoring.ts`, `tests/harnessScoring.test.ts`, `tests/accuracyHarnessEndpoint.test.ts`
  - **Files Modified**: `server/routes.ts`, `server/repositories/AccuracyRepository.ts`, `server/repositories/MetricsRepository.ts`, `server/repositories/database/DatabaseSchema.ts`, `server/repositories/ExplanationRepository.ts`, `client/src/pages/HuggingFaceUnionAccuracy.tsx`, `client/src/pages/ModelComparisonPage.tsx`, `client/src/pages/AnalyticsOverview.tsx`, `client/src/pages/Leaderboards.tsx`, `client/src/components/analytics/ModelComparisonDialog.tsx`, `client/src/components/overview/leaderboards/AccuracyLeaderboard.tsx`, `client/src/utils/modelComparison.ts`, `CHANGELOG.md`

### Version 6.3.2  Dec 16, 2025 (PENDING TESTING)

- **SnakeBench: prevent local replays from blocking pulls** (Author: Cascade)
  - Local SnakeBench runs now write replay JSONs to `external/SnakeBench/backend/completed_games_local/` by default (configurable via `SNAKEBENCH_COMPLETED_GAMES_DIR`).
  - This prevents untracked local replay files from colliding with tracked files under `external/SnakeBench/backend/completed_games/` and breaking `git pull`.
  - Local video tooling now defaults to `external/SnakeBench/backend/completed_games_videos_local/` (also aligned with `SNAKEBENCH_COMPLETED_GAMES_DIR`).
  - **Files Modified**: `external/SnakeBench/backend/main.py`, `external/SnakeBench/backend/app.py`, `external/SnakeBench/backend/services/video_generator.py`, `external/SnakeBench/backend/cli/analyze_local_games.py`, `external/SnakeBench/backend/cli/generate_video.py`, `external/SnakeBench/backend/cli/generate_videos_local.py`, `external/SnakeBench/backend/cli/backfill_videos.py`, `external/SnakeBench/backend/tests/test_main.py`, `external/SnakeBench/backend/generate_videos.sh`, `external/SnakeBench/.gitignore`, `CHANGELOG.md`

### Version 6.3.1  Dec 16, 2025 (PENDING TESTING)

- **Johan_Land community solver visibility + cost metrics on all comparison pages** (Author: Claude Code using Sonnet 4.5)
  - **Johan_Land Integration**: Johan_Land community solver results now visible across all model comparison pages (/scoring, /analytics, /model-comparison)
  - **Cost Metrics Display**: Added comprehensive cost and performance metrics to /scoring page showing total cost, cost per puzzle, cost per correct answer, and average processing time
  - **Model Origin Detection**: Created centralized `modelOriginDetection.ts` utility to distinguish between HuggingFace official, community solvers, and ARC Explainer platform results
  - **Origin Badges**: Added visual badges across all pages to clearly identify data source (HF Official, Community, Platform)
  - **Page Scope Update**: Renamed /scoring page from "Official Scoring" to "Multi-Attempt Solver Results" to reflect inclusion of community-submitted evaluations
  - **DRY Compliance**: Eliminated duplicate origin detection logic across pages by centralizing in shared utility
  - **Files Created**: `client/src/utils/modelOriginDetection.ts`
  - **Files Modified**: `client/src/pages/HuggingFaceUnionAccuracy.tsx` (cost metrics, title, badges), `client/src/pages/AnalyticsOverview.tsx` (utility integration), `client/src/pages/ModelComparisonPage.tsx` (origin badges), `CHANGELOG.md`

### Version 6.2.2  Dec 16, 2025 (PENDING TESTING)

- **Worm Arena: align replay score text with player palettes** (Author: Codex (GPT-5))
  - Switches the control bar score labels from warning colors to the existing green/blue worm palette so the UI matches the reasoning columns.
  - Keeps the visual language consistent during replay streaming by using the palette tokens already defined in `client/src/index.css`.
  - **Files Modified**: `client/src/components/WormArenaControlBar.tsx`, `CHANGELOG.md`

### Version 6.2.1  Dec 16, 2025 (PENDING TESTING)

- **Worm Arena: Greatest Hits #1 marathon + reliable replay links + show more entries** (Author: Cascade)
  - Promoted the marathon replay `97c1dad4-3905-4d29-a781-f7a9691f063d` to the top of the curated Worm Arena Hall of Fame.
  - Greatest-hits endpoint now scans the curated list until it finds the requested number of playable replays (so missing early replays no longer shrink the list).
  - Greatest Hits UI now uses client-side navigation and normalizes `snake_game_*.json` style IDs before linking to `/worm-arena?matchId=...`.
  - **Files Modified**: `server/services/snakeBenchHallOfFame.ts`, `server/services/snakeBenchService.ts`, `client/src/components/WormArenaGreatestHits.tsx`, `CHANGELOG.md`

### Version 6.3.0  Dec 16, 2025 (COMPLETED)

- **Johan_Land_Solver_V6 scoring: pair-aware ingestion + harness-aligned union accuracy** (Author: Cascade, Validation & Execution: Claude Code)
  - **Critical Fix**: Resolved fundamental data structure misunderstanding. Submission JSON is array of test pairs (not single puzzle with 2 attempts).
  - **Ingestion Logic**: Iterates through submission array; each element = one test pair with attempt_1 and attempt_2 solving the same pair_index.
  - **Per-Pair Validation**: Each attempt validated against `task.test[pair_index].output` (ground truth), not against solver's own `correct` flag.
  - **Union Scoring**: If ANY attempt solves a pair, that pair counts as solved (matches official ARC-AGI benchmarking harness).
  - **Backend Accuracy**: Changed from global averaging to per-puzzle averaging: `(sum of per-puzzle fractions) / num_puzzles * 100`.
  - **Validation Result**: Harness-style score 71.29% (84.83/119 tasks) matches DB/UI union score 71.29% (117/166 test pairs) ✓
  - **Re-ingestion**: All 238 entries (119 puzzles × 2 attempts) successfully re-ingested with corrected pair-aware logic.
  - **Files Modified**: `server/scripts/ingest-johanland-results.ts`, `server/repositories/MetricsRepository.ts`, `server/types/johanland.ts`, `CHANGELOG.md`

### Version 6.2.0  Dec 16, 2025 (PENDING TESTING)

- **Worm Arena: align UI coordinate system with engine prompt (y increases upward)** (Author: Cascade)
  - Fixed Worm Arena board rendering to use the SnakeBench engine coordinate system (bottom-left origin).
  - Fixed snake head arrow orientation so vertical movement is no longer inverted.
  - ASCII replay preview now matches the engine coordinate orientation.
  - **Files Modified**: `client/src/components/WormArenaGameBoard.tsx`, `client/src/components/WormArenaGameBoardSVG.tsx`, `client/src/pages/WormArena.tsx`, `CHANGELOG.md`

### Version 6.1.63  Dec 16, 2025 (PENDING TESTING)

- **Johan_Land scoring: harness-aligned correctness + union aggregation** (Author: Cascade)
  - Ingestion now recomputes correctness against ground truth per test pair (treats `attempt.correct` as untrusted).
  - Ingestion stores one row per puzzle per attempt using `multi_test_*` fields so multi-pair puzzles are preserved.
  - Attempt union accuracy now matches ARC harness aggregation (average of per-task fractions).
  - **Files Modified**: `server/scripts/ingest-johanland-results.ts`, `server/repositories/MetricsRepository.ts`, `server/types/johanland.ts`, `CHANGELOG.md`

### Version 6.1.62  Dec 15, 2025 (PENDING TESTING)

- **Worm Arena: auto-publish SnakeBench replays to GitHub + persist replay_path** (Author: Cascade)
  - SnakeBench ingest now uploads completed replay JSONs to GitHub (main branch) so Railway can fetch them reliably.
  - After publish, the DB `public.games.replay_path` is updated to the GitHub raw URL.
  - GitHub raw replay fetch 404s are now logged as warnings (expected for older/unpublished games).
  - **Files Modified**: `server/services/snakeBenchIngestQueue.ts`, `server/services/snakeBenchGitHubPublisher.ts` (new), `server/repositories/SnakeBenchRepository.ts`, `server/services/snakeBenchService.ts`, `CHANGELOG.md`

- **Worm Arena: enable Nemotron 3 Nano 30B and add tournament script** (Author: Codex GPT-5)
  - Added `nvidia/nemotron-3-nano-30b-a3b:free` to the server-side OpenRouter allowlist so SnakeBench can actually run matches with it.
  - Updated the local OpenRouter catalog snapshot to include the model metadata (context, pricing, supported parameters).
  - Added a PowerShell tournament script that queues matches against the current top TrueSkill leaderboard models.
  - **Files Modified**: `server/config/openrouterModels.ts`, `server/config/openrouter-catalog.json`, `scripts/worm-arena-tournaments/nemotron3-nano-30b-vs-top-leaderboard.ps1`, `CHANGELOG.md`

### Version 6.1.61  Dec 15, 2025 (PENDING TESTING)

- **Worm Arena: show DB-imported OpenRouter models automatically** (Author: Codex GPT-5)
  - Models returned by `GET /api/models` now include active OpenRouter slugs imported via the Admin UI (SnakeBench DB), so Worm Arena dropdowns reflect imports without editing config files.
  - Admin OpenRouter page copy now clarifies that "Import" updates the DB roster used by Worm Arena, while "Sync to Config" is optional metadata curation.
  - **Files Modified**: `server/routes/models.ts`, `client/src/pages/AdminOpenRouter.tsx`, `CHANGELOG.md`

### Version 6.1.60  Dec 15, 2025 (PENDING TESTING)

- **/scoring page copy + scoring alignment with ARC harness (pair-based)** (Author: Codex GPT-5)
  - Backend: attempt union stats now compute per test pair (any attempt correct) and return total test pairs for accurate percentages.
  - Frontend: /scoring page now surfaces backend union stats, shows pair-based math, and updates explanatory text to match the official ARC harness.
  - Analytics UI: model comparison dialog/page now display test-pair counts and percentages.
  - Plan added in `docs/2025-12-15-scoring-fix-plan.md` to track remaining scoring follow-through.
  - **Files Modified**: `server/repositories/MetricsRepository.ts`, `client/src/pages/HuggingFaceUnionAccuracy.tsx`, `client/src/components/analytics/ModelComparisonDialog.tsx`, `client/src/pages/ModelComparisonPage.tsx`, `client/src/pages/AnalyticsOverview.tsx`, `docs/2025-12-15-scoring-fix-plan.md`, `CHANGELOG.md`

### Version 6.1.59  Dec 15, 2025 (PENDING TESTING)

- **Johan_Land ingestion: correct multi-test validation + schema-aligned storage** (Author: Cascade)
  - Fixed Johan_Land ingestion to validate puzzles with multiple test cases using `validateSolverResponseMulti` and store:
    - `multiplePredictedOutputs`
    - `multiTestPredictionGrids`
    - `multiTestResults`
    - `multiTestAllCorrect`
    - `multiTestAverageAccuracy`
  - Removed incorrect usage of trustworthiness/accuracy fields during ingestion.
  - Aligned Johan_Land ingestion TypeScript types to match repository `ExplanationData` expectations.
  - **Files Modified**: `server/scripts/ingest-johanland-results.ts`, `server/types/johanland.ts`, `CHANGELOG.md`

### Version 6.1.58  Dec 15, 2025 (COMPLETED)

- **Johan_Land_Solver_V6 evaluation results ingestion** (Author: Claude Code using Haiku 4.5)
  - Added comprehensive ingestion pipeline for 119 ARC-AGI evaluation results from Johan_Land_Solver_V6 solver.
  - Ingested 238 explanation entries (119 puzzles × 2 attempts each) with detailed judge feedback, reasoning summaries, token usage, and cost data.
  - Rich reasoning extraction: parses structured judge feedback sections (rule summary, audit summary, consistency) and example reasoning into database fields.
  - Reuses HuggingFace ingestion patterns for consistency and maintainability (~80% pattern reuse).
  - Comprehensive validation: grid validation, metadata structure validation, timestamp validation, token/cost field validation.
  - Performance: 84.83% success rate (101/119 puzzles correct on first attempt), total cost $2,841.49, comprehensive token tracking.
  - **Files Created**:
    - `server/types/johanland.ts` (200 lines) — Type definitions for submission format
    - `server/utils/johanlandValidator.ts` (200 lines) — Grid and submission validation utilities
    - `server/utils/johanlandExplanationExtractor.ts` (250 lines) — Reasoning extraction and text parsing
    - `server/scripts/ingest-johanland-results.ts` (700 lines) — Main ingestion script with CLI
  - **Files Modified**: `package.json` (added `ingest-johanland` npm script), `CHANGELOG.md`
  - **Prompt Template**: New entry "external-johan-land" for tracking ingestion source
  - **Database Entries**: All 238 entries successfully stored with complete metadata preservation in `provider_raw_response`

### Version 6.1.57  Dec 15, 2025 (PENDING TESTING)

- **Worm Arena Greatest Hits: show all 20 in a scroll box** (Author: Cascade)
  - Greatest Hits now renders the full curated set (20) inside a fixed-height scroll area so the page stays compact.
  - **Files Modified**: `client/src/components/WormArenaGreatestHits.tsx`, `CHANGELOG.md`

### Version 6.1.56  Dec 15, 2025 (PENDING TESTING)

- **Worm Arena Live: simplified setup UI with direct model selection** (Author: Sonnet 4.5)
  - Replaced overwhelming 15-card curated matchup selector with two clean alphabetically-sorted dropdowns for Model A and Model B.
  - Created `useWormArenaSetup` hook to encapsulate setup state (modelA, modelB, board settings, BYO API key), reducing page component from 19 state variables to 1 hook call.
  - Reordered controls layout: model dropdowns and Start button at top (prominent and immediately visible), advanced settings and BYO key collapsed by default at bottom.
  - Added smooth fade transitions between setup → live → completed states for polished UX.
  - Deleted `WormArenaMatchupSelector` component (no longer needed).
  - **Files Modified**: `client/src/hooks/useWormArenaSetup.ts` (new), `client/src/components/WormArenaRunControls.tsx`, `client/src/pages/WormArenaLive.tsx`, `client/src/components/WormArenaMatchupSelector.tsx` (deleted), `CHANGELOG.md`
