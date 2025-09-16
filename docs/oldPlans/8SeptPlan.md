# Plan: Enhance PuzzleDiscussion Page with Rich Database Data & ARC 2 Eval Filtering

## Current State Analysis
The PuzzleDiscussion page currently shows "worst-performing puzzles" with basic accuracy filtering. It uses the `/api/puzzle/worst-performing` endpoint which provides rich performance data but lacks specific ARC 2 evaluation filtering and doesn't fully utilize the extensive database fields available.

## Available Rich Database Fields (Currently Underutilized)
- **Multi-test puzzle data**: `multi_test_all_correct`, `multi_test_average_accuracy`, `has_multiple_predictions`
- **Model performance metrics**: `prediction_accuracy_score`, `estimated_cost`, token usage
- **Reasoning data**: `reasoning_tokens`, `reasoning_effort`, `reasoning_verbosity` 
- **Provider response metadata**: `api_processing_time_ms`, `provider_response_id`
- **Source filtering**: Already supports ARC1, ARC1-Eval, ARC2, ARC2-Eval filtering
- **Multi-test prediction grids**: For puzzles with multiple test cases

## Enhancement Plan

### 1. Add ARC 2 Evaluation Specific Filtering
- Add ARC 2 Eval quick filter button
- Add source-based filtering controls (ARC1, ARC1-Eval, ARC2, ARC2-Eval)
- Enhance visual badges to highlight ARC 2 Eval puzzles
- Add statistics showing ARC 2 Eval specific performance metrics

### 2. Enhance Multi-Test Puzzle Display
- Show multi-test specific accuracy (`multi_test_average_accuracy` vs `is_prediction_correct`)
- Add badges indicating single vs multi-test puzzles
- Display partial correctness for multi-test puzzles (e.g., "2/3 tests passed")
- Show `has_multiple_predictions` status clearly

### 3. Add Advanced Performance Metrics
- **Cost Analysis**: Show `estimated_cost` per puzzle analysis
- **Processing Time**: Display `api_processing_time_ms` for performance comparison
- **Token Usage**: Show `reasoning_tokens`, `input_tokens`, `output_tokens`
- **Reasoning Quality**: Display `reasoning_effort` and `reasoning_verbosity` for GPT-5 models

### 4. Expand Sorting & Filtering Options
- Add cost-based sorting (highest/lowest cost per analysis)
- Add processing time sorting
- Add multi-test puzzle filtering (single vs multi-test only)
- Add reasoning quality filtering (by effort level)

### 5. Enhanced Visual Data Display
- **Performance Heatmap**: Color-code puzzles by multiple metrics simultaneously
- **Model Comparison Cards**: Show which models struggled most with each puzzle
- **Cost vs Accuracy Scatter**: Visual representation of cost-effectiveness
- **Timeline View**: Show when puzzles were last analyzed

### 6. Cross-App API Compatibility
- Ensure all new filtering parameters work with existing API structure
- Add query parameter documentation for external app usage
- Maintain backward compatibility with current `/api/puzzle/worst-performing` endpoint

### 7. Implementation Steps
1. **Backend**: Extend worst-performing API with new filtering parameters (source, multi-test, reasoning level)
2. **Frontend**: Add new filter controls and display components
3. **Data Enhancement**: Show rich metrics in puzzle cards
4. **Visual Improvements**: Add charts and improved data visualization
5. **Cross-App Testing**: Verify API works for other applications

This plan leverages the extensive rich database schema already in place while adding ARC 2 Eval specific filtering and performance insights that will be valuable for both this app and external applications.