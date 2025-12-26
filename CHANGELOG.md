# Author: Codex (GPT-5)
# Date: 2025-12-25
# PURPOSE: Changelog for ARC Explainer - tracks all changes with semantic versioning.
# SRP/DRY check: Pass - entries document changes without altering historical records.
# New entries at the top, use proper SemVer!

### Version 6.10.12  Dec 25, 2025

- **Fix: GPT-5/o-series models must route directly to OpenAI in Worm Arena** (Author: Claude Sonnet 4)
  - **Purpose**: Fix "OpenRouter response missing output field" error for GPT-5 and o-series models.
  - **Root Cause**: OpenRouter's Responses API proxy returns empty `output=[]` for GPT-5/o-series models. These models require the Responses API which OpenRouter does not properly proxy.
  - **Behavior**: Added `_requires_responses_api()` helper to detect GPT-5/o-series models. Factory now routes these models directly to OpenAI regardless of explicit `provider: openrouter` config. Raises clear error if OPENAI_API_KEY is missing.
  - **Mixed Matchups**: GPT-5.1-Codex-Mini vs Minimax 2.1 now works correctly - each player gets appropriate provider (OpenAI direct vs OpenRouter).
  - **Files Modified**:
    - `external/SnakeBench/backend/llm_providers.py` - Added routing fix and helper function

### Version 6.10.11  Dec 25, 2025

- **Fix: Worm Arena OpenRouter transforms routing** (Author: Codex (GPT-5))
  - **Purpose**: Stop OpenRouter-only `transforms` from breaking OpenAI SDK calls while preserving Worm Arena defaults.
  - **Behavior**: Routes OpenRouter `transforms` via `extra_body`, strips them for OpenAI direct, and documents the Worm Arena integration note.
  - **Files Modified**:
    - `external/SnakeBench/backend/llm_providers.py`
    - `external/SnakeBench/README.md`
    - `external/SnakeBench/CHANGELOG.md`

### Version 6.10.10  Dec 24, 2025

- **UI: Improve grid size label readability on analysis cards** (Author: Cascade)
  - **Purpose**: Keep grid dimension badges and titles legible against warm gradients and dark shells.
  - **Behavior**: Forced black text on puzzle grid titles and size badges with a white badge background and dark border for reliable contrast.
  - **Files Modified**:
    - `client/src/components/puzzle/PuzzleGrid.tsx`

### Version 6.10.9  Dec 24, 2025

- **Ops: OpenRouter tournament script for new Seed/GLM/Minimax models** (Author: Cascade)
  - **Purpose**: Queue WormArena matches round-robin among new models and against baselines with optional async and completion logging.
  - **Behavior**: Runs both-direction pairings for seed 1.6 variants, minimax m2.1, glm 4.7, and “oops” slug versus each other and baselines (GPT-5.1 Codex Mini, GPT-5 Mini, GPT-5 Nano, Grok 4.1 Fast, Devstral 2512, DeepSeek v3.2). Adds async job tracking and completion summary.
  - **Files Modified**:
    - `scripts/worm-arena-tournaments/run-paid-devstral-matches.ps1`

### Version 6.10.7  Dec 24, 2025

- **Chore: Root cleanup for legacy scripts and media** (Author: Cascade)
  - **Purpose**: Reduce clutter by grouping Johan_Land verification scripts, archival docs, and media blobs into scoped folders.
  - **Work**:
    - Created `scripts/legacy-johan-land/README.md` and relocated all Johan_Land DB check `.mjs` utilities there.
    - Added `docs/archives/` and moved historical docs (AGENTS-OLD.md, oldCLAUDE.md) plus misc temp notes into purpose-built directories.
    - Introduced `media/reference/` and moved multi-GB MP3/MP4 recordings out of the repo root.
  - **Impact**: Root directory now surfaces only actively maintained assets; legacy tooling remains available under a documented folder.

### Version 6.10.6  Dec 24, 2025

- **UI: Dark theme analysis cards and larger Puzzle Analyst typography** (Author: Codex (GPT-5))
  - **Purpose**: Make expanded analysis cards blend into the dark Puzzle Analyst view and improve readability.
  - **Behavior**:
    - Added a dark theme option to `AnalysisResultCard` and applied it within Puzzle Analyst.
    - Added dark theme variants to analysis card subcomponents and feedback sections.
    - Increased header and row font sizes in Puzzle Analyst for easier scanning.
  - **Files Modified**:
    - `client/src/components/puzzle/AnalysisResultCard.tsx` - Theme wrapper and dark palette for the card shell.
    - `client/src/components/puzzle/AnalysisResultHeader.tsx` - Dark variants for badges and controls.
    - `client/src/components/puzzle/AnalysisResultContent.tsx` - Dark variants for reasoning, prompts, and alerts.
    - `client/src/components/puzzle/AnalysisResultActions.tsx` - Dark variants for feedback panel text.
    - `client/src/components/puzzle/AnalysisResultMetrics.tsx` - Dark variants for Saturn metrics panels.
    - `client/src/components/ExplanationFeedback.tsx` - Dark variants for feedback form styling.
    - `client/src/components/feedback/FeedbackViewer.tsx` - Dark variants for feedback list cards.
    - `client/src/components/puzzle/ExplanationGridRow.tsx` - Larger row typography and dark card theme usage.
    - `client/src/pages/PuzzleAnalyst.tsx` - Larger typography and updated column widths.
    - `client/src/types/puzzle.ts` - Added the AnalysisResultCard theme prop.
    - `docs/2025-12-24-puzzle-analyst-layout-plan.md` - Documented the dark card and typography update.

### Version 6.10.5  Dec 24, 2025

- **Layout: Remove sticky headers and render PNG thumbnails in Puzzle Analyst** (Author: Codex (GPT-5))
  - **Purpose**: Eliminate header overlap while making grid previews smaller, more zoomed out, and consistently rendered on black mats.
  - **Behavior**:
    - Removed sticky header layers so the column header and page header no longer overlay rows.
    - Generated client-side PNG thumbnails with extra padding for a zoomed-out grid preview.
    - Tightened row typography and spacing to keep metadata dense but readable.
  - **Files Modified**:
    - `client/src/pages/PuzzleAnalyst.tsx` - Removed sticky header logic and tightened column header spacing.
    - `client/src/components/puzzle/ExplanationGridRow.tsx` - Added canvas-based PNG thumbnails and reduced row padding.
    - `docs/2025-12-24-puzzle-analyst-layout-plan.md` - Recorded sticky header removal and PNG thumbnail approach.

### Version 6.10.4  Dec 24, 2025

- **Fix: Restore multi-test grid previews and expected outputs in Puzzle Analyst** (Author: Codex (GPT-5))
  - **Purpose**: Ensure multi-test explanations show stacked previews and expanded cards always include expected outputs with working mismatch toggles.
  - **Behavior**:
    - Added stacked grid previews that fall back to multi-test predictions when single grids are missing.
    - Passed puzzle test cases into `AnalysisResultCard` so expected outputs and mismatch diffs render.
    - Added the missing `multiTestPredictionGrids` type so stacked previews compile cleanly.
    - Tightened padding, clarified token/time labels, and reduced thumbnail size on black backgrounds.
    - Solidified the column header background and moved the grid container closer to the sticky header.
  - **Files Modified**:
    - `client/src/components/puzzle/ExplanationGridRow.tsx` - Stacked preview selection and test case wiring for expanded cards.
    - `client/src/pages/PuzzleAnalyst.tsx` - Supplies test cases from puzzle data to each row.
    - `docs/2025-12-24-puzzle-analyst-layout-plan.md` - Documented the multi-test grid handling update.

### Version 6.10.3  Dec 24, 2025

- **Layout: Refresh Puzzle Analyst grid density** (Author: Codex (GPT-5))
  - **Purpose**: Tighten the Puzzle Analyst presentation to match the high-density reference: align column widths, show cost/tokens/latency in a single header, and keep the details tucked behind expandable rows.
  - **Behavior**:
    - Added summary badges to the sticky header so analysts immediately see all/correct/incorrect counts.
    - Rebuilt `ExplanationGridRow` to show the grid thumbnail, model metadata, cost, latency, tokens, and Badges for status/reasoning without overlapping content.
    - Updated column headers and container styling so the grid lines match the row layout and the page keeps a compact, futuristic feel.
    - Adjusted sticky offsets so the Puzzle Analyst header respects the global AppHeader height and does not overlap row content.
  - **Files Modified**:
    - `docs/2025-12-24-puzzle-analyst-layout-plan.md` - Documented the layout refresh approach and file responsibilities before coding.
    - `client/src/components/puzzle/ExplanationGridRow.tsx` - Dense metadata header, status badges, tokens/cost formatting, and revised expand region.
    - `client/src/pages/PuzzleAnalyst.tsx` - Sticky header counts, new column widths, and heavier dark styling around the grid container.

### Version 6.10.2  Dec 21, 2025

- **Fix: Handle malformed boolean data in multiplePredictedOutputs field** (Author: Cascade)
  - **Root Cause**: Existing database records contained boolean values for `multiplePredictedOutputs` instead of expected array/object/null
  - **Symptom**: "[WARN][utilities] Unexpected type for multiplePredictedOutputs: boolean" warnings on puzzle explanations API calls
  - **Solution**: Enhanced `safeJsonParse()` in `CommonUtilities.ts` to gracefully handle boolean values by treating them as malformed data and returning null
  - **Impact**: Eliminates warnings and prevents potential crashes when reading legacy malformed data
  - **Backwards Compatible**: System continues functioning normally with existing bad data
  - **Files Modified**:
    - `server/utils/CommonUtilities.ts` - Added boolean handling in safeJsonParse function
  - **Prevention**: Future writes now properly sanitize boolean values in explanationService.ts

### Version 6.10.1  Dec 21, 2025

