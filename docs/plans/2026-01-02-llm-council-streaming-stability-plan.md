# 2026-01-02 – LLM Council Streaming Stability Plan

**Author:** Cascade (ChatGPT)
**Status:** Proposed – awaiting approval
**Scope:** Preserve and expose council streaming events so users never lose evidence of paid API runs.

---

## 1. Problem Statement
- SSE UI tears down immediately once the fetch closes, erasing progress logs and stage indicators even when runs fail midstream.
- Error payloads coming from the backend never surface in the UI; they disappear with the rest of the panel.
- No telemetry or console breadcrumbs make it impossible to understand what happened without digging into network traces.

## 2. Goals & Non-Goals
| Goal | Details |
|------|---------|
| G1 | Persist the latest stream log + stage state until the user deliberately starts another run. |
| G2 | Surface backend `error` events and transport failures inline with actionable messaging. |
| G3 | Add lightweight console/UX telemetry so devs can correlate UI with backend events. |
| Non-goals | Redesigning the entire council UI (handled by separate BYOK/UI plan); backend deliberation flow stays unchanged. |

## 3. Tasks
1. **State Model Refactor**
   - Introduce `runStatus` (`idle/running/completed/failed`), track timestamps, keep `streamEvents` in memory after completion.
   - Render progress + log whenever `runStatus !== 'idle'`; add “Last run” metadata.
2. **Error Surfacing**
   - On SSE payload `{ type: 'error' }`, pin message in a red alert near the log, set `runStatus = 'failed'`, keep prior events visible.
   - Distinguish transport errors (fetch rejects) vs backend error events so users know whether the run billed.
3. **Telemetry + UX Polish**
   - Console log lifecycle hooks (`start`, `stage`, `error`, `done`).
   - Add optional toast/banner when fetch rejects, referencing BYOK if applicable.
4. **Docs & Changelog**
   - Update `CHANGELOG.md` top entry.
   - Brief note in `docs/2026-01-02-llm-council-ui-redesign-plan.md` linking this stabilization work.

## 4. Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Long-lived logs increase memory usage | Cap stored events per run (e.g., 500) and truncate older entries. |
| Users confused by stale data when returning later | Show explicit banner with timestamp + “Start new assessment” button to reset. |

## 5. Definition of Done
- Event log + stage indicators remain visible after success or failure, with status badge and timestamp.
- Error events render inline and in console with actionable copy.
- Browser console clearly shows start/stop lifecycle.
- Documentation + changelog updated.
