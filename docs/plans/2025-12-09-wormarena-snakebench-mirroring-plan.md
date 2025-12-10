# 2025-12-09 – WormArena ↔ SnakeBench Flow Mirroring Plan

**Author:** Cascade (via OpenAI / ARC Explainer agents)
**Context:** WormArena live matches are currently kicked off via Node/TypeScript (`snakeBenchService.runMatch`) using the embedded SnakeBench backend as a black-box process. Greg’s canonical flow (Python + Postgres + Supabase) defines a rich lifecycle for games, ratings, and telemetry. This plan specifies how closely WormArena should mirror that flow, where it can remain lighter-weight, and how to keep compatibility with both ARC Explainer and upstream SnakeBench.

---

## 1. Ground truth: Greg’s SnakeBench lifecycle

### 1.1 Live tracking lifecycle (Python/Flask side)

Reference files:
- `external/SnakeBench/backend/main.py`
- `external/SnakeBench/backend/data_access/live_game.py`
- `external/SnakeBench/backend/data_access/repositories/game_repository.py`
- `external/SnakeBench/backend/app.py`

Key steps:

1. **Game init** – `SnakeGame.__init__` @ `main.py`:
   - Creates `SnakeGame` with board size, max rounds, num apples, `game_id`, `game_type`.
   - Seeds apples and initializes in-memory state (snakes, scores, replay buffers).
   - If DB is available (`DB_AVAILABLE=True`), calls `insert_initial_game(...)` via `live_game.insert_initial_game`, which delegates to `GameRepository.insert_initial_game` to write a `games` row:
     - Columns: `id`, `status='in_progress'`, `start_time`, `board_width`, `board_height`, `num_apples`, `game_type`.

2. **Initial participants** – `run_simulation(...)` @ `main.py`:
   - After creating `SnakeGame` and adding LLM players, and when DB is available, calls `insert_initial_participants(game_id, participants)` via `live_game.insert_initial_participants`, which delegates to `GameRepository.insert_initial_participants`:
     - Inserts `game_participants` rows (per player) with `model_name`, `player_slot`, and optional `opponent_rank_at_match`.

3. **Per-round live state** – `SnakeGame.run_round` @ `main.py`:
   - Runs one round: gather moves, apply movement, apples, collisions, termination checks.
   - After updating state and scores, logs: `Finished round N. Alive: [...], Scores: {...}`.
   - If DB available, builds a `current_state` dict with:
     - `round_number`, `snake_positions`, `alive`, `scores`, `apples`, `board_state` (ASCII), `move_history` (current round), `last_move_time`.
   - Calls `live_game.update_game_state(game_id, current_state, rounds)` → `GameRepository.update_game_state`:
     - Updates `games.current_state` with JSON and `games.rounds`/`updated_at`.

4. **Live API polling** – `app.py`:
   - `/api/games/live` → `get_live_games_endpoint` → `live_game.get_live_games` → `GameRepository.get_live_games` returns current `games` rows with `status='in_progress'` plus `current_state` snapshots.
   - `/api/games/<game_id>/live` → `get_game_state_endpoint` → `live_game.get_game_state` returns a single game’s `current_state` plus associated metadata.
   - **Important:** Python side uses **HTTP polling**, not SSE, for live data.

### 1.2 Replay & telemetry output

Still in `main.py` (`SnakeGame.save_history_to_json`):

1. **Replay aggregation:**
   - `replay_frames` collected as one record per round, including subset of state + per-snake decisions (`move`, `rationale`, `input_tokens`, `output_tokens`, `cost`).
   - `player_costs` tracks per-player cost across rounds; `total_cost` accumulates overall cost.