- **Fix: Complete navigation URL migration from /puzzle/ to /task/** (Author: Claude Code using Sonnet 4.5)
  - **Purpose**: Finalize URL migration to ensure all internal navigation uses new /task/ routes
  - **Files Updated**:
    - `client/src/components/puzzle/PuzzleTradingCard.tsx` - Trading card "View Details" link
    - `client/src/components/model-examiner/ExaminerActivity.tsx` - Activity log puzzle navigation
    - `client/src/components/poetiq/PuzzleProgressGrid.tsx` - Grid cell window.open navigation
    - `client/src/pages/BeetreeSolver.tsx` - Back button navigation
    - `client/src/pages/GroverSolver.tsx` - Back button navigation  
    - `client/src/pages/ModelDebate.tsx` - "Generate First Explanation" navigation
    - `client/src/pages/PuzzleDiscussion.tsx` - Multiple navigation links (2 locations)
    - `client/src/pages/FeedbackExplorer.tsx` - Puzzle and explanation navigation links (2 locations)
    - `client/src/components/puzzle/AnalysisResultHeader.tsx` - Copy link share feature
  - **Impact**: All internal navigation now consistently uses /task/ routes, completing the migration

### Version 6.10.0  Dec 21, 2025

- **Feature: Puzzle Analyst - New high-density grid page for analyzing explanations** (Author: Claude Code using Haiku 4.5)
  - **Purpose**: Read-only, analysis-focused interface for browsing and comparing hundreds of AI-generated explanations for a single puzzle
  - **Design**: Dark futuristic theme with high-information-density grid layout (contrasts with warm PuzzleExaminer)
  - **Behavior**:
    - Default puzzle navigation now routes to `/task/:taskId` (Puzzle Analyst) instead of `/puzzle/:taskId` (PuzzleExaminer)
    - Shows all explanations for a puzzle in compact rows with: predicted grid thumbnail, model name, status badge, cost, timestamp, reasoning indicator, token count
    - Clicking a row expands inline to show full `AnalysisResultCard` with detailed analysis
    - Lazy-loads full explanation data on first expand via `fetchExplanationById`
    - Supports scrolling through hundreds of explanations (no pagination)
  - **Architectural Notes**:
    - New page component with dedicated row component (`ExplanationGridRow`)
    - Reuses existing `TinyGrid`, `AnalysisResultCard`, and `usePaginatedExplanationSummaries` hook
    - SRP/DRY: Page handles layout; row handles single row rendering; data fetching via existing APIs
    - No model selection or prompt controls (read-only mode)
  - **Breaking Change**: All puzzle navigation links now point to `/task/:taskId` (new Puzzle Analyst) by default
    - PuzzleExaminer still accessible via direct URL `/puzzle/:taskId` if needed
    - Updated 10+ navigation components across the codebase
  - **Files Created**:
    - `client/src/pages/PuzzleAnalyst.tsx` - Main page component
    - `client/src/components/puzzle/ExplanationGridRow.tsx` - Row renderer with expand/collapse
  - **Files Modified**:
    - `client/src/App.tsx` - Added import and route for PuzzleAnalyst
    - `client/src/components/ui/ClickablePuzzleBadge.tsx` - Navigation route change
    - `client/src/components/overview/PuzzleList.tsx` - Navigation route change
    - `client/src/components/analytics/DifficultPuzzlesSection.tsx` - Navigation route change
    - `client/src/components/feedback/FeedbackSummary.tsx` - Navigation route change
    - `client/src/components/puzzle/CompactPuzzleCard.tsx` - Navigation route change
    - `client/src/components/puzzle/ChallengePuzzleCard.tsx` - Navigation route change
    - `client/src/pages/PuzzleBrowser.tsx` - Navigation route change
    - `CHANGELOG.md`

### Version 6.9.22  Dec 21, 2025

- **Fix: Worm Arena context overflow for reasoning models** (Author: Claude Haiku 4.5)
  - **Problem**: OpenRouter models hitting 400k token context limit (461,156 tokens requested)
  - **Root Cause**: Reasoning models generate extremely verbose rationales (400k+ tokens), which get included in next turn's prompt, causing exponential growth per turn
  - **Solution**: Multi-layered approach:
    1. **OpenRouter middle-out transform**: Enables OpenRouter's automatic prompt compression feature (intelligently compresses prompts on their side)
    2. **Output token limits**: Set `max_output_tokens: 16000` for reasoning models to prevent explosive rationale generation
    3. **Rationale truncation**: Truncates rationales to 10,000 chars for prompts (80/20 split preserves context), but preserves full text in `move_history` for replay files
    4. **Prompt monitoring**: Warns when prompts exceed 100k tokens for early detection
  - **Impact**: Games that previously crashed mid-match with context errors will now complete successfully
  - **Data Preservation**: Full verbose rationales still saved to replay JSON files for post-game analysis
  - **Backwards Compatible**: All features opt-in/enabled by default, can be disabled via config
  - **Files Modified**:
    - `external/SnakeBench/backend/llm_providers.py` (lines 183-186, 222-225) - Added middle-out transform and output token limits
    - `external/SnakeBench/backend/players/llm_player.py` (lines 107-131, 163, 50-53) - Added truncation method and prompt monitoring
    - `external/SnakeBench/backend/players/llm_player_a.py` (lines 114-138, 171, 53-56) - Same changes for variant A player

### Version 6.9.21  Dec 20, 2025

- **Fix: OpenRouter Responses API max_output_tokens requirement** (Author: Claude Code)
  - **Issue**: OpenRouter updated Responses API proxy to require explicit `max_output_tokens` for reasoning models
  - **Symptom**: gpt-5.1-codex-mini returned empty `output=[]` array despite input being processed
  - **Root Cause**: `max_output_tokens` was never set in player config for OpenAI/xAI models
  - **Fix**: Added `config["max_output_tokens"] = 16000` for models starting with "openai/" or "x-ai/"
  - **Impact**: SnakeBench/Worm Arena matches with gpt-5.1-codex-mini will now generate output
  - **Files Modified**:
    - `server/python/snakebench_runner.py` (line 112)
    - `CHANGELOG.md`

### Version 6.9.20  Dec 20, 2025

- **Worm Arena: Add OpenAI summary paragraph to the model insights report** (Author: Codex (GPT-5))
  - **Behavior**: Report now calls OpenAI Responses API (gpt-5-nano-2025-08-07) to write a short summary
  - **Fallback**: Report still renders stats if the LLM summary fails
  - **Fix**: Summary request now matches Responses API input block format with instruction text and
    reasoning summary fallback parsing
  - **UI**: Inline summary block added to the Models page report card
  - **Docs**: Updated `docs/reference/data/WormArena_Model_Insights_Report.md`
  - **Files Created**:
    - `docs/plans/2025-12-20-worm-arena-model-insights-llm-summary-plan.md`
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `shared/types.ts`
    - `client/src/components/wormArena/WormArenaModelInsightsReport.tsx`
    - `docs/reference/data/WormArena_Model_Insights_Report.md`
    - `CHANGELOG.md`

### Version 6.9.19  Dec 20, 2025

- **Worm Arena: Add per-model actionable insights report with copy, save, and Twitter share actions** (Author: Codex (GPT-5))
  - **New API**: `GET /api/snakebench/model-insights?modelSlug=...` for full-history insights per model
  - **UI**: Inline report on `/worm-arena/models` with failure modes, cost efficiency, and opponent pain points
  - **Docs**: Added `docs/reference/data/WormArena_Model_Insights_Report.md`
  - **Files Created**:
    - `client/src/components/wormArena/WormArenaModelInsightsReport.tsx`
    - `docs/reference/data/WormArena_Model_Insights_Report.md`
    - `docs/plans/2025-12-20-worm-arena-model-insights-report-plan.md`
  - **Files Modified**:
    - `client/src/pages/WormArenaModels.tsx`
    - `client/src/hooks/useWormArenaModels.ts`
    - `server/controllers/snakeBenchController.ts`
    - `server/services/snakeBenchService.ts`
    - `server/repositories/SnakeBenchRepository.ts`
    - `server/routes.ts`
    - `shared/types.ts`
    - `CHANGELOG.md`

### Version 6.9.18  Dec 20, 2025

- **SnakeBench: Add player variant system for A/B testing different LLM prompts** (Author: Cascade)
  - **Purpose**: Enable experimentation with different prompt strategies to improve LLM snake performance
  - **Architecture**: Modular registry pattern - add new variants by creating `llm_player_x.py` and registering in `variant_registry.py`
  - **New variant**: `LLMPlayerA` with tactical "cheat sheet" prompt featuring:
    - Structured decision checklist (safety-first elimination process)
    - Clearer turn context section
    - Same rules and output contract as baseline (verbatim)
  - **Status**: Variant support is present but currently **not enabled** in ARC Explainer runtime (baseline prompt remains in use)
  - **Files Created**:
    - `external/SnakeBench/backend/players/llm_player_a.py` - Variant A player class
    - `external/SnakeBench/backend/players/variant_registry.py` - Registry mapping variant keys to classes
  - **Files Modified**:
    - `external/SnakeBench/backend/players/__init__.py` - Export new classes and registry
    - `external/SnakeBench/backend/main.py` - (Dormant) wiring kept off; baseline `LLMPlayer` remains active
    - `server/python/snakebench_runner.py` - (Dormant) no playerVariant fields passed to Python
    - `server/services/snakeBench/helpers/validators.ts` - (Dormant) no playerVariant fields in payload
    - `shared/types.ts` - (Dormant) no playerVariant fields in request types
  - **Extensibility**: To add variant B/C/D: create `llm_player_b.py`, add entry to `PLAYER_VARIANT_LOADERS` in registry

### Version 6.9.17  Dec 20, 2025

- **Worm Arena: Add Rules & LLM prompt transparency page + API endpoint** (Author: Cascade)
  - **New UI**: `/worm-arena/rules` page that shows:
    - Human-readable rules summary
    - Canonical TypeScript prompt template with placeholders (B2)
    - Live-extracted Python prompt builder block and raw source (B1)
  - **New public API**: `GET /api/snakebench/llm-player/prompt-template`
    - Returns both B1 and B2 representations so the UI is always truthful
    - Includes `APPLE_TARGET` parsed from SnakeBench Python constants when available
  - **Verification**: Added a drift-detection test that fails if the canonical fixed rules lines stop matching `llm_player.py`
  - **Files Created**:
    - `client/src/pages/WormArenaRules.tsx`
    - `server/services/snakeBench/SnakeBenchLlmPlayerPromptTemplate.ts`
    - `tests/snakeBenchLlmPlayerPromptTemplate.test.ts`
  - **Files Modified**:
    - `client/src/App.tsx`
    - `client/src/pages/WormArena.tsx`
    - `client/src/pages/WormArenaLive.tsx`
    - `client/src/pages/WormArenaMatches.tsx`
    - `client/src/pages/WormArenaModels.tsx`
    - `client/src/pages/WormArenaStats.tsx`
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `server/controllers/snakeBenchController.ts`
    - `server/routes.ts`
    - `shared/types.ts`

### Version 6.9.16  Dec 20, 2025

- **SnakeBench: Enable GitHub replay auto-publish workflow** (Author: Claude Haiku 4.5)
  - **Problem**: Replay publishing to GitHub was implemented but missing required environment variables, so games never pushed to VoynichLabs/SnakeBench repo
  - **Solution**: Added explicit environment variable configuration for GitHub publishing (token, owner, repo, branch, replay directory)
  - **Context**: Completed games are written locally to `external/SnakeBench/backend/completed_games_local`, then published to public `VoynichLabs/SnakeBench/backend/completed_games` via GitHub API for Railway and other deployments
  - **Files Modified**:
    - `.env` - Added `SNAKEBENCH_GITHUB_OWNER`, `SNAKEBENCH_GITHUB_REPO`, `SNAKEBENCH_GITHUB_BRANCH`, `SNAKEBENCH_GITHUB_REPLAY_DIR` configuration
    - `README.md` - Added 30-40 word explanation of replay publishing pipeline
  - **Going Forward**: All new games will auto-publish to GitHub; existing unpushed games from Dec 15-20 remain local

### Version 6.9.15  Dec 20, 2025

- **Worm Arena: Improve navigation to Model Match History + add direct API JSON links** (Author: Claude Sonnet 4)
  - **UX**: Added "Models" tab to Worm Arena header nav across Replay/Live/Matches/Stats/Skill pages
  - **API navigation**: Models page now includes one-click links to open:
    - `/api/snakebench/models-with-games`
    - `/api/snakebench/model-history-full?modelSlug=...`
  - **Files Modified**:
    - `client/src/pages/WormArena.tsx`
    - `client/src/pages/WormArenaLive.tsx`
    - `client/src/pages/WormArenaMatches.tsx`
    - `client/src/pages/WormArenaStats.tsx`
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `client/src/pages/WormArenaModels.tsx`

### Version 6.9.14  Dec 19, 2025

- **Reference Material: Add Patrick Spencer's minireason project** (Author: Claude Haiku 4.5)
  - **Added**: Link to minireason symbolic reasoning benchmark (https://github.com/pwspen/minireason/tree/main)
  - **Context**: Simple, extensible symbolic reasoning benchmark with configurable difficulty knobs
  - **Files Modified**:
    - `client/src/components/browser/ReferenceMaterial.tsx` - Added minireason link alongside existing objarc entry in Tools & Solvers section

### Version 6.9.13  Dec 19, 2025

- **Worm Arena: Add Model Match History page** (Author: Claude Sonnet 4)
  - **Feature**: New `/worm-arena/models` page to browse every game a specific model has played
  - **Mirrors**: External SnakeBench `/models/[id]` page functionality
  - **Key behavior**: Model picker only lists models that have actually played games (no empty results)
  - **Backend**:
    - `GET /api/snakebench/models-with-games` - Returns only models with games played
    - `GET /api/snakebench/model-history-full?modelSlug=...` - Returns ALL matches (unbounded)
  - **Frontend**:
    - Model selector dropdown with games count and win rate
    - Stats header (total matches, win rate, rating, apples eaten, total cost)
    - Full match history table with opponent, date, duration, outcome, death reason, score, cost
    - Click opponent to switch to their match history
    - "View Replay" link to watch any game
  - **Files Created**:
    - `client/src/pages/WormArenaModels.tsx` - Main page component
    - `client/src/hooks/useWormArenaModels.ts` - Data fetching hooks
  - **Files Modified**:
    - `server/repositories/SnakeBenchRepository.ts` - Added `getModelsWithGames()` and `getModelMatchHistoryUnbounded()`
    - `server/services/snakeBenchService.ts` - Added service methods
    - `server/controllers/snakeBenchController.ts` - Added controller endpoints
    - `server/routes.ts` - Added routes
    - `client/src/App.tsx` - Added route and import
    - `shared/types.ts` - Added `WormArenaModelWithGames` type

### Version 6.9.12  Dec 19, 2025

- **Worm Arena Greatest Hits: Fix refresh and add dynamic ranking** (Author: Claude Haiku 4.5)
  - **Problem**: Greatest hits matches weren't refreshing with new interesting games; users saw stale curated list from Dec 11
  - **Solution**:
    1. Added 5 new dynamically-discovered high-interest games to curated hall of fame (Dec 18, 2025 matches)
    2. Implemented dynamic DB-driven ranking with graceful fallback to curated list
  - **New Games Added** (Dec 18, 2025):
    - `5a632478-e6c5-45df-9f6e-c5981f1eb66e` - Epic marathon duel (93/150 rounds, decisive 21-12 finish)
    - `d51f5e45-b148-4adc-b8e1-ab97ec34d8a0` - Highest-scoring match (23 apples with competitive 4-apple finish)
    - `fc95a52a-ecbb-4332-868f-e0810e3afd26` - Photo finish Gemini vs GPT-5.2 (21-20 with high cost signal ~$1.79)
    - `d24ac1c2-d4eb-42f8-8064-11dab8cc705a` - Kimi-K2 vs Gemini with extreme 3.7+ hour replay duration
    - `cdb63849-9ad8-48f0-8548-ae8fb4e80953` - Zero-cost duel (88 rounds, 18-16 apples)
  - **Architecture**: Service now tries dynamic DB ranking first via `SnakeBenchRepository.getWormArenaGreatestHits()`, falls back to curated list if DB unavailable
  - **Files Modified**:
    - `server/services/snakeBench/snakeBenchHallOfFame.ts` - Added 5 new games with meaningful highlight reasons
    - `server/services/snakeBench/helpers/replayFilters.ts` - Implemented two-tier strategy (dynamic DB + curated fallback)
  - **Verification**: Build and server startup successful; endpoint logic maintains backward compatibility

### Version 6.9.11  Dec 19, 2025

- **Worm Arena: Improve live board worm head visualization** (Author: Claude Haiku 4.5)
  - **Problem**: Live board always showed right arrow (➡️) for worm head, regardless of actual movement or lack of direction data
  - **Solution**: Updated head emoji logic to show direction arrows only before worm has body, then 🐛 once body grows
  - **Behavior**:
    - Just a head (no body): Directional arrows (⬆️ ⬇️ ⬅️ ➡️) based on movement
    - Has a body: Worm emoji (🐛) for clear worm identification
  - **Files Modified**:
    - `client/src/components/WormArenaGameBoard.tsx` - Updated `getHeadEmoji()` logic and call sites

### Version 6.9.10  Dec 19, 2025

- **Worm Arena: Fix suggested matchups refresh issue** (Author: Cascade)
  - **Problem**: Suggested matchups showed stale "unplayed pairing" results for days despite hundreds of matches played
  - **Root Cause**: Key normalization mismatch between database query and matchup suggestions logic
    - Database query uses `LEAST()`/`GREATEST()` functions with `:free` suffix removal
    - Matchup suggestions used simple alphabetical comparison without suffix removal
    - This created different keys for the same model pair, preventing proper filtering
  - **Fix**: Updated `pairKey()` function in `matchupSuggestions.ts` to match database normalization
  - **Additional**: Added `/api/snakebench/ingest-queue-status` endpoint for debugging queue delays
  - **Files Modified**:
    - `server/services/snakeBench/helpers/matchupSuggestions.ts` - fixed key normalization
    - `server/controllers/snakeBenchController.ts` - added ingest queue status endpoint
    - `server/routes.ts` - added route for ingest queue status
    - `client/src/hooks/useWormArenaSuggestMatchups.ts` - fixed useEffect dependency

### Version 6.9.9  Dec 19, 2025

- **SnakeBench Service: Complete modular refactoring** (Author: Cascade)
  - **Accomplishment**: Transformed monolithic 1687-line service into 14 focused modules
  - **Architecture**: Main `snakeBenchService.ts` now serves as thin orchestrator
  - **Benefits**: Improved maintainability, testability, and separation of concerns
  - **Preservation**: All 19 public methods maintain identical signatures and behavior
  - **Quality**: Comprehensive headers, JSDoc, and comments throughout all modules
  - **Status**: Code refactoring complete, testing and deployment pending
  - **Files Modified**:
    - `server/services/snakeBenchService.ts` - rewritten as orchestrator
    - `server/services/snakeBench/` - 14 new focused modules created
  - **Documentation**: See `docs/2025-12-19-snakebench-service-refactor.md` for full details

### Version 6.9.8  Dec 19, 2025

- **Worm Arena: Simplify replay loading - server always returns data directly** (Author: Claude Sonnet 4)
  - **Problem**: Complex client-side URL fetching with CORS fallbacks was unreliable
  - **Solution**: Server now ALWAYS fetches replay data server-side and returns `{data}` directly
    - Matches how the Python SnakeBench project serves replays - simple and direct
    - No more client-side URL fetching or CORS issues
  - **Resolution order in getGame()**:
    1. Local file from database replay_path
    2. Local file at standard path (completed_games/snake_game_<id>.json)
    3. Remote URL from database replay_path (fetched server-side)
    4. Railway backend fallback (fetched server-side)
    5. GitHub raw fallback (fetched server-side)
  - **Files Modified**:
    - `server/services/snakeBenchService.ts` - getGame() always fetches server-side
    - `server/controllers/snakeBenchController.ts` - simplified response format
    - `client/src/hooks/useSnakeBench.ts` - removed complex fallback logic
  - **Note**: VoynichLabs/SnakeBench is our fork with 1244 replay JSONs committed

### Version 6.9.7  Dec 19, 2025

- **Worm Arena: Fix replay existence check to accept HTTP URLs from database** (Author: Claude Sonnet 4)
  - **Root Cause**: Commit `c3b3379a` broke replays by "simplifying" `replayExists()` to ignore HTTP URLs
    - The bug was line: `if (dbReplay?.replayPath && !dbReplay.replayPath.startsWith('http'))`
    - This explicitly skipped all remote replay URLs stored in the DB
    - Games with remote replays (most of them) were filtered out as "non-existent"
  - **Fix**: `replayExists()` now returns `true` for HTTP/HTTPS URLs in the DB
    - `getGame()` already had proper logic to fetch remote URLs
    - The mismatch meant `replayExists()` said "no replay" but `getGame()` could load it fine
  - **Files Modified**: `server/services/snakeBenchService.ts`
  - **Impact**: Greatest Hits and replay filtering now correctly include games with remote replay URLs

### Version 6.9.6  Dec 19, 2025

- **Worm Arena: Fix replay loading to use Greg's Railway backend (root cause fix)** (Author: Claude Sonnet 4)
  - **Root Cause**: Previous code used wrong/stale upstream URL for fetching replays from upstream SnakeBench
    - Was trying: `snakebench.com/api/matches/{id}` (frontend domain, not backend)
    - Should use: `backend-production-fc22.up.railway.app/api/matches/{id}` (Greg's actual Railway backend)
  - **Architecture clarification**: Greg uses Next.js SSR - his server fetches from Supabase Storage and embeds 
    data in HTML. Browser sees no Supabase requests because they happen server-side. Our backend-to-backend 
    approach (fetching from his Flask API) is correct and equivalent.
  - **Fix**: Updated `snakeBenchService.getGame()` and `getGameProxy()` to use Greg's Railway backend directly
    - Primary fallback: `https://backend-production-fc22.up.railway.app/api/matches/{gameId}`
    - Secondary fallback: GitHub raw for older games
  - **New env var**: `SNAKEBENCH_UPSTREAM_BACKEND_URL` - override Greg's backend URL if it changes
    - Default: `https://backend-production-fc22.up.railway.app`
  - **Fallback order**: Local file -> DB replay_path -> Greg's Railway backend -> GitHub raw
  - **Files Modified**: `server/services/snakeBenchService.ts`

### Version 6.9.5  Dec 19, 2025

- **Worm Arena: Restore fallback when greatest hits unavailable + simplify replay loading** (Author: Claude Haiku 4.5)
  - **UI Fix**: Fixed regression from v6.9.3 where replays appeared broken due to blank page when greatest-hits endpoint returns empty
    - Restored cascade logic: prefer greatest hits → fall back to recent games (filtered by ≥20 rounds) → show any recent game
    - Dependency array now includes `games` so fallback logic re-evaluates when recent games load
  - **Backend Fix**: Simplified `replayExists()` to check local bundled files only
    - Removed slow remote URL fallbacks (GitHub raw, snakebench.com) that were timing out
    - All replay JSONs are bundled in `external/SnakeBench/backend/completed_games/` and deployed to Railway
    - Direct `fs.existsSync()` check is fast, reliable, and works in both dev and production
    - Removed unnecessary `SNAKEBENCH_REPLAY_RAW_BASE` env var dependency (optional in .env)
  - **Files Modified**: `client/src/pages/WormArena.tsx`, `server/services/snakeBenchService.ts`
  - **Impact**: Greatest hits now always return playable games (fast local checks) + page shows fallback replays if needed

### Version 6.9.4  Dec 19, 2025

- **Worm Arena Console & Model Selector UI Refinement** (Author: Claude Haiku 4.5)
  - Reduced excessive padding in model selector list for more compact, terminal-like appearance
  - Changed model selector buttons from `px-3 py-2` to `px-2 py-1` with reduced text sizes (`text-xs`)
  - Replaced row spacing (`space-y-2`) with subtle `border-b` dividers for cleaner look
  - Moved win/loss/tie stats inline with model name instead of right-aligned (like trading terminal ticker)
  - Changed console view layout from stacked (vertical) to side-by-side (horizontal)
  - Python ASCII console now on left, event stream on right with equal horizontal space
  - Reduced event stream text sizes and padding for denser display
  - Improved space efficiency on live match pages by eliminating whitespace
  - **Files Modified**:
    - `client/src/components/wormArena/stats/WormArenaModelListCard.tsx`
    - `client/src/components/WormArenaConsoleMirror.tsx`

### Version 6.9.3  Dec 19, 2025 14:30 

- **Worm Arena: Default to greatest hits match on page load** (Author: Cascade)
  - Fixed blank screen issue on `/worm-arena` by defaulting to load the first greatest hits match instead of showing no content
  - Added `useWormArenaGreatestHits` hook usage to main WormArena component
  - Changed default selection logic from recent games to curated greatest hits games
  - Users now see an interesting match immediately instead of a blank page
  - **Files Modified**:
    - `client/src/pages/WormArena.tsx`
    - `CHANGELOG.md`

### Version 6.9.2  Dec 19, 2025

- **Worm Arena: Free model preference and normalization** (Author: Cascade)
  - Fixed issue where free and paid versions of same model (e.g., `mistralai/devstral-2512` vs `mistralai/devstral-2512:free`) were treated as separate models
  - Modified pairing history query to normalize model slugs by removing `:free` suffix
  - Updated suggest-matchups logic to prefer free versions over paid versions when both exist
  - Fixed model rating lookups (`/api/snakebench/model-rating`) to return data for free/paid variants
  - Fixed model history lookups (`/api/snakebench/model-history`) to include matches for both variants
  - Fixed match filtering (`/api/snakebench/matches`) to include results for free/paid variants
  - Fixed TrueSkill leaderboards (`/api/snakebench/leaderboard`) to group by normalized slugs instead of showing duplicates
  - Fixed basic leaderboards (`/api/snakebench/leaderboard/basic`) to group by normalized slugs instead of showing duplicates
  - Ensures free models appear in suggestions instead of paid equivalents
  - **Files Modified**:
    - `server/repositories/SnakeBenchRepository.ts`
    - `server/services/snakeBenchService.ts`
    - `CHANGELOG.md`

### Version 6.9.1  Dec 19, 2025

- **Worm Arena: Persistent live-link resolution** (Author: Cascade)
  - Fixed issue where old `/worm-arena/live/:sessionId` links would show "Session unavailable" after server restarts
  - Added `worm_arena_sessions` Postgres table to persist `sessionId -> gameId` mappings
  - Old live links now reliably redirect to exact replays even after server restarts
  - Added `WormArenaSessionRepository` for DB operations
  - Updated `wormArenaStreamController` to persist completed sessions to DB
  - **New files created**:
    - `server/repositories/WormArenaSessionRepository.ts`
    - `migrations/0005_worm-arena-sessions.sql`
    - `docs/plans/2025-12-19-worm-arena-persistent-live-links.md`
  - **Files modified**:
    - `server/controllers/wormArenaStreamController.ts`
    - `server/repositories/RepositoryService.ts`
    - `server/repositories/database/DatabaseSchema.ts`
    - `shared/schema.ts`
    - `CHANGELOG.md`

### Version 6.8.2  Dec 19, 2025

- **Worm Arena: Replay viewer reliability fix (CORS-proof replay loading)** (Author: Cascade)
  - Fixed replay loading failures where the browser attempted to fetch remote replay JSON directly (often blocked by CORS)
  - Server now fetches remote replay JSON (DB replay_path, snakebench.com upstream, GitHub raw fallback) and returns it as same-origin `{ data }`
  - Restores replay viewing (including Console View) in both local dev and production
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `CHANGELOG.md`

### Version 6.8.1  Dec 19, 2025

- **Worm Arena: Production crash fix + friendlier live link handling** (Author: Cascade)
  - Fixed a **blank page crash** in Worm Arena Matches caused by an invalid Radix Select item (`SelectItem value=""`)
    - Replaced empty-string select values with a non-empty sentinel and mapped it back to “no filter” internally
  - Improved **Live link UX** when a sessionId is expired/unknown in production
    - Added a preflight gate using `/api/wormarena/resolve/:sessionId` before attempting SSE connect
    - If the match already finished, users are redirected to the replay automatically
    - If the link is expired/unknown, the page stays usable with a clear message (no hard crash)
  - **Files Modified**:
    - `client/src/pages/WormArenaMatches.tsx`
    - `client/src/pages/WormArenaLive.tsx`
    - `CHANGELOG.md`

### Version 6.8.0  Dec 18, 2025

- **Worm Arena: Console Mirror View - Raw Python Terminal Experience** (Author: Claude Sonnet 4)
  - Added **view mode toggle** to both Live and Replay pages
  - Users can now switch between "Cartoon View" (default emoji canvas) and "Console View" (raw Python terminal)
  - **Console View features**:
    - ASCII board matching Python's `GameState.print_board()` format exactly
    - Symbols: `.` = empty, `A` = apple, `0`/`1` = snake heads, `T` = body
    - Y-axis labels on left (high to low), X-axis labels at bottom
    - Dark terminal theme with green text
    - Live event stream log (live page only) with auto-scroll
    - Event type badges: init, status, frame, chunk, complete, error
  - **New files created**:
    - `client/src/lib/wormArena/renderPythonAsciiBoard.ts` - Python-accurate ASCII renderer
    - `client/src/components/WormArenaConsoleMirror.tsx` - Console view component
    - `docs/plans/2025-12-18-worm-arena-console-mirror-improved.md` - Implementation plan
  - **Files modified**:
    - `client/src/hooks/useWormArenaStreaming.ts` - Added `eventLog` state for chronological SSE event collection
    - `client/src/pages/WormArenaLive.tsx` - Added render mode toggle, console view integration
    - `client/src/pages/WormArena.tsx` - Added render mode toggle, console view integration
    - `CHANGELOG.md`
  - **Educational purpose**: Shows users what the Python SnakeBench engine actually outputs, bridging the gap between the friendly UI and the underlying mechanics

### Version 6.7.0  Dec 18, 2025

- **Worm Arena: Major UX improvements across all pages** (Author: Cascade)
  - **Compact headers everywhere**: All Worm Arena pages now use compact header mode (~1/3 original size)
    - Title + nav pills inline on single row
    - Reduced from text-4xl/5xl to text-xl
    - Cleaner, less overwhelming first impression
  - **Fixed OpenRouter model availability bug**: "Run" button on suggested matchups was incorrectly showing "models not available" error
    - Root cause: React state updates are async; old code checked stale state in setTimeout
    - Fix: Check model availability directly with passed parameters, build payload inline
  - **Redesigned Live Scoreboard** (`WormArenaLiveScoreboard.tsx`):
    - Compact single-row layout (~1/3 original height)
    - Consistent worm emoji: now uses `\uD83D\uDC1B` for both players (was using snail for one)
    - Added TrueSkill stats display: exposed rating, sigma (uncertainty), games played
    - Stats fetched via `useModelRating` hook, shown below model name
    - Smaller apple score pills, cleaner VS divider
  - **Files Modified**:
    - `client/src/pages/WormArena.tsx` - added `compact` prop to header
    - `client/src/pages/WormArenaLive.tsx` - compact header, fixed matchup run bug, TrueSkill stats wiring
    - `client/src/pages/WormArenaStats.tsx` - added `compact` prop to header
    - `client/src/pages/WormArenaSkillAnalysis.tsx` - added `compact` prop to header
    - `client/src/components/WormArenaLiveScoreboard.tsx` - complete redesign with TrueSkill integration
    - `CHANGELOG.md`

### Version 6.6.9  Dec 18, 2025

- **Worm Arena Matches: Robust advanced search with death reason filter** (Author: Cascade)
  - Added **death reason** filter: head_collision, body_collision, wall, survived
  - Added **score range** filters (min/max score)
  - Added **cost range** filters (min/max cost in $)
  - Added **max rounds** filter (was only min before)
  - Added **myScore** sort option
  - Model filter is now **optional** - can search across all models
  - Search results table now shows: Model, Death Reason columns
  - Quick presets row with "Clear ranges" button
  - Better human-readable labels (e.g., "Head Collision" vs "head_collision")
  - **Backend changes**:
    - `shared/types.ts`: Added `SnakeBenchDeathReason` type, enhanced `SnakeBenchMatchSearchQuery`
    - `server/controllers/snakeBenchController.ts`: Parse new query params
    - `server/repositories/SnakeBenchRepository.ts`: Add filters for deathReason, maxRounds, score range, cost range
  - **Files Modified**:
    - `shared/types.ts`
    - `server/controllers/snakeBenchController.ts`
    - `server/repositories/SnakeBenchRepository.ts`
    - `client/src/pages/WormArenaMatches.tsx`
    - `CHANGELOG.md`

### Version 6.6.8  Dec 18, 2025

- **Worm Arena Matches: Redesigned as "Greatest Hits" showcase** (Author: Cascade)
  - Page now leads with curated Greatest Hits matches prominently at top
  - Advanced search filters moved to collapsible accordion for power users
  - Uses compact header (~50% smaller footprint)
  - Search results table is cleaner with better column sizing
  - **Files Modified**:
    - `client/src/pages/WormArenaMatches.tsx`
    - `CHANGELOG.md`

- **WormArenaHeader: Added compact mode** (Author: Cascade)
  - New `compact` prop for ~50% smaller header footprint
  - Compact mode: single-row layout with title + nav inline
  - Title reduced from 4xl to xl, nav pills from text-sm to text-xs
  - Standard mode unchanged (stacked, centered, large)
  - **Files Modified**:
    - `client/src/components/WormArenaHeader.tsx`

### Version 6.6.7  Dec 18, 2025

- **Worm Arena Live: Enlarged game board by reducing padding/margins** (Author: Cascade)
  - **WormArenaLiveBoardPanel.tsx**: Reduced container padding (px-4 py-4 -> px-2 py-2), tighter title margin
  - **WormArenaGameBoard.tsx**: 
    - Reduced border from 8px to 4px
    - Reduced internal padding from 16px to 8px
    - Reduced label margins for more board space
    - Increased max board height (520px -> 600px) and cell size limits (56px -> 64px)
    - Minimum cell size increased (16px -> 18px) for better visibility
  - Result: Same page footprint but significantly larger visible game grid
  - **Files Modified**:
    - `client/src/components/WormArenaLiveBoardPanel.tsx`
    - `client/src/components/WormArenaGameBoard.tsx`
    - `CHANGELOG.md`

- **Worm Arena: TrueSkill Stats Integration Plan** (Author: Cascade)
  - Created comprehensive implementation plan for enhancing Live page with TrueSkill data
  - Documents existing architecture, data flow, and reusable components
  - Outlines 3-phase approach: pre-match stats strip, live scoreboard enhancement, post-match context
  - Written as developer-to-developer handoff document
  - **Files Created**:
    - `docs/plans/2025-12-18-worm-arena-live-stats-integration-plan.md`

### Version 6.6.6  Dec 18, 2025

- **Worm Arena: Redesigned header and scoreboard with stacked/centered layout** (Author: Cascade)
  - **WormArenaHeader.tsx**: Complete redesign with:
    - Stacked, centered layout instead of left-aligned
    - Larger typography (4xl/5xl title)
    - Pill-style navigation buttons with clear affordances
    - Active state: solid background, inactive: transparent with border
    - Hover effect: lift + shadow for better UX feedback
  - **WormArenaLiveScoreboard.tsx**: Enhanced scoreboard with:
    - Larger apple score pills with winning player scale animation
    - Model names displayed prominently with color coding (green/blue)
    - Worm emoji icons for visual appeal
    - Centered three-column layout (Player A / VS / Player B)
  - **index.css**: Added new CSS classes for pill-style nav buttons:
    - `.worm-header-title-text` for centered title
    - `.worm-header-nav-active` for active nav pill
    - `.worm-header-nav-inactive` for inactive nav pill with hover states
  - **Files Modified**:
    - `client/src/components/WormArenaHeader.tsx`
    - `client/src/components/WormArenaLiveScoreboard.tsx`
    - `client/src/index.css`
    - `CHANGELOG.md`

### Version 6.6.5  Dec 18, 2025

- **Worm Arena: Upstream replay URL pattern with snakebench.com fallback** (Author: Cascade)
  - Changed `GET /api/snakebench/games/:gameId` to match upstream SnakeBench pattern:
    - Returns `{ data }` when local file available (local dev)
    - Returns `{ replayUrl, fallbackUrls }` when replay must be fetched remotely (deployment)
  - **Fallback URL chain** (client tries in order until one succeeds):
    1. DB `replay_path` URL (if stored)
    2. `https://snakebench.com/api/matches/<id>` (upstream site, for old games)
    3. GitHub raw (`VoynichLabs/SnakeBench/main/backend/completed_games/`)
  - Frontend `useSnakeBenchGame` hook now tries multiple URLs until one succeeds
  - **This eliminates server-side JSON proxy truncation issues** that caused "Invalid JSON response" errors in Railway deployment
  - Configurable via env vars: `SNAKEBENCH_UPSTREAM_URL`, `SNAKEBENCH_REPLAY_RAW_BASE`
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `server/controllers/snakeBenchController.ts`
    - `client/src/hooks/useSnakeBench.ts`
    - `shared/types.ts`
    - `CHANGELOG.md`

### Version 6.6.4  Dec 18, 2025

- **Worm Arena: Improved remote replay fetching diagnostics/robustness** (Author: Cascade)
  - Improved remote replay fetching for Worm Arena replays with better diagnostics and robustness.
  - Added User-Agent headers, support for redirects, and a configurable timeout to improve fetching reliability.
  - Enhanced error reporting to provide more informative error messages when fetching fails.
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `CHANGELOG.md`

### Version 6.6.3  Dec 18, 2025

- **Worm Arena: Deployment replay fallback fix** (Author: Cascade)
  - Updated `GET /api/snakebench/games/:gameId` replay loading so a bad/unreadable local replay file no longer blocks fallback to remote replay sources (DB URL and GitHub raw).
  - This resolves deployment cases where a replay exists (e.g. upstream GitHub raw), but the server had a stale/broken `replay_path` on disk.
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `CHANGELOG.md`

### Version 6.6.2  Dec 18, 2025

- **VS Code chatSessions proposed API enablement** (Author: Codex)
  - Added `enabledApiProposals: ["chatSessionsProvider"]` to `package.json` so `chatSessions/newSession` is exposed when the workspace is opened normally.
  - Documented the requirement and fallback flag in `docs/README.md`.
  - **Files Modified**:
    - `package.json`
    - `docs/README.md`
    - `CHANGELOG.md`

### Version 6.6.1  Dec 18, 2025

- **Worm Arena: Replay + Suggested Matchups fixes** (Author: Cascade)
  - Moved match-wide totals out of per-player reasoning cards into a single Match totals card on the replay page.
  - Fixed dev-mode routing so `/api/*` never falls back to `index.html` (prevents "Unexpected token '<'" in Suggested Matchups).
  - **Files Modified**:
    - `client/src/pages/WormArena.tsx`
    - `server/vite.ts`
    - `CHANGELOG.md`

### Version 6.6.0  Dec 17, 2025

- **Worm Arena: Suggested Matchups - discover interesting unplayed pairings** (Author: Cascade)
  - New feature that identifies the **most interesting matches that haven't been run yet** from the model pool.
  - Two scoring modes with toggle button:
    - **Ladder Quality**: Prioritizes matches that will improve ranking accuracy (high uncertainty models, close ratings)
    - **Entertainment**: Prioritizes exciting matches to watch (close fights, high-stakes top models, upset potential)
  - Each suggestion shows:
    - Both models with their TrueSkill exposed ratings and games played
    - Explanation tags (e.g., "Unplayed pairing", "Expected nail-biter", "High-stakes (top-tier model)")
    - One-click **Run** button to start the match
  - Only includes models with >= 3 games (placement complete) and pairs that have **never competed**.
  - Variety penalty ensures no model appears more than 3 times in suggestions.
  - **Backend**: 
    - New `GET /api/snakebench/suggest-matchups?mode=ladder|entertainment&limit=20` endpoint
    - `getPairingHistory()` repository query computes all model pair match counts
    - Scoring algorithm in `snakeBenchService.suggestMatchups()` with clear mode separation
  - **Frontend**:
    - New `WormArenaSuggestedMatchups` component with mode toggle and run buttons
    - New `useWormArenaSuggestMatchups` hook for data fetching
    - Integrated into main Worm Arena page (alongside Greatest Hits)
    - Integrated into Stats & Placement page (alongside Greatest Hits)
  - **New Types**: `WormArenaSuggestMode`, `WormArenaPairingHistory`, `WormArenaModelSummary`, `WormArenaSuggestedMatchup`, `WormArenaSuggestMatchupsResponse`
  - **Files Created**:
    - `client/src/components/WormArenaSuggestedMatchups.tsx`
    - `client/src/hooks/useWormArenaSuggestMatchups.ts`
  - **Files Modified**:
    - `server/repositories/SnakeBenchRepository.ts` (added `getPairingHistory()`)
    - `server/services/snakeBenchService.ts` (added `suggestMatchups()`)
    - `server/controllers/snakeBenchController.ts` (added `suggestMatchups` handler)
    - `server/routes.ts` (added `/api/snakebench/suggest-matchups` route)
    - `shared/types.ts` (added suggested matchup types)
    - `client/src/pages/WormArena.tsx` (integrated component)
    - `client/src/pages/WormArenaStats.tsx` (integrated component)
    - `CHANGELOG.md`

### Version 6.5.18  Dec 18, 2025

- **Worm Arena Live: durable share links and single-match architecture** (Author: Cascade)
  - **Durable share links**: Visiting a `/worm-arena/live/:sessionId` URL after the match ends now automatically redirects to the replay page instead of showing an error.
  - **Share button improvements**: Copy button now copies a **replay URL** when the match is complete (gameId-based), or the live URL while running.
  - **Removed batch mode**: One session = one match. Deleted unused batch logic from frontend hook and backend controller.
  - **Deleted dead code**: Removed unused `WormArenaSetup.tsx` component.
  - Added `GET /api/wormarena/resolve/:sessionId` endpoint that maps sessionId to gameId for completed matches (30-day TTL).
  - **Files Modified**:
    - `client/src/pages/WormArenaLive.tsx`
    - `client/src/hooks/useWormArenaStreaming.ts`
    - `server/controllers/wormArenaStreamController.ts`
    - `server/routes.ts`
    - `CHANGELOG.md`
  - **Files Deleted**:
    - `client/src/components/WormArenaSetup.tsx`

### Version 6.5.17  Dec 18, 2025

- **Worm Arena Live: model dropdown shows full catalog** (Author: Cascade)
  - Fixed the model combobox list being capped (it could stop early and hide many configured models).
  - Dropdown is now explicitly scrollable and will show the full configured model catalog.
  - **Files Modified**:
    - `client/src/components/WormArenaRunControls.tsx`
    - `CHANGELOG.md`

### Version 6.5.16  Dec 17, 2025 🜟 20:42

- **Worm Arena Live: OpenRouter-only configured model slugs** (Author: Cascade)
  - Live match setup now clearly indicates **OpenRouter models only**.
  - Model selection is restricted to the configured model catalog (no custom typed model slugs).
  - **Files Modified**:
    - `client/src/components/WormArenaRunControls.tsx`
    - `CHANGELOG.md`

### Version 6.5.15  Dec 17, 2025

- **Worm Arena: Match duration display and per-round timestamps** (Author: Claude)
  - Added **match duration** display to live results panel (calculated from `startedAt`/`completedAt`)
  - Shows total duration (e.g., "1m 23s") and average time per round (e.g., "4.2s/round avg")
  - Added `durationSeconds` and `avgSecondsPerRound` fields to `WormArenaFinalSummary` type
  - **SnakeBench Python backend**: Added `timestamp` field to each frame in `record_frame()` for per-round timing
  - Future games will now have per-round timestamps stored in the JSON for detailed analysis
  - **Files Modified**:
    - `client/src/components/WormArenaLiveResultsPanel.tsx`
    - `shared/types.ts`
    - `external/SnakeBench/backend/main.py`
    - `CHANGELOG.md`

### Version 6.5.14  Dec 17, 2025

- **Worm Arena Live: Champion vs Challengers batch mode** (Author: Claude)
  - Redesigned match queue to **Champion vs Challengers** pattern:
    - Set Model A as your "champion"
    - Add multiple Model B entries as "challengers" using the + button
    - Click "Run All" to open each match in a **new browser tab**
  - Each match is prepared via `/api/snakebench/stream/prepare` and opens independently
  - Searchable combobox retained - type to filter models instead of scrolling through dropdown
  - Users can still type custom model names if not in the list
  - **Note**: Per-round timestamps not yet available in game JSON (only game-level `started_at`/`ended_at`)
  - **Files Modified**:
    - `client/src/components/WormArenaRunControls.tsx`
    - `CHANGELOG.md`

### Version 6.5.13  Dec 17, 2025

- **Worm Arena Live: searchable model selector and match queue** (Author: Claude)
  - Replaced dropdown selects with **searchable combobox** - type to filter models instead of scrolling
  - Users can now type custom model names directly if not in the list
  - Added **match queue** feature - queue multiple matchups and run them sequentially
  - Queue shows pending matches with remove buttons; "Start Queue" runs all queued matches
  - Exported `QueuedMatchup` interface and added `onStartQueue` callback prop for queue support
  - **Files Modified**:
    - `client/src/components/WormArenaRunControls.tsx`
    - `CHANGELOG.md`

### Version 6.5.12  Dec 17, 2025

- **Worm Arena Skill Analysis: sorting, Dr. Budd credit, and TrueSkill link** (Author: Claude)
  - Compare model list now sorted by **games played** (most to least)
  - Baseline model list now sorted by **win rate** (highest to lowest)
  - Card titles now display the actual model slug instead of generic labels
  - Added `sortBy` prop to `WormArenaModelListCard` supporting `'gamesPlayed'` or `'winRate'`
  - Updated sigma explanation to clarify that low sigma means **consistent performance**, not just many games
  - Added Microsoft Research TrueSkill documentation link in the "Why TrueSkill?" accordion
  - Added **human-verified badge** crediting Dr. Jeremy Budd for proofreading and statistical guidance, with link to Hall of Fame
  - **Files Modified**:
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `client/src/components/wormArena/stats/WormArenaModelListCard.tsx`
    - `CHANGELOG.md`

### Version 6.5.11  Dec 17, 2025

- **Worm Arena: Baseline color + UI readability improvements** (Author: Claude Sonnet 4)
  - Changed baseline model color from red to **green** across all components (role colors, snapshot cards, pills)
  - Changed pessimistic/optimistic confidence interval pills from red/green to **gray/black** scheme for better clarity
  - Added "Click a dot to select that model" instruction text above scatter plot
  - Increased scatter plot axis labels from tiny gray to **bold black text** for readability
  - Added `worm-pill-baseline` CSS class with green styling
  - **Files Modified**:
    - `client/src/utils/wormArenaRoleColors.ts`
    - `client/src/components/wormArena/DataNumber.tsx`
    - `client/src/components/wormArena/stats/WormArenaModelSnapshotCard.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillScatterPlot.tsx`
    - `client/src/index.css`
    - `CHANGELOG.md`

### Version 6.5.10  Dec 17, 2025

- **Worm Arena: Win Probability calculation + UI improvements** (Author: Claude Sonnet 4)
  - Added win probability calculation for TrueSkill model comparisons using the normal distribution formula: P = Phi((mu1 - mu2) / sqrt(sigma1^2 + sigma2^2))
  - Created new utility module `wormArenaWinProbability.ts` with `erf`, `erfc`, `normalCDF`, and `calculateWinProbability` functions (Abramowitz & Stegun approximation, accurate to +/-1.5e-7)
  - Created new component `WormArenaWinProbability.tsx` for displaying statistical comparison between compare and baseline models
  - Win probability section positioned directly below bell curve for visual prominence
  - Formula styling increased to text-base bold black for better visibility
  - Fixed confidence interval labeling to clarify it applies to the compare model only
  - Stats boxes (Games/Wins/Losses/Ties/Cost) now labeled "Compare Model Stats" to clarify they refer to the compare model
  - Changed baseline model color from red to **green** for better visual distinction
  - **Files Created**:
    - `client/src/utils/wormArenaWinProbability.ts`
    - `client/src/components/wormArena/WormArenaWinProbability.tsx`
  - **Files Modified**:
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
    - `client/src/utils/wormArenaRoleColors.ts`
    - `CHANGELOG.md`

### Version 6.5.9  Dec 17, 2025

- **Worm Arena: Stats panel now sortable + links into deeper model analysis** (Author: Cascade)
  - Worm Arena replay page Stats panel now shows all models (scrollable) and supports sorting by win rate, games played, wins, losses, and ties.
  - Added a direct link to the deeper Stats & Placement page, and model names now link to that page with the model preselected.
  - **Files Modified**:
    - `client/src/components/WormArenaStatsPanel.tsx`
    - `client/src/hooks/useWormArenaStats.ts`
    - `CHANGELOG.md`

### Version 6.5.8  Dec 17, 2025

- **Worm Arena: only show replayable matches + fix Greatest Hits truncation** (Author: Cascade)
  - `/api/snakebench/games` now filters out DB-only matches that do not have an available replay asset, preventing broken replay clicks.
  - Improved remote replay fetch diagnostics to include HTTP status and a short response snippet.
  - Fixed the Worm Arena Greatest Hits list being cut off by switching to a simple overflow container and increasing the scroll region height.
  - Greatest Hits "View replay" now opens in a new tab/window.
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `client/src/components/WormArenaGreatestHits.tsx`
    - `docs/reference/api/SnakeBench_WormArena_API.md`
    - `CHANGELOG.md`

### Version 6.5.5  Dec 17, 2025

- **Worm Arena: DB-discovered OpenRouter models now runnable + duplicate dropdown cleanup + Gemini 3 Flash tournament script** (Author: Cascade)
  - Updated SnakeBench model allowlist to include **active, DB-discovered OpenRouter slugs** (in addition to curated config) so newly discovered models can be run immediately.
  - Canonicalized OpenRouter model IDs before de-duping in Worm Arena Live so aliases do not appear multiple times.
  - Rewrote the tournament script to run `google/gemini-3-flash-preview` vs the champion roster **both directions**, **localhost**, **one match at a time** (rate-limit safe).
  - Updated SnakeBench/Worm Arena API docs to reflect the expanded allowlist behavior.
  - **Files Modified**:
    - `server/services/snakeBenchService.ts`
    - `client/src/pages/WormArenaLive.tsx`
    - `scripts/worm-arena-tournaments/underrepresented-models-roundrobin.ps1`
    - `docs/reference/api/SnakeBench_WormArena_API.md`
    - `CHANGELOG.md`

# New entires at the top, use proper SemVer!

# New entires at the top, use proper SemVer!

### Version 6.5.7  Dec 19, 2025

- **Worm Arena Live: restore tall reasoning columns + reinstated stats strip + clearer reconnect errors** (Author: Codex (GPT-5))
  - Reasoning columns are tall again (≈46rem) with scrollable bodies so the layout matches the live board height, while the top apple scoreboard is now about half its previous height.
  - The under-board status strip brings back the round/score/alive grid and shows session IDs plus live phase, so users still see the classic streaming telemetry beneath the board.
  - If a user opens `/worm-arena/live/:sessionId` after the single-use session handshake expires, the page now stays in “live” mode and explains that current sessions cannot be rejoined mid-match.
  - **Files Modified**:
    - `client/src/pages/WormArenaLive.tsx`
    - `client/src/hooks/useWormArenaStreaming.ts`
    - `client/src/components/WormArenaReasoning.tsx`
    - `client/src/components/WormArenaLiveScoreboard.tsx`
    - `client/src/components/WormArenaLiveStatusStrip.tsx`
    - `docs/2025-12-19-worm-arena-live-refresh-plan.md`
    - `CHANGELOG.md`

### Version 6.5.6  Dec 19, 2025

- **Worm Arena Live: restore worm emoji in reasoning panels** (Author: Codex (GPT-5))
  - Replaced the mojibake `ĐY?>` placeholder with the requested 🐛 emoji so headers look correct on Windows browsers.
  - Updated the component header to document the icon change.
  - **Files Modified**: `client/src/components/WormArenaReasoning.tsx`, `CHANGELOG.md`

### Version 6.5.5  Dec 19, 2025

- **Worm Arena Live: scoreboard-first layout + inline match summary** (Author: Codex (GPT-5))
  - Apple scoreboard now pins above the live board while all other controls collapse under the board, matching the requested hierarchy.
  - Reasoning columns keep a fixed height with scrollbars, the status strip now only shows streaming context, and the match ID has a dedicated copy-able control under the board.
  - Final summaries render inline next to the final frame so viewers stay on the Live page when a match completes.
  - **Files Modified**:
    - `client/src/pages/WormArenaLive.tsx`
    - `client/src/components/WormArenaLiveScoreboard.tsx`
    - `client/src/components/WormArenaLiveStatusStrip.tsx`
    - `client/src/components/WormArenaReasoning.tsx`
    - `client/src/components/WormArenaLiveBoardPanel.tsx`
    - `client/src/components/WormArenaLiveResultsPanel.tsx`
    - `docs/2025-12-19-worm-arena-live-refresh-plan.md`
    - `CHANGELOG.md`

### Version 6.5.4  Dec 17, 2025

- **Worm Arena Skill Analysis: Comparison overlay matches poster view** (Author: CodexGPT5.1 Low)
  - Replaced the stacked bell-curve cards with a single shared SVG that overlays up to five models using the same axis math as Poster View, including dashed μ markers and color-matched fills.
  - Added an interactive legend that mirrors selection ordering, displays mu/sigma/win-loss stats, and keeps hover/focus state synchronized with the scatter plot.
  - Updated the Worm Arena stats plan to record the new progress milestone and refreshed next steps.
  - **Files Modified**:
    - `client/src/components/wormArena/stats/WormArenaMultiCurveOverlay.tsx`
    - `docs/plans/WormArenaStatsPlan.md`
    - `CHANGELOG.md`

### Version 6.5.3  Dec 17, 2025

- **Worm Arena Skill Analysis: role-based color normalization** (Author: GPT-5.2-Medium-Reasoning)
  - Color coordinated the entire Skill Analysis flow so compare model UI is blue and baseline model UI is red.
  - Model lists, snapshot cards, and the TrueSkill leaderboard picker now highlight selections using the correct role color (no green selection state).
  - Poster View hero now renders the baseline curve in red and shows both models' skill estimate and uncertainty values in role colors.
  - **Files Modified**:
    - `client/src/index.css`
    - `client/src/utils/wormArenaRoleColors.ts`
    - `client/src/components/wormArena/DataNumber.tsx`
    - `client/src/components/wormArena/stats/WormArenaModelListCard.tsx`
    - `client/src/components/wormArena/stats/WormArenaModelSnapshotCard.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
    - `client/src/components/WormArenaTrueSkillLeaderboard.tsx`
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `package.json`
    - `CHANGELOG.md`

### Version 6.5.2  Dec 17, 2025

- **Worm Arena Skill Analysis: Comparison View polish + regression hardening** (Author: GPT-5.2-Medium-Reasoning)
  - Comparison View now has stable scatter plot axes while searching (domains are computed from the full leaderboard and reused while filtering).
  - Comparison View now shows a skeleton loading state during initial leaderboard load.
  - Fixed encoding issues in comparison-view headers so mu/sigma labels render cleanly.
  - Restored and hardened the baseline selector UX so the baseline picker remains visible and the baseline snapshot does not disappear.
  - Poster View: left Compare model column now includes a Model snapshot card, and the bell curve graphic is rendered immediately under the view tabs.
  - **Files Modified**:
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillComparison.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillScatterPlot.tsx`
    - `client/src/components/wormArena/stats/WormArenaMultiCurveOverlay.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
    - `client/src/components/wormArena/stats/WormArenaModelListCard.tsx`
    - `docs/plans/WormArenaStatsPlan.md`
    - `package.json`
    - `CHANGELOG.md`

### Version 6.5.1  Dec 18, 2025

- **Worm Arena Skill Analysis: UI polish + baseline selection improvements** (Author: Cascade)
  - Removed the busy top-of-page stats strip and moved the TrueSkill leaderboard below the main 3-column analysis grid.
  - Moved the "Why TrueSkill?" explainer into a thin, centered strip at the top of the page (expandable), instead of a large block at the bottom.
  - TrueSkill leaderboard now supports sticky headers reliably and allows row-click selection to set the baseline (highlighted selection).
  - Hero graphic now uses Worm Arena typography, shows a clear "Model Snapshot [model]" heading, adds Games/Wins/Losses/Ties/Cost stat boxes, and tightens the x-axis bounds to roughly align with the 99.7% interval story.
  - **Files Modified**:
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `client/src/components/WormArenaTrueSkillLeaderboard.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
    - `CHANGELOG.md`

- **Gemini 3 Flash Preview routing parity** (Author: Codex)
  - Added the native `gemini-3-flash-preview` key to the Gemini service map and primary model catalog so the low-latency thinking tier is exposed to prompt selection and analytics.
  - Mirrored the slug across the shared model list, OpenRouter builder, and catalog (plus metadata) so BYO paths can reach the same fast reasoning model with up-to-date context/pricing data.
  - **Files Modified**:
    - `server/services/gemini.ts`
    - `server/config/models.ts`
    - `server/config/openrouterModels.ts`
    - `server/config/openrouter-catalog.json`
    - `CHANGELOG.md`

### Version 6.5.0  Dec 17, 2025

- **Worm Arena Skill Analysis: baseline picker + layout refresh** (Author: Cascade)
  - The reference model slug in the top-right snapshot is now a button: click it to clear the baseline and re-open the baseline model picker list (sorted by games played).
  - Widened the Skill Analysis layout so the left-side Models list card has enough room and no longer looks clipped.
  - **Files Modified**:
    - `client/src/components/wormArena/stats/WormArenaModelSnapshotCard.tsx`
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `CHANGELOG.md`

### Version 6.4.11  Dec 17, 2025

- **Worm Arena Skill Analysis: bell curve chart containment + layout fixes (match reference)** (Author: Cascade)
  - Bell curve SVG now reserves top/bottom margins so curves, labels, and axis ticks stay inside the poster.
  - Uses a wider ±4σ range and stable integer axis bounds so tails taper naturally instead of feeling clipped.
  - Adds a dashed vertical line at the selected model's μ and offsets labels to avoid overlap when models are close.
  - **Files Modified**:
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
    - `CHANGELOG.md`

### Version 6.4.10  Dec 17, 2025

- **Worm Arena Skill Analysis: include ALL games (stop filtering by game_type) so model graph populates** (Author: Cascade)
  - Fixes the Skill Analysis page appearing empty when replays are labeled `ladder` (or other upstream types).
  - SnakeBench analytics queries (stats/TrueSkill leaderboard/model rating) now count all games, regardless of `public.games.game_type`.
  - Replay ingest supports a `gameTypeOverride` so ARC Explainer can standardize the stored `game_type` going forward.
  - **Files Modified**:
    - `server/repositories/SnakeBenchRepository.ts`
    - `CHANGELOG.md`

### Version 6.4.9  Dec 17, 2025

- **Worm Arena Skill Analysis: reuse Stats & Placement components (global stats, leaderboard, reference placement)** (Author: Cascade)
  - Skill Analysis page now reuses the same shared stats modules as the Stats & Placement page:
    - Adds `WormArenaGlobalStatsStrip` and `WormArenaTrueSkillLeaderboard` above the existing 3-column skill analysis layout.
    - When a reference model is selected, the right column now shows `WormArenaPlacementCard` beneath the reference snapshot.
  - Fixes Skill Analysis header total games to use global stats instead of a hardcoded `0`.
  - **Files Modified**:
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `CHANGELOG.md`

### Version 6.4.8  Dec 17, 2025

- **Worm Arena Skill Analysis: unified hero graphic matching TikZ reference design** (Author: Cascade)
  - Created `WormArenaSkillHeroGraphic.tsx` — a single unified "poster" component that draws:
    - Top row: "Skill estimate μ" and "Uncertainty σ" headers with large blue pills and descriptive text
    - Middle: "99.7% Confidence Interval" with red (pessimistic) and green (optimistic) pills connected by a dash, plus explanatory KaTeX formula
    - Bottom: Overlapping SVG bell curves — gray filled reference curve behind, blue filled current curve in front, with model labels positioned above peaks
  - Removed separate `WormArenaSkillMetrics` and `WormArenaSkillDistributionChart` from center column.
  - Center column is now borderless (no Card chrome) — reads as one clean poster graphic.
  - Typography uses Georgia serif for headers matching the reference.
  - **Files Created**:
    - `client/src/components/wormArena/stats/WormArenaSkillHeroGraphic.tsx`
  - **Files Modified**:
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `CHANGELOG.md`

### Version 6.4.7  Dec 17, 2025

- **Worm Arena Skill Analysis: finished wiring + chart polish (URL selection, KaTeX math, visible axis/ticks)** (Author: Cascade)
  - Skill Analysis page (`/worm-arena/skill-analysis`) now drives selected model + reference model via URL query params (`?model=...&reference=...`).
  - Ratings on the Skill Analysis page now reliably load by explicitly calling `useModelRating().refresh()` when selection changes.
  - KaTeX math rendering (`InlineMath`) is used consistently for μ/σ/± copy, with KaTeX CSS loaded on the page.
  - Bell curve chart no longer clips tick labels; adds axis label and displays hover readout as density (not a misleading percent).
  - Worm Arena navigation now includes a "Skill Analysis" tab on Replay/Live/Matches/Stats pages.
  - **Files Modified**:
    - `client/src/pages/WormArenaSkillAnalysis.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillDistributionChart.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillMetrics.tsx`
    - `client/src/components/wormArena/stats/WormArenaSkillSelector.tsx`
    - `client/src/pages/WormArena.tsx`
    - `client/src/pages/WormArenaLive.tsx`
    - `client/src/pages/WormArenaMatches.tsx`
    - `client/src/pages/WormArenaStats.tsx`
    - `CHANGELOG.md`

### Version 6.4.6  Dec 17, 2025

- **HuggingFace union accuracy SRP/DRY refactor (shared compare service + auto-fetch hook + shared union UI)** (Author: Cascade)
  - `/scoring` refactored from a 1000+ line page into a small orchestration component composed of focused sections.
  - Introduced a shared `/api/metrics/compare` client service to centralize request-building, fetch, and error parsing.
  - Added a dedicated `useAttemptUnionComparison` hook using `@tanstack/react-query` so `/scoring` auto-fetches on dataset/model pair change.
  - Extracted `AttemptUnionCard` into a shared component and added a `variant` to preserve both dialog and `/scoring` presentations.
  - Centralized dataset display-name mapping into `client/src/constants/datasets.ts` and updated consumers.
  - **Files Created**:
    - `client/src/services/metrics/compareService.ts`
    - `client/src/hooks/useAttemptUnionComparison.ts`
    - `client/src/components/analytics/AttemptUnionCard.tsx`
    - `client/src/components/huggingFaceUnionAccuracy/UnionAccuracyHeader.tsx`
    - `client/src/components/huggingFaceUnionAccuracy/UnionAccuracyControls.tsx`
    - `client/src/components/huggingFaceUnionAccuracy/UnionAccuracyExplainers.tsx`
    - `client/src/components/huggingFaceUnionAccuracy/ProviderSystemPromptsPanel.tsx`
    - `client/src/components/huggingFaceUnionAccuracy/HarnessDetailsAccordion.tsx`
    - `client/src/constants/datasets.ts`
  - **Files Modified**:
    - `client/src/pages/HuggingFaceUnionAccuracy.tsx`
    - `client/src/pages/ModelComparisonPage.tsx`
    - `client/src/components/analytics/ModelComparisonDialog.tsx`
    - `client/src/components/analytics/ModelPerformancePanel.tsx`
    - `client/src/pages/AnalyticsOverview.tsx`
    - `client/src/pages/ModelBrowser.tsx`
    - `client/src/components/analytics/AttemptUnionCard.tsx`
    - `CHANGELOG.md`

### Version 6.4.5  Dec 16, 2025

- **Union accuracy UI: stable denominators for “Puzzles solved” and “Test pairs”** (Author: Cascade)
  - `/scoring` and related comparison UIs now use dataset-level totals (total puzzles and total test pairs) as denominators.
  - Fixes confusing displays like `1 of 1 fully correct` by showing `… of 120` for ARC2-Eval, and `… of <all test pairs>`.
  - Dataset totals are computed once (cached in-memory) from the dataset JSON files.
  - **Files Modified**: `server/repositories/ModelDatasetRepository.ts`, `server/repositories/MetricsRepository.ts`, `client/src/pages/HuggingFaceUnionAccuracy.tsx`, `client/src/pages/ModelComparisonPage.tsx`, `client/src/components/analytics/ModelComparisonDialog.tsx`, `client/src/pages/AnalyticsOverview.tsx`, `CHANGELOG.md`

### Version 6.4.4  Dec 16, 2025

- **Worm Arena Live: model dropdowns sort newest-first (DB discovered_at + releaseDate fallback)** (Author: Cascade)
  - Live match setup model dropdowns now prefer models we most recently added/discovered (SnakeBench DB `discovered_at`), then fall back to `releaseDate`, then A–Z.
  - Prevents the Live setup panel from overriding the intended ordering by re-sorting everything alphabetically.
  - **Files Modified**: `server/repositories/SnakeBenchRepository.ts`, `server/routes/models.ts`, `client/src/pages/WormArenaLive.tsx`, `client/src/components/WormArenaRunControls.tsx`, `CHANGELOG.md`

### Version 6.4.3  Dec 16, 2025

- **/scoring: add explicit union scoring explanation (task/puzzle/test-pair definitions + worked examples)** (Author: Cascade)
  - Replaced the minimal "Understanding the three metrics" blurb with a detailed, union-centric explanation.
  - Clearly defines: puzzle vs task (same thing), training pairs vs test pairs, and how the two-attempt union rule works.
  - Adds a worked 3-test-pair example showing Attempt 1, Attempt 2, and the union result per pair.
  - Adds a concrete example explaining why the official harness score (average of puzzle scores) can differ from the pair-weighted test-pairs rate (e.g., 117/166).
  - Progress bar label now explicitly states it reflects the pair-weighted rate.
  - **Files Modified**: `client/src/pages/HuggingFaceUnionAccuracy.tsx`, `CHANGELOG.md`

### Version 6.4.2  Dec 16, 2025

- **Build reliability: OpenRouter catalog sync now merges remote into local snapshot** (Author: Cascade)
  - Prevents deploy failures when OpenRouter temporarily omits a model ID that is already referenced by our `OPENROUTER_MODEL_KEYS`.
  - Sync is now best-effort: if OpenRouter fetch fails, the build keeps the existing local catalog snapshot instead of overwriting it.
  - **Files Modified**: `server/scripts/sync-openrouter-catalog.ts`, `CHANGELOG.md`

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
  - **Validation Result**: Harness-style score 71.29% (84.83/119 tasks) matches DB/UI union score 71.29% (117/166 test pairs)
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
