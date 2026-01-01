# 2025-12-31 – RE-ARC Free Solver Reliability Plan

## Scope & Context
- **Script**: `scripts/solvers/rearc-free-solver.ts`
- **Goal**: Harden the free OpenRouter solver so long runs can resume, survive rate limits, and emit actionable telemetry.
- **Constraints**: Maintain existing solving behavior (model selection, concurrency defaults) while layering persistence and reporting. Follow project SRP/DRY and documentation requirements.

## Objectives
1. **Checkpoint persistence** – Periodically serialize progress (submission grids, queue state, retry metadata, failure stats) to a deterministic file path that can be reused between runs.
2. **Resume capability** – On startup, detect an existing checkpoint, validate dataset compatibility, and restore queues/submission progress.
3. **Rate-limit resilience** – Detect HTTP 429 / throttle signals, implement exponential backoff with jitter, and log suppression windows.
4. **Failure taxonomy** – Differentiate categories (rate limit, parsing, transport, other) and keep counters and sample traces.
5. **Comprehensive summary** – Emit end-of-run report covering totals, successes, retries, failures per category, checkpoint path, and submission artifact(s).

## Implementation Steps
1. **Checkpoint module**
   - Define checkpoint schema (metadata, submission, queues, stats, config snapshot, dataset hash) and helper load/save utilities.
   - Store under `rearc-free-checkpoint.json` (with timestamped backups) to allow reuse.
2. **Startup resume logic**
   - Accept optional `--resume` flag or automatic detection.
   - Validate checkpoint dataset hash and parameters; warn or exit if mismatched.
   - Restore `submission`, `workQueue`, `retryPool`, progress indices, and counters.
3. **Work queue & persistence refactor**
   - Track per-item status, attempt counts, and timestamps.
   - Persist after every N completions and before graceful exit (SIGINT handler?).
4. **Robust rate-limit detection/backoff**
   - Centralize API call wrapper that inspects error response codes/messages.
   - Maintain adaptive delay (base delay, exponential multiplier, random jitter) and log adjustments.
5. **Failure tracking & summary output**
   - Maintain counters per category with sample messages.
   - On completion, log totals: tasks solved, grids parsed, retries attempted, remaining failures, checkpoint + submission paths.
   - Include structured JSON summary (optional) for downstream tooling.

## Open Questions
- Should checkpoint include raw API responses for debugging? (Default: no, to keep files small.)
- Need CLI flag to force fresh run even if checkpoint exists? (Default assumption: `--fresh` boolean.)

## Risks & Mitigations
- **Corrupt checkpoints**: validate schema and keep rolling backups to avoid total loss.
- **Large checkpoint files**: prune stored data to only essentials (submission grids + queue pointers).
- **Extended pauses due to backoff**: cap max backoff and surface message so operator understands delay.
