# Prompt Architecture Fix Plan
**Author:** Cascade using Claude Sonnet 4  
**Date:** 2025-10-12 4:05pm  
**Status:** 🔴 CRITICAL - Duplicate Instructions + Missing Logging

---

## PROBLEM IDENTIFIED

### Issue #1: Duplicate Task Instructions
**Location:** `server/services/prompts/components/promptBuilder.ts` lines 54-78

The `buildSystemPrompt()` function is composing:
```typescript
return [
  basePrompt,           // ✅ AI role - correct
  taskDescription,      // ❌ WRONG - duplicates user prompt
  jsonInstructions,     // ✅ Schema - correct
  additionalInstructions // ✅ Mode-specific - correct
]
```

**Result:** Task descriptions appear in BOTH system and user prompts!

**Example Duplication:**
- **System prompt**: "You are an expert... [BASE_SYSTEM_PROMPT] PROBLEM: Analyze the training examples below to identify the transformation pattern..."
- **User prompt**: "PROBLEM: Analyze the training examples below to identify the transformation pattern... TRAINING EXAMPLES: ..."

### Issue #2: No Console Logging
**Location:** `server/services/promptBuilder.ts`

Currently only logs character counts:
```typescript
logger.service('PromptBuilder', `Generated system prompt: ${systemPrompt.length} chars`);
logger.service('PromptBuilder', `Generated user prompt: ${userPrompt.length} chars`);
```

**User needs:** Full prompt contents visible in console for debugging

---

## SOLUTION ARCHITECTURE

### Fix #1: Remove taskDescription from System Prompts

**File:** `server/services/prompts/components/promptBuilder.ts`

**Current** (lines 54-78):
```typescript
export function buildSystemPrompt(config: PromptConfig): string {
  const {
    basePrompt = BASE_SYSTEM_PROMPT,
    taskDescription,  // ❌ Remove this
    predictionInstructions,
    additionalInstructions = '',
    testCount = 1,
    hasStructuredOutput = false
  } = config;

  const jsonInstructions = predictionInstructions || buildJsonInstructions(testCount, hasStructuredOutput);

  return [
    basePrompt,           // ✅ Keep: AI role
    taskDescription,      // ❌ Remove: Goes to user prompt
    jsonInstructions,     // ✅ Keep: Schema enforcement
    additionalInstructions // ✅ Keep: Mode-specific rules
  ]
  .filter(section => section.trim().length > 0)
  .join('\n\n');
}
```

**Fixed**:
```typescript
export function buildSystemPrompt(config: PromptConfig): string {
  const {
    basePrompt = BASE_SYSTEM_PROMPT,
    // taskDescription REMOVED - goes to user prompt only
    predictionInstructions,
    additionalInstructions = '',
    testCount = 1,
    hasStructuredOutput = false
  } = config;

  const jsonInstructions = predictionInstructions || buildJsonInstructions(testCount, hasStructuredOutput);

  return [
    basePrompt,           // ✅ AI role/behavior
    jsonInstructions,     // ✅ JSON schema enforcement
    additionalInstructions // ✅ Mode-specific instructions
  ]
  .filter(section => section.trim().length > 0)
  .join('\n\n');
}
```

**Interface Update:**
```typescript
export interface PromptConfig {
  basePrompt?: string;
  // taskDescription?: string;  // REMOVED
  predictionInstructions?: string;
  additionalInstructions?: string;
  testCount?: number;
  hasStructuredOutput?: boolean;
}
```

### Fix #2: Update All Callsites

**File:** `server/services/prompts/systemPrompts.ts`

**Current** (lines 50-89):
```typescript
export const SYSTEM_PROMPT_MAP = {
  solver: (testCount?: number, hasStructuredOutput?: boolean) => 
    buildSystemPrompt({ 
      taskDescription: TASK_DESCRIPTIONS.solver,  // ❌ Remove
      additionalInstructions: ADDITIONAL_INSTRUCTIONS.solver,
      testCount,
      hasStructuredOutput
    }),
  // ... all other modes
}
```

