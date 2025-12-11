# Worm Arena Multi-Opponent Batch Refactoring Plan

**Author:** Claude Code using Haiku 4.5
**Date:** 2025-12-10
**Purpose:** Pivot batch match architecture from repeated same-opponent (A vs B × 9) to sequential multi-opponent (A vs [B1, B2, B3...B9]) with rate-limiting support and comprehensive ranking data collection.

## Executive Summary

**Current State:** Batch support runs Model A vs Model B repeatedly (same matchup N times)
**Target State:** Run Model A against an array of different opponent models sequentially (A vs B1, A vs B2, ... A vs B9)

**Why This Matters:**
- Better ranking signal: diverse opponents provide richer TrueSkill convergence
- Rate-limit compatible: sequential execution respects API rate limits
- Data science optimal: more comprehensive model quality assessment
- Real-world alignment: how actual rating systems work (e.g., tournament brackets)

## Architecture Changes Summary

| Aspect | Current | Target |
|--------|---------|--------|
| Input Model | `count: number` | `opponents: string[]` |
| Batch Loop | Repeat same `modelB` | Iterate through different `modelB` values |
| Opponent Selection | Number input (1-10) | Multi-select/checkbox UI |
| Pre-Population | N/A | Top 9 ranked models by default |
| Event Count | Count = total matches | Count = array length |
| Rate Limiting | Implicit (sequential) | Explicit (loop through array) |

## Detailed Implementation Plan

### Phase 1: Backend Refactoring

#### 1.1 Update Type Definitions (`shared/types.ts`)

**Current State:**
```typescript
// Not directly exposed, but used internally:
type PendingSession = {
  payload: SnakeBenchRunMatchRequest;
  count: number; // Number of repeats
  createdAt: number;
  expiresAt: number;
};
```

**Target State:**
```typescript
type PendingSession = {
  payload: SnakeBenchRunMatchRequest;
  opponents: string[]; // Array of opponent model IDs
  createdAt: number;
  expiresAt: number;
};
```

**Why:** Makes it explicit that we're iterating through different opponents, not repeating the same one.

#### 1.2 Update Prepare Endpoint (`server/controllers/wormArenaStreamController.ts` - `prepare()`)

**Current Validation:**
```typescript
const count = countRaw !== undefined ? Math.floor(Number(countRaw)) : 1;
if (!Number.isFinite(count) || count < 1 || count > MAX_BATCH_COUNT) {
  return { error: `count must be between 1 and ${MAX_BATCH_COUNT}` };
}
```

**Target Validation:**
```typescript
// Accept either:
// 1. Legacy: { count: 9 } (for backward compatibility) - converts to default opponents
// 2. New: { opponents: ["model1", "model2", ...] }

let opponents: string[] = [];

if (body.opponents && Array.isArray(body.opponents)) {
  // New format: explicit opponent list
  opponents = body.opponents
    .filter((op) => typeof op === 'string' && op.trim().length > 0)
    .map((op) => op.trim());
} else if (body.count) {
  // Legacy format: number → convert to default opponents
  const count = Math.floor(Number(body.count));
  if (!Number.isFinite(count) || count < 1 || count > MAX_BATCH_COUNT) {
    return { error: `count must be between 1 and ${MAX_BATCH_COUNT}` };
  }
  // In legacy mode, just use count=1 (single match) since we don't have opponent list
  opponents = [];
}

if (opponents.length === 0 && !body.count) {
  return { error: 'Either "opponents" array or "count" number must be provided' };
}

// Validate opponent models exist in OpenRouter
const validOpponents = opponents.filter(op =>
  selectableModels.includes(op) // Need to fetch/validate these
);

if (opponents.length > 0 && validOpponents.length === 0) {
  return { error: 'No valid OpenRouter models in opponents list' };
}
```

**Store in Session:**
```typescript
const sessionId = generateSessionId();
const now = Date.now();
pendingSessions.set(sessionId, {
  payload: req,
  opponents: validOpponents.length > 0 ? validOpponents : undefined,
  createdAt: now,
  expiresAt: now + PENDING_TTL_MS,
});
```

#### 1.3 Update Stream Endpoint (`server/controllers/wormArenaStreamController.ts` - `stream()`)

