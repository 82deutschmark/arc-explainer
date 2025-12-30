# 2025-11-29 Poetiq Solver Progress MVP Plan

## Goal
Provide clearer, human-readable progress feedback while any solver (including Poetiq) is running, using the existing streaming pipeline, without waiting for the full "Comprehensive Solver Transparency UI Plan".

This MVP is a **Phase 1 subset** of:
- `docs/29112025-solver-transparency-ui-plan.md` (Comprehensive Solver Transparency UI Plan)

We aim to:
- Surface simple phases and status messages while the AI is working.
- Avoid new backend protocols or complex timelines in this first step.

---

## Scope (MVP)

- **Frontend only** changes, reusing existing streaming data:
  - `client/src/hooks/useAnalysisResults.ts`
  - `client/src/components/puzzle/StreamingAnalysisPanel.tsx`
- **No new backend endpoints**.
- **No new WebSocket layer** beyond what already exists.

Out of scope for this MVP (but covered by the comprehensive plan):
- Full iteration timelines per expert.
- Per-example grid diff visualizations.
- Rich token/cost dashboards.

---

## User Experience (MVP)

### A. Simple progress phases

Show a compact, always-visible checklist or line of phases for solver runs, for example:

1. Preparing puzzle
2. Asking the AI for a strategy
3. Generating Python/code
4. Testing code on training examples
5. Choosing the best attempt
6. Preparing your final answer

Rules:
- Highlight the **current** phase.
- Grey out future phases.
- Mark completed phases with a subtle success style.

### B. Live status sentence while waiting

Under the phases, show a short, plain-English line that updates as we receive status from the backend, e.g.:
- "Analyzing training example 2 of 3…"
- "Testing candidate program 3…"
- "Wrapping up and saving the result…"

If we do not recognize a phase, fall back to the raw `message` string.

### C. Friendly completion and error messages

When the run finishes:
- If success: show a brief summary, such as "Solver finished after N iterations".
- If partial/unknown: "Solver finished, but we could not verify every test case."
- If error: show a short, non-technical explanation derived from the error message.

---

## Technical Approach (MVP)

### 1. Extend streaming state in `useAnalysisResults`

- Add lightweight in-memory tracking for recent status updates coming from `useAnalysisStreaming.onStatus`:
  - `streamingPhaseHistory`: ordered list of `{ phase, message, ts }`.
- Each time we receive a `status` object with `phase` or `message`, append/merge into this history.
- Reset this history when a new analysis run starts.

This history is **not** persisted anywhere; it is only for live UI.

### 2. Derive user-facing phases

Inside `useAnalysisResults` or a small helper:

- Maintain a static lookup from internal `phase` strings to user phrases and to a coarse "bucket" (e.g. `prepare`, `llm`, `code`, `test`, `finalize`).
- From `streamingPhaseHistory`, derive a simple ordered list of these buckets, marking them as:
  - `completed` if we have already seen that bucket.
  - `current` if it matches the most recent one.
  - `upcoming` otherwise.

When no phase is available yet, default to a generic "Starting" state.

### 3. Update `StreamingAnalysisPanel` layout

Without changing existing behavior or removing any information:

- Add a small **"Solver Progress"** header area above the existing "Final Reply" block:
  - Shows the phase checklist described above.
  - Shows the most recent user-facing status sentence.
- Keep the existing raw streaming text, reasoning, and JSON sections exactly as they are for power users.

We will ensure:
- When there is **no** streaming data (older models or non-streaming flows), the panel gracefully falls back to current behavior.
- Styling matches the existing blue-themed streaming card.

### 4. Backward compatibility

- If a solver does **not** send detailed phases, the UI still works:
  - Only generic phases appear.
  - Status sentence uses whatever `message` text is available.
- No changes to API contracts or database schemas.

---

## Implementation Tasks

1. **Hook status history**
   - Extend `useAnalysisResults` with a small `streamingPhaseHistory` state and helpers.
2. **Phase mapping helper**
   - Add a mapping function that turns internal `phase` strings into user-facing phase steps.
3. **Panel UI update**
   - Update `StreamingAnalysisPanel` to render the phase checklist and status sentence using the new state, while preserving existing sections.
4. **Testing**
   - Run at least one normal puzzle analysis with Poetiq and one with a non-Poetiq model.
   - Confirm:
     - Phases update in real time.
     - The panel does not break when phases/messages are missing.
5. **Documentation**
   - Reference this MVP plan and the comprehensive plan in `CHANGELOG.md` when committing the feature.

---

## Relationship to the Comprehensive Plan

- This MVP intentionally **borrows language and structure** from `docs/29112025-solver-transparency-ui-plan.md`, but keeps implementation surface area small.
- Once this MVP is stable, we can extend it toward the full plan by:
  - Introducing `SolverSessionState` / `SolverIterationState` types shared across backend and frontend.
  - Adding per-iteration accordions, per-example diffs, and token/cost widgets.
  - Hooking into richer Poetiq WebSocket events where available.
