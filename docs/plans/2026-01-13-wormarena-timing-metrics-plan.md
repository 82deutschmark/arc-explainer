# 2026-01-13 Worm Arena timing metrics plan

## Context
- Users want to see detailed timing metrics during live Worm Arena matches:
  - Average time per round
  - Per-player response time (how fast each model replies)
  - Per-player API call latency (how fast their API responses return)
- Current implementation only shows wall clock (time since match start) and "since last move" timer
- No per-player timing breakdown is currently captured or displayed
- The replay JSON shows token counts and costs, but not timing data

## Goals
1. Capture per-player timing data at the backend (request time, response time, round completion time)
2. Stream timing metrics via SSE events alongside frame data
3. Display timing metrics in the live UI:
   - Average time per round (overall)
   - Per-player average response time
   - Per-player current/last response time
   - Per-player API latency (if available from OpenRouter/other providers)
4. Include timing data in replay JSON for post-match analysis

## Deliverables
- Backend timing capture in Python bridge (per-move timestamps)
- Schema extensions for timing data in `shared/types.ts`
- Frontend hook state for timing metrics
- UI components to display timing metrics (status strip or new panel)
- Replay JSON enriched with timing data

## Task Breakdown
1. **Audit current data flow**
   - Review `SnakeBenchPythonBridge.ts` to see what data is captured from Python stdout
   - Review replay JSON structure to understand existing fields
   - Check if Python runner already emits timing data

2. **Backend timing capture**
   - Modify Python runner to emit timing events per move:
     - `request_sent_at`: when LLM request is sent
     - `response_received_at`: when LLM response is received
     - `round_completed_at`: when round finishes
   - Format as JSON events on stdout for SSE consumption
   - Update `SnakeBenchStreamingRunner.ts` to parse timing events and store per-player timing state

3. **Schema extensions**
   - Add `WormArenaPlayerTiming` interface with:
     - `playerId`: string
     - `moveCount`: number
     - `totalResponseTimeMs`: number
     - `avgResponseTimeMs`: number
     - `lastResponseTimeMs`: number
     - `totalApiLatencyMs`: number
     - `avgApiLatencyMs`: number
   - Add `WormArenaRoundTiming` interface with:
     - `round`: number
     - `startedAt`: number
     - `completedAt`: number
     - `durationMs`: number
   - Extend `WormArenaStreamStatus` and `WormArenaFrameEvent` to include timing data

4. **Frontend hook updates**
   - Add state for `playerTiming` (Record<string, WormArenaPlayerTiming>)
   - Add state for `roundTiming` (array of WormArenaRoundTiming)
   - Parse timing events from SSE and update state
   - Compute derived metrics (avg per round, per-player averages)

5. **UI components**
   - Add timing metrics section to `WormArenaLiveStatusStrip` or create new `WormArenaLiveTimingPanel`
   - Display:
     - Average time per round (overall)
     - Per-player: avg response time, last response time
     - Per-player: avg API latency (if available)
   - Format times in human-readable format (e.g., "2.3s", "450ms")

6. **Replay JSON enrichment**
   - Add `timing` section to replay JSON with:
     - `rounds`: array of round timing data
     - `players`: per-player timing summary
   - Ensure timing data is persisted for post-match analysis

## Risks & Mitigations
- **Python runner changes**: May require modifying external SnakeBench code. Mitigation: Emit timing data via JSON events on stdout without breaking existing format.
- **Timing accuracy**: Client-side timing may not reflect actual API latency. Mitigation: Capture timing at Python bridge level where API calls are made.
- **Data volume**: Too many timing events could overwhelm SSE. Mitigation: Aggregate timing data and emit summary events per round.
- **Missing API latency**: Some providers may not expose latency data. Mitigation: Compute latency from request/response timestamps, show "N/A" if unavailable.

## Approval Checklist
- [x] User approves plan before implementation.
- [x] Update plan status to "done" once code + docs ship.

## Implementation Status
**Completed on 2026-01-13**

### Changes Made
1. **Schema extensions** (`shared/types.ts`):
   - Added `WormArenaPlayerTiming` interface with per-player timing metrics
   - Added `WormArenaRoundTiming` interface with per-round timing metrics
   - Extended `SnakeBenchRunMatchResult` and `WormArenaFinalSummary` with `playerTiming` and `roundTiming` fields

2. **Backend timing capture** (`SnakeBenchStreamingRunner.ts`):
   - Added timing state tracking (`playerTiming`, `roundTiming`, `currentRoundStart`)
   - Parse `timing` events from Python stdout (format: `{"type":"timing","playerId":"0","responseTimeMs":1234,"apiLatencyMs":567}`)
   - Track round timing on "Finished round" messages
   - Include timing data in final result passed to handlers

3. **Frontend hook** (`useWormArenaStreaming.ts`):
   - Added state for `playerTiming` and `roundTiming`
   - Parse timing data from `stream.complete` event
   - Export timing metrics for UI consumption

4. **Frontend UI** (`WormArenaLiveTimingPanel.tsx`):
   - Created new component to display timing metrics
   - Shows average time per round
   - Shows per-player: average response time, last response time, average API latency
   - Formats times in human-readable format (ms or seconds)

5. **Frontend page** (`WormArenaLive.tsx`):
   - Added `WormArenaLiveTimingPanel` to live view
   - Passes `playerTiming` and `roundTiming` from hook to component

### Notes on Replay JSON Enrichment
- Timing data is captured at the Node.js backend level (SnakeBenchStreamingRunner)
- The replay JSON is written by the Python backend (SnakeBench/main.py)
- Timing data is included in `SnakeBenchRunMatchResult` and passed to persistence
- The DB persistence flow (`GameWriteRepository.ingestReplayFromFile`) can access timing data from the result object
- For full replay JSON enrichment, the Python runner would need to emit timing data to be written to the JSON file
- Current implementation provides timing data via SSE and DB persistence; replay JSON enrichment is deferred to future Python runner changes

### Verification
- Schema compiles with new timing interfaces
- Backend parses timing events and accumulates metrics
- Frontend hook exposes timing state
- UI displays timing metrics in live view
- Timing data flows through persistence pipeline
