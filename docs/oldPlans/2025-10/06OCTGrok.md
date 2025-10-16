# Grok.ts Architecture Analysis & Recommendations

**Author:** Cascade using Claude Sonnet 4.5  
**Date:** 2025-10-06  
**Purpose:** Comprehensive analysis of grok.ts service implementation and recommendations for fixing structured output and prompt complexity issues.

---

## Executive Summary

**Current State:** Grok-4 integration is functional but suboptimal due to:
1. Complex ARC_JSON_SCHEMA rejected by xAI (503 "Grammar is too complex")
2. Structured output disabled globally for all grok-4 models
3. Heavy system prompts still sent despite schema being disabled
4. Inconsistent model capability reporting vs actual behavior

**Recommended Solution:** Implement a lightweight JSON schema specifically for Grok-4 models, or use prompt-based JSON validation only.

---

## Current Implementation Analysis

### 1. Structured Output Handling (Lines 414-432)

```typescript
// Line 416-417: DISABLED for all grok-4 models
const supportsStructuredOutput = !requestData.model.startsWith('grok-4') &&
                                  !requestData.model.includes('grok-code-fast');

// Lines 423-432: Schema only sent if enabled (never for grok-4)
...(supportsStructuredOutput && {
  text: {
    format: {
      type: "json_schema",
      name: ARC_JSON_SCHEMA.name,
      strict: ARC_JSON_SCHEMA.strict,
      schema: ARC_JSON_SCHEMA.schema
    }
  }
}),
```

**Status:** ✅ Correctly disables schema due to 503 errors  
**Issue:** ❌ But heavy prompts still sent with complex JSON instructions

### 2. Model Info Reporting (Lines 110-130)

```typescript
// Line 118: Claims grok-4 supports structured output
const supportsStructuredOutput = modelName.includes('grok-4');
```

**Status:** ❌ INCONSISTENT  
- `getModelInfo()` says grok-4 supports structured output  
- `callResponsesAPI()` disables it for all grok-4 models  
- This creates confusion for downstream consumers

### 3. Prompt Building (Lines 374-405)

```typescript
// Uses inherited buildPromptPackage() from BaseAIService
const promptPackage = this.buildPromptPackage(task, promptId, customPrompt, options, serviceOpts);
```

**Status:** ⚠️ PROBLEM  
- Loads full `solver` prompt with ALL complexity:
  - Transformation type taxonomy
  - Multi-prediction field instructions  
  - Detailed JSON field requirements
  - Grid format specifications
- No differentiation for models that don't use structured output

### 4. Schema Complexity (ARC_JSON_SCHEMA)

**Current schema issues:**
- 102 lines of strict validation rules
- 9 required fields (including 3 prediction grids always required)
- Complex nested array structures
- Description text for every field
- `additionalProperties: false` restriction
- All prediction fields required even if only 1 test case

**xAI's rejection reason:**
```
503 Service Unavailable
{"code":"The service is currently unavailable","error":"Grammar is too complex."}
```

---

## Root Cause Analysis

### Why Grok-4 Rejects the Schema

1. **Schema Complexity**
   - 9 required fields (too many)
   - Nested 2D array validation (complex type inference)
   - Strict mode with no additional properties
   - Multiple conditional fields (predictedOutput1/2/3)

2. **xAI's Structured Output Limitations**
   - Less mature than OpenAI's implementation
   - May not support `additionalProperties: false`
   - May have token/complexity limits on schema
   - Documentation unclear on exact limitations

3. **Prompt + Schema Overload**
   - Heavy system prompt PLUS complex schema = too much
   - Model gets conflicting instructions (prompt says "do X", schema enforces "Y")

---

## Recommended Solutions

### Option 1: Lightweight Grok-Specific Schema (RECOMMENDED)

Create a simplified schema just for Grok-4:

```typescript
// New file: server/services/schemas/grokJsonSchema.ts
export const GROK_JSON_SCHEMA = {
  name: "grok_analysis",
  strict: false, // Less strict validation
  schema: {
    type: "object",
    properties: {
      // Prediction fields (simplified)
      predictedOutput: {
        type: "array",
        description: "2D array grid"
      },
      
      // Core analysis (minimal)
      patternDescription: {
        type: "string"
      },
      solvingStrategy: {
        type: "string"
      },
      hints: {
        type: "array"
      },
      confidence: {
        type: "integer"
      }
    },
    required: ["predictedOutput", "patternDescription", "confidence"]
    // No additionalProperties restriction
    // No nested type validation
    // Only 3 required fields instead of 9
  }
};
```

**Changes to grok.ts:**

```typescript
// Line 34: Import lightweight schema
import { GROK_JSON_SCHEMA } from "./schemas/grokJsonSchema.js";

// Lines 416-432: Use lightweight schema for grok-4
const supportsStructuredOutput = requestData.model.startsWith('grok-4');

const body = {
  model: requestData.model,
  input: requestData.input,
  ...(supportsStructuredOutput && {
    text: {
      format: {
        type: "json_schema",
        name: GROK_JSON_SCHEMA.name,
        strict: GROK_JSON_SCHEMA.strict,
        schema: GROK_JSON_SCHEMA.schema // Use Grok-specific schema
      }
    }
  }),
  // ... rest
};
```

**Pros:**
- ✅ Maintains some structured output validation
- ✅ Much simpler schema likely accepted by xAI
- ✅ Still ensures core fields present
- ✅ Parser can handle extra fields

**Cons:**
- ⚠️ Less strict validation than OpenAI
- ⚠️ May need separate schema file
- ⚠️ Need to test if xAI accepts this

---

### Option 2: Prompt-Based JSON Only (SAFEST)

Remove schema entirely, rely on prompt instructions:

```typescript
// Lines 416-432: Keep structured output disabled
const supportsStructuredOutput = false; // Always false for grok-4

// No schema sent to API
const body = {
  model: requestData.model,
  input: requestData.input,
  // No text.format field
  temperature: ...,
  previous_response_id: ...,
  store: ...
};
```

**Required: Simplify system prompt for Grok-4**

Create minimal prompt variant:

```typescript
// In basePrompts.ts
export const TASK_DESCRIPTIONS = {
  // ... existing prompts ...
  
  minimalSolver: `Analyze the training examples to identify the transformation pattern.
Predict the output grid(s) for the test case(s).`
};

export const ADDITIONAL_INSTRUCTIONS = {
  // ... existing instructions ...
  
  minimalSolver: `Return valid JSON with these fields:
- predictedOutput: 2D array (single test) or empty array (multi-test)
- predictedOutput1, predictedOutput2, predictedOutput3: 2D arrays (if multi-test)
- multiplePredictedOutputs: boolean
- patternDescription: string explaining the transformation
- solvingStrategy: string with solving approach
- hints: array of strings
- confidence: integer 1-100`
};
```

**Pros:**
- ✅ Guaranteed to work (no schema rejection)
- ✅ Simplest implementation
- ✅ Parser already handles this
- ✅ No xAI-specific schema maintenance

**Cons:**
- ❌ No structured validation from provider
- ❌ Relies entirely on model following instructions
- ❌ Parser must handle more edge cases

---

### Option 3: Hybrid Approach (MOST FLEXIBLE)

Use lightweight schema + minimal prompt:

```typescript
// For grok-4: Use GROK_JSON_SCHEMA (simplified) + minimal prompt
// For other models: Use ARC_JSON_SCHEMA (full) + detailed prompt

const isGrokModel = requestData.model.startsWith('grok-4');

const schema = isGrokModel ? GROK_JSON_SCHEMA : ARC_JSON_SCHEMA;
const supportsStructuredOutput = true; // Try with lightweight schema

// Prompt building in analyzePuzzleWithModel:
const promptId = isGrokModel && serviceOpts.useMinimalPrompt 
  ? 'minimalSolver' 
  : 'solver';
```

