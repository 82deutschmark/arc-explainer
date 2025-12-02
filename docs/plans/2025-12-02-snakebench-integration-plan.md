# 2025-12-02 – SnakeBench Integration Plan (A, B, C)

## 1. Goals

We want to treat `external/SnakeBench` as a first-class capability inside ARC Explainer, in three ways:

- **A. Standalone usage for developers**
  - Make it easy for a developer to pull the repo, install SnakeBench dependencies, and run local simulations and Elo tracking entirely from the CLI.
- **B. Backend-triggered benchmarks**
  - Allow ARC Explainer’s Node backend to trigger SnakeBench runs (single matches and batches), then expose summary data through our existing API + metrics stack.
- **C. UI embedding**
  - Add a “Snake Arena” experience to the React frontend that shows leaderboards and recent matches, powered by the backend integration (B), without re-hosting SnakeBench’s full Next.js frontend.

This plan keeps SnakeBench’s game engine and evaluation logic intact while integrating only the pieces we need.

---

## 2. Existing Building Blocks

### 2.1. In this repo (ARC Explainer)

- **Mono-repo layout**
  - `server/` – Node backend, REST API, SSE, DB, and repositories.
  - `client/` – React frontend using shadcn/ui.
  - `shared/` – Shared TypeScript types.
  - `solver/`, `poetiq-solver/`, `beetreeARC/` – Python-heavy solvers and wrappers.
  - `external/SnakeBench/` – Git submodule pointing to VoynichLabs SnakeBench.

- **Patterns we should reuse**
  - Python integration via small wrappers and Node `child_process` (see Poetiq, Beetree, Grover).
  - Repository pattern in `server/repositories/` for persisting and aggregating metrics.
  - Public REST endpoints (no auth) under `server/controllers/` + `server/routes.ts`.
  - Frontend pages under `client/src/pages/` with shadcn components.

### 2.2. In SnakeBench (submodule)

- **Backend (Python)** – `external/SnakeBench/backend/`
  - `main.py` – runs single games between specified models.
  - `tasks.py`, `celery_app.py` – Celery+Redis integration for scalable runs.
  - `players/`, `domain/`, `placement_system.py` – core game + player abstractions.
  - `llm_providers.py`, `model_lists/model_list.yaml` – LLM provider logic and model catalog.
  - `completed_games/` – JSON history of finished games.
  - `cli/` – utilities like `dispatch_games.py`, `evaluate_models.py`, `generate_matchups.py`, etc.
  - `requirements.txt` – full dependency list for the backend.

- **Frontend (Next.js)** – `external/SnakeBench/frontend/`
  - Not planned for direct reuse; we will re-implement a thinner dashboard in our React app.

---

## 3. Phase A – Standalone Developer Usage

**Goal:** Any ARC Explainer developer can run SnakeBench locally, independent of our Node backend.

### 3.1. Environment & dependencies

1. **Submodule initialization**
   - Ensure docs clearly say to run:
     - `git submodule update --init --recursive`
   - Confirm `external/SnakeBench/backend/` is present.

2. **Python environment**
   - Document use of a dedicated venv for SnakeBench:
     - `cd external/SnakeBench/backend`
     - `python -m venv .venv`
     - `source .venv/bin/activate` (or Windows equivalent)
     - `pip install -r requirements.txt`

3. **Environment variables & models**
   - `.env` in `external/SnakeBench/backend/` (or `.env.local`) with:
     - OpenAI / Anthropic / other keys as needed.
   - Update `backend/model_lists/model_list.yaml` with:
     - Model names that correspond to the ARC Explainer model catalog where possible.

### 3.2. Core CLI workflows

1. **Single match**
   - Example command (Linux/macOS/WSL):
     - `python main.py --models gpt-4o-mini-2024-07-18 claude-3-haiku-20240307`
   - Plan:
     - Add a short how-to section to this plan and/or a dedicated doc under `docs/` referencing the exact commands.

2. **Batch matches via Celery**
   - Commands (summarized):
     - Start Redis.
     - `celery -A celery_app worker --loglevel=info`.
     - `python cli/dispatch_games.py --model_a ... --model_b ... --count N --monitor`.
   - Plan:
     - Provide step-by-step instructions for dev-only usage, clearly marking Celery/Redis as **optional** and not auto-started by ARC Explainer.

