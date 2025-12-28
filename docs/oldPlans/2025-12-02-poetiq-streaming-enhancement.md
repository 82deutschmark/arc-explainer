# Poetiq Solver Streaming & Timestamp Enhancement

**Author:** Claude Code (Haiku 4.5)
**Date:** 2025-12-02
**Purpose:** Implementation guide for adding comprehensive timestamp tracking, event preservation, and debug logging to Poetiq solver streaming pipeline. Aligns Poetiq with Beetree's timestamp strategy while maintaining WebSocket architecture.

---

## Overview

Poetiq's multi-expert code generation solver uses WebSocket broadcasting to send real-time progress updates to the UI. Unlike Beetree's SSE-based approach, Poetiq coordinates parallel expert runs and needs timestamp information to reconstruct the execution timeline accurately.

This document explains the timestamp preservation strategy, event trace handling, and debug logging architecture for Poetiq.

---

## The Problem: Lost Chronological Context

### Current State

When multiple experts run in parallel, events are interleaved in the stream:

```json
{"type": "progress", "expert": "gpt-5.1_1", "iteration": 1, "phase": "prompting"}
{"type": "progress", "expert": "claude-opus_1", "iteration": 1, "phase": "prompting"}
{"type": "progress", "expert": "gpt-5.1_1", "iteration": 1, "phase": "coding"}
{"type": "progress", "expert": "claude-opus_1", "iteration": 1, "phase": "coding"}
```

**Issue:** Without timestamps, the UI cannot determine:
- Which expert's event occurred first?
- What was the actual delay between events?
- Was the interleaving real or an artifact of buffering?
- What is the precise cost/token progression?

### Why This Matters

1. **Timeline Reconstruction** - Users want to see when each expert started/finished iterations
2. **Cost Attribution** - Knowing exact timing helps correlate costs to specific work
3. **Expert Comparison** - Understanding which expert completed iterations faster
4. **Debugging** - Tracing execution flow is impossible without timestamps

---

## Complete Event Flow Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. PYTHON WRAPPER (server/python/poetiq_wrapper.py)              │
│    ├─ Creates start_time at run beginning                        │
│    ├─ Instruments solve_coding() function                        │
│    ├─ For each expert iteration:                                 │
│    │  ├─ Emits NDJSON with calculated timestamp_ms               │
│    │  └─ timestamp_ms = (current_time - start_time) * 1000       │
│    └─ emit({"type": "progress", "timestamp": 1234, ...})         │
└────────────────────┬─────────────────────────────────────────────┘
                     │ NDJSON via stdout
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. POETIQ SERVICE (server/services/poetiq/poetiqService.ts)      │
│    ├─ Spawns wrapper subprocess                                  │
│    ├─ Parses stdout line-by-line as JSON                         │
│    ├─ Routes to handleBridgeEvent()                              │
│    ├─ Preserves timestamp: event.timestamp ?? Date.now()         │
│    ├─ Logs: [poetiqService] Forwarding progress event...         │
│    ├─ Collects events in eventTrace[] (capped 500)               │
│    └─ Calls broadcast(sessionId, {..., timestamp: ...})          │
│       payload: {...original fields..., timestamp: 1234}          │
└────────────────────┬─────────────────────────────────────────────┘
                     │ broadcast(sessionId, event)
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. WEBSOCKET SERVICE (server/services/wsService.ts)              │
│    ├─ Looks up client connection by sessionId                    │
│    ├─ Sends: ws.send(JSON.stringify(event))                      │
│    └─ Logs: [wsService] Broadcasting event to ${sessionId}       │
└────────────────────┬─────────────────────────────────────────────┘
                     │ WebSocket message
                     ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. CLIENT (client/src/hooks/usePoetiqProgress.ts)                │
│    ├─ WebSocket.onmessage receives event                         │
│    ├─ Updates state with event data (INCLUDING TIMESTAMP!)       │
│    └─ Renders UI with chronological event ordering               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Timestamp Preservation Strategy

