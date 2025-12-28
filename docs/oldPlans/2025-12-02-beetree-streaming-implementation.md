# Beetree Ensemble Solver SSE Streaming Implementation

**Author:** Claude Code (Haiku 4.5)
**Date:** 2025-12-02
**Purpose:** Complete reference guide for the Beetree multi-model ensemble solver streaming pipeline, event flow architecture, timestamp preservation strategy, and debugging procedures.

---

## Overview

The Beetree ensemble solver uses **Server-Sent Events (SSE)** to stream real-time progress updates from a Python subprocess to the web UI. This document explains the complete event pipeline, the critical timestamp preservation strategy that was added, and how to diagnose issues if events don't reach the UI.

### Why SSE Instead of WebSockets?

SSE was chosen because:
- **Simpler protocol**: One-directional (server→client), no bidirectional handshaking
- **Proxy-friendly**: Works through corporate proxies better than WebSockets
- **Native browser support**: Built-in `EventSource` API, no library needed
- **Less overhead**: HTTP-based, lighter than WebSocket upgrade

---

## Complete Event Flow Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. PYTHON WRAPPER (server/python/beetree_wrapper.py)            │
│    ├─ Creates ProgressReporter with start_time                 │
│    ├─ Wraps beetreeARC execution with stdout/stderr redirection│
│    ├─ StreamEmitter captures print output → NDJSON log events  │
│    └─ emit() writes JSON events to sys.__stdout__              │
│       JSON: {"type": "progress", "timestamp": 42, ...}         │
└──────────────────────┬──────────────────────────────────────────┘
                       │ NDJSON via stdout
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. PYTHON BRIDGE (server/services/pythonBridge.ts)              │
│    ├─ Spawns wrapper subprocess                                │
│    ├─ Parses stdout line-by-line as JSON                       │
│    ├─ Logs: [pythonBridge] Parsed event: type=progress...      │
│    ├─ For unparseable lines: converts to log events            │
│    └─ Calls onEvent(parsedEvent) with original timestamp       │
│       {"type": "progress", "timestamp": 42, "source": "python"}│
└──────────────────────┬──────────────────────────────────────────┘
                       │ onEvent callback
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. BEETREE SERVICE (server/services/beetreeService.ts)          │
│    ├─ Receives event from pythonBridge                         │
│    ├─ Routes to correct case handler (progress/log/final/error)│
│    ├─ Logs: [beetreeService] Forwarding progress event...      │
│    ├─ CRITICAL: Uses event.timestamp ?? Date.now()             │
│    │   (Preserves original, falls back to current time)        │
│    └─ Calls: serviceOpts.stream.emitEvent(type, payload)       │
│       payload: {...original fields..., timestamp: 42}          │
└──────────────────────┬──────────────────────────────────────────┘
                       │ emitEvent()
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. STREAMING HARNESS (server/services/streaming/beetreeStream...) │
│    ├─ StreamingHarness.emitEvent() receives event + payload    │
│    ├─ Logs: [beetreeStreamService] Emitting event via harness..│
│    ├─ Enriches payload with taskId if needed                   │
│    └─ Calls: sseStreamManager.sendEvent(streamKey, event, payload)
│       streamKey = "beetree-${sessionId}" (CRITICAL!)            │
└──────────────────────┬──────────────────────────────────────────┘
                       │ sendEvent(streamKey, ...)
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. SSE STREAM MANAGER (server/services/streaming/SSEStreamMgr.ts)│
│    ├─ Looks up connection by streamKey                         │
│    ├─ Logs: [SSEStreamManager] Sending event solver_progress... │
│    ├─ Checks if connection exists and is not closed           │
│    ├─ Writes: event: ${event}\ndata: ${JSON.stringify(payload)}│
│    └─ Flushes to HTTP response stream                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP SSE format
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. CLIENT (client/src/hooks/useBeetreeRun.ts)                   │
│    ├─ EventSource connects to /api/stream/analyze/beetree-${id} │
│    ├─ Listens for all event types                              │
│    ├─ Parses JSON payload                                      │
│    └─ Updates UI with event data (INCLUDING TIMESTAMP!)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Critical: The Timestamp Preservation Strategy

