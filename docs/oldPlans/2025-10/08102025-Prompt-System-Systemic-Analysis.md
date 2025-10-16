# Prompt System: Deep Systemic Analysis
**Author:** Cascade (Claude Sonnet 4)  
**Date:** October 8, 2025  
**Purpose:** Ultra-deep analysis of prompt architecture revealing systemic design flaws and proposing comprehensive fixes

---

## 🔴 CRITICAL DISCOVERY: The System Doesn't Know What It's Doing

Your prompt system has a **context blindness** problem. It assembles prompts mechanically without understanding:
1. **Is this a first turn or continuation?** (Responses API chaining)
2. **What mode requires what structure?** (Debate vs. Solver)
3. **What instructions are redundant?** (JSON rules repeated 3x)
4. **What the LLM already knows?** (From previous_response_id context)

---

## Architecture Map: How Prompts ACTUALLY Flow

### Layer 1: Service Entry Point
```
puzzleAnalysisService.analyzePuzzle()
  ↓
  options: { previousResponseId, originalExplanation, customChallenge, ... }
  ↓
  aiService.analyzePuzzleWithModel(task, modelKey, temp, promptId, customPrompt, options, serviceOpts)
```

### Layer 2: Prompt Building
```
BaseAIService.buildPromptPackage()
  ↓
  promptBuilder.ts → buildAnalysisPrompt()
    ↓
    ├─ systemPrompts.ts → getSystemPrompt(promptId)
    │    ↓
    │    └─ components/promptBuilder.ts → buildSystemPrompt(config)
    │         ↓
    │         ├─ BASE_SYSTEM_PROMPT (what is ARC)
    │         ├─ TASK_DESCRIPTIONS[mode] (what to do)
    │         ├─ JSON_HEADER + JSON_FIELDS_INSTRUCTIONS (how to format) ⚠️ REDUNDANT
    │         ├─ PREDICTION_FIELD_INSTRUCTIONS (grid format) ⚠️ REDUNDANT
    │         └─ ADDITIONAL_INSTRUCTIONS[mode] (extras)
    │
    └─ userTemplates.ts → buildUserPromptForTemplate()
         ↓
         ├─ formatTrainingExamples() (puzzle data)
         ├─ formatTestSection() (test cases)
         └─ Special: buildDebateUserPrompt() (includes original explanation)
```

### Layer 3: Provider API Call
```
Provider-specific API (openai.ts, grok.ts, anthropic.ts)
  ↓
  callProviderAPI(promptPackage, modelKey, temperature, serviceOpts)
    ↓
    messages = [
      { role: "system", content: promptPackage.systemPrompt },
      { role: "user", content: promptPackage.userPrompt }
    ]
    ↓
    API payload includes: previous_response_id (from serviceOpts.previousResponseId)
```

### Layer 4: Response Processing
```
parseProviderResponse() → Extract JSON, reasoning, tokens
  ↓
buildStandardResponse() → Add metadata, prompt tracking, provider_response_id
  ↓
Database save with: system_prompt_used, user_prompt_used, provider_response_id
```

---

## 🚨 The 5 Systemic Problems

### Problem 1: Hardcoded Assembly Order (Context-Blind)

**Current Code (promptBuilder.ts lines 40-60):**
```typescript
export function buildSystemPrompt(config: PromptConfig): string {
  const {
    basePrompt = BASE_SYSTEM_PROMPT,  // "You are an expert..."
    taskDescription,                   // "TASK: Analyze examples..."
    predictionInstructions,            // "GRID FORMAT CRITICAL: [[0,1,2]]..."
    additionalInstructions = ''
  } = config;

  // HARDCODED: Always builds JSON instructions the same way
  const jsonInstructions = [JSON_HEADER, JSON_FIELDS_INSTRUCTIONS].join('\n\n');

  // HARDCODED: Always assembles in this order
  return [
    basePrompt,
    taskDescription,
    jsonInstructions,        // ⚠️ Grid example #1
    predictionInstructions,  // ⚠️ Grid example #2 (if provided)
    additionalInstructions
  ]
  .filter(section => section.trim().length > 0)
  .join('\n\n');
}
```