### 1. Python Wrapper: Add Relative Timestamps

**File:** `server/python/poetiq_wrapper.py` (line ~20)

Add at the top of `main()`:

```python
def main():
    start_time = time.time()

    # ... rest of main() ...

    # When calling run_poetiq_solver:
    return run_poetiq_solver(
        puzzle=puzzle,
        mode=mode,
        config=config,
        start_time=start_time  # PASS START TIME
    )
```

**File:** `server/python/poetiq_wrapper.py` (line ~60 in function signature)

```python
def run_poetiq_solver(
    puzzle: dict,
    mode: str,
    config: dict,
    start_time: float  # ADD THIS PARAMETER
) -> Optional[str]:
    """Run Poetiq solver with timestamp tracking."""
```

**File:** `server/python/poetiq_wrapper.py` (line ~300 in instrumented_solve_coding)

When emitting progress events:

```python
def instrumented_solve_coding(expert_id, ...):
    # ... expert execution ...

    # Calculate timestamp relative to run start
    timestamp_ms = int((time.time() - start_time) * 1000)

    # Emit progress event with timestamp
    emit({
        "type": "progress",
        "phase": phase,
        "iteration": it + 1,
        "expert": expert_id,
        "message": message,
        "code": code,
        "reasoning": reasoning,
        "reasoningSummary": summary,
        "trainResults": results,
        "promptData": prompt_data,
        "tokenUsage": token_usage,
        "cost": cost,
        "expertCumulativeTokens": expert_tokens,
        "expertCumulativeCost": expert_cost,
        "globalTokens": global_tokens,
        "globalCost": global_cost,
        "timestamp": timestamp_ms  # ADD THIS
    })
```

**Key Points:**
- `start_time` captured once at wrapper startup
- Passed through function call chain to instrumented code
- Every progress event calculates `timestamp_ms = (current_time - start_time) * 1000`
- Result: All events include chronological milliseconds since run start

---

### 2. Service Layer: Preserve Timestamps

**File:** `server/services/poetiq/poetiqService.ts` (line ~555)

In `handleBridgeEvent()` method, apply timestamp preservation pattern:

```typescript
private handleBridgeEvent(
  event: PoetiqBridgeEvent,
  puzzleId: string,
  options: SolveOptions,
  onEvent?: (evt: any) => void
): any {
  // ... routing logic ...

  if (event.type === 'progress') {
    const payload = {
      type: 'progress',
      status: 'running',
      phase: event.phase,
      iteration: event.iteration,
      message: event.message,
      expert: event.expert,
      code: event.code,
      reasoning: event.reasoning,
      reasoningSummary: event.reasoningSummary,
      trainResults: event.trainResults,
      promptData: event.promptData,
      tokenUsage: (event as any).tokenUsage,
      cost: (event as any).cost,
      expertCumulativeTokens: (event as any).expertCumulativeTokens,
      expertCumulativeCost: (event as any).expertCumulativeCost,
      globalTokens: (event as any).globalTokens,
      globalCost: (event as any).globalCost,
      timestamp: (event as any).timestamp ?? Date.now(),  // PRESERVE ORIGINAL OR FALLBACK
    };

    if (options.sessionId) {
      logger.debug(`[poetiqService] Forwarding progress event: expert=${event.expert}, iteration=${event.iteration}, ts=${(event as any).timestamp}`);
      broadcast(options.sessionId, payload);
    }
  }
  // ... other event types ...
}
```

**Pattern:** `timestamp: (event as any).timestamp ?? Date.now()`
- If event has timestamp, use it (preserves original timing)
- If event has no timestamp, use current time (defensive fallback)
- Applied to ALL event types (progress, log, error, final)

---

### 3. Event Trace: Collect and Return

**File:** `server/services/poetiq/poetiqService.ts` (line ~469)

