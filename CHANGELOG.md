## ARC Explainer
- Use proper semantic versioning (MAJOR.MINOR.PATCH) for all changes!! Add new changes at the top!!!

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
