<!--
Title: Saturn Visual Solver Testing Plan (2025-08-15)
Purpose: Defines a concrete, verifiable plan and checklist to validate and harden the Saturn visual solver across image handling, logging, persistence, and UI. Explains how this plan is used by the project to guide fixes and acceptance testing.
Author: Cascade (model: Cascade)
How this is used: Engineers follow this checklist to make and verify changes across `server/python/saturn_wrapper.py`, `server/services/pythonBridge.ts`, `server/services/saturnVisualService.ts`, `server/services/dbService.ts`, and frontend components/pages (e.g., `client/src/pages/SaturnVisualSolver.tsx`, `client/src/hooks/useSaturnProgress.ts`, and Saturn UI components). This document is the single source of truth for the work scope and done criteria.
-->

# Saturn Visual Solver — Hardening and Testing Plan (2025-08-15)

## Scope and Objectives
- Implement provider-specific handling for sending solver-generated images to AI models. Use the provider’s supported method (e.g., base64 data URLs for OpenAI). Do not silently fallback between methods; emit explicit errors on mismatch.
- Capture the solver’s verbose terminal output end-to-end (stdout and stderr), surface in the web UI, and persist to the database for later review.
- Confirm and, if needed, extend the database schema to support storing solver-generated PNG files (paths and optional binary), plus full verbose logs and event traces. Database is required; absence is a hard failure.
- Enhance the web app UX to indicate when a puzzle was solved by Saturn (🪐) with collapsible details and images; verify with task `9ddd00f0`.

## Current Behavior (verified from code)
- Image generation and streaming:
  - Python emits NDJSON events with base64 and file `path` for images (`server/python/saturn_wrapper.py`).
  - Node bridge parses NDJSON and forwards progress over WebSocket (`server/services/pythonBridge.ts`, `server/services/saturnVisualService.ts`).
  - Frontend accumulates streamed `images` into a gallery (`client/src/hooks/useSaturnProgress.ts`, `client/src/components/saturn/SaturnImageGallery.tsx`).
- AI image input:
  - `solver/arc_visual_solver.py` sends images to the AI via base64 data-URLs in `call_ai_with_image()`.
- Persistence:
  - `server/services/dbService.ts` stores a JSON string of image paths in `saturn_images` (TEXT) and an optional `reasoning_log`.
  - No explicit column for verbose subprocess logs or full event history.
- UI:
  - Dedicated page `client/src/pages/SaturnVisualSolver.tsx` with live progress and a Saturn ARC attribution banner + GitHub link.

## Identified Gaps
- Some AI providers require file uploads or hosted URLs; inline base64 may not be sufficient.
- Verbose solver output (non-NDJSON stdout and stderr) is forwarded as transient WebSocket messages but not durably stored.
- Database lacks a dedicated place for:
  - Full verbose log (combined stdout/stderr text).
  - Event-level trace (array of progress events), if we want historical replay.
  - Optional PNG blob storage (not only file paths).
- Global UI (outside the Saturn page) lacks a guaranteed 🪐 indicator and collapsible Saturn details where explanations are shown.
 - Policy: the system must operate with a working database connection. Any run without DB persistence is a failure condition.

## Plan by Workstream

### A) Image delivery to AI models as PNG files
- Update `solver/arc_visual_solver.py` (`call_ai_with_image()`):
  - Add a provider adapter that selects the exact image input format supported by the configured provider/model (e.g., base64 data-URLs for OpenAI Responses API).
  - Do not silently fallback between methods. If the configured mode is unsupported, emit a clear NDJSON `error` event and stop.
  - Centralize the provider switch and validation of accepted image input formats.
- Introduce configuration in `.env` to select target provider/model; respect existing environment variables.
- Add robust error messages and capture failures in NDJSON logs via `saturn_wrapper.py`.


### B) End-to-end verbose logging capture
- Python:
  - Ensure `saturn_wrapper.py` keeps emitting NDJSON events; continue writing non-JSON logs to stdout/stderr as today.
- Node bridge (`server/services/pythonBridge.ts`):
  - Concatenate all non-JSON stdout lines and all stderr lines into an in-memory log buffer per session.
  - Surface a summary chunk to the WebSocket stream periodically.
  - Provide the full buffer to `saturnVisualService` on `final` to persist.
- Service (`server/services/saturnVisualService.ts`):
  - Include the final verbose log in the explanation record persistence.
  - Consider persisting a compact event trace if needed.
- UI:
  - Add a collapsible "Verbose Log" panel in `SaturnVisualSolver` to display recent lines during run and full log after completion.

Acceptance checks:
- [ ] All stdout/stderr lines (including emojis) appear in the UI during runs without encoding issues on Windows.
- [ ] Full verbose log persisted to DB and visible alongside explanations.
- [ ] No log truncation for typical runs; very large logs are chunked and remain accessible.