**Why It's Broken:**
- **Every mode** gets the same 5-part structure
- **Debate/Discussion** modes need inverted order but still get JSON in middle
- **Continuation turns** (with `previousResponseId`) get full instructions again
- **No way to skip sections** based on context

**The Result:** Discussion mode prompt you showed had:
```
SELF-REFINEMENT INSTRUCTIONS (from ADDITIONAL_INSTRUCTIONS.discussion)
↓
TASK (from TASK_DESCRIPTIONS.discussion)
↓
JSON RULES (hardcoded injection) ← Grid example #1
↓
PREDICTION RULES (default injection) ← Grid example #2
↓
ARC EXPLANATION (from BASE_SYSTEM_PROMPT)
```

All 5 sections concatenated, creating chaos.

---

### Problem 2: Responses API Conversation Chaining (Ignored)

**What Responses API Does:**
```typescript
// OpenAI/Grok API call (openai.ts line 246-260)
const requestData = {
  model: modelName,
  input: messages,
  previous_response_id: serviceOpts.previousResponseId,  // ← CRITICAL!
  // ...
};
```

**When `previous_response_id` is set:**
- The LLM has **full context** from previous turn
- It already knows:
  - What ARC-AGI is
  - JSON format requirements
  - Grid format examples
  - The task it's working on

**But our prompt system:**
- Sends **identical system prompt** every time
- Repeats "You are an expert at ARC-AGI puzzles..."
- Repeats "Grid format: [[0,1,2],[3,4,5]]..." 3 times
- Wastes tokens and confuses the model

**Database Evidence (from memories):**
- `explanations` table has `provider_response_id` column
- Each turn saves its `response_id` for chaining
- But `system_prompt_used` and `user_prompt_used` show identical prompts!

**The Fix We Need:**
```typescript
if (serviceOpts.previousResponseId) {
  // Continuation turn - minimal prompt
  return buildContinuationPrompt(taskDescription);
} else {
  // Initial turn - full prompt
  return buildInitialPrompt(basePrompt, taskDescription, jsonInstructions);
}
```

---

### Problem 3: Mode Structure Inversion (Hacky Workaround)

**Debate/Discussion modes do this (promptBuilder.ts lines 102-119):**
```typescript
export function buildDebatePrompt(): string {
  return buildSystemPrompt({
    basePrompt: ADDITIONAL_INSTRUCTIONS.debate,     // ← Put instructions FIRST
    taskDescription: TASK_DESCRIPTIONS.debate,
    additionalInstructions: BASE_SYSTEM_PROMPT      // ← Put ARC rules LAST
  });
}
```

**Why This Exists:**
Debate mode needs context flow:
1. **First**: "You are challenging another AI's wrong answer" (role)
2. **Then**: "Here's what ARC-AGI puzzles are" (context)
3. **Finally**: "Output in JSON format" (mechanics)

**But It's Broken Because:**
- Still gets `jsonInstructions` injected in the middle (line 51)
- Still gets `predictionInstructions` if not explicitly null
- The "inversion" is a hack, not a feature

**What We Need:**
```typescript
const ASSEMBLY_PATTERNS = {
  standard: ['arcContext', 'task', 'jsonRules'],
  debate: ['task', 'arcContext', 'jsonRules'],
  continuation: ['task']  // Skip arcContext and jsonRules
};
```

---

### Problem 4: TASK_DESCRIPTIONS vs ADDITIONAL_INSTRUCTIONS Overlap

