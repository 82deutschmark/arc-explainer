<!--
  CHANGELOG.md
  What: Release notes for ARC-AGI Puzzle Explorer.
  How: Documents features, fixes, and credits. This entry covers Custom Prompt support.
 Author (docs): GPT-5 (low reasoning)
-->

 
August 21, 2025

## Version 1.4.3 — GPT-5 Responses API Migration Complete (2025-08-21)

### OpenAI GPT-5 Models Fixed
- **GPT-5 Responses API Migration (Code by Claude Code)**: Completed migration plan phases 1-7, fixing GPT-5 model routing issues
  - **Model Name Correction**: Fixed GPT-5 model name mappings in `server/services/openai.ts` (`gpt-5` → `gpt-5-2025-08-07`, etc.)
  - **Responses API Parameters**: Added required `store: true` and `include: ["reasoning.encrypted_content"]` parameters
  - **Migration Plan Complete**: All phases from `docs/OpenAI_Responses_Migration_Plan_2025-08-20.md` implemented
  - **Chat Completions Deprecated**: Confirmed all OpenAI calls use Responses API, Chat Completions fully removed
  - **GPT-5 Models Working**: gpt-5-2025-08-07, gpt-5-mini-2025-08-07, gpt-5-nano-2025-08-07, gpt-5-chat-latest now properly routed

## Version 1.4.2 — API Call Logging Plan (2025-08-21)

### Comprehensive API Logging Strategy
- **Enhanced API Logging Plan (Code by Claude Code)**: Built upon Cascade's excellent foundation with complete implementation strategy
  - **Security Audit**: ✅ Confirmed no test answers leaked to AI - only test input images sent to OpenAI
  - **UI Components**: Designed API timeline, statistics cards, and tabbed interface for rich data display
  - **Data Sanitization**: Enhanced redaction policies and automatic answer filtering
  - **Implementation Roadmap**: 4-week phased rollout with security-first approach
  - **Documentation**: `docs/Enhanced_API_Logging_Implementation_Plan.md` with UI components and security hardening

### Foundation Documentation
- **Capturing API Call Logs Plan (Code by Cascade)**: `docs/Capturing_API_Call_Logs_Plan_2025-08-21.md` detailing end-to-end capture of API request/response snapshots with strict redaction and feature flags.
  - Components: `server/python/saturn_wrapper.py`, `solver/arc_visual_solver.py`, `server/services/{openai.ts, anthropic.ts, pythonBridge.ts, saturnVisualService.ts, dbService.ts}`.
  - Events: `api_call_start` / `api_call_end`; persisted via `saturnEvents` and optionally `provider_raw_response` (gated by `RAW_RESPONSE_PERSIST`).
  - Security: no API keys or raw chain-of-thought; size caps and truncation applied.

August 20, 2025

## Version 1.4.1 — Saturn Autonomous Operation Fix (2025-08-20)

### Critical Saturn Architecture Fix
- __Saturn Prompt Template Bypass (Code by Claude Code)__: Fixed critical issue where Saturn solver was incorrectly using application prompt templates instead of operating autonomously
  - **Root Cause**: Saturn was calling OpenAI service with `'standardExplanation'` template instead of its own custom prompt
  - **Solution**: Modified Saturn to use `'custom'` prompt mode with its own `buildPuzzlePrompt()` method
  - **Impact**: Saturn now operates fully independently without template dependencies
  - **Architecture Compliance**: Maintains Saturn's design principle as an autonomous visual reasoning module
  - **Documentation**: Added comprehensive `docs/Saturn_Autonomous_Operation_Plan.md` detailing the fix and architectural principles

### Technical Implementation
- **Backend**: Modified `server/services/saturnVisualService.ts:192-204` to remove inappropriate AI logic
- **Frontend**: Redesigned `client/src/pages/SaturnVisualSolver.tsx` for pure Python wrapper display
  - **Removed**: Redundant "Reasoning Analysis" section that duplicated Python output
  - **Enhanced**: Terminal-style Python log display with dark theme and improved formatting
  - **Improved**: Single-column layout focused on Python solver transparency
  - **Added**: Collapsible puzzle details to reduce visual clutter
- **Documentation**: Created comprehensive purity plan at `docs/Saturn_Python_Wrapper_Purity_Plan.md`

