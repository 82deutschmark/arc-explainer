# 2025-12-11 – Worm Arena Replay Video Backfill Plan

Author: Cascade  
Date: 2025-12-11  
Scope: Offline conversion of Worm Arena / SnakeBench replay JSON files to MP4 videos  
Goal: Build a robust, resumable "backfill" pipeline that converts the existing ~600 completed games under `external/SnakeBench/backend/completed_games` into Twitch-compatible MP4 files. No live or on-the-fly generation in this plan.

---

## 1. Motivation and Constraints

- We already have **hundreds of completed Worm Arena games** recorded as JSON replays under:
  - `external/SnakeBench/backend/completed_games/*.json`
- We want to:
  - Turn these into **high-quality MP4 videos** using the existing Python video generator.
  - Do it in a way that is **repeatable, resumable, and observable**.
  - Ensure the output is **Twitch-compatible** so future streaming work can simply pick up these MP4s.
- Explicit constraints for this plan:
  - **No live / real-time generation.** Everything here is **offline backfill**.
  - **No Twitch API / queue / daemon** work in this plan; those will come later.
  - Focus on **one big batch job** to process roughly **600 games** safely.

Non-goals (for this document):

- Building the Twitch queue, scheduler, or admin UI.
- Changing Worm Arena frontend UX.
- Real-time frame streaming or OBS integration.

---

## 2. Existing Assets and Target Output

### 2.1 Existing assets

- **Replay JSON files**
  - Location: `external/SnakeBench/backend/completed_games/*.json`.
  - Each file represents a completed Worm Arena / SnakeBench game with full state for replay.

- **Python video generator**
  - File: `external/SnakeBench/backend/services/video_generator.py`.
  - Responsibility: render a replay JSON to an MP4 file using PIL + MoviePy (or similar).
  - Current behavior and CLI surface need to be reviewed and documented.

- **Game metadata / DB records**
  - SnakeBench already stores game summaries in its DB.
  - These records can be used as the **authoritative list of games**, but the backfill job may also enumerate JSON files from disk.

### 2.2 Target output format (for Twitch compatibility later)

We want a **standardized MP4 spec** that works out of the box with Twitch and other platforms, so later we can stream without re-encoding when possible:

- Container: `mp4`
- Video codec: `H.264` (`libx264`)
- Pixel format: `yuv420p`
- Resolution: target e.g. `1280x720` (720p) or similar, consistent across games.
- Frame rate: e.g. `30 fps`.
- Audio: AAC track (can be silent, but present for compatibility) or confirmed-safe silent video that Twitch accepts.

This plan does **not** force us to pick the exact resolution/FPS now, but Phase A must lock this down and ensure the generator can produce it consistently.

---

## 3. Phase A – Harden and Standardize the Video Generator

**Goal:** Turn `video_generator.py` into a predictable, documented tool that can reliably convert a single replay JSON into a Twitch-compatible MP4.

### 3.1 Tasks

- **A1. Read and document current behavior**
  - Open `external/SnakeBench/backend/services/video_generator.py`.
  - Document:
    - Input assumptions (JSON schema, required fields, path conventions).
    - Output filename conventions and directories.
    - Current resolution, FPS, codec, and audio handling.
    - Any side effects (temp files, logs, environment variables).

- **A2. Add / confirm a clean CLI entrypoint**
  - Ensure there is a **single, simple CLI interface**, e.g.:
    - `python -m services.video_generator --input <replay.json> --output <video.mp4>`
  - Validate arguments and exit with:
    - `0` on success.
    - Non-zero on failure, with a clear error message to stderr.

- **A3. Standardize output spec**
  - Decide on the canonical video spec (resolution, FPS, codec, pixel format, audio policy).
  - Update `video_generator.py` to **always** produce that spec, or to accept a small config (e.g. `--resolution`, `--fps`) with reasonable defaults.

