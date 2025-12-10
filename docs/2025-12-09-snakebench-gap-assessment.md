# 2025-12-09 - SnakeBench gap assessment

Quick sweep of the repo to capture what was attempted for SnakeBench, what broke, and what is still missing.

## Prior attempts (what we tried and issues hit)
- Tracked submodule + initial plan: `external/SnakeBench` was added and plans published (`docs/plans/2025-12-02-snakebench-integration-plan.md`, `docs/2025-12-09-snakebench-integration-plan.md`), but most checklist items remain unchecked.
- Backend wiring: single-match runner + service/controller/routes shipped (`server/python/snakebench_runner.py`, `server/services/snakeBenchService.ts`, `server/controllers/snakeBenchController.ts`, `server/routes.ts`) per CHANGELOG v5.35.9/v5.35.11, yet no validation that these actually run end-to-end.
- Frontend embed/config: SnakeArena iframe was first env-driven via `VITE_SNAKEBENCH_URL` but the env line was broken (`.env` concatenated onto `XAI_API_KEY` per CHANGELOG v5.35.35), so it was later hard-coded to https://snakebench.com (v5.35.36). The failed env wiring means staging/local URLs still cannot be targeted from the UI.
- Developer guide drift: `docs/reference/architecture/DEVELOPER_GUIDE.md` claims SnakeBench uses `pythonBridge.ts`, but the implementation still spawns Python directly with bespoke logic.

## Current state (observed in code)
- Node service runs a blocking `child_process.spawn` against `server/python/snakebench_runner.py` with no timeout/backoff and only minimal input clamping; health checks just assert file/python presence.
- Python runner imports `run_simulation` from `external/SnakeBench/backend/main.py`, builds lightweight player configs, and writes a single replay JSON if the backend code succeeds; it does not create any index files.
- `listGames`/`getGame` in `server/services/snakeBenchService.ts` expect `external/SnakeBench/backend/completed_games/game_index.json`, but neither the runner nor `run_simulation` produce that file, so these endpoints return empty/missing data.
- Frontend page `client/src/pages/SnakeArena.tsx` hard-codes the iframe URL and keeps minimal controls that call our own `/api/snakebench/*` endpoints; navigation link is also hard-coded to snakebench.com (`client/src/components/layout/AppNavigation.tsx`).
- Dockerfile ensures the SnakeBench backend is cloned/installed for containers, but there is no equivalent local bootstrap script or verification that OpenRouter/LLM keys are present.

## Gaps and missing pieces
- No replay indexing: without writing `game_index.json` (or an equivalent generator), `listGames`/`getGame` effectively never surface results. We need an index writer after each run or a DB/source-of-truth query.
- Dependency/env readiness is undocumented: local contributors have no documented step to install `external/SnakeBench/backend/requirements.txt` or set required LLM keys; health checks never verify these, so runs will fail silently at runtime.
- Model mapping/validation absent: the service accepts arbitrary `modelA`/`modelB` strings and ignores SnakeBench `model_list.yaml` as well as our own `server/config/models.ts`, so requests can dispatch unknown models without error and cost tracking is impossible.
- Process/observability gaps: the bespoke spawn path omits the shared `pythonBridge` patterns (timeouts, stdout/stderr streaming, key forwarding), so hung Python processes or stderr output are not surfaced and cannot be cancelled safely.
- Batch + persistence gaps: `runBatch` just loops `runMatch` sequentially, there is no Celery/Redis path, no DB/repository for storing results, and no leaderboard/metrics endpoints - blocking any real analytics UI.
- Frontend configurability gap: iframe URL is hard-coded, so staging/local SnakeBench UIs cannot be targeted; the earlier env-based approach failed due to config bugs and was never replaced with a safer default+warning flow.
- Storage longevity: completed games live only on local/container filesystems (`external/SnakeBench/backend/completed_games`) with no persistence volume or export to PostgreSQL/Supabase, so results vanish on redeploys.
