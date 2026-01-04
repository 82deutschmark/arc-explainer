# 2026-01-02 – LLM Council Non-Streaming Execution Plan

**Author:** Cascade (ChatGPT)  
**Status:** Approved  
**Scope:** Remove SSE plumbing from the Council UI and run assessments via the blocking `/api/council/assess` endpoint while keeping results visible.

---

## 1. Objectives
1. **Disable SSE in LLMCouncil UI** – switch the page to a single request/response model and drop streaming-only controls.
2. **Preserve run evidence** – keep the last completed result (and timestamp) visible even while a new run is in flight.
3. **Surface failures** – promote request errors to inline alerts so paid runs never "disappear" silently.
4. **Documentation & Release Notes** – update `CHANGELOG.md` and reference materials to reflect the non-stream behavior.

## 2. Tasks
1. **UI State Refactor**
   - Replace `isStreaming` + SSE buffers with `runStatus`, `runError`, and `lastRunAt`.
   - Update `handleStartAssessment` to POST `/api/council/assess` (non-stream).
   - Keep previous assessment visible until a new one completes.
2. **UX Updates**
   - Replace progress/event log with a simple in-progress card and error alert.
   - Show "Last completed" metadata next to the result header.
3. **Docs & Changelog**
   - Document the removal of SSE for council UI in `CHANGELOG.md`.
   - Cross-link this plan from other council plans as needed.

## 3. Acceptance Criteria
- Start button triggers exactly one POST call and no SSE reader logic remains.
- While running, the UI shows a spinner notice; after completion, results stay rendered with timestamp.
- Errors render inline and do not clear prior results.
- CHANGELOG entry describes the behavioral change (SemVer bump).