**Fixed**:
```typescript
export const SYSTEM_PROMPT_MAP = {
  solver: (testCount?: number, hasStructuredOutput?: boolean) => 
    buildSystemPrompt({ 
      // taskDescription removed - now in user prompt only
      additionalInstructions: ADDITIONAL_INSTRUCTIONS.solver,
      testCount,
      hasStructuredOutput
    }),
  // ... update all modes similarly
}
```

**Special Cases** (debate/discussion):
```typescript
export function buildDebatePrompt(): string {
  return buildSystemPrompt({
    basePrompt: ADDITIONAL_INSTRUCTIONS.debate,
    // taskDescription removed
    additionalInstructions: BASE_SYSTEM_PROMPT
  });
}
```

### Fix #3: Add Console Logging

**File:** `server/services/promptBuilder.ts` lines 262-265

**Current**:
```typescript
logger.service('PromptBuilder', `Generated system prompt: ${systemPrompt.length} chars`);
logger.service('PromptBuilder', `Generated user prompt: ${userPrompt.length} chars`);
logger.service('PromptBuilder', `Security: ${(buildOptions.omitAnswer ?? true) ? '🔒 ANSWERS WITHHELD' : '⚠️ ANSWERS INCLUDED'}`);
```

**Fixed**:
```typescript
// Log lengths
logger.service('PromptBuilder', `Generated system prompt: ${systemPrompt.length} chars`);
logger.service('PromptBuilder', `Generated user prompt: ${userPrompt.length} chars`);
logger.service('PromptBuilder', `Security: ${(buildOptions.omitAnswer ?? true) ? '🔒 ANSWERS WITHHELD' : '⚠️ ANSWERS INCLUDED'}`);

// Log full contents for debugging
logger.service('PromptBuilder', `\n${'='.repeat(80)}\nSYSTEM PROMPT (${promptId}):\n${'-'.repeat(80)}\n${systemPrompt}\n${'='.repeat(80)}`);
logger.service('PromptBuilder', `\n${'='.repeat(80)}\nUSER PROMPT (${promptId}):\n${'-'.repeat(80)}\n${userPrompt}\n${'='.repeat(80)}`);
```

---

## VERIFICATION CHECKLIST

After fixes, verify:

- [ ] System prompts contain ONLY: AI role + JSON schema + mode-specific instructions
- [ ] User prompts contain: Task description + puzzle data + success criteria
- [ ] NO duplication of task descriptions between system and user prompts
- [ ] Console shows full prompt contents with clear separators
- [ ] All 8 prompt modes work correctly (solver, explanation, alien, educational, gepa, debate, discussion, custom)
- [ ] Debate and discussion modes maintain special structure
- [ ] TypeScript compiles with no errors
- [ ] Test one analysis end-to-end, check console output

---

## FILES TO MODIFY

1. `server/services/prompts/components/promptBuilder.ts` - Remove taskDescription from buildSystemPrompt()
2. `server/services/prompts/systemPrompts.ts` - Remove taskDescription from all SYSTEM_PROMPT_MAP entries
3. `server/services/promptBuilder.ts` - Add full prompt logging

---

## COMMIT MESSAGE

```
fix: Eliminate duplicate task instructions, add full prompt logging

ARCHITECTURAL FIX:
Task descriptions were being sent in BOTH system and user prompts, 
causing redundancy and violating OpenAI Responses API best practices.

CHANGES:
1. Removed taskDescription from buildSystemPrompt() composition
2. System prompts now contain ONLY: AI role + JSON schema + mode rules
3. User prompts contain ONLY: Task description + puzzle data
4. Added full prompt console logging with clear separators

CLEAN ARCHITECTURE:
- System prompt: "You are an expert..." + JSON schema + mode-specific rules
- User prompt: "PROBLEM: Predict..." + training examples + test data

LOGGING:
Console now shows complete prompt contents for debugging:
- System prompt with ===== separators
- User prompt with ===== separators  
- Character counts and security status

Author: Cascade using Claude Sonnet 4
Date: 2025-10-12
```