**Current Logic:**
```typescript
if (isBatch) {
  // Execute batch of matches
  for (let i = 0; i < pending.count; i += 1) {
    // Run same matchup: pending.payload.modelA vs pending.payload.modelB
    const result = await snakeBenchService.runMatch(pending.payload);
    // ...
  }
}
```

**Target Logic:**
```typescript
const isBatch = pending.opponents && pending.opponents.length > 1;

if (isBatch) {
  // Execute sequential matches against different opponents
  const opponents = pending.opponents!; // guaranteed to exist
  const results: WormArenaBatchMatchComplete[] = [];
  let failedCount = 0;

  // Emit batch init with opponent list
  sseStreamManager.sendEvent(sessionId, 'batch.init', {
    totalMatches: opponents.length,
    modelA: pending.payload.modelA,
    opponents: opponents, // NEW: include full opponent list
  });

  for (let i = 0; i < opponents.length; i += 1) {
    const matchNum = i + 1; // 1-based
    const currentOpponent = opponents[i];

    // Create match payload with current opponent
    const matchPayload: SnakeBenchRunMatchRequest = {
      ...pending.payload,
      modelB: currentOpponent, // THIS CHANGES each iteration
    };

    // Emit match start
    const matchStartEvent: WormArenaBatchMatchStart = {
      index: matchNum,
      total: opponents.length,
      modelA: pending.payload.modelA,
      modelB: currentOpponent,
    };
    sseStreamManager.sendEvent(sessionId, 'batch.match.start', matchStartEvent);
    sendStatus({
      state: 'in_progress',
      message: `Running match ${matchNum} of ${opponents.length}: ${pending.payload.modelA} vs ${currentOpponent}...`,
    });

    try {
      // Run match with current opponent
      const result = await snakeBenchService.runMatch(matchPayload);

      // Emit match complete
      const matchCompleteEvent: WormArenaBatchMatchComplete = {
        index: matchNum,
        total: opponents.length,
        gameId: result.gameId,
        modelA: result.modelA,
        modelB: result.modelB, // Will be currentOpponent
        scores: result.scores ?? {},
        results: result.results ?? {},
      };
      sseStreamManager.sendEvent(sessionId, 'batch.match.complete', matchCompleteEvent);
      results.push(matchCompleteEvent);
    } catch (err: any) {
      failedCount += 1;
      const message = err?.message || `Match ${matchNum} failed`;
      logger.error(`[WormArenaStream] Multi-opponent match ${matchNum} failed: ${message}`, 'worm-arena-stream');
      sseStreamManager.sendEvent(sessionId, 'batch.error', {
        index: matchNum,
        total: opponents.length,
        error: message,
      });
      // Continue with next opponent despite error
    }
  }

  // Emit batch complete
  const batchCompleteEvent: WormArenaBatchComplete = {
    totalMatches: opponents.length,
    completedMatches: results.length,
    failedMatches: failedCount,
  };
  sendStatus({
    state: 'completed',
    message: `Batch complete: ${results.length}/${opponents.length} matches finished`,
  });
  sseStreamManager.sendEvent(sessionId, 'batch.complete', batchCompleteEvent);
  sseStreamManager.close(sessionId, batchCompleteEvent as unknown as Record<string, unknown>);
}
```

**Key Changes:**
- Loop through `opponents` array instead of `count` number
- Mutate `modelB` in each iteration (keep `modelA` constant)
- Status messages now show specific opponent model names
- `batch.init` includes full opponent list for UI preview
- Sequential execution guarantees rate-limit compliance

### Phase 2: Frontend Refactoring

#### 2.1 Update WormArenaLive Page State

**Current State:**
```typescript
const [matchCount, setMatchCount] = useState<number>(9);
```

**Target State:**
```typescript
const [selectedOpponents, setSelectedOpponents] = useState<string[]>([]);

// Pre-populate on load with top 9 models (minus modelA)
useEffect(() => {
  if (selectableModels.length > 0 && selectedOpponents.length === 0) {
    const topModels = selectableModels
      .filter(m => m !== modelA) // Exclude Model A to prevent self-matches
      .slice(0, 9); // Top 9 by order in config
    setSelectedOpponents(topModels);
  }
}, [selectableModels, modelA, selectedOpponents.length]);
```

