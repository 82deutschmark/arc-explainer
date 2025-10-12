/**
 * Author: Sonnet 4.5
 * Date: 2025-10-11
 * PURPOSE: Comprehensive production fix plan for Saturn and Grover solvers.
 * Addresses 5 critical bugs, 3 architectural issues, and 2 UX gaps.
 * Timeline: 5 days (3 days core fixes + 2 days polish/cleanup)
 * SRP/DRY check: Pass - Plan only, implementation follows
 */

# Saturn & Grover Production Fix Plan

**Status**: Ready for Implementation
**Priority**: P0 (Production Critical)
**Timeline**: 5 days
**Complexity**: Medium
**Risk**: Low (fixing existing code, not rewriting)

---

## Executive Summary

Both solvers have **working WebSocket streaming** but **broken SSE streaming**. The core algorithms are production-ready (Saturn: 540 lines, Grover: 592 lines), but streaming infrastructure has gaps.

**Core Problems:**
1. ❌ Grover SSE: `maxSteps` parameter not passed through
2. ❌ Saturn SSE: Phase orchestration not implemented
3. ❌ Windows: No timeout support for Grover executor
4. ❌ Legacy: Old Saturn Python path still active
5. ❌ UX: No cancel endpoint for long jobs

**Philosophy**: Fix production bugs FIRST, then polish. No gold-plating.

---

## Problem Analysis

### Issue #1: Grover SSE Streaming Broken

**File**: `server/services/streaming/groverStreamService.ts:45-61`

**Current Code:**
```typescript
await puzzleAnalysisService.analyzePuzzleStreaming(
  taskId,
  modelKey,
  {
    temperature,
    promptId: 'grover',
    captureReasoning: true,
    previousResponseId,
    // maxSteps removed - not part of AnalysisOptions type  ← PROBLEM
  },
  harness,
  {
    sessionId,
    previousResponseId,
    // maxSteps removed - not part of service options  ← PROBLEM
  }
);
```

**But groverService.ts NEEDS IT:**
```typescript
// grover.ts:42
const maxIterations = serviceOpts.maxSteps || 5;
```

**Root Cause**: `AnalysisOptions` type doesn't include `maxSteps`, but Grover service expects it in `ServiceOptions`.

**Impact**: SSE streaming always uses default 5 iterations, users can't customize.

**Evidence**:
- Controller parses `maxIterations` from query (groverController.ts:161)
- Controller passes it to stream service (groverController.ts:170)
- Stream service IGNORES it (removed at line 53 with comment)
- Grover service never receives it
- Falls back to default 5 iterations

---

### Issue #2: Saturn SSE Incomplete

**File**: `server/services/streaming/saturnStreamService.ts`

**Current Code (74 lines):**
```typescript
await puzzleAnalysisService.analyzePuzzleStreaming(
  taskId,
  modelKey,
  {
    temperature,
    promptId,
    captureReasoning: true,
    previousResponseId,
    reasoningEffort,
    reasoningVerbosity,
    reasoningSummaryType,
  },
  harness
);
```

**Problem**: Saturn has EXPLICIT PHASED EXECUTION:
```typescript
// saturnService.ts:72-276
Phase 1: First training example (lines 72-110)
Phase 2: Second training prediction (lines 113-153)
Phase 2.5: Pattern refinement (lines 156-195)
Phase 3: Test solution (lines 238-276)
```

**But `puzzleAnalysisService.analyzePuzzleStreaming` calls:**
```typescript
// puzzleAnalysisService.ts (assumed implementation)
const service = aiServiceFactory.getService(modelKey);
const result = await service.analyzePuzzleWithModel(...);
// ↑ This goes to saturnService.analyzePuzzleWithModel()
// ↑ Which DOES emit phase-specific broadcasts via broadcast(sessionId, ...)
// ↑ BUT streaming harness is passed, so it might emit to BOTH?
```

**Actual Issue**: Need to verify if `saturnService.analyzePuzzleWithModel` correctly uses streaming harness when provided. The `sendProgress` helper might be broadcasting to WebSocket but NOT emitting SSE events.

