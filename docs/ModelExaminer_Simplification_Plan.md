# ModelExaminer Simplification Plan
*Date: August 26, 2025*
*Author: Your boss*

## Problem Analysis

The current ModelExaminer has complex batch automation that's failing due to session management and polling issues. Instead of debugging the complex flow, we need to simplify it to work on a basic level - showing individual puzzle cards that can be clicked to analyze one by one.

## Core Issue

We're trying to build complex batch automation before getting the basics right. The ModelExaminer should:
1. Show individual puzzle cards based on batch size setting
2. Allow clicking each puzzle to analyze it individually
3. Use the exact same prompt construction and analysis flow as PuzzleExaminer (IT MIGHT BE DOING THIS ALREADY!)
4. Display results in the same format as PuzzleExaminer (IT MIGHT BE DOING THIS ALREADY!)

## Approach

### Phase 1: Analyze PuzzleExaminer Flow to understand how it works when it works correctly!
- **Task 1.1**: Study how PuzzleExaminer loads puzzle data also look at Analysis_Data_Flow_Trace.md
- **Task 1.2**: Understand exact prompt construction in PuzzleExaminer
- **Task 1.3**: Map the analysis flow from button click to result display
- **Task 1.4**: Assess the API calls and data flow used by PuzzleExaminer

### Phase 2: Improve ModelExaminer UI
- **Task 2.1**: Improve batch automation components and debugging console!  
- **Task 2.2**: Debug polling logic and session management
- **Task 2.3**: Reuse existing puzzle grid components to display individual puzzle cards like PuzzleBrowser and PuzzleOverview
- **Task 2.4**: Load N puzzles based on batch size setting (e.g., 3 puzzles if batch size = 3)
- **Task 2.5**: Display puzzle cards with basic info (ID, preview, analyze button)

### Phase 3: Implement Individual Analysis
- **Task 3.1**: Copy exact analysis function from working components
- **Task 3.12**: Load puzzle data via `puzzleService.getPuzzleById()` (Figure out how to do this so we aren't reloading the same puzzles over and over)
- **Task 3.2**: Hook up puzzle card click to trigger individual analysis and Store results in database

- **Task 3.3**: Use same prompt construction logic as PuzzleExaminer
- **Task 3.4**: Display results using same components as PuzzleExaminer
- **Task 3.5**: 


## Implementation Details

### Current Flow to Replicate:

2. User selects model and settings
3. Load puzzle data via `puzzleService.getPuzzleById()` (Figure out how to do this so we aren't reloading the same puzzles over and over)
3. Click "Analyze" triggers `analyzeWithModel()`
4. Calls AI service with exact same parameters
5. Display results in AnalysisResultCard component

### New ModelExaminer Flow:
1. User sets model and global settings once
2. Load N puzzles from selected dataset via `puzzleService.getPuzzleList()`
2. Display puzzle cards in grid layout
3. 
4. Click individual puzzle card triggers same `analyzeWithModel()` logic
5. Display results for each puzzle individually reusing AnalysisResultCard component

### Key Components to Reuse: (We might be already using them! Check!)
- `AnalysisResultCard` component for displaying results
- Exact same AI service calls and prompt construction
- Same model selection and settings UI
- Same error handling and loading states

### Components to Audit for functionality:
- Baisc batch session management
- Polling logic for status updates
- WebSocket connections
- Progress tracking and statistics!!!!!
- BASIC FUNCTIONALITY!!

## Success Criteria

- [ ] ModelExaminer shows individual puzzle cards (and batch automation for once we get this working!!!)
- [ ] Clicking a puzzle card send the API request to the LLM and we validate it and store it to the database like we do in PuzzleExaminer
- [ ] Results are validated and stored to database the same way PuzzleExaminer does it
- [ ] No complex batch automation or session management expected yet, audit for functionality
- [ ] Simple, predictable behavior that's easy to debug
- [ ] Clean debug UI showing complete flow from click to result display


## Next Steps

1. Create the plan document ✓
2. Analyze PuzzleExaminer implementation details, read Analysis_Data_Flow_Trace.md
3. Simplify ModelExaminer to show puzzle cards
4. Hook up individual analysis using PuzzleExaminer logic (might be doing this already)
5. Confirm code dictates identical behavior, the results are validated and stored to database the same way PuzzleExaminer does it (THIS MIGHT BE BROKEN!!!)
6. Only then consider adding batch automation features after the user has performed tests.
