# Phase 12: Test-Count-Aware Prompt Integration Plan

**Date:** 2025-10-11  
**Author:** Cascade using Claude Sonnet 4  
**Priority:** 🔴 CRITICAL - Completes dynamic schema refactor  
**Estimated Time:** 30-45 minutes

---

## Executive Summary

**GOAL:** Integrate test-count-aware prompt instructions so prompt-based providers (Anthropic, Gemini, DeepSeek) receive field-specific instructions matching the dynamic schemas used by structured output providers (OpenAI, Grok).

**CURRENT STATE:**
- ✅ Dynamic schemas working (OpenAI, Grok adapt to test count)
- ✅ `buildJsonInstructions(testCount, hasStructuredOutput)` exists and works
- ❌ Prompt system NOT using it - calls `buildMinimalJsonInstructions()` instead
- ❌ No integration between `buildAnalysisPrompt()` and test count

**TARGET STATE:**
- ✅ Prompt-based providers get detailed, test-count-specific instructions
- ✅ Anthropic sees "predictedOutput1, predictedOutput2" for 2-test puzzle
- ✅ Gemini sees "predictedOutput" for 1-test puzzle
- ✅ No cognitive overhead from unused fields

---

## Problem Analysis

### Current Flow (BROKEN):

```
User requests analysis
    ↓
puzzleAnalysisService.analyzePuzzle(taskId, modelKey, options)
    ↓
BaseAIService.analyze(task, options)
    ↓
buildPromptPackage(task, promptId, customPrompt, options)
    ↓
buildAnalysisPrompt(task, promptId, customPrompt, options)
    ↓
getSystemPrompt(promptId)  // ← Uses buildSystemPrompt()
    ↓
buildSystemPrompt({ ... })  // ← Calls buildMinimalJsonInstructions()
    ↓
buildMinimalJsonInstructions()  // ❌ NO TEST COUNT!
```

**Problem:** System prompt built BEFORE we know test count, and doesn't pass testCount parameter.

### Target Flow (FIXED):

```
User requests analysis
    ↓
puzzleAnalysisService.analyzePuzzle(taskId, modelKey, options)
    ↓
BaseAIService.analyze(task, options)
    ↓
Extract testCount = task.test.length  // ← CRITICAL: Get test count early
    ↓
buildPromptPackage(task, promptId, customPrompt, options, testCount)  // ← Pass it
    ↓
buildAnalysisPrompt(task, promptId, customPrompt, options, testCount)  // ← Pass it
    ↓
getSystemPrompt(promptId, testCount, hasStructuredOutput)  // ← NEW PARAMS
    ↓
buildSystemPrompt({ ..., testCount, hasStructuredOutput })  // ← Pass both
    ↓
buildJsonInstructions(testCount, hasStructuredOutput)  // ✅ TEST COUNT AWARE!
```

---

## Implementation Plan

### Step 1: Update `buildSystemPrompt()` Signature
**File:** `server/services/prompts/components/promptBuilder.ts`

**Current:**
```typescript
export interface PromptConfig {
  basePrompt?: string;
  taskDescription: string;
  predictionInstructions?: string;
  additionalInstructions?: string;
}

export function buildSystemPrompt(config: PromptConfig): string {
  // ...
  const jsonInstructions = predictionInstructions || buildMinimalJsonInstructions();
  // ...
}
```

**Target:**
```typescript
export interface PromptConfig {
  basePrompt?: string;
  taskDescription: string;
  predictionInstructions?: string;
  additionalInstructions?: string;
  testCount?: number;  // NEW
  hasStructuredOutput?: boolean;  // NEW
}

export function buildSystemPrompt(config: PromptConfig): string {
  const {
    basePrompt = BASE_SYSTEM_PROMPT,
    taskDescription,
    predictionInstructions,
    additionalInstructions = '',
    testCount = 1,  // Default to 1
    hasStructuredOutput = false  // Default to false (prompt-based)
  } = config;

  // Use test-count-aware instructions if no custom predictionInstructions provided
  const jsonInstructions = predictionInstructions || buildJsonInstructions(testCount, hasStructuredOutput);
  
  // ... rest unchanged
}
```

