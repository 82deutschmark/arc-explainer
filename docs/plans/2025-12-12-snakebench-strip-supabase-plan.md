# 2025-12-12 - SnakeBench: Strip Supabase, Use Railway Postgres :DATABASE_URL:

**Author:** Cascade  
**Date:** 2025-12-12  
**Purpose:** Provide a clean, actionable plan to remove all Supabase assumptions from `external/SnakeBench` and make Worm Arena live streaming + persistence work using ARC Explainer’s Railway Postgres :via `DATABASE_URL`: and local replay files.

---

## 0: Problem Statement :Observed Failure:

During Worm Arena / SnakeBench runs, the Python engine prints errors like:

- `Failed to connect to Supabase PostgreSQL: SUPABASE_URL and SUPABASE_DB_PASSWORD are required`
- `Warning: Could not update game state: SUPABASE_URL and SUPABASE_DB_PASSWORD are required`
- `✗ Failed to upload replay to Supabase: SUPABASE_BUCKET environment variable is required`

This project **does not use Supabase**. ARC Explainer deploys on Railway and uses a single Postgres database configured via **`DATABASE_URL`**.

---

## 1: What Is Actually Happening :Reality Check:

### 1.1 Supabase references are not in ARC Explainer TypeScript
A repo-wide search in `server/`, `client/`, `shared/` finds **no `SUPABASE_*` usage**.

### 1.2 The Supabase errors come from SnakeBench’s Python backend
They originate in `external/SnakeBench/backend`, primarily:

- `database_postgres.py` :hard-coded Supabase connection string builder:
- `services/supabase_storage.py` and `services/supabase_client.py` :hard-coded Supabase Storage upload:

### 1.3 Worm Arena Live streaming currently depends on Python writing live state to Postgres
ARC Explainer’s Node backend polls:

- `public.games.current_state` :and `rounds`: every ~700ms

So for “live frames” to work, the SnakeBench Python process must be able to:

- INSERT an initial game row
- UPDATE `current_state` each round

---

## 2: Root Cause

SnakeBench Python still assumes:

- **Supabase Postgres** :via `SUPABASE_URL` + `SUPABASE_DB_PASSWORD`:
- **Supabase Storage** for replay uploads :via `SUPABASE_BUCKET` + `SUPABASE_SERVICE_ROLE`:

ARC Explainer wants:

- **Railway Postgres** :via `DATABASE_URL`:
- **Local replay JSON** under `external/SnakeBench/backend/completed_games`

Because SnakeBench’s DB connector is Supabase-only, attempts to write live game state fail, causing:

- missing/failed live updates
- broken “live frames” expectations
- noisy terminal logs

---

## 3: Target Architecture :After Fix:

### 3.1 Single DB source of truth
- SnakeBench Python connects to the **same Postgres** as ARC Explainer’s Node server.
- Connection string comes from **`DATABASE_URL`**.

### 3.2 Replay storage is local-only
- SnakeBench always writes replay JSON locally to:
  - `external/SnakeBench/backend/completed_games/snake_game_<uuid>.json`
- No uploads to Supabase Storage.
- If we later want cloud storage, it should be an explicit, provider-agnostic module :S3/R2/etc.:, not Supabase.

### 3.3 Keep existing Worm Arena polling contract
- Node continues polling `public.games.current_state`.
- Python continues updating `current_state` :JSON: every round.

---

## 4: Required Changes :Step-by-Step:

### 4.1 Replace Supabase-only DB connector with Railway-compatible connector
**Goal:** eliminate `SUPABASE_URL` / `SUPABASE_DB_PASSWORD` from SnakeBench entirely.

- **File:** `external/SnakeBench/backend/database_postgres.py`
- **Change:** rewrite to:
  - read `DATABASE_URL` :preferred:
  - optionally support `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE` :fallback:
  - connect using `psycopg2.connect:...:`
  - use SSL if required by Railway :commonly `sslmode=require`; exact behavior should follow the `DATABASE_URL` format:
- **Update all call sites** that import `get_connection::` :e.g. `data_access/repositories/base.py`:.
- **Remove all Supabase naming** in logs and error messages.

**Acceptance check:** running a match no longer logs anything mentioning Supabase.

### 4.2 Remove Supabase Storage upload path
**Goal:** no replay upload attempts, ever.

