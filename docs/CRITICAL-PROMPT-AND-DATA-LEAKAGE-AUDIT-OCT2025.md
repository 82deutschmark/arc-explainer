# CRITICAL PROMPT CONSTRUCTION & DATA LEAKAGE AUDIT
**Author:** Cascade using Claude Sonnet 4  
**Date:** 2025-10-12  
**Status:** 🔴 CRITICAL ISSUES IDENTIFIED

---

## EXECUTIVE SUMMARY

After deep analysis of recent commits (9ef932c1, eabb0043, 8a5a6c0a) and the prompt construction architecture, I've identified **CRITICAL DATA LEAKAGE VULNERABILITIES** and **ARCHITECTURAL FLAWS** in the prompt system.

### 🚨 SMOKING GUN FINDINGS

1. **DATA LEAKAGE IN DISCUSSION MODE** (PARTIALLY FIXED)
   - Commit 390de996 changed `omitAnswer: false` → `true` in PuzzleDiscussion.tsx
   - 20 contaminated database entries were fixed (commit eabb0043)
   - BUT: No systematic safeguards prevent future leakage

2. **CUSTOM PROMPTS HAD TOTAL DATA LEAKAGE** (FIXED)
   - Commit 8a5a6c0a fixed custom prompts always receiving correct answers
   - Root cause: Used `!isSolverMode` instead of `!omitAnswer`
   - This was a FUNDAMENTAL INTEGRITY BUG

3. **CURRENT VULNERABILITY: omitAnswer IS NOT SAFE BY DEFAULT**
   - `omitAnswer` defaults to `true` but can be overridden at MULTIPLE LAYERS
   - No enforcement mechanism prevents accidental leakage
   - System relies on developers remembering to set it correctly

4. **ARCHITECTURAL FLAW: TOO MUCH IN SYSTEM PROMPT**
   - System prompts contain behavior instructions + JSON format + prediction instructions
   - User prompts are ambiguous and don't clearly state the problem
   - OpenAI Responses API guidance suggests opposite approach

5. **MISSING JSON SCHEMA FILE**
   - `server/services/schemas/arcJsonSchema.ts` is an empty stub
   - Actual schemas scattered across providers (grok.ts, core.ts)
   - No single source of truth for schema structure

---

## DETAILED ANALYSIS

### 1. DATA LEAKAGE VULNERABILITY MAP

#### WHERE CORRECT ANSWERS CAN BE SENT TO AI

```typescript
// CRITICAL PATH: formatTestSection() in formatters/grids.ts
export function formatTestSection(
  task: ARCTask,
  useEmojis: boolean = false,
  emojiPalette?: string[],
  includeAnswers: boolean = true,  // ❌ DEFAULTS TO TRUE!
  isSolverMode: boolean = false
): string {
  // Lines 160-175: If includeAnswers=true, sends:
  // "Correct Answer: ${testCases.outputs[idx]}"
}
```

**Current Flow:**
```
User Request
  ↓
puzzleController.analyze() [omitAnswer defaults true ✅]
  ↓
puzzleAnalysisService.analyzePuzzle() [omitAnswer=true ✅]
  ↓
buildAnalysisPrompt() [omitAnswer=true ✅]
  ↓
buildUserPromptForTemplate() [passes omitAnswer ✅]
  ↓
formatTestSection() [receives !omitAnswer = false ✅]
  ↓  
🔒 SAFE: Answers withheld
```

**BUT IF ANY LAYER FAILS:**
```
omitAnswer: false at ANY point
  ↓
includeAnswers: true in formatTestSection()
  ↓
🚨 LEAKAGE: "Correct Answer: [[1,2],[3,4]]" sent to AI
```

#### CURRENT VULNERABILITIES

| Location | omitAnswer Default | Risk Level |
|----------|-------------------|------------|
| `puzzleController.ts:68` | `req.body.omitAnswer !== false` (defaults true) | ✅ SAFE |
| `puzzleAnalysisService.ts:84` | `omitAnswer = true` | ✅ SAFE |
| `promptBuilder.ts:78` | `omitAnswer = true` | ✅ SAFE |
| `userTemplates.ts:60` | `omitAnswer = false` ❌ | 🔴 DANGEROUS |
| `formatTestSection:147` | `includeAnswers = true` ❌ | 🔴 DANGEROUS |

**CRITICAL:** Two functions default to UNSAFE values:
- `buildUserPrompt()` defaults `omitAnswer = false` (line 60)
- `formatTestSection()` defaults `includeAnswers = true` (line 147)

### 2. KNOWN DATA LEAKAGE INCIDENTS

