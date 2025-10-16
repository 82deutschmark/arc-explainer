# Grover Validation Architecture

**Author**: Cascade using Sonnet 4.5  
**Date**: 2025-10-09T18:04:00-04:00  
**Purpose**: Explain Grover's dual validation system and why it differs from other solvers

## The Two Validation Systems

Grover uses **two completely separate validation systems** that serve different purposes:

### 1. Internal Iterative Validation (Training-Time)

**When**: During each Grover iteration (steps 1-5)  
**Purpose**: Guide the search process to find promising programs  
**How It Works**:
```
For each iteration:
  1. LLM generates 3-5 program attempts
  2. Programs execute on TRAINING inputs via grover_executor.py
  3. LLM grades each program's outputs vs training outputs (0-10 scale)
  4. Programs sorted by grade
  5. Best programs positioned at end of context (amplitude amplification)
  6. Next iteration uses this feedback to improve
```

**Key Characteristics**:
- Uses **training data only** (never touches test data during search)
- Scoring is **subjective** (LLM judgment on quality/correctness)
- Score range: 0.0 to 10.0
- Purpose: **Optimization** (finding good candidate programs)
- Already fully implemented and working

**Example**:
```
Iteration 2:
  Program A output: [[1,2],[3,4]] vs training output [[1,2],[3,4]] → Grade: 10.0/10
  Program B output: [[1,2],[0,0]] vs training output [[1,2],[3,4]] → Grade: 5.0/10
  Program C output: [[0,0],[0,0]] vs training output [[1,2],[3,4]] → Grade: 0.0/10
  
  → Best program: A (score 10.0)
  → A's code placed at end of context for next iteration
```

### 2. Final Solver Validation (Test-Time)

**When**: After all iterations complete, before database save  
**Purpose**: Compute actual accuracy metrics for analytics/leaderboards  
**How It Works**:
```
After iterations complete:
  1. Take bestProgram code
  2. Execute on TEST inputs (not training!) via runGroverTestExecution()
  3. Compare predicted outputs vs actual test outputs
  4. Compute binary correctness (exact match or not)
  5. Calculate trustworthiness score (using confidence from final iteration score)
  6. Save all metrics to database
```

**Key Characteristics**:
- Uses **test data only** (held-out evaluation data)
- Scoring is **objective** (exact grid comparison)
- Metrics: `isPredictionCorrect` (boolean), `predictionAccuracyScore` (0.0-1.0 trustworthiness)
- Purpose: **Evaluation** (reporting actual solver performance)
- **THIS IS WHAT WE'RE FIXING** - currently not implemented

**Example**:
```
Best program from iterations: transform_grid_program
Test inputs: [[[1,2],[3,4]], [[5,6],[7,8]]]
Test outputs: [[[2,4],[6,8]], [[10,12],[14,16]]]

Execute program:
  predictedOutput1: [[2,4],[6,8]] → Matches test[0].output ✓
  predictedOutput2: [[10,12],[14,16]] → Matches test[1].output ✓

Database fields:
  - has_multiple_predictions: true
  - multi_test_prediction_grids: [[[2,4],[6,8]], [[10,12],[14,16]]]
  - multi_test_all_correct: true
  - multi_test_average_accuracy: 1.0
  - is_prediction_correct: true (for analytics queries)
```

## Why Grover is Different

**Other Solvers** (Saturn, standard LLM):
- Single-shot: Generate prediction → Validate → Save
- Validation happens immediately after generation
- One validation system

**Grover**:
- Multi-iteration: Generate → Train-validate → Improve → Repeat → THEN test-validate → Save
- Training validation is part of the search loop
- Test validation is separate, final step
- Two validation systems

## The Bug We're Fixing

**Current State**:
```typescript
buildGroverResponse() {
  // After iterations, we have bestProgram code
  let predictedOutput = null;  // ← Always null!
  
  // STUB: "In production, this would go through Python sandbox"
  // Never actually runs bestProgram on test inputs
  
  return {
    predictedOutput: null,        // ← Saved to DB as NULL
    predictedOutputGrid: null,    // ← Saved to DB as NULL
    // All multi-test fields also null
  }
}
```

**Desired State**:
```typescript
async buildGroverResponse() {
  // After iterations, we have bestProgram code
  
  // Execute on TEST inputs to get predictions
  const result = await pythonBridge.runGroverTestExecution(
    bestProgram,
    testInputs
  );
  
  const predictedOutput = result.outputs[0];
  const multiplePredictedOutputs = result.outputs;
  
  return {
    predictedOutput,              // ← Actual predicted grid
    predictedOutputGrid,          // ← Actual predicted grid
    hasMultiplePredictions: true,
    multiplePredictedOutputs,     // ← All predicted grids
    // Ready for validation!
  }
}
```

## Implementation Plan

1. ✅ **Test Execution Infrastructure** (DONE)
   - Python executor accepts test mode
   - Bridge method `runGroverTestExecution()` added
   - `buildGroverResponse()` now generates predictions

2. ⏳ **Validation Integration** (NEXT)
   - Import `validateSolverResponse` and `validateSolverResponseMulti`
   - Call appropriate validator based on test count
   - Enrich response with correctness metrics

3. ⏳ **Controller Integration**
   - Ensure validated response flows to database
   - Verify all fields populated correctly

4. ⏳ **End-to-End Testing**
   - Run Grover on single-test puzzle
   - Run Grover on multi-test puzzle
   - Verify database fields populated
   - Check analytics/leaderboards show Grover results

## Key Insight

The confusion arose because **"validation" means different things in different contexts**:

- **During search** (training): "How good is this program?" (optimization metric)
- **After search** (testing): "Did this program solve the puzzle?" (evaluation metric)

Both are essential, but they're completely separate operations with different data, different purposes, and different outputs.