2. **On completion (`save_history_to_json`)**:
   - Aggregates token/cost totals per player from `replay_frames` + `player_costs`.
   - Constructs `players_payload` with:
     - `model_id`, `name`, `result`, `final_score`, `death` (`reason`, `round`), `totals` (tokens + cost).
   - Builds `totals_payload` with total cost and total tokens.
   - Builds `game_payload` with id, start/end time, `game_type`, `max_rounds`, `rounds_played`, and board dims/num_apples.
   - Builds `metadata` (backwards-compatible summary: `models`, `final_scores`, `death_info`, `actual_rounds`, `total_cost`, `player_costs`, etc.).
   - Serializes final object:
     ```json
     {
       "version": 1,
       "game": {...},
       "players": {...},
       "totals": {...},
       "initial_state": {...},
       "frames": [...],
       "metadata": {...}
     }
     ```

3. **Persistence destinations:**
   - **Supabase Storage** via `services.supabase_storage.upload_replay(game_id, data)` → sets `replay_storage_path` + `replay_public_url`.
   - **Local file fallback** to `completed_games/snake_game_<id>.json` regardless (for debugging / backup).

### 1.3 Final DB persistence & ratings

1. **Persist game & participants** – `SnakeGame.persist_to_database` @ `main.py`:
   - Skips if `DB_AVAILABLE=False`.
   - Computes `end_dt` and `replay_path` (Supabase if available, otherwise local path).
   - Computes `total_score` as sum of player scores.
   - Calls `complete_game(...)` via `live_game.complete_game` → `GameRepository.complete_game` to:
     - Mark `games.status='completed'`, set `end_time`, `rounds`, `replay_path`, `total_score`, `total_cost`, clear `current_state`.
   - Builds participants list from `self.players` + `self.snakes` and calls `insert_game_participants(game_id, participants)` via `game_persistence.insert_game_participants` → `GameRepository.insert_participants`.

2. **Aggregates & ratings** – `persist_to_database` continues:
   - Calls `update_model_aggregates(game_id)` → `model_updates.update_model_aggregates` → `_model_repo.update_aggregates_for_game(game_id)` to maintain `wins`, `losses`, `ties`, `apples_eaten`, `games_played` per model.
   - Calls `update_trueskill_ratings(game_id)` (primary) → `trueskill_engine.rate_game(game_id)` which:
     - Loads participants for game.
     - Computes TrueSkill deltas per participant.
     - Writes `mu`, `sigma`, `exposed`, and a display rating back to `models` table.
   - On TrueSkill error, falls back to `update_elo_ratings(game_id)`.

3. **Ratings/backfill CLI** – `cli/backfill_full_stats.py` (not fully detailed here):
   - Resets model ratings/aggregates to baseline.
   - Replays all `games` rows chronologically to recompute aggregates and ratings.

4. **API surface** – `app.py`:
   - `/api/models` & `/api/games` read from **Postgres**, not JSON files.
   - For games, they swap `replay_path` for a Supabase public URL if available.

---

## 2. Current ARC Explainer / WormArena integration state (summary)

High-level (see `server/services/snakeBenchService.ts`, `server/controllers/wormArenaStreamController.ts`, and `client/src/pages/WormArena*.tsx`):

- ARC Explainer spawns SnakeBench’s Python backend via `snakeBenchService.runMatch`, passing model ids and board parameters via stdin.
- Python SnakeBench runs the full game loop, writes its JSON replay into `external/SnakeBench/backend/completed_games/snake_game_<id>.json`, and (if configured) persists to its own Postgres + Supabase.
- Node `snakeBenchService.runMatch` only consumes a **summary line of JSON** from Python (game id, model names, scores, replay path) and:
  - Enqueues `repositoryService.snakeBench.recordMatchFromResult(...)` to push results into ARC Explainer’s own DB.
  - Updates a **local FS index** (`completed_games/game_index.json`) for quick recent-games queries.
- WormArena currently:
  - **Replay:** Reads indexed JSON replays directly from the embedded SnakeBench `completed_games` directory (plus our `game_index.json`).
  - **Live streaming (WormArenaLive):** Wraps `runMatch` in a Node SSE controller (`wormArenaStreamController`) that currently **does not stream frames**; it only sends status + final summary once Python is done.

