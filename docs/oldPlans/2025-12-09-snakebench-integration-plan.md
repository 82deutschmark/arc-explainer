# 2025-12-09 – SnakeBench Integration Plan (Local + Railway)

## Goal

Turn the existing SnakeBench wiring (service + controller + Docker setup) into a fully reliable, reproducible feature:

- Works out of the box for **local development** on Windows/macOS/Linux.
- Works consistently in **Railway** using the existing Dockerfile.
- Exposes a clean **frontend experience** in `SnakeArena.tsx` that embeds the SnakeBench UI via `VITE_SNAKEBENCH_URL` and surfaces our own match summaries.
- Leaves room for **future analytics / DB integration** without over-engineering.

This plan reuses the same patterns already in production for Saturn, Beetree, and Poetiq Python integrations.

---

## Current State

### Backend & Python

- `server/services/snakeBenchService.ts`:
  - Spawns `server/python/snakebench_runner.py` as a one-shot subprocess.
  - Validates and clamps board parameters, parses a **single JSON line** from stdout.
  - Provides:
    - `runMatch(request)`
    - `runBatch(request)`
    - `listGames(limit)` (reads `external/SnakeBench/backend/completed_games/game_index.json`)
    - `getGame(gameId)` (reads the replay JSON)
    - `healthCheck()` (checks Python, runner script, and backend dir).
- `server/python/snakebench_runner.py`:
  - Reads JSON from stdin with `modelA`, `modelB`, board params.
  - Resolves `backend_dir = external/SnakeBench/backend` relative to repo root.
  - Imports `run_simulation` from `backend/main.py` and runs one game.
  - Writes a **compact JSON summary** (game id, scores, per-model results, completed game path).
- `external/SnakeBench`:
  - Present in this repo as a **git submodule** (`.gitmodules` path `external/SnakeBench`).
  - Dockerfile also has a **fallback shallow clone** from `https://github.com/VoynichLabs/SnakeBench` if the submodule is not present in the build context.

### HTTP API

- `server/controllers/snakeBenchController.ts` exposes:
  - `POST /api/snakebench/run-match`
  - `POST /api/snakebench/run-batch`
  - `GET  /api/snakebench/games`
  - `GET  /api/snakebench/games/:gameId`
  - `GET  /api/snakebench/health`
- These routes are **registered** in `server/routes.ts` (under "SnakeBench LLM Snake Arena routes").

### Frontend

- `client/src/hooks/useSnakeBench.ts`:
  - Thin wrappers around the `/api/snakebench/*` endpoints.
  - Handles match results and recent-games loading.
- `client/src/pages/SnakeArena.tsx`:
  - Uses `useModels` to list OpenRouter-backed models.
  - Uses `useSnakeBenchMatch` and `useSnakeBenchRecentGames` for our own backend.
  - Embeds the **external SnakeBench UI** in an `<iframe>` using a **hard-coded** URL:
    - `const SNAKEBENCH_URL = 'https://snakebench.com';`
  - Does **not** yet respect `VITE_SNAKEBENCH_URL`.

### Deployment / Docker

- `Dockerfile` already:
  - Installs **Python 3, git, and build deps** on top of `node:20-alpine`.
  - Installs shared Python deps from top-level `requirements.txt` (Saturn, Poetiq, Beetree).
  - Ensures **BeetreeARC** is present (submodule or shallow clone) and installs its `requirements.txt`.
  - Ensures **SnakeBench backend** is present:
    - If `external/SnakeBench/backend/main.py` is missing, it shallow-clones from GitHub into `external/SnakeBench`.
    - Verifies `external/SnakeBench/backend/main.py` and `requirements.txt` exist.
    - Installs `external/SnakeBench/backend/requirements.txt`.
  - Verifies internalized Poetiq solver files.
  - Builds the app and checks the Vite output.
- Railway, when configured to use this Dockerfile, automatically gets **Python + SnakeBench** inside the container.

---

## How Saturn & Poetiq Handle Python (Patterns to Reuse)

### Saturn / Beetree

- Use a central `pythonBridge` service to:
  - Spawn Python wrappers (`saturn_wrapper.py`, `beetree_wrapper.py`).
  - Stream **NDJSON events** over stdout (`start`, `progress`, `log`, `final`, `error`).
  - Enforce UTF-8 (`PYTHONIOENCODING`, `PYTHONUTF8`) and selectively forward API keys.
- Node-side services (`saturnService`, `saturnVisualService`) and streaming services (`saturnStreamService`) then:
  - Orchestrate multi-phase runs.
  - Broadcast events via SSE or WebSocket.
  - Persist final results to PostgreSQL via repositories and `explanationService`.

