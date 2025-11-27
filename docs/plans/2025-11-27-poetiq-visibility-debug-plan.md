/**
 * Author: Codex (GPT-5)
 * Date: 2025-11-27
 * PURPOSE: Recovery and visibility plan for Poetiq solver streaming.
 *          Goal: match SaturnVisualSolver-grade transparency so users always see
 *          reasoning, generated code, and Python execution (including errors).
 * SRP/DRY check: Pass - documentation-only plan with concrete tasks.
 */

# Poetiq Visibility & Streaming Debug Plan (Saturn reference)

## Problem
Poetiq's UI stays blank after clicking **Run** because it only emits sparse WebSocket payloads. Saturn achieves immediate transparency with a dual-channel stream (SSE + WebSocket), bridge-level stdout/stderr buffering, and synchronous UI seeding. Until Poetiq clones those mechanics, every failure will look like "no output".

## Saturn audit - required parity points
- **Dual transports**: `saturnStreamService` + `useSaturnProgress` deliver prompt preview, token deltas, and completion metadata over SSE while WebSockets carry Python/runtime events. Poetiq needs the same SSE harness or the UI can never mirror Saturn's prompt + reasoning view.
- **Bridge discipline**: `pythonBridge.runSaturnAnalysis` tags events with `source`, buffers stdout/stderr, and attaches `saturnLog` plus `eventTrace` on final emit. Poetiq currently drops everything except `progress` events.
- **Wrapper semantics**: `saturn_wrapper.py` forces all prints through `StreamEmitter`, emits consistent `start/progress/log/error/final` envelopes, and watches temp dirs so images/logs reach the UI immediately. Poetiq must emit the same richness (reasoning/code/log/traceback) or the bridge has nothing to forward.
- **Frontend buffers**: `useSaturnProgress` seeds `logLines`, `reasoningHistory`, and `streaming*` fields synchronously; placeholders appear before network calls resolve. Poetiq's hook only updates when `message` changes, so panels remain empty.
- **Persistence + validation**: Saturn validates streaming output, persists explanations, and captures verbose logs before closing SSE. Poetiq needs identical persistence so analytics and history stay aligned with what users saw.

## Workstreams

### 1. Baseline reproduction & instrumentation
- Re-run a small puzzle (e.g., `00d62c1b`), capture WS frames, stdout/stderr, and browser console logs to confirm where signals stop.
- Add temporary logging inside `poetiqService.solvePuzzle` to record each NDJSON `type` received; compare vs. what reaches `broadcast`.
- Preflight guardrails: detect missing `poetiq-solver` submodule or absent API keys before spawning Python and emit structured errors.

### 2. Backend transport parity
- **Controller/SSE**: Add `/api/stream/poetiq/:taskId/:modelKey` that mirrors `saturnController.streamAnalyze`. Register via `sseStreamManager`, emit `stream.init/status/chunk/phase_complete/complete/error`, and pass a `StreamingHarness` into the service.
- **Bridge refactor**: Introduce `pythonBridge.runPoetiqSolver` (or equivalent) that copies Saturn's NDJSON reader: tag events, buffer stdout/stderr, capture `eventTrace`, surface `api_call_*` telemetry, and respect abort signals.
- **Broadcast contract**: Ensure `poetiqController.solve` + `poetiqService` forward *all* event types (start, progress, log, error, final) with fields the UI needs (`phase`, `status`, `reasoning`, `code`, `trainResults`, `expert`, `usingFallback`). Keep session snapshots in sync for polling.

### 3. Python wrapper upgrades
- Replace raw prints with an `emit_log(level, message)` helper so every stdout/stderr line becomes a `log` event (Saturn-style `StreamEmitter`).
- Emit richer metadata:
  - `start`: puzzle id, expert count, model/provider, BYO vs. fallback, iteration caps.
  - `progress`: phases (`reasoning`, `evaluating`, `feedback`, `python`), iteration number, expert id, reasoning text, code snippet, train-result summaries.
  - `log`: tee sandbox/stdout/stderr output so the UI terminal updates even when reasoning fails.
  - `error`: include traceback excerpts and remediation hints (initialize submodule, provide API key, etc.).
  - `final`: capture iterations, best scores, generated code, predictions, and verbose log.
- Add a watcher (similar to Saturn's PNG watcher) that streams any intermediate Python execution artifacts/logs so the "Python Execution" panel always has activity.

### 4. Frontend hook parity
- Update `usePoetiqProgress.ts` to manage both SSE and WebSocket connections. Copy `useSaturnProgress` patterns for `stream.init/status/chunk/phase_complete/complete/error` handlers, prompt preview logging, streaming buffers, and error banners.
- Seed UI state synchronously: set `status='running'`, initialize `logLines`, `reasoningHistory`, `streamingReasoning`, `streamingCode`, `pythonLogLines`, and placeholders before async calls resolve.
- Maintain separate buffers for reasoning, code, train results, and Python logs so each panel renders immediately. Append WS `log` events even when `message` repeats.
- Update `PoetiqSolver.tsx` (and terminal components) to consume the new buffers, show "awaiting" placeholders, surface explicit errors, and display verbose log download links.

### 5. Persistence, validation, analytics
- Ensure SSE completion still persists explanations via `explanationService.saveExplanation`, including Poetiq-specific `providerRawResponse` (iterations, generated code, verbose log, accuracy).
- Add lightweight validation (mirroring `validateStreamingResult`) so malformed train/test data does not corrupt history.
- Store verbose logs (`saturnLog` equivalent) for each run so users can inspect traces from history pages.

### 6. Regression & safety net
- CLI harness: run `poetiq_wrapper.py` with a stub LLm response to verify NDJSON ordering and failure behavior without live API keys.
- Node-level test: feed synthetic NDJSON lines into the bridge and assert the controller/broadcast pipeline emits the expected WS payloads.
- Manual acceptance: confirm that within 2-3 seconds of pressing **Run**, all three UI panes show either text or clear placeholders, BYO/fallback errors surface in the UI, and SSE/WS sessions clean up after run completion or abort.

## Files to touch (future work; no changes yet)
- Backend: `server/controllers/poetiqController.ts`, `server/services/poetiq/poetiqService.ts`, `server/services/pythonBridge.ts` (or new bridge helper), `server/services/streaming/SSEStreamManager.ts`, `server/services/wsService.ts`, `server/python/poetiq_wrapper.py`.
- Frontend: `client/src/hooks/usePoetiqProgress.ts`, `client/src/pages/PoetiqSolver.tsx`, `client/src/components/poetiq/*`, shared streaming types/config.

## Risks / watchouts
- Dual transports double resource usage; ensure `wsService.clearSession` and `sseStreamManager.close` fire on every exit to avoid leaks.
- Reasoning/code payloads can explode; mimic Saturn's truncation rules (cap log lines to 500, reasoning history to 100, append ellipses).
- BYO API keys must remain server-side; only broadcast `usingFallback` booleans and scrub `options` objects.
- Python watcher threads must stop cleanly on Windows to avoid orphaned handles; gate them with events/timeouts like Saturn's watcher.