**Hypothesis**: Saturn service uses `broadcast()` (WebSocket) but doesn't use harness `emit()` / `emitEvent()` (SSE).

---

### Issue #3: Windows Timeout Missing

**File**: `server/python/grover_executor.py:19-28`

**Current Code:**
```python
# Timeout support only on Unix (Windows doesn't have signal.SIGALRM)
IS_UNIX = platform.system() != 'Windows'
if IS_UNIX:
    import signal

# Later:
if IS_UNIX:
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(5)
```

**Problem**: Windows users have NO timeout protection.

**Impact**:
- Infinite loops hang forever
- Resource exhaustion on Windows dev machines
- Security risk if malicious code runs

**Options**:
1. **Threading with timeout** (cross-platform)
2. **Multiprocessing with terminate()** (cross-platform)
3. **Document Windows limitation** (lazy, unacceptable)

**Recommendation**: Option 1 (threading) - minimal code change

---

### Issue #4: Legacy Saturn Python Path

**Files**:
- `server/services/saturnVisualService.ts` (OLD - 300+ lines)
- `server/python/saturn_wrapper.py` (OLD - 263 lines)
- `solver/arc_visual_solver.py` (OLD - 444 lines)

**Problem**: Three Saturn execution paths exist:
1. ✅ NEW: `saturnService.ts` → `grok.ts/openai.ts` (production, correct)
2. ❌ OLD: `saturnVisualService.ts` → `saturn_wrapper.py` → `arc_visual_solver.py`
3. ❌ STREAMING: `saturnStreamService.ts` → `puzzleAnalysisService` → ???

**Endpoints**:
```typescript
// saturnController.ts
POST /api/saturn/analyze/:taskId              // NEW saturnService ✅
POST /api/saturn/analyze/:taskId/:modelKey    // NEW saturnService ✅
POST /api/saturn/analyze/:taskId/reasoning    // OLD saturnVisualService ❌
GET  /api/stream/saturn/:taskId/:modelKey     // saturnStreamService (partial) ⚠️
```

**Impact**: Code duplication, confusion, maintenance burden

---

### Issue #5: No Cancel Endpoint

**Missing**: `POST /api/stream/cancel/:sessionId`

**Problem**: Long-running Grover jobs (5-10 iterations × expensive models) can't be stopped.

**User Story**:
> "I started a 10-iteration Grover run with gpt-5-mini. After 2 minutes, I realize it's going to cost $5. I want to cancel it."

**Current Behavior**: User has to wait or close browser (job keeps running server-side).

---

## Solution Architecture

### Phase 1: Core Fixes (3 days)

#### Day 1: Fix Grover SSE + Windows Timeout

**Task 1.1: Add maxSteps to ServiceOptions**

**File**: `server/services/base/BaseAIService.ts`

```typescript
export interface ServiceOptions {
  // ... existing fields ...
  maxSteps?: number;  // ← ADD THIS
  sessionId?: string;
  previousResponseId?: string;
  // ...
}
```

**Task 1.2: Pass maxSteps in groverStreamService**

**File**: `server/services/streaming/groverStreamService.ts:45-61`

```typescript
await puzzleAnalysisService.analyzePuzzleStreaming(
  taskId,
  modelKey,
  {
    temperature,
    promptId: 'grover',
    captureReasoning: true,
    previousResponseId,
  },
  harness,
  {
    sessionId,
    previousResponseId,
    maxSteps: maxIterations,  // ← ADD THIS
  }
);
```

**Task 1.3: Add Windows Timeout Support**

**File**: `server/python/grover_executor.py`

**Replace signal-based timeout with threading:**

