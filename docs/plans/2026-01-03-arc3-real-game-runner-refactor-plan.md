# Arc3RealGameRunner Refactoring Plan

**Author:** Cascade (Claude Opus 4.5)  
**Date:** 2026-01-03  
**Status:** Complete  
**Priority:** High (fixes audit bugs + eliminates ~400 lines of duplication)

---

## Problem Statement

`server/services/arc3/Arc3RealGameRunner.ts` is **1,295 lines** with severe SRP and DRY violations:

1. **10+ responsibilities** in a single class
2. **~400 lines of duplicated code** between `run()` and `runWithStreaming()`
3. **Critical bug:** Scorecard never closed when game ends (per audit)
4. **Poor naming:** "RealGameRunner" is ambiguous

---

## Current File Structure Analysis

### Line Count Breakdown

| Section | Lines | Notes |
|---------|-------|-------|
| Header/imports | 1-47 | 47 lines |
| Interface `Arc3StreamHarness` | 48-57 | 10 lines |
| Class declaration + helpers | 59-167 | 109 lines |
| `run()` method | 169-605 | **436 lines** |
| `runWithStreaming()` method | 607-1293 | **686 lines** |
| **Total** | | **1,295 lines** |

### Duplicated Code (DRY Violations)

| Element | In `run()` | In `runWithStreaming()` | Lines Duplicated |
|---------|------------|------------------------|------------------|
| `inspectTool` | 246-306 | 756-831 | ~60 |
| `analyzeGridTool` | 308-347 | 833-886 | ~40 |
| `resetGameTool` | 349-393 | (missing in streaming) | 0 |
| `simpleAction` factory | 396-439 | 888-963 | ~45 |
| `action6Tool` | 441-484 | 965-1040 | ~45 |
| `selectSystemPrompt()` | 486-498 | 1042-1055 | ~13 |
| `mapState()` | 563-571 | 1229-1237 | ~9 |
| Agent config | 521-538 | 1077-1094 | ~18 |
| Summary construction | 579-587 | 1245-1253 | ~9 |
| **Total duplicated** | | | **~240 lines** |

### Responsibilities (SRP Violations)

1. Scorecard lifecycle management
2. Game session management (start/continue)
3. Tool definition (7 tools)
4. Tool execution handlers
5. OpenAI Agent creation
6. Agent run orchestration
7. Streaming event emission
8. Frame persistence to PostgreSQL
9. Animation frame unpacking
10. Timeline processing
11. System prompt selection
12. State mapping

---

## Critical Bug: Scorecard Never Closed

### Evidence

Lines 552-553 and 1219-1220:
```typescript
// NOTE: Do NOT end the session here. Sessions remain open for continuations.
// The session ends naturally when the game reaches WIN or GAME_OVER state.
```

**But there is NO code that actually closes the scorecard.**

### Official Docs Requirement

From `docs/reference/arc3/ARC3_Games.md`:
```python
# Step 4: Close scorecard
session.post(f"{ROOT_URL}/api/scorecard/close", {"card_id": card_id})
```

### Impact

- Scorecards left open indefinitely
- Session continuation may fail (stale scorecard)
- ARC API may rate-limit or reject due to orphaned scorecards

---

## Refactoring Tasks

### Task 1: Fix Scorecard Close Bug (CRITICAL)
**Priority:** P0 - Must fix immediately  
**Estimated Lines Changed:** ~20  
**Risk:** Low

**Steps:**
1. Add `closeScorecard()` method to `Arc3ApiClient.ts` if not present
2. In `run()` after line 604, add scorecard close when game ends
3. In `runWithStreaming()` after line 1275, add scorecard close when game ends
4. Check state is `WIN` or `GAME_OVER` before closing

**Code to add (both methods):**
```typescript
// Close scorecard when game reaches terminal state
if (currentFrame && (currentFrame.state === 'WIN' || currentFrame.state === 'GAME_OVER')) {
  try {
    await this.apiClient.closeScorecard(scorecardId);
    logger.info(`[ARC3] Closed scorecard ${scorecardId} - game ended with ${currentFrame.state}`, 'arc3');
  } catch (error) {
    logger.warn(`[ARC3] Failed to close scorecard ${scorecardId}: ${error}`, 'arc3');
  }
}
```

**Verification:**
- Build passes
- Scorecard is closed on WIN
- Scorecard is closed on GAME_OVER
- Scorecard stays open on maxTurns (for continuation)

---

### Task 2: Add closeScorecard to Arc3ApiClient
**Priority:** P0 - Required for Task 1  
**File:** `server/services/arc3/Arc3ApiClient.ts`

**Steps:**
1. Check if `closeScorecard()` method exists
2. If not, add it following the pattern of other methods
3. Method should POST to `/api/scorecard/close` with `card_id`

**Expected signature:**
```typescript
async closeScorecard(cardId: string): Promise<void>
```

---

### Task 3: Extract Tool Factory (Eliminates Duplication)
**Priority:** P1 - Important for maintainability  
**New File:** `server/services/arc3/tools/Arc3ToolFactory.ts`  
**Estimated Lines Saved:** ~200

**Steps:**
1. Create `server/services/arc3/tools/` directory
2. Create `Arc3ToolFactory.ts` with factory functions
3. Extract tool definitions from both methods
4. Tools need access to: `currentFrame`, `prevFrame`, `gameGuid`, `frames`, `dbSessionId`, etc.
5. Pass these via a context object or closure

