# 2025-10-16 Pending-session handshake plan

## Goal
Implement handshake flow for analysis streaming that moves large payloads from query params into a server-side pending-session store shared between POST and SSE endpoints.

## Proposed changes
- server/routes.ts
  - Register new POST `/api/stream/analyze` endpoint.
  - Update SSE route signature to include sessionId path param.
- server/controllers/streamController.ts
  - Add handler for POST handshake including validation and storage.
  - Refactor SSE handler to fetch cached payload, short-circuit if missing, and drop heavy query parsing.
  - Ensure lifecycle events clear cached payload on completion/error/cancel.
- server/services/streaming/analysisStreamService.ts
  - Maintain pending-session payload store keyed by sessionId.
  - Expose helpers to save, fetch, and clear payloads.
  - Integrate lifecycle cleanup hooks.
- client/src/lib/streaming/analysisStream.ts
  - Perform POST handshake before opening SSE.
  - Pass minimal query params (session + booleans) to EventSource.
- docs/reference/api/EXTERNAL_API.md & tests
  - Update documentation/test fixtures for new handshake flow.

## Open questions / follow-ups
- Confirm if POST should require authentication; assume existing middleware covers route scope.
- Determine how to propagate errors from handshake validation back to client; plan to use HTTP 400/422 responses.

