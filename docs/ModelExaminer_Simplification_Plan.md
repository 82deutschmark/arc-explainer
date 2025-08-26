# ModelExaminer Simplification Plan
*Date: August 26, 2025*
*Author: Cascade*

## Problem Analysis

The current ModelExaminer has complex batch automation that's failing due to session management and polling issues. Instead of debugging the complex flow, we need to simplify it to work exactly like PuzzleExaminer - showing individual puzzle cards that can be clicked to analyze one by one.

## Core Issue

We're trying to build complex batch automation before getting the basics right. The ModelExaminer should:
1. Show individual puzzle cards based on batch size setting
2. Allow clicking each puzzle to analyze it individually
3. Use the exact same prompt construction and analysis flow as PuzzleExaminer
4. Display results in the same format as PuzzleExaminer

## Approach

### Phase 1: Analyze PuzzleExaminer Flow
- **Task 1.1**: Study how PuzzleExaminer loads puzzle data
- **Task 1.2**: Understand exact prompt construction in PuzzleExaminer
- **Task 1.3**: Map the analysis flow from button click to result display
- **Task 1.4**: Document the API calls and data flow used by PuzzleExaminer

### Phase 2: Simplify ModelExaminer UI
- **Task 2.1**: Remove complex batch automation components
- **Task 2.2**: Remove polling logic and session management
- **Task 2.3**: Add puzzle grid component to display individual puzzle cards
- **Task 2.4**: Load N puzzles based on batch size setting (e.g., 3 puzzles if batch size = 3)
- **Task 2.5**: Display puzzle cards with basic info (ID, preview, analyze button)

### Phase 3: Implement Individual Analysis
- **Task 3.1**: Copy exact analysis function from PuzzleExaminer
- **Task 3.2**: Hook up puzzle card click to trigger individual analysis
- **Task 3.3**: Use same prompt construction logic as PuzzleExaminer
- **Task 3.4**: Display results using same components as PuzzleExaminer
- **Task 3.5**: Store results in simple state (not complex session management)

### Phase 4: Test and Validate
- **Task 4.1**: Test individual puzzle analysis produces identical results to PuzzleExaminer
- **Task 4.2**: Verify prompt construction matches exactly
- **Task 4.3**: Confirm all model types work (GPT-5, Claude, etc.)
- **Task 4.4**: Test with different datasets and prompt templates

## Implementation Details

### Current PuzzleExaminer Flow to Replicate:
1. Load puzzle data via `puzzleService.getPuzzleById()`
2. User selects model and settings
3. Click "Analyze" triggers `analyzeWithModel()`
4. Calls AI service with exact same parameters
5. Display results in AnalysisResultCard component

### New ModelExaminer Flow:
1. Load N puzzles from selected dataset via `puzzleService.getPuzzleList()`
2. Display puzzle cards in grid layout
3. User sets model and global settings once
4. Click individual puzzle card triggers same `analyzeWithModel()` logic
5. Display results for each puzzle individually

### Key Components to Reuse:
- `AnalysisResultCard` component for displaying results
- Exact same AI service calls and prompt construction
- Same model selection and settings UI
- Same error handling and loading states

### Components to Remove/Simplify:
- Complex batch session management
- Polling logic for status updates
- WebSocket connections
- Progress tracking and statistics
- Batch result aggregation

## Success Criteria

- [ ] ModelExaminer shows individual puzzle cards (not automation)
- [ ] Clicking a puzzle card analyzes it using exact PuzzleExaminer flow
- [ ] Results are identical to PuzzleExaminer for same puzzle/model/settings
- [ ] No complex batch automation or session management
- [ ] Simple, predictable behavior that's easy to debug
- [ ] Clean separation between puzzle loading and individual analysis

## Benefits of This Approach

1. **Debuggable**: Simple flow that's easy to trace and fix
2. **Proven**: Uses exact same logic that already works in PuzzleExaminer
3. **Flexible**: User can analyze puzzles individually at their own pace
4. **Reliable**: No complex polling or session management to fail
5. **Incremental**: Can add batch automation later once basics work perfectly

## Next Steps

1. Create the plan document ✓
2. Analyze PuzzleExaminer implementation details
3. Simplify ModelExaminer to show puzzle cards
4. Hook up individual analysis using PuzzleExaminer logic
5. Test and validate identical behavior
6. Only then consider adding batch automation features
