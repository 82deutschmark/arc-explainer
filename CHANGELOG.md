## ARC Explainer
- Use proper semantic versioning (MAJOR.MINOR.PATCH) for all changes!! Add new changes at the top!!!

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