**Tool Factory Interface:**
```typescript
interface Arc3ToolContext {
  getCurrentFrame: () => FrameData | null;
  getPrevFrame: () => FrameData | null;
  setCurrentFrame: (frame: FrameData) => void;
  setPrevFrame: (frame: FrameData | null) => void;
  getGameGuid: () => string | null;
  setGameGuid: (guid: string) => void;
  getFrames: () => FrameData[];
  pushFrames: (...frames: FrameData[]) => void;
  getDbSessionId: () => number | null;
  getCurrentFrameNumber: () => number;
  setCurrentFrameNumber: (num: number) => void;
  getScorecardId: () => string;
  getGameId: () => string;
  apiClient: Arc3ApiClient;
  streamHarness?: Arc3StreamHarness;
}

function createArc3Tools(context: Arc3ToolContext): Tool[];
```

**Verification:**
- Build passes
- Tools work identically in both modes
- No behavior change

---

### Task 4: Extract Shared Helpers
**Priority:** P1  
**New File:** `server/services/arc3/helpers/runHelpers.ts`

**Functions to extract:**
1. `selectSystemPrompt(config)` - lines 486-498 / 1042-1055
2. `mapState(state)` - lines 563-571 / 1229-1237  
3. `buildAgentConfig(config, instructions, metadata)` - agent creation logic
4. `buildRunSummary(currentFrame, gameId, frames)` - summary construction

**Verification:**
- Build passes
- Both methods use shared helpers
- No behavior change

---

### Task 5: Unify Run Methods (Future)
**Priority:** P2 - Nice to have  
**Risk:** Medium (larger change)

**Approach:**
Create a single `runAgent()` method with a `streaming: boolean` option.
Use strategy pattern or callbacks for streaming-specific behavior.

**NOT doing this now** - Tasks 1-4 are sufficient for immediate needs.

---

## Execution Checklist

- [x] **Task 1.1:** Check if `closeScorecard()` exists in `Arc3ApiClient.ts` (DONE - did not exist)
- [x] **Task 1.2:** Add `closeScorecard()` if missing (DONE - added)
- [x] **Task 1.3:** Add scorecard close to `run()` method (DONE)
- [x] **Task 1.4:** Add scorecard close to `runWithStreaming()` method (DONE)
- [x] **Task 1.5:** Test build passes (DONE)
- [x] **Task 2.1:** Create `tools/` directory (DONE)
- [x] **Task 2.2:** Create `Arc3ToolFactory.ts` with context interface (DONE)
- [x] **Task 2.3:** Extract `inspectTool` (DONE - in factory)
- [x] **Task 2.4:** Extract `analyzeGridTool` (DONE - in factory)
- [x] **Task 2.5:** Extract `simpleAction` factory (DONE - in factory)
- [x] **Task 2.6:** Extract `action6Tool` (DONE - in factory)
- [x] **Task 2.7:** Update `run()` to use factory (DONE - Cascade/Claude Opus 4.5)
- [x] **Task 2.8:** Update `runWithStreaming()` to use factory (DONE - Cascade/Claude Opus 4.5)
- [x] **Task 2.9:** Test build passes (DONE - factory compiles)
- [x] **Task 3.1:** Extract `selectSystemPrompt()` to helpers (DONE - runHelpers.ts)
- [x] **Task 3.2:** Extract `mapState()` to helpers (DONE - runHelpers.ts)
- [x] **Task 3.3:** Test build passes (DONE - build successful)
- [x] **Task 4:** Update CHANGELOG with refactoring entry (DONE - v6.25.0)

---

## Files to Create

| File | Purpose |
|------|---------|
| `server/services/arc3/tools/Arc3ToolFactory.ts` | Tool creation factory |
| `server/services/arc3/tools/index.ts` | Barrel export |
| `server/services/arc3/helpers/runHelpers.ts` | Shared helper functions |

---

## Files to Modify

| File | Changes |
|------|---------|
| `server/services/arc3/Arc3ApiClient.ts` | Add `closeScorecard()` |
| `server/services/arc3/Arc3RealGameRunner.ts` | Add scorecard close, use factory |
| `CHANGELOG.md` | Document refactoring |

---

## Expected Outcome

### Before
- `Arc3RealGameRunner.ts`: 1,295 lines
- Tools duplicated between methods
- Scorecard never closed (bug)

### After
- `Arc3RealGameRunner.ts`: ~600 lines
- `Arc3ToolFactory.ts`: ~300 lines
- `runHelpers.ts`: ~50 lines
- Scorecard properly closed on WIN/GAME_OVER
- Single source of truth for tools

---

## Rollback Plan

If refactoring causes issues:
1. Revert tool factory changes (keep scorecard fix)
2. Scorecard fix is low-risk and should not need rollback

---

## Notes for Next Developer

1. **Do Task 1 first** - It's a critical bug fix with low risk
2. **Task 2 is the big win** - Eliminates most duplication
3. **Task 3 is polish** - Can be deferred
4. **Task 5 (unify methods) is risky** - Don't attempt without tests
5. **The streaming method is more complex** - Has event emission throughout
6. **Tools need mutable state** - Use context object pattern, not pure functions

---

## References

- Audit: `docs/audits/2026-01-03-arc3-agents-sdk-audit.md`
- Official docs: `docs/reference/arc3/ARC3_Games.md`
- Types: `server/services/arc3/types.ts`
- API client: `server/services/arc3/Arc3ApiClient.ts`
