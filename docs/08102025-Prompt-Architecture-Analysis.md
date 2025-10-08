# Prompt Architecture Analysis
**Author:** Cascade (Claude Sonnet 4)  
**Date:** October 8, 2025  
**Purpose:** Analyze the current prompt construction system and determine if refactoring is needed

## Executive Summary

Your other assistant's critique has merit, but it's **partially outdated**. The codebase **already underwent a major DRY refactor** (see file headers dated September 2025), and the architecture is more modular than the critique suggests. However, `basePrompts.ts` still violates SRP by mixing constants, documentation, and domain logic.

**Verdict:** Refactoring is NOT urgent, but optimization would improve maintainability. The system works, but isn't as clean as your AGENTS.md principles demand.

---

## Current Architecture (How Prompts Actually Flow)

### 1. **Entry Points** (Where Analysis Starts)
```
Services (openai.ts, anthropic.ts, etc.)
  ↓
BaseAIService.buildPromptPackage()
  ↓
promptBuilder.ts → buildAnalysisPrompt()
```

### 2. **System Prompt Construction**
```
promptBuilder.ts → buildAnalysisPrompt()
  ↓
systemPrompts.ts → getSystemPrompt(promptId)
  ↓
SYSTEM_PROMPT_MAP → { solver, explanation, debate, etc. }
  ↓
components/promptBuilder.ts → buildSystemPrompt(config)
  ↓
components/basePrompts.ts → BASE_SYSTEM_PROMPT, JSON_HEADER, etc.
```

### 3. **User Prompt Construction**
```
promptBuilder.ts → buildAnalysisPrompt()
  ↓
userTemplates.ts → buildUserPromptForTemplate()
  ↓
formatters/grids.ts → formatTrainingExamples(), formatTestSection()
  ↓
EMOJI_PALETTES (grid conversion)
```

### 4. **Final Assembly**
```typescript
PromptPackage {
  systemPrompt: string,  // AI behavior instructions
  userPrompt: string,    // Puzzle data
  selectedTemplate: PromptTemplate | null,
  isAlienMode: boolean,
  isSolver: boolean
}
```

Services send this to LLMs:
- **System role**: `systemPrompt` (how to behave)
- **User role**: `userPrompt` (what to analyze)

---

## The Critique: What's Valid vs. What's Wrong

### ✅ VALID CRITICISMS

1. **`basePrompts.ts` is bloated (170 lines)**
   - Contains redundant explanations of ARC-AGI structure (lines 21-24, 74-76, 79-80)
   - JSON format instructions repeated in multiple constants
   - Grid format warnings appear 3+ times
   - Mixing documentation with code

2. **TASK_DESCRIPTIONS and ADDITIONAL_INSTRUCTIONS overlap**
   - `solver` has identical content in both objects
   - Could be merged into single structure: `{ task, explanation, extras }`

3. **Alien mode should be a plugin**
   - `alienCommunication` mode baked into base prompts violates SRP
   - Educational mode, debate mode, etc. all hardcoded
   - These should be modular extensions

4. **SRP violation**
   - File tries to be:
     - Constants registry ✅
     - Documentation ❌
     - Template engine ❌
     - Validation rules ❌

### ❌ INVALID/OUTDATED CRITICISMS

1. **"It's a spider on espresso flowchart"**
   - Dramatic, but inaccurate
   - The architecture IS modular (system vs user prompts separated)
   - `promptBuilder.ts` DOES compose from components
   - Already underwent major DRY refactor (September 2025)

2. **"Should be split into 4 files"**
   - Already IS split into 5+ files:
     - `basePrompts.ts` - constants
     - `promptBuilder.ts` (components) - composition
     - `systemPrompts.ts` - mode mapping
     - `userTemplates.ts` - data formatting
     - `grids.ts` - emoji conversion

3. **"Needs to import bricks instead of stacking the quarry"**
   - This is EXACTLY what's already happening!
   - `promptBuilder.ts` imports from `basePrompts.ts`
   - `systemPrompts.ts` imports builder functions
   - Services use `PromptPackage` abstraction

---

## The ACTUAL Problems