Conclusion: We already consume **Greg-style replay JSON** and some DB persistence via our own `repositoryService.snakeBench`, but we **do not mirror** his live DB polling (`games.current_state`) or his ratings pipeline. We also add our own SSE layer on top.

---

## 3. Desired mirroring level for WormArena

We do **not** need to re-implement Greg’s entire Python + Postgres + Supabase stack inside ARC Explainer. Instead, we want:

1. **Full fidelity to his replay JSON contract** (already satisfied by using his `save_history_to_json` output as the replay source).
2. **Reasonable alignment with his game lifecycle semantics** (start → live updates → completion → ratings), while reusing ARC Explainer’s existing DB, metrics, and streaming stack.
3. **WormArena-specific metrics and storytelling** (win rate, cost, decision quality, death reasons) derived from the **local completed-game JSON files**, not from Greg’s DB.

Therefore, we’ll:

- Treat the Python side as the **source of truth for per-move state and costs** via the JSON replays.
- Treat ARC Explainer’s DB as the **source of truth for WormArena-facing aggregates and metrics** (using a separate `worm_arena_*` schema or extended `snake_bench_*` tables).
- Mirror Greg’s sequence conceptually (init → live → replay JSON → final DB updates → ratings), but split responsibilities between:
  - Python + its Postgres (optional, external).
  - Node + ARC Explainer DB (internal, WormArena-centric).

---

## 4. Proposed WormArena flow mirroring Greg, step by step

### 4.1 Live tracking (SSE over Node, backed by Python process)

**Goal:** Provide a WormArena live view and analytics hooks that roughly mirror SnakeBench’s `games` + `current_state` tables without introducing a second database inside the embedded Python project.

**Plan:**

1. **Keep SnakeBench’s own DB writes optional and unmodified.**
   - We always run the upstream `SnakeGame` with its existing DB hooks enabled when possible; this preserves Greg’s metrics ecosystem for his infrastructure.
   - ARC Explainer does **not** depend on those tables being present.

2. **In Node, define a WormArena session table or in-memory registry** (in TypeScript):
   - Columns/fields:
     - `session_id` (UUID, public)
     - `game_id` (SnakeBench’s game id, if known yet)
     - `status` (`pending`, `starting`, `in_progress`, `completed`, `failed`)
     - `board_width`, `board_height`, `num_apples`
     - `model_a`, `model_b`
     - `started_at`, `ended_at`
     - `last_round`, `last_state_snapshot` (optional JSON)
   - This registry is owned by Node and is used to:
     - Serve SSE status events.
     - Index games for WormArena-specific dashboards.

3. **Extend `wormArenaStreamController` to stream frame-level data:**
   - Introduce `snakeBenchService.runMatchStreaming(...)` (new) to:
     - Spawn Python and read its stdout **line by line**.
     - Parse structured logs or a dedicated streaming channel (e.g., per-round JSON lines printed by the Python game – if we add them upstream) to construct `WormArenaFrameEvent` objects.
     - Emit these frames via `sseStreamManager.sendEvent(sessionId, 'stream.frame', frame)`.
   - Interim fallback (if we don’t add per-round JSON logs to Python):
     - At minimum, stream **status heartbeats** (`starting` → `in_progress` → `completed`) and final summary from the final JSON line, plus a “live-ish” spinner.
   - This step mirrors Greg’s **live DB polling** but using SSE + Node-managed session state instead of `/api/games/live` polling.

4. **Optionally backfill a Node-side `current_state` snapshot** from replay frames:
   - On each parsed frame, update `session.last_state_snapshot` with:
     - `round`, `snakes`, `apples`, `scores`, `alive`.
   - This gives us Greg-like `current_state` without replicating his `games` table.

