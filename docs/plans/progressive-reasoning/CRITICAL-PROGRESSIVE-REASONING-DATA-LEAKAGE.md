# CRITICAL: Progressive Reasoning Data Leakage & Design Issues

**Author:** Cascade using Sonnet 4.5  
**Date:** 2025-10-11  
**Severity:** CRITICAL - Invalidates all progressive reasoning results  

## Executive Summary

The progressive reasoning workflow has a **critical data leakage bug** that sends test puzzle answers to the AI on every turn, making the entire feature scientifically invalid. Additionally, the architecture has severe design flaws that create maintenance nightmares.

---

## 🚨 CRITICAL BUG #1: Test Answers Sent to AI

### Location
`client/src/pages/PuzzleDiscussion.tsx` Line 103

### The Problem
```typescript
const {...} = useAnalysisResults({
  taskId: taskId || '',
  refetchExplanations,
  omitAnswer: false,  // ❌ WRONG! Sends test answers to AI
  originalExplanation: selectedExplanation,
  customChallenge: refinementState.userGuidance,
  previousResponseId: refinementState.getLastResponseId()
});
```

### Impact Chain
1. **PuzzleDiscussion** sets `omitAnswer: false`
2. **useAnalysisResults** passes this to analysis service
3. **puzzleAnalysisService** passes to prompt builder
4. **promptBuilder** calculates `includeAnswers = !omitAnswer = true`
5. **grids.ts formatTestSection()** line 172-174 includes test outputs:
   ```typescript
   `Test ${idx + 1} Input: ${input}\nCorrect Answer: ${testCases.outputs[idx]}`
   ```

### Result
**Every progressive reasoning turn sends the AI the correct answers.** The AI doesn't "refine" its analysis through reasoning - it just rephrases the answer it already knows.

### Evidence
Compare these two files:
- `scripts/grok-4-progressive-reasoning.ts` Line 138: `omitAnswer: true` ✅ CORRECT
- `client/src/pages/PuzzleDiscussion.tsx` Line 103: `omitAnswer: false` ❌ WRONG

The script does it correctly, but the UI doesn't.

---

## 🚨 CRITICAL BUG #2: Redundant Context on Continuation Turns

### Location
`server/services/promptBuilder.ts` Lines 127-176

### The Problem
When `previousResponseId` exists (continuation turn), the system still sends:
- Full training examples
- Full test case inputs
- System prompt instructions (though shorter)

### Why This is Wrong
The Responses API **already has all this context** stored server-side with the `previousResponseId`. Sending it again:
1. Wastes 600+ tokens per turn
2. Creates confusion (which version is authoritative?)
3. Violates the Responses API design pattern
4. Costs money unnecessarily

### The Fix Should Be
Continuation turns should send:
```typescript
{
  "previousResponseId": "resp_abc123...",
  "userMessage": "Continue refining your analysis based on your previous response."
}
```

That's it. No puzzle data. The API retrieves everything from the encrypted reasoning cache.

---

## 🔥 DESIGN DISASTERS

### 1. PuzzleDiscussion Component Architecture

**File:** `client/src/pages/PuzzleDiscussion.tsx` (574 lines)

#### Issues:
- **God Component**: 574 lines doing routing, state management, streaming, analysis, UI rendering
- **Prop Drilling Hell**: Passes 17+ props to `RefinementThread`
- **Unclear State Ownership**: Who owns refinement state? Component or hook?
- **Multiple Hooks Dependency Chain**:
  ```
  usePuzzle → useExplanation → useAnalysisResults → useRefinementState → useEligibleExplanations
  ```
- **Hard-coded Business Logic in UI**: Lines 143-194 contain analysis orchestration logic
- **Streaming State Management Mess**: Lines 109-130 duplicate streaming logic from other pages

#### SRP Violations:
This component handles:
1. Routing & navigation
2. Puzzle data fetching
3. Explanation data fetching
4. Refinement state management
5. Streaming coordination
6. UI rendering
7. Auto-selection from URL params
8. Error handling
9. Loading states
10. Data filtering

**Each of these should be its own component or service.**

### 2. Data Flow Opacity

The data flows through multiple abstraction layers with unclear ownership:

```
PuzzleDiscussion (UI)
  ↓
useAnalysisResults (Hook)
  ↓
analyzeAndSaveMutation (React Query)
  ↓
analysisStreamService (Service)
  ↓
puzzleAnalysisService (Service)
  ↓
promptBuilder (Service)
  ↓
AI Provider (External)
```

**Problem:** At which layer does `omitAnswer` get set? Where does `previousResponseId` get attached? Who validates the response? Each layer makes assumptions about what the previous layer did.

### 3. Inconsistent Progressive Reasoning Implementations

**Three Different Implementations:**
1. `PuzzleDiscussion.tsx` - UI version (WRONG - sends answers)
2. `scripts/grok-4-progressive-reasoning.ts` - Script version (CORRECT - omits answers)
3. Debate mode - Another conversation chaining pattern (different from both)

**No Shared Logic:** Each reimplements conversation chaining differently.

### 4. Streaming Architecture Duplication

Streaming logic is copy-pasted across:
- `PuzzleDiscussion.tsx` (Lines 109-130)
- `PuzzleExaminer.tsx` (Similar pattern)
- Stream controllers

**No Shared Abstraction:** Each page reinvents streaming state management.

---

## 🔒 DATA LEAKAGE AUDIT FINDINGS

### What Should Be Sent (Solver Mode)
```typescript
{
  "systemPrompt": "You are analyzing ARC-AGI puzzles...",
  "trainingExamples": [
    {"input": [[0,1],[1,0]], "output": [[1,0],[0,1]]}
  ],
  "testInput": [[0,0],[1,1]],  // NO OUTPUT!
  "previousResponseId": "resp_..." // For continuations
}
```