Currently, `eventTrace` is collected locally but discarded. Modify to return it:

```typescript
// Before the final promise resolution:
if (eventTrace.length > 0) {
  finalResult.eventTrace = eventTrace;  // ATTACH TO RESULT
  logger.debug(`[poetiqService] Collected ${eventTrace.length} events in trace`);
}
```

**File:** `server/controllers/poetiqController.ts` (line ~solve endpoint)

When returning the final result:

```typescript
res.json({
  success: true,
  result: finalResult,
  eventTrace: finalResult.eventTrace || [],  // RETURN IN RESPONSE
  totalCost: finalResult.totalCost,
  totalTokens: finalResult.totalTokens,
  timestamp: Date.now(),
});
```

**Why This Matters:**
- Event trace becomes permanent part of the result
- UI can reconstruct full execution timeline later
- Historical analysis of expert performance becomes possible
- Debugging support improves significantly

---

## Debug Logging Architecture

Four layers of debug logging enable precise event tracing.

### Layer 1: Wrapper (Python)

**File:** `server/python/poetiq_wrapper.py` (line ~300)

```python
# When calculating timestamp:
import sys
timestamp_ms = int((time.time() - start_time) * 1000)

# Log to stderr for visibility
print(f"[poetiq_wrapper] Emitting progress: expert={expert_id}, iteration={it}, ts={timestamp_ms}", file=sys.stderr)

# Then emit the event with timestamp
emit({
    "type": "progress",
    "timestamp": timestamp_ms,
    ...
})
```

**What to look for:**
- `[poetiq_wrapper] Emitting progress: expert=gpt-5.1_1, iteration=1, ts=42`
- Timestamp values increasing monotonically
- All experts having similar timing patterns (or not, if load-balanced)

---

### Layer 2: Service (TypeScript)

**File:** `server/services/poetiq/poetiqService.ts` (line ~555)

```typescript
if (event.type === 'progress') {
  logger.debug(
    `[poetiqService] Forwarding progress: expert=${event.expert}, iteration=${event.iteration}, ts=${(event as any).timestamp}`
  );
  broadcast(options.sessionId, {
    // ... payload with preserved timestamp
    timestamp: (event as any).timestamp ?? Date.now(),
  });
}

if (event.type === 'log') {
  logger.debug(
    `[poetiqService] Forwarding log: level=${event.level}, ts=${(event as any).timestamp}`
  );
  broadcast(options.sessionId, {
    // ... payload with preserved timestamp
    timestamp: (event as any).timestamp ?? Date.now(),
  });
}
```

**What to look for:**
- `[poetiqService] Forwarding progress: expert=gpt-5.1_1, iteration=1, ts=42`
- Timestamps being preserved (not replaced)
- Event type routing working correctly

---

### Layer 3: WebSocket (TypeScript)

**File:** `server/services/wsService.ts` (broadcast function)

```typescript
export function broadcast(sessionId: string, data: any) {
  const client = connections.get(sessionId);
  if (!client) {
    logger.debug(`[wsService] Broadcast to ${sessionId}: connection not found`);
    return;
  }

  logger.debug(`[wsService] Broadcasting to ${sessionId}: type=${data.type}, ts=${data.timestamp}`);

  try {
    client.send(JSON.stringify(data));
  } catch (error) {
    logger.debug(`[wsService] Broadcast failed to ${sessionId}: ${error}`);
  }
}
```

**What to look for:**
- `[wsService] Broadcasting to session-123: type=progress, ts=42`
- All events reaching WebSocket layer
- No dropped or filtered events

---

### Layer 4: Client (JavaScript)

**File:** `client/src/hooks/usePoetiqProgress.ts`

```typescript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // Log for debugging
  if (data.timestamp) {
    console.log(`[usePoetiqProgress] Received event: type=${data.type}, ts=${data.timestamp}`);
  }

  // Update UI state with timestamp
  setState(prev => ({
    ...prev,
    events: [...prev.events, { ...data, receivedAt: Date.now() }],
  }));
};
```