**Current Structure (basePrompts.ts):**
```typescript
TASK_DESCRIPTIONS = {
  solver: `TASK: Each puzzle has training examples...
           Analyze training examples, identify patterns,
           and predict the correct output.`,
  
  debate: `TASK: You are correcting another AI model...`
}

ADDITIONAL_INSTRUCTIONS = {
  solver: `Predict the correct output grid for the test case.`,
  
  debate: `DEBATE CHALLENGE INSTRUCTIONS:
           You will be shown:
           1. The original AI model's explanation...
           2. Whether their prediction was correct...`
}
```

**The Problem:**
- `TASK_DESCRIPTIONS.solver` says "analyze and predict"
- `ADDITIONAL_INSTRUCTIONS.solver` says "predict the output"
- They're saying the same thing twice!

**Why It Exists:**
Historical artifact from when these were managed separately. Now they're both part of the same assembly.

**The Fix:**
```typescript
const MODE_CONFIGS = {
  solver: {
    role: "You are an expert at solving ARC-AGI puzzles.",
    task: "Analyze training examples and predict test output.",
    jsonFields: ['predictedOutput', 'solvingStrategy', 'confidence']
  },
  
  debate: {
    role: "You are challenging an AI's incorrect explanation.",
    task: "Critique their reasoning and provide the correct solution.",
    context: "The other AI failed this simple visual puzzle.",
    jsonFields: ['predictedOutput', 'patternDescription', 'solvingStrategy']
  }
};
```

One object, clear structure, no overlap.

---

### Problem 5: Provider-Specific Needs (One Size Fits All)

**Different Providers Have Different Requirements:**

#### OpenAI (Responses API):
- Uses `previous_response_id` for chaining
- Has reasoning models (GPT-5, o3, o4)
- Reasoning config: `{ effort, verbosity, summary }`
- Returns structured `output_parsed` or `output_text`

#### Grok (Also Responses API):
- Uses `previous_response_id` for chaining
- Has structured output with `response_format`
- Different JSON schema needs (GROK_JSON_SCHEMA vs ARC_JSON_SCHEMA)

#### Anthropic (Messages API):
- **NO `previous_response_id` support!**
- Uses traditional message history for context
- Extended thinking via `thinking` blocks
- Different max_tokens limits (4096 vs 8192 vs 64000)

**But Our Prompt System:**
- Builds identical prompts for all providers
- Doesn't adapt to provider capabilities
- Wastes Anthropic's message history by repeating full prompts
- Doesn't leverage OpenAI's continuation efficiently

---

## 💡 The Systemic Fix: Context-Aware Prompt Architecture

### Proposal: Prompt Context System

```typescript
/**
 * server/services/prompts/PromptContext.ts
 * 
 * Central context system that determines HOW to build prompts
 * based on WHAT the situation is.
 */

export interface PromptContext {
  // Mode determines structure and content
  mode: 'solver' | 'explanation' | 'debate' | 'discussion' | 'alien' | 'custom';
  
  // Conversation state determines what to include
  conversationState: 'initial' | 'continuation';
  
  // Provider determines API-specific adaptations
  provider: 'openai' | 'anthropic' | 'grok' | 'gemini' | 'deepseek';
  
  // Special data that affects prompt content
  hasOriginalExplanation: boolean;  // Debate mode
  hasPreviousAnalysis: boolean;     // Retry mode
  useEmojis: boolean;               // Alien mode
  
  // Multi-test affects JSON field instructions
  isMultiTest: boolean;
}

export function determineContext(
  promptId: string,
  options: PromptOptions,
  serviceOpts: ServiceOptions,
  task: ARCTask
): PromptContext {
  return {
    mode: promptId as any,
    conversationState: serviceOpts.previousResponseId ? 'continuation' : 'initial',
    provider: detectProvider(serviceOpts),
    hasOriginalExplanation: !!options.originalExplanation,
    hasPreviousAnalysis: !!options.previousAnalysis,
    useEmojis: !!options.emojiSetKey || promptId === 'alienCommunication',
    isMultiTest: task.test.length > 1
  };
}
```

### Prompt Assembly Patterns

