# 2025-12-18 OpenRouter Streaming Plan

## Goal
- Deliver functional streaming behavior for OpenRouter models so Puzzle Examiner can show incremental output without the current unsupported-model error message.

## Files to Touch
- `server/services/openrouter.ts` (add streaming entry point, ensure header, comments, and harness usage are updated).
- `docs/2025-12-18-openrouter-streaming-plan.md` (this plan itself) to capture intent and follow-up steps.
- `CHANGELOG-Dec2025.md` (record the fix and any limitations or follow-up needed).

## TODO
1. Confirm where the unsupported-streaming error originates and how OpenRouter currently fits into the streaming pipeline.
2. Implement or simulate streaming support inside `OpenRouterService`, emitting at least a prompt/result chunk so SSE flows see progress.
3. Document the change in the changelog and capture any remaining work/logging notes that future agents should address.