**What to look for (in browser console):**
- `[usePoetiqProgress] Received event: type=progress, ts=42`
- Timestamps increasing over time
- Correct event sequencing by timestamp

---

## Event Types and Their Structure

### progress

```json
{
  "type": "progress",
  "status": "running",
  "phase": "prompting",
  "iteration": 1,
  "expert": "gpt-5.1_1",
  "message": "Generating prompt...",
  "code": "def solve(...):\n    pass",
  "reasoning": "The problem requires...",
  "reasoningSummary": "Generate solution...",
  "trainResults": {...},
  "promptData": {...},
  "tokenUsage": {
    "input": 1200,
    "output": 450,
    "total": 1650
  },
  "cost": 0.0042,
  "expertCumulativeTokens": {...},
  "expertCumulativeCost": 0.0158,
  "globalTokens": {...},
  "globalCost": 0.0312,
  "timestamp": 1234
}
```

### log

```json
{
  "type": "log",
  "status": "running",
  "phase": "log",
  "level": "info",
  "message": "[Model] API call initiated...",
  "timestamp": 1250
}
```

### error

```json
{
  "type": "error",
  "status": "failed",
  "phase": "error",
  "level": "error",
  "message": "Model API timeout after 30s",
  "timestamp": 5000
}
```

### final

```json
{
  "type": "final",
  "status": "completed",
  "phase": "final",
  "success": true,
  "result": "def solve(...):\n    return [...grids...]",
  "totalCost": 0.1234,
  "totalTokens": {
    "input": 12000,
    "output": 4500,
    "total": 16500
  },
  "eventTrace": [
    {/* event 1 */},
    {/* event 2 */},
    {...}
  ],
  "timestamp": 25000
}
```

---

## Troubleshooting Guide

### Symptom: No Timestamps in Events

**Check 1: Wrapper Emitting Timestamps**

Look for wrapper logs:
```
[poetiq_wrapper] Emitting progress: expert=gpt-5.1_1, iteration=1, ts=42
```

If missing:
- Ensure `start_time` is captured at wrapper startup
- Ensure `timestamp_ms` calculation is in place
- Ensure `"timestamp": timestamp_ms` is in emit() call

**Check 2: Service Preserving Timestamps**

Look for service logs:
```
[poetiqService] Forwarding progress: expert=gpt-5.1_1, iteration=1, ts=42
```

If `ts=undefined`:
- Wrapper is not emitting timestamps
- Go back to Check 1

If `ts=<current unix timestamp>`:
- Service is replacing timestamp with `Date.now()`
- Ensure all event handlers use: `timestamp: (event as any).timestamp ?? Date.now()`

---

### Symptom: Wrong Timestamp (Current Time Instead of Original)

**Location:** `server/services/poetiq/poetiqService.ts` (handleBridgeEvent method)

**Check:**
```typescript
// WRONG:
timestamp: Date.now()

// RIGHT:
timestamp: (event as any).timestamp ?? Date.now()
```

Make sure ALL event handlers (progress, log, error, final) follow the RIGHT pattern.

---

### Symptom: Expert Timeline Cannot Be Reconstructed

**Issue:** Events from different experts are interleaved with no temporal relationship.

**Solution:**
1. Verify all events have timestamps (see "No Timestamps" troubleshooting)
2. Verify event trace is being collected (should see 500+ events if run is long)
3. Verify event trace is returned in final result
4. Client should sort by timestamp: `events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))`

---

### Symptom: Event Trace Is Lost After Run Completes

**Location:** `server/services/poetiq/poetiqService.ts` (around line 650)