Acceptance checks:
- [ ] With the configured provider, images are accepted via the provider’s officially supported method (e.g., base64 data URLs for OpenAI) with no API errors.
- [ ] No silent fallback occurs. Unsupported configuration produces a clear `error` event and terminates the run.
- [ ] The solver proceeds through all phases without image-format-related failures on at least 2 diverse tasks, including `9ddd00f0`.


### C) Database schema extensions for Saturn
- Explanations table additions:
  - Add `saturn_log` (TEXT) to store the full verbose log.
  - Add `saturn_events` (TEXT) to store a compressed JSON array of progress events (optional but recommended).
- Optional image storage:
  - Create a `saturn_image_blobs` table to store binary PNGs when needed, with fields: explanation_id, path, mime, size, sha256, created_at, and an optional binary column. Keep `saturn_images` (paths) for lightweight cases.
- Backfill/migration strategy:
  - Non-breaking migrations; existing rows remain valid.
  - Application reads both old `saturn_images` and new blob table when present.

Acceptance checks:
- [ ] Migrations run successfully on PostgreSQL; existing data preserved.
- [ ] New explanations include `saturn_log`; optional `saturn_events` if enabled.
- [ ] Reading explanations works with and without blob table present.
- [ ] Running without a working DB connection is treated as a hard failure (run aborts with an explicit error event).

### D) UI enhancements and solved-by-Saturn indicator
- Global indicators:
  - In shared explanation views, show 🪐 when `modelName` starts with "Saturn Visual Solver".
  - Add a collapsible "Saturn Details" section showing images and verbose log.
- Saturn page improvements:
  - Show running ETA and slow-model guidance.
  - Collapsible panels: Progress, Image Gallery, Verbose Log, Final Result.
- Keep Saturn ARC attribution banner + GitHub link in Saturn pages and show a subtle attribution in `PuzzleExaminer` when Saturn content is rendered.

Acceptance checks:
- [ ] 🪐 indicator visible where explanations are listed and detailed.
- [ ] Collapsible Saturn sections render images and logs without layout issues.
- [ ] Verified with task `9ddd00f0` and two other tasks.

### E) Performance and UX considerations (slow models)
- Assume providers can take several minutes for complex puzzles.
- Ensure generous server timeouts and client reconnect handling.
- UI should display steady progress/status and not imply fast results.

Acceptance checks:
- [ ] Long runs complete without server/client timeout.
- [ ] UI remains responsive and informative throughout long phases.

## End-to-End Test Matrix
- Providers/models: Start with OpenAI path (base64 data-URLs). Add additional providers later with explicit adapter support.
- Tasks: include `9ddd00f0` and four additional tasks with different sizes/patterns.
- Scenarios:
  - Normal run via provider-supported image input (OpenAI: base64 data-URLs).
  - Misconfigured provider mode produces an immediate `error` event (no silent fallback).
  - Large verbose log volume.
  - DB persistence required; absence or failure to persist is a hard failure.

Verification artifacts to capture:
- Screenshots of UI (progress, gallery, final, collapsibles, 🪐 indicator).
- Database rows for explanations showing `saturn_images`, `saturn_log`, and optionally `saturn_events`.

## Concrete Checklist (single source of truth)
- [ ] Implement a provider adapter in `solver/arc_visual_solver.py` for image input. Use provider-supported method (OpenAI: base64 data-URLs). No silent fallback; emit error on unsupported configuration.
- [ ] Confirm `server/python/saturn_wrapper.py` continues to emit NDJSON and images; add error emission on image upload failures.
- [ ] Aggregate non-JSON stdout and stderr in `server/services/pythonBridge.ts` and expose buffer to `saturnVisualService`.
- [ ] Persist `saturn_log` (and optionally `saturn_events`) via `dbService.saveExplanation()`.
- [ ] Add non-breaking DB migrations to create new columns/table.
- [ ] Add UI collapsibles for Verbose Log and Saturn Details; ensure 🪐 indicator across explanation views.
- [ ] Validate with task `9ddd00f0` end-to-end; attach screenshots and record timings.
- [ ] Execute full test matrix; document results and close items only after verification.

## Implementation Order (separation of concerns)
1. Backend logging and persistence: bridge buffering, `saturn_log` persistence, schema migrations.
2. Provider adapter in solver for image input (no silent fallback, explicit errors).
3. Frontend UI: 🪐 indicator and collapsible details (images, verbose log).
4. E2E tests and matrix execution; update this document with evidence.

## Done Criteria
- All tasks checked off
- The database contains persisted Saturn explanations with images and verbose logs.
- The UI clearly communicates Saturn runs and supports deep inspection without external tools.
- No simulated functionality; all features work in the live app.
