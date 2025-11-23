## ARC Explainer
- Use proper semantic versioning (MAJOR.MINOR.PATCH) for all changes!! Add new changes at the top!!!

### Version 5.20.0

- Shared
  - Minimal reusable source-of-truth for the ten featured puzzles: added `shared/featuredPuzzles.ts` exporting `FEATURED_PUZZLE_IDS`, `FEATURED_PUZZLE_NOTES`, `FEATURED_PUZZLES`, and `getFeaturedPuzzles()`. Not wired into any page yet; intended for future imports by PuzzleBrowser and others. IDs: `65b59efc`, `e3721c99`, `dd6b8c4b`, `2ba387bc`, `14754a24`, `b457fec5`, `891232d6`, `7b5033c1`, `981571dc`, `136b0064`.

### Version 5.19.0

- Database Performance & Architecture
  - **PHASE 1: Lightweight bulk explanation status query**: Created `getBulkExplanationStatusLight()` that returns only 8 fields actually used by puzzle list UI instead of 37 heavy fields. This reduces data transfer by 99% (1.2GB → 15KB for 1600+ puzzles) and eliminates PostgreSQL temp file bloat on Railway's limited disk space. Updated `puzzleService.ts` and `puzzleOverviewService.ts` to use the lightweight method. Fixes "No space left on device" errors (`server/repositories/ExplanationRepository.ts:576-671`, `server/repositories/interfaces/IExplanationRepository.ts:173-184`, `server/services/puzzleService.ts:84`, `server/services/puzzleOverviewService.ts:190,309`).
  - **PHASE 2: Move analytics out of ExplanationRepository**: Moved `getWorstPerformingPuzzles()` from ExplanationRepository to MetricsRepository (SRP fix). This method does cross-table analytics (explanations + feedback) and computes composite scores, which is analytics work that belongs in MetricsRepository, not a CRUD repository. Updated all callers in `puzzleOverviewService.ts` to use `repositoryService.metrics.getWorstPerformingPuzzles()` (`server/repositories/MetricsRepository.ts:1252-1451`, `server/services/puzzleOverviewService.ts:190,309`).
  - **Aggressive database cleanup on startup**: Modified database maintenance to terminate ALL active/idle queries on startup (not just long-running idle transactions) to force cleanup of orphaned PostgreSQL temp files. Runs automatically every 6 hours to prevent temp file accumulation on Railway (`server/maintenance/dbCleanup.ts:81-110`).

### Version 5.18.6

- Puzzle Browser
  - **Simplified featured puzzle loading**: Removed the over-engineered 10-hook `useQuery` system and reverted to a single `usePuzzleList({})` call for the featured gallery, then deriving the curated set purely in memory from `FEATURED_PUZZLE_IDS`. This guarantees all 10 desired IDs show up when present in the global list while keeping network traffic and state minimal (`client/src/pages/PuzzleBrowser.tsx:123-135`).
  - **Header layout + community links**: Removed the CollapsibleMission header component entirely and inlined three community pills (Discord Community, ML Street Talk, and **ARC Discord Weekly Meeting** linking to `https://www.twitch.tv/professormaxhammer`) directly into the PuzzleBrowser header, aligned horizontally beside the EmojiMosaicAccent banner (`client/src/pages/PuzzleBrowser.tsx:256-299`).

### Version 5.18.5

- Puzzle Browser - **FIXED Critical Featured Puzzles Bug**
  - **FIXED**: Landing page now correctly displays all 10 featured puzzles (`65b59efc`, `e3721c99`, `dd6b8c4b`, `2ba387bc`, `14754a24`, `b457fec5`, `891232d6`, `7b5033c1`, `981571dc`, `136b0064`).
  - **What was broken**: Previous commits hallucinated a non-existent `POST /api/puzzle/list` endpoint that accepts `puzzleIds` in request body. This endpoint doesn't exist in the API (see `docs/reference/api/EXTERNAL_API.md` lines 57-60).
  - **The fix**: Replaced hallucinated endpoint with 10 individual `useQuery` calls using the correct `GET /api/puzzle/task/:taskId` endpoint. Each query explicitly fetches one puzzle with proper `queryFn` implementation (`client/src/pages/PuzzleBrowser.tsx:123-171`).
  - **Technical details**:
    - 10 individual hooks: `featured0` through `featured9`
    - Each uses `fetch('/api/puzzle/task/:taskId')` with error handling
    - Proper loading state: `featuredQueries.some(q => q.isLoading)`

