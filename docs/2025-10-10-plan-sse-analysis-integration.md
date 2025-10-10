*
* Author: Codex using GPT-5-high
* Date: 2025-10-10T00:00:00Z
* PURPOSE: Re-baseline plan to integrate SSE analysis streaming into the interactive puzzle workflows (Examiner, Discussion, Debate, Grover) while ensuring proper model capability flags and persistence flows.
* SRP/DRY check: Pass — confirmed no other active plan covers SSE client integration; reviewed /docs for overlap.
* shadcn/ui: Pass — documentation only.

# Plan: SSE Analysis Integration (Production Flows)

## Objectives
- Route interactive analysis triggers (Examiner, Discussion, Debate, Grover) through the SSE pipeline when the selected model officially supports streaming; fall back to POST otherwise.
- Reuse the existing persistence path (`save-explained`) so streamed runs end up indistinguishable from POST runs in the DB/UI.
- Surface a consistent streaming panel during active runs using the shared `StreamingAnalysisPanel`.
- Align model capability flags so GPT-5 family (and any other supported models) expose `supportsStreaming: true` via `ModelCapabilities`.

## Key Tasks
1. **Capability Audit**
   - Review `server/config/models/ModelCapabilities.ts` overrides; ensure GPT-5, GPT-5 mini, GPT-5 nano (and any other confirmed models) have `supportsStreaming: true`.
   - Verify `aiServiceFactory` providers advertise streaming for those models.
2. **Hook Refactor (`client/src/hooks/useAnalysisResults.ts`)**
   - Inject streaming detection via `useAnalysisStreaming`.
   - Add start/cancel helpers that choose SSE vs POST based on capability + feature flag.
   - On stream completion, forward summary payload to `save-explained` with the same validation logic used today.
3. **UI Integration**
   - PuzzleExaminer: wire streaming panel, button disabled state, status messaging.
   - PuzzleDiscussion & ModelDebate: reuse hook, insert panel near conversation log, ensure `previousResponseId` propagates to SSE.
   - Grover: decide whether to consume SSE output or keep WebSocket; document final choice and adapt panel accordingly.
4. **Error Handling & Cleanup**
   - Normalize stream errors into existing `analyzerErrors`.
   - Guarantee EventSource teardown on navigation/unmount.
5. **Verification**
   - Manual runs for streaming vs non-streaming models to confirm persistence and UI parity.
   - Update docs/notes if Grover stays on WebSocket.

## Risks / Watchpoints
- Streaming summary must include complete analysis payload; if fields are missing, adjust backend summarizer before enabling UI.
- Ensure no accidental fall-through to batch endpoints; all calls must use `/api/stream/analyze/:taskId/:model`.
- Model capability cache might need refresh after flag updates; consider forcing refresh in dev utilities if inconsistencies appear.