```typescript
/**
 * server/services/prompts/AssemblyPatterns.ts
 * 
 * Defines HOW to assemble prompts for different contexts.
 * Each pattern specifies sections and their order.
 */

type PromptSection = 
  | 'arcIntroduction'      // "You are an expert at ARC-AGI puzzles..."
  | 'modeRole'             // "You are challenging another AI..." 
  | 'modeTask'             // "Analyze examples and predict output"
  | 'jsonInstructions'     // Consolidated JSON rules
  | 'debateContext'        // "You will be shown the original explanation..."
  | 'retryContext';        // "Your previous attempt was incorrect..."

interface AssemblyPattern {
  sections: PromptSection[];
  skipOnContinuation?: PromptSection[];  // Don't repeat these if previousResponseId exists
}

export const ASSEMBLY_PATTERNS: Record<string, AssemblyPattern> = {
  // Standard solver: ARC intro → Task → JSON rules
  solver_initial: {
    sections: ['arcIntroduction', 'modeTask', 'jsonInstructions'],
    skipOnContinuation: ['arcIntroduction', 'jsonInstructions']
  },
  
  solver_continuation: {
    sections: ['modeTask']  // Just the task - LLM already has context
  },
  
  // Debate: Role → Debate context → ARC intro → JSON rules
  debate_initial: {
    sections: ['modeRole', 'debateContext', 'arcIntroduction', 'jsonInstructions'],
    skipOnContinuation: ['arcIntroduction', 'jsonInstructions']
  },
  
  debate_continuation: {
    sections: ['modeRole', 'debateContext']  // Re-state role and what changed
  },
  
  // Anthropic (no chaining): Always full prompt
  anthropic_any: {
    sections: ['arcIntroduction', 'modeTask', 'jsonInstructions'],
    skipOnContinuation: []  // Never skip - no native chaining support
  }
};

export function selectPattern(context: PromptContext): AssemblyPattern {
  const key = `${context.mode}_${context.conversationState}`;
  
  // Provider-specific overrides
  if (context.provider === 'anthropic') {
    return ASSEMBLY_PATTERNS.anthropic_any;
  }
  
  return ASSEMBLY_PATTERNS[key] || ASSEMBLY_PATTERNS.solver_initial;
}
```

### Mode Configuration Registry

```typescript
/**
 * server/services/prompts/ModeRegistry.ts
 * 
 * Single source of truth for mode definitions.
 * Replaces TASK_DESCRIPTIONS and ADDITIONAL_INSTRUCTIONS.
 */

export interface ModeConfig {
  id: string;
  name: string;
  
  // Core prompt sections
  role?: string;          // Optional AI role statement
  task: string;          // What the AI should do
  context?: string;      // Special context/instructions
  
  // JSON output configuration
  requiredFields: string[];
  optionalFields: string[];
  
  // Behavioral flags
  requiresPrediction: boolean;
  requiresEmojis: boolean;
  allowsContinuation: boolean;  // Can use previousResponseId
}

export const MODE_REGISTRY: Record<string, ModeConfig> = {
  solver: {
    id: 'solver',
    name: 'Solver Mode',
    task: 'Analyze the training examples to identify the transformation pattern, then predict the correct output for the test case.',
    requiredFields: ['predictedOutput'],
    optionalFields: ['solvingStrategy', 'patternDescription', 'hints', 'confidence'],
    requiresPrediction: true,
    requiresEmojis: false,
    allowsContinuation: true
  },
  
  debate: {
    id: 'debate',
    name: 'Debate Challenge Mode',
    role: 'You are challenging another AI model\'s incorrect explanation.',
    task: 'Critique the original explanation, identify flaws, and provide a superior analysis with the correct solution.',
    context: 'Another AI already failed this puzzle. Your goal is to demonstrate better reasoning.',
    requiredFields: ['predictedOutput', 'patternDescription', 'solvingStrategy'],
    optionalFields: ['hints', 'confidence'],
    requiresPrediction: true,
    requiresEmojis: false,
    allowsContinuation: true
  },
  
  discussion: {
    id: 'discussion',
    name: 'Self-Refinement Mode',
    role: 'You are refining your own previous analysis.',
    task: 'Self-critique your previous attempt, apply fresh reasoning strategies, and provide an improved solution.',
    context: 'Your previous solution was incorrect. What did you miss? What new insights can you discover?',
    requiredFields: ['predictedOutput'],
    optionalFields: ['solvingStrategy', 'patternDescription', 'hints', 'confidence'],
    requiresPrediction: true,
    requiresEmojis: false,
    allowsContinuation: true
  },
  
  alienCommunication: {
    id: 'alienCommunication',
    name: 'Alien Communication Mode',
    task: 'Explain the transformation pattern AND interpret what the aliens might be communicating.',
    context: 'This puzzle comes from alien visitors who communicate through spatial patterns.',
    requiredFields: ['predictedOutput', 'alienMeaning', 'alienMeaningConfidence'],
    optionalFields: ['patternDescription', 'solvingStrategy', 'confidence'],
    requiresPrediction: true,
    requiresEmojis: true,
    allowsContinuation: false  // Emoji context must be maintained
  }
};
```

