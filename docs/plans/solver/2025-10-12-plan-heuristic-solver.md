# Heuristic Solver Integration Plan - 2025-10-12

## Overview
This document outlines the integration of a heuristic ARC solver that learns transformations from training examples using primitive operations and composition.

## Architecture

### Package Structure (`solver/heuristic/`)
```
solver/heuristic/
├── __init__.py          # Package initialization
├── grids.py             # Grid operations and utilities (SRP: grid ops only)
├── prims.py             # Parameterized transform primitives (SRP: primitives only)
├── program.py           # Program search and composition logic (SRP: learning only)
├── cli.py               # JSON contract interface (SRP: CLI only)
└── ../heuristic_solver.py  # Single-file version for easy deployment
```

### Module Responsibilities (SRP)

#### `grids.py` - Grid Operations Only
- **Single Responsibility**: Grid manipulation utilities
- **Functions**: `to_grid()`, `from_grid()`, `trim_zero_border()`, `rotate_k()`, `flip()`, `color_map()`, etc.
- **Connected Components**: `cc_labels()`, `keep_largest_object()`
- **No Puzzle Logic**: Pure grid operations

#### `prims.py` - Transform Primitives Only
- **Single Responsibility**: Define basic transformation functions
- **Transform Class**: Named functions that operate on grids
- **Candidate Generation**: `candidate_transforms()` creates transform library
- **Color Mapping**: `deduce_color_map()` learns from training pairs
- **No Composition**: Just primitive definitions

#### `program.py` - Learning Logic Only
- **Single Responsibility**: Find transformation programs that solve puzzles
- **Search Strategy**:
  1. Try single primitive transforms
  2. Try two-step compositions (`t1∘t2`)
  3. Try trim + transform combinations
- **Shape Matching**: `apply_with_shape_match()` handles size differences
- **No Grid Ops**: Delegates to grids module

#### `cli.py` - Interface Only
- **Single Responsibility**: JSON contract interface for backend
- **Contract Format**:
  ```json
  {
    "program": "transform_name",
    "predicted_output_grid": [[...]]  // single test
    // OR
    "multiple_predicted_outputs": [[[...]], [...]]  // multi-test
  }
  ```
- **No Solving Logic**: Just I/O and coordination

## Integration Points

### Backend Integration
- **Service**: `HeuristicService` extends `BaseAIService`
- **Factory Routing**: `model.startsWith('heuristic-')` → `heuristicService`
- **Model Key**: `heuristic-solver` → internal heuristic solver
- **Execution**: `python solver/heuristic_solver.py {taskJson}`
- **Response Mapping**: JSON → `AIResponse` fields

### Database Schema Compatibility
- **Single Test**: `predicted_output_grid`, `is_prediction_correct`
- **Multi-Test**: `has_multiple_predictions=true`, `multi_test_prediction_grids`
- **Metadata**: `model_name="heuristic-solver"`, `pattern_description`, `hints`

## Target Puzzle IDs
Test on these specific puzzles to validate solver:
- `50846271` - Pattern recognition baseline
- `a64e4611` - Color mapping challenge
- `a8d7556c` - Geometric transformation
- `e5062a87` - Complex composition

## Invariants & Design Principles

### Learning Strategy
1. **Primitive Library**: Geometry (rotate, flip, transpose), object ops (trim, largest), scaling, color mapping
2. **Search Order**: Single → Composition → Trim+Transform → Fallback
3. **Shape Handling**: Median target shape from training outputs
4. **Fallback**: Keep largest object, center to target shape

### Transform Composition
- **Two-step**: `t1∘t2` means `t1(t2(grid))`
- **Shape Preservation**: Output shape must match training examples
- **Color Consistency**: Learned color mappings must be 1-1 and consistent

### Performance Characteristics
- **Speed**: Very fast (< 1 second per puzzle)
- **Accuracy**: Moderate (learns obvious patterns)
- **Reliability**: Deterministic (same input → same output)
- **Resource**: Minimal (numpy only, no API calls)

## Usage Workflow

### Development
```bash
# Test individual puzzle
python solver/heuristic_solver.py data/arc-heavy/50846271.json

# Expected output:
{
  "program": "rot_180",
  "predicted_output_grid": [[...]]
}
```

### Backend Integration
```typescript
// In puzzle analysis
const result = await heuristicService.analyzePuzzleWithModel(
  puzzle, "heuristic-solver", taskId, 0.2, "solver"
);

// Maps to database fields:
// result.predictedOutputGrid → predicted_output_grid
// result.multiplePredictedOutputs → multi_test_prediction_grids
// result.patternDescription → pattern_description
```

### Validation Loop
1. Run on target puzzle IDs
2. Compare predictions against ground truth
3. Record successful programs for seeding
4. Use `merge()` and `diff()` tools to curate high-precision transforms

## Future Enhancements

### Library Integration (jjosh)
- **Transform Registry**: `registry.extend([...])` for known-good transforms
- **Seed Search**: Start with curated transforms before brute force
- **Success Filtering**: `filter_solvers_by_success(json_dir)`

### Advanced Features
- **3-step Compositions**: `t1∘t2∘t3` for complex patterns
- **Conditional Logic**: If-then transforms based on input properties
- **Pattern Templates**: Parameterized pattern families

## Error Handling

### Solver Failures
- **No Program Found**: Returns fallback transform
- **Shape Mismatch**: Pads/trims to target shape
- **Invalid JSON**: Backend catches and reports errors

### Backend Integration
- **Service Errors**: Proper error propagation to UI
- **Timeout Handling**: Python execution timeout (default 30s)
- **Resource Cleanup**: Temp files automatically removed

## Testing Strategy

### Unit Tests
- Each module tested independently
- Grid operations verified against known examples
- Transform composition tested on synthetic data

### Integration Tests
- Full pipeline tested on target puzzle IDs
- JSON contract validated end-to-end
- Database schema compatibility verified

### Performance Tests
- Execution time measured (< 1s target)
- Memory usage monitored
- Concurrent execution tested

## Deployment

### Production Ready
- ✅ Numpy dependency only
- ✅ No external API calls
- ✅ Deterministic output
- ✅ Proper error handling
- ✅ JSON contract compliance

### Monitoring
- Success rate tracking per puzzle type
- Execution time monitoring
- Error rate alerting

This heuristic solver provides a fast, reliable baseline for ARC puzzle solving that can learn obvious patterns and serve as a foundation for more sophisticated approaches.
