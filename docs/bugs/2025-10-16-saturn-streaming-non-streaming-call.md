# Critical Bug: Saturn Streaming Called Non-Streaming Method

**Date**: 2025-10-16  
**Severity**: Critical  
**Impact**: Complete loss of streaming functionality - users saw zero real-time feedback  
**Fixed In**: Commit a2a5e988

---

## Problem Statement

Saturn Visual Solver's streaming endpoint was receiving SSE connections successfully and OpenAI was sending reasoning/text deltas, but **ZERO chunks were reaching the client**. Only `stream.status` events were emitted, no `stream.chunk` events.

The backend test script confirmed:
```
✅ stream.init received
📊 stream.status: starting
📊 stream.status: in_progress
❌ Chunks received: 0  ← NO CHUNKS!
```

---

## Root Cause

**Saturn service was calling the wrong method when streaming harness was present.**

### The Bug (saturnService.ts lines 177-186)

```typescript
// WRONG - Always calls non-streaming method
const phase1Response = await underlyingService.analyzePuzzleWithModel(
  task,
  underlyingModel,
  taskId,
  temperature,
  promptId,
  phase1Prompt,
  { ...options, includeImages: true, imagePaths: phase1Images },
  { ...serviceOpts, previousResponseId }  // ← serviceOpts contains harness!
);
```

Even though `serviceOpts.stream` contained a valid streaming harness, Saturn unconditionally called `analyzePuzzleWithModel()` which:
1. Makes a non-streaming OpenAI API call
2. Never emits `stream.chunk` events
3. Only completes at the END

**Result**: OpenAI generates reasoning tokens, but they're never sent to the client until the full response completes.

---

## The Fix

**Conditionally call streaming method when harness is present:**

```typescript
// CORRECT - Use streaming when harness exists
const phase1Response = harness
  ? await underlyingService.analyzePuzzleWithStreaming!(
      task,
      underlyingModel,
      taskId,
      temperature,
      promptId,
      phase1Prompt,
      { ...options, includeImages: true, imagePaths: phase1Images },
      { ...serviceOpts, previousResponseId }
    )
  : await underlyingService.analyzePuzzleWithModel(
      task,
      underlyingModel,
      taskId,
      temperature,
      promptId,
      phase1Prompt,
      { ...options, includeImages: true, imagePaths: phase1Images },
      { ...serviceOpts, previousResponseId }
    );
```

This pattern was applied to **all 5 Saturn phases**:
- Phase 1: First training example analysis
- Phase 2: Second training prediction
- Phase 2.5: Pattern refinement
- Additional training examples loop
- Phase 3: Test prediction

---

## Detection Method

The bug was found by:

1. **Backend test confirmed OpenAI payload was correct**:
   ```
   [OpenAI-PayloadBuilder] Has reasoning: true
   [OpenAI-PayloadBuilder] - verbosity: high  ← Correct!
   ```

2. **No `[OpenAI-Stream] Received event:` logs** appeared
   - Added debug logging to `openai.ts` streaming loop
   - Logs never printed → loop never executed
   - Confirmed non-streaming code path was used

3. **Traced call chain**:
   ```
   saturnStreamService → saturnService.analyzePuzzleWithStreaming
   → saturnService.analyzePuzzleWithModel (for each phase)
   → underlyingService.analyzePuzzleWithModel  ← BUG HERE!
   ```

---

## Anti-Pattern to Avoid

### ❌ WRONG: Ignore harness presence

```typescript
async myWrapperMethod(serviceOpts: ServiceOptions) {
  // Even though serviceOpts.stream exists, always call non-streaming
  return await underlyingService.analyzePuzzleWithModel(..., serviceOpts);
}
```

### ✅ CORRECT: Conditionally use streaming

```typescript
async myWrapperMethod(serviceOpts: ServiceOptions) {
  const harness = serviceOpts.stream;
  
  if (harness) {
    // Streaming path
    return await underlyingService.analyzePuzzleWithStreaming!(..., serviceOpts);
  } else {
    // Non-streaming path
    return await underlyingService.analyzePuzzleWithModel(..., serviceOpts);
  }
}
```

---

## Testing Checklist

To verify streaming works after fix:

1. **Server logs show stream events**:
   ```
   [OpenAI-Stream] Received event: response.reasoning_summary_text.delta
   [OpenAI-Stream] Emitting chunk: type=reasoning, delta length=47
   ```

2. **Backend test receives chunks**:
   ```bash
   node test-saturn-streaming.mjs
   # Should show: Chunks received: 50+
   ```

3. **Frontend UI displays real-time updates**:
   - Status log shows "🧠 Saturn reasoning update"
   - Reasoning text accumulates character by character
   - Not just "Waiting for AI output..."

---

## Related Files

- `server/services/saturnService.ts` - Main fix location
- `server/services/openai.ts` - Correct streaming implementation
- `server/services/base/BaseAIService.ts` - Defines streaming interface
- `test-saturn-streaming.mjs` - E2E streaming verification script

---

## Prevention

**Code review checklist for any service wrapper:**

- [ ] Does the wrapper accept `ServiceOptions`?
- [ ] Does it call underlying services?
- [ ] Does it check `serviceOpts.stream` before choosing method?
- [ ] Does it route to `analyzePuzzleWithStreaming` when harness present?

**Search pattern to find similar bugs:**

```bash
# Find all places calling analyzePuzzleWithModel with serviceOpts
grep -r "analyzePuzzleWithModel.*serviceOpts" --include="*.ts"
```

---

## Impact Assessment

**Before Fix:**
- User clicks "Start Analysis" → NO FEEDBACK for 30+ seconds
- OpenAI charges for reasoning tokens but user sees nothing
- User thinks app is broken
- ~$0.90 per analysis with zero UX value during processing

**After Fix:**
- User sees reasoning appear character-by-character
- Real-time progress through Saturn phases
- Professional streaming experience
- Same cost, massively better UX
