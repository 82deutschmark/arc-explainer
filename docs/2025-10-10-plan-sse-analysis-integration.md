*
* Author: Codex using GPT-5-high
* Date: 2025-10-10T00:00:00Z
* PURPOSE: Re-baseline plan to integrate SSE analysis streaming into the interactive puzzle workflows (Examiner, Discussion, Debate, Grover) while ensuring proper model capability flags and persistence flows.
* SRP/DRY check: Fail — work abandoned mid-flight; follow-up doc below describes recovery plan.
* shadcn/ui: Pass — documentation only.

# Plan: SSE Analysis Integration (Abandoned)

## Original Objectives (Not Completed)
- Route interactive analysis triggers (Examiner, Discussion, Debate, Grover) through the SSE pipeline when the selected model officially supports streaming; fall back to POST otherwise.
- Reuse the existing persistence path (`save-explained`) so streamed runs end up indistinguishable from POST runs in the DB/UI.
- Surface a consistent streaming panel during active runs using the shared `StreamingAnalysisPanel`.
- Align model capability flags so GPT-5 family exposes `supportsStreaming: true` via ModelCapabilities.

## What Happened
- Frontend hook and UI work (`useAnalysisResults`, StreamingAnalysisPanel, PuzzleExaminer/Debate/Discussion) landed in commit `8203973` and remains intact.
- Saturn/Grover streaming work (new `saturnStreamService`, saturn controller/route updates, `useSaturnProgress` EventSource path, puzzleAnalysisService streaming entry point) was **uncommitted** and lost when `git restore` was run.
- Partial re-application attempts added accidental changes to `server/services/puzzleAnalysisService.ts` and a new blob `_recovered_useSaturnProgress.ts`, leaving the tree dirty.

## Next Developer Recovery Steps
1. **Restore Saturn/Grover Streaming Files**
   - Check reflog for dangling blob `5f452da5…` (captured to `_recovered_useSaturnProgress.ts`).
   - Restore `client/src/hooks/useSaturnProgress.ts` from that blob.
   - Recreate `server/services/streaming/saturnStreamService.ts` (file still present in working tree) or reapply from the same blob list.
   - Reapply controller/route updates (see sections below) and commit once verified.

2. **PuzzleAnalysisService Streaming Entry Point**
   - Reinsert `analyzePuzzleStreaming()` method and `ServiceOptions` additions removed by the failed restore.
   - Ensure `analyzePuzzle` still references `resolvedOriginalExplanation` and sets `thinkingBudget` in prompt options.

3. **Saturn Controller & Routes**
   - Re-add GET `/api/stream/saturn/:taskId/:modelKey` route calling `saturnStreamService.startStreaming`.
   - Include `AbortController` management and SSE registration (`sseStreamManager.register`).

4. **useSaturnProgress Hook**
   - Replace WebSocket-only logic with EventSource path when `VITE_ENABLE_SSE_STREAMING === 'true'`.
   - Maintain legacy WebSocket fallback for non-streaming deployments.

5. **VERIFY & COMMIT**
   - `npm run build` (already passing for committed frontend).
   - Run targeted streaming tests (manual) to confirm Saturn SSE path completes and saves results.
   - Stage and commit the recovered files with a clear message (e.g., `fix: restore saturn streaming integration`).

6. **Docs**
   - Append new changelog entry describing recovery once code lands.

---

# SUPPLEMENTAL DOC: Recovery Checklist (Saturn/Grover Streaming)

## Files to Restore/Modify
- `client/src/hooks/useSaturnProgress.ts` (EventSource handling, streaming state)
- `server/services/streaming/saturnStreamService.ts` (new SSE orchestrator)
- `server/controllers/saturnController.ts` (new `streamAnalyze` handler)
- `server/routes.ts` (new `/api/stream/saturn/:taskId/:modelKey` route)
- `server/services/puzzleAnalysisService.ts` (new `analyzePuzzleStreaming` entry point, promise signature)
- `server/services/streaming/analysisStreamService.ts` (light modifications already committed—verify nothing missing)

## Reflog/Dangling Artifacts
- `5f452da5718265f8cece6bd6c4dbc73ceb7bab35` ? captured `_recovered_useSaturnProgress.ts`
- Check other blobs for Saturn controller/route diff if needed (`49752fac52d05d21e69df27ba653ef5f8bad6c00`, `289f13af6ea4acdf7f76141e583235f7be08a89c`, etc.).

## Final Step
- Once all code is restored, rerun plan doc with status updated to “Complete” and remove failure note.