**Why Pre-Populate:**
- 9 opponents is optimal for TrueSkill convergence
- User doesn't have to manually select if defaults are good
- Can still customize by unchecking/checking models

#### 2.2 Update handleRunMatch Function

**Current:**
```typescript
const payload: SnakeBenchRunMatchRequest = {
  modelA: mapToSnakeBenchModelId(modelA),
  modelB: mapToSnakeBenchModelId(modelB), // Single modelB
  // ...
};
const prep = await startLiveMatch(payload, matchCount);
```

**Target:**
```typescript
const payload: SnakeBenchRunMatchRequest = {
  modelA: mapToSnakeBenchModelId(modelA),
  // NOTE: No modelB here - will be set per opponent in backend
};

// Map opponent IDs to SnakeBench format
const mappedOpponents = selectedOpponents.map(op => mapToSnakeBenchModelId(op));

const prep = await startLiveMatch(payload, mappedOpponents);
```

**Why No modelB:** Backend will receive opponent list and set modelB per iteration.

#### 2.3 Update WormArenaSetup Props and UI

**Current Props:**
```typescript
export interface WormArenaSetupProps {
  // ...
  matchCount: number;
  onMatchCountChange: (count: number) => void;
  // ...
}
```

**Target Props:**
```typescript
export interface WormArenaSetupProps {
  // ...
  selectedOpponents: string[];
  selectableModels: string[];
  onOpponentsChange: (opponents: string[]) => void;
  // ...
}
```

**Current UI:**
```tsx
<div className="space-y-2">
  <label>Number of matches</label>
  <input
    type="number"
    min="1"
    max="10"
    value={matchCount}
    onChange={(e) => onMatchCountChange(...)}
  />
  <p className="text-xs text-[#7a6b5f]">9 recommended for placement</p>
</div>
```

**Target UI (Opponent Multi-Select):**
```tsx
<div className="space-y-2">
  <div className="flex justify-between items-center">
    <label className="text-base font-semibold text-[#3d2817]">
      Opponents 🐛 ({selectedOpponents.length})
    </label>
    <button
      onClick={() => onOpponentsChange(selectableModels.filter(m => m !== modelA).slice(0, 9))}
      className="text-xs text-blue-600 underline"
    >
      Reset to Top 9
    </button>
  </div>

  {/* Scrollable checklist of all available models */}
  <div className="border rounded p-3 max-h-48 overflow-y-auto bg-white/50">
    {selectableModels
      .filter(m => m !== modelA) // Don't allow self-matches
      .map((model) => (
        <label key={model} className="flex items-center gap-2 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedOpponents.includes(model)}
            onChange={(e) => {
              if (e.target.checked) {
                onOpponentsChange([...selectedOpponents, model]);
              } else {
                onOpponentsChange(selectedOpponents.filter(op => op !== model));
              }
            }}
            disabled={isRunning}
          />
          <span className="text-sm font-mono">{model}</span>
        </label>
      ))}
  </div>

  <p className="text-xs text-[#7a6b5f]">
    Select up to 10 opponents. 9 recommended for TrueSkill placement. Sequential execution respects rate limits.
  </p>
</div>
```

**Key Features:**
- Checkbox list (shows all available models)
- Shows count: "Opponents 🐛 (5)"
- "Reset to Top 9" button for convenience
- Filters out Model A (no self-matches)
- Max 10 to match backend limit
- Disabled during execution

#### 2.4 Update Streaming Hook

**Current:**
```typescript
const startMatch = useCallback(async (payload: SnakeBenchRunMatchRequest, count: number = 1) => {
  const res = await fetch('/api/wormarena/prepare', {
    method: 'POST',
    body: JSON.stringify({ ...payload, count }),
  });
  // ...
}, []);
```

**Target:**
```typescript
const startMatch = useCallback(async (payload: SnakeBenchRunMatchRequest, opponents: string[] = []) => {
  const res = await fetch('/api/wormarena/prepare', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      opponents: opponents.length > 0 ? opponents : undefined,
      // Fallback: if empty, backend will treat as single match (for backward compat)
    }),
  });
  // ...
}, []);
```

**Update Type Return:**
```typescript
// No change to return type - still same { sessionId, liveUrl }
// Backend handles both old (count) and new (opponents) formats
```

### Phase 3: Type Updates (`shared/types.ts`)