**Fix:**
```typescript
// Before resolving promise:
if (eventTrace.length > 0) {
  finalResult.eventTrace = eventTrace;  // ATTACH TRACE
}

// Then resolve:
resolve({
  success: true,
  result: finalResult,
  eventTrace: finalResult.eventTrace || [],  // RETURN IN RESPONSE
  totalCost: finalResult.totalCost,
  totalTokens: finalResult.totalTokens,
});
```

---

## Implementation Checklist

When applying these changes, verify:

- [ ] Wrapper captures `start_time` at startup
- [ ] Wrapper passes `start_time` through call chain
- [ ] All progress events calculated `timestamp_ms` and include `"timestamp": timestamp_ms`
- [ ] All log events include `"timestamp": timestamp_ms`
- [ ] All error events include `"timestamp": timestamp_ms`
- [ ] Service layer uses `timestamp: (event as any).timestamp ?? Date.now()` pattern (5+ locations)
- [ ] Event trace collected and capped at 500 events
- [ ] Event trace returned in final result
- [ ] Event trace returned in HTTP response
- [ ] Debug logging added at all 4 layers (wrapper, service, wsService, client)
- [ ] Test with 2-expert run and verify timestamp progression
- [ ] Verify events can be sorted by timestamp for chronological playback

---

## Comparison: Poetiq vs Beetree vs Saturn

| Feature | Poetiq | Beetree | Saturn |
|---------|--------|---------|--------|
| **Wrapper Timestamps** | ✗ (being fixed) | ✓ Implemented | ✓ Implemented |
| **Service Preservation** | ✗ (being fixed) | ✓ `event.timestamp ?? Date.now()` | ✓ Similar pattern |
| **Event Trace** | ✗ Collected locally | ✓ Collected + capped | ✓ Collected + capped |
| **Trace Returned** | ✗ (being fixed) | ✓ In result | ✓ In result |
| **Multi-Expert Support** | ✓ Yes (WebSocket) | ✗ Single ensemble | ✓ Multiple models |
| **Streaming Protocol** | WebSocket | SSE | WebSocket |
| **Debug Logging** | ✗ (being added) | ✓ 4-layer pyramid | ✓ Present |
| **Cost Tracking** | ✓ Rich (expert level) | ✓ Rich (model + stage) | ✓ Rich (model level) |
| **Documentation** | ✓ This guide | ✓ Comprehensive | ✓ Present |

---

## Architecture Principles Applied

1. **Timestamp Immutability** - Once set in wrapper, preserve through all layers
2. **Defensive Fallback** - If timestamp missing, create new one (don't fail)
3. **Event Trace Persistence** - Collect throughout execution, return in final result
4. **Debug Visibility** - Four-layer logging enables tracing at each hop
5. **Expert Timeline** - Timestamps enable reconstruction of parallel execution
6. **Cost Attribution** - Precise timing correlates costs to specific expert iterations

---

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/python/poetiq_wrapper.py` | Add `start_time` capture, timestamp calculation, emit with timestamp | Enable relative timestamps in wrapper |
| `server/services/poetiq/poetiqService.ts` | Preserve timestamps in handleBridgeEvent, return event trace | Enable timestamp preservation and trace return |
| `server/controllers/poetiqController.ts` | Return `eventTrace` in response | Make trace available to client |
| `server/services/wsService.ts` | Add debug logging | Enable event visibility |
| `client/src/hooks/usePoetiqProgress.ts` | Log received events with timestamps | Enable client-side debugging |

---

## Related Documentation

- See `/docs/2025-12-02-beetree-streaming-implementation.md` for Beetree's complete streaming architecture (SSE-based variant of this approach)
- Compare timestamp preservation strategies between solver types
- Review debug logging pyramid pattern used across all solvers

---

## Summary

Poetiq's WebSocket-based streaming architecture is fundamentally sound. Adding comprehensive timestamp tracking and event trace persistence brings it in line with Beetree's practices while maintaining its multi-expert parallel execution strengths. The four-layer debug logging enables precise event tracing and timeline reconstruction for expert performance analysis.