### Bug Fixes
- __Confidence Type Normalization (Code by Cascade)__: Fixed Postgres error `invalid input syntax for type integer: "0.5"` when saving Saturn results.
  - **Root Cause**: `explanations.confidence` is INTEGER, but Saturn was producing fractional values (e.g., 0.5).
  - **Fix**: Normalized confidence to integer percent (0–100) in both Saturn Responses and Visual paths.
    - Updated `server/services/saturnVisualService.ts`:
      - `calculateConfidenceFromReasoning()` now returns clamped integer percent.
      - Final event handler now converts 0..1 confidences to 0..100 before persistence.
  - **Result**: DB inserts succeed; UI and stats continue to read integer confidence values.

## Version 1.4.0 — Saturn Visual Solver Complete Redesign (2025-08-20)

### Critical OpenAI Responses API Integration Fixes
- __Fixed OpenAI Responses API Integration (Code by Claude Code)__: Resolved critical parsing and streaming issues with OpenAI's Responses API
  - **Fixed Response Data Extraction**: Corrected Saturn service to properly extract `reasoningLog`, `reasoningItems`, and `providerResponseId` from OpenAI service responses
  - **Enhanced WebSocket Streaming**: Fixed reasoning data streaming to properly handle structured reasoning items and display them in real-time
  - **Robust Data Type Handling**: Added proper type checking and fallbacks for reasoning items (string, object, or array formats)
  - **Database Integration**: Fixed persistence of new Responses API fields (`providerResponseId`, `reasoningItems`, `providerRawResponse`)
  - **Improved Error Handling**: Enhanced error logging and debugging for Responses API calls with detailed field inspection

### Major UI/UX Overhaul
- __Complete Saturn Visual Solver Redesign (Code by Claude Code)__: Completely redesigned the Saturn Visual Solver page for better clarity and user experience
  - **Streamlined Single-Column Layout**: Replaced complex two-column grid with clean, focused single-column design
  - **Enhanced Status Overview**: Added detailed phase explanations, progress indicators with color coding, and real-time timing information
  - **Collapsible Puzzle Details**: Made puzzle overview collapsible to reduce visual clutter while maintaining accessibility
  - **Improved Progress Explanations**: Added comprehensive phase descriptions explaining what Saturn is doing during each step
  - **Real-Time Timing Display**: Shows elapsed time and estimated remaining time with automatic updates

### Backend Performance & Reliability
- __Extended Timeout Management (Code by Claude Code)__: Enhanced Saturn analysis timeout handling for long-running tasks
  - **Configurable Timeout**: Increased default timeout from 30 to 60 minutes with SATURN_TIMEOUT_MINUTES environment variable support
  - **Warning System**: Added 75% timeout warnings to notify users of approaching time limits
  - **Proper Cleanup**: Improved timeout and warning handle cleanup to prevent memory leaks
  - **Better Error Messages**: Enhanced timeout messages with configuration guidance

### Real-Time Reasoning Display
- __Live Reasoning Log Streaming (Code by Claude Code)__: Added comprehensive reasoning log display and streaming capabilities
  - **WebSocket Reasoning Streams**: Modified backend to stream reasoning logs in real-time via WebSocket
  - **Dual-Panel Layout**: Split output into "System Output" and "Reasoning Analysis" for better organization
  - **Reasoning History**: Track and display all reasoning steps throughout the analysis process
  - **Current Step Highlighting**: Prominently display the current reasoning step with visual emphasis

### Enhanced Console Output
- __Structured Log Display (Code by Claude Code)__: Completely revamped console output with intelligent categorization and formatting
  - **Log Level Detection**: Automatic categorization (ERROR, WARN, INFO, DEBUG, SATURN, SUCCESS) with color coding
  - **Timestamp Integration**: Added real-time timestamps for all log entries
  - **Visual Indicators**: Color-coded log levels with appropriate background highlighting
  - **Message Cleaning**: Intelligent removal of redundant prefixes for cleaner display
  - **Progress Indicators**: Enhanced running status indicators with better visual feedback

### OpenAI Responses API Integration
- __Complete Responses API Implementation (Code by Claude Code)__: Migrated Saturn from basic ChatCompletions to structured Responses API
  - **New Endpoint**: Added `/api/saturn/analyze-with-reasoning/:taskId` for Responses API calls
  - **Structured Reasoning**: Captures `output_reasoning.summary` and `output_reasoning.items[]` for step-by-step analysis
  - **Response Chaining**: Supports `previous_response_id` for multi-step reasoning chains
  - **Real-Time Streaming**: WebSocket integration streams reasoning summaries and step updates
  - **Step Progress Tracking**: Derives step counts from reasoning items rather than hardcoded values

