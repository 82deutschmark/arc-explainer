# Grid Extraction & Validation Audit Report
**Date:** 2025-10-11  
**Author:** Cascade using Claude Sonnet 3.5  
**Severity:** 🔴 CRITICAL - Data loss in multi-test predictions

---

## Executive Summary

**CRITICAL FLAW DISCOVERED:** The multi-test validator (`responseValidator.ts`) is **HARDCODED** to look for exactly `predictedOutput1`, `predictedOutput2`, `predictedOutput3` and **IGNORES** the flexible extraction utilities that already exist.

**Impact:** When an AI returns grids in a different format, or returns only 1 out of 3 expected grids, **WE THROW AWAY VALID DATA**.

---

## The Problem

### What We Have (But Don't Use)

**`server/services/schemas/solver.ts`** - Lines 198-302 - **`extractPredictions()`**

This function is EXTREMELY flexible:
- ✅ Tries numbered fields (`predictedOutput1`, `predictedOutput2`, etc.)
- ✅ Falls back to array format (`multiplePredictedOutputs: [grid1, grid2]`)
- ✅ Supports field aliases: `output`, `solution`, `answer`, `result`
- ✅ Handles TestCase object format: `[{ TestCase: 1, output: grid1 }]`
- ✅ Handles single-grid responses for multi-test puzzles (returns array with 1 item)
- ✅ Validates grids using `validateGrid()` (checks 2D array, integers 0-9)

**`server/services/responseValidator.ts`** - Lines 305-364 - **`extractAllGridsFromText()`**

This function scans text for grids when structured data fails:
- ✅ Scans markdown code blocks
- ✅ Uses regex patterns to find `[[...]]` structures
- ✅ Returns ALL grids found in text
- ✅ Validates numeric content

### What We Actually Use (BROKEN)

**`server/services/responseValidator.ts`** - Lines 558-564:

```typescript
// CRITICAL FIX: Extract grids from _rawResponse where they actually exist
const rawResponse = response._rawResponse || response._providerRawResponse || {};
const predictedGrids: (number[][] | null)[] = [
  rawResponse.predictedOutput1 || analysisData.predictedOutput1 || response.predictedOutput1 || null,
  rawResponse.predictedOutput2 || analysisData.predictedOutput2 || response.predictedOutput2 || null,
  rawResponse.predictedOutput3 || analysisData.predictedOutput3 || response.predictedOutput3 || null
].slice(0, correctAnswers.length);
```

**Problems:**
1. ❌ **HARDCODED to 3 predictions max** - What if puzzle has 4 test cases?
2. ❌ **EXACT field name matching only** - Doesn't use `extractPredictions` aliases
3. ❌ **NO text fallback** - If structured fields missing, we give up
4. ❌ **ALL-OR-NOTHING** - If only 1 grid found, we lose it when expecting 3
5. ❌ **IMPORTED but UNUSED** - `extractPredictions` is imported at line 22 but NEVER CALLED

---

## Single-Test Validation (Less Broken)

**`server/services/responseValidator.ts`** - Lines 448-502:

```typescript
export function validateSolverResponse(
  response: any,
  correctAnswer: number[][],
  promptId: string,
  confidence: number | null = 50
): ValidationResult {
  // ...
  const predictedGrid = analysisData.predictedOutput;  // ❌ Only checks ONE field name
  
  if (!predictedGrid || !Array.isArray(predictedGrid)) {
    return {
      predictedGrid: null,
      isPredictionCorrect: false,
      // ...
    };
  }
  // ...
}
```

**Problems:**
1. ❌ **Only checks `predictedOutput`** - Doesn't check aliases
2. ❌ **NO text fallback** - If field missing, gives up
3. ❌ **Doesn't use `extractPredictions`** - Reinvents the wheel badly

---

## Text Extraction (Available But Unused)

**`server/services/responseValidator.ts`** - Lines 60-299:

`extractGridFromText()` - Single grid extraction with multiple strategies:
- Keyword search (after "predicted output:", "answer:", etc.)
- Markdown code block scanning
- Bracket matching `[[...]]`
- Multiple regex patterns

**Status:** ✅ Used by single-test validator as fallback... 
**WAIT NO:** Looking at line 480 - it's NOT USED! Single-test validator just checks `analysisData.predictedOutput` and gives up if missing!

---

## What Needs to Happen

### Immediate Fixes

#### 1. **Multi-Test Validator Rewrite**

**Current (BROKEN):**
```typescript
const predictedGrids: (number[][] | null)[] = [
  rawResponse.predictedOutput1 || analysisData.predictedOutput1 || response.predictedOutput1 || null,
  rawResponse.predictedOutput2 || analysisData.predictedOutput2 || response.predictedOutput2 || null,
  rawResponse.predictedOutput3 || analysisData.predictedOutput3 || response.predictedOutput3 || null
].slice(0, correctAnswers.length);
```

**Should Be:**
```typescript
// Step 1: Try extractPredictions (handles ALL field formats)
const extracted = extractPredictions(analysisData, correctAnswers.length);
let predictedGrids: (number[][] | null)[] = extracted.predictedOutputs || [];

// Step 2: If we got SOME grids but not enough, keep what we have
if (predictedGrids.length < correctAnswers.length) {
  logger.warn(`Only found ${predictedGrids.length}/${correctAnswers.length} grids from structured data`, 'validator');
}

// Step 3: If NO structured grids found, try text extraction
if (predictedGrids.length === 0 && analysisData.text) {
  const { grids } = extractAllGridsFromText(analysisData.text);
  if (grids.length > 0) {
    predictedGrids = grids;
    logger.info(`Recovered ${grids.length} grids from text extraction`, 'validator');
  }
}

// Step 4: Pad with nulls to match expected count
while (predictedGrids.length < correctAnswers.length) {
  predictedGrids.push(null);
}

// Step 5: Trim if we got too many
predictedGrids = predictedGrids.slice(0, correctAnswers.length);
```