### Poetiq

- `poetiqService` uses **two paths**:
  - Direct Python wrapper: `poetiq_wrapper.py` spawned via `child_process.spawn` with utf-8 env and API keys.
  - OpenAI Agents path: `PoetiqAgentsRunner` uses the Agents SDK and a Python `poetiq_tool_runner.py` tool for sandboxed execution.
- `poetiqStreamService` sits on top and forwards Python/Agents events to the frontend via SSE.

### Key Patterns

We should **reuse** these ideas for SnakeBench where it makes sense:

- **Process management**:
  - Centralized helper (like `pythonBridge`) for shared spawning patterns and env handling.
- **UTF-8 and env hygiene**:
  - Explicit `PYTHONIOENCODING` / `PYTHONUTF8`, and clear handling of any required API keys.
- **Streaming and observability** (optional future step):
  - SSE events for long-running tasks.
  - Structured progress and error events.
- **DB persistence**:
  - Final results stored via repository layer, similar to Saturn/Poetiq, but in a **SnakeBench-specific** table to preserve domain separation.

For now, SnakeBench is intentionally simpler (one-shot spawn + single JSON output). That is fine for MVP; we only need to harden packaging and configuration.

---

## Plan – Local Development Setup

Goal: Any contributor can run SnakeBench locally with minimal steps, on Windows or Unix, using the existing Node dev server.

### 1. Ensure Submodule & Repo Layout

- Confirm submodules are initialized:
  - `git submodule update --init --recursive`
- Verify SnakeBench backend exists:
  - `external/SnakeBench/backend/main.py`
  - `external/SnakeBench/backend/requirements.txt`
- Keep using the existing submodule path (`external/SnakeBench`) and remote configured in `.gitmodules`.

### 2. Python Environment

- Require Python 3.x (same as for Saturn/Poetiq). Locally:
  - On Windows: `python --version` and set `PYTHON_BIN=python` if needed.
  - On macOS/Linux: `python3 --version` and optionally set `PYTHON_BIN=python3`.
- Document this in the main README / dev guide (link from this plan).

### 3. Install Python Dependencies Locally

- From the repo root:
  - Install shared ARC Explainer Python deps (Saturn/Poetiq/Beetree):
    - `pip install -r requirements.txt`
  - Install SnakeBench backend deps:
    - `pip install -r external/SnakeBench/backend/requirements.txt`
- Optional: Provide a short `scripts/setup-python.bat` / `.sh` that runs these commands and prints versions.

### 4. Verify SnakeBench Health Locally

- With the Node dev server running (`npm run dev` or equivalent):
  - Call `GET /api/snakebench/health` and confirm:
    - `pythonAvailable: true`
    - `backendDirExists: true`
    - `runnerExists: true`
    - `status: 'ok'` or `'degraded'` with a clear message.
- Run a smoke test match using `SnakeArena` or curl:
  - `POST /api/snakebench/run-match` with a small payload (two simple model ids).
  - Confirm a `gameId` and `scores/results` come back.
- Verify `completed_games` directory is being populated under `external/SnakeBench/backend` after a run.

### 5. Local Configuration for Embedded UI

- Introduce `VITE_SNAKEBENCH_URL` for local development:
  - In `client/.env.local`:
    - `VITE_SNAKEBENCH_URL=https://snakebench.com` (or a local SnakeBench instance if running separately).
- Update `SnakeArena.tsx` to:
  - Read `const url = import.meta.env.VITE_SNAKEBENCH_URL || SNAKEBENCH_URL_DEFAULT;`.
  - Keep a sensible default (e.g. `https://snakebench.com`) but surface a **small inline warning** if the env var is missing, so staging/prod can override cleanly.

---

## Plan – Railway / Docker Deployment

Goal: Ensure Railway deployments using the Dockerfile always have a working SnakeBench backend, without manual steps.

### 1. Use Docker-based Service on Railway

- Confirm the Railway app for ARC Explainer is configured to **build from the Dockerfile**, not from a bare Node buildpack.
- This guarantees:
  - Python is installed.
  - `external/SnakeBench` is either the submodule or a shallow clone.
  - SnakeBench requirements are installed via the existing Dockerfile steps.

### 2. Validate Build Logs for SnakeBench

- During the Railway build, validate we see:
  - `=== PREPARING SNAKEBENCH BACKEND ===`
  - Either "present in build context" or "cloning from GitHub" messages.
  - Success checks for `backend/main.py` and `backend/requirements.txt`.
  - "INSTALLING SNAKEBENCH BACKEND DEPENDENCIES" completing without errors.

