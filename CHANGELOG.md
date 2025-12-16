# New entires at the top, use proper SemVer!

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