### Version 5.18.4

- Puzzle Browser - Critical Presentation Fix
  - **FIXED featured puzzle loading for presentation**: The 5.18.3 implementation was creating stub/fake puzzles when featured puzzles weren't found in filtered results. Now properly fetches all 10 featured puzzles directly by ID using individual `useQuery` calls to `/api/puzzle/task/:taskId` endpoint, guaranteeing they display reliably regardless of filter state. Removed stub puzzle creation logic entirely (`client/src/pages/PuzzleBrowser.tsx:123-144`).
  - **Fixed React hooks violation**: Changed from calling `useQuery` in a loop to 10 individual hook declarations (`featured0` through `featured9`) to comply with React rules of hooks.
  - **Added dedicated loading state**: New `isFeaturedLoading` state tracks when featured puzzles are loading, independent of the advanced browser's filter results.

### Version 5.18.3

- Puzzle Browser - Critical Presentation Fixes
  - **Fixed header alignment**: Changed header layout from `justify-between` to centered flex column so the CollapsibleMission component (mission button + Discord/YouTube links) and EmojiMosaicAccent are properly aligned and centered for cleaner presentation layout (`client/src/pages/PuzzleBrowser.tsx:251`).
  - **Decoupled featured gallery from backend filters**: Stopped relying on the heavy `/api/puzzle/list` results (and `multiTestFilter`) for the featured carousel and instead fetch each tweet-aligned puzzle directly via `/api/puzzle/task/:id`. This keeps the 10 highlighted IDs (`65b59efc`, `e3721c99`, `dd6b8c4b`, `2ba387bc`, `14754a24`, `b457fec5`, `891232d6`, `7b5033c1`, `981571dc`, `136b0064`) visible regardless of advanced filter state, without fabricating stub puzzles (`client/src/pages/PuzzleBrowser.tsx:123-139`).
  - **Team attribution update**: Renamed `MIKE_NOTES` to `TEAM_NOTES` and updated all puzzle annotations to credit "the team" instead of individual attribution. Changed note header from "Team note" to "Team Notes" for consistency (`client/src/pages/PuzzleBrowser.tsx:65-86, 313-320, 535`).

### Version 5.18.1

- Puzzle Examiner
  - **Multi-test mismatch overlay now only marks model outputs**: Updated the multi-test grid rendering in `AnalysisResultGrid` so the "Show Mismatches" toggle applies the high-contrast diff mask only to the model’s predicted grids, never to the expected answer grids. This brings multi-test behavior in line with the single-test card, where the bullseye markers appear exclusively on the AI output for easier visual debugging (`client/src/components/puzzle/AnalysisResultGrid.tsx`).

### Version 5.18.0

- Hall of Fame / Human Trading Cards
  - **More prominent, clearly clickable portraits**: Enlarged contributor portraits on `HumanTradingCard` and added a subtle hover hint plus stronger cursor/hover styling so it’s visually obvious that the images can be clicked to open a zoomed-in view, without changing the existing dialog/profile routing (`client/src/components/human/HumanTradingCard.tsx`).

### Version 5.17.9

- Puzzle Browser
  - **Tweet-aligned featured gallery + Mike annotations**: Expanded the Puzzle Browser featured gallery to include every puzzle ID explicitly mentioned in Mike Knoop's ARC v2/v1 tweet (`65b59efc`, `e3721c99`, `dd6b8c4b`, `2ba387bc`, `14754a24`, `b457fec5`, `891232d6`, `7b5033c1`, `981571dc`) plus `136b0064`, and added a short "Mike note" under each featured card summarizing why that task is interesting for complexity/efficiency analysis. Also embedded his four open research questions about complexity scaling, time-on-task, search coverage, and unsolved v2 tasks into the advanced view "Working notes" section so the browser doubles as a lightweight reading list for ARC reasoning research (`client/src/pages/PuzzleBrowser.tsx`).

### Version 5.17.8

- Puzzle Browser
  - **Curated featured gallery + gated research view**: Updated `PuzzleBrowser` so the default experience shows a small curated gallery of four visually interesting puzzles (`14754a24`, `b457fec5`, `891232d6`, `136b0064`) using the new professional `PuzzleCard` layout, while the full heavy filter/search browser (with hundreds of cards and rich metrics) is now behind an explicit "Open full research browser" toggle. This keeps the new card design but prevents the landing page from trying to render thousands of cards at once (`client/src/pages/PuzzleBrowser.tsx`).

