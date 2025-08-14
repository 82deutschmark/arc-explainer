# WebUI Implementation Plan for saturn-arc

Author: Cascade with GPT-5 (medium reasoning model)

Purpose: This plan outlines how we will add a simple, effective Web UI to operate the existing ARC-AGI visual solver without disrupting core code. It focuses on usability, observability, saving and exporting results, and persisting them in a database.


## Goals

- Make it easy to run a single task or a batch from the browser.
- Visualize inputs, outputs, predictions, and intermediate images produced in `img_tmp/`.
- Persist run metadata and artifacts in a local database (SQLite first, optional Postgres later).
- Export runs (ZIP with JSON metadata + images) and aggregated CSV summaries.
- Keep the core solver unchanged; integrate via a thin backend wrapper.
- Windows-friendly install and run experience; no heavy FE toolchain required for v1.


## Scope (Phased)

- Phase 1 (MVP): Single-task run UI, run history, run detail view, export one run as ZIP/JSON, CSV of runs, SQLite persistence, env-based API keys.
- Phase 2: Batch runs (parallel workers), dataset/task picker with filters, bulk export, simple compare view (predicted vs actual), cancellation if queued.
- Phase 3: Observability & UX: live logs/streaming status, thumbnails for images, filtering by status/success, tagging, notes, and cost controls (concurrency limit, rate limit, optional cost capture).
- Phase 4: Packaging: one command to launch web app on Windows, optional Docker, optional Postgres.


## Architecture Overview

- Backend: Python web service (FastAPI) to:
  - Invoke `ARCVisualSolver` from `arc_visual_solver.py` in background workers.
  - Manage a lightweight in-process job queue (ThreadPoolExecutor) for runs.
  - Persist runs and artifacts metadata in SQLite via SQLAlchemy.
  - Serve a simple server-rendered UI (Jinja2 templates) for ease of installation.
  - Provide JSON REST endpoints for programmatic use and future SPA.
- Frontend: Server-rendered HTML (Jinja2) + light interactivity (htmx/Alpine.js) for MVP. No Node build step for v1.
- Storage:
  - Images: continue using `img_tmp/` (already used by solver) with predictable names that include `task_name` and labels.
  - DB: `webui_data/app.db` (SQLite). Migrate to Postgres later if needed.
  - Exports: `webui_data/exports/` for ZIP/CSV.
- Configuration: `.env` for secrets and settings (e.g., `OPENAI_API_KEY`, concurrency limit, dataset root).


## Integration Points (existing code)

- `arc_visual_solver.py` → class `ARCVisualSolver`:
  - We will import and call `ARCVisualSolver().solve(<task_json>)` inside a worker.
  - It already saves intermediate and final images in `img_tmp/` and returns `(success, prediction, num_phases)`.
- `run_batch.py`:
  - Reuse its dataset discovery logic (e.g., list of JSON files in `ARC-AGI-2/data/<dataset>/`).
  - For batch execution, replicate selection logic in the web backend rather than shelling out.
- `arc_visualizer.py`/`arc_stdin_visualizer.py`:
  - No changes needed; optional use for generating artifacts if we add advanced compare tools.


## Core Features & Pages (v1)

- Dashboard
  - List recent runs with status, task name, dataset, success flag, duration, phases.
  - Filters: status (queued/running/success/fail), dataset, task name search.
- New Run
  - Dataset picker: training/evaluation.
  - Task picker: list available `.json` tasks.
  - Options: cell size (read-only for v1), concurrency cap (global), run notes.
- Run Detail
  - Status, timestamps, duration, success, phases, logs (tail), response summary.
  - Images: thumbnails linking to full-size images in `img_tmp/` (train*, test_input, test_output if present, prediction).
  - Actions: export this run (ZIP), download metadata JSON, copy paths.
- Exports
  - Download CSV summary of runs (id, dataset, task, status, success, time, phases, prediction dims, image paths).
  - Bulk export selection as ZIPs.


## REST API (v1)

- GET /api/datasets → { datasets: ["training", "evaluation"] }
- GET /api/tasks?dataset=training → [{ name, path }]
- POST /api/runs → { dataset, task_name, task_path, notes } → { run_id }
- GET /api/runs → list with filters
- GET /api/runs/{id} → run metadata + status
- GET /api/runs/{id}/artifacts → list of artifact file paths and types
- POST /api/runs/{id}/export → produce ZIP, return path
- GET /api/exports/runs.csv → CSV of runs


