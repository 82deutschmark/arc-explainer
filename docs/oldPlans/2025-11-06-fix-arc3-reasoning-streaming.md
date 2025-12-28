# Fix ARC3 Reasoning Streaming - Empty Content Issue

**Author:** Claude Code using Sonnet 4.5
**Date:** 2025-11-06
**PURPOSE:** Fix ARC3 endpoint returning empty reasoning content arrays by adopting Saturn's working Responses API streaming pattern

## Problem Statement

The ARC3 endpoint streams reasoning blocks with empty content:
```json
{
  "providerData": {
    "id": "rs_0d42452ce45e3f3100690d59cc484c81959dce37fb4429d3c2",
    "type": "reasoning"
  },
  "id": "rs_0d42452ce45e3f3100690d59cc484c81959dce37fb4429d3c2",
  "type": "reasoning",
  "content": []  // EMPTY!
}
```

Meanwhile, Saturn Solver correctly streams reasoning with actual content using the same OpenAI Responses API.

## Root Cause Analysis

### ARC3 Implementation (BROKEN)
- **File:** `server/services/arc3/Arc3RealGameRunner.ts:402-448`
- **Method:** Uses OpenAI Agents SDK (`@openai/agents`)
- **Problem:** Attempts to extract reasoning from `reasoning_item.rawItem` which contains metadata but NOT the actual reasoning text deltas
- **Result:** Empty content arrays in streamed reasoning blocks

### Saturn Implementation (WORKING)
- **File:** `server/services/openai.ts:149-281` + `server/services/openai/streaming.ts:271-294`
- **Method:** Uses OpenAI Responses API directly
- **Success:** Processes `response.reasoning_text.delta` events that contain actual reasoning text
- **Result:** Incremental reasoning deltas properly accumulated and streamed

## Key Technical Differences

### 1. Event Processing Pattern

**Saturn (Working):**
```typescript
// Direct access to Responses API events
case "response.reasoning_text.delta": {
  const delta = (event as ResponseReasoningTextDeltaEvent).delta ?? "";
  aggregates.reasoning = `${aggregates.reasoning}${delta}`;
  callbacks.emitChunk({
    type: "reasoning",
    delta,
    content: aggregates.reasoning,
  });
}
```

**ARC3 (Broken):**
```typescript
// Tries to extract from Agents SDK wrapper
if (event.item.type === 'reasoning_item') {
  const reasoningContent = JSON.stringify(event.item.rawItem, null, 2);
  // rawItem has no delta field - just structure!
  streamHarness.emitEvent("agent.reasoning", {
    content: reasoningContent,
  });
}
```

### 2. The Agents SDK Abstraction Layer

The OpenAI Agents SDK wraps Responses API events:
- **`raw_model_stream_event`** - Contains the actual Responses API event in `event.data`
- **`run_item_stream_event`** - Contains processed items (messages, tool calls, reasoning metadata)

The reasoning deltas are in `raw_model_stream_event.data` NOT in `run_item_stream_event.item`!

## Solution Strategy

### Option 1: Extract from raw_model_stream_event (RECOMMENDED)
**Pros:**
- Minimal changes to existing ARC3 architecture
- Keeps Agents SDK for tool orchestration
- Reuses Saturn's proven reasoning extraction logic

**Cons:**
- Deals with two event streams (SDK wrapper + underlying API)

**Implementation:**
1. In `Arc3RealGameRunner.ts`, process `raw_model_stream_event` events
2. Extract underlying Responses API event from `event.data`
3. Apply Saturn's `handleStreamEvent` logic for `response.reasoning_text.delta`
4. Accumulate reasoning deltas in local state
5. Emit incremental updates to stream harness

### Option 2: Switch to Direct Responses API
**Pros:**
- Full control over streaming
- Identical pattern to Saturn
- No SDK abstraction layer issues

**Cons:**
- Requires rewriting ARC3 game runner
- Would need to implement tool orchestration manually
- Higher risk, more extensive changes

### Option 3: Hybrid Approach
**Pros:**
- Use Agents SDK for tool execution
- Use direct Responses API for reasoning extraction
- Best of both worlds

**Cons:**
- More complex architecture
- Two parallel streaming mechanisms

## Recommended Implementation Plan

### Phase 1: Extract Reasoning from raw_model_stream_event ✅ RECOMMENDED

**Files to Modify:**
1. `server/services/arc3/Arc3RealGameRunner.ts`

**Changes:**