### Version 5.17.7

- Data
  - **Jack Cole Hall of Fame imagery update**: Added multiple profile images (`/jackcole.jpeg`, `/jackCole2.png`) to both Jack Cole contributor entries so Human Trading Cards can rotate between his assets without manual database edits (`server/scripts/seedContributors.ts`).

### Version 5.17.6

- Data
  - **Separated JF Puget 2024 vs 2025 achievements in Hall of Fame seed data**: Cleaned up the Jean-François Puget `competition_winner` entry so it is a 2025-only card for the preliminary ARC Prize 2025 Kaggle leaderboard, leaving the 2024 runner-up paper recognized solely by his dedicated `paper_award` card. This avoids mixing paper-award and competition contexts in a single entry (`server/scripts/seedContributors.ts`).

### Version 5.17.5

- Hall of Fame
  - **2025 Leaderboard now respects year ranges**: Updated `HumanTradingCards` leaderboard logic so contributors whose active range spans 2025 (e.g., yearStart 2024, yearEnd 2025) are included in the "2025 Leaderboard" section instead of being omitted. This ensures Jean-François Puget appears in the 2025 row alongside other preliminary ARC Prize 2025 leaders while still retaining his 2024 entries (`client/src/pages/HumanTradingCards.tsx`).

### Version 5.17.4

- Bug Fixes
  - **PuzzleCard & PuzzleDBViewer TypeScript alignment**: Extended `PuzzleCardProps.performanceData` to include the full set of rich metrics returned by the worst-performing puzzles API (confidence, feedback, composite score, token/cost fields, etc.) and added `formatNumber` / `formatTime` helpers to `PuzzleDBViewer` so unsolved puzzle metrics render correctly without TS build errors (`client/src/components/puzzle/PuzzleCard.tsx`, `client/src/pages/PuzzleDBViewer.tsx`).

- Models
  - **Gemini 3 Pro Preview streaming disabled for reasoning safety**: Changed `supportsStreaming` from `true` to `false` for `google/gemini-3-pro-preview` so the app no longer attempts streaming calls that can truncate reasoning tokens in multi-turn tool-calling scenarios, keeping behavior consistent with the existing `supportsStructuredOutput: false` safeguard (`server/config/models.ts`).

- Data
  - **Jean-François Puget Hall of Fame imagery update**: Updated contributor seed data to support a second profile image for JF Puget so Human Trading Cards can rotate between multiple assets without manual database edits (`server/scripts/seedContributors.ts`).

### Version 5.17.3

- Unsolved Puzzle Viewer
  - **Always load ALL unsolved evaluation puzzles**: Increased the `GET /api/puzzle/worst-performing` limit cap from 50 to 500 so `PuzzleDBViewer` can request the full ARC2-Eval (≈120) and ARC1-Eval (≈400) zero-accuracy sets in one shot (`server/controllers/puzzleController.ts:getWorstPerformingPuzzles`).
  - **Removed infinite cache on worst-performing hook**: Dropped `staleTime: Infinity` from `useWorstPerformingPuzzles` so each visit to the Unsolved ARC Evaluation Puzzles page triggers a fresh worst-performing calculation while still disabling noisy refetch-on-focus/interval (`client/src/hooks/usePuzzle.ts`).

### Version 5.17.2

- UI/UX - Model Selection Density Overhaul
  - **Fixed "ping-pong effect" and wasted space**: Constrained Model Selection container width with `max-w-4xl mx-auto` to eliminate excessive horizontal stretching that forced users' eyes to travel across the full viewport (`client/src/pages/PuzzleExaminer.tsx:405`).
  - **Removed filter UI completely**: Eliminated Premium, Fast, and Reasoning filter toggles per user feedback - this is a research platform, not an e-commerce site (`client/src/components/puzzle/ModelSelectionControls.tsx`, `client/src/components/puzzle/ModelSelection.tsx`).
  - **Professional research platform density**: Systematically tightened spacing throughout the model selection hierarchy:
    - Reduced provider header padding from `p-4` to `p-3`, icon size from `text-2xl` to `text-xl`, title from `text-lg` to `text-base`
    - Reduced vertical spacing: `space-y-3` → `space-y-2`, `space-y-6` → `space-y-3`, `mt-3` → `mt-2`
    - Tightened model grid gaps from `gap-2` to `gap-1.5` and family dividers from `gap-3` to `gap-2`
    - All changes focused on eliminating the "empty ribbon" effect and improving information density

