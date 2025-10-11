# JSON Schema Investigation Report
**Date:** 2025-10-11  
**Author:** Cascade using Claude Sonnet 3.5  
**Purpose:** Deep dive into JSON schema enforcement across all AI service providers

---

## Executive Summary

The project uses **multiple inconsistent approaches** for enforcing JSON structured output across different AI providers. This creates:
- Schema drift between providers
- Maintenance complexity
- Potential field mismatch issues
- Difficulty tracking what fields are actually required

---

## Provider-by-Provider Analysis

### 1. **OpenAI Service** (`openai.ts`)
**Approach:** Responses API with `text.format.json_schema`

```typescript
// Uses ARC_JSON_SCHEMA from schemas/arcJsonSchema.ts
text: {
  format: {
    type: "json_schema",
    name: "arc_analysis",      // ✅ Has name
    strict: true,              // ✅ Strict mode enabled
    schema: ARC_JSON_SCHEMA.schema
  }
}
```

**Schema Definition:**
- **Source:** `server/services/schemas/arcJsonSchema.ts`
- **Fields:** `multiplePredictedOutputs`, `predictedOutput`, `predictedOutput1-3`, `solvingStrategy`, `patternDescription`, `hints`, `confidence`
- **All fields REQUIRED:** ✅ Yes
- **Enforcement:** Native OpenAI structured output (strict validation)

---

### 2. **Grok Service** (`grok.ts`)
**Approach:** xAI Responses API with `response_format.json_schema`

```typescript
// Uses GROK_JSON_SCHEMA from schemas/grokJsonSchema.ts
response_format: {
  type: "json_schema",
  json_schema: GROK_JSON_SCHEMA.schema
}
```