### Context-Aware Builder

```typescript
/**
 * server/services/prompts/ContextAwareBuilder.ts
 * 
 * Replaces buildSystemPrompt() with context-aware assembly.
 */

import { PromptContext, determineContext } from './PromptContext.js';
import { AssemblyPattern, selectPattern } from './AssemblyPatterns.js';
import { MODE_REGISTRY } from './ModeRegistry.js';
import { buildJsonInstructions } from './components/jsonInstructions.js';

export function buildContextAwarePrompt(
  context: PromptContext,
  specialData?: {
    originalExplanation?: any;
    previousAnalysis?: any;
    customChallenge?: string;
  }
): string {
  const pattern = selectPattern(context);
  const mode = MODE_REGISTRY[context.mode];
  
  if (!mode) {
    throw new Error(`Unknown mode: ${context.mode}`);
  }
  
  // Build sections based on pattern
  const sections: string[] = [];
  
  for (const sectionType of pattern.sections) {
    // Skip sections marked for continuation if this is a continuation turn
    if (context.conversationState === 'continuation' && 
        pattern.skipOnContinuation?.includes(sectionType)) {
      continue;
    }
    
    switch (sectionType) {
      case 'arcIntroduction':
        sections.push(buildArcIntroduction());
        break;
      
      case 'modeRole':
        if (mode.role) sections.push(mode.role);
        break;
      
      case 'modeTask':
        sections.push(`TASK: ${mode.task}`);
        break;
      
      case 'jsonInstructions':
        sections.push(buildJsonInstructions(true, context.isMultiTest));
        break;
      
      case 'debateContext':
        if (specialData?.originalExplanation) {
          sections.push(buildDebateContext(
            specialData.originalExplanation,
            specialData.customChallenge
          ));
        }
        break;
      
      case 'retryContext':
        if (specialData?.previousAnalysis) {
          sections.push(buildRetryContext(specialData.previousAnalysis));
        }
        break;
    }
  }
  
  return sections.filter(s => s.trim().length > 0).join('\n\n');
}

function buildArcIntroduction(): string {
  return `You are an expert at solving ARC-AGI puzzles (visual reasoning tasks with input→output transformations).

ARC-AGI puzzles consist of:
- Training examples showing input→output transformations  
- Test cases where you predict the transformation based on patterns learned from training`;
}

function buildDebateContext(originalExplanation: any, customChallenge?: string): string {
  let context = `CONTEXT: Another AI model provided this INCORRECT explanation:
- Pattern Description: ${originalExplanation.patternDescription}
- Solving Strategy: ${originalExplanation.solvingStrategy}`;

  if (originalExplanation.hints?.length > 0) {
    context += `\n- Hints: ${originalExplanation.hints.join(', ')}`;
  }
  
  if (customChallenge) {
    context += `\n\nHUMAN GUIDANCE: ${customChallenge}`;
  }
  
  return context;
}

function buildRetryContext(previousAnalysis: any): string {
  return `CONTEXT: Your previous analysis was incorrect.
Previous attempt:
- Model: ${previousAnalysis.modelName}
- Confidence: ${previousAnalysis.confidence}%
- Result: FAILED

Reconsider your approach with fresh eyes.`;
}
```

---

## Implementation Strategy

### Phase 1: Foundation (2-3 hours)
**Goal:** Create new infrastructure without breaking existing code

1. **Create new modules:**
   - `server/services/prompts/PromptContext.ts` (context detection)
   - `server/services/prompts/ModeRegistry.ts` (mode definitions)
   - `server/services/prompts/AssemblyPatterns.ts` (assembly rules)
   - `server/services/prompts/ContextAwareBuilder.ts` (new builder)

2. **Keep existing code:**
   - Don't delete `basePrompts.ts` yet
   - Don't modify `buildSystemPrompt()` yet
   - Run both systems in parallel

3. **Add feature flag:**
   ```typescript
   const USE_CONTEXT_AWARE_PROMPTS = process.env.EXPERIMENTAL_PROMPTS === 'true';
   ```

### Phase 2: Provider Adaptation (1-2 hours)
**Goal:** Make continuation prompts work

1. **Update `BaseAIService.buildPromptPackage()`:**
   ```typescript
   protected buildPromptPackage(...): PromptPackage {
     if (USE_CONTEXT_AWARE_PROMPTS) {
       const context = determineContext(promptId, options, serviceOpts, task);
       const systemPrompt = buildContextAwarePrompt(context, {
         originalExplanation: options.originalExplanation,
         previousAnalysis: options.previousAnalysis,
         customChallenge: options.customChallenge
       });
       // ... build user prompt ...
       return { systemPrompt, userPrompt, ... };
     } else {
       // Existing logic
       return buildAnalysisPrompt(task, promptId, customPrompt, options);
     }
   }
   ```

2. **Test with Responses API:**
   - Run solver mode with continuation
   - Verify prompts are shorter on turn 2+
   - Check database `system_prompt_used` field shows different content

### Phase 3: Migration (2-3 hours)
**Goal:** Switch all modes to new system

1. **Migrate each mode:**
   - Solver → Test with single and multi-test puzzles
   - Explanation → Test with emoji palette
   - Debate → Test with originalExplanation
   - Discussion → Test with previousAnalysis
   - Alien → Test with emoji requirement

2. **Compare outputs:**
   - Old system vs new system
   - Ensure predictions identical
   - Ensure JSON structure identical
   - Ensure token counts reasonable

3. **Update tests:**
   - Unit tests for context detection
   - Integration tests for prompt building
   - E2E tests for full analysis pipeline

### Phase 4: Cleanup (1 hour)
**Goal:** Remove old code

1. **Delete deprecated constants:**
   - `TASK_DESCRIPTIONS` from `basePrompts.ts`
   - `ADDITIONAL_INSTRUCTIONS` from `basePrompts.ts`
   - Old JSON constants (keep deprecated for reference)

2. **Remove old builder:**
   - Keep `buildSystemPrompt()` as wrapper for backwards compatibility
   - Internal implementation calls `buildContextAwarePrompt()`

3. **Update documentation:**
   - README with new architecture
   - Changelog with migration notes
   - API docs with prompt context examples

---

## Benefits of This Approach

### 1. Token Savings
**Before (Discussion mode continuation):**
```
SELF-REFINEMENT INSTRUCTIONS (200 tokens)
+ TASK (100 tokens)
+ JSON RULES (300 tokens)  ← Repeated
+ PREDICTION RULES (150 tokens)  ← Repeated
+ ARC EXPLANATION (100 tokens)  ← Repeated
= 850 tokens per turn
```