### Additional Fixes (2025-08-20)
- **Visible Output Token Cap (Code by Cascade)**: Plumbed `max_output_tokens` through `openaiService.analyzePuzzleWithModel()` into the Responses API body and set a sensible default from `saturnVisualService.ts` to prevent final answer starvation.
- **WS Message Types (Code by Cascade)**: Standardized WebSocket payloads with `messageType` fields: `reasoning-summary`, `reasoning-step`, and `final-output` to improve client-side handling and UI clarity.

### Chaining & Reliability (Responses API)
- **Previous Response Chaining (Code by Cascade)**: `server/services/openai.ts` now accepts `previousResponseId` and threads it to the Responses API via `previous_response_id`.
- **Simple Retry with Backoff (Code by Cascade)**: Added exponential backoff retries (1s/2s/4s) for transient Responses API errors; configurable attempts.
- **Saturn Forwarding (Code by Cascade)**: `server/services/saturnVisualService.ts` forwards `previousResponseId`, `maxSteps`, and reasoning summary settings to `openaiService.analyzePuzzleWithModel()`.
- **Type Safety Fix (Code by Cascade)**: Resolved readonly array assignment for `saturnImages` in Saturn Responses path.

### Technical Improvements
- **State Management**: Enhanced Saturn progress hook with reasoning log tracking and history management
- **Memory Management**: Implemented proper cleanup for timeout handlers and WebSocket connections
- **Type Safety**: Added proper TypeScript interfaces for reasoning log streaming
- **Performance**: Optimized log rendering and real-time updates for better responsiveness
- **API Architecture**: Added helper methods for extracting patterns, strategies, and confidence from reasoning data
- **Database Integration**: Enhanced explanation storage with reasoning summaries and structured analysis data
  
### Database Schema Additions (Responses API)
- Added new columns to `explanations` for OpenAI Responses API migration:
  - `provider_response_id` (TEXT)
  - `provider_raw_response` (JSONB) — persisted only when `RAW_RESPONSE_PERSIST=true`
  - `reasoning_items` (JSONB) — structured summarized reasoning steps
- Safe migrations: conditionally `ALTER TABLE` if columns are missing.
- `server/services/dbService.ts` now persists these fields from OpenAI service responses.
 - **OpenAI Responses API Migration Plan (Docs)**: Added `docs/OpenAI_Responses_Migration_Plan_2025-08-20.md` outlining full migration from Chat Completions to Responses, parser updates for `output_text`/`output[]`/`output_reasoning`, token budgeting with `max_output_tokens`, session chaining via `previous_response_id`, logging raw JSON for failing runs, and streaming/polling strategy. Initial audit: `server/services/openai.ts` still uses Chat Completions for non-reasoning models and parses `choices[0].message.content`; DB lacks fields for `provider_response_id`, `provider_raw_response`, and `reasoning_items`.

## Version 1.3.9 — Enhanced Solver Mode Validation & UI Refactoring (2025-08-20)

### Major Improvements
- __Solver Mode Grid Detection Enhancement (Code by Claude Code)__: Significantly improved the response validation system for solver mode
  - **Robust Pattern Matching**: Added comprehensive keyword search for "predicted output grid:", "answer:", "solution:", etc.
  - **Bracket Counting Algorithm**: Implemented intelligent bracket counting to extract complete 2D array structures
  - **Numeric-Only Validation**: Optimized for integer grids only (no letters) with proper type checking
  - **Multiple Extraction Strategies**: Fallback methods ensure reliable grid detection from AI responses
  - **Enhanced Debugging**: Comprehensive logging for validation troubleshooting

### UI Architecture Overhaul
- __PuzzleOverview.tsx Modular Refactoring (Code by Claude Code)__: Broke down 900-line monolithic component into clean, reusable modules
  - **66% Size Reduction**: Main file reduced from 900 to 301 lines
  - **StatisticsCards Component**: Modular feedback and accuracy statistics with loading states
  - **SearchFilters Component**: Dedicated search and filtering controls with sort functionality
  - **PuzzleList Component**: Reusable puzzle display with pagination and feedback integration
  - **Maintainable Architecture**: Following project's modular component patterns