- **File:** `external/SnakeBench/backend/main.py`
- **Change:** in `save_history_to_json::`:
  - remove `_disable_supabase` branching
  - remove import/use of `services.supabase_storage.upload_replay`
  - always set:
    - `self.replay_storage_path = f"completed_games/{filename}"`
    - `self.replay_public_url = None`
  - always write to local `completed_games/` :this already exists:

- **Files to delete or quarantine :optional but recommended::**
  - `external/SnakeBench/backend/services/supabase_storage.py`
  - `external/SnakeBench/backend/services/supabase_client.py`
  - `external/SnakeBench/backend/cli/migrate_replays_supabase.py`

If deletion is risky short-term, keep them but ensure they are unreachable and clearly deprecated.

### 4.3 Remove Supabase dependency from SnakeBench requirements
- **File:** `external/SnakeBench/backend/requirements.txt`
- Remove:
  - `supabase==...`

### 4.4 Reconcile internal DB toggles vs live streaming requirements
**Important invariant:** Worm Arena live streaming expects SnakeBench Python to write live state into Postgres.

- If any runner/controller sets `SNAKEBENCH_DISABLE_INTERNAL_DB=1`, live state updates will not work.
- Standardize the meaning of these env flags:
  - **Recommended:** remove/stop using `SNAKEBENCH_DISABLE_INTERNAL_DB` for ARC Explainer runs.
  - Keep a separate flag only for CLI/testing, if needed.

**Files involved on ARC Explainer side:**
- `server/services/snakeBenchService.ts` :spawns the python runner:
- `server/python/snakebench_runner.py` :imports SnakeBench engine:

**Outcome:** ARC Explainer should spawn SnakeBench with DB writes enabled.

### 4.5 Ensure schema compatibility
SnakeBench Python writes to tables named:

- `games`
- `game_participants`

ARC Explainer currently polls:

- `public.games.current_state`

Verify:
- the schema exists in Railway Postgres
- the columns exist :`current_state`, `rounds`, etc.:
- SnakeBench and ARC Explainer agree on JSON shape :`round_number`, `snake_positions`, `apples`, etc.:

If mismatched, create a **single migration** on the ARC Explainer side :preferred: rather than trying to “auto-create” tables from SnakeBench.

---

## 5: File Inventory :Known Supabase Hotspots:

### 5.1 Supabase DB connector
- `external/SnakeBench/backend/database_postgres.py`
- `external/SnakeBench/backend/data_access/repositories/base.py` :imports connector:

### 5.2 Supabase Storage
- `external/SnakeBench/backend/services/supabase_storage.py`
- `external/SnakeBench/backend/services/supabase_client.py`
- `external/SnakeBench/backend/main.py` :imports uploader:

### 5.3 Supabase-related scripts
- `external/SnakeBench/backend/cli/migrate_replays_supabase.py`
- `external/SnakeBench/backend/cli/backfill_videos.py` :may reference Supabase paths:
- `external/SnakeBench/backend/services/video_generator.py` :may reference Supabase URLs:

---

## 6: Testing Checklist :Do Not Skip:

### 6.1 Local dev sanity
- Confirm ARC Explainer has `DATABASE_URL` set :Railway/local Postgres:.
- Run a single Worm Arena live match.

Expected:
- **No** “Supabase” strings in output.
- SnakeBench prints `Inserted initial game record <uuid>`.
- `public.games.current_state` updates repeatedly while the game is running.
- The UI receives `stream.frame` events :board updates: and the game completes normally.

### 6.2 Regression checks
- Replay JSON is written locally under `external/SnakeBench/backend/completed_games`.
- Replays can be viewed from the ARC Explainer UI :whatever the current replay flow is:.

---

## 7: Rollback Strategy

- Keep changes isolated to `external/SnakeBench/backend` first.
- If DB schema changes are needed, gate them behind a migration that can be reverted.
- If live streaming breaks, temporarily fall back to “status-only streaming” :stdout logs: while DB writes are fixed.

---

## 8: Open Questions :Need a Decision:

1. Should SnakeBench Python be allowed to write *completed* game rows/participants into Postgres, or only live state?
   - Live state is required for streaming.
   - Completed persistence might duplicate ARC Explainer’s ingest queue behavior. 
   Answer: I don't understand the question. You'd have to explain this better.

2. Should we keep the SnakeBench Flask API :`external/SnakeBench/backend/app.py`: as a separate deployable service, or treat SnakeBench as an embedded engine only?
Answer. I don't understand the question. You need to explain this better and the trade-offs.
---