**Add Optional Field to batch.init Event:**
```typescript
// Update if batch.init event payload needs opponent list for UI preview
// Current: { totalMatches, modelA, modelB }
// Target: { totalMatches, modelA, opponents?: string[] }
```

**Rationale:** Frontend can display opponent list in header/status (nice-to-have, not critical).

### Phase 4: Data Flow Diagram

```
User selects:
  - Model A: amazon/nova-2-lite-v1:free (with BYO API key)
  - Opponents: [
      "x-ai/grok-4.1-fast",
      "openai/gpt-5.1-codex-mini",
      "anthropic/claude-3.5-sonnet",
      ... (up to 9 total)
    ]

[Run Matches] button clicked
  ↓
WormArenaLive.handleRunMatch()
  ↓
POST /api/wormarena/prepare {
  modelA: "openai/gpt-5.1-codex-mini",
  apiKey: "...",
  provider: "openrouter",
  opponents: ["grok-4.1-fast", "gpt-5.1-codex-mini", ...],
  width: 10,
  height: 10,
  maxRounds: 150,
  numApples: 5
}
  ↓
Backend: validate payload + store in pendingSessions
  ↓
Response: { sessionId, liveUrl }
  ↓
window.location.href = liveUrl (navigates to /worm-arena/live/{sessionId})
  ↓
WormArenaLive mounts with sessionId in URL
  ↓
EventSource connects: /api/wormarena/stream/{sessionId}
  ↓
Backend stream() method:
  1. Emit batch.init { totalMatches: 9, modelA, opponents: [...] }
  2. FOR each opponent in opponents array:
     a. Emit batch.match.start { index, total, modelA, modelB: opponent }
     b. await snakeBenchService.runMatch({ modelA, modelB: opponent, ... })
     c. Emit batch.match.complete { gameId, scores, results }
  3. Emit batch.complete { totalMatches, completedMatches, failedMatches }
  4. Close SSE connection
  ↓
Frontend receives events and updates UI in real-time:
  - Status message: "Running match 3 of 9: nova-2 vs gpt-5.1-codex-mini..."
  - Results table grows with each completed match
  - Final status: "Batch complete: 9/9 matches finished"
```

## Testing Strategy

### 1. Unit Tests

**Backend:**
- Validate `validatePayload()` with:
  - `{ opponents: ["model1", "model2"] }` ✓
  - `{ opponents: [] }` ✗
  - `{ count: 5 }` (legacy) ✓
  - Invalid model names ✗
- Verify loop count = array length (not hardcoded)

**Frontend:**
- Hook accepts `opponents: string[]` parameter
- State initializes `selectedOpponents` to top 9 models
- Handler correctly excludes modelA from selection

### 2. Integration Tests

**Scenario 1: Valid Multi-Opponent Batch**
- Input: modelA=nova, opponents=[grok, gpt, claude]
- Expected: 3 matches in sequence, each with different modelB
- Verify: All events emitted in correct order

**Scenario 2: Rate Limit Behavior**
- Run with 2 free-tier models (nova-2, kwaipilot-kat-coder-pro)
- Verify: Sequential execution (not parallel)
- Monitor: API call timing (should be ~2-3 min apart)

**Scenario 3: Match Failure in Batch**
- Force one match to fail (invalid model or API error)
- Expected: batch continues, failedCount incremented
- Verify: Other 8 matches still run, results still visible

**Scenario 4: Empty Opponents Fallback**
- Provide empty `opponents: []` to prepare endpoint
- Expected: Single match mode (backward compatibility)

### 3. Manual User Testing

**Setup:**
```
modelA: amazon/nova-2-lite-v1:free (with user's API key)
opponents: [x-ai/grok-4.1-fast, openai/gpt-5.1-codex-mini, ... (9 total)]
```

**Test Cases:**
1. Click "Run Matches" → navigates to live page with new sessionId
2. Matches display as "Match 1 of 9: nova vs grok-4.1-fast"
3. Results table shows rows with correct model pairs
4. Replay links work for each completed match
5. Stats page reflects new TrueSkill ratings

## Backward Compatibility

**Old Client → New Backend:**
- Legacy `count` parameter still accepted
- Treats as single match if `count` provided without `opponents`