### User Experience Enhancements
- **"Trustworthiness" Badge**: Changed solver mode accuracy badge from "Accuracy" to "Trustworthiness" to better reflect calibrated scoring
- **Fixed Button Navigation**: Resolved "View all models" buttons leading to blank pages in overview
- **Enhanced Grid Extraction**: Now successfully detects grids like `[[2,2,2],[2,8,8],[8,8,8]]` and `[[8,8,2], [8,2,2], [8,8,8]]`

### Technical Fixes
- **Database Query Enhancement**: Added missing validation fields to database queries for proper solver mode data retrieval
- **JSON Parsing**: Improved parsing of predicted output grids from database storage
- **TypeScript Compliance**: All new components maintain full type safety
- **ARC Color Palette Single Source of Truth (Code by Cascade)**: Fixed incorrect Tailwind color mapping in `client/src/components/saturn/CompactGrid.tsx` and consolidated exact ARC colors into `client/src/constants/colors.ts` (matching `client/src/constants/colors.md`). Components now use precise RGB values via inline styles for pixel-accurate rendering.
  - **TS Constants Update (Code by Cascade)**: `client/src/constants/models.ts` now exports `CELL_COLORS` from `ARC_COLORS` to eliminate duplicate palettes in the frontend.
  - **Python ARC Palette Alignment (Code by Cascade)**: Corrected maroon to `(128, 0, 0)` in `solver/arc_visualizer.py` and `solver/arc_stdin_visualizer.py` (black unchanged). Solver-generated images now match the canonical client palette.
  - **GridCell Palette Fix (Code by Cascade)**: `client/src/components/puzzle/GridCell.tsx` now imports `ARC_COLORS` from `constants/colors` and uses it for cell backgrounds, ensuring the exact canonical colors in puzzle grids.
- **AI Service Prompt Compliance**: Fixed hardcoded prompt templates in Anthropic and Gemini services
  - **Controller Default Fix**: Changed hardcoded "alienCommunication" default to proper "standardExplanation"
  - **Anthropic Error Handling**: Fixed hardcoded alien fields in error responses to respect template selection
  - **Gemini Service Cleanup**: Removed 200+ lines of duplicated prompt logic, now properly uses prompt builder
  - **Template Respect**: All AI services now properly respect selected prompt templates instead of forcing alien mode
