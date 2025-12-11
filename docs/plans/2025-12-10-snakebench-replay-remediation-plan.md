# 2025-12-10 – SnakeBench Replay Remediation Plan

## Goal
Eliminate every lossy fallback in the SnakeBench pipeline so each match records full replay JSONs, exact costs, and full DB stats without truncation or minimal inserts, even under heavy parallel batch loads.

## Current Problems
- **Deadlocks during replay ingest**: `SnakeBenchRepository.recordMatchFromResult` does a long transaction (model upserts + game + participants + TrueSkill recompute). When `/api/snakebench/run-batch` fires dozens of matches, Postgres hits `deadlock detected`, so we abandon the replay ingest path.
- **Minimal insert fallback**: The current catch block falls back to a minimal `games` insert. That means no replay, no per-move data, no reliable totals, and the match is effectively lost for parity.
- **Cost truncation / zero pricing**: The Node→Python runner sets `pricing` to `0`, so older replays have $0 cost; we now have a fix-up script but it is post-facto and misses legacy model aliases.
- **Manual repair burden**: When fallbacks trigger, replays must be manually re-ingested or backfilled, which is not sustainable for Worm Arena tournaments.

## Non-Negotiable Requirements
1. **No data loss**: Every match must persist the full replay JSON and derived stats, even if retries are required.
2. **No silent fallback**: We should never permanently store a minimal insert. If the ingest fails, queue the replay and retry until success.
3. **Cost correctness**: All persisted data (DB + JSON) must include actual USD costs using real per-model pricing.
4. **Observability**: Operators must see when an ingest is waiting, retrying, or blocked so they can intervene.
5. **Backfill confidence**: Provide a deterministic process to repair existing partial games without re-running them.

## Proposed Remediation Plan
### Phase 1 – Stabilize Replay Ingest (Day 1)
- **Introduce an ingest job queue**: Instead of running the full DB transaction in the HTTP handler, enqueue `recordMatchFromResult` work (BullMQ or simple Node worker). Only one worker (or a safe small pool) processes jobs sequentially to avoid DB deadlocks.
- **Idempotent transactions**: Ensure each step (`snakebench_models`, `snakebench_games`, `snakebench_game_participants`, ratings) uses `INSERT ... ON CONFLICT ... DO UPDATE` with deterministic ordering to prevent lock inversions.
- **Retry with backoff**: On transient DB errors, retry the job N times before surfacing an alert. Minimal inserts are removed entirely.

### Phase 2 – Pricing + Cost Parity (Day 1-2)
- **Model alias map**: Extend `server/config/models.ts` (or add `server/config/modelPricingAliases.ts`) with every alias seen in the replay files (Meta-Llama flavors, Gemma names, etc.).
- **Runner pricing patch**: Update `server/python/snakebench_runner.py` to look up `MODELS` pricing before launching the python backend so each `LLMPlayer` receives real costs in real time.
- **Replay repair automation**: Enhance `scripts/recompute-snakebench-costs.ts` to log missing aliases to a structured file and rerun automatically once aliases are added.

### Phase 3 – Backfill & Verification (Day 2)
- **Queued backfill**: Build `server/scripts/snakebench-ingest-queue.ts` that reads existing completed replays and pushes them through the same queue so DB state is consistent.
- **Deadlock audit**: Add Postgres query logging or `pg_locks` inspection in `snakeBenchRepository` when retries exceed a threshold; surface metrics to logs/Grafana.
- **Validation script**: Create `scripts/verify-snakebench-ingest.ts` that checks every replay has matching DB rows (model totals, participant costs, metadata) and outputs diffs.

### Phase 4 – Operations Guardrails (Day 3)
- **Rate limiting**: Gate `/api/snakebench/run-batch` so we can’t spawn more concurrent jobs than the ingest queue can handle (configurable maximum in `snakeBenchService`).
- **Alerting**: When the queue backlog exceeds X or a job fails after retries, send a Slack/webhook alert.
- **Docs**: Update `docs/plans/2025-12-10-wormarena-snakebench-parity-plan.md` references and add runbook steps for clearing the queue or reprocessing failed jobs.

## Deliverables
- Queue-based ingest worker with retries and no minimal insert fallback.
- Pricing alias registry + patched runner for accurate costs at write time.
- Replay repair + verification scripts wired into the `snakebench:backfill` flow.
- Operational guardrails (rate limits + alerting).
- Changelog entry describing the remediation.
