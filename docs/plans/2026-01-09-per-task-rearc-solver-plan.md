# Per-task Chained RE-ARC Solver (GPT-5-mini)

**Author:** Cascade (ChatGPT)  
**Date:** 2026-01-09  
**Purpose:** Replace the batch-phased `rearc-gpt5mini-fast.ts` with a per-task streaming solver that fires attempt 2 immediately after each attempt 1 completes, surfaces live progress, and keeps checkpoints stable.

## Objectives
1. Launch attempt 1 for each `(taskId, testIndex)` with a small stagger to respect rate limits.
2. As soon as an attempt 1 result arrives, log it and trigger attempt 2 for the same tuple using its grids + conversation ID.
3. Persist incremental progress (submission grids + counts) so runs can resume after interruption.
4. Provide continuous, readable console feedback (dispatch, attempt 1 done, attempt 2 done/errors).

## Key Constraints & Assumptions
- Dataset: `2026RealRearc.json`; checkpoint path mirrors existing script (`rearc-gpt5mini-*`).
- Model: `gpt-5-nano` (unless user requests upgrade).
- Responses API: use `responses.create` or `responses.parse` with Zod enforcement identical to old script.
- No authentication gating on endpoints (per repo rules) but script talks directly to OpenAI so unaffected.
- Keep SRP by isolating queue/orchestrator logic from pure helpers (prompt builders, checkpoint IO).

## High-Level Approach
1. **Task queue build** – same sorted `(taskId, testIndex)` list.
2. **Orchestrator loop** – limit in-flight attempt 1 calls to configurable concurrency (default 4–6). Each result immediately schedules the paired attempt 2 promise.
3. **Progress logging** – log dispatch/done per attempt, include elapsed time + counts.
4. **Checkpointing** – throttle saves (e.g., every N completions or via timer) plus final write. Store conversation IDs for attempt 2 continuity.
5. **Submission output** – same structure as before, but include actual attempt order metadata in log file (not JSON) if needed.

## Implementation Tasks
1. **Scaffold new script** `scripts/solvers/rearc-gpt5mini-chained.ts` with config + types reused from fast version.
2. **Refactor solver helpers**
   - Reuse prompt builders; add header metadata.
   - Update `solveAttempt` to return timings + raw response metadata (conversation ID).
3. **Implement queue manager**
   - Use async generator or manual queue that feeds attempt 1 tasks respecting `MAX_IN_FLIGHT`.
   - On attempt 1 resolve: persist attempt 1 grids, update submission, enqueue attempt 2.
4. **Checkpoint/resume**
   - Extend checkpoint schema to store conversation IDs plus per-attempt completion flags.
   - On resume, skip finished attempt 1/2 pairs while preserving pending ones.
5. **Logging + CLI UX**
   - Live counters (attempt1 pending/in-flight/done, attempt2 queue).
   - Highlight errors immediately; keep summary at end.
6. **Testing/verification**
   - Dry-run on a single task subset flag (`--limit N`) to validate ordering.
   - Ensure checkpoint loads & saves as expected.

## Risks & Mitigations
| Risk | Mitigation |
| --- | --- |
| Rate limiting due to faster chaining | Provide `MAX_IN_FLIGHT` and `LAUNCH_DELAY_MS` configs. |
| Checkpoint bloat | Serialize minimal conversation IDs + grids only. |
| Process crash between attempt1 result and attempt2 dispatch | Immediately persist attempt1 grids before scheduling attempt2. Resume logic detects attempt2 missing and restarts. |

## Definition of Done
- New script committed with headers/comments per repo rules.
- Script tested on subset, shows per-task logs and immediate attempt 2 chaining.
- `CHANGELOG.md` top entry updated with SemVer + summary.
- Old script left untouched (for comparison) unless user asks for removal.

## Status
- ✅ Plan completed 2026-01-09 — implementation shipped via `scripts/solvers/rearc-gpt5mini-chained.ts`.