## Data Model (SQLite via SQLAlchemy)

- Run
  - id (uuid)
  - created_at, started_at, finished_at
  - dataset (training/evaluation)
  - task_name, task_path
  - status (queued/running/success/fail)
  - success (bool)
  - duration_seconds (float)
  - phases (int)
  - prediction_rows (int), prediction_cols (int)
  - notes (text)
  - error_message (text)
- Artifact
  - id (uuid)
  - run_id (fk)
  - type (train_input, train_output, test_input, test_output, tool, final_prediction, other)
  - file_path (string)
  - label (string)
- Setting (optional for v2)
  - key, value (string) for toggles like concurrency, rate limiting


## Job Execution Model

- In-process queue using ThreadPoolExecutor with max workers from env (e.g., 2-4 for v1).
- Each job:
  - Validates task JSON path.
  - Creates a DB Run entry (status=running), timestamps start.
  - Calls `ARCVisualSolver().solve(path)`.
  - Parses return values, infers prediction dims, scans `img_tmp/` for files matching `task_name_*` created during the run, and records them as Artifacts.
  - Updates status/success/finished_at/duration.
  - Captures stdout to a log file per run (basic observability); stores a short summary in DB.


## Exports

- Single run export: ZIP containing:
  - run.json (all run metadata)
  - artifacts/ (copied images)
- CSV export: aggregate over selected runs or all runs.
- Paths are Windows-friendly; we avoid absolute paths in exported metadata where possible.


## UI/UX Notes

- Keep it simple and clean (Bootstrap or Pico.css).
- No heavy SPA build step for v1; templates + small JS for polling run status.
- Show warnings about cost/time before starting batch runs.


## Configuration & Security

- Read `OPENAI_API_KEY` from `.env` on server side only; never exposed to browser.
- `.env` may also include: `DATASET_ROOT=ARC-AGI-2/data`, `WEB_CONCURRENCY=2`, `APP_BASE_URL`, `DB_URL`.
- Optional auth (Phase 3+) if we later expose externally.


## Directory Additions (new)

- webui/
  - app/ (FastAPI app: routers, models, services, templates, static)
  - webui_data/ (SQLite DB, exports/)
  - scripts/ (Windows helper scripts to run the app)
  - requirements-webui.txt (web dependencies; core remains untouched)


## Delivery Plan & Milestones

- Phase 0: Project scaffolding (webui skeleton, requirements, basic home page that loads datasets and tasks) [~0.5 day]
- Phase 1: Single-task run end-to-end (submit → queue → run → persist → display artifacts → export ZIP/CSV) [~1.5 days]
- Phase 2: Batch runs + filters + bulk export [~1 day]
- Phase 3: Live logs/polling, thumbnails, simple comparison UX, notes/tags [~1 day]
- Phase 4: Windows packaging (command script), docs, optional Docker [~0.5 day]


## Acceptance Criteria (v1)

- User can select a dataset and task, start a run, and see its status update without a page refresh.
- Run detail page shows success/failure, duration, phases, and links to artifacts found in `img_tmp/`.
- DB contains a row per run and artifacts per image produced during the run.
- User can export a run (ZIP) and download CSV of all runs.
- No changes required to the existing solver files to achieve the above.


## Open Questions for Approval

- Database: OK to start with SQLite in `webui_data/app.db`? (We can add Postgres later.)
- UI Style: Prefer very simple Bootstrap look for now?
- Export formats: ZIP with JSON + images and a CSV summary sufficient for your workflow?
- Batch defaults: Safe default parallelism (e.g., 2 workers) to control cost/time?


## Risks & Mitigations

- API changes in OpenAI client: we isolate solver invocation in a service so updates are localized.
- Large image volumes in `img_tmp/`: we add periodic cleanup settings and reference integrity checks.
- Long-running runs: we cap concurrency, provide status polling, and consider cancellation in Phase 2.


## Next Step

- Upon approval, I will scaffold `webui/` with FastAPI + Jinja2, define the DB models, implement the run queue, and wire the MVP screens without touching existing solver code.