3. **Elo tracker & reports**
   - `python elo_tracker.py completed_games --output completed_games`.
   - Plan:
     - Include an example end-to-end workflow: run N games → compute Elo → inspect JSON/CSV outputs.

### 3.3. Developer docs

- Add a short section to this plan (or a sibling doc) explaining:
  - When to use SnakeBench (e.g., comparing ARC solver models between providers).
  - Where game outputs live (`external/SnakeBench/backend/completed_games/`).
  - How this relates conceptually to our ARC Explainer model catalog and metrics.

---

## 4. Phase B – Backend Integration (Trigger Benchmarks via API)

**Goal:** Expose slim, public, zero-auth endpoints in ARC Explainer that orchestrate SnakeBench runs and surface results.

### 4.1. High-level architecture

- **Process model**
  - ARC Explainer’s Node backend remains the orchestrator.
  - For now, **no internal Flask/Celery web server** from SnakeBench is embedded into our Node backend.
  - Instead, we:
    - Use `child_process` to invoke Python entrypoints in `external/SnakeBench/backend/`.
    - Read JSON outputs from `completed_games/`.

- **Config mapping**
  - Introduce a translation layer between:
    - ARC Explainer’s `server/config/models.ts` model IDs.
    - SnakeBench `model_lists/model_list.yaml` entries.
  - Plan:
    - Create a dedicated config mapping file or table (e.g., `SnakeBenchModelMapping`) to avoid duplicating model names.

### 4.2. Proposed backend components

1. **Service layer (Node)**
   - New file: `server/services/snakeBenchService.ts` (name tentative), responsibilities:
     - Validate requested models and game parameters.
     - Map ARC model keys → SnakeBench model names.
     - Spawn Python processes (single game or batch) in `external/SnakeBench/backend/` via `child_process.spawn`.
     - Monitor exit codes and capture stdout/stderr for logging.
     - Resolve the path to the generated game JSON files in `completed_games/`.
     - Summarize game results (winner, scores, duration, apples, etc.) into a compact TypeScript shape.

2. **Controller + routes (Node)**
   - New controller: `server/controllers/snakeBenchController.ts`.
   - Extend `server/routes.ts` with new public endpoints, for example:
     - `POST /api/snakebench/run-match`
       - Body: `{ modelAId, modelBId, width?, height?, maxRounds?, numApples? }`.
       - Behavior: run a single game via Python, wait for completion, return a summary + gameId.
     - `POST /api/snakebench/run-batch`
       - Body: `{ modelAId, modelBId, count, params? }`.
       - Behavior: call `dispatch_games.py` for a bounded batch, return a batchId and initial status.
     - `GET /api/snakebench/games`
       - Query: filters (model, date range, limit).
       - Behavior: scan `completed_games/` (or DB) and return summarized recent games.
     - `GET /api/snakebench/games/:gameId`
       - Return full JSON for a specific game for replay.
   - **Important:** No auth middleware; endpoints remain public to match ARC Explainer rules.

3. **Metrics persistence**
   - Leverage existing repository patterns (e.g., `MetricsRepository`) to optionally store:
     - Per-game outcomes and stats.
     - Per-model aggregate metrics (wins, losses, Elo where applicable).
   - Plan:
     - Add a minimal SnakeBench-friendly schema extension (tables or JSONB fields) with Drizzle migrations.
     - Keep it small: enough to power leaderboards and trend charts.

### 4.3. Python-side contracts

- We will treat SnakeBench as an **implementation detail** behind small wrapper scripts:
  - Option 1: Direct calls to `main.py` and `cli/dispatch_games.py` with well-defined CLI flags.
  - Option 2: Our own light wrapper Python script in this repo (e.g., `server/python/snakebench_runner.py`) that:
    - Imports SnakeBench modules from `external/SnakeBench/backend`.
    - Provides a controlled, stable CLI/JSON interface for Node.

- Plan:
  - Start with **Option 1** (simple CLI) for single games.
  - Introduce a wrapper script later if we need more control over logging or concurrency.

### 4.4. Error handling & observability

- Log Python stderr into our existing logging pipeline.
- Time-box Python invocations (child process timeouts) to avoid hanging requests.
- Return structured error objects on failure, but never expose raw stack traces to clients.
- Optionally expose a simple health endpoint:
  - `GET /api/snakebench/health` – checks presence of submodule, Python, and basic config.

