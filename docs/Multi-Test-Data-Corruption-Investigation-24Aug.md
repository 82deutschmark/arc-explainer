# Multi-Test Data Corruption Investigation - August 24, 2025

## Executive Summary

We have discovered a **critical data corruption bug** affecting multi-test ARC puzzles where predicted output grids are systematically corrupted during storage, rendering multi-test functionality completely broken. This document captures our investigation methodology, key findings, and path to resolution.

## Problem Statement

### Symptoms
- Multi-test puzzles (requiring 2+ predictions) display empty or corrupted results in the frontend
- Database contains malformed data instead of proper JSON arrays
- All multi-test functionality is broken across the application

### Scope
- Affects: Puzzles like `27a28665.json` (3 tests) and `20a9e565.json` (2 tests)
- Impact: Complete failure of multi-test prediction storage and display
- Duration: Unknown, but affects all historical multi-test data

## Investigation Methodology

### 1. User Report Analysis
- User reported dimension mismatch errors in logs, initially thought to be validation issue
- Logs showed extraction working but "wrong dimensions" - this was actually expected behavior
- Real issue was multi-test data not displaying in frontend

### 2. Database Investigation
- Direct PostgreSQL queries revealed systematic data corruption
- Created `debug-db.js` script to examine stored multi-test data
- Analyzed 10+ database entries across different models and time periods

### 3. Data Flow Tracing
- Added debug logging to controller and database service
- Traced data from AI response → extraction → validation → storage
- Used live server analysis to capture corruption in real-time

## Critical Findings

### 1. Consistent Corruption Pattern
**Every single multi-test database entry shows identical corruption:**

```sql
-- Expected: Proper JSON arrays
multiple_predicted_outputs: [[[1]], [[6]], [[2]]]
multi_test_results: [{"index":0,"isPredictionCorrect":true}, ...]

-- Actual: Corrupted strings  
multiple_predicted_outputs: "1,6,2"
multi_test_results: "[object Object],[object Object],[object Object]"
```

### 2. Array Structure Loss (3D → 1D → String)
**The corruption follows this pattern:**
1. **Correct**: `[[[1]], [[6]], [[2]]]` (3D array: array of 2D grids)
2. **Corrupted**: `[1, 6, 2]` (1D array: flattened values)  
3. **Stored**: `"1,6,2"` (String: Array.toString() result)

### 3. Object Serialization Failure
**Validation objects become "[object Object]":**
- Expected: `[{"index":0,"isPredictionCorrect":true,"predictionAccuracyScore":0.8}, ...]`
- Stored: `"[object Object],[object Object],[object Object]"`

### 4. Scale of Data Corruption
**Large grids produce massive corrupted strings:**
```
Raw multiplePredictedOutputs: 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0...
```

## Data Flow Analysis

### Expected Data Pipeline
```
1. AI Response     → {"predictedOutput1": [[1]], "predictedOutput2": [[6]], ...}
2. Extraction      → collects into [[[1]], [[6]], [[2]]]
3. Validation      → processes each 2D grid, returns validation objects
4. Controller      → assigns arrays to result object
5. Database        → JSON.stringify() → PostgreSQL JSONB storage
6. Retrieval       → JSON.parse() → proper arrays for frontend
```

### Actual Corruption Point
```
1. AI Response     → {"predictedOutput1": [[1]], "predictedOutput2": [[6]], ...} ✓
2. Extraction      → ??? (CORRUPTION OCCURS HERE) ???
3. Validation      → receives flattened [1,6,2] instead of [[[1]], [[6]], [[2]]]
4. Controller      → assigns corrupted data
5. Database        → stores Array.toString() result: "1,6,2"
6. Retrieval       → "[object Object]" parsing errors
```

## Evidence Analysis

### Pattern Recognition
**Corruption signatures reveal the source:**

| Database Value | Inferred Original | Corruption Type |
|---------------|------------------|-----------------|
| `"6,1,2"` | `[[[6]], [[1]], [[2]]]` | 3D→1D→String |
| `"4,,"` | `[[[4]], [[]], [[]]]` | 3D→1D→String (empty grids) |
| `"6,,"` | `[[[6]], [[]], [[]]]` | 3D→1D→String (partial) |
| `"[object Object],..."` | `[{validation1}, {validation2}, ...]` | Object→String |

### ARC Puzzle Complexity Insight
**Real ARC puzzle answers are much larger than expected:**
- Test 1: `2×21` grid (42 numbers)
- Test 2: `8×17` grid (136 numbers)  
- Combined: ~300+ numbers when flattened
- Explains the massive comma-separated strings in recent entries

## Root Cause Hypotheses

