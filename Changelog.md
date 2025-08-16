<!--
  CHANGELOG.md
  What: Release notes for ARC-AGI Puzzle Explorer.
  How: Documents features, fixes, and credits. This entry covers Custom Prompt support.
  Author (docs): GPT-5 (low reasoning)
-->

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

