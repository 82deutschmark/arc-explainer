# 2025-02-17-openai-streaming-conflict-plan

## Goal
Resolve merge conflicts around the OpenAI streaming helper by reconciling structured JSON handling with downstream expectations and ensure tests cover fallback + annotated flows.

## Context Review
- `server/services/openai/streaming.ts` currently aggregates SSE events and tracks fallback JSON deltas.
- `tests/openaiStreamingHandlers.test.ts` asserts helper behaviour for text, reasoning, JSON, and annotations.
- Existing implementation lacks `json.done` emission for fallback-only streams and only shallow-merges structured deltas.

## Tasks
1. **Streaming helper audit**
   - [x] Add robust merge helper for incremental `output_parsed.delta` payloads (objects & arrays).
   - [x] Emit `json.done` event even when only fallback deltas were received.
   - [x] Include metadata to signal fallback completion.
2. **Test enhancements**
   - [x] Cover nested JSON delta merging to guard against regressions.
   - [x] Assert fallback `json.done` emission when schema expectation falls back to text.
3. **Verification**
   - [x] Run `node --test tests/openaiStreamingHandlers.test.ts` to confirm scenarios pass.