### The Problem We Solved

Originally, events were **losing their timestamps** at multiple points:

1. **StreamEmitter (Python wrapper)** wasn't adding timestamps to log events
2. **beetreeService** was replacing ALL timestamps with `Date.now()`, losing the original timing
3. Result: Events that occurred 5 seconds into the run showed up with "current time" timestamp

### The Solution

#### 1. Python Wrapper: StreamEmitter Timestamps

**File:** `server/python/beetree_wrapper.py` (lines 409-440)

```python
class StreamEmitter(io.TextIOBase):
    def __init__(self, sink: io.StringIO, level: str = 'info', start_time: float = None):
        self._start_time = start_time or time.time()  # Get run start time

    def write(self, s: Any) -> int:
        # ... line processing ...

        # CRITICAL: Calculate timestamp relative to run start (milliseconds)
        timestamp_ms = int((time.time() - self._start_time) * 1000)
        emit({
            'type': 'log',
            'level': 'info',
            'message': line_stripped,
            'timestamp': timestamp_ms  # ADD TO EVERY LOG EVENT
        })
```

**Key Points:**
- `StreamEmitter` receives `start_time` from `ProgressReporter` instance
- Calculates elapsed milliseconds: `(current_time - start_time) * 1000`
- Emits timestamp with **every** log event, not just structured events

**Instantiation:** `server/python/beetree_wrapper.py` line 267
```python
with contextlib.redirect_stderr(StreamEmitter(verbose_output, 'info', reporter.start_time)):
```

---

#### 2. beetreeService: Preserve Original Timestamps

**File:** `server/services/beetreeService.ts` (lines 138-189)

All event handlers follow this pattern:

```typescript
case 'progress':
  if (serviceOpts?.stream) {
    serviceOpts.stream.emitEvent('solver_progress', {
      stage: event.stage,
      status: event.status,
      // ... other fields ...
      timestamp: event.timestamp ?? Date.now(),  // PRESERVE ORIGINAL!
    });
  }
  break;
```

**The Pattern:**
- `event.timestamp ?? Date.now()` means:
  - If event has timestamp, use it (preserves original)
  - If event has no timestamp, use current time (fallback)
- Applied to ALL event types: progress, log, final, error

