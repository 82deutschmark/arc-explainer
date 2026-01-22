# Worm Arena Greatest Hits vs Local Replays

**Author:** Cascade  \
**Date:** 2025-12-11  \
**Purpose:** Document how Worm Arena "greatest hits" are selected in the database, how that relates to local replay JSONs and MP4s, and how to analyze local games using the Python helper script.

This doc explains why some "greatest hits" game IDs returned from the database do **not** have local replay files, and how to find the most interesting games that actually exist under `external/SnakeBench/backend/completed_games` and `external/SnakeBench/backend/completed_games/local`.

---

## 1. Data Sources

There are two main sources of truth for Worm Arena / SnakeBench games:

1. **Postgres (Railway) – `public.games` table**
   - Populated by `SnakeBenchRepository.recordMatchFromResult` when Worm Arena matches complete.
   - The **greatest-hits** query operates here and returns game IDs based on aggregated stats (rounds, cost, score, etc.).
   - These rows **may exist even if no local replay JSON was exported**.

2. **Local filesystem – completed game replays**
   - Path: `external/SnakeBench/backend/completed_games/`
   - Files: `snake_game_<gameId>.json`
   - Index: `external/SnakeBench/backend/completed_games/game_index.json`
   - Video output: `external/SnakeBench/backend/completed_games_videos/snake_game_<gameId>.mp4`

Important: **DB games and local replays are not guaranteed to be in 1:1 sync.** A game can:

- Exist in `public.games` but have **no** `snake_game_<id>.json` locally.
- Exist as a local JSON replay (and even MP4) but not be selected by the DB greatest-hits query.

---

## 2. Greatest Hits Behavior (DB side)

The Worm Arena greatest-hits feature is implemented in `SnakeBenchRepository` and works roughly as follows:

- Query the `public.games` table for `game_type = 'arc-explainer'`.
- Combine several ranking strategies (e.g. most rounds, highest cost, best scores) into a unified list.
- Return a deduplicated, capped list of **game IDs plus highlight reasons**.

This means the **backend feature is real and not hallucinating IDs** – it is operating on rows that genuinely exist in Postgres.

However, if a corresponding replay JSON was never written to `completed_games/` (or was later removed), that game will:

- Still appear in DB-backed greatest-hits lists.
- **Not** be available for local replay or MP4 generation on this machine.

### 2.1 Local builder fallback (new)

When the DB returns zero greatest-hits rows (for example, when running locally without a populated database), the API now invokes a **local greatest-hits builder** that scans the resolved completed-games directory.

- The builder reuses the same metrics as the SQL query (rounds played, total cost, max score, total score, duration, close finishes, 25+ apple hauls).
- Each dimension is ranked locally, deduplicated, and capped to 20 entries before replay availability filtering.
- Only if both DB and local builder fail does the API fall back to the curated hall-of-fame list.

### 2.2 Pinned hall-of-fame refresh (Jan 21, 2026)

- Added match `c6351f1c-2a3f-4e98-93ab-05e38f06a1c7` (Grok Code Fast 1 vs GPT-5 Nano, 44 rounds, 20-16 finish) as the top curated replay so it always appears even when API results rotate.
- Frontend merge logic now deduplicates pinned + API games by `gameId` and sorts the combined list by `startedAt` descending, ensuring newer highlights rise to the top while preserving pinned metadata when IDs overlap.

---

## 3. Local-Only Game Analysis Script

To understand which games are actually present locally (and how interesting they are), we added a small Python helper:

- **Location:** `external/SnakeBench/backend/cli/analyze_local_games.py`
- **Purpose:** Scan all local `snake_game_*.json` files and compute per-game metrics so we can:
  - Find the most expensive local games.
  - Find the longest games by rounds.
  - Find the highest-scoring games (proxy for apples eaten).
  - Find the longest-duration games by wall-clock time.

### 3.1 Metrics Computed

For each replay JSON under `completed_games/`, the script extracts:

- `game_id` – from `game.id` or filename
- `rounds_played` – from `game.rounds_played` or by counting frames
- `max_rounds` – from `game.max_rounds` (fallback: `rounds_played`)
- `total_cost` – from `totals.cost` (fallback: sum of per-player `totals.cost`)
- `max_final_score` – max of all `players[*].final_score` (proxy for apples eaten)
- `sum_final_scores` – sum of all players' `final_score`
- `duration_seconds` – `ended_at - started_at` (0 if timestamps missing)

### 3.2 Usage