- Models
  - **Added Google Gemini 3 Pro Preview via OpenRouter**: Integrated the newest Gemini model (released Nov 18, 2025) with 1,048,576 token context window and tiered pricing structure ($2-$4/M input tokens, $12-$18/M output tokens based on context length ≤200K vs >200K).
    - **Model Configuration** (`server/config/models.ts:812-830`)
      - Key: `google/gemini-3-pro-preview`, premium tier, reasoning-capable
      - **Critical fields**: `supportsStructuredOutput: false` (prevents JSON mode conflicts with reasoning), `supportsStreaming: true`
      - Special note about preserving `reasoning_details` in multi-turn tool calling per OpenRouter docs
    - **UI Organization** (`shared/modelGroups.ts:227-235`)
      - Created dedicated "Google Gemini" family within OpenRouter provider group (id: `or-gemini`)
      - Reorganized existing `google/gemini-2.5-flash-preview-09-2025` from `or-other` into new `or-gemini` family

- Infrastructure Fixes (Critical for Reasoning Models)
  - **OpenRouter Service: Reasoning Token Extraction** (`server/services/openrouter.ts:300-330`)
    - **Fixed missing reasoning token metrics**: Now extracts `usage.output_tokens_details.reasoning_tokens` from API responses (was previously discarded)
    - Accumulates reasoning tokens across continuation calls for truncated responses
    - Logs reasoning token usage for accurate cost tracking and analytics
  - **OpenRouter Service: Multi-Turn Reasoning Preservation** (`server/services/openrouter.ts:322-330`)
    - **Added `reasoning_details` extraction**: Captures structured reasoning blocks required for multi-turn tool calling conversations
    - Preserves reasoning continuity across tool use and conversation turns (per OpenRouter documentation requirement)
    - Enables proper context maintenance for Gemini 3 Pro and other reasoning models
  - **OpenRouter Service: Token Usage Pipeline** (`server/services/openrouter.ts:75-80, 348-354, 540-561`)
    - Added `usage` parameter throughout API call → parser → response pipeline
    - Returns actual API usage data (input/output/reasoning tokens) instead of estimates
    - Fixes token tracking accuracy for all OpenRouter models

- Bug Fixes
  - **Reasoning models + JSON mode conflict**: Setting `supportsStructuredOutput: false` prevents schema enforcement from truncating reasoning tokens (matches Qwen thinking model pattern at line 430)

### Version 5.17.1

- Data
  - Extended Jean-François Puget Hall of Fame contributor entry to mention his ARC Prize 2024 runner-up paper award for "A 2D nGPT Model For ARC Prize" and added Kaggle discussion + PDF links in the contributors seed script (`server/scripts/seedContributors.ts`).
  - Added a separate 2024 paper-award contributor card for Jean-François Puget so his 2D nGPT ARC Prize paper appears in the Research & Awards section.

### Version 5.17.0

- UI/UX Major Redesign - Professional Research Platform Transformation
  - **PuzzleCard complete redesign**: Transformed from "purple cartoon nightmare" to professional, information-dense scientific research platform (`client/src/components/puzzle/PuzzleCard.tsx`)
    - **Removed**: 5 rainbow gradients, 4 emojis (❌🔥✅💰), 36px border radius, heavy animations, 28px padding
    - **Added**: shadcn/ui Card + Badge components, automatic dark/light theme support via CSS variables
    - **Layout**: Compact side-by-side grid+metrics (~200-250px tall, down from ~500px = 2.5x information density)
    - **Metrics**: 6-point tabular display (Correctness, Attempts, Models, Grid, Tests) with `text-[10px]` labels
    - **Theme support**: Uses CSS variables (`bg-card`, `text-card-foreground`, `border`, `text-muted-foreground`) for automatic theme adaptation
    - **Design inspiration**: arXiv.org, Google Scholar, GitHub, Nature Journal (professional scientific platforms)
  - **PuzzleBrowser grid improvements**: Updated responsive breakpoints for compact cards (`client/src/pages/PuzzleBrowser.tsx:418`)
    - Mobile: 1 column | sm: 2 | md: 3 | xl: 4 | 2xl: 5 columns (new!)
    - Gap increased to 12px (`gap-3`) for compact card spacing
    - Shows 2.5x more puzzles per viewport
  - **Scalability**: Design pattern reusable across PuzzleExaminer and other puzzle list views using shadcn/ui primitives