If these steps ever fail, the container build should fail early rather than silently skipping SnakeBench.

### 3. Runtime Health Check

- Use the existing REST endpoint as a **Railway health indicator**:
  - `GET /api/snakebench/health`.
- Optionally, add a lightweight **Docker healthcheck** or Railway health probe that:
  - Hits `/api/health` (app-wide health).
  - Optionally, logs a warning if `/api/snakebench/health` is degraded.

### 4. Configure VITE_SNAKEBENCH_URL in Railway

- For each Railway environment (staging, prod):
  - Set `VITE_SNAKEBENCH_URL` in the **build-time env** for the client.
  - Example values:
    - Staging: the staging SnakeBench UI deployment (Next.js), or a shared public instance.
    - Production: the canonical public SnakeBench UI URL.
- Rebuild the client so the iframe in `SnakeArena` points at the correct URL in each environment.

### 5. File Storage Considerations

- By default, SnakeBench writes completed game JSON to `external/SnakeBench/backend/completed_games` inside the container filesystem.
- On Railway, this is ephemeral but acceptable for **small-scale, non-critical** usage.
- If long-term storage becomes important, future options include:
  - Mounting a persistent volume for `completed_games`.
  - Periodic export of game_index + selected replays into PostgreSQL or object storage.

---

## Plan – Config & UI Integration (VITE_SNAKEBENCH_URL)

Goal: Make the frontend behaviour predictable in all environments while staying simple.

1. **Introduce VITE_SNAKEBENCH_URL usage** in `SnakeArena.tsx`:
   - `const url = import.meta.env.VITE_SNAKEBENCH_URL ?? 'https://snakebench.com';`
2. **Optional UX guardrails**:
   - If `VITE_SNAKEBENCH_URL` is missing, show a small non-blocking notice (e.g. "Using default SnakeBench URL").
3. Keep existing match controls (model selectors + game settings) backed by our own `/api/snakebench/*` endpoints.
4. Document the env var in the main project docs and in Railway environment configuration notes.

---

## Plan – BYO API Keys (Poetiq-style)

Goal: Allow operators to run SnakeBench matches with per-request BYO LLM API keys, mirroring Poetiq, without ever storing keys in the database.

1. **Shared types**
   - Extend `SnakeBenchRunMatchRequest` and `SnakeBenchRunBatchRequest` in `shared/types.ts`:
     - Add optional `apiKey?: string;`
     - Add optional `provider?: 'openrouter' | 'openai' | 'anthropic' | 'xai' | 'gemini';`
   - These fields are per-request only and must never be logged or persisted.

2. **Controller layer**
   - In `snakeBenchController.runMatch` / `runBatch`:
     - Accept `apiKey` and `provider` in the request body.
     - Pass them through to `snakeBenchService` without logging their values.

3. **Service & Python environment**
   - In `snakeBenchService.runMatch` / `runBatch`:
     - When building the `env` for `spawn(...)`, follow the Poetiq BYO pattern:
       - Always set `PYTHONIOENCODING` and `PYTHONUTF8`.
       - If `provider` + `apiKey` are present, map to provider-specific env vars:
         - `openrouter` → `OPENROUTER_API_KEY`
         - `openai` → `OPENAI_API_KEY`
         - `anthropic` → `ANTHROPIC_API_KEY`
         - `xai` → `XAI_API_KEY`
         - `gemini` → `GEMINI_API_KEY`
       - Otherwise, fall back to server-level keys already present in `process.env`.
   - `snakebench_runner.py` and the SnakeBench backend pick these env vars up via their existing provider logic; no SnakeBench code changes are required.

4. **Frontend**
   - Extend `SnakeArena.tsx`:
     - Add optional BYO key input and provider selector.
     - Include `apiKey` + `provider` when calling `useSnakeBenchMatch` / `useSnakeBenchBatch`.
     - Keep keys only in page-local state; do not store them in localStorage or any database.

5. **Security & observability**
   - Log only provider and high-level status for BYO runs (no key material).
   - If we later persist SnakeBench matches in our own DB, optionally tag rows with a non-sensitive `key_source` field (e.g. `'server' | 'byo'`); see `docs/SNAKE_BENCH_DB.md` for the full SnakeBench DB schema.

---

## Future Plan – DB Compatibility & Light Analytics