- **A4. Improve robustness and logging**
  - Ensure the generator:
    - Fails fast and clearly on malformed JSON or missing assets.
    - Logs progress (e.g., "loading JSON", "rendering frames", "encoding video").
    - Writes errors in a way that a higher-level batch runner can capture and store.

- **A5. Manual validation pass**
  - Run the generator against a **handful of representative JSON files** (short game, long game, tournament game if present).
  - Manually inspect the resulting MP4s:
    - Visual correctness (board, emojis, snakes moving correctly).
    - Length matches `rounds_played`.
    - Basic codec / format checks via `ffprobe` or a media player.

### 3.2 Deliverables

- A short internal note (could be a section in this file or a dev doc) describing:
  - How to run the generator for a single game.
  - The exact output spec (resolution, FPS, codecs).
- `video_generator.py` capable of reliably producing a valid MP4 for a given replay JSON, with meaningful exit codes and logs.

---

## 4. Phase B – Video Catalog and Storage Layout

**Goal:** Decide where MP4s live and how we track which games have a video, so the backfill job is idempotent and resumable.

### 4.1 Directory structure

- Define a **canonical directory** for rendered videos, e.g.:
  - `external/SnakeBench/backend/completed_games_videos/`
  - or a sibling to existing JSONs: `external/SnakeBench/backend/completed_games/videos/`.
- Filename conventions:
  - Prefer a **stable mapping** from game ID to filename, e.g.:
    - `<gameId>.mp4` or `snake_game_<gameId>.mp4`.
  - Avoid embedding transient metadata (dates, models) in filenames to keep lookups simple.

### 4.2 Catalog / metadata options

We need a way to know, for each game, whether video generation has:

- Not started.
- Succeeded (and where the MP4 lives).
- Failed (with an error message and retry count).

Two likely approaches:

- **Option 1 – New dedicated table** (recommended for clarity)
  - Example shape (final schema to be decided when we inspect the existing DB):
    - `id` – primary key.
    - `game_id` – references the SnakeBench game.
    - `json_path` – path to the replay JSON file.
    - `video_path` – path to the produced MP4.
    - `status` – `'pending' | 'in_progress' | 'completed' | 'failed'`.
    - `error_message` – nullable text.
    - `retry_count` – integer.
    - `created_at`, `updated_at` – timestamps.

- **Option 2 – Extend existing game table**
  - Add a small set of columns directly onto the existing SnakeBench game table, for example:
    - `has_video`, `video_path`, `video_status`, `video_error`.
  - This reduces joins but may couple concerns more tightly.

The exact choice will depend on the current SnakeBench schema and how it is modeled in Drizzle. The plan is to **inspect the existing schema first**, then pick the least intrusive, SRP-respecting option.

### 4.3 Idempotency and consistency rules

- A video is considered **ready** if:
  - Catalog status is `completed`, and
  - `video_path` exists on disk and passes a basic sanity check (file size > 0, optional codec probe during spot checks).
- The backfill job must:
  - Skip items that are already `completed` and present on disk.
  - Re-run items with `failed` status only when requested (e.g., via a `--retry-failed` flag).
  - Be safe to interrupt and restart without corrupting the catalog.

### 4.4 Deliverables

- A documented decision on:
  - Directory layout for videos.
  - Chosen catalog approach (new table vs extra columns).
- A small migration (if needed) to add the catalog structure.
- Simple helper queries or repository methods to:
  - Fetch all games needing video generation.
  - Mark a game as `in_progress`, `completed`, or `failed`.

---

## 5. Phase C – Batch Backfill Job for ~600 Replays

**Goal:** Implement a robust batch runner that converts the existing ~600 JSON replays into MP4s, using the hardened generator and catalog.

### 5.1 High-level behavior

- Enumerate the **set of games to process** from one of:
  - The SnakeBench DB (preferred, using the game/table schema).
  - Or, if necessary, by scanning `external/SnakeBench/backend/completed_games/*.json` and mapping filenames to game IDs.