- Bug Fixes
  - **PuzzleCard correctness display for unsolved puzzles**: Fixed misleading "Solve Rate: 0%" on PuzzleDBViewer (which shows only unsolved puzzles) by implementing context-aware display (`client/src/components/puzzle/PuzzleCard.tsx:157-167`)
    - Shows "Never Tried" for puzzles with 0 attempts
    - Shows "Unsolved" for puzzles with failed attempts (0% accuracy)
    - Shows "X% Solved" only when accuracy > 0
  - **PuzzleBrowser junk sort modes removed**: Deleted confidence, cost, and created_at sort options that had no basis in aggregated metrics (`client/src/pages/PuzzleBrowser.tsx:121-125, 333-338`)
    - Kept useful sorts: unsolved_first (recommended), unexplained_first, least_analysis_data, processing_time
  - **PuzzleBrowser Trading Cards banner removed**: Deleted promotional banner for cleaner, focused research interface (`client/src/pages/PuzzleBrowser.tsx`)

- Documentation
  - **Professional redesign plan**: Created comprehensive 1,301-line design specification documenting transformation from cartoon to scientific aesthetic (`docs/2025-11-21-puzzlecard-professional-redesign-plan.md`)

### Version 5.16.8

- Planning
  - **PuzzleDBViewer metrics + grid fix plan**: Captured the backend/frontend steps to replace the hallucinated solve rate with binary correctness, surface real model counts, and keep TinyGrid previews readable for extreme aspect ratios (`docs/2025-11-20-puzzledbviewer-metrics-fix-plan.md`).

### Version 5.16.7

- Bug Fixes
  - **Puzzle Examiner color-only toggle now fully hides digits**: Fixed the memoization dependencies in `PuzzleGrid` so `showColorOnly` is included in the `gridContent` `useMemo`. This ensures grid cells re-render when color-only mode is toggled, allowing `GridCell` to correctly render transparent text and `null` content without stray numeric glyphs leaking through the UI (`client/src/components/puzzle/PuzzleGrid.tsx`).

### Version 5.16.6

- UI/UX & Metrics
  - **PuzzleDBViewer white theme**: Replaced the dark slate layout with a clean white page, light borders, and compact spacing so unsolved ARC evaluation puzzles are easier to scan at a glance (PuzzleDBViewer.tsx). Header, filters, and ARC2/ARC1 sections now match the rest of the app’s light styling while keeping ARC2-Eval as the clearly marked primary focus.
  - **Puzzle preview stats cleanup**: Simplified PuzzleCard metrics to only show grounded, research-relevant stats: solve rate (clamped 0–100%), total attempts, unique models tested, test-case mode (single vs multi), grid size, dataset, and optional cost badge (PuzzleCard.tsx). Removed confidence/trustworthiness badges and any paths that could surface >100% style percentages.
  - **Backend accuracy clamp**: Normalized aggregated `avgAccuracy` in the worst-performing puzzles query to always live in [0,1] before sending to the UI, so no combination of database state can produce impossible solve rates (ExplanationRepository.getWorstPerformingPuzzles).

### Version 5.16.6

- Bug Tracking
  - **Puzzle Examiner color-only toggle still leaking digits**: Despite routing `showColorOnly` through `PuzzleGrid`/`GridCell`, the rendered cells continue to display numeric glyphs in the browser. Latest attempt hides the React content in `GridCell.tsx` (returns `null` + accessibility label), but the UI still shows numbers. Needs follow-up to inspect any inherited styles or additional layers painting the digits (e.g., CSS pseudo-elements, DaisyUI utilities) before the feature can ship.

### Version 5.16.5

- Features
  - **Puzzle Examiner color-only grids**: Added a dedicated “Show Colors Only” toggle beside the emoji button so users can hide numeric labels and focus on raw palette comparisons (PuzzleExaminer.tsx, PuzzleHeader.tsx). The button automatically disables while in emoji mode, and the new state propagates through PuzzleGridDisplay → PuzzleGrid → GridCell so every training/test grid now supports color-only rendering plus accessible screen reader labels. Updated PuzzleGrid props/types to keep Saturn Visual Solver and other consumers compiling cleanly.

### Version 5.16.4