**Pros:**
- ✅ Best of both worlds
- ✅ Lightweight for Grok, strict for others
- ✅ Maintains validation where possible
- ✅ Graceful degradation

**Cons:**
- ⚠️ More complex logic
- ⚠️ Need to maintain two schemas
- ⚠️ Need minimal prompt variant

---

## Specific Code Changes Required

### 1. Fix getModelInfo() Inconsistency

**File:** `server/services/grok.ts` (lines 110-130)

**Current:**
```typescript
const supportsStructuredOutput = modelName.includes('grok-4');
```

**Fix:**
```typescript
// Reflect actual behavior: structured output currently disabled
const supportsStructuredOutput = false; // Grok-4 rejects complex schemas
// OR if implementing Option 1:
const supportsStructuredOutput = modelName.includes('grok-4'); // With lightweight schema
```

### 2. Create Lightweight Schema (Option 1)

**New File:** `server/services/schemas/grokJsonSchema.ts`

```typescript
/**
 * Simplified JSON Schema for xAI Grok models
 * xAI's structured output has limitations:
 * - Cannot handle complex nested validations
 * - Strict mode causes "Grammar is too complex" errors
 * - Needs minimal required fields
 * 
 * This schema provides basic structure validation without overwhelming the model.
 * 
 * @author Cascade using Claude Sonnet 4.5
 * @date 2025-10-06
 */

export const GROK_JSON_SCHEMA = {
  name: "grok_analysis",
  strict: false,
  schema: {
    type: "object",
    properties: {
      multiplePredictedOutputs: {
        type: "boolean",
        description: "True if multiple test cases"
      },
      predictedOutput: {
        type: "array",
        description: "2D array for single test, empty for multi-test"
      },
      predictedOutput1: {
        type: "array",
        description: "First prediction grid (multi-test)"
      },
      predictedOutput2: {
        type: "array",
        description: "Second prediction grid (multi-test)"
      },
      predictedOutput3: {
        type: "array",
        description: "Third prediction grid (multi-test)"
      },
      patternDescription: {
        type: "string",
        description: "Transformation explanation"
      },
      solvingStrategy: {
        type: "string",
        description: "Solution approach"
      },
      hints: {
        type: "array",
        description: "Hints array"
      },
      confidence: {
        type: "integer",
        description: "Confidence 1-100"
      }
    },
    required: ["multiplePredictedOutputs", "predictedOutput", "patternDescription", "confidence"]
  }
} as const;
```

### 3. Update grok.ts to Use Lightweight Schema

**File:** `server/services/grok.ts`

**Line 34:** Add import
```typescript
import { GROK_JSON_SCHEMA } from "./schemas/grokJsonSchema.js";
```

**Lines 416-432:** Replace with
```typescript
// Try structured output with lightweight schema
const supportsStructuredOutput = requestData.model.startsWith('grok-4');

const body = {
  model: requestData.model,
  input: Array.isArray(requestData.input) ? requestData.input : [{ role: "user", content: requestData.input }],
  ...(supportsStructuredOutput && {
    text: {
      format: {
        type: "json_schema",
        name: GROK_JSON_SCHEMA.name,
        strict: GROK_JSON_SCHEMA.strict,
        schema: GROK_JSON_SCHEMA.schema
      }
    }
  }),
  temperature: modelSupportsTemperature(modelKey) ? requestData.temperature : undefined,
  parallel_tool_calls: false,
  truncation: "auto",
  previous_response_id: requestData.previous_response_id,
  store: requestData.store !== false
};
```

### 4. Update Batch Scripts (If Using Option 2)

**Files:** 
- `scripts/grok-4-test.ts`
- `scripts/grok-4.ts`
- `scripts/grok-4-fast-reasoning-test.ts`
- `scripts/grok-4-fast-reasoning.ts`
- `scripts/grok-4-fast-non-reasoning-test.ts`
- `scripts/grok-4-fast-non-reasoning.ts`

