<!--
  CHANGELOG.md
  What: Release notes for ARC-AGI Puzzle Explorer.
  How: Documents features, fixes, and credits. This entry covers Custom Prompt support.
  Author (docs): GPT-5 (low reasoning)
-->

August 12, 2025

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