### 1. **basePrompts.ts Violates SRP**
```typescript
// ❌ PROBLEM: This file has 4 responsibilities
export const BASE_SYSTEM_PROMPT = `...`;      // 1. System behavior
export const JSON_HEADER = `...`;             // 2. Output format
export const TASK_DESCRIPTIONS = { ... };     // 3. Mode definitions
export const ADDITIONAL_INSTRUCTIONS = { ... }; // 4. Mode extensions
```

**Why it's bad:**
- Change JSON validation? Touch lines 30-48
- Add new mode? Touch lines 73-99 AND 104-170
- Update grid format? Touch multiple constants
- No clear "what lives where" pattern

### 2. **Redundant Documentation**
Lines 21-24, 74-76, 79-80 all explain "ARC-AGI puzzles consist of training examples..."

**Problem:** If ARC-AGI format changes, you must update 3+ places.

### 3. **Mode Definitions Not Extensible**
```typescript
export const TASK_DESCRIPTIONS = {
  solver: `...`,
  explanation: `...`,
  alienCommunication: `...`,  // ❌ Why is alien mode hardcoded?
  educational: `...`,
  gepa: `...`,
  debate: `...`,
  discussion: `...`
} as const;
```

**Problem:** Adding a new AI experiment (e.g., "socratic method") requires editing base constants.

### 4. **Duplicate JSON Enforcement**
```typescript
// Appears in 3 places:
- JSON_HEADER (line 30)
- JSON_FIELDS_INSTRUCTIONS (line 33-47)
- PREDICTION_FIELD_INSTRUCTIONS (line 62-68)
- buildCustomPrompt() in promptBuilder.ts (lines 128-131)
```

**Problem:** JSON requirements scattered across codebase.

---

## Does It Need Refactoring?

### NO, If You Value:
- ✅ System works fine (no bugs reported)
- ✅ Already underwent major refactor (September 2025)
- ✅ Modular architecture exists (5+ files, clear separation)
- ✅ Only 170 lines (not massive bloat)
- ⚠️ You're a solo hobbyist with limited time

### YES, If You Value:
- 🎯 Strict SRP adherence (your AGENTS.md principle)
- 🎯 Easy extensibility (new AI modes as plugins)
- 🎯 DRY at maximum level (zero redundancy)
- 🎯 Long-term maintainability
- 🎯 Following your own manifesto: "You never compromise on code quality"

---

## Recommended Refactor (If You Proceed)

### Phase 1: Split `basePrompts.ts` by Concern

```
/server/services/prompts/
├── core/
│   ├── systemBehavior.ts     # BASE_SYSTEM_PROMPT only
│   ├── outputFormat.ts       # JSON_HEADER, JSON_FIELDS_INSTRUCTIONS
│   └── gridRules.ts          # PREDICTION_FIELD_INSTRUCTIONS
├── modes/
│   ├── index.ts              # Mode registry
│   ├── solver.ts             # Solver mode definition
│   ├── explanation.ts        # Explanation mode
│   ├── debate.ts             # Debate mode
│   └── extensions/           # Experimental modes
│       ├── alien.ts
│       ├── educational.ts
│       └── gepa.ts
├── components/
│   └── promptBuilder.ts      # Composition engine (keep as-is)
├── systemPrompts.ts          # Mode mapping (keep as-is)
└── userTemplates.ts          # Data formatting (keep as-is)
```

### Phase 2: Create Mode Plugin System

```typescript
// modes/index.ts
export interface PromptMode {
  id: string;
  name: string;
  taskDescription: string;
  additionalInstructions?: string;
  requiresEmojis?: boolean;
  isSolver?: boolean;
}

export const MODE_REGISTRY: Record<string, PromptMode> = {
  solver: {
    id: 'solver',
    name: 'Solver Mode',
    taskDescription: SOLVER_TASK,
    isSolver: true
  },
  alien: {
    id: 'alienCommunication',
    name: 'Alien Communication',
    taskDescription: ALIEN_TASK,
    additionalInstructions: ALIEN_EXTRAS,
    requiresEmojis: true
  }
};
```

### Phase 3: Consolidate JSON Enforcement

