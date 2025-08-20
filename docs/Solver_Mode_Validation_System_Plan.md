# Solver Mode Validation System Implementation Plan

## Overview

This plan outlines the implementation of a comprehensive validation system for AI responses when using "Solver" mode in the ARC explainer application. The system will extract predicted output grids from AI responses, validate them against correct answers, and display accuracy metrics throughout the application.

## Current Architecture Analysis

### Solver Mode Foundation
- **Prompt System**: Solver mode defined in `shared/types.ts` as a template that provides training examples without correct answers
- **Prompt Builder**: `server/services/promptBuilder.ts` handles solver mode logic (line 284) and omits correct answers (lines 322-336)
- **Response Format**: Uses same JSON schema as explanation mode for seamless frontend compatibility
- **AI Services**: All 5 providers (OpenAI, Anthropic, Gemini, Grok, DeepSeek) use unified prompt building system

### Current Data Flow
1. User selects "Solver" template in `client/src/components/PromptPicker.tsx`
2. Backend builds prompt without correct answer via `promptBuilder.ts`
3. AI service processes request and returns JSON response
4. Response saved to database via `server/services/dbService.ts`
5. Frontend displays results in `client/src/components/puzzle/AnalysisResultCard.tsx`

### Existing Validation Infrastructure
- Request validation exists in `server/middleware/validation.ts` for feedback submissions
- No AI response content validation currently implemented
- Database schema supports explanations with reasoning logs but lacks prediction accuracy tracking

## Implementation Strategy

### Phase 1: Database Schema Extensions

**Primary Extensions to EXPLANATIONS Table:**
- `predicted_output_grid` (TEXT/JSON): Store extracted grid as JSON array
- `is_prediction_correct` (BOOLEAN): Binary correctness flag 
- `prediction_accuracy_score` (FLOAT): NEW FEATURE metric (0.0-1.0) shown as percentage in UI
  
**Existing Columns (Already Implemented):**
- `confidence` (INTEGER): AI model's self-reported confidence score 0-100
- Uses existing `formatConfidence()` function from `@/constants/models` for display

**Schema Migration Considerations:**
- Add new columns with DEFAULT NULL for backward compatibility
- Simple indexes for leaderboard queries

### Phase 2: Response Validation Engine

**Core Validation Service (`server/services/responseValidator.ts`):**

**Grid Extraction Strategies:**
1. **Pattern Matching**: Multiple regex patterns for common response formats
   - "predicted output grid is [[...]]"
   - "output: [[...]]" 
   - "answer: [[...]]"
   - "output grid: [[...]]"
   - "solution: [[...]]"

2. **JSON Parsing**: Direct extraction from structured responses
   - Look for grid arrays in solvingStrategy field
   - Parse embedded JSON within text responses

3. **Format Normalization**: Handle various bracket styles and spacing
   - `[[1,2],[3,4]]` vs `[ [1, 2], [3, 4] ]`
   - Mixed comma/space delimiters
   - Integer vs string number formats

4. **Dimensional Validation**: Ensure extracted grids match expected output dimensions
   - Verify row count matches expected output height
   - Verify column count matches expected output width
   - Validate all values are valid integers within expected range

**Accuracy Calculation Methods:**
- **Exact Match**: Binary correct/incorrect for perfect grid matches
- **prediction_accuracy_score Calculation**: Rewards honest uncertainty and penalizes overconfidence
  - **Perfect Calibration**: 0% confidence + wrong answer = 1.0 score (same as 100% confidence + correct answer)
  - **Honest Low Confidence**: Low confidence + wrong answer gets rewarded
  - **Dangerous Overconfidence**: 95%+ confidence + wrong answer gets heavily penalized (lowest scores)
  - **Reward Correct Answers**: Under 50% confidence + correct answer scores better than >50% confidence + wrong answer
  - **Simple Formula**: Balances correctness with confidence appropriateness

**Error Handling and Fallbacks:**
- Graceful degradation when no grid found (THIS WILL COUNT AS AN INCORRECT ANSWER!)
- Special handling for ambiguous responses (THIS WILL COUNT AS AN INCORRECT ANSWER!)

### Phase 3: Integration Points

**Puzzle Controller Integration (`server/controllers/puzzleController.ts`):**
- Add validation step after AI response generation
- Inject correct answer from puzzle data for comparison
- Store validation results alongside explanation data
- Maintain backward compatibility for non-solver modes

**Database Service Updates (`server/services/dbService.ts`):**
- Extend `saveExplanation` method to handle new validation columns
- Add basic queries for leaderboard accuracy statistics
- Simple schema migration for new columns

**Prompt Builder Integration:**
- Leverage existing "omit correct answer" logic to access ground truth
- Ensure validation only occurs in solver mode contexts
- Maintain separation between explanation and solver mode processing

### Phase 4: Frontend Display Enhancements

**Analysis Result Card Updates (`client/src/components/puzzle/AnalysisResultCard.tsx`):**

**Validation Status Display:**
- Simple "Correct" / "Incorrect" / "Not Found" badge next to model name
- Reuse existing confidence display (formatConfidence function)
- Optional expandable details showing predicted vs actual grids

**Predicted Grid Visualization:**
- Side-by-side comparison with correct answer
- Visual highlighting of correct/incorrect cells
- Grid rendering using existing PuzzleGrid component
- Toggle between predicted and actual solutions

**Type System Updates (`shared/types.ts`):**
- Extend explanation interfaces with validation fields
- Add prediction accuracy types and enums
- Research existing confidence level thresholds and categories  (SEARCH THE PROJECT!!!  )
- Create validation result data structures

### Phase 5: Leaderboard and Analytics Integration

**Puzzle Overview Enhancements (`client/src/pages/PuzzleOverview.tsx`):**

**Accuracy Leaderboards:**
- "Most Accurate Models" section showing solver mode success rates
- "Highest Confidence Predictions" ranking based on prediction accuracy score
- Model comparison tables with accuracy percentages
- Filtering by accuracy thresholds and confidence levels

**Statistical Dashboard:**
- Overall accuracy rates across all models

**Data Aggregation Services:**
- New API endpoints for accuracy statistics
- Efficient queries for large leaderboard generation


## Implementation Dependencies

### Backend Dependencies
- Database migration system (Drizzle ORM)
- Regex processing libraries for pattern matching
- JSON parsing and validation utilities
- Statistical analysis functions for prediction accuracy calculation ? Seems like overkill?

### Frontend Dependencies
- REUSE existing components!!!
- Modal/expandable components for detailed validation views

### Infrastructure Dependencies
- Database indexing for performance  (SEEMS LIKE OVERKILL?)
- API endpoint expansion for validation data