#### A. Discussion Mode Leakage (Oct 11, 2025)
**Commit:** 390de996  
**Issue:** PuzzleDiscussion.tsx was using `omitAnswer: false`  
**Impact:** All discussion mode analyses received correct answers  
**Fix:** Changed to `omitAnswer: true`  
**Database Cleanup:** 20 contaminated entries fixed (commit eabb0043)

#### B. Custom Prompt Leakage (Sept 18, 2025)
**Commit:** 8a5a6c0a  
**Issue:** `buildCustomUserPrompt()` used `!isSolverMode` instead of `!omitAnswer`  
**Impact:** ALL custom prompts always received correct answers regardless of toggle  
**Fix:** Changed line 105 to use `!omitAnswer`

#### C. Debate Mode Current State
**File:** `pages/ModelDebate.tsx:86`  
**Current:** `omitAnswer: false`  
**Status:** ⚠️ INTENTIONAL? Needs verification  
**Question:** Should debate mode see correct answers?

### 3. SYSTEM PROMPT VS USER PROMPT ARCHITECTURE

#### CURRENT ARCHITECTURE (Problematic)

**System Prompt Contains:**
- BASE_SYSTEM_PROMPT (AI role and ARC rules)
- Task description (what to do)
- JSON format instructions (how to structure response)
- Prediction field requirements (schema details)
- Additional mode-specific instructions

**User Prompt Contains:**
- "TRAINING EXAMPLES:" + grids
- "TEST CASE:" + grid
- Optional emoji legend
- In debate mode: previous explanation

**PROBLEM:** System prompt is overloaded with multiple concerns:
1. AI behavior/role
2. Output format requirements
3. Task-specific instructions

#### RECOMMENDED ARCHITECTURE (OpenAI Responses API Best Practice)

**System Prompt Should Contain:**
- AI role and expertise definition
- General behavior guidelines
- Output format expectations (high-level)

**User Prompt Should Contain:**
- Clear problem statement
- All puzzle data
- Explicit task requirements
- Context from previous turns (debate/discussion)

**JSON Schema Should Contain:**
- Structured output enforcement (via `response_format`)
- Field definitions and constraints
- NOT in prompt text at all

#### SPECIFIC ISSUES

1. **JSON Instructions in System Prompt**
   - File: `prompts/components/jsonInstructions.ts`
   - Problem: Schema structure embedded in prompt text
   - Should be: Enforced via `response_format` parameter

2. **Ambiguous User Prompts**
   - Current: Just shows grids with labels
   - Should: Explicitly state "Predict the output grid for the test case"
   - Missing: Clear success criteria

3. **Test Count Complexity**
   - System tries to dynamically adjust instructions for multi-test puzzles
   - AI models should infer this from data structure
   - Over-engineering adds cognitive overhead

### 4. RESPONSES API INTEGRATION GAPS

Based on `docs/RESPONSES-API-OCT2025.md`:

#### CRITICAL REQUIREMENTS NOT MET

1. **"input" vs "messages"**
   - ✅ CORRECT: OpenAI service uses `input` array
   - ⚠️ VERIFY: All providers use correct format

2. **Conversation Chaining**
   - ✅ EXISTS: `previousResponseId` support in code
   - ❌ INCOMPLETE: Not all providers support it
   - ❌ NO VALIDATION: No checks if provider supports chaining

3. **Reasoning Parameter**
   - ✅ EXISTS: `reasoning` parameter in OpenAI service
   - ❌ NOT VISIBLE: Prompts don't show what's being sent
   - ❌ NO UI FEEDBACK: User can't see reasoning was requested

4. **Token Budget Management**
   - ⚠️ UNCLEAR: How is `max_output_tokens` set?
   - ❌ NO GUIDANCE: Docs say 8192+ for reasoning, we don't enforce this
   - ❌ NO WARNINGS: UI doesn't warn about insufficient tokens

### 5. MISSING SAFEGUARDS

#### No Validation That Data Leakage Prevention Works

1. **No Runtime Checks**
   ```typescript
   // SHOULD EXIST BUT DOESN'T:
   function validateNoAnswersInPrompt(userPrompt: string): void {
     if (userPrompt.includes('Correct Answer:')) {
       throw new SecurityError('DATA LEAKAGE: Correct answer in prompt!');
     }
   }
   ```

2. **No UI Visibility**
   - User can't see actual prompts sent to AI
   - Prompt preview modal exists but not always used
   - Console logs are developer-only

3. **No Database Flags**
   - No `had_access_to_answers` flag in explanations table
   - Can't query "which results are contaminated?"
   - Can't exclude contaminated data from accuracy metrics

---

## PROPOSED SOLUTION ARCHITECTURE

### PHASE 1: IMMEDIATE SECURITY FIXES (HIGH PRIORITY)