- **GPT-5 Models Integration**: Verified and debugged new GPT-5 model endpoints for proper ResponsesAPI usage
  - **ResponsesAPI Configuration**: All GPT-5 models correctly use OpenAI's Responses API instead of ChatCompletions
  - **Enhanced Debugging**: Added comprehensive logging for GPT-5 model requests and responses
  - **WebSocket Fix**: Fixed development mode WebSocket connection issue (ws://localhost:undefined)
  - **E2E Validation**: Confirmed GPT-5 models are properly sending requests to OpenAI and generating reasoning logs
  - **Response Parsing Investigation**: Added detailed debugging for ResponsesAPI response structure analysis
  - **Form Accessibility**: Fixed missing ID attributes on form elements to resolve browser console warnings
  - **🔄 IN PROGRESS**: ResponsesAPI JSON parsing may need adjustment based on actual response format

August 19, 2025 11:11pm

## Version 1.3.8 — Comprehensive Feedback Analytics Dashboard (2025-08-19)

### New Features
- Added GPT-5 varieties to models
- __Feedback Statistics Dashboard (Code by Claude Code)__: Added comprehensive feedback analytics to the Database Overview page with real-time statistics
  - **Total Feedback Counter**: Shows current database total (125 feedback entries)
  - **Performance Breakdown**: Helpful vs Not Helpful percentages with color-coded indicators
  - **Top Performing Models**: Rankings of best AI models based on helpful feedback percentage
  - **Worst Performing Models**: Identifies models needing improvement with low helpful ratings
  - **Recent Activity Trends**: Last 30 days of feedback activity showing daily helpful/not helpful counts
  - **Enhanced Sorting**: Added "Most Feedback" sort option to find puzzles with highest engagement

### Model Performance Insights
- **Best Performers**: Gemini 2.5 Pro (86% helpful), Grok-3 (100% helpful), GPT-5 (100% helpful)
- **Needs Improvement**: GPT-4.1 Nano (0% helpful), Claude 3.5 Haiku (0% helpful), Gemini 2.0 Flash (0% helpful)

### Technical Improvements
- __TypeScript Error Resolution (Code by Claude Code)__: Fixed all frontend TypeScript compilation errors
  - Replaced deprecated `keepPreviousData` with `placeholderData` in React Query
  - Fixed Badge component size prop issues
  - Added proper type annotations for callback functions
  - Fixed API response parsing in feedback hooks and components

### Enhanced User Experience
- **Visual Feedback Indicators**: Color-coded performance badges (green ≥70%, yellow ≥50%, red <50%)
- **Clickable Feedback Counts**: Direct access to detailed feedback modal from puzzle cards
- **Model Display Names**: Proper model names with provider information in rankings
- **Responsive Grid Layout**: Organized statistics in 4-column layout for optimal viewing

August 19, 2025

## Version 1.3.7 — Default Prompt Improvements (2025-08-19)

### New Features
- __Default Prompt Improvements (Code by Cascade)__: Enhanced the default solver and explanation prompts to be more clear and concise.

### Fixes
- __Prompt Template Fix (Code by User)__: Corrected solver mode instructions for clearer AI guidance

### Enhanced User Experience
- **Comprehensive Filtering**: Overview page now supports explanation status, feedback status, and model filtering simultaneously

### Incomplete
- __Feedback Visibility & Filtering (Code by Claude)__: Users can now see which puzzles have received community feedback and filter by feedback status.
August 17, 2025

## Version 1.3.6 — Enhanced Database Overview & UX Improvements (2025-08-17)

### New Features
- __Feedback Visibility & Filtering (Code by Claude)__: Users can now see which puzzles have received community feedback and filter by feedback status.
  - **Feedback Indicators**: Visual feedback counters with blue icons for puzzles with feedback, gray for those without
  - **Feedback Filter**: New dropdown with "All Puzzles", "Has Feedback", "No Feedback" options
  - **Backend Integration**: Complete filtering logic for `hasFeedback` parameter in overview API
- __Smart Model Selection (Code by Claude)__: Replaced manual model name input with intelligent dropdown sourced from official model registry.
  - **Source of Truth**: Dropdown populated from `constants/models.ts` ensuring accuracy
  - **Provider Grouping**: Shows model names with provider info (e.g., "GPT-4.1 Mini (OpenAI)")
  - **No More Guessing**: Eliminates user confusion about correct model naming
- __Prompt Template Fix (Code by User)__: Corrected solver mode instructions for clearer AI guidance

### Enhanced User Experience
- **Comprehensive Filtering**: Overview page now supports explanation status, feedback status, and model filtering simultaneously
- **Visual Feedback Indicators**: Clear visual cues show puzzle engagement levels at a glance
- **Improved Navigation**: Better filtering makes finding specific puzzle types much easier

## Version 1.3.5 — Puzzle Overview Page Fix (2025-08-17)

### Bug Fixes
- __PuzzleOverview API Integration Fix (Code by Claude)__: Fixed critical bug preventing the `/overview` page from loading puzzle data.
  - **Root Cause**: Incorrect `apiRequest()` function call missing HTTP method parameter in `PuzzleOverview.tsx:92`
  - **Solution**: Added missing 'GET' method parameter: `apiRequest('GET', url)` instead of `apiRequest(url)`
  - **Secondary Fix**: Corrected response parsing by adding `await response.json()` before accessing `.data` property
- **Result**: Puzzle overview page now successfully loads and displays all puzzles with explanation status, filtering, and pagination

### Investigation Process
- Verified frontend component structure and routing configuration
- Confirmed backend API endpoint `/api/puzzle/overview` exists and functions correctly
- Identified `apiRequest()` function signature mismatch through systematic debugging
- Server logs showed successful 200 responses, confirming issue was client-side

August 16, 2025

## Version 1.3.4 — Saturn Success/Failure Status Integration (2025-08-16)

### Features
- __Saturn Success/Failure Reporting (Code by Cascade)__: Complete end-to-end implementation of Saturn solver success status tracking and display.
- __Database Schema Enhancement__: Added `saturn_success BOOLEAN` column to explanations table to persist solver success/failure status.
- __Backend Success Persistence__: Updated `saturnVisualService.ts` to extract and save success boolean from Saturn solver's final event output.
- __TypeScript Interface Updates__: Extended `ExplanationData` interface with optional `saturnSuccess` field for proper typing.
- __Saturn-Specific UI Design__: Enhanced `AnalysisResultCard` component with specialized Saturn display including:
  - 🪐 Saturn branding and visual indicators
  - Success/failure badges with color-coded status (green SOLVED / red FAILED)
  - Specialized section titles: "Saturn Visual Analysis", "Visual Solving Process", "Key Observations"
  - Enhanced reasoning log section with Saturn-specific styling and descriptions
  - Distinct Saturn reasoning log styling with indigo theme vs blue for other AI models

### Technical Implementation
- Database migration adds `saturn_success` column with proper boolean handling
- Saturn solver service now broadcasts success status in completion messages to clients
- UI conditionally renders Saturn-specific elements based on model name detection
- Success indicators appear both in header and analysis description sections
- Saturn reasoning logs display with "Multi-stage visual analysis" branding

August 15, 2025

## Version 1.3.3 — Saturn Visual Solver & Railway Fixes (2025-08-15)

### Features
- __Saturn Visual Solver (Code by Cascade)__: New page that streams phased visual analysis with intermediate images and a model selector. Includes a visible banner crediting the Saturn ARC project with a GitHub link.
- __Frontend Hook__: `client/src/hooks/useSaturnProgress.ts` accumulates streamed images and progress events for live UI updates.
- __Provider-Aware Image Delivery (Code by Cascade)__: `solver/arc_visual_solver.py` now enforces provider-specific image delivery; OpenAI path uses base64 PNG data URLs. No silent fallback; unsupported providers raise a clear error.

### Deployment Fixes (Railway Docker)
- __Python Runtime__: Dockerfile now installs Python 3 (`apk add python3 py3-pip`).
- __PEP 668 Compliance__: Uses `pip --break-system-packages` during build to allow installing `requirements.txt` on Alpine.
- __Include Solver Code__: Added `COPY solver/ ./solver/` so `server/python/saturn_wrapper.py` can import `arc_visual_solver`.
- __Python Binary Detection__: `server/services/pythonBridge.ts` auto-selects `python` on Windows and `python3` on Linux; still respects `PYTHON_BIN` env override.

### Bug Fixes
- Fixed local Windows error “Python was not found” by defaulting to `python` on `win32`.
- Fixed Railway build failure “externally-managed-environment” by adding `--break-system-packages`.
- Fixed runtime error “No module named 'arc_visual_solver'” by copying the `solver/` directory and ensuring `sys.path` includes it in `saturn_wrapper.py`.

### Touched Files
- `Dockerfile`
- `server/services/pythonBridge.ts`
- `server/python/saturn_wrapper.py`
- `server/controllers/saturnController.ts`
- `server/services/saturnVisualService.ts`
- `client/src/pages/SaturnVisualSolver.tsx`
- `client/src/hooks/useSaturnProgress.ts`
- `client/src/pages/PuzzleExaminer.tsx`
- `solver/arc_visual_solver.py`

### Backend Notes (Saturn)
- Python wrapper now accepts `options.provider`/`options.model` and constructs the solver accordingly. Unsupported providers emit an `error` event and abort.
- Images sent to the model are always base64-encoded PNG data URLs.

### Credits
- Implementation: **Cascade** with GPT-5 medium reasoning and Claude 4 Sonnet Thinking

August 14, 2025

## Version 1.3.2 — Prompt Default, Preview, and Solver Template (2025-08-14)

### Features
- **Default Prompt Selection (UI)**: `PromptPicker` now defaults to "Custom Prompt" with an empty textarea. Researchers can enter a prompt or switch to a template before analyzing.
- **Provider-Specific Prompt Preview**:
  - Backend: `POST /api/prompt/preview/:provider/:puzzleId` returns the exact assembled prompt string for the selected provider and inputs.
  - Frontend: A preview modal in `client/src/pages/PuzzleExaminer.tsx` shows the precise prompt that will be sent. When using Custom Prompt, the modal supports in-place editing and sending.
- **New "Solver" Prompt Template**: Sends puzzle data without the correct answer and asks the AI to predict the answer and explain its reasoning. Uses the same JSON response schema as explanation mode for seamless display.

### Fixes
- **Custom Prompt Purity**: Resolved an issue where template instructions were appended to custom prompts. Custom runs now send only the user's text plus raw puzzle data (no template wrapping).

### Touched Files
- `client/src/components/PromptPreviewModal.tsx`
- `client/src/pages/PuzzleExaminer.tsx`
- `server/services/promptBuilder.ts`
- `shared/types.ts`

### Credits
- Implementation: **Cascade**

August 13, 2025

## Version 1.3.1 — UI/UX and Performance Enhancements (2025-08-13)

### Features & Enhancements
- **Collapsible Mission Statement (Code by Cascade)**: Replaced the large block of text on the landing page with a collapsible mission statement, creating a cleaner and more focused UI.
- **Default to Unexplained Puzzles (Code by Cascade)**: The puzzle browser now defaults to showing unexplained puzzles first, helping users focus on puzzles that need attention.

### Performance Optimizations
- **N+1 Query Fix (Code by Cascade)**: Implemented a bulk database query (`getBulkExplanationStatus`) to fetch explanation statuses for all puzzles at once, drastically reducing puzzle list load times.

### Bug Fixes
- **Puzzle Filter Logic (Code by Cascade)**: Corrected the server-side sorting logic to ensure that prioritizing unexplained puzzles works as intended. The logic is now handled in `puzzleService` after data enrichment.
- **Puzzle Examiner Toggle (Code by Cascade)**:
    - Slowed down the animation for the color/emoji toggle for a smoother user experience.
    - Fixed the toggle's text to accurately reflect its state.
    - Set the default view to colors (Standard Explanation).

### Credits
- All changes in this version were implemented by **Cascade**.

---

August 12, 2025

## Version 1.3.0 — Prompt Architecture Refactor (2025-08-12)

### Major Architectural Changes
- __Centralized Prompt Builder (Code by Claude 4 Sonnet Thinking)__: Created `server/services/promptBuilder.ts` as single source of truth for all prompt construction and emoji mapping logic.
- __Modular Emoji System__: Emoji mapping now only applies to the "Alien Communication" prompt template. All other prompts use raw numeric grids by default.
- __Service Unification__: Refactored all 5 backend AI services (OpenAI, Anthropic, Gemini, Grok, DeepSeek) to use shared prompt builder, eliminating code duplication.

### Breaking Changes
- __Default Behavior Change__: Changed default `promptId` from `"alienCommunication"` to `"standardExplanation"` across all services, ensuring numeric grids are sent by default.
- __Emoji Mapping Scope__: Emoji mapping is now exclusively for the "Alien Communication" template, preventing unintended emoji usage in custom prompts and other templates.

### Backend Improvements
- Removed 200+ lines of duplicated prompt construction code across AI services.
- Consolidated emoji mapping logic into shared utility functions.
- Improved type safety with consistent prompt template handling.
- Fixed Gemini API integration issues with proper `generateContent` usage.

### Architecture Benefits
- __Single Source of Truth__: All prompt logic centralized in one module for easier maintenance.
- __Consistency__: Uniform prompt behavior across all AI providers.
- __Maintainability__: Future prompt changes only require updates in one location.
- __Reliability__: Eliminated risk of inconsistent emoji mapping behavior.

### Credits
- Architecture and implementation: __Claude 4 Sonnet Thinking__
- All code changes follow established patterns and maintain backward compatibility.

---

## Version 1.2.0 — Custom Prompts & Stability (2025-08-12)

### Features
- __Custom Prompt Support (Code by Claude 4 Sonnet Thinking)__: Researchers can override built‑in templates per analysis run.
- __Provider Coverage__: Works across OpenAI, Grok (xAI), Gemini, DeepSeek, and Anthropic.

### Backend
- Extended `POST /api/puzzle/analyze/:puzzleId/:modelKey` to accept optional `customPrompt` alongside `temperature` and `promptId`.
- Preserves backward compatibility: when `customPrompt` is omitted, templates work as before.
- Training examples and test cases are always appended server‑side.

### Frontend
- `PromptPicker` adds a "Custom Prompt" option with textarea, guidance, and char counter.
- `useAnalysisResults` passes `customPrompt` when `promptId` is `"custom"`.

### Bug fixes
- Prevented null access on `selectedTemplate.emojiMapIncluded` across all AI services when using custom prompts.

### Docs
- README updated with a Researcher Guide, API changes, provider notes, limitations, and troubleshooting.
- Credits: Code authored by __Claude 4 Sonnet Thinking__. Documentation by __GPT-5 (low reasoning)__.

### Notes
- Emoji maps are included only via templates; custom prompts must include their own legend if needed.
- Provider constraints (e.g., temperature or reasoning log availability) still apply.

July 26, 2025

## Changelog

### Version 1.1.0 - Enhanced AI Analysis & User Experience (2025-07-26)

#### **Dynamic Prompt Picker System** (Cascade / Gemini Pro 2.5 Implementation)
- **Dynamic Prompt Selection**: Users can now choose from multiple prompt templates to guide AI analysis, allowing for different explanation styles and depths.
- **Full Provider Integration**: The prompt picker is fully integrated with all supported AI providers: Anthropic, OpenAI, Gemini, Grok, and DeepSeek.
- **Centralized Prompt Management**: All prompt templates are managed in a central `PROMPT_TEMPLATES` map in `shared/types.ts` for consistency and easy updates.
- **Backend API Support**:
  - `GET /api/prompts`: New endpoint to provide a catalogue of available prompts to the frontend.
  - `POST /api/puzzle/analyze`: Updated to accept a `promptId` to select the desired prompt for analysis.
- **Frontend UI**: A new prompt picker component has been added to the user interface, allowing for seamless selection before puzzle analysis.


#### **Feedback-Driven Retry Mechanism** (Kimi K2 Implementation)
- **Enhanced Feedback Service**: When users mark explanations as "not helpful" and provide feedback, the system now automatically triggers a retry analysis
- **Non-destructive Retry**: New explanations are saved as separate entries, never overwriting originals
- **AI-Guided Improvement**: User feedback directly influences AI prompts for improved explanations
- **Robust Error Handling**: Comprehensive logging and graceful failure handling
- **Type Safety**: Fixed all TypeScript compilation issues with proper type casting

#### **Concurrent Provider Processing** (Kimi K2 Implementation)
- **Provider-Based Concurrency**: Users can now run models from different providers simultaneously
- **Smart Restrictions**: Only one model per provider can run at once (e.g., can't run two OpenAI models concurrently)
- **Enhanced State Management**: Replaced single `isAnalyzing` state with `processingModels` Set tracking
- **Cross-Provider Analysis**: DeepSeek + Claude + Gemini can run simultaneously

#### **Enhanced Visual Feedback** (Kimi K2 Implementation)
- **Real-Time Progress Indicators**: Dynamic progress bars that fill based on model-specific estimated response times
- **Live Timer Display**: Counts up elapsed time during processing
- **Actual Time Recording**: Stores and displays real processing times vs. estimates
- **Color-Coded Status**: Visual indicators for fast (⚡), moderate (⌛), and slow (⏳) models
- **Targeted Processing**: Only the actively selected model shows processing indicators

#### **UI/UX Improvements** (Kimi K2 Implementation)
- **Model Progress Indicator Component**: New reusable component for consistent processing feedback
- **Provider-Aware Disabling**: Clear visual indication of which providers are busy
- **Concurrent Timing**: Separate timing tracking for each concurrent analysis
- **Clean Integration**: Seamless integration with existing UI components

### Version 1.0.0 - Initial Release
- Basic puzzle analysis functionality
- Support for multiple AI models
- Database-first architecture
- User feedback system
- Accessibility features

### Version 1.0.2 - API Processing Time Tracking (Claude 3.7 Sonnet Thinking Implementation)

#### **Performance Monitoring & Timing Features**
- **Backend API Processing Time Tracking**: Precise measurement of server-side processing time for AI model analysis calls
- **Database Storage**: Processing time data is stored in the `api_processing_time_ms` column in the explanations table
- **UI Display**: Processing time shown in user-friendly format (e.g., "1m 23s", "45s") alongside each model explanation
- **Model Card Enhancements**: Estimated response times now displayed on model buttons for user expectations
- **Progress Indicator Fixes**: Fixed bug in estimated time parsing that caused incorrect 51-minute displays for some models
- **Comprehensive Timing**: Both estimated and actual processing times provided to users

#### **Technical Implementation**
- **Backend**: Modified `puzzleController.ts` to measure and record API processing time
- **Database**: Added `api_processing_time_ms` column with migration support
- **Frontend**: Updated `AnalysisResultCard.tsx` to display processing times
- **Type Safety**: Added `apiProcessingTimeMs` to TypeScript interfaces

### Version 1.0.1 - Added DeepSeek and Reasoning capture to the puzzle examiner.

### Version 1.0.3 - Added ARC 1 Evaluation Tasks 

