# 2025-12-02-beetree-streaming-debug-plan

## Goal
Restore Beetree Solver streaming updates in the web UI by fixing the SSE wiring between the client hook and the backend stream manager.

## Files / Todos
1. `client/src/hooks/useBeetreeRun.ts`
   - Normalize the sessionId before constructing the SSE URL so we never send a double `beetree-` prefix.
   - Replace the single `onmessage` handler with explicit `addEventListener` registrations for all Beetree SSE event types.
   - Update the internal event dispatcher so it keys off the SSE event name (instead of a `type` field that the payload never contained) and keeps the UI state in sync.
2. `CHANGELOG.md`
   - Document the streaming fix with a new semantic version entry at the top noting the client hook updates.

## Validation
- Start a Beetree run and confirm the console logs show a single `beetree-<sessionId>` SSE URL.
- Watch the Beetree page to confirm progress, logs, and completion states now render live.
