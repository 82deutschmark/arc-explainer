# 2025-12-31 – OpenAI Responses Alignment & Chaining Plan

Author: Cascade (ChatGPT)  
Purpose: Close the gap between our OpenAI RE-ARC solver and the official ARC benchmarking pipeline, then extend it to use Responses API conversation chaining for attempt sequencing.

---

## 1. Goals
1. **Match official ARC prompt contract** – training/test grids must be emitted as JSON arrays (not space-separated text). Prompts should mirror `arc-agi-benchmarking` formatting down to section labels.
2. **Robust output parsing** – replace greedy “first match” regex with reverse JSON backscan so we always capture the final grid, even if the model includes commentary.
3. **Model parameter compliance** – remove unsupported `temperature` field for GPT‑5 models, rely on reasoning effort, and stop setting a manual `max_output_tokens` cap unless required for safety.
4. **Submission integrity** – keep per-task arrays of `{ attempt_1, attempt_2 }`, filling gaps deterministically (already implemented, but reaffirmed here).
5. **Attempt scheduling overhaul** – run **all attempt_1** calls first, persist their `response.id`, then launch attempt_2 **as chained follow-ups** (`previous_response_id`) after attempt_1 completes for that test.

---

## 2. Scope & Deliverables
| Phase | Deliverable | Notes |
| --- | --- | --- |
| 1 | Prompt/Parser Fixes | JSON prompt builder + backscan parser, unit-tested. |
| 2 | API Payload Compliance | Remove temperature, adjust token config, add guardrails for reasoning params. |
| 3 | Scheduler + Chaining | Work queue refactor: attempt_1 sweep, checkpoint state storing providerResponseId per test, second pass uses `previous_response_id`. |
| 4 | Documentation & Ops | Update CHANGELOG, README snippets, and add a short runbook describing new CLI flags / resume semantics. |

Out of scope: streaming UI changes, evaluation backend, non-OpenAI solvers.

---

## 3. Detailed Tasks
### Phase 1: Prompt / Parsing
1. Extract helper `formatGridJSON(grid: Grid): string` using `JSON.stringify`.
2. Rebuild `buildPrompt()` to follow the official structure:
   ```
   -- Example 0 --
   INPUT:
   [[...]]

   OUTPUT:
   [[...]]
   ```
   plus “Test Input:” + JSON grid.
3. Implement `extractLastJsonMatrix(text: string)` that scans from the end for the last valid `[[...]]`, tolerating whitespace and trailing punctuation. Unit tests with multi-response text.

### Phase 2: Payload Compliance
1. Remove `temperature` field entirely for GPT‑5 flavors; log a warning if a user tries to override it.
2. Drop hard `max_output_tokens` cap; rely on `reasoning.effort` and optional `text.verbosity`. Keep ability to set via CLI/env if we hit platform guardrails.
3. Ensure `input` payload matches Responses guide (already true) and add optional `response_parameters` stub for future sampling knobs if OpenAI exposes them.

### Phase 3: Attempt Scheduling & Chaining
1. **Queue strategy**: build work items for attempt_1 only; run them with existing concurrency/backoff.
2. Store each attempt_1’s `responseId` + raw text in checkpoint (`submissionMeta[taskId][testIdx]`). Required for `previous_response_id`.
3. After attempt_1 sweep completes (or as soon as per-test attempt_1 finishes), enqueue a second pass of attempt_2 tasks that reference the saved `responseId` and include a short instruction like “continue reasoning and produce an alternative output grid”.
4. Update checkpoints/resume logic to persist the new metadata and ensure attempt_2 jobs aren’t launched before attempt_1 success/fail is recorded.
5. Add CLI flag (`--no-chain`) to fall back to independent attempts if needed for debugging.

### Phase 4: Docs + Verification
1. Update `CHANGELOG.md` (top entry), referencing this plan.
2. Add a README snippet or `docs/reference/` note describing the new two-pass workflow and chaining behavior.
3. Provide run instructions: first-run resume semantics, how checkpoints capture response IDs, how to monitor chain progress.

---

## 4. Risks & Mitigations
| Risk | Impact | Mitigation |
| --- | --- | --- |
| OpenAI rejects chained calls without `store: true` | Attempt_2 fails immediately | Set `store: true`, persist `response.id`, and backoff on 409 errors. |
| Longer wall-clock due to serialized attempts | Slower throughput | Keep concurrency high for attempt_1 sweep; attempt_2 can reuse same concurrency once queued. |
| Checkpoint bloat storing raw reasoning | Large JSON files | Store only `responseId` + final grid text, not full reasoning deltas. |

---

## 5. Approval Checklist
- [ ] JSON prompt format confirmed.
- [ ] Backscan parser test cases defined.
- [ ] Chaining API call flow diagrammed (include `previous_response_id`).
- [ ] User approval on phased plan.