#### 1.1 ENFORCE SAFE DEFAULTS

**File:** `server/services/formatters/grids.ts`

```typescript
export function formatTestSection(
  task: ARCTask,
  useEmojis: boolean = false,
  emojiPalette?: string[],
  includeAnswers: boolean = false,  // ✅ CHANGE TO FALSE
  isSolverMode: boolean = false
): string {
  // ...existing code...
}
```

**File:** `server/services/prompts/userTemplates.ts`

```typescript
const {
  emojiSetKey,
  omitAnswer = true,  // ✅ CHANGE TO TRUE
  useEmojis = false,
  // ...
} = options;
```

#### 1.2 ADD RUNTIME VALIDATION

**New File:** `server/services/validation/promptSecurity.ts`

```typescript
/**
 * Security validator to prevent data leakage in prompts
 */
export class PromptSecurityValidator {
  /**
   * Verify prompt does not contain correct answers
   * @throws SecurityError if answers detected
   */
  static validateNoAnswerLeakage(
    userPrompt: string,
    omitAnswer: boolean,
    isSolverMode: boolean
  ): void {
    // If we should be hiding answers, verify they're not present
    if (omitAnswer || isSolverMode) {
      const leakagePatterns = [
        /Correct Answer:/i,
        /Test \d+ Output:/i,
        /Expected Output:/i
      ];
      
      for (const pattern of leakagePatterns) {
        if (pattern.test(userPrompt)) {
          throw new SecurityError(
            `DATA LEAKAGE DETECTED: Correct answer found in prompt when omitAnswer=${omitAnswer}, isSolverMode=${isSolverMode}`
          );
        }
      }
    }
  }
  
  /**
   * Log security audit trail
   */
  static logSecurityCheck(
    puzzleId: string,
    omitAnswer: boolean,
    isSolverMode: boolean,
    promptLength: number
  ): void {
    logger.security('PROMPT_SECURITY', {
      puzzleId,
      omitAnswer,
      isSolverMode,
      promptLength,
      shouldHideAnswers: omitAnswer || isSolverMode,
      timestamp: new Date().toISOString()
    });
  }
}
```

#### 1.3 ADD DATABASE TRACKING

**Migration:** Add `omit_answer_flag` to explanations table

```sql
ALTER TABLE explanations 
ADD COLUMN omit_answer_flag BOOLEAN DEFAULT TRUE;

-- Add index for querying contaminated data
CREATE INDEX idx_omit_answer ON explanations(omit_answer_flag);
```

#### 1.4 ADD UI VISIBILITY

**Component:** `PromptSecurityBadge.tsx`

```tsx
// Show user whether answers were hidden
<div className={omitAnswer ? 'badge-success' : 'badge-warning'}>
  {omitAnswer ? '🔒 Answers Hidden' : '⚠️ Answers Visible'}
</div>
```

### PHASE 2: ARCHITECTURAL REFACTOR (MEDIUM PRIORITY)

#### 2.1 SEPARATE CONCERNS IN PROMPTS

**New Structure:**

```
System Prompt (Role & Behavior)
├── AI Expertise Definition
├── General Guidelines
└── High-level Output Expectations

User Prompt (Problem & Data)
├── Problem Statement: "Predict the output grid for the test case below"
├── Training Examples with clear labels
├── Test Input with clear label
└── Success Criteria: "Provide a 2D array of integers 0-9"

JSON Schema (Structure Enforcement)
├── Via response_format parameter
├── NOT in prompt text
└── Dynamic based on test count
```

#### 2.2 IMPLEMENT CLEAR PROBLEM STATEMENTS

**Current User Prompt:**
```
TRAINING EXAMPLES:
[grids]

TEST CASE:
[grid]
```

**Proposed User Prompt:**
```
PROBLEM: Analyze the training examples below and predict the output grid for the test case.

TRAINING EXAMPLES (showing input → output transformations):
Example 1:
  Input: [[0,1],[2,3]]
  Output: [[1,0],[3,2]]

Example 2:
  Input: [[4,5],[6,7]]
  Output: [[5,4],[7,6]]

TEST CASE (predict the output):
  Input: [[8,9],[0,1]]
  Expected Output: [Your prediction as 2D array]

TASK: Provide your predicted output grid and explain the transformation rule you discovered.
```

#### 2.3 CONSOLIDATE JSON SCHEMA LOGIC

**Current:** Scattered across multiple files
**Proposed:** Single source of truth

```
server/services/schemas/
├── index.ts (exports all schemas)
├── core.ts (base schema builder)
├── providers/
│   ├── openai.ts (OpenAI-specific wrapper)
│   ├── grok.ts (xAI-specific wrapper)
│   └── openrouter.ts (generic wrapper)
└── validation.ts (schema validation logic)
```