```typescript
// core/outputFormat.ts
export const JSON_VALIDATION = {
  header: `JSON STRUCTURE REQUIREMENT: Do not use special characters...`,
  
  fields: {
    single: `"predictedOutput": [[0,1,2],[3,4,5]]`,
    multi: `"predictedOutput1", "predictedOutput2", ...`,
    optional: `"solvingStrategy", "patternDescription", ...`
  },
  
  gridFormat: {
    rule: `2D array where outer contains rows, each row is array of 0-9`,
    correct: `[[0,1,2],[3,4,5]]`,
    wrong: [`[[[0,1],[2,3]]]`, `[[0],[1],[2]]`]
  }
};

export function buildJsonInstructions(mode: 'single' | 'multi'): string {
  return [
    JSON_VALIDATION.header,
    JSON_VALIDATION.fields[mode],
    JSON_VALIDATION.gridFormat.rule
  ].join('\n');
}
```

### Phase 4: Update TASK_DESCRIPTIONS Structure

```typescript
// Before (overlapping):
TASK_DESCRIPTIONS = { solver: "...", ... }
ADDITIONAL_INSTRUCTIONS = { solver: "...", ... }

// After (unified):
export interface ModeConfig {
  task: string;          // What to do
  guidance: string;      // How to do it
  extras?: string;       // Special requirements
}

export const MODE_CONFIGS: Record<string, ModeConfig> = {
  solver: {
    task: "Analyze training examples and predict test output",
    guidance: "Predict the correct output grid for the test case",
    extras: undefined
  },
  alien: {
    task: "Explain transformation AND interpret alien communication",
    guidance: "Focus on spatial pattern meaning",
    extras: "alienMeaning and alienMeaningConfidence fields required"
  }
};
```

---

## Effort Estimate

### Current State
- **Files:** 5 (prompts/, formatters/)
- **Lines:** ~900 total
- **Complexity:** Medium
- **Bug Risk:** Low (working system)

### Refactored State
- **Files:** 12+ (split by concern)
- **Lines:** ~1000 (slight increase for clarity)
- **Complexity:** Low (clearer separation)
- **Bug Risk:** Medium (testing required)

### Time Investment
- **Phase 1 (Split files):** 2-3 hours
- **Phase 2 (Plugin system):** 3-4 hours
- **Phase 3 (JSON consolidation):** 1-2 hours
- **Phase 4 (Mode configs):** 1-2 hours
- **Testing:** 2-3 hours
- **Total:** 9-14 hours

---

## My Recommendation

**Don't refactor immediately.** Here's why:

1. **System works fine** - No bugs, no user complaints
2. **Already refactored** - September 2025 DRY pass completed
3. **Solo hobbyist** - 10+ hours better spent on features
4. **170 lines isn't huge** - Not at critical mass yet

**HOWEVER**, if you encounter any of these triggers:
- ❌ Adding 3+ new AI modes
- ❌ JSON validation bugs appear
- ❌ Onboarding another developer
- ❌ Difficulty maintaining prompts

Then refactor using the plan above.

---

## What Your Other Assistant Got Wrong

1. **"It's way too complex"** - It's actually reasonably architected
2. **"Half documentation, half templating"** - Only `basePrompts.ts` has this issue
3. **"Needs to be split"** - Already IS split into 5 files
4. **"Import bricks, not stack the quarry"** - That's EXACTLY what's happening

**What they got RIGHT:**
- `basePrompts.ts` violates SRP
- Redundant documentation exists
- Mode sprawl could be cleaned up
- JSON enforcement is scattered

---

## Conclusion

Your prompt system is **functional but not perfect**. It follows 70% of your AGENTS.md principles but violates SRP in one key file.

**Action Plan:**
1. ✅ **Do nothing now** (system works)
2. 📋 **Bookmark this analysis** for future reference
3. ⚡ **Refactor when you hit pain points** (not before)
4. 🎯 **Focus on features** (this is a hobby project)

Your other assistant was being overly dramatic. The system isn't a "spider on espresso" - it's a working monorepo that could use some cleanup but isn't blocking your progress.

---

## SRP/DRY Check
- **Pass:** Architecture is modular (system vs user prompts separated)
- **Fail:** `basePrompts.ts` has 4 responsibilities instead of 1
- **Verdict:** B+ grade, could be A+ with refactor