Goal: Capture enough SnakeBench data locally to show simple, 
compatibility-focused summaries inside ARC Explainer, while keeping the
root SnakeBench project (Greg's deployment) as the canonical source of
leaderboards, Elo ratings, and rich analytics.

### Schema compatibility with root SnakeBench DB

- Treat `docs/SNAKE_BENCH_DB.md` as the **canonical schema contract**:
  - Implement `models`, `games`, and `game_participants` in
    `server/db/schema.ts` as a 1:1 Drizzle mapping of that document
    (column names, types, and indexes).
  - Keep enum-like text fields (e.g. `test_status`, `game_type`,
    `result`) semantically aligned with the upstream project so rows can
    be merged without translation.
- Identifiers and joins:
  - `models.model_slug` must match the slugs from SnakeBench's
    `model_list.yaml` and/or Greg's DB.
  - `games.id` must remain the canonical SnakeBench `game_id` string or
    UUID.
  - `game_participants.player_slot` must follow the same slot
    convention as SnakeBench (e.g. `0` / `1`).
- ARC Explainer-specific needs:
  - Prefer storing any ARC-only metadata in existing JSON fields
    (`metadata_json`, `current_state`) or in separate tables, rather
    than changing shared columns.
  - This keeps future dataset merges (our DB + Greg's DB) "apples to
    apples".

### Stage A – Minimal Match Logging (local)

- Add a small `SnakeBenchRepository` that uses the `models`, `games`,
  and `game_participants` tables from `docs/SNAKE_BENCH_DB.md`:
  - On successful `runMatch`, insert one `games` row and two
    `game_participants` rows (one per model).
  - Populate only fields we can compute cheaply from the existing
    JSON/runner output (scores, rounds, basic config, timestamps).
  - Leave sophisticated fields like long-term Elo fully compatible but
    **optionally populated** (e.g. via future backfill or import from
    Greg's dataset).
- Provide a simple **read-only** endpoint for "recent games" that
  reads from `games` + `game_participants` instead of or in addition to
  scanning JSON files.
- Ensure SnakeBench DB tables remain strictly separate from core ARC
  explanation tables.

### Stage B – Optional Local Summaries

- If needed, expose very lightweight summary endpoints backed by our
  local DB (not a full analytics stack):
  - A basic leaderboard-style list (top N models by games played or
    local win rate) for use on the SnakeArena page.
  - A "recent activity" snapshot (e.g. games played in the last N
    days) using simple SQL aggregates.
- Treat these endpoints as **nice-to-have**. The upstream SnakeBench
  deployment remains the canonical source for rich leaderboards,
  cross-experiment analytics, and production Elo.

### Stage C – Compatibility-Friendly Exports (Optional)

- If we add any export endpoints, they should:
  - Return raw or lightly summarized rows that match the
    `SNAKE_BENCH_DB` schema so they can be merged with Greg's data.
  - Remain public and unauthenticated (matching ARC Explainer norms).

All DB work in this repo is **compatibility-first**: it should make it
easy to merge or compare our local data with Greg's canonical
SnakeBench dataset, while avoiding a parallel analytics implementation.

---

## Checklist

- [x] Local: document Python requirements and submodule setup for SnakeBench.
- [x] Local: recommend `pip install -r external/SnakeBench/backend/requirements.txt` and add an optional helper script.
- [x] Frontend: introduce `VITE_SNAKEBENCH_URL` usage in `SnakeArena.tsx` with a reasonable default.
- [x] Backend: extend SnakeBench shared types, controller, and service to support BYO API keys (Poetiq-style).
- [x] Frontend: add BYO key + provider inputs to `SnakeArena` and wire them into SnakeBench requests.
- [x] Railway: confirm Docker-based deployment and verify SnakeBench preparation logs during build.
- [x] Railway: set `VITE_SNAKEBENCH_URL` per environment and rebuild the client.
- [x] Optional: add a small Railway health probe that surfaces `/api/snakebench/health` state.
- [x] Future: implement PostgreSQL tables for `models`, `games`, and `game_participants` exactly as defined in `docs/SNAKE_BENCH_DB.md` and add a small `SnakeBenchRepository` for minimal match logging. (COMPLETED: tables created in DatabaseSchema.initialize(); repository wired; matches log to DB; /api/snakebench/games prefers DB summaries with filesystem fallback.)
- [x] Future: add only lightweight local summary endpoints/UI; rely on Greg's SnakeBench deployment for canonical analytics and advanced leaderboards. (COMPLETED: added /api/snakebench/recent-activity and /api/snakebench/leaderboard endpoints; local summaries panel in SnakeArena showing activity and top models.)

This plan keeps the core feature small but robust: Python and SnakeBench are always available where Saturn/Poetiq already work, configuration is explicit, and deeper analytics can be layered on later without disrupting existing domains.
