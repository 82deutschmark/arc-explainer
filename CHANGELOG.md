###   August 26 2025

## v2.0.7
- **Fix**: Resolve batch analysis "Failed to create database session" error in ModelExaminer
- Fix parameter mismatch between batchAnalysisService and dbService layers
- Update batch_analysis_sessions table schema with all required columns (dataset, temperature, reasoning parameters)
- Add database migration logic for existing installations  
- Properly map configuration parameters: modelKey -> model_key, add successful_puzzles column
- ModelExaminer batch analysis functionality now works correctly
- Author: Claude

## v2.0.6
- **Fix**: Correct badge display logic for both single and multi-test puzzles in AnalysisResultCard
- Fix single puzzles showing incorrect badges when answer is actually correct
- Prioritize multiTestAllCorrect over isPredictionCorrect for multi-test puzzles
- Add consistent check/X circle icons to all correctness badges  
- Handle field name variations (multiTestAllCorrect vs allPredictionsCorrect)
- Fix color class application in multi-test section badges
- Update temperature control text: "GPT-4.1 & older only!!!" in PuzzleExaminer
- Fix time badges to always display in seconds/minutes format (no more milliseconds)
- Author: Cascade

## v2.0.5
- Docs: Add Grid Rendering Guide for `AnalysisResultCard` explaining `PuzzleGrid` and `GridCell` usage.
- Author: Cascade

## v2.0.4
- **Fix**: Resolve feedback endpoint connectivity issues by adding Vite proxy configuration
- Frontend can now properly communicate with backend API server (port 5000) during development
- Fixes ERR_NAME_NOT_RESOLVED errors when fetching solver scores and trustworthiness data
- Feedback endpoints now deliver proper data for community ratings and model performance metrics

## v2.0.3
- Fix client timeout issues for long-running AI API calls (Grok/DeepSeek 25+ minutes)
- Client now supports 50-minute timeout for AI analysis requests
- Non-AI requests still use 30-second timeout  // THIS IS TROUBLING!!! THERE ARE NO NON-AI REQUESTS!!!!
- Update Educational Approach UI text to emphasize algorithmic thinking and computational processes
- Major UI enhancement: Transform "Explanation Style" to "🎯 Prompt Style" with emojis and visual improvements
- Add emojis to all prompt templates (📝 Standard, 🧠 Educational, 🎯 Solver, 🛸 Alien, ⚙️ Custom)
- Improve prompt descriptions to be clearer and more action-oriented
- Enhanced PromptPicker UI

###   August 25 2025

## v2.0.2
- UI Improvements - Multi-test puzzle support has reached full feature parity with single-test puzzles.

## v2.0.1
- Updated release to support multi-test puzzles.  This was a major hurdle and took a long time to implement.
- We are now ready to accept synthetic puzzle data sets for analysis as described in docs\24AugImport.md