Run from the repo root using the existing virtualenv:

```bash
.venv\Scripts\python.exe external\SnakeBench\backend\cli\analyze_local_games.py --top 10
```

Key options:

- `--root`  
  Directory containing `snake_game_*.json` (defaults to `../completed_games` relative to the script).
- `--top`  
  How many games to show per metric (default: 10).

The script prints four ranked sections:

- **Most expensive games** – sorted by `total_cost` (descending)
- **Longest games by rounds** – sorted by `rounds_played` (descending)
- **Highest-scoring games (max apples)** – sorted by `max_final_score` (descending)
- **Longest duration games** – sorted by `duration_seconds` (descending)

This output is the **ground truth for games that actually exist locally**.

---

## 4. Example Findings (Local Snapshot)

On the current local snapshot (December 11, 2025), the top games by each metric looked roughly like:

- **Most expensive:** `c6c26143-451f-4524-bb72-f4cd2e8242c4`, `01ba2c15-ab41-4049-9d61-ff3f49050b7e`, `8a2b969e-1390-42ff-a3ec-a9c49db64dc3`, ...
- **Longest by rounds:** `295efa56-170b-44b7-99ef-f11c2111058e` (97/100), `82bca6d4-5bc7-4273-84b5-ad272fbe3bc9` (97/100), ...
- **Highest-scoring:** same leaders (e.g. `295efa56-...`, `82bca6d4-...`) with `max_final_score ≈ 29`.
- **Longest duration:** `c845ee4d-0606-4204-8fb4-c6cf5074dc9b` (~2.6 hours), `82bca6d4-...`, `295efa56-...`, ...

These games are not necessarily the same as the DB-based greatest hits, because the DB query and the local filesystem may have diverged over time.

---

## 5. DB Greatest Hits vs Local Assets

Some user-facing "greatest hits" IDs pulled from the backend were found to be in **one of two categories**:

1. **Have local replay JSON + MP4**
   - Example IDs (from the priority batch):
     - `836b435a-bfcf-4a5e-be66-d87dd0d92153`
     - `b8eef62f-761a-446e-b447-7fd4588b18e7`
     - `c2610aaf-c2e2-4382-a909-1114f47750d5`
     - `d5886eb9-6e9e-41b5-aefa-f49a841830e2`
     - `fa50a59b-fc43-4d43-8887-7ced8ba7385f`
   - These have:
     - `snake_game_<id>.json` under `completed_games/`
     - `snake_game_<id>.mp4` under `completed_games_videos/` (from the local video generator).

2. **DB-only greatest hits (no local JSON)**
   - Example IDs that exist in Postgres but **not** under `completed_games/` and not in `game_index.json`:
     - `2a428bcd-2f0b-49e7-bb71-71aa853ae541`
     - `e1c7eb2d-ece8-41c8-ba60-6e97ba196926`
     - `1ca2660c-9901-4326-be67-4dd861c9bbbf`
     - `864753b8-a3b1-45f0-86ff-6ee0c7c20627`
     - `87b8b307-91c0-42a3-895f-59e2034fe764`
     - `fd408983-ada4-4d48-a1bc-df8beefe1991`
   - These **cannot** be replayed or converted to MP4 using only local files.

This confirms:

- The **greatest-hits feature itself is correct** (it is querying real DB rows).
- Some greatest-hits games are simply **missing local assets**.

---

## 6. Practical Guidance

When working on Worm Arena features, keep these rules in mind:

- **For UI greatest hits lists:**
  - Use the DB-backed greatest-hits query for ranking and metadata.
  - **Before** showing a game as playable, verify that its replay asset exists:
    - Either a local JSON under `completed_games/`, a valid `replay_path` on disk, or a known remote location.
  - Skip or specially mark entries where no replay asset is available.

- **For local MP4 backfill and analysis:**
  - Treat `completed_games/` + `game_index.json` as the source of truth.
  - Use `analyze_local_games.py` to pick the most interesting games that actually exist locally.
  - Expect that some DB greatest-hits IDs will be absent; do not treat that as a bug in the DB query.

- **For debugging mismatches:**
  - If a game appears in DB greatest hits but has no local JSON, decide whether to:
    - Re-export or re-run that game to regenerate a replay, or
    - Filter it out of any local-only workflows (like offline MP4 backfill).

This doc, together with `docs/SNAKE_BENCH_DB.md`, should be the canonical reference for how Worm Arena greatest hits relate to the underlying SnakeBench tables and local replay files.
