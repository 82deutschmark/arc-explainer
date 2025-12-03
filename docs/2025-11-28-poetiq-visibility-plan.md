## 2025-11-28 Poetiq visibility plan

- **Goal**: Mirror the Python console feed inside PoetiqSolver so users can see every prompt, reasoning trace, and NDJSON event without opening dev tools.

### Scope

1. **Hook instrumentation audit**
   - Review `server/python/poetiq_wrapper.py` event payloads to confirm prompts, reasoning text, and token/cost data are emitted.
   - Verify `server/services/poetiq/poetiqService.ts` forwards all payload fields over the `/api/poetiq/progress` WebSocket.

2. **Client hook upgrades**
   - Extend `usePoetiqProgress.ts` state to capture:
     - Prompt history with iteration/expert metadata
     - Raw event stream (type, payload JSON, timestamp)
     - Token and cost aggregates per expert and globally
   - Expose new fields to the UI while retaining existing consumers.

3. **Solver page UI work**
   - Update `PoetiqSolver.tsx` to surface:
     - Prompt timeline list (all prompts per iteration)
     - Reasoning trace panel (every LLM output)
     - Raw WebSocket event viewer (JSON)
     - Token/cost stats from Python
   - Keep toggles simple (on-page buttons, no modals) and ensure DaisyUI styling stays consistent with rest of page.

4. **Docs & metadata**
   - Record the change in `CHANGELOG.md` with a new semantic version entry at the top (include author/model).
   - Mention touched files and new UI affordances.

### Status (2025-11-29)

- ✅ `server/services/poetiq/poetiqService.ts` now forwards token/cost + prompt metadata so the WS payload mirrors the Python NDJSON stream.
- ✅ `client/src/hooks/usePoetiqProgress.ts` captures prompt timeline entries, reasoning stream text, raw events, and expert token/cost aggregates with reset-safe state handling.
- ✅ `client/src/pages/PoetiqSolver.tsx` surfaces all of that data via new toggles (timeline, stream, raw events) plus live token/cost summary badges.
- ✅ `CHANGELOG.md` updated with version 5.32.9 documenting every touched file for this visibility sweep.
