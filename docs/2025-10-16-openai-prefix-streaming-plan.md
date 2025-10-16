# 2025-10-16-openai-prefix-streaming-plan

## Goal
Normalize `openai/` prefixed model keys so streaming analysis and Saturn entry points
choose the OpenAI provider while preserving original metadata for SSE clients.

## Target Files
- `server/services/aiServiceFactory.ts` – expose canonicalization helper and route using normalized keys.
- `server/services/streaming/analysisStreamService.ts` – decode + canonicalize model key before provider lookup and SSE events.
- `server/services/streaming/saturnStreamService.ts` – ensure Saturn harness also canonicalizes (already aligned, verify only).
- `tests/analysisStreamService.test.ts` – extend coverage for OpenAI-prefixed streaming request.

## Tasks
1. Implement helper returning `{ original, normalized }` model keys and reuse before routing checks.
2. Update streaming services to call `aiServiceFactory`/`supportsStreaming` with normalized key but emit original key in SSE metadata.
3. Expand tests to simulate `/api/stream/analyze/{taskId}/openai%2Fgpt-5-2025-08-07` ensuring streaming events fire (no `STREAMING_UNAVAILABLE`).
4. Harden decoding paths so malformed or already-decoded model keys gracefully fall back without breaking streaming.
5. Backfill unit coverage for the canonicalization helper to guard against regressions when additional providers are added.