- UI/UX Improvements
  - **PuzzleDBViewer major UI overhaul**: Drastically reduced wasted vertical space (~400-450px saved) by redesigning the entire page layout
    - Replaced massive gradient header Card (~200px) with compact dark theme header (~50px) matching PuzzleBrowser style (PuzzleDBViewer.tsx:335-353)
    - Condensed bloated filter Card (~120px) into single compact inline row with minimal padding (PuzzleDBViewer.tsx:355-378)
    - Removed all gradient backgrounds from ARC2/ARC1 section Cards, replaced with clean dark theme borders (lines 402-428, 450-492)
    - Reduced section header text from `text-2xl` to `text-sm uppercase` and badge sizes from `text-base px-4 py-2` to `text-xs px-2 py-0.5`
    - Changed container padding from `p-6 space-y-6` to `pb-3 pt-2 px-2 gap-2` for consistency with PuzzleBrowser
    - Reduced grid gaps from `gap-3` to `gap-2` throughout
  - **PuzzleDBViewer new features**: Added visual puzzle grid cards below pill lists
    - Imported and integrated PuzzleCard component from PuzzleBrowser (PuzzleDBViewer.tsx:30)
    - Added PuzzleCard grid display (first 12 puzzles) below ARC2 evaluation pills with lazy-loaded TinyGrid previews (lines 430-442)
    - Added PuzzleCard grid display (first 12 puzzles) below ARC1 evaluation pills (lines 477-489)
    - Provides visual puzzle structure inspection without leaving the database browser
  - **PuzzleDBViewer navigation improvements**: All ClickablePuzzleBadge components now open puzzles in new tabs via explicit `openInNewTab={true}` prop (lines 425, 472) for better research workflow

### Version 5.16.3

- Bug Fixes
  - **Grok 4.1 Fast visibility & dedupe in analytics**: Fixed `normalizeModelName` so historical Grok 4 / Grok 4.1 aliases (including OpenRouter-specific names with `-attemptN` suffixes) correctly normalize to their canonical keys (`x-ai/grok-4-fast`, `x-ai/grok-4.1-fast`) without dropping the attempt suffix, and updated `MetricsRepository.combineModelComparisons()` to use the normalized accuracy/trustworthiness/feedback/cost maps. This makes Grok 4 / Grok 4.1 appear under single, consistent rows in the model comparison dashboards instead of being split or disappearing.

### Version 5.16.2

- Bug Fixes
  - **PuzzleDB Viewer build failure**: Repaired `client/src/pages/PuzzleDBViewer.tsx` by restoring the missing ARC1 filter memo plus the required UI/icon imports, eliminating the stray switch `case` that esbuild flagged so the Vite build can complete again.

### Version 5.16.1

- Bug Fixes
  - **Grok model normalization for analytics dashboards**: Updated `MetricsRepository.combineModelComparisons()` to rely on the shared `normalizeModelName` helper instead of preserving raw model names, and tightened `normalizeModelName` itself so OpenRouter aliases like `openrouter/sonoma-sky` and historical `openrouter/sherlock-think-alpha*` entries all collapse into their canonical Grok counterparts (`x-ai/grok-4-fast`, `x-ai/grok-4.1-fast`) in the cross-model matrix and comprehensive dashboard. This removes duplicate or missing Grok rows from analytics views while keeping underlying database rows unchanged.

### Version 5.16.0

- Features
  - **PuzzleDB Viewer & PuzzleCard refresh**: rebuilt `client/src/pages/PuzzleDBViewer.tsx` around unsolved ARC evaluation puzzles using shadcn/ui cards/badges, dataset badges, search + lazy TinyGrid previews, and a simpler action flow, while `client/src/components/puzzle/PuzzleCard.tsx` now surfaces many performance metrics (models attempted, cost, accuracy/correctness signals) so researchers can spot hard puzzles at a glance.
  - **PuzzleTradingCards filters & sorts**: prioritized ARC2/ARC1 evaluation sources, added the "All Evaluation" combined filter, and replaced imaginary "difficulty" labels with accuracy-based performance buckets plus new sorts tuned to LLM defeats (`client/src/pages/PuzzleTradingCards.tsx`).

- Bug Fixes
  - **Binary correctness for zero-accuracy filters**: `server/repositories/ExplanationRepository.ts` now counts explanations using `is_prediction_correct`/`multi_test_all_correct` so PuzzleDB Viewer reliably surfaces puzzles with zero correct explanations, aligning with the documented correctness pattern.