**Rationale:** Add optional parameters with safe defaults to maintain backward compatibility.

---

### Step 2: Update `getSystemPrompt()` Function
**File:** `server/services/prompts/systemPrompts.ts`

**Current:**
```typescript
export const SYSTEM_PROMPT_MAP = {
  solver: () => buildSystemPrompt({ taskDescription: TASK_DESCRIPTIONS.solver, ... }),
  standardExplanation: () => buildSystemPrompt({ ... }),
  // etc.
}

export function getSystemPrompt(promptId: string): string {
  const promptBuilder = SYSTEM_PROMPT_MAP[promptId] || SYSTEM_PROMPT_MAP.solver;
  return promptBuilder();
}
```

**Target:**
```typescript
export const SYSTEM_PROMPT_MAP = {
  solver: (testCount?: number, hasStructuredOutput?: boolean) => 
    buildSystemPrompt({ 
      taskDescription: TASK_DESCRIPTIONS.solver, 
      additionalInstructions: ADDITIONAL_INSTRUCTIONS.solver,
      testCount,
      hasStructuredOutput
    }),
  standardExplanation: (testCount?: number, hasStructuredOutput?: boolean) => 
    buildSystemPrompt({ 
      taskDescription: TASK_DESCRIPTIONS.explanation, 
      additionalInstructions: ADDITIONAL_INSTRUCTIONS.explanation,
      testCount,
      hasStructuredOutput
    }),
  // Update all entries...
}

export function getSystemPrompt(
  promptId: string, 
  testCount?: number, 
  hasStructuredOutput?: boolean
): string {
  const promptBuilder = SYSTEM_PROMPT_MAP[promptId] || SYSTEM_PROMPT_MAP.solver;
  return promptBuilder(testCount, hasStructuredOutput);
}
```

**Rationale:** Pass parameters through the map to reach buildSystemPrompt.

---

### Step 3: Update `buildAnalysisPrompt()` to Extract and Pass testCount
**File:** `server/services/promptBuilder.ts`

**Current:**
```typescript
export function buildAnalysisPrompt(
  task: ARCTask,
  promptId: string = "solver",
  customPrompt?: string,
  options: PromptOptions = {},
  serviceOpts: ServiceOptions = {}
): PromptPackage {
  // ... lots of code ...
  systemPrompt = getSystemPrompt(promptId);  // ❌ No test count!
}
```

**Target:**
```typescript
export function buildAnalysisPrompt(
  task: ARCTask,
  promptId: string = "solver",
  customPrompt?: string,
  options: PromptOptions = {},
  serviceOpts: ServiceOptions = {}
): PromptPackage {
  // CRITICAL: Extract test count early
  const testCount = task.test?.length || 1;
  const hasStructuredOutput = options.useStructuredOutput ?? false;
  
  logger.service('PromptBuilder', `Test count: ${testCount}, Structured output: ${hasStructuredOutput}`);
  
  // ... rest of function ...
  
  // When building system prompt (around line 183):
  systemPrompt = getSystemPrompt(promptId, testCount, hasStructuredOutput);
}
```

**Rationale:** Extract testCount from task.test.length and pass through to getSystemPrompt.

---

### Step 4: Update BaseAIService to Pass useStructuredOutput Flag
**File:** `server/services/base/BaseAIService.ts`

**Current:**
```typescript
protected buildPromptPackage(
  task: ARCTask,
  promptId: string = getDefaultPromptId(),
  customPrompt?: string,
  options?: PromptOptions,
  serviceOpts: ServiceOptions = {}
): PromptPackage {
  const promptPackage: PromptPackage = buildAnalysisPrompt(task, promptId, customPrompt, options, serviceOpts);
  return promptPackage;
}
```