#### 1.1 Add Reasoning Accumulator
```typescript
private async runWithStreaming(
  gameState: Arc3GameState,
  streamHarness: Arc3StreamHarness
): Promise<void> {
  // Add reasoning accumulator
  const streamState = {
    accumulatedReasoning: "",
    reasoningSequence: 0,
  };

  // ... existing code
}
```

#### 1.2 Process raw_model_stream_event for Reasoning
```typescript
case 'raw_model_stream_event':
  const underlyingEvent = event.data;

  // Handle reasoning deltas (the actual content!)
  if (underlyingEvent.type === 'response.reasoning_text.delta') {
    const delta = underlyingEvent.delta ?? "";
    streamState.accumulatedReasoning += delta;
    streamState.reasoningSequence++;

    streamHarness.emitEvent("agent.reasoning", {
      delta,
      content: streamState.accumulatedReasoning,
      sequence: streamState.reasoningSequence,
      contentIndex: underlyingEvent.content_index,
      timestamp: Date.now(),
    });
  }

  // Also handle reasoning completion
  if (underlyingEvent.type === 'response.reasoning_text.done') {
    streamHarness.emitEvent("agent.reasoning_complete", {
      finalContent: streamState.accumulatedReasoning,
      timestamp: Date.now(),
    });
  }

  // Keep existing raw event forwarding
  streamHarness.emitEvent("model.stream_event", {
    eventType: event.data.type,
    data: event.data,
    timestamp: Date.now(),
  });
  break;
```

#### 1.3 Remove Broken reasoning_item Processing
```typescript
// DELETE THIS BROKEN CODE:
if (event.item.type === 'reasoning_item') {
  const reasoningContent = JSON.stringify(event.item.rawItem, null, 2);
  streamHarness.emitEvent("agent.reasoning", {
    content: reasoningContent,
    timestamp: Date.now(),
  });
}
```

### Phase 2: Update Frontend Display (if needed)

**Files to Check:**
- `client/src/hooks/useArc3AgentStream.ts`
- `client/src/pages/ARC3AgentPlayground.tsx`

**Actions:**
- Verify frontend correctly handles `delta` and `content` fields
- Ensure incremental reasoning updates display properly
- Test with streaming reasoning display component

### Phase 3: Testing & Validation

**Test Cases:**
1. Start ARC3 game and verify reasoning appears in stream
2. Verify reasoning content is NOT empty
3. Verify reasoning accumulates incrementally (delta + full content)
4. Compare output format to Saturn's reasoning display
5. Ensure no regressions in tool execution or game flow

## File References

### Files to Modify:
- [Arc3RealGameRunner.ts](server/services/arc3/Arc3RealGameRunner.ts) - Lines 402-448 (runWithStreaming method)

### Reference Implementations (DO NOT MODIFY):
- [openai.ts](server/services/openai.ts) - Lines 149-281 (Saturn's working pattern)
- [streaming.ts](server/services/openai/streaming.ts) - Lines 271-294 (handleStreamEvent reasoning logic)

### Frontend (Check/Test):
- [useArc3AgentStream.ts](client/src/hooks/useArc3AgentStream.ts)
- [ARC3AgentPlayground.tsx](client/src/pages/ARC3AgentPlayground.tsx)

## Success Criteria

✅ Reasoning blocks stream with actual content (not empty arrays)
✅ Reasoning deltas accumulate incrementally
✅ Reasoning displays in real-time in ARC3 playground
✅ Tool execution and game flow remain unaffected
✅ Stream format matches Saturn's proven pattern

## SRP/DRY Check

**Potential Reuse:**
- Consider extracting reasoning handling to shared utility
- Saturn's `handleStreamEvent` could be adapted for ARC3 use
- Both systems process Responses API events - shared abstraction opportunity

**Next Iteration:**
- Create `server/services/streaming/reasoningExtractor.ts`
- Share logic between Saturn and ARC3
- Reduce duplication in stream event processing

---

## Implementation Checklist

- [ ] Add reasoning accumulator state to runWithStreaming
- [ ] Process `response.reasoning_text.delta` from raw_model_stream_event
- [ ] Emit reasoning with both delta and accumulated content
- [ ] Handle `response.reasoning_text.done` event
- [ ] Remove broken reasoning_item extraction code
- [ ] Test reasoning appears in ARC3 playground
- [ ] Verify no regressions in game execution
- [ ] Compare output to Saturn's reasoning display
- [ ] Document new streaming event structure
- [ ] (Optional) Extract shared reasoning handling utility

---

**Estimated Effort:** 1-2 hours
**Risk Level:** Low (isolated to stream processing, no game logic changes)
**Dependencies:** None
**Testing:** Manual testing in ARC3 playground with extended thinking model