- Documentation
  - Added the PuzzleDB Viewer & PuzzleCard redesign plan so future contributors understand the intended research-focused UX (`docs/2025-11-20-puzzledb-and-puzzlecard-redesign-plan.md`).
  - Captured the Correctness Logic Pattern guide that explains how to aggregate single- and multi-test correctness flags without mixing metrics (`docs/reference/database/CORRECTNESS_LOGIC_PATTERN.md`).

### Version 5.15.1

- Bug Fixes / Performance
  - **Database Query Optimization**: Fixed PostgreSQL temporary disk space overflow on `/api/puzzles/stats` endpoint
    - Replaced expensive `STRING_AGG` operations with `COUNT(DISTINCT)` for model aggregation (ExplanationRepository.ts:908-1000)
    - Changed `modelsAttempted` from string array to `modelsAttemptedCount` number across frontend/backend
    - Changed `reasoningEfforts` from string array to `reasoningEffortsCount` number
    - Updated TypeScript interfaces: `PuzzlePerformanceSnapshot` (usePuzzleStats.ts:34-37), `PuzzlePerformanceData` (usePuzzleDBStats.ts:32-34)
    - Updated UI components to display counts instead of badges: PuzzleTradingCard, DifficultPuzzlesSection, PuzzleDBViewer
    - Dramatically reduced temp disk usage - query now processes 4000+ puzzles without overflow
    - Files modified: ExplanationRepository.ts, puzzleOverviewService.ts, usePuzzleStats.ts, usePuzzleDBStats.ts, puzzleCardHelpers.ts, PuzzleTradingCard.tsx, DifficultPuzzlesSection.tsx, PuzzleDBViewer.tsx