#### 2. **Single-Test Validator Enhancement**

**Current (BROKEN):**
```typescript
const predictedGrid = analysisData.predictedOutput;

if (!predictedGrid || !Array.isArray(predictedGrid)) {
  return {
    predictedGrid: null,
    isPredictionCorrect: false,
    predictionAccuracyScore: calculateTrustworthinessScore(false, actualConfidence, hasConfidence),
    extractionMethod: 'no_predicted_output'
  };
}
```

**Should Be:**
```typescript
// Step 1: Try extractPredictions
const extracted = extractPredictions(analysisData, 1);
let predictedGrid = extracted.predictedOutput || extracted.predictedOutputs?.[0] || null;
let extractionMethod = 'extractPredictions';

// Step 2: Fallback to text extraction
if (!predictedGrid && analysisData.text) {
  const { grid, method } = extractGridFromText(analysisData.text);
  predictedGrid = grid;
  extractionMethod = method;
}

// Step 3: Final fallback - check _rawResponse directly
if (!predictedGrid && response._rawResponse) {
  const rawText = typeof response._rawResponse === 'string' 
    ? response._rawResponse 
    : JSON.stringify(response._rawResponse);
  const { grid, method } = extractGridFromText(rawText);
  predictedGrid = grid;
  extractionMethod = `raw_${method}`;
}

if (!predictedGrid) {
  return {
    predictedGrid: null,
    isPredictionCorrect: false,
    predictionAccuracyScore: calculateTrustworthinessScore(false, actualConfidence, hasConfidence),
    extractionMethod: 'all_methods_failed'
  };
}
```

#### 3. **Partial Success Handling**

When we get 1 out of 3 grids:
- ✅ **SAVE what we got** - Don't throw away valid data
- ✅ **Mark partial success** - `multiTestResults[0].isPredictionCorrect = ?` 
- ✅ **Calculate accuracy on available data** - 1 correct out of 1 available = 100% of what we got
- ✅ **Log the gap** - "Found 1/3 predictions, marking remaining as failed"

---

## Database Impact

**Current Schema** (supports this, no changes needed):
- `multiple_predicted_outputs` - JSONB array (can store 1, 2, or 3 grids)
- `multi_test_results` - JSONB array (can have varied results)
- `multi_test_all_correct` - Boolean (false if any missing or wrong)
- `multi_test_average_accuracy` - Numeric (can be calculated on partial data)

**What we're NOT doing:**
- Storing extraction method (should add this for debugging)
- Tracking "expected vs found" count (should add this)

---

## Test Cases That Are Failing

### Case 1: AI Returns Different Field Names
```json
{
  "output": [[1,2],[3,4]],  // ❌ We only check "predictedOutput"
  "confidence": 80
}
```

### Case 2: AI Returns Partial Multi-Test
```json
{
  "multiplePredictedOutputs": true,
  "predictedOutput1": [[1,2],[3,4]],  // ✅ We'd save this
  // Missing predictedOutput2, predictedOutput3  ❌ We mark as null but should still validate #1
}
```

### Case 3: AI Returns Text-Embedded Grids
```text
Based on the pattern, the answer is:
```
[[1,2,3],
 [4,5,6]]
```
End of prediction.
```
// ❌ We have extractGridFromText but DON'T USE IT in validators!

### Case 4: AI Returns Array Format
```json
{
  "multiplePredictedOutputs": [
    [[1,2],[3,4]],
    [[5,6],[7,8]]
  ],
  "confidence": 70
}
```
// ✅ extractPredictions handles this, but validator doesn't call it!

---

## Action Plan

### Phase 1: Emergency Fixes (Do Now)
1. ✅ **Rewrite `validateSolverResponseMulti`** to use `extractPredictions`
2. ✅ **Rewrite `validateSolverResponse`** to use `extractPredictions`
3. ✅ **Add text extraction fallback** to both validators
4. ✅ **Support partial predictions** (don't throw away 1/3 success)

### Phase 2: Schema Simplification (After Fix)
1. Update schemas to use simple `predictions: number[][][]` array
2. Let validators handle the extraction complexity
3. Remove `predictedOutput1-3` from schema requirements

### Phase 3: Recovery (After Deploy)
1. Run recovery script on existing database entries with null predictions
2. Re-parse `provider_raw_response` field using new flexible extractors
3. Update database with recovered grids

---

## Files Requiring Changes

### Critical (Fix Now):
- [ ] `server/services/responseValidator.ts` 
  - Lines 448-502: `validateSolverResponse()` - Add extractPredictions + fallbacks
  - Lines 517-625: `validateSolverResponseMulti()` - Add extractPredictions + fallbacks

### Supporting (After Main Fix):
- [ ] `server/services/schemas/arcJsonSchema.ts` - Simplify multi-prediction structure
- [ ] `server/services/schemas/grokJsonSchema.ts` - Match simplified structure
- [ ] `server/services/anthropic.ts` - Update inline schema

### Testing:
- [ ] Create test suite for grid extraction edge cases
- [ ] Test partial prediction handling
- [ ] Test text extraction fallbacks

---

**END OF AUDIT**