**Schema Definition (BEFORE my fix):**
- **Source:** `server/services/schemas/grokJsonSchema.ts`
- **Fields:** `multiplePredictedOutputs`, `predictedOutput`, `predictedOutput1-3`, `confidence`
- ⚠️ **MISSING:** `solvingStrategy`, `patternDescription`, `hints`
- ⚠️ **Only 2 fields required** (vs OpenAI's 9)
- **Enforcement:** xAI structured output (retries with fallback if grammar error)

**Schema Definition (AFTER my fix):**
- ✅ Now matches OpenAI schema fields exactly
- ✅ All 9 fields required
- **Note:** No `name`/`strict` properties (per xAI API docs)

---

### 3. **Anthropic Service** (`anthropic.ts`)
**Approach:** Tool Use API with custom schema definition

```typescript
// Schema defined INLINE in callProviderAPI() method
analysisTools = [{
  name: "provide_puzzle_analysis",
  description: "Analyze the ARC puzzle...",
  input_schema: {
    type: "object",
    properties: {
      patternDescription: { type: "string", ... },
      solvingStrategy: { type: "string", ... },
      reasoningItems: { type: "array", ... },  // ⚠️ ONLY in Anthropic
      hints: { type: "array", ... },
      confidence: { type: "integer", min: 0, max: 100 },
      multiplePredictedOutputs: { type: "boolean", ... },
      predictedOutput: { type: "array", ... },
      predictedOutput1-3: { type: "array", ... }
    },
    required: [all 9 fields + reasoningItems]
  }
}]
```

**Key Differences:**
- ✅ Has all standard fields
- ✅ Adds `reasoningItems` as REQUIRED (not in OpenAI/Grok schemas)
- ⚠️ Uses `minimum`/`maximum` constraints on confidence (not in other schemas)
- ⚠️ Schema hardcoded in service file (not imported from shared schema)
- **Enforcement:** Claude Tool Use API forces tool call

---

### 4. **Gemini Service** (`gemini.ts`)
**Approach:** Prompt-based JSON request with `responseMimeType`

```typescript
// NO EXPLICIT SCHEMA - relies on prompt instructions
generationConfig: {
  responseMimeType: "application/json",  // ⚠️ Only specifies JSON, not structure
  temperature: ...,
  candidateCount: ...,
  thinkingConfig: { mode: "thinking" }  // For 2.5 models
}
```

**Key Issues:**
- ❌ **NO SCHEMA ENFORCEMENT** - only asks for JSON format
- ❌ Relies entirely on prompt to describe structure
- ⚠️ Uses `jsonParser.parse()` to extract/validate response
- ⚠️ No guarantee fields match OpenAI schema
- **Enforcement:** Parser extracts JSON from text, no structural validation

---

### 5. **DeepSeek Service** (`deepseek.ts`)
**Approach:** Prompt-based JSON request (no schema)

```typescript
// NO response_format, NO schema enforcement
const response = await deepseek.chat.completions.create({
  model: modelName,
  messages,
  temperature
});
```

**Key Issues:**
- ❌ **NO JSON ENFORCEMENT AT ALL**
- ❌ Relies 100% on prompt instructions
- ⚠️ Uses `jsonParser.parse()` to extract response
- ⚠️ No validation, no schema matching
- **Enforcement:** None - hopes AI returns valid JSON

---

### 6. **OpenRouter Service** (`openrouter.ts`)
**Approach:** Basic `response_format` with type only

```typescript
if (supportsStructuredOutput) {
  payload.response_format = { type: "json_object" }  // ⚠️ No schema
}
```

**Key Issues:**
- ⚠️ Only requests JSON object format
- ❌ NO SCHEMA provided
- ⚠️ Relies on prompt for field structure
- **Enforcement:** Minimal - just ensures JSON output

---

## Schema Comparison Matrix

| Provider | Schema File | Fields Complete? | Required Fields | Enforcement Level |
|----------|-------------|------------------|-----------------|-------------------|
| **OpenAI** | `arcJsonSchema.ts` | ✅ All 9 fields | All 9 | 🟢 Strict (native) |
| **Grok** | `grokJsonSchema.ts` | ✅ All 9 (NOW) | All 9 (NOW) | 🟢 Strict (native) |
| **Anthropic** | Inline in service | ✅ + reasoningItems | All 10 | 🟢 Tool Use API |
| **Gemini** | None | ❌ Prompt-based | 0 | 🟡 MIME type only |
| **DeepSeek** | None | ❌ Prompt-based | 0 | 🔴 None |
| **OpenRouter** | None | ❌ Prompt-based | 0 | 🟡 JSON object only |

---

## Critical Issues Identified

### 1. **Schema Redundancy**
The user is correct - we have redundant schema definitions:

```typescript
// ARC_JSON_SCHEMA.ts - Lines 24-60
multiplePredictedOutputs: { type: "boolean", ... },
predictedOutput: { type: "array", ... },
predictedOutput1: { type: "array", ... },
predictedOutput2: { type: "array", ... },
predictedOutput3: { type: "array", ... },
```

**Problem:** The multi-prediction logic is enforced in the schema but should be handled by our validator. The AI shouldn't need to know about `predictedOutput1-3` structure - it should just return predictions and we parse them.

### 2. **No Single Source of Truth**
- OpenAI uses `arcJsonSchema.ts`
- Grok uses `grokJsonSchema.ts` (now matching, but separate)
- Anthropic hardcodes schema inline
- Gemini/DeepSeek/OpenRouter have NO schema

### 3. **Field Description Inconsistencies**
- `solvingStrategy` description varies:
  - OpenAI: "Clear explanation... written as pseudo-code"
  - Anthropic: "Clear explanation... as a few logical easy steps"
  - User just changed OpenAI to: "easy for a child to understand and apply"

### 4. **Provider-Specific Extensions**
- Anthropic adds `reasoningItems` as REQUIRED
- Anthropic uses min/max constraints (0-100) on confidence
- Other providers don't enforce constraints

---

## Recommendations

### Option A: **Unified Base Schema (DRY Approach)**
Create a single source of truth that all providers adapt:

```typescript
// server/services/schemas/baseArcSchema.ts
export const BASE_ARC_SCHEMA_PROPERTIES = {
  solvingStrategy: { ... },
  patternDescription: { ... },
  hints: { ... },
  confidence: { ... },
  // Prediction handling simplified - let validator deal with multi-test logic
  predictions: {
    type: "array",
    items: { 
      type: "array",
      items: { type: "array", items: { type: "integer" }}
    },
    description: "Array of predicted output grids, one per test input"
  }
};

export const BASE_REQUIRED_FIELDS = [
  "solvingStrategy",
  "patternDescription", 
  "hints",
  "confidence",
  "predictions"
];
```

Then each provider imports and adapts:
```typescript
// openai schema
export const ARC_JSON_SCHEMA = {
  name: "arc_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: BASE_ARC_SCHEMA_PROPERTIES,
    required: BASE_REQUIRED_FIELDS
  }
};

// grok schema  
export const GROK_JSON_SCHEMA = {
  schema: {
    type: "object",
    properties: BASE_ARC_SCHEMA_PROPERTIES,
    required: BASE_REQUIRED_FIELDS
  }
};
```

### Option B: **Prompt-Only Enforcement (Simplest)**
Remove all schemas except for OpenAI/Grok (which require them). Let the prompt handle structure for others. Accept that we'll get varying quality.

### Option C: **Provider Adapters (Current State + Cleanup)**
Keep provider-specific schemas but:
1. Extract common fields to shared constant
2. Document differences explicitly
3. Ensure all schemas match core fields
4. Let validator handle multi-prediction complexity

---

## Immediate Action Items

1. **Fix schema redundancy** - Simplify multi-prediction handling
2. **Sync field descriptions** - User's "easy for a child" change needs to propagate
3. **Add schema to Gemini/DeepSeek** - Or document why they don't have one
4. **Extract Anthropic's inline schema** - Move to schema file
5. **Create schema test suite** - Validate all providers request same fields

---

## Questions for User

1. **Should we simplify the multi-prediction schema?** Remove `predictedOutput1-3` and just use an array?
2. **Which approach do you prefer?** Unified base schema (A), prompt-only (B), or current with cleanup (C)?
3. **Should `reasoningItems` be standard?** Anthropic requires it - should others?
4. **Do we need schema validation tests?** Automated checks that all providers match?

---

## Files Requiring Updates

Based on chosen approach:

**Immediate (regardless of approach):**
- [ ] `server/services/schemas/arcJsonSchema.ts` - Sync descriptions, consider simplification
- [ ] `server/services/schemas/grokJsonSchema.ts` - Already updated to match OpenAI
- [ ] `server/services/anthropic.ts` - Extract inline schema to file

**If choosing Option A (Unified):**
- [ ] Create `server/services/schemas/baseArcSchema.ts`
- [ ] Update all schema files to import from base
- [ ] Update validator to handle new prediction structure

**If choosing Option C (Current + Cleanup):**
- [ ] Create shared constants for common field definitions
- [ ] Add JSDoc explaining provider differences
- [ ] Update Gemini/DeepSeek to use basic schema

---

**End of Report**