### 4.2 Replay & telemetry (JSON replays as primary source)

**Goal:** Use Greg’s replay JSON as the canonical source for WormArena replays and metrics.

**Plan:**

1. **Continue consuming Python’s final JSON line in `snakeBenchService.runMatch`.**
   - This line already includes `completed_game_path` (along with `game_id`, `modelA`, `modelB`, `scores`, `results`).

2. **Standardize where those JSON files live and how we index them:**
   - Keep using `external/SnakeBench/backend/completed_games/` as the storage location.
   - Maintain `game_index.json` with entries:
     - `game_id`, `filename`, `start_time`, `end_time`, `actual_rounds`, `total_score`, `model_a`, `model_b`.
   - Ensure WormArena’s recent-games UX reads from this index (already happening) and not from Greg’s external DB or Supabase URLs.

3. **For WormArena metrics, never depend on Supabase or Greg’s remote storage.**
   - We treat Supabase upload as **best effort** for Greg’s ecosystem, but our metrics run solely on the local JSON copy.

4. **Define a WormArena-specific telemetry extractor** (Node service):
   - Inputs: path to `snake_game_<id>.json`.
   - Outputs: normalized entities:
     - `worm_arena_games` row (per game) with:
       - `game_id`, `started_at`, `ended_at`, `board_width`, `board_height`, `num_apples`, `max_rounds`, `rounds_played`, `model_a`, `model_b`, `total_cost`, `total_input_tokens`, `total_output_tokens`.
     - `worm_arena_participants` rows (per model per game):
       - `game_id`, `player_slot`, `model_name`, `result`, `final_score`, `death_round`, `death_reason`, `total_cost`, `total_input_tokens`, `total_output_tokens`.
     - (Optional) `worm_arena_decisions` table:
       - `game_id`, `round`, `player_slot`, `move`, `rationale`, `input_tokens`, `output_tokens`, `cost`, plus simple derived flags (e.g., `reasoning_length`, `is_error_fallback`).

5. **Trigger the telemetry extractor**:
   - Eager (recommended): called once `snakeBenchService.runMatch` resolves, best-effort / fire-and-forget.
   - Or lazy: offline job that sweeps `completed_games/*.json` and ingests any not yet present in `worm_arena_games`.

### 4.3 Final persistence & ratings (WormArena view)

**Goal:** Have a coherent WormArena-centric rating/metrics story without forking Greg’s TrueSkill engine or his database.

**Plan:**

1. **Respect Greg’s own rating pipeline as external.**
   - We do not modify `services.trueskill_engine` or his `models` table in the embedded SnakeBench project.
   - If Greg’s environment has its Postgres + backfill CLI running, it will maintain its own ratings; ARC Explainer doesn’t rely on them.

2. **Add a lightweight WormArena rating system in ARC Explainer DB (optional but recommended):**
   - Use an **aggregate metrics repository** (`MetricsRepository` or `ModelRatingsRepository`) in `server/repositories/` to maintain:
     - Per-model win/loss/tie counts.
     - Average score per game and per board size.
     - Cost per game and cost per point.
     - Death-reason frequencies (wall vs head_collision vs body_collision vs starvation).
   - These aggregates are computed from `worm_arena_games` + `worm_arena_participants` and do not require TrueSkill.

3. **If ratings are desired, consider either:**
   - A simple Elo-like rating implemented in Node, or
   - A **read-only adapter** that can optionally pull Greg’s TrueSkill values from his Postgres instance if configured, without writing to it.

4. **Backfill / recompute WormArena aggregates:**
   - Provide a Node CLI or script analogous to `backfill_full_stats.py` that:
     - Wipes `worm_arena_*` aggregates.
     - Replays all locally available `snake_game_*.json` files in chronological order.
     - Rebuilds aggregates and ratings for WormArena views.

---

## 5. API & UI implications

### 5.1 Backend API

New or clarified endpoints (all **public, no auth**, per ARC Explainer rules):