### What Is Actually Being Sent (PuzzleDiscussion Bug)
```typescript
{
  "systemPrompt": "You are analyzing ARC-AGI puzzles...",
  "trainingExamples": [
    {"input": [[0,1],[1,0]], "output": [[1,0],[0,1]]}
  ],
  "testInput": [[0,0],[1,1]],
  "testOutput": [[1,1],[0,0]],  // ⚠️ DATA LEAKAGE!
  "previousResponseId": "resp_..." // Also redundant
}
```

### Leakage Detection Logs

The system KNOWS about this (see `promptBuilder.ts` lines 118-124):
```typescript
logger.service('PromptBuilder', `🔒 DATA LEAKAGE CHECK:`);
logger.service('PromptBuilder', `   - includeAnswers: ${includeAnswers} (${includeAnswers ? '⚠️ TEST OUTPUTS WILL BE SENT' : '✅ Test outputs withheld'})`);
```

**The logs are warning you, but the bug persists.**

---

## 📊 IMPACT ASSESSMENT

### Scientific Validity
- ❌ All progressive reasoning results are invalid
- ❌ Cannot distinguish genuine improvement from answer memorization
- ❌ Published results must be retracted if based on this data

### Database Contamination
All explanations with:
- `prompt_template_id = 'discussion'`
- Created via PuzzleDiscussion UI

Are **scientifically invalid** because the AI had the answers.

### Cost Impact
- Wasted API calls with inflated token counts
- Continuation turns sending 600+ unnecessary tokens
- User guidance ignored because AI already knows answer

---

## ✅ RECOMMENDED FIXES

### Immediate (Critical)
1. **Fix Data Leakage:**
   ```typescript
   // PuzzleDiscussion.tsx Line 103
   omitAnswer: true,  // ✅ MUST BE TRUE for solver mode
   ```

2. **Add Database Flag:**
   ```sql
   ALTER TABLE explanations ADD COLUMN has_data_leakage BOOLEAN DEFAULT FALSE;
   UPDATE explanations SET has_data_leakage = TRUE 
   WHERE prompt_template_id = 'discussion' AND created_at < '2025-10-11';
   ```

### Short-term (High Priority)
3. **Optimize Continuation Prompts:**
   - Don't resend puzzle data when `previousResponseId` exists
   - Minimal continuation message: "Continue your analysis."

4. **Consolidate Progressive Reasoning:**
   - Extract shared logic to `ProgressiveReasoningService`
   - Single source of truth for conversation chaining
   - Reuse in UI, scripts, and batch processing

### Long-term (Architecture)
5. **Refactor PuzzleDiscussion:**
   - Split into 4-5 smaller components
   - Extract state management to dedicated service
   - Remove business logic from UI layer

6. **Create Streaming Hook:**
   ```typescript
   useStreamingAnalysis({
     taskId,
     modelKey,
     options,
     onComplete,
     onError
   })
   ```

7. **Add Data Leakage Tests:**
   ```typescript
   describe('Progressive Reasoning', () => {
     it('should NOT send test answers in solver mode', () => {
       const prompt = buildAnalysisPrompt(task, 'discussion', undefined, {
         omitAnswer: true
       });
       expect(prompt.userPrompt).not.toContain('Correct Answer');
     });
   });
   ```

---

## 🎯 ACTION PLAN

### Phase 1: Stop the Bleeding (1 hour)
- [ ] Change `omitAnswer: false` to `omitAnswer: true` in PuzzleDiscussion
- [ ] Add warning banner to Discussion page about previous invalid data
- [ ] Flag contaminated database records

### Phase 2: Validate Fix (2 hours)
- [ ] Add integration test for progressive reasoning
- [ ] Verify logs show "✅ Test outputs withheld"
- [ ] Manual test: Start discussion, verify prompt doesn't contain answer

### Phase 3: Clean Architecture (1-2 days)
- [ ] Extract ProgressiveReasoningService
- [ ] Optimize continuation prompts
- [ ] Refactor PuzzleDiscussion component
- [ ] Add comprehensive tests

### Phase 4: Database Cleanup (1 day)
- [ ] Mark invalid data
- [ ] Re-run valid progressive reasoning tests
- [ ] Update analytics to exclude contaminated data

---

## 🔍 CODE REVIEW CHECKLIST

For all future conversation chaining features:

- [ ] `omitAnswer: true` in solver mode (ALWAYS!)
- [ ] Continuation turns don't resend puzzle data
- [ ] previousResponseId properly propagated through layers
- [ ] Data leakage tests included
- [ ] Logs confirm no answers sent
- [ ] Database schema updated if needed
- [ ] User-facing documentation accurate

---

## 📝 LESSONS LEARNED

1. **Multi-layer abstractions hide bugs**: The `omitAnswer` flag passed through 6 layers before being used. No single place had visibility into the full chain.

2. **Logging is not enforcement**: The system logged warnings about data leakage but didn't prevent it.

3. **UI and scripts must share logic**: Divergent implementations create divergent behavior.

4. **State ownership matters**: Unclear whether component or hook owns refinement state led to prop drilling.

5. **Tests catch this**: None of these bugs would survive a basic integration test.

---

## CONCLUSION

The progressive reasoning feature is **fundamentally broken** due to data leakage and has been generating scientifically invalid results. All data collected via the PuzzleDiscussion UI should be flagged as contaminated.

The fix is simple (one line change), but the root cause is architectural: too many abstraction layers with unclear data flow and no validation tests.

**Priority:** Fix the critical bug TODAY, then schedule the architectural refactor for next sprint.
