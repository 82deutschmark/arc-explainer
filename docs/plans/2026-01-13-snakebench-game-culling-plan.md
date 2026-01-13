# 2026-01-13 SnakeBench Game Culling Plan

## 1. Objective & Motivation
- Remove low-quality SnakeBench games (very short runs, broken replays, crash-only matches) from downstream stats so ARC Explainer charts remain trustworthy.
- Keep historical data intact but mark unusable games with explicit reasons and timestamps so we can restore them if heuristics prove too strict.
- Integrate enforcement inside the SnakeBench submodule (ingestion/runtime + maintenance scripts) and ARC Explainer server (query filters + admin APIs) so every surface respects the same definition of "culled".

## 2. Current State Recap
1. **Ingestion pipeline** — `external/SnakeBench/backend/main.py` writes to `public.games` and `public.game_participants` through the repository layer (`data_access/game_persistence.py`, `GameRepository`). No notion of validity; every completed run is inserted.
2. **Arc server consumption** — repositories such as `server/repositories/GameReadRepository.ts` and `server/repositories/CurationRepository.ts` read from `public.games` for recent lists, stats tiles, model history, and greatest-hits leaderboards. Queries typically filter on `rounds > 0` but otherwise count everything.
3. **UI filtering hack** — `server/services/snakeBench/helpers/replayFilters.ts` rejects matches under 20 rounds *after* data leaves the DB, but underlying aggregates (total games, model records) are still polluted.
4. **Local analysis tooling** — `external/SnakeBench/backend/cli/analyze_local_games.py` (referenced in docs/memory) already computes per-game metrics (rounds, duration, apples, cost) that we can reuse for offline culling sweeps.

## 3. Requirements & Non-Requirements
- **Must** capture structured culling metadata (reason enum, detected_by, culled_at) so we can audit and optionally reverse decisions.
- **Must** support both *automatic* (ingestion-time heuristics) and *manual/offline* culling (script or admin action) without risking data deletion.
- **Must** keep replay files on disk; culling simply hides them from queries.
- **Should** expose culled counts in admin dashboards/logs for observability.
- **Won't** (in this iteration) build a full UI for editing heuristics; manual overrides can live in CLI + SQL for now.

## 4. Proposed Architecture Changes
### 4.1 Schema extensions (managed via ARC Explainer migrations)
- Add nullable columns to `public.games`:
  - `is_culled boolean default false`
  - `culled_reason text`
  - `culled_source text` (e.g., `auto_runtime`, `auto_offline`, `manual_admin`)
  - `culled_at timestamptz`
  - `error_flags jsonb` (structured array of detected issues: `{ code: 'ROUND_SHORT', details: {...} }`).
- Optional helper view `public.games_active` to encapsulate `WHERE is_culled = false` for legacy SQL consumers.
- Ensure Drizzle migration + raw SQL (SnakeBench repo depends directly on Postgres) are in sync; document in `docs/reference/frontend/DEV_ROUTES.md` appendices.

### 4.2 Runtime heuristics inside SnakeBench
- Introduce `backend/domain/game_filters.py` (or similar) with pure functions that evaluate a completed `SnakeGame` summary (rounds, deaths, max score, exception flags) and return `(should_cull, reasons, error_flags)`.
- Hook into `SnakeGame.run_round` / completion path to capture failure markers:
  - consecutive timeout deaths, malformed rationale, missing frames, cost of zero with no moves, etc.
- When `complete_game()` is invoked, pass the heuristic output through to `GameRepository.complete_game` so the DB row is updated atomically with `is_culled` metadata.
- Gate heuristics behind env thresholds (e.g., `SNAKEBENCH_MIN_ROUNDS=15`, `SNAKEBENCH_ALLOW_ERROR_CODES`). Defaults align with current UI filter (20 rounds) to avoid surprises.

### 4.3 Offline/retroactive culling tooling
- Extend `backend/cli/analyze_local_games.py` (or create `cli/cull_games.py`) to:
  1. Scan historical games using replay JSON + DB metadata.
  2. Apply the same heuristics module as runtime.
  3. Emit a CSV report + optional `--apply` flag to set `is_culled=true` for matching IDs.
- Provide `--reason` and `--uncull` switches for manual overrides.
- Schedule this via `backend/services/cron_service.py` (nightly) so fresh historical imports get re-evaluated until heuristics graduate into runtime path.

### 4.4 ARC Explainer server integration
- Update every repository query to add `is_culled = FALSE` conditions:
  - `GameReadRepository` (recent games, search, stats, model history).
  - `CurationRepository.getWormArenaGreatestHits` (include clause and highlight culled counts in logs).
  - Any other SQL touching `public.games` or `public.game_participants` should join against non-culled rows, ideally via shared helper (`snakebenchSqlHelpers.activeGamesWhereClause`).
- Ensure the service layer (`snakeBenchService.getWormArenaGreatestHits` etc.) and frontend hooks automatically inherit the cleaner datasets.
- Expose admin endpoints:
  - `GET /api/snakebench/culled` (paginated list with reasons + replay download link).
  - `POST /api/snakebench/culled/:gameId/restore` to flip the flag (with audit logging via `server/utils/logger.ts`).

### 4.5 Observability & docs
- Emit structured logs when a game is culled automatically (include thresholds hit, request IDs).
- Update `docs/reference/data/WormArena_GreatestHits...` and `docs/DEVELOPER_GUIDE.md` to describe the culling pipeline and CLI usage.
- Add CHANGELOG entry after implementation per repo policy.

## 5. Implementation Phases & Checklist
1. **Design final heuristics** — finalize thresholds + error codes with stakeholders; encode as constants in new SnakeBench module, add unit tests.
2. **Schema migration** — create `migrations/0004_add_game_culling_fields.sql` (Drizzle + raw SQL snippet for submodule docs). Verify `npm run db:push` adds columns without downtime.
3. **Repository plumbing** — extend `GameRepository.insert_game/complete_game` signatures to accept culling metadata and persist `error_flags`. Ensure older callers still work (provide defaults).
4. **Runtime hook** — integrate heuristics into `SnakeGame` completion; add env toggles + logging.
5. **Offline CLI** — build script + cron wiring for retroactive culling. Include dry-run mode and CSV output for review.
6. **API/query updates** — update Arc server repositories/services to filter out culled games and add admin endpoints.
7. **Docs & validation** — document usage, add regression tests (e.g., DB seed of culled game should not appear in `/worm-arena`), update plan + CHANGELOG when finished.

## 6. Open Questions / Risks
- Need confirmation on acceptable thresholds (round count vs. cost vs. duration). Provide a config file so ops can tweak without redeploying.
- Ensure downstream analytics (external notebooks, Supabase exports) know about the new column; consider view/backfill to avoid breaking csv consumers.
- Coordinate deployment order: schema migration must land before runtime code writes to new columns; otherwise provide feature flag.

## 7. Next Steps
- Await user approval on this plan.
- After approval, proceed with schema migration & heuristic module implementation, keeping CHANGELOG + docs in sync per AGENTS.md.