### Hypothesis 1: Extraction Logic Flattening ⭐ MOST LIKELY
**Location**: `server/services/schemas/solver.ts:extractPredictions()`
- AI returns proper structure, but extraction flattens 3D to 1D
- Nested array handling may be incorrect
- Would explain consistent 3D→1D corruption pattern

### Hypothesis 2: Validation Processing Error
**Location**: `server/services/responseValidator.ts:validateSolverResponseMulti()`
- Validation receives correct data but processes it incorrectly
- Array manipulation during validation corrupts structure
- Less likely given the systematic nature

### Hypothesis 3: Controller Assignment Issue
**Location**: `server/controllers/puzzleController.ts`
- Object spreading or assignment corrupts arrays
- Express middleware interference
- Would affect all array data uniformly

### Hypothesis 4: PostgreSQL Parameter Binding (RULED OUT)
- `safeJsonStringify()` function exists and is called
- Column type is correct (JSONB)
- Corruption patterns indicate JavaScript-level issue

## Test Strategy

### Current Test: 1×1 Grid Analysis
**Purpose**: Isolate array structure vs. data size issues

**Setup**: Multi-test puzzle where each answer is single number
- Expected: `[[[6]], [[1]], [[2]]]` (clean 3D structure)
- If corrupted as: `"6,1,2"` → confirms 3D→1D flattening
- If stored correctly → indicates large data size issue

**Predicted Outcome**: Will see `"6,1,2"` pattern, confirming array structure corruption

### Debug Logging Added
```javascript
// Controller logging
console.log('multi.predictedGrids type:', typeof multi.predictedGrids, 'isArray:', Array.isArray(multi.predictedGrids));

// Database service logging  
logger.info(`multiplePredictedOutputs type: ${typeof multiplePredictedOutputs}, isArray: ${Array.isArray(multiplePredictedOutputs)}`);
```

## Technical Architecture Context

### Database Schema (Correct)
```sql
ALTER TABLE explanations ADD COLUMN multiple_predicted_outputs JSONB;
ALTER TABLE explanations ADD COLUMN multi_test_results JSONB;
```

### Frontend Display (Ready)
- `AnalysisResultCard.tsx` correctly handles multi-test display
- Renders side-by-side predicted vs expected grids
- Iterates over `expectedOutputGrids.length > 1`
- Issue is purely data pipeline corruption

### AI Response Format (Working)
```json
{
  "multiplePredictedOutputs": true,
  "predictedOutput1": [[1]],
  "predictedOutput2": [[6]], 
  "predictedOutput3": [[2]]
}
```

## Next Steps

### Phase 1: Confirm Root Cause
1. **Analyze 1×1 test results** → Should show `"6,1,2"` pattern
2. **Check debug logs** → Identify exact corruption point
3. **Trace data through extraction** → Verify hypothesis

### Phase 2: Fix Array Structure Preservation  
1. **Fix `extractPredictions()` logic** → Maintain 3D structure
2. **Fix validation processing** → Handle 3D arrays correctly
3. **Add structure validation** → Prevent future corruption

### Phase 3: Data Migration & Validation
1. **Test fix with live analysis** → Verify proper storage
2. **Consider data migration** → Fix historical corrupted entries
3. **Add monitoring** → Detect future corruption

### Phase 4: Comprehensive Testing
1. **Test simple multi-test cases** → 1×1 grids
2. **Test complex cases** → Large grids like `20a9e565`
3. **Test edge cases** → Empty grids, malformed responses
4. **Frontend integration testing** → End-to-end verification

## Risk Assessment

### Impact: **CRITICAL**
- Complete failure of multi-test functionality
- All historical multi-test data corrupted and unusable
- Core ARC puzzle analysis broken for complex puzzles

### Urgency: **HIGH**  
- Issue affects user experience immediately
- Data corruption is ongoing with each analysis
- Complex puzzles cannot be properly analyzed

### Complexity: **MEDIUM**
- Root cause appears localized to extraction/validation logic
- Fix likely requires careful array handling preservation
- Extensive testing needed due to data structure complexity

## Lessons Learned

### Investigation Methodology
1. **Start with data examination** → Database investigation revealed true scope
2. **Look for patterns** → Corruption signatures pointed to root cause
3. **Test incrementally** → 1×1 grid test isolates variables
4. **Preserve insights** → Documentation prevents lost analysis

### Technical Insights  
1. **PostgreSQL parameter binding** → Can cause unexpected serialization
2. **3D array complexity** → Easy to lose structure in processing
3. **ARC puzzle scale** → Real answers much larger than test cases
4. **End-to-end testing critical** → Issues span multiple system layers

---

*This investigation demonstrates the critical importance of comprehensive data flow testing and the value of systematic debugging when dealing with complex data structures.*