**Target:**
```typescript
protected buildPromptPackage(
  task: ARCTask,
  promptId: string = getDefaultPromptId(),
  customPrompt?: string,
  options?: PromptOptions,
  serviceOpts: ServiceOptions = {}
): PromptPackage {
  // Determine if this provider uses structured output
  const useStructuredOutput = this.supportsStructuredOutput && this.supportsStructuredOutput();
  
  // Merge into options
  const enhancedOptions: PromptOptions = {
    ...options,
    useStructuredOutput: useStructuredOutput ?? options?.useStructuredOutput
  };
  
  const promptPackage: PromptPackage = buildAnalysisPrompt(
    task, 
    promptId, 
    customPrompt, 
    enhancedOptions, 
    serviceOpts
  );
  
  return promptPackage;
}
```

**Rationale:** Pass provider capability info to prompt builder.

---

### Step 5: Add `supportsStructuredOutput()` Method to Providers
**File:** Each provider service file

**OpenAI (TRUE):**
```typescript
protected supportsStructuredOutput(): boolean {
  return true;  // OpenAI Responses API
}
```

**Grok (TRUE):**
```typescript
protected supportsStructuredOutput(): boolean {
  return true;  // xAI Responses API
}
```

**Anthropic, Gemini, DeepSeek (FALSE):**
```typescript
protected supportsStructuredOutput(): boolean {
  return false;  // Prompt-based only
}
```

**Rationale:** Explicit provider capability declaration.

---

## Testing Checklist

### Manual Tests:

1. **Single-test puzzle with Anthropic:**
   - Check system prompt contains "predictedOutput" (not predictedOutput1)
   - Verify detailed field instructions present

2. **Multi-test puzzle (2 tests) with Gemini:**
   - Check system prompt contains "predictedOutput1" and "predictedOutput2"
   - Verify NO predictedOutput3 mentioned

3. **Multi-test puzzle with OpenAI:**
   - Check system prompt uses minimal instructions (has structured output)
   - Verify schema still has correct fields

4. **Custom prompt mode:**
   - Verify still works (backward compatibility)

### Verification Points:

- [ ] No TypeScript errors
- [ ] Server starts successfully
- [ ] Log output shows correct test counts
- [ ] Anthropic prompt shows detailed instructions
- [ ] OpenAI prompt shows minimal instructions
- [ ] Multi-test puzzles work correctly
- [ ] Single-test puzzles work correctly

---

## Rollback Plan

If issues arise:

1. **Quick Fix:** Comment out changes to `buildSystemPrompt`, revert to `buildMinimalJsonInstructions()`
2. **Provider-Specific:** Disable `supportsStructuredOutput()` checks, return false for all
3. **Full Rollback:** Git revert to pre-Phase-12 commit

---

## Success Criteria

✅ Phase 12 is complete when:

1. Anthropic receives: "predictedOutput1, predictedOutput2" for 2-test puzzle
2. Gemini receives: "predictedOutput" for 1-test puzzle  
3. OpenAI still receives minimal instructions (has schema enforcement)
4. No regression in existing functionality
5. All TypeScript compilation passes
6. Server starts and handles requests correctly

---

## Estimated Impact

**Lines Changed:** ~50-70 lines across 4 files  
**Risk Level:** MEDIUM (touching core prompt system)  
**Testing Time:** 15-20 minutes  
**Total Time:** 30-45 minutes

---

## Files to Modify

1. `server/services/prompts/components/promptBuilder.ts` (~15 lines)
2. `server/services/prompts/systemPrompts.ts` (~20 lines)
3. `server/services/promptBuilder.ts` (~10 lines)
4. `server/services/base/BaseAIService.ts` (~15 lines)
5. All provider services (1-2 lines each × 8 = ~16 lines)

---

**READY TO BEGIN IMPLEMENTATION**
