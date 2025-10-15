# GPT-5 Model Alias Support - Implementation Guide

**Author**: Claude Code
**Date**: 2025-10-15
**For**: Implementing shortened model name support in other projects

---

## Problem Overview

When users pass shortened model names like `"gpt-5-mini"` instead of full versioned names like `"gpt-5-mini-2025-08-07"`, two things break:

1. **Streaming rejection**: Model is not recognized as supporting streaming
2. **Feature detection failure**: Model capabilities (reasoning, structured output, etc.) are not detected because Set lookups fail

## Root Cause

Your model configuration likely uses **full versioned names as keys**:

```typescript
const MODELS_WITH_REASONING = new Set([
  "gpt-5-2025-08-07",
  "gpt-5-mini-2025-08-07",
  "gpt-5-nano-2025-08-07"
]);
```

When you check `MODELS_WITH_REASONING.has("gpt-5-mini")`, it returns `false` because the Set contains the full name.

## Solution: Add Model Alias Mapping

### Step 1: Create the Alias Map

Add this near your model configuration imports:

```typescript
/**
 * Model name normalization mapping
 * Maps short/alias names to full versioned model names
 */
const MODEL_ALIASES: Record<string, string> = {
  // GPT-5 family
  "gpt-5": "gpt-5-2025-08-07",
  "gpt-5-mini": "gpt-5-mini-2025-08-07",
  "gpt-5-nano": "gpt-5-nano-2025-08-07",

  // Add other models as needed
  "o3-mini": "o3-mini-2025-01-31",
  "o4-mini": "o4-mini-2025-04-16",
};
```

### Step 2: Create the Normalization Helper

```typescript
/**
 * Normalize model key to full versioned name
 * Falls back to your existing getApiModelName() for non-aliased models
 */
function normalizeModelKey(modelKey: string): string {
  return MODEL_ALIASES[modelKey] || getApiModelName(modelKey);
}
```

### Step 3: Update ALL Set Lookups

**CRITICAL**: Find every place you check model capabilities using Sets. Replace:

```typescript
// ❌ BEFORE (BROKEN with shortened names)
const isReasoningModel = MODELS_WITH_REASONING.has(modelKey);
const isGPT5Model = GPT5_REASONING_MODELS.has(modelKey);
```

```typescript
// ✅ AFTER (WORKS with both shortened and full names)
const normalizedKey = normalizeModelKey(modelKey);
const isReasoningModel = MODELS_WITH_REASONING.has(normalizedKey);
const isGPT5Model = GPT5_REASONING_MODELS.has(normalizedKey);
```

### Step 4: Update Streaming Support Check

If you have a `supportsStreaming()` method, enhance it to handle both formats:

```typescript
supportsStreaming(modelKey: string): boolean {
  const streamingModels = [
    "gpt-5-2025-08-07",
    "gpt-5-mini-2025-08-07",
    "gpt-5-nano-2025-08-07",
  ];

  // Check exact match first
  if (streamingModels.includes(modelKey)) {
    return true;
  }

  // Check if modelKey is a shortened version
  // e.g., "gpt-5-mini" should match "gpt-5-mini-2025-08-07"
  return streamingModels.some(fullKey => fullKey.startsWith(modelKey + "-"));
}
```

## Common Places to Update

Search your codebase for these patterns and add normalization:

1. **Feature detection methods**:
   - `buildReasoningConfig()`
   - `buildTextConfig()`
   - `getModelInfo()`
   - `supportsStructuredOutput()`

2. **Any method that checks Sets like**:
   - `MODELS_WITH_REASONING.has(...)`
   - `GPT5_REASONING_MODELS.has(...)`
   - `O3_O4_REASONING_MODELS.has(...)`
   - `GPT5_CHAT_MODELS.has(...)`

3. **Example method before/after**:

```typescript
// ❌ BEFORE
private buildReasoningConfig(modelKey: string): Record<string, unknown> | undefined {
  const isReasoningModel = MODELS_WITH_REASONING.has(modelKey); // FAILS for "gpt-5-mini"
  if (!isReasoningModel) return undefined;

  const isGPT5Model = GPT5_REASONING_MODELS.has(modelKey); // FAILS
  // ...
}

// ✅ AFTER
private buildReasoningConfig(modelKey: string): Record<string, unknown> | undefined {
  const normalizedKey = normalizeModelKey(modelKey); // "gpt-5-mini" → "gpt-5-mini-2025-08-07"

  const isReasoningModel = MODELS_WITH_REASONING.has(normalizedKey); // NOW WORKS
  if (!isReasoningModel) return undefined;

  const isGPT5Model = GPT5_REASONING_MODELS.has(normalizedKey); // NOW WORKS
  // ...
}
```

## Testing Checklist

After implementing, test with **shortened names**:

### 1. Streaming Test
```bash
curl -N -H "Accept: text/event-stream" \
  "http://localhost:5000/api/stream/analyze/PUZZLE_ID/gpt-5-mini?reasoningEffort=medium&reasoningVerbosity=high"
```

**Expected**: Stream connects, reasoning deltas flow in real-time

**Check server logs for**:
```
[YourService-PayloadBuilder] Has reasoning: true    ← MUST be true
[YourService-PayloadBuilder] - verbosity: high      ← MUST NOT be "none"
```

### 2. Non-Streaming Test
```bash
curl -X POST "http://localhost:5000/api/puzzle/analyze/PUZZLE_ID/gpt-5-mini" \
  -H "Content-Type: application/json" \
  -d '{"temperature": 0.2, "reasoningEffort": "high"}'
```

**Expected**: Response includes populated `reasoningLog` and `reasoningItems` fields

### 3. Model Info Test
```bash
curl "http://localhost:5000/api/models/gpt-5-mini/info"
```

**Expected**: `isReasoning: true`, `supportsStreaming: true`

## Common Pitfall

⚠️ **DON'T** normalize the model key when calling the actual API:

```typescript
// ❌ WRONG - API might not recognize full versioned names
const response = await openai.responses.create({
  model: normalizeModelKey(modelKey), // DON'T normalize here
  // ...
});

// ✅ CORRECT - Use original getApiModelName() for API calls
const response = await openai.responses.create({
  model: getApiModelName(modelKey), // Still use this for API
  // ...
});
```

**Use normalization ONLY for**:
- Set lookups (capability checks)
- Internal feature detection
- Configuration building

**Use getApiModelName() for**:
- Actual API requests
- External service calls

## Quick Win

Add debug logging to verify normalization is working:

```typescript
function normalizeModelKey(modelKey: string): string {
  const normalized = MODEL_ALIASES[modelKey] || getApiModelName(modelKey);
  if (normalized !== modelKey) {
    console.log(`[ModelAlias] ${modelKey} → ${normalized}`);
  }
  return normalized;
}
```

You should see in logs:
```
[ModelAlias] gpt-5-mini → gpt-5-mini-2025-08-07
```

## Summary

1. ✅ Create `MODEL_ALIASES` map for shortened names
2. ✅ Create `normalizeModelKey()` helper function
3. ✅ Find ALL Set.has() checks and add normalization
4. ✅ Update `supportsStreaming()` with prefix matching
5. ✅ Test with shortened names ("gpt-5-mini")
6. ✅ Verify server logs show correct feature detection

**Files to modify**: Typically just your AI service class (e.g., `OpenAIService`, `AnthropicService`, etc.)

---

**Reference Implementation**: See `arc-explainer/server/services/openai.ts` (commit efc8365d) for complete working example.