- Features
  - **Automated Database Maintenance**: Added comprehensive maintenance system with zero manual intervention required
    - Created `DatabaseMaintenance` class with automated cleanup tasks (server/maintenance/dbCleanup.ts):
      * Logs temp file statistics (count & size via `pg_ls_tmpdir()`)
      * Terminates idle queries stuck >5 minutes (`pg_terminate_backend`)
      * Forces PostgreSQL CHECKPOINT to clean orphaned temp files
      * Runs VACUUM ANALYZE on key tables (explanations, feedback, puzzles)
      * Reports database size, connection statistics, and space reclaimed
    - Integrated maintenance into server lifecycle (server/index.ts:117-136):
      * Runs automatically on startup after database initialization
      * Scheduled to run every 6 hours via `setInterval`
      * Non-blocking error handling (won't crash server)
    - Added manual execution script with detailed reporting (server/scripts/run-maintenance.ts)
    - Added npm script: `npm run db:maintenance` (package.json:14)
    - Deployment: No SSH access needed - maintenance runs automatically on every deploy
    - Monitoring: Check logs for `db-maintenance` and `maintenance-script` tags

- Documentation
  - Created comprehensive implementation guide: `docs/2025-11-21-postgres-temp-disk-fix.md`
    - Root cause analysis of temp disk overflow
    - Before/after query comparisons
    - All file changes with line numbers
    - Automated maintenance system documentation
    - Monitoring and troubleshooting guide

### Version 5.15.0

- Features
  - **PuzzleBrowser**: Added solved status tracking across backend and frontend
    - Added `isSolved` field to `BulkExplanationStatus` interface (IExplanationRepository.ts:165)
    - Updated `ExplanationRepository.getBulkExplanationStatus()` with SQL subquery to calculate solved status based on correct predictions (ExplanationRepository.ts:495-509)
    - Added `isSolved` to `EnhancedPuzzleMetadata` interface (puzzleService.ts:36, PuzzleBrowser.tsx:42)
    - Implemented new 'unsolved_first' sort with 3-tier priority system (PuzzleBrowser.tsx:98-112):
      1. Attempted but unsolved (highest research value)
      2. Solved puzzles
      3. Never attempted (lowest priority)
    - Changed default sort from 'unexplained_first' to 'unsolved_first' (PuzzleBrowser.tsx:51)
    - Added "Unsolved first (attempted) - recommended" dropdown option (PuzzleBrowser.tsx:333)

  - **PuzzleDBViewer**: Major UI overhaul for compact, efficient layout
    - Added TinyGrid puzzle previews with lazy-loaded IntersectionObserver pattern (PuzzleDBViewer.tsx:99-241)
    - Created new `CompactPuzzleCard` component with 64px grid preview showing first training example
    - Reduced card padding from `p-4` to `p-2` (50% space reduction)
    - Compacted metrics to `text-xs` grid layout with minimal spacing (`gap-1`)
    - Changed badges to `badge-sm` and buttons to `btn-xs` for tighter layout

- Refactoring / Cleanup
  - **PuzzleDBViewer**: Removed "Database Overview" card that wasted ~200px showing 4 trivial statistics (PuzzleDBViewer.tsx:928-962 deleted)
  - **PuzzleDBViewer**: Completely removed "Humble AI" categorization (arbitrary <80% confidence threshold with no scientific basis)
    - Removed from `getPuzzleInterestLevel()` priority system (PuzzleDBViewer.tsx:27-46)
    - Removed 'humble' sort option from dropdown (line 847)
    - Removed 'humble' case from sort logic (line 173)
    - Removed `humbleOnly` filter state and logic (lines 100, 143-145)
    - Removed `humble` count from aggregateStats (lines 269, 307)
    - Removed "Humble AI" card from difficulty distribution (lines 485-489)
    - Removed "Most Humble" comparative highlight (lines 643-657)
    - Removed from useMemo dependencies (line 195)
  - **PuzzleDBViewer**: Condensed filter section with DaisyUI compact classes
    - Search bar: Horizontal layout with `input-sm` and `btn-sm` (lines 773-798)
    - Sort/dataset dropdowns: Inline with `select-sm` (lines 800-856)
    - Checkboxes: Changed to `checkbox-xs` and inlined for space efficiency
    - Reduced overall spacing with `gap-3` instead of `gap-4`

- Documentation
  - Created `/docs/2025-11-20-add-solved-filter-plan.md` with 8-step implementation plan for PuzzleBrowser solved status
  - Created `/docs/2025-11-20-enhance-database-viewer-solved-status.md` with enhancement plan for PuzzleDBViewer
  - Created `/docs/2025-11-20-fix-database-viewer-ui-bloat.md` with detailed 6-step UI bloat fix plan including TinyGrid preview pattern

### Version 5.14.3

- Repo / Tooling
  - Updated `arc-agi-benchmarking` git submodule to point to `https://github.com/82deutschmark/arc-agi-benchmarking` instead of `https://github.com/arcprize/arc-agi-benchmarking`.

### Version 5.14.2

- Refactoring
  - Added client-side redirect component from `/human-cards` to `/hall-of-fame` to prevent broken links and preserve backwards compatibility

### Version 5.14.1

- Bug fixes
  - Fixed Jeremy Berman contributor card to display "High Score" badge without rank indicator
  - Removed rank display from 2024 ARC Prize winner cards (Daniel Franzen, Guillermo Barbadillo) for cleaner card presentation

- Refactoring
  - Renamed `/human-cards` endpoint to `/hall-of-fame` for better semantic clarity
  - Updated navigation, routes, and sitemap to reflect new endpoint URL

- Docs
  - Added `docs/reference/database/MULTI_TEST_CORRECTNESS_GUIDE.md` describing the multi-test correctness pipeline, field semantics, and UI/display patterns for future maintainers.

### Version 5.14.0

- LLM Reasoning docs
  - Added `/llm-reasoning` explainer page and `/llm-reasoning/advanced` research-style article.
  - Linked advanced article from the basic explainer header.

- Top navigation refactor (ARC-3 & Misc)
  - Replaced hover-based `NavigationMenu` dropdowns with click-to-open `DropdownMenu` components.
  - Fixed dropdown alignment and viewport so ARC‑3 / Misc menus open directly under their tabs and are no longer clipped by header overflow.
  - Reorganized navigation into grouped menus for ARC‑3 experiences and Misc tools with clearer active‑route highlighting.

- Analytics, SEO & AEO
  - Added sitemap, robots, and `llms.txt` plus canonical metadata and JSON‑LD to improve web and LLM discoverability.
  - Introduced model origin badges and labels in Analytics to distinguish official ARC Prize leaderboard runs from community runs.
  - Clarified evaluation harness copy and how analytics are generated from the shared ARC‑AGI benchmarking harness.

- Correctness & metrics fixes
  - Overhauled correctness logic across Accuracy, Trustworthiness, ModelDataset, and Metrics query helpers to correctly handle single vs multi‑prediction runs, NULLs, and JOIN duplication.
  - Updated trading card win‑rate and difficulty display to use consistent correctness semantics and percentage formatting.

- Contributors backend
  - Refactored `ContributorRepository` to extend `BaseRepository` and integrated it via `RepositoryService` and a new `contributorController`, fixing crashes on `/api/contributors` endpoints and aligning with the standard repository/controller pattern.
