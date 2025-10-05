## [2025-10-05]

## v3.5.3 - Analytics Cleanup: Documentation & SQL Normalization

### Fixed
- **Documentation Accuracy** (Critical)
  - Corrected CLAUDE.md line 116: `prediction_accuracy_score` doesn't exist in database
  - Actual column name is `trustworthiness_score` (FLOAT)
  - Clarified distinction between accuracy (boolean correctness) vs trustworthiness (confidence reliability)
  - Removed misleading `prediction_accuracy_score` references from repository comments

### Enhanced
- **SQL Normalization Consistency**
  - Updated AccuracyRepository inline SQL to match `modelNormalizer.ts` logic
  - Updated TrustworthinessRepository inline SQL to match `modelNormalizer.ts` logic
  - Added sonoma-sky → grok-4-fast alias mapping to SQL CASE statements
  - Added `-beta` and `-alpha` suffix handling (previously only had `:beta`, `:alpha`)
  - Added comments linking SQL normalization to modelNormalizer.ts utility
  - Ensures database aggregation matches application-level normalization

### Context
- **Repository Clarity**
  - AccuracyRepository: Pure puzzle-solving correctness (boolean fields: is_prediction_correct, multi_test_all_correct)
  - TrustworthinessRepository: Confidence reliability (computed metric combining confidence + correctness)
  - Each repository has single, well-defined responsibility (SRP compliant)

## v3.5.2 - Model Name Normalization

### Fixed
- **Database Model Name Normalization** (Critical)
  - Normalized 438 database records to remove version suffixes and consolidate model aliases
  - Consolidated fragmented model statistics for accurate analytics
  - Mappings applied:
    - `x-ai/grok-4-fast:free` → `x-ai/grok-4-fast` (23 records)
    - `openrouter/sonoma-sky-alpha` → `openrouter/sonoma-sky` → `x-ai/grok-4-fast` (64 records - sonoma-sky was actually grok-4-fast)
    - `moonshotai/kimi-dev-72b:free` → `moonshotai/kimi-dev-72b` (153 records)
    - `deepseek/deepseek-r1-0528:free` → `deepseek/deepseek-r1-0528` (112 records)
    - `z-ai/glm-4.5-air:free` → `z-ai/glm-4.5` (22 records)
  - Total: 87 records now consolidated under `x-ai/grok-4-fast` (23 + 64)
  - Script: `server/scripts/normalize-model-names.ts`
  - Author: Claude Code using Sonnet 4.5

### Added
- **Model Normalizer Enhancements**
  - Added support for hyphen-style suffixes (`-alpha`, `-beta`)
  - Previously only handled colon-style suffixes (`:alpha`, `:beta`, `:free`)
  - Added model alias mapping: `openrouter/sonoma-sky` → `x-ai/grok-4-fast`
  - Ensures consistent normalization across all repositories
  - File: `server/utils/modelNormalizer.ts`

## [2025-10-04]

## v3.5.1 - Default Reasoning Effort Update

### Changed
- **CompactPuzzleDisplay Spacing** (UX Enhancement)
  - Increased gaps between grids for better visual clarity
  - Main container gap: gap-2 → gap-6 (between training and test sections)
  - Training examples gap: gap-3 → gap-6 (between example pairs)
  - Individual training example gap: gap-2 → gap-4 (between input/output)
  - Test cases gap: gap-3 → gap-8 (between test cases)
  - Individual test case gap: gap-2 → gap-4 (between input/output)
  - Reduces visual clutter on ModelDebate page
  - Files: client/src/components/puzzle/CompactPuzzleDisplay.tsx
  - Author: Cascade using Sonnet 4

- **ModelDebate Page Layout** (Enhancement)
  - Removed container margins, padding, and max-width constraints
  - Changed from `container mx-auto p-1 max-w-7xl` to `w-full`
  - Explanation cards now use full horizontal width of the viewport
  - Applied consistently across loading, error, and main interface states
  - Files: client/src/pages/ModelDebate.tsx
  - Author: Cascade using Sonnet 4

- **GPT-5 Reasoning Effort Default** (Enhancement)
  - Changed default `reasoningEffort` from `'low'` to `'high'` across frontend and backend
  - **Client-side**: useAnalysisResults hook now defaults to 'high' (line 62)
  - **Server-side**: OpenAI service now defaults to 'high' for both prompt preview (line 158) and API calls (line 230)
  - Also updated default `reasoningVerbosity` from 'medium' to 'high' for consistency (line 163)
  - Applies to all GPT-5 reasoning models (gpt-5-2025-08-07, gpt-5-mini-2025-08-07, gpt-5-nano-2025-08-07)
  - Users can still manually override these settings in the UI
  - Ensures maximum reasoning quality by default for GPT-5 models
  - Files: 
    - client/src/hooks/useAnalysisResults.ts (line 62)
    - server/services/openai.ts (lines 158, 163, 230)
  - Author: Cascade using Sonnet 4

## [2025-10-03]

## v3.5.0 - Bug Fixes and Deep Linking

