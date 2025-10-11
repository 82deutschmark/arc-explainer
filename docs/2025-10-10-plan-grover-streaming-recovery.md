*
* Author: Codex using GPT-5-high
* Date: 2025-10-10T15:46:30
* PURPOSE: Recovery plan to reintroduce Grover SSE streaming after previous uncommitted work was lost. Details specific code edits needed to mirror Saturn streaming pipeline.
* SRP/DRY check: Pass — documentation only.
* shadcn/ui: Pass — doc file.

# Grover Streaming Recovery Plan

## Status Snapshot
- **Lost**: Uncommitted Grover streaming work (service orchestrator, controller route, hook updates).
- **Existing**: WebSocket-based progress (useGroverProgress, /api/grover/progress); Grover service already extends BaseAIService but lacks streaming harness usage.
- **Goal**: Mirror Saturn SSE integration so Grover iterative solver streams status and final response through /api/stream/grover/:taskId/:modelKey.

## Tasks

### 1. Backend Service Layer
- Update server/services/grover.ts (already partially modified) to:
  - Register streaming harness at start (const harness = serviceOpts.stream; const controller = this.registerStream(harness);).
  - Emit stream.status + stream.chunk events in sendProgress helper.
  - Remove harness before calling underlying providers (stream: undefined).
  - Call inalizeStream on success/error with metadata (iterations, bestScore, etc.).
  - Ensure sendProgress includes status: 'completed'/'failed' where appropriate.

### 2. Grover Streaming Service
- Create server/services/streaming/groverStreamService.ts (parallel to Saturn version):
  - Accept params (sessionId, taskId, modelKey, temperature, maxIterations, previousResponseId, abortSignal).
  - Register harness with emit, emitEvent, end pointing to sseStreamManager.
  - Call puzzleAnalysisService.analyzePuzzleStreaming with stream harness and Grover-specific options.

### 3. Controller & Routes
- Extend server/controllers/groverController.ts:
  - Add streamAnalyze handler that registers SSE session (sseStreamManager.register), parses query params (temperature, maxIterations, previousResponseId), instantiates AbortController, and delegates to groverStreamService.
- Update server/routes.ts to expose GET /api/stream/grover/:taskId/:modelKey pointing to new controller handler.

### 4. PuzzleAnalysisService
- Confirm nalyzePuzzleStreaming handles maxSteps, originalExplanationId, 	hinkingBudget, etc. (already added during Saturn restoration). No further changes expected.

### 5. Frontend Hook
- Replace WebSocket-only logic in client/src/hooks/useGroverProgress.ts:
  - When VITE_ENABLE_SSE_STREAMING === 'true', open EventSource hitting /api/stream/grover/....
  - Update state with streaming text/reasoning fields, token usage.
  - Keep WebSocket fallback for legacy mode.

### 6. UI Consumers
- Ensure pages/components using useGroverProgress render StreamingAnalysisPanel similar to Saturn (e.g., Grover dashboards/pages).

### 7. Validation / Handoff
- Manual tests: start Grover run, confirm SSE events show live updates and final summary; ensure DB persistence uses existing POST flow triggered by inalizeStream summary.
- Document in CHANGELOG.md once verified.

## Notes
- Do not run git restore again; manually reinsert recovered code and let someone else handle commits.
- Use Saturn files (saturnStreamService, useSaturnProgress) as reference implementations.
- Remember to propagate error states to both SSE stream and legacy WebSocket (for fallback).

# End
