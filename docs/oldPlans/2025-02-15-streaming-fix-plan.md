# 2025-02-15 Streaming fix plan

## Goal
Implement missing streaming event handlers so structured JSON output and annotations propagate correctly through SSE.

## Tasks
- [x] Audit existing `handleStreamingEvent` logic in `server/services/openai.ts`.
- [x] Update JSON streaming handling to rely on `response.output_text.delta`/`done` when `text.format.type === "json_schema"`.
- [x] Emit annotations via new `response.output_text.annotation.added` handling and propagate to client consumers.
- [x] Update `client/src/hooks/useSaturnProgress.ts` (or relevant consumer) to record annotation chunks.
- [x] Expand `tests/openaiStreamingHandlers.test.ts` coverage for JSON and annotation events.
- [x] Run targeted tests.
- [x] Summarize findings in CHANGELOG.