**Change:**
```typescript
// Current:
const requestBody = {
  temperature: 0.2,
  promptId: 'solver', // Heavy prompt
  systemPromptMode: 'ARC',
  omitAnswer: true,
  retryMode: false
};

// Option 2 (prompt-based only):
const requestBody = {
  temperature: 0.2,
  promptId: 'minimalSolver', // NEW: Lightweight prompt
  systemPromptMode: 'ARC',
  omitAnswer: true,
  retryMode: false
};

// Option 3 (hybrid):
const requestBody = {
  temperature: 0.2,
  promptId: 'solver',
  systemPromptMode: 'ARC',
  omitAnswer: true,
  retryMode: false,
  useMinimalPrompt: true // NEW: Flag for Grok models
};
```

---

## Testing Plan

### Phase 1: Test Lightweight Schema (Option 1)
1. Implement `GROK_JSON_SCHEMA` 
2. Update grok.ts to use it
3. Test with single puzzle: `node --import tsx scripts/grok-4-test.ts 42a15761`
4. Verify no 503 errors
5. Verify response contains all fields

### Phase 2: Test Batch Processing
1. Run small batch: `node --import tsx scripts/grok-4-fast-non-reasoning.ts 42a15761 00d62c1b`
2. Verify all puzzles process successfully
3. Check database for complete data

### Phase 3: Compare Performance
1. Record response times with lightweight schema
2. Compare to current implementation (no schema)
3. Measure accuracy of predictions

---

## Migration Strategy

### Immediate (Today)
1. ✅ Document current issues (this file)
2. ⬜ Commit current working state
3. ⬜ Create `grokJsonSchema.ts` with lightweight schema
4. ⬜ Test lightweight schema with single puzzle

### Short-Term (Next Session)
1. ⬜ If lightweight schema works: Update grok.ts permanently
2. ⬜ If lightweight schema fails: Stick with Option 2 (prompt-only)
3. ⬜ Update batch scripts if needed
4. ⬜ Document final decision in CHANGELOG

### Long-Term (Future)
1. ⬜ Monitor xAI documentation for structured output updates
2. ⬜ Re-evaluate when xAI improves schema support
3. ⬜ Consider requesting xAI to increase schema complexity limits

---

## Recommendations Priority

### **Priority 1: Fix getModelInfo() Inconsistency**
**Impact:** High  
**Effort:** Low (5 minutes)  
**File:** `server/services/grok.ts` line 118  

Change to reflect reality:
```typescript
const supportsStructuredOutput = false; // Currently disabled due to xAI limitations
```

### **Priority 2: Test Lightweight Schema**
**Impact:** High  
**Effort:** Medium (30 minutes)  
**Files:** Create `grokJsonSchema.ts`, update `grok.ts`

If successful, this is the best solution.

### **Priority 3: Document Status Quo**
**Impact:** Medium  
**Effort:** Low (done - this file)  
**Files:** This document

Users need to know current state and limitations.

---

## Conclusion

**Current Implementation:** ✅ Functional but suboptimal
- Structured output disabled (correct)
- Heavy prompts still sent (unnecessary)
- Inconsistent capability reporting (misleading)

**Recommended Path Forward:**

1. **Today:** Fix `getModelInfo()` inconsistency, commit current state
2. **Next:** Test lightweight schema (Option 1)
3. **If works:** Implement lightweight schema permanently
4. **If fails:** Use prompt-based validation only (Option 2)

**Key Insight:**
The problem isn't Grok-4's capabilities - it's our schema complexity. A simpler schema may work perfectly, and if not, prompt-based validation is proven and reliable.

---

## Files Modified in This Analysis

1. ✅ **docs/06OCTGrok.md** - This document (NEW)
2. ⬜ **server/services/schemas/grokJsonSchema.ts** - Lightweight schema (TO CREATE)
3. ⬜ **server/services/grok.ts** - Use lightweight schema (TO UPDATE)
4. ⬜ **CHANGELOG.md** - Document changes (TO UPDATE)

---

## End of Analysis

**Next Action:** Commit this analysis and current working state, then test lightweight schema approach in next session.
