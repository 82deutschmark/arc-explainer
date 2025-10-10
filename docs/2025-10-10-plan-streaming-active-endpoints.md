*
* Author: Codex using GPT-5-high
* Date: 2025-10-10T00:00:00Z
* PURPOSE: Implementation blueprint to wire SSE streaming into the actual puzzle analysis workflows (Examiner, Discussion, Debate, Grover) with precise file references for peer review.
* SRP/DRY check: Pass — no existing plan for this scope; verified similar docs in /docs.
* shadcn/ui: Pass — documentation only.

# Plan: Integrate SSE Streaming Into Active Analysis Workflows

## Goals
- Replace the current fire-and-forget POST analysis flow with the SSE pipeline where users actually trigger model runs:
  - PuzzleExaminer (`client/src/pages/PuzzleExaminer.tsx`)
  - PuzzleDiscussion (`client/src/pages/PuzzleDiscussion.tsx`)
  - ModelDebate (`client/src/pages/ModelDebate.tsx`)
  - Grover Solver UI (`client/src/pages/GroverSolver.tsx` + `useGroverProgress` hook)
- Preserve existing database-first saves (still persist via `save-explained`) once streaming completes.
- Surface a consistent “live output” panel using shadcn/ui primitives; reuse across pages.

## Current Touch Points (investigated)
- `client/src/hooks/useAnalysisResults.ts` (lines 71-317): centralizes `analyzeAndSaveMutation`. Needs to branch between SSE vs POST.
- `client/src/pages/PuzzleExaminer.tsx` (approx. lines 116-626): uses `analyzeWithModel` + `ModelButton`.
- `client/src/pages/PuzzleDiscussion.tsx` (line 136) and `client/src/pages/ModelDebate.tsx` (line 129): call `analyzeAndSaveMutation.mutateAsync` directly.
- `client/src/pages/GroverSolver.tsx` (lines 22-180) delegates to `useGroverProgress.ts` (stream currently over REST polling/websocket).
- UI components referencing analysis state:
  - `client/src/components/puzzle/ModelButton.tsx` (lines 13-29).
  - `client/src/components/puzzle/ModelProgressIndicator.tsx` (for active badges) and `client/src/components/puzzle/AnalysisResultCard.tsx`.

## Proposed Implementation Steps

### 1. Core Hook Enhancements (`client/src/hooks/useAnalysisResults.ts`)
1.1 Add SSE support:
  - Import `createAnalysisStream` from `client/src/lib/streaming/analysisStream.ts`.
  - Add boolean gating via `import.meta.env.VITE_ENABLE_SSE_STREAMING` and list of supported models.
  - Manage EventSource lifecycle inside the hook: maintain `streamHandleRef`, accumulate `chunks`, capture summary payload.
  - On `stream.complete`, call existing save endpoint (`POST /api/puzzle/save-explained/:taskId`) with final analysis summary payload.
  - Provide new state: `streamChunks`, `streamStatus`, `activeStreamingModel`.
1.2 Expose new actions:
  - `startStreamingAnalysis(modelKey, opts)` and `cancelStreamingAnalysis()`.
  - Ensure fall-back to mutation when streaming disabled or model unsupported.
1.3 Error handling:
  - Translate SSE `stream.error` to UI-friendly message (reuse existing analyzer error map).
  - Ensure cleanup on component unmount.

### 2. UI Integration: PuzzleExaminer
2.1 Update `client/src/pages/PuzzleExaminer.tsx`:
  - Expand `useAnalysisResults` destructure to receive new streaming state.
  - Replace `handleAnalyzeWithModel` to call `startStreamingAnalysis` when streaming on; otherwise fallback.
  - Add streaming panel UI just below the filter header (reuse existing `Card` styling). Panel should:
    - Show live text (`streamChunks` filtered for `type === 'text'`).
    - Show reasoning lines separately.
    - Display token usage once summary arrives.
  - Continue to display `ModelButton` disable state while streaming.
2.2 Update `client/src/components/puzzle/ModelButton.tsx` to accept new props (e.g., `isStreaming`).

### 3. PuzzleDiscussion & ModelDebate
3.1 Both pages manually call `analyzeAndSaveMutation.mutateAsync`. Introduce a helper (or reuse updated hook) to run streaming:
  - Create small wrapper inside each page that delegates to `useAnalysisResults` with `previousResponseId`, `retryMode`, debate-specific props.
  - Render a compact streaming panel within their existing layout (likely near the conversation log).
3.2 Ensure the conversation chaining (`previousResponseId`) is passed to the SSE request, matching POST behavior.

### 4. Grover Pipeline
4.1 Evaluate `useGroverProgress.ts` (noted as SSE/WebSocket hybrid):
  - Determine whether Grover should use the new SSE endpoint or its existing progress stream.
  - If we keep current WebSocket, expose Response API streaming specifically for the model invocation step (before Grover iterations).
4.2 If SSE is the right path:
  - Build an adapter similar to `useAnalysisStreaming`.
  - Render same streaming panel in `GroverSolver.tsx` near the iteration cards.
4.3 Else, document why Grover remains on current channel and defer.

### 5. Shared Streaming Panel Component
5.1 Create `client/src/components/puzzle/StreamingAnalysisPanel.tsx`:
  - Accept props: `modelName`, `status`, `text`, `reasoning`, `tokenUsage`, `onCancel`.
  - shadcn/ui `Card`, `Alert`, `Badge` for styling.
  - Reuse across PuzzleExaminer/Discussion/Debate.

### 6. Back-End Considerations
6.1 Ensure `/api/stream/analyze` saves summary metadata needed for UI (already returns `responseSummary` with analysis stub).
6.2 Confirm final payload includes everything required by `save-explained` to avoid re-running `validateSolverResponse`.
6.3 Investigate concurrency: ensure SSE manager handles multiple sessions without interfering.

### 7. Testing & Verification
7.1 Unit:
  - Expand `tests/sseUtils.test.ts` to cover chunk categorization.
7.2 Integration/manual:
  - Run `npm run check`.
  - With flags on, test PuzzleExaminer (GPT-5 mini), PuzzleDiscussion (GPT-5), ModelDebate (Grok-4).
  - Verify `save-explained` writes occur exactly once per stream.

## Open Questions / Risks
- How to persist additional streaming metadata (reasoning tokens) in DB? Do we trust summary payload?
- Need to confirm Grover architectural direction (SSE vs existing WebSocket). If deferred, document in follow-up plan.
- Model gating: ensure we only stream for the models confirmed to support Responses API streaming.

## Deliverables Checklist
- [ ] Updated `useAnalysisResults` with streaming path and exposed state.
- [ ] Streaming panel component re-used across pages.
- [ ] PuzzleExaminer integrated and visually verified.
- [ ] PuzzleDiscussion & ModelDebate using streaming path.
- [ ] Decision & action (or explicit deferral note) for Grover streaming.
- [ ] Docs/readme updated to note actual UI locations using streaming.