**After (Discussion mode continuation):**
```
SELF-REFINEMENT INSTRUCTIONS (200 tokens)
+ CONTEXT (50 tokens - "Your previous attempt failed")
= 250 tokens per turn
```

**Savings:** 70% reduction on continuation turns = $$$

### 2. Clarity
- No more redundant grid examples
- No more inverted assembly hacks
- Clear mode definitions in one place
- Explicit assembly patterns

### 3. Extensibility
**Adding a new mode:**
```typescript
// Old system: Edit 3 files, 5 locations
basePrompts.ts → Add to TASK_DESCRIPTIONS
basePrompts.ts → Add to ADDITIONAL_INSTRUCTIONS
promptBuilder.ts → Add builder function
systemPrompts.ts → Add to SYSTEM_PROMPT_MAP
userTemplates.ts → Maybe add custom user builder?

// New system: Add 1 object
ModeRegistry.ts → Add mode config
Done.
```

### 4. Provider Optimization
```typescript
// OpenAI/Grok with previousResponseId
if (context.conversationState === 'continuation') {
  // Minimal prompt - LLM has context
}

// Anthropic without previousResponseId
if (context.provider === 'anthropic') {
  // Always full prompt - no native chaining
}
```

### 5. Testability
```typescript
// Test context detection
expect(determineContext('solver', {}, {}, task)).toEqual({
  mode: 'solver',
  conversationState: 'initial',
  ...
});

// Test pattern selection
expect(selectPattern(context)).toEqual({
  sections: ['arcIntroduction', 'modeTask', 'jsonInstructions']
});

// Test assembly
const prompt = buildContextAwarePrompt(context);
expect(prompt).not.toContain('[[0,1,2],[3,4,5]][[0,1,2],[3,4,5]]');  // No duplication
```

---

## Effort Estimate

| Phase | Time | Risk | Benefit |
|-------|------|------|---------|
| Phase 1: Foundation | 2-3h | Low | Infrastructure ready |
| Phase 2: Provider Adaptation | 1-2h | Medium | Continuation works |
| Phase 3: Migration | 2-3h | Medium | All modes converted |
| Phase 4: Cleanup | 1h | Low | Tech debt removed |
| **Total** | **6-9h** | **Medium** | **Transformative** |

---

## Decision Matrix

### Do This If:
- ✅ You plan to add 3+ new modes
- ✅ You care about token costs (70% savings on continuations)
- ✅ You want proper Responses API utilization
- ✅ You value maintainability over quick fixes
- ✅ You're willing to invest 6-9 hours

### Skip This If:
- ⚠️ You're launching tomorrow (no time for refactor)
- ⚠️ You rarely use continuation/debate modes
- ⚠️ Token costs are negligible for your usage
- ⚠️ Current system "works well enough"
- ⚠️ You're a solo dev with feature backlog pressure

---

## Recommendation

**Implement Phase 1 + Phase 2 now (3-5 hours):**
- Build the infrastructure
- Fix continuation prompts
- Get immediate token savings
- Leave migration for later

**Why this is smart:**
1. **Quick win:** Continuation prompts alone save 70% tokens
2. **Low risk:** Old system still works, new system is opt-in
3. **Incremental:** Migrate modes one at a time when you touch them
4. **Learning:** See if the architecture works before full commitment

Then decide if Phases 3-4 are worth it based on real-world usage.

---

## Conclusion

Your prompt system isn't broken - it's **context-blind**. It mechanically assembles prompts without understanding:
- **Conversation state** (first turn vs continuation)
- **Mode requirements** (debate needs inverted structure)
- **Provider capabilities** (Responses API vs Messages API)
- **Redundancy patterns** (repeating instructions the LLM already has)

The fix isn't "clean up basePrompts.ts" - it's **"make the system aware of what it's doing."**

Start small (Phases 1-2), get immediate benefits, then decide if the full refactor is worth your time.
