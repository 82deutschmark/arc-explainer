# 2025-10-17 Grover Streaming Upgrade Plan

## Goal
Align Grover iterative solver streaming pipeline with the restored Saturn implementation so the frontend receives Server-Sent Events containing prompt previews, reasoning deltas, and completion metadata.

## Target Files
- `client/src/hooks/useGroverProgress.ts`
- `server/controllers/groverController.ts`
- `server/services/grover.ts`
- `server/services/streaming/groverStreamService.ts`

## Tasks
1. **Hook parity with Saturn**
   - Mirror `useSaturnProgress` streaming lifecycle: initialize EventSource, handle `stream.*` events, maintain prompt logging guard, and fall back to WebSocket when streaming disabled.
2. **Controller SSE hygiene**
   - Decode model key, register SSE session, emit structured start status, parse reasoning query params, and forward abort signal to the stream service.
3. **Streaming service enhancements**
   - Validate streaming support, enrich emitted chunks with task/model metadata, and persist final Grover analysis via `explanationService` before closing SSE.
4. **Service capability flag**
   - Expose `supportsStreaming` (and helper) in `GroverService` so capability checks succeed.
5. **Regression pass**
   - Ensure legacy WebSocket path still operates when streaming disabled and cancellation closes both transports.