### PHASE 3: RESPONSES API ALIGNMENT (LOW PRIORITY)

#### 3.1 STANDARDIZE INPUT FORMAT

Ensure all providers use Responses API compatible format:
- `input` array with role/content objects
- `response_format` with JSON schema
- `store: true` for conversation chaining
- `reasoning` parameter for thinking models

#### 3.2 ADD TOKEN BUDGET WARNINGS

UI should warn when:
- Reasoning models selected but `max_output_tokens` < 8192
- Multi-test puzzles with long prompts
- Conversation chains getting too long

#### 3.3 EXPOSE REASONING TO UI

Show users when reasoning was:
- Requested (reasoning effort/verbosity settings)
- Received (reasoning_tokens count)
- Available for viewing (expand reasoning log)

---

## IMPLEMENTATION PRIORITY

### 🔴 CRITICAL (DO NOW)

1. **Change unsafe defaults** (5 min)
   - `formatTestSection()` includeAnswers default to `false`
   - `buildUserPrompt()` omitAnswer default to `true`

2. **Add runtime validation** (30 min)
   - Create `PromptSecurityValidator` class
   - Call in `buildAnalysisPrompt()` before returning

3. **Add database tracking** (15 min)
   - Migration to add `omit_answer_flag` column
   - Update `ExplanationRepository.create()` to save flag

### 🟡 HIGH (THIS WEEK)

4. **Add UI visibility** (1 hour)
   - Security badge component
   - Show in PuzzleExaminer and PuzzleDiscussion
   - Add to PromptPreviewModal

5. **Audit all prompt modes** (2 hours)
   - Verify debate mode SHOULD see answers
   - Check discussion mode is truly fixed
   - Test custom prompts with toggle

6. **Write test suite** (3 hours)
   - Unit tests for `formatTestSection()` with various flags
   - Integration tests for full prompt building
   - Security tests to detect leakage patterns

### 🟢 MEDIUM (THIS MONTH)

7. **Refactor prompt architecture** (1 day)
   - Separate system/user concerns
   - Add clear problem statements
   - Consolidate JSON schema logic

8. **Standardize Responses API usage** (1 day)
   - Audit all providers
   - Ensure consistent format
   - Add conversation chaining validation

### 🔵 LOW (BACKLOG)

9. **Add analytics dashboard** (2 days)
   - Show data leakage audit trail
   - Flag contaminated entries
   - Report on security compliance

10. **Comprehensive documentation** (1 day)
    - Update EXTERNAL_API.md
    - Document security model
    - Add troubleshooting guide

---

## TESTING CHECKLIST

Before marking this complete, verify:

- [ ] All defaults are safe (omitAnswer=true)
- [ ] Runtime validation catches leakage attempts
- [ ] Database tracks omit_answer_flag for all new entries
- [ ] UI shows security status clearly
- [ ] Prompt preview modal works for all modes
- [ ] No "Correct Answer:" text in prompts when omitAnswer=true
- [ ] Discussion mode is fixed and verified
- [ ] Custom prompts respect omitAnswer toggle
- [ ] Debate mode behavior is documented and intentional
- [ ] Test suite covers all edge cases
- [ ] Documentation is complete and accurate

---

## QUESTIONS FOR USER

1. **Debate Mode:** Should `omitAnswer: false` in ModelDebate.tsx be changed to `true`? What's the intended behavior?

2. **JSON Schema Location:** Should we write the proper `arcJsonSchema.ts` or continue using provider-specific schemas?

3. **System Prompt Refactor:** Do you want to keep all JSON instructions in system prompt, or move to pure `response_format` enforcement?

4. **UI Changes:** Should the security badge be always visible, or only in developer/researcher mode?

5. **Contaminated Data:** Should we add a migration to mark all pre-Oct-11 discussion mode entries as contaminated?

---

## CONCLUSION

The prompt construction system has **CRITICAL SECURITY VULNERABILITIES** that allow correct answers to leak to AI models. While some bugs have been fixed (custom prompts, discussion mode), there are **NO SYSTEMATIC SAFEGUARDS** to prevent future incidents.

**IMMEDIATE ACTION REQUIRED:**
1. Change unsafe defaults in `grids.ts` and `userTemplates.ts`
2. Add runtime validation to detect leakage
3. Add database tracking for audit trail

**MEDIUM-TERM GOALS:**
- Refactor prompt architecture to separate concerns
- Align with OpenAI Responses API best practices
- Add comprehensive test coverage

This is not a "quick fix" situation - it requires **SYSTEMATIC ARCHITECTURAL CHANGES** to ensure long-term security and correctness.