1. **`GET /api/wormarena/metrics/summary`**
   - Returns per-model summary stats (win rate, avg score, avg cost, common death reasons).

2. **`GET /api/wormarena/games/recent`**
   - Already partially implemented via `game_index.json`; extend to include WormArena-derived metrics when available.

3. **`GET /api/wormarena/games/:gameId`**
   - Returns parsed replay JSON from the local `completed_games` file plus any derived WormArena metrics.

4. **(Optional) `GET /api/wormarena/decisions/:gameId`**
   - Returns normalized decision-level data (rationales, token counts) to power advanced views but may not be needed for the first iteration.

### 5.2 Frontend (WormArena & WormArenaLive)

1. **WormArena (replay):**
   - Continue to load replay JSON directly for frame-by-frame viewing.
   - Augment UI panels to show WormArena metrics (per model, per game) pulled from `worm_arena_*` tables.

2. **WormArenaLive (live streaming):**
   - Continue to use `/api/wormarena/prepare` + `/api/wormarena/stream/:sessionId`.
   - Once frame streaming is wired up, show live score, death reasons, and token counters if available.
   - After completion, deep-link to `/worm-arena` replay using the `gameId` in the final summary.

3. **Analytics views (future):**
   - Separate WormArena analytics tab or section (e.g., “Model Ladder”) that surfaces aggregates built from `worm_arena_*` tables, not from Greg’s DB.

---

## 6. Implementation phases

### Phase 1 – Clarify and document

- [ ] Confirm with user the desired **scope** of mirroring (do we want our own ratings? or just descriptive stats?).
- [ ] Finalize metric set for WormArena (win rate, avg score, cost per game, cost per point, death reasons, reasoning-length vs performance, etc.).
- [ ] Lock this plan as the reference for WormArena ↔ SnakeBench consistency.

### Phase 2 – Storage & ingestion

- [ ] Design `worm_arena_games`, `worm_arena_participants`, and (optional) `worm_arena_decisions` tables in Drizzle.
- [ ] Implement a WormArena ingestion service in Node that:
  - Takes `completed_game_path` from `snakeBenchService.runMatch`.
  - Parses JSON to populate `worm_arena_*` tables.
  - Is idempotent and tolerant of missing/old files.
- [ ] Add an offline CLI/job to re-ingest all `completed_games/*.json` for backfill.

### Phase 3 – Streaming improvements

- [ ] Design `snakeBenchService.runMatchStreaming` interface and `WormArenaFrameEvent` payloads end-to-end.
- [ ] Update Python SnakeBench (optionally) to output per-round JSON lines that are easy for Node to parse into frames.
- [ ] Wire `wormArenaStreamController.stream` to use the streaming variant and emit real frames, not just final summary.

### Phase 4 – Metrics & ratings

- [ ] Implement aggregate calculators (per-model win rate, avg score, cost metrics, death reasons) reading from `worm_arena_*`.
- [ ] Decide whether to implement a simple Elo or leave ratings out for now.
- [ ] Provide a backfill script to recompute these aggregates from all stored JSONs.

### Phase 5 – API & UI integration

- [ ] Add `/api/wormarena/metrics/*` endpoints (read-only, public).
- [ ] Update WormArena replay page to surface WormArena metrics.
- [ ] Update WormArenaLive to better display live status and final summary using the new derived fields.

---

## 7. Guardrails & compatibility notes

- **Do not depend** on Greg’s external Postgres or Supabase being present; treat them as optional.
- **Never require auth** for WormArena endpoints, consistent with ARC Explainer’s external research focus.
- Preserve SnakeBench as an **upstream-compatible submodule**: avoid modifying its schema or behavioral contracts in breaking ways.
- All WormArena-specific logic (ingestion, metrics, ratings) should live in ARC Explainer’s Node/TypeScript layers and DB schema, not inside `external/SnakeBench`.