**Why This Matters:**
- Events from wrapper arrive with timestamps calculated at wrap time
- We pass them through unchanged, preserving chronology
- Fallback to `Date.now()` only for events without timestamps (shouldn't happen)

---

## StreamKey Consistency: The Critical Routing Rule

### What is StreamKey?

**StreamKey** is the routing identifier that connects events from the service layer to the correct SSE client connection.

### The Format (MUST be consistent everywhere)

```
streamKey = "beetree-${sessionId}"
```

Where `sessionId` is generated fresh for each run.

### Where StreamKey Appears

| Location | Code | Purpose |
|----------|------|---------|
| **beetreeStreamService** | `const streamKey = "beetree-${sessionId}"` (line 64) | Create and track stream state |
| **beetreeController** | `const streamKey = "beetree-${sessionId}"` (line 457) | Register SSE connection |
| **Route Handler** | `/api/stream/analyze/beetree-:sessionId` | Extract sessionId from URL |
| **Client** | `EventSource(/api/stream/analyze/beetree-${id})` | Connect to SSE endpoint |
| **SSEStreamManager** | `this.connections.get(streamKey)` | Look up response object |

### Why This Matters

If the streamKey format differs **anywhere**, events will:
- Be sent to the wrong connection
- Be dropped (connection not found)
- Never reach the client

**Critical Rule:** All six locations MUST use `"beetree-${sessionId}"` format.

---

## Debug Logging Architecture

Four layers of debug logging were added to trace events through the pipeline. Enable these in your logger to diagnose issues.

### 1. pythonBridge Layer

**File:** `server/services/pythonBridge.ts` (lines 365-388)

```typescript
// When JSON parses successfully:
logger.debug(`[pythonBridge] Parsed event: type=${evt.type}, timestamp=${evt.timestamp}, sessionId=${opts.sessionId}`);

// When output is non-JSON:
logger.debug(`[pythonBridge] Non-JSON stdout, converting to log event: "${trimmed.substring(0, 80)}..."`);
```

**What to look for:**
- Events coming out of wrapper with timestamps
- Non-JSON output being wrapped in log events
- SessionId being tracked through

**Example output:**
```
[pythonBridge] Parsed event: type=start, timestamp=0, sessionId=beetree-123-abc
[pythonBridge] Parsed event: type=progress, timestamp=42, sessionId=beetree-123-abc
[pythonBridge] Parsed event: type=log, timestamp=50, sessionId=beetree-123-abc
```

---

### 2. beetreeService Layer

**File:** `server/services/beetreeService.ts` (lines 137, 157, 164)

```typescript
case 'progress':
  if (serviceOpts?.stream) {
    logger.debug(`[beetreeService] Forwarding progress event: stage=${event.stage}, ts=${event.timestamp}`);
    serviceOpts.stream.emitEvent('solver_progress', {...});
  } else {
    logger.debug(`[beetreeService] Progress event received but no stream handler`);
  }
  break;
```

**What to look for:**
- Events being forwarded with original timestamps
- **CRITICAL ISSUE**: "Progress event received but no stream handler" = stream object is undefined
- Timestamp values being passed through

**Example output:**
```
[beetreeService] Forwarding progress event: stage=Step 1, ts=42
[beetreeService] Forwarding log event: level=info, ts=50
[beetreeService] Forwarding progress event: stage=Step 2, ts=1200
```

---

### 3. beetreeStreamService Layer

**File:** `server/services/streaming/beetreeStreamService.ts` (lines 140, 148)

```typescript
emitEvent: (event, payload) => {
  logger.debug(`[beetreeStreamService] Emitting event via harness: event=${event}, ts=${payload?.timestamp}, streamKey=${streamKey}`);
  sseStreamManager.sendEvent(streamKey, event, enrichedEvent);
}
```

**What to look for:**
- Events leaving harness with correct streamKey
- Timestamps still intact
- Correct event type names

**Example output:**
```
[beetreeStreamService] Emitting event via harness: event=solver_progress, ts=42, streamKey=beetree-xxx-123
[beetreeStreamService] Emitting event via harness: event=solver_log, ts=50, streamKey=beetree-xxx-123
```

---

### 4. SSEStreamManager Layer

**File:** `server/services/streaming/SSEStreamManager.ts` (lines 85, 91)

```typescript
sendEvent<T>(sessionId: string, event: string, payload: T): void {
  const connection = this.connections.get(sessionId);
  if (!connection || connection.closed) {
    logger.debug(`[SSEStreamManager] Event ${event} dropped for ${sessionId}: connection missing or closed`);
    return;
  }

  logger.debug(`[SSEStreamManager] Sending event ${event} to ${sessionId}, ts=${(payload as any)?.timestamp}`);
  connection.response.write(`event: ${event}\ndata: ${serialized}\n\n`);
}
```

**What to look for:**
- "Sending event" = event reached client successfully
- "Event dropped" = **CRITICAL**: Connection doesn't exist or is closed
  - Client may not have connected yet
  - Connection timed out or errored
  - StreamKey mismatch
- Timestamp values being sent

**Example output:**
```
[SSEStreamManager] Sending event solver_progress to beetree-xxx-123, ts=42
[SSEStreamManager] Sending event solver_log to beetree-xxx-123, ts=50
[SSEStreamManager] Event solver_progress dropped for beetree-xxx-456: connection missing or closed
```

---

## Event Types and Their Structure

### start

```json
{
  "type": "start",
  "metadata": {
    "taskId": "136b0064",
    "testIndex": 0,
    "mode": "testing",
    "runTimestamp": "beetree_1764729317529"
  }
}
```

### progress

```json
{
  "type": "progress",
  "status": "RUNNING",
  "stage": "Step 1 (Shallow search)",
  "outcome": "success",
  "event": "[gpt-5.1_1_step_1] Processing...",
  "predictions": [[[0, 1], [2, 3]]],
  "costSoFar": 0.0042,
  "tokensUsed": {
    "input": 1200,
    "output": 450,
    "reasoning": 0,
    "total": 1650
  },
  "timestamp": 1234
}
```

### log

```json
{
  "type": "log",
  "level": "info",
  "message": "[gpt-5.1_1_step_1] Initiating call to API...",
  "timestamp": 1250
}
```

### final

```json
{
  "type": "final",
  "success": true,
  "result": {
    "taskId": "136b0064",
    "testIndex": 0,
    "mode": "testing",
    "predictions": [[[...]], [[...]]],
    "costBreakdown": {
      "total_cost": 0.1234,
      "by_model": [...],
      "total_tokens": {...}
    },
    "verboseLog": "..."
  },
  "timestamp": 5000
}
```

### error

```json
{
  "type": "error",
  "message": "Task file not found",
  "timestamp": 50
}
```

---

## Troubleshooting Guide

### Symptom: No Events Appear in UI

**Step 1: Check Client Connection**
```bash
# In browser console
console.log(eventSource.readyState)  // Should be 0=CONNECTING or 1=OPEN
```

**Step 2: Check Server Logs for SSEStreamManager**
Look for:
```
[SSEStreamManager] Sending event solver_progress to beetree-xxx-123
```

If you see "Event dropped", go to **Step 5**.

If you don't see ANY SSEStreamManager logs, go to **Step 3**.

**Step 3: Check beetreeService Logs**
Look for:
```
[beetreeService] Forwarding progress event
```

If you see "Progress event received but no stream handler", the `serviceOpts.stream` object is undefined. Check that `beetreeStreamService.startStreaming()` is being called and the harness is created correctly.

If you don't see beetreeService logs, go to **Step 4**.

**Step 4: Check pythonBridge Logs**
Look for:
```
[pythonBridge] Parsed event: type=progress
```

If you see these but no beetreeService logs, the event handler in `beetreeService` isn't receiving the event. Check the `pythonBridge.onEvent()` callback registration.

If you don't see pythonBridge logs, the wrapper isn't outputting NDJSON. Check:
- Wrapper is actually being called
- Python is installed and in PATH
- stdin/stdout pipes are connected

**Step 5: StreamKey Mismatch**

If SSEStreamManager shows "connection missing or closed":

```javascript
// In beetreeController.streamBeetreeAnalysis, check:
const streamKey = `beetree-${sessionId}`;  // Should be exactly this

// In client, check:
const url = `/api/stream/analyze/beetree-${serverSessionId}`;  // Should match above
```

The sessionId extracted from the URL must match:
1. The sessionId returned from `/api/beetree/run`
2. The streamKey used in all SSE send operations

---

### Symptom: Timestamps Are Wrong (Events Show Current Time)

**Step 1: Check Wrapper Output**

Look at a raw beetree log file like `logs/beetree_1764729317529_136b0064_1_step_1.json`. Do the events have a `timestamp` field?

If NO: The wrapper's event emission isn't including timestamps. Check that:
- `StreamEmitter.__init__()` receives `start_time` parameter
- `timestamp_ms` calculation is being done in `write()` method
- `emit()` call includes `"timestamp": timestamp_ms`

If YES: Go to **Step 2**.

**Step 2: Check beetreeService Event Forwarding**

Look at server logs for:
```
[beetreeService] Forwarding progress event: stage=Step 1, ts=42
```

If `ts=42` (original timestamp), the preservation is working.

If `ts=<current unix time>`, it's creating a new timestamp. Check that all event handlers use:
```typescript
timestamp: event.timestamp ?? Date.now()
```

Not:
```typescript
timestamp: Date.now()  // WRONG
```

---

### Symptom: "Error" Messages When Level Should Be "Info"

**Root Cause:** stderr is being captured with `level: 'error'`

The wrapper deliberately captures stdout→stderr to keep NDJSON clean on stdout. Check:

```python
# In beetree_wrapper.py line 267:
with contextlib.redirect_stdout(sys.stderr):  # stdout → stderr
    with contextlib.redirect_stderr(StreamEmitter(..., 'info', ...)):  # stderr → StreamEmitter
```

StreamEmitter with level='info' should produce:
```json
{"type": "log", "level": "info", "message": "...", "timestamp": 123}
```

If you're seeing `"level": "error"` on info messages, the `StreamEmitter` is being instantiated with `level='error'` somewhere. Search for all `StreamEmitter(` calls.

---

### Symptom: Server Crashes with "No module named fcntl"

This is a Windows-specific issue. fcntl is Unix/Linux only.

**Solution Already Applied:**

File: `beetreeARC/src/logging.py` (lines 8-13)

```python
try:
    import fcntl
except ImportError:
    fcntl = None
```

And later (lines 125-132):
```python
if fcntl and hasattr(fcntl, 'flock'):
    fcntl.flock(f, fcntl.LOCK_EX)
```

If you still see fcntl import errors:
1. Check that the try/except is in place in logging.py
2. Check that wrapper.py has the fcntl stub for Windows (lines 36-47)
3. Verify you're on latest code

---

## Integration Checklist

When adding features to Beetree streaming, ensure:

- [ ] All event types (start, progress, log, final, error) have timestamps
- [ ] beetreeService preserves timestamps with `event.timestamp ?? Date.now()`
- [ ] StreamingHarness.emitEvent() logs debug messages
- [ ] streamKey format is `"beetree-${sessionId}"` everywhere (6 locations)
- [ ] SSE route extracts sessionId correctly from URL
- [ ] Client EventSource URL matches the route pattern
- [ ] Debug logging is in place at all 4 layers
- [ ] Test with events that take time to verify timestamp progression

---

## Implementation Summary

| Component | File | Key Behavior |
|-----------|------|--------------|
| **Wrapper** | `server/python/beetree_wrapper.py` | Emits NDJSON with timestamps to stdout; StreamEmitter adds timestamps to captured output |
| **pythonBridge** | `server/services/pythonBridge.ts` | Parses NDJSON, preserves timestamps, forwards to beetreeService |
| **beetreeService** | `server/services/beetreeService.ts` | Routes events, preserves timestamps with fallback, forwards to harness |
| **beetreeStreamService** | `server/services/streaming/beetreeStreamService.ts` | Creates StreamingHarness, manages stream lifecycle |
| **SSEStreamManager** | `server/services/streaming/SSEStreamManager.ts` | Manages SSE connections by streamKey, sends events to clients |
| **Controller** | `server/controllers/beetreeController.ts` | Registers SSE endpoint, creates streamKey |
| **Hook** | `client/src/hooks/useBeetreeRun.ts` | Connects EventSource, handles events |

---

## Architecture Principles

1. **Timestamp Immutability:** Once a timestamp is set in the wrapper, pass it through all layers unchanged
2. **StreamKey Consistency:** Single source of truth for streamKey format, used everywhere identically
3. **Debug Visibility:** Four-layer logging allows tracing events at each hop
4. **Fallback Strategy:** When original timestamp missing, create new one (defensive programming)
5. **Connection Validation:** Check connection existence before sending events

---

## Related Files Not Modified But Critical

- `server/routes.ts`: SSE route registration (line 219)
- `shared/types.ts`: BeetreeBridgeEvent type definitions
- Client event handlers: Parse SSE events and update UI