- For each game:
  - Check the catalog:
    - If `status === 'completed'` and the file exists, **skip**.
    - If `status === 'in_progress'` but no process is running (e.g., after a crash), treat as pending or add a `--resume-stale` mode.
    - If `status === 'failed'`, include or skip based on CLI flags.
  - Invoke `video_generator.py` with the appropriate input JSON and target MP4 path.
  - Capture stdout/stderr and exit code.
  - Update the catalog with success/failure and any error message.

### 5.2 Implementation details

- **Language choice**
  - The batch runner can be implemented either in **Python** (near the generator) or **Node/TypeScript** (near the main server).
  - For simplicity and fewer cross-runtime hops, a Python script that orchestrates generation may be preferable initially, with a future Node wrapper if needed.

- **Concurrency and limits**
  - Add a configurable **max concurrency**, e.g. `--max-parallel=2` or `4`, to avoid overloading CPU or disk.
  - Use a simple worker-pool approach:
    - Maintain a queue of pending games.
    - Launch up to N generator subprocesses at a time.

- **CLI interface**
  - Example command options:
    - `--mode=all` (default): process all pending games.
    - `--mode=failed-only`: retry only failed ones.
    - `--limit=100`: cap the number processed in a single run.
    - `--max-parallel=4`: control concurrency.
  - Log progress to stdout, e.g.:
    - `Processed 37 / 600 (5 failed, 32 succeeded)`.

- **Error handling and retries**
  - On generator failure:
    - Mark catalog entry as `failed`, increment `retry_count`, and store the error message.
    - Do **not** retry endlessly within a single run; a small, explicit retry policy (e.g., 1 immediate retry) is enough.
  - Ensure a single bad JSON cannot stop the entire batch.

- **Observability**
  - At minimum, log:
    - Start/end of the batch run.
    - Per-game status line (success/failure, time taken).
    - Summary stats at the end.
  - Optionally, expose a small script or query to list:
    - How many games are pending, completed, failed.

### 5.3 Manual verification after backfill

- Randomly sample a subset of the ~600 generated MP4s and:
  - Open them in a media player.
  - Confirm visuals are correct and durations are reasonable.
- Spot-check catalog vs disk:
  - Pick a handful of `completed` entries and confirm the files exist and are playable.
- Capture any systematic errors (e.g., specific game types or edge cases) and feed them back into `video_generator.py` hardening.

### 5.4 Deliverables

- A batch backfill script (Python or Node) that can be run repeatedly until the backlog is fully processed.
- A catalog indicating, for each of the ~600 games, whether video exists and where.
- Logs from at least one full backfill run for future reference.

---

## 6. Future Work (Out of Scope for This Plan)

These items are intentionally postponed and should be covered by separate, focused plans once the MP4 library is stable:

- **Twitch integration:**
  - Simple playlist-based `ffmpeg` streaming from the generated MP4s.
  - Eventually, a queue-backed "Worm Arena TV" scheduler and admin UI.

- **Automation on new games:**
  - Hooking video generation into the normal SnakeBench flow so new matches automatically get a video and catalog entry.

- **Advanced video features:**
  - Interstitials, overlays, or additional visual polish in the MP4s.

---

## 7. Open Questions

These should be answered before or during implementation of Phases A–C:

1. **Canonical video spec:**
   - What resolution and FPS do we want to standardize on (e.g., 720p30 vs 1080p30)?
2. **Catalog location:**
   - Do we prefer a new `worm_arena_videos` / `snakebench_game_videos` table, or small extensions to the existing games table?
3. **Execution environment:**
   - Will the heavy backfill run on a **local Windows machine** or on a **Linux server/VM**?
   - This affects how we invoke Python, paths, and how we monitor the long-running job.
4. **Batch size / limits for the first run:**
   - Do we want to process all ~600 in one go, or roll out in smaller batches (e.g., 100 at a time) to shake out issues?

For now, this plan treats the **JSON→MP4 backfill** as the primary milestone. Once that is complete and stable, a separate Twitch-focused plan can assume a rich, reliable library of Worm Arena videos to work with.