**New Client → Potentially Old Backend:**
- Send both `count` and `opponents` (fallback)
- Or version the endpoint as `/api/wormarena/prepare/v2`
- For now: assume backend upgrade first, then frontend

## Files to Modify

### Backend (Express)
1. **`server/controllers/wormArenaStreamController.ts`**
   - Update `validatePayload()` to accept `opponents: string[]`
   - Update `PendingSession` type definition
   - Update `stream()` method batch loop
   - Rewrite batch.init event to include opponents
   - Update status messages with opponent names

2. **`shared/types.ts`**
   - Update `WormArenaBatchInit` event if needed (add optional `opponents`)
   - No changes to match events (they already have modelA/modelB)

### Frontend (React)
3. **`client/src/pages/WormArenaLive.tsx`**
   - Replace `matchCount` state with `selectedOpponents`
   - Add auto-population logic for top 9 models
   - Update `handleRunMatch()` to pass `opponents` array
   - Update `WormArenaSetup` prop passing

4. **`client/src/components/WormArenaSetup.tsx`**
   - Replace `matchCount` props with `selectedOpponents` + `selectableModels`
   - Replace number input with checkbox list
   - Add "Reset to Top 9" button
   - Update disabled state to match execution status

5. **`client/src/hooks/useWormArenaStreaming.ts`**
   - Update `startMatch()` signature: `count` → `opponents`
   - No changes to event listeners (they work with both scenarios)
   - No changes to batch state management

## Migration Path

**Step 1: Backend-only (deploy first)**
- Update controller to accept `opponents` array
- Support both old (`count`) and new (`opponents`) in validatePayload
- No frontend changes → backward compatible

**Step 2: Frontend update (after backend)**
- Update WormArenaLive to collect opponents
- Change WormArenaSetup UI to checkboxes
- Update streaming hook
- Now uses new architecture while old API still works

**Step 3: Cleanup (optional)**
- Remove legacy `count` support from validatePayload
- Remove fallback logic

## Validation Checklist

- [ ] Backend accepts `opponents: string[]` in prepare endpoint
- [ ] Backend validates opponent models against available OpenRouter models
- [ ] Backend loop iterates correct number of times (array.length)
- [ ] Each iteration changes modelB to next opponent
- [ ] Frontend state tracks `selectedOpponents` correctly
- [ ] Frontend auto-populates with top 9 models (excluding modelA)
- [ ] Checkbox list filters out modelA
- [ ] Max 10 opponents enforced
- [ ] Status messages show specific opponent names
- [ ] Results table shows correct model pairs for each match
- [ ] Sequential execution prevents rate-limit conflicts
- [ ] Tests pass for both valid and invalid inputs
- [ ] User can run batch with their API key
- [ ] Stats page reflects new TrueSkill ratings after batch

## Known Risks & Mitigations

**Risk 1: Long Execution Time**
- 9 matches × 2-3 min each = ~20-30 minutes
- **Mitigation:** User can leave browser open; SSEStreamManager heartbeat keeps connection alive

**Risk 2: API Rate Limits**
- High-load APIs may reject sequential calls
- **Mitigation:** Sequential execution (not parallel) respects rate limits by design

**Risk 3: User Closes Browser Mid-Batch**
- Matches continue running on backend; client misses final events
- **Mitigation:** User can navigate back to same live URL; EventSource reconnects to existing session

**Risk 4: Opponent Model Not Available**
- User selects model that's removed from OpenRouter
- **Mitigation:** Validate in prepare endpoint; emit batch.error for unavailable models

## Open Questions for User

1. **Opponent Selection UI:** Checkbox list (as proposed) or multi-select dropdown? Any preference?
2. **Pre-Population Logic:** Should we show top 9 models from config, or fetch ranked list from stats page?
3. **Max Opponent Limit:** Is 10 the right limit, or should we allow more?
4. **Result Ordering:** Display matches in chronological order (as completed) or reverse (newest first)?

---

## Summary

This refactoring pivots the batch architecture from repeated same-opponent matches to sequential multi-opponent matches, enabling:
- Better ranking data collection (diverse opponents)
- Rate-limit compliance (sequential execution)
- Flexible opponent selection (checkbox UI)
- Data-science optimal approach for model evaluation

The changes are localized to the prepare/stream flow and UI components, with minimal impact on existing event handling or SSE streaming infrastructure.
