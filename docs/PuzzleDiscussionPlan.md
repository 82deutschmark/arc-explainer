---
# Simple PuzzleDiscussion Page Implementation Plan
August 31, 2025

## Purpose
Create a simple page that shows puzzles with poor analysis results and lets users retry analysis with enhanced prompting.

## Goals
1. Show puzzles that need better analysis (wrong predictions, low trustworthiness, bad feedback)
2. Let user select a model and re-run analysis with enhanced prompt
3. Display new results alongside original

## Simple Approach

### 1. Find "Bad" Puzzles
- Filter puzzles where:
  - `is_prediction_correct = false` (actually wrong predictions)
  - OR low `prediction_accuracy_score` (low trustworthiness)
  - OR more negative feedback than positive feedback
- Show top 20 worst-performing puzzles

### 2. Page Structure
- Copy `PuzzleBrowser.tsx` structure
- Same card layout and navigation patterns
- Replace filter logic with "worst performing" sorting
- Route: `/discussion`

### 3. Enhanced Prompting
- Use existing solver template from `PROMPT_TEMPLATES`
- Add context prefix: "The previous analysis was incorrect. Please provide a fresh, more careful analysis."
- Use existing `promptBuilder.buildAnalysisPrompt()` function
- No new endpoints needed

### 4. User Flow
1. Navigate to Discussion page
2. See list of problematic puzzles (worst first)
3. Click puzzle → view original bad analysis result
4. Click "Retry Analysis" button
5. Select model → runs analysis with enhanced prompt
6. View new result using existing `AnalysisResultCard`

## Implementation Tasks

### Frontend
- Create `PuzzleDiscussion.tsx` by copying `PuzzleBrowser.tsx`
- Modify sorting to show worst-performing puzzles first
- Add "Retry Analysis" functionality to existing puzzle examination flow
- Update navigation to include Discussion link

### Backend
- Add enhanced prompting mode to existing analysis pipeline
- No new endpoints or database changes required
- Use existing explanation service with modified prompts

### Components to Reuse
- `PuzzleViewer` - display puzzle grids
- `AnalysisResultCard` - show analysis results
- `ModelButton` - model selection
- Existing analysis mutation hooks

## Benefits of Simple Approach
- No complex chat UI or streaming required
- Reuses entire existing analysis infrastructure
- No database schema changes
- Clear, focused user experience
- Quick to implement and test

---