---

## 5. Phase C – Frontend “Snake Arena” UI

**Goal:** Provide a clean, shadcn-based React UI in ARC Explainer that surfaces SnakeBench data while relying on our new backend endpoints.

### 5.1. Page structure

- New top-level page: `client/src/pages/SnakeArena.tsx` (name tentative).
- Navigation integration:
  - Add a button or link from relevant places (e.g., main navigation, model tools section).

- Layout sections:
  - **Controls bar**
    - Model A / Model B selectors (backed by our existing model catalog, filtered to those defined in SnakeBench mapping).
    - Game parameters: width, height, apples, max rounds (with sensible defaults).
    - “Run single match” and “Run batch” buttons.
  - **Leaderboard panel**
    - Table of models with Elo, win/loss/tie counts, apples eaten, games played.
  - **Recent matches panel**
    - List of recent games with model names, result, date, and quick stats.
  - **Replay panel**
    - Minimal reproduction of SnakeBench’s ASCII replay idea:
      - Render board frames as fixed-width text or colored grid.
      - Allow the user to scrub through turns (play/pause, next/prev).

### 5.2. Data flow (frontend)

- Hook(s) in `client/src/hooks/` (e.g., `useSnakeArena`):
  - Fetch models that are eligible for SnakeBench.
  - Call `POST /api/snakebench/run-match` and poll or wait for completion.
  - Poll `GET /api/snakebench/games` for latest matches and leaderboard summaries.

- Types:
  - Extend `shared/types.ts` with:
    - `SnakeBenchGameSummary`, `SnakeBenchLeaderboardEntry`, etc.

### 5.3. UI components

- Prefer shadcn primitives (`Card`, `Table`, `Button`, `Badge`, `Tabs`, `Alert`).
- Components likely needed:
  - `SnakeArenaControls` – model selection + run buttons.
  - `SnakeArenaLeaderboard` – leaderboard view.
  - `SnakeArenaRecentMatches` – list of recent games.
  - `SnakeArenaReplay` – visualizer for one game.
- Keep styling consistent with other analysis/solver dashboards.

---

## 6. Phase D – Configuration & Ops

### 6.1. Docker & deployment

- Update `Dockerfile` to:
  - Ensure `external/SnakeBench/backend` is copied into the image.
  - Install `backend/requirements.txt` (ideally into the same Python env we already use).
- Decisions to make (documented in this plan):
  - Whether to ship Redis/Celery in the same container (probably **no** initially).
  - For now, support single-game and small batch runs only via direct Python calls.

### 6.2. Environment variables

- Centralize configuration in our `.env` and pass through to SnakeBench where possible:
  - Shared LLM provider keys.
  - Optional Supabase/Postgres URLs and keys if we ever integrate SnakeBench’s DB layer.

### 6.3. Safety & limits

- Add simple safeguards in the Node service:
  - Max `count` per `run-batch` (e.g., 50 or 100).
   - Optional soft concurrency limit.
   - Max board sizes and round counts.

---

## 7. Milestones & Implementation Order

1. **Milestone 1 – Docs & local usage (A)**
   - Finalize this plan and add a short "Using SnakeBench Locally" section to project docs.
   - Verify submodule + requirements install + a single test game.

2. **Milestone 2 – Minimal backend integration (B, single games)**
   - Implement `snakeBenchService` with a single `runMatch` function wired to `main.py`.
   - Add `POST /api/snakebench/run-match` endpoint.
   - Define shared types for match result summaries.

3. **Milestone 3 – Basic frontend Snake Arena (C)**
   - Build `SnakeArena` page with controls + “latest results” table.
   - Hook up to `run-match` and display returned summaries.

4. **Milestone 4 – Batch runs & simple leaderboard (B+C)**
   - Implement `runBatch` via CLI or a small Python wrapper.
   - Add endpoints for listing games and leaderboard summaries.
   - Extend UI to show leaderboards and recent matches.

5. **Milestone 5 – Docker & polish (D)**
   - Update Dockerfile to include SnakeBench backend dependencies.
   - Add basic health checks and limits.
   - Tighten docs and ensure everything works end-to-end in the container.

This plan intentionally starts with minimal, observable integrations (single matches) and grows toward richer dashboards and batch evaluations once the core plumbing is verified.