### Added
- **Deep Linking to Specific Explanations** (Feature)
  - Users can now share direct links to specific AI explanations
  - URL format: `/puzzle/{puzzleId}?highlight={explanationId}`
  - Example: `/puzzle/0934a4d8?highlight=20779` jumps directly to explanation #20779
  - Features:
    - Auto-scroll to highlighted explanation on page load
    - Visual highlight effect (blue ring pulse for 3 seconds)
    - Copy Link button on each AnalysisResultCard
    - Toast notification when link copied to clipboard
    - Works across all pages showing explanations (Examiner, Feedback, Debate)
  - Implementation:
    - Added `id="explanation-{id}"` and `data-explanation-id` attributes to AnalysisResultCard wrapper
    - Added `scroll-mt-20` Tailwind class for proper scroll positioning
    - Added query parameter handling in PuzzleExaminer with smooth scroll behavior
    - Copy Link button uses clipboard API and toast notifications
    - Hidden in ELO mode (doesn't show for unsaved explanations)
  - Files: client/src/components/puzzle/AnalysisResultCard.tsx, AnalysisResultHeader.tsx, client/src/pages/PuzzleExaminer.tsx
  - Commit: 577ef99

### Fixed
- **"Some Incorrect" Bug - Root Cause Fixed** (CRITICAL)
  - THE BUG WAS IN THE SHARED UTILITY ITSELF - `shared/utils/correctness.ts`
  - Line 78 returned `'Some Incorrect'` for ALL multi-test failures, even 0/N correct
  - Root cause chain:
    1. Components invented their own logic (ExplanationResultsSection, AnalysisResultGrid) - FIXED in 358296d
    2. Components used shared utility (ExplanationsList, AnalysisResultListCard) - BUG PROPAGATED
    3. **The shared utility had the bug** - returning "Some Incorrect" when it should say "Incorrect"
  - Logic error: `multiTestAllCorrect === false` means "NOT all correct" (could be 0/N or some failed)
  - Without detailed validation data, cannot distinguish "all" vs "some" incorrect
  - Solution: Removed hasMultiplePredictions check, now always returns "Incorrect" for failures
  - Impact: Fixes bug in ALL components simultaneously (single source of truth)
  - Files: shared/utils/correctness.ts, ExplanationResultsSection.tsx, AnalysisResultGrid.tsx
  - Commits: 358296d (component fixes), 0cfbafa (root cause fix)

- **Multi-Test Accuracy Display** (Critical)
  - Fixed "0/2 correct" showing "Some Incorrect" instead of "Incorrect"
  - Root cause: multiTestStats fallback logic was using multiTestAverageAccuracy (calibration score) to estimate correctCount
  - Solution: Simplified logic to rely ONLY on multiTestAllCorrect boolean flag
    - When multiTestAllCorrect === false → "Incorrect" with 0 correct
    - When multiTestAllCorrect === true → "All Correct" with totalCount correct
  - Removed unreliable estimation from multiTestAverageAccuracy field
  - Files: client/src/components/puzzle/AnalysisResultCard.tsx
  - Commits: fde0dd9, 356de4f

- **Trustworthiness Badge Display**
  - Restored trustworthiness badge (predictionAccuracyScore) to AnalysisResultCard
  - Conditional display: shows only in non-ELO, non-debate, non-Saturn contexts
  - Badge shows calibration score as "Trustworthiness: X%" with color coding
  - Properly hidden in debate components and ELO mode as requested
  - Files: client/src/components/puzzle/AnalysisResultContent.tsx
  - Commit: 356de4f

- **ModelDebate Nested Scroll Box** (UX)
  - Removed nested scroll container in IndividualDebate.tsx
  - Changed from `h-[calc(100vh-280px)] overflow-y-auto` to natural page flow
  - Debate cards now display exactly like PuzzleExaminer results
  - Eliminated scroll-within-scroll pattern for better UX
  - Files: client/src/components/puzzle/debate/IndividualDebate.tsx
  - Commit: 07d4cd6

### Improved
- **AnalysisResultListCard UI Cleanup**
  - Removed trophy emoji from confidence display
  - Changed from icon-based to simple "Confidence: X%" text
  - Cleaner, less cluttered list view
  - Files: client/src/components/puzzle/AnalysisResultListCard.tsx
  - Commit: 356de4f

- **Component File Headers**
  - Added proper headers to AnalysisResultContent.tsx, AnalysisResultHeader.tsx, AnalysisResultGrid.tsx, AnalysisResultMetrics.tsx
  - Updated headers to reflect recent fixes and changes
  - Commit: fde0dd9

## [2025-10-01]

## v3.4.1 - Admin Hub Fixes

### Fixed
- **Admin Hub Quick Stats Bug** (Critical)
  - Fixed 500 error on `/api/admin/quick-stats` endpoint
  - Root cause: Controller called non-existent `getAllExplanations()` method
  - Solution: Added `countExplanations()` method to ExplanationRepository
  - Added `db` property to RepositoryService for direct SQL queries (marked deprecated)
  - All adminController errors resolved
  - Commits: c048930, c5f9fe6

- **HuggingFace Ingestion Button Not Working** (Critical)
  - Frontend button showed alert placeholder instead of triggering ingestion
  - Root cause: Missing `/api/admin/start-ingestion` backend endpoint
  - Solution:
    - Exported `ingestHuggingFaceDataset` function from ingestion script
    - Added `startIngestion()` controller function in adminController
    - Registered route in server/routes.ts
    - Implemented ingestion mutation in frontend with loading states
    - Ingestion now starts asynchronously and returns 202 Accepted
  - Files: server/scripts/ingest-huggingface-dataset.ts, server/controllers/adminController.ts, server/routes.ts, client/src/pages/HuggingFaceIngestion.tsx

### Added
- **ARC2 Research Paper Link** (Landing Page Enhancement)
  - Added prominent card on PuzzleBrowser landing page linking to ARC2 paper (https://www.arxiv.org/pdf/2505.11831)
  - Gradient purple-to-blue background for visual distinction
  - Responsive layout with BookOpen and ExternalLink icons
  - Positioned strategically below mission statement in hero section

- **About Page** (`/about`)
  - Comprehensive project information and background
  - Accessibility focus section explaining colorblindness support and emoji usage
  - Technology stack details and open source information
  - Acknowledgments for François Chollet, ARC Prize team, open source community, and users
  - Contact section with GitHub repository and issues links
  - Navigation integration with Info icon in AppNavigation
  - Fully responsive design using shadcn/ui components (Card, Button, Badge)


- **Admin Hub Dashboard** (`/admin`)
  - Centralized admin interface for all administrative operations
  - Quick stats: total models, total explanations, database status, last ingestion
  - Navigation cards to Model Management and HuggingFace Ingestion
  - Recent activity feed showing last 10 ingestion runs
  - Real-time database connection monitoring with health indicators
  - Backend API: `/api/admin/quick-stats`, `/api/admin/recent-activity`
  - Uses shadcn/ui: Card, Button, Badge, Separator, Alert

- **HuggingFace Ingestion UI** (`/admin/ingest-hf`)
  - Full-featured web interface for importing external model predictions
  - Configuration form with preset HuggingFace URLs (arcprize v1/v2 eval/training)
  - Auto-detection of ARC source from dataset URLs
  - Pre-flight validation with detailed checks:
    - URL accessibility verification
    - HF_TOKEN environment variable check
    - Database connection test
    - Sample puzzle data preview
  - Ingestion history table with sortable columns
  - Dry run mode for testing without database writes
  - Support for force overwrite and verbose logging options
  - Puzzle limit option for testing (process subset of puzzles)
  - Backend API: `/api/admin/validate-ingestion`, `/api/admin/ingestion-history`
  - Uses shadcn/ui: Card, Input, Select, Button, Checkbox, Alert, Dialog, Table, Tabs, Badge
  - Note: Actual ingestion execution (SSE streaming) prepared but requires user testing

- **Ingestion Runs Database Table** (`ingestion_runs`)
  - Tracks complete history of HuggingFace dataset ingestion operations
  - Stores: dataset name, base URL, source, total puzzles, success/fail/skip counts
  - Records: duration, accuracy percentage, dry run mode, error logs
  - Indexed by dataset name and started timestamp for efficient querying
  - Migration: Integrated into `DatabaseSchema.ts` as `createIngestionRunsTable()`
  - Auto-creates on server startup via schema initialization

- **Admin API Endpoints**
  - `GET /api/admin/quick-stats` - Dashboard statistics (models, explanations, DB status)
  - `GET /api/admin/recent-activity` - Last 10 ingestion runs for activity feed
  - `POST /api/admin/validate-ingestion` - Pre-flight validation before ingestion
  - `GET /api/admin/ingestion-history` - Complete ingestion run history
  - All endpoints include graceful handling of missing database/tables

- **Admin Routes Reorganization**
  - `/admin` → Admin Hub (new dashboard)
  - `/admin/models` → Model Management (relocated from `/model-config`)
  - `/admin/ingest-hf` → HuggingFace Ingestion UI (new)
  - `/model-config` → Preserved for backward compatibility

### Technical Details
- **SRP Compliance**: Each page has single responsibility (dashboard, model config, ingestion)
- **DRY**: Reuses existing services (PuzzleLoader, repositoryService, responseValidator)
- **shadcn/ui**: 100% shadcn/ui components, no custom UI
- **Data Mapping**: Applies same critical fixes from CLI ingestion script:
  - Uses `datasetName` for model name (not metadata.model)
  - Stores actual HF predictions in `predicted_output_grid`
  - Maps `content` → `pattern_description`
  - Maps `reasoning_summary` → `reasoning_log`
  - Maps `total_cost` → `estimated_cost`

### Changed
- Model Management moved from `/model-config` to `/admin/models` (backward compatible)
- Admin controller extended with ingestion endpoints (preserves existing recovery endpoint)

### Notes
- Database migration must be run: Execute `server/migrations/001_create_ingestion_runs.sql`
- Actual ingestion execution with SSE streaming is prepared but awaits user testing
- All new code follows established patterns and architectural principles