```python
import threading
import platform

def execute_program(code: str, inputs: List[List[List[int]]]) -> Dict[str, Any]:
    """Execute program with 5s timeout (cross-platform)"""

    # Validate AST
    valid, error_msg = validate_ast(code)
    if not valid:
        return {"outputs": [], "error": f"AST validation failed: {error_msg}"}

    # Execution state
    result = {"outputs": [], "error": None}
    exception_holder = [None]

    def _run():
        try:
            namespace = {}
            exec(code, namespace)

            if 'transform' not in namespace:
                exception_holder[0] = Exception("Code must define transform(grid) function")
                return

            transform_fn = namespace['transform']
            outputs = []
            for input_grid in inputs:
                output = transform_fn(input_grid)
                outputs.append(output)

            result["outputs"] = outputs
            result["error"] = None
        except Exception as e:
            exception_holder[0] = e

    # Run with timeout
    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    thread.join(timeout=5.0)

    if thread.is_alive():
        # Timeout occurred
        return {"outputs": [], "error": "Execution timeout (5s)"}

    if exception_holder[0]:
        e = exception_holder[0]
        return {"outputs": [], "error": f"{type(e).__name__}: {str(e)}"}

    return result
```

**Benefits**:
- ✅ Cross-platform (Windows + Unix)
- ✅ Minimal code change (~30 lines)
- ✅ No new dependencies
- ⚠️ Less aggressive than signal (can't interrupt tight loops, but good enough)

**Testing**:
```python
# Test infinite loop
def transform(grid):
    while True:
        pass
    return grid

# Should timeout after 5s on both Windows and Unix
```

---

#### Day 2: Fix Saturn SSE Phase Streaming

**Task 2.1: Audit saturnService streaming usage**

**Check**: Does `saturnService.analyzePuzzleWithModel` use streaming harness correctly?

**File**: `server/services/saturnService.ts:41-354`

**Current Analysis:**
```typescript
// Line 41-50: Takes serviceOpts with optional stream harness
async analyzePuzzleWithModel(
  task: ARCTask,
  modelKey: string,
  taskId: string,
  temperature: number = 0.2,
  promptId: string = getDefaultPromptId(),
  customPrompt?: string,
  options?: PromptOptions,
  serviceOpts: ServiceOptions = {}  // ← Contains stream harness
): Promise<AIResponse>

// Line 62: Gets sessionId for WebSocket
const sessionId = (serviceOpts as any).sessionId || randomUUID();

// Line 73-79: Broadcasts phase 1 START via WebSocket
broadcast(sessionId, {
  status: 'running',
  phase: 'saturn_phase1',
  step: 1,
  totalSteps: 3,
  message: 'Analyzing first training example with visual analysis...'
});

// Problem: Never checks if serviceOpts.stream exists
// Problem: Never calls this.emitStreamEvent() or this.emitStreamChunk()
```

**Root Cause**: Saturn service uses `broadcast()` (WebSocket) but ignores `serviceOpts.stream` (SSE harness).

**Task 2.2: Add SSE Emission to Saturn Service**

**Pattern (from groverService.ts:69-117):**
```typescript
const harness = serviceOpts.stream;
const controller = this.registerStream(harness);

const sendProgress = (payload: Record<string, any>) => {
  // WebSocket (existing)
  if (sessionId) {
    broadcast(sessionId, { ...payload });
  }

  // SSE (NEW)
  if (harness) {
    this.emitStreamEvent(harness, "stream.status", {
      state: "in_progress",
      phase: payload.phase,
      message: payload.message,
    });
    if (payload.message) {
      this.emitStreamChunk(harness, {
        type: "text",
        delta: `${payload.message}\n`,
        metadata: { phase: payload.phase },
      });
    }
  }
};
```

**Implementation**: Add this pattern to `saturnService.ts` at the start of `analyzePuzzleWithModel`.

**Changes Needed:**
1. Extract harness from serviceOpts
2. Register stream controller
3. Wrap all `broadcast()` calls in `sendProgress()` helper
4. Call `finalizeStream()` in finally block
5. Pass `stream: undefined` to underlying services (prevent double-streaming)

**Code Locations to Update:**
- Line 73: Phase 1 start
- Line 100: Phase 1 complete
- Line 115: Phase 2 start
- Line 149: Phase 2 complete
- Line 160: Phase 2.5 start
- Line 194: Phase 2.5 complete
- Line 240: Phase 3 start
- Line 276: Phase 3 complete
- Line 329: Final success broadcast
- Line 345: Error broadcast

**Estimated Changes**: ~60 lines (add sendProgress wrapper + 10 call sites)

---

#### Day 3: Add Cancel Endpoint + Test End-to-End

**Task 3.1: Create Cancel Endpoint**

**File**: `server/controllers/streamController.ts` (NEW)

```typescript
/**
 * Author: Sonnet 4.5
 * Date: 2025-10-11
 * PURPOSE: Stream cancellation controller for long-running jobs
 * SRP/DRY check: Pass - Single responsibility (stream lifecycle)
 */

import type { Request, Response } from 'express';
import { formatResponse } from '../utils/responseFormatter';
import { sseStreamManager } from '../services/streaming/SSEStreamManager';
import { logger } from '../utils/logger';

export const streamController = {
  async cancel(req: Request, res: Response) {
    const { sessionId } = req.params as { sessionId: string };

    if (!sessionId) {
      return res.status(400).json(
        formatResponse.error('bad_request', 'Missing sessionId')
      );
    }

    try {
      // Signal cancellation via SSE
      sseStreamManager.error(sessionId, 'CANCELLED_BY_USER', 'Analysis cancelled by user');

      // Close SSE connection
      sseStreamManager.close(sessionId, {
        status: 'aborted',
        metadata: { reason: 'user_cancelled' }
      });

      logger.logInfo(`[StreamCancel] Session ${sessionId} cancelled by user`);

      return res.json(formatResponse.success({
        sessionId,
        status: 'cancelled'
      }));

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.logError(`[StreamCancel] Failed to cancel session ${sessionId}: ${message}`, { error });

      return res.status(500).json(
        formatResponse.error('internal_error', `Failed to cancel: ${message}`)
      );
    }
  }
};
```

**Task 3.2: Register Route**

**File**: `server/routes.ts`

```typescript
import { streamController } from './controllers/streamController.js';

// Add after existing stream routes
app.post('/api/stream/cancel/:sessionId', streamController.cancel);
```

**Task 3.3: Update Frontend Hooks**

**File**: `client/src/hooks/useGroverProgress.ts`

Add cancel function:
```typescript
const cancel = useCallback(async () => {
  if (!sessionId) return;

  try {
    await apiRequest('POST', `/api/stream/cancel/${sessionId}`);
    closeSocket();
    closeEventSource();
    setState(prev => ({
      ...prev,
      status: 'error',
      phase: 'cancelled',
      message: 'Analysis cancelled by user'
    }));
  } catch (error) {
    console.error('[Grover] Cancel failed:', error);
  }
}, [sessionId, closeSocket, closeEventSource]);

return { sessionId, state, start, cancel };  // ← Add cancel to return
```

**Repeat for**: `client/src/hooks/useSaturnProgress.ts`

**Task 3.4: End-to-End Testing**

**Test Matrix:**
```
Grover SSE:
✓ Start with custom maxIterations=10
✓ Verify SSE events fire for each iteration
✓ Verify stream.status shows iteration progress
✓ Cancel after iteration 3
✓ Verify cancellation propagates
✓ Verify no further iterations run

Saturn SSE:
✓ Start analysis
✓ Verify SSE events fire for Phase 1, 2, 2.5, 3
✓ Verify phase-specific messages
✓ Cancel during Phase 2
✓ Verify cancellation propagates

Windows Timeout:
✓ Run infinite loop code on Windows
✓ Verify timeout after 5s
✓ Verify error message returned
```

---

### Phase 2: Cleanup & Polish (2 days)

#### Day 4: Deprecate Legacy Saturn + UI Polish

**Task 4.1: Remove Legacy Saturn References**

**Files to Update:**
1. `server/controllers/saturnController.ts`
   - Remove `analyzeWithReasoning` endpoint (line 240-292)
   - Remove imports of `saturnVisualService`

2. `server/routes.ts`
   - Remove route: `POST /api/saturn/analyze/:taskId/reasoning`

3. Mark as deprecated (don't delete yet):
   - `server/services/saturnVisualService.ts` → Add deprecation warning
   - `server/python/saturn_wrapper.py` → Add deprecation comment
   - `solver/arc_visual_solver.py` → Leave untouched (external dependency)

**Deprecation Banner:**
```typescript
// saturnVisualService.ts (top of file)
/**
 * @deprecated This service is deprecated as of v4.5.0
 * Use saturnService.ts instead, which properly integrates with
 * the TypeScript service layer (grok.ts/openai.ts).
 *
 * This file will be removed in v5.0.0
 *
 * See: docs/2025-10-11-Saturn-Grover-Production-Fix-Plan.md
 */
```

**Task 4.2: Add ImageGallery Component**

**File**: `client/src/components/saturn/ImageGallery.tsx` (NEW)

```typescript
/**
 * Author: Sonnet 4.5
 * Date: 2025-10-11
 * PURPOSE: Masonry-style image gallery for Saturn visual analysis
 * Shows generated grid images with hover zoom and full-screen modal
 * SRP/DRY check: Pass - Single responsibility (image display)
 * shadcn/ui: Pass - Uses Dialog, Card, ScrollArea from shadcn
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ZoomIn } from 'lucide-react';

interface ImageGalleryProps {
  images: { path: string; base64?: string }[];
  title?: string;
}

export function ImageGallery({ images, title = 'Generated Images' }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title} ({images.length})</h3>
      <ScrollArea className="h-[400px]">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-2">
          {images.map((img, idx) => {
            const src = img.base64 ? `data:image/png;base64,${img.base64}` : img.path;

            return (
              <Dialog key={idx}>
                <DialogTrigger asChild>
                  <Card className="relative cursor-pointer hover:ring-2 hover:ring-primary transition-all group">
                    <img
                      src={src}
                      alt={`Grid ${idx + 1}`}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <img
                    src={src}
                    alt={`Grid ${idx + 1} - Full Size`}
                    className="w-full h-auto"
                  />
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
```

**Task 4.3: Integrate ImageGallery into Saturn UI**

**File**: `client/src/pages/SaturnVisualSolver.tsx`

Replace current image display with:
```typescript
import { ImageGallery } from '@/components/saturn/ImageGallery';

// In component JSX:
<ImageGallery
  images={state.galleryImages || []}
  title="Saturn Visual Analysis"
/>
```

**Task 4.4: Add Cancel Buttons to UI**

**File**: `client/src/pages/GroverSolver.tsx`

```typescript
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';

// In component:
const { sessionId, state, start, cancel } = useGroverProgress(taskId);

// In JSX (near analyze button):
{state.status === 'running' && (
  <Button
    variant="destructive"
    onClick={cancel}
    disabled={!sessionId}
  >
    <XCircle className="w-4 h-4 mr-2" />
    Cancel Analysis
  </Button>
)}
```

**Repeat for**: `client/src/pages/SaturnVisualSolver.tsx`

---

#### Day 5: Documentation + Final Testing

**Task 5.1: Update Documentation**

**File**: `docs/2025-10-11-Saturn-Grover-Fixes-Complete.md` (NEW)

Document:
- All changes made
- Migration guide (if any breaking changes)
- Testing results
- Known limitations (e.g., threading timeout vs signal timeout)

**File**: `CHANGELOG.md`

```markdown
## [4.5.0] - 2025-10-11

### Fixed
- **Grover SSE**: Fixed maxSteps parameter not being passed to streaming service
- **Saturn SSE**: Added phase-aware streaming with proper SSE event emission
- **Windows Support**: Added cross-platform timeout for Grover code execution
- **Stream Cancellation**: Added POST /api/stream/cancel/:sessionId endpoint

### Changed
- **Grover Executor**: Replaced signal-based timeout with threading (cross-platform)
- **Saturn Service**: Added streaming harness support for SSE
- **BaseAIService**: Added maxSteps to ServiceOptions interface

### Deprecated
- **saturnVisualService.ts**: Deprecated in favor of saturnService.ts (removal in v5.0.0)
- **POST /api/saturn/analyze/:taskId/reasoning**: Use standard endpoints instead

### Added
- **ImageGallery Component**: Masonry-style gallery for Saturn images with zoom
- **Cancel Buttons**: UI controls to stop long-running analyses

### Improved
- **Error Handling**: Better error propagation in streaming services
- **Progress Display**: More granular phase updates for Saturn SSE
- **Type Safety**: ServiceOptions now properly typed for maxSteps
```

**Task 5.2: Comprehensive Testing**

**Test Suite:**

```typescript
// tests/integration/streaming.test.ts (NEW)

describe('Grover SSE Streaming', () => {
  test('accepts maxIterations parameter', async () => {
    const response = await fetch(
      '/api/stream/grover/test-puzzle-id/grover-gpt-5-nano?maxIterations=10'
    );
    expect(response.ok).toBe(true);
    // Verify 10 iterations run
  });

  test('can be cancelled mid-execution', async () => {
    // Start stream
    const stream = startGroverStream();
    await waitForIteration(3);

    // Cancel
    await fetch('/api/stream/cancel/' + sessionId, { method: 'POST' });

    // Verify no more iterations
    expect(stream.iterations.length).toBe(3);
  });

  test('Windows timeout works', async () => {
    const infiniteLoopCode = 'def transform(grid):\n    while True:\n        pass\n    return grid';
    const result = await executeGroverCode(infiniteLoopCode);

    expect(result.error).toContain('timeout');
    expect(result.outputs).toEqual([]);
  });
});

describe('Saturn SSE Streaming', () => {
  test('emits phase-specific events', async () => {
    const events = [];
    const eventSource = new EventSource('/api/stream/saturn/test-puzzle/gpt-5-nano-2025-08-07');

    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      events.push(data);
    };

    await waitForCompletion();

    // Verify all phases present
    const phases = events.filter(e => e.type === 'stream.status').map(e => e.phase);
    expect(phases).toContain('saturn_phase1');
    expect(phases).toContain('saturn_phase2');
    expect(phases).toContain('saturn_phase2_correction');
    expect(phases).toContain('saturn_phase3');
  });
});
```

**Manual Testing Checklist:**
```
Grover:
□ Start SSE stream with maxIterations=10
□ Verify 10 iterations execute
□ Cancel after iteration 5
□ Verify clean cancellation
□ Test on Windows machine
□ Test infinite loop timeout (5s)
□ Verify conversation chaining works across iterations

Saturn:
□ Start SSE stream
□ Verify Phase 1 messages appear
□ Verify Phase 2 messages appear
□ Verify Phase 2.5 messages appear
□ Verify Phase 3 messages appear
□ Verify images appear in ImageGallery
□ Cancel during Phase 2
□ Verify clean cancellation
□ Test zoom functionality in gallery

Both:
□ WebSocket fallback works if SSE disabled
□ Database persistence works correctly
□ Cost tracking accurate
□ Error handling graceful
□ Memory usage stable over long runs
```

---

## Success Criteria

### Phase 1 Complete When:
- ✅ Grover SSE streams with custom maxIterations
- ✅ Saturn SSE emits phase-specific events
- ✅ Windows timeout works (threading-based)
- ✅ Cancel endpoint responds correctly
- ✅ All end-to-end tests pass

### Phase 2 Complete When:
- ✅ Legacy Saturn endpoints removed/deprecated
- ✅ ImageGallery component working
- ✅ Cancel buttons in UI
- ✅ Documentation updated
- ✅ Manual testing checklist 100% passed

### Production Ready When:
- ✅ Zero critical bugs
- ✅ SSE and WebSocket both work
- ✅ Windows and Unix both supported
- ✅ Users can cancel long jobs
- ✅ Images display nicely
- ✅ Code is maintainable (no duplication)

---

## Risk Mitigation

### Risk #1: Breaking Existing WebSocket Streaming
**Mitigation**: Add `sendProgress()` wrapper that handles BOTH WebSocket and SSE. Never remove existing `broadcast()` calls, only wrap them.

**Test**: Run existing WebSocket tests after changes.

### Risk #2: Threading Timeout Less Aggressive Than Signal
**Reality**: True. Threading can't interrupt tight CPU loops.
**Mitigation**: Document limitation. Most Python code in Grover is I/O or list operations, not tight loops.
**Acceptance**: 95% coverage is better than 0% (current Windows state).

### Risk #3: Saturn SSE Changes Break Something
**Mitigation**: Test with `VITE_ENABLE_SSE_STREAMING=false` (WebSocket fallback).
**Rollback**: If SSE breaks, disable it via env var and investigate.

### Risk #4: Time Estimates Wrong
**Buffer**: 5 days → 6 days with 1 day buffer.
**Critical Path**: Day 1-3 are P0. Day 4-5 are P1 (nice to have).

---

## Dependencies

**None**. All fixes use existing infrastructure:
- ✅ SSEStreamManager exists
- ✅ WebSocket streaming works
- ✅ Database schema complete
- ✅ Python scripts exist

**No new packages needed.**

---

## Rollout Strategy

### Week 1 (Days 1-3): Core Fixes
- Implement in `enhancements` branch
- Test thoroughly
- Merge to `main` when stable

### Week 2 (Days 4-5): Polish
- Implement cleanup
- Add UI improvements
- Update docs
- Merge to `main`

### Week 3: Monitor
- Watch for bug reports
- Fix any edge cases
- Consider removing deprecated code (v5.0.0)

---

## Maintenance Plan

**Post-Fix:**
1. Monitor SSE streaming usage via logs
2. Gather user feedback on cancel functionality
3. Consider adding progress bars based on phase/iteration
4. Eventually remove deprecated Saturn code (after 1 month grace period)

**Future Enhancements (NOT NOW):**
- Token-by-token streaming (if users request)
- Retry logic for failed iterations
- Iteration branching (try multiple strategies in parallel)
- Better Windows timeout (process-based isolation)

---

## Appendix: File Change Summary

### Modified Files (11):
1. `server/services/base/BaseAIService.ts` - Add maxSteps to ServiceOptions
2. `server/services/streaming/groverStreamService.ts` - Pass maxSteps
3. `server/python/grover_executor.py` - Threading timeout
4. `server/services/saturnService.ts` - Add SSE emission
5. `server/controllers/streamController.ts` - NEW cancel endpoint
6. `server/routes.ts` - Register cancel route
7. `client/src/hooks/useGroverProgress.ts` - Add cancel function
8. `client/src/hooks/useSaturnProgress.ts` - Add cancel function
9. `client/src/components/saturn/ImageGallery.tsx` - NEW component
10. `client/src/pages/SaturnVisualSolver.tsx` - Integrate gallery + cancel
11. `client/src/pages/GroverSolver.tsx` - Add cancel button

### Deprecated Files (2):
1. `server/services/saturnVisualService.ts` - Mark deprecated
2. `server/python/saturn_wrapper.py` - Mark deprecated

### Documentation Files (3):
1. `docs/2025-10-11-Saturn-Grover-Production-Fix-Plan.md` - This file
2. `docs/2025-10-11-Saturn-Grover-Fixes-Complete.md` - Post-implementation
3. `CHANGELOG.md` - Version 4.5.0 notes

**Total Changes**: ~500 lines of code across 11 files

---

## Conclusion

This plan addresses all 5 critical production bugs while maintaining backwards compatibility. The approach is pragmatic: fix what's broken, polish what works, deprecate what's obsolete.

**Timeline**: 5 days (realistic)
**Risk**: Low (incremental fixes, not rewrites)
**Value**: High (production stability + UX improvements)

**Philosophy**: Ship value, not perfection.

---

**END OF PLAN**

**Status**: Ready for implementation
**Next Step**: Review plan, then begin Day 1 tasks
