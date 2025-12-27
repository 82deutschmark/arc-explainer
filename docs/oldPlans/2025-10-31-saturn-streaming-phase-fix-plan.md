# 2025-10-31 Saturn streaming phase fix plan

## Goal
Resolve duplicated reasoning in the Saturn status log UI and repair Phase 2 request chaining failures caused by malformed OpenAI Responses payloads.

## Scope & files
- `client/src/hooks/useSaturnProgress.ts` – stop streaming chunk text/reasoning from polluting `logLines`.
- `server/services/base/BaseAIService.ts` – extend `ServiceOptions` with a flag to suppress instructions on continuation turns.
- `server/services/openai/payloadBuilder.ts` – omit `instructions` when Saturn opts into suppression while chaining `previous_response_id`.
- `server/services/saturnService.ts` – enable the new suppression flag for all post-Phase 1 Saturn calls (still send system prompt once).
- `CHANGELOG.md` – document the fix.

## Tasks
1. Update the Saturn progress hook so SSE chunk handling no longer pushes reasoning/output text into `logLines`, preserving python event logs only.
2. Add a `suppressInstructionsOnContinuation` option to `ServiceOptions` and propagate it through payload building.
3. Teach the OpenAI payload builder to respect the suppression flag when `previous_response_id` is present.
4. Configure `saturnService.analyzePuzzleWithModel` to set the suppression flag while keeping the initial system prompt.
5. Verify Phase 2 streaming locally (manual or via script) and update the changelog.
