# 2025-12-09 – WormArena Stats Parity Plan (Mirror Greg/SnakeBench)

**Author:** Cascade (OpenAI / ARC Explainer agents)

## 1. Goal

Give WormArena “SnakeBench-grade” stats without depending on Greg’s Postgres or Supabase. We want to:

- Consume the same *signals* Greg uses (completed game JSON from SnakeBench).
- Aggregate them with the same *semantics* (per-game + per-participant + per-model aggregates).
- Optionally add our own lightweight ratings, without re-implementing his full TrueSkill + backfill pipeline.

All of this lives in **ARC Explainer’s Node/TypeScript backend + DB**, not inside `external/SnakeBench`.

---

## 2. Source of Truth: SnakeBench Completed Game JSON

SnakeBench already emits rich replay files under:

- `external/SnakeBench/backend/completed_games/snake_game_<id>.json`

Each file has (simplified schema):

```jsonc
{
  "version": 1,
  "game": {
    "id": "e6d…fac8",
    "started_at": "2025-12-10T00:41:06.273786",
    "ended_at": "2025-12-10T00:57:59.346174",
    "game_type": "arc-explainer",
    "max_rounds": 150,
    "rounds_played": 11,
    "board": { "width": 10, "height": 10, "num_apples": 5 }
  },
  "players": {
    "0": {
      "name": "openai/gpt-5.1-codex-mini",
      "result": "tied",               // won|lost|tied
      "final_score": 3,                // apples eaten
      "death": { "reason": "head_collision", "round": 10 },
      "totals": {
        "input_tokens": 11318,
        "output_tokens": 8287,
        "cost": 0.0
      }
    },
    "1": { … }
  },
  "totals": {
    "cost": 0.0,
    "input_tokens": 30001,
    "output_tokens": 14853
  },
  "initial_state": { … },
  "frames": [
    {
      "round": 0,
      "state": { "snakes": …, "apples": …, "scores": … },
      "moves": {
        "0": {
          "move": "UP",
          "rationale": "…",
          "input_tokens": 1029,
          "output_tokens": 430,
          "cost": 0.0
        },
        "1": { … }
      }
    },
    …
  ],
  "metadata": { … }
}
```

These are the **same fields** Greg feeds into:

- `insert_game` / `complete_game` (per-game rows in `games`).
- `insert_game_participants` (per-participant rows in `game_participants`).
- `update_model_aggregates` (wins/losses/ties/apples/games_played per model).
- `update_trueskill_ratings` (TrueSkill per model per game).

**Plan:** Treat these JSON files as our **canonical telemetry feed** and build WormArena stats purely from them.

---

## 3. Target Data Model in ARC Explainer

We introduce WormArena-facing tables (names indicative, final naming via Drizzle migration):

### 3.1. `worm_arena_games`

One row per completed replay file.

- `game_id` (PK, string) – `game.game_id` / `game.id`.
- `started_at`, `ended_at` – from `game.started_at` / `ended_at`.
- `game_type` – from `game.game_type` (e.g. `arc-explainer`).
- `board_width`, `board_height`, `num_apples` – from `game.board`.
- `max_rounds`, `rounds_played` – `game.max_rounds`, `game.rounds_played`.
- `model_a_name`, `model_b_name` – from `players`.
- `total_score` – sum of `players[*].final_score`.
- `total_cost` – `totals.cost`.
- `total_input_tokens`, `total_output_tokens` – from `totals`.
- `replay_path` – local JSON path.

### 3.2. `worm_arena_participants`

One row per model per game, analogous to SnakeBench’s `game_participants`.

- `game_id` (FK → `worm_arena_games.game_id`).
- `player_slot` (0, 1, …) – key in `players` map.
- `model_name` – `players[slot].name`.
- `result` – `won|lost|tied` from `players[slot].result`.
- `final_score` – apples eaten for that player.
- `death_round` – `players[slot].death.round` (nullable).
- `death_reason` – `players[slot].death.reason` (nullable).
- `total_cost` – `players[slot].totals.cost`.
- `total_input_tokens`, `total_output_tokens` – `players[slot].totals`.

### 3.3. `worm_arena_decisions` (optional, for deep analysis)

One row per move per player per game.

- `game_id`, `player_slot`, `round`.
- `move` – `UP|DOWN|LEFT|RIGHT`.
- `rationale` – full reasoning text.
- `input_tokens`, `output_tokens`, `cost` – per-move tokens/cost.
- `reasoning_length_chars` – derived length for quick filtering.
- `is_provider_error_fallback` – boolean if rationale starts with provider error message.

This table enables decision-quality analyses (e.g. score vs. tokens vs. reasoning length), but we can ship an MVP without it.

### 3.4. `worm_arena_model_aggregates`

Per-model aggregates computed from `worm_arena_participants`.

- `model_name` (PK).
- `games_played`.
- `wins`, `losses`, `ties`.
- `apples_eaten_total`.
- `total_cost`.
- `total_input_tokens`, `total_output_tokens`.
- `death_wall`, `death_head_collision`, `death_body_collision`, `death_other`.
- Derived convenience columns (denormalized):
  - `win_rate` = wins / games_played.
  - `avg_score` = apples_eaten_total / games_played.
  - `avg_cost_per_game` = total_cost / games_played.
  - `avg_cost_per_point` = total_cost / apples_eaten_total (guarded for zero apples).

Later, if we want ratings:

- `rating_mu`, `rating_sigma`, `rating_exposed`, `rating_display` (if we port TrueSkill or implement a simpler Elo variant).

---

## 4. Aggregation Logic (Mirroring Greg’s Semantics)

### 4.1. Per-game ingestion

Given a parsed replay JSON:

1. **Game row (`worm_arena_games`)**
   - `game_id` = `game.id` (or `metadata.game_id` fallback).
   - `started_at` / `ended_at` from `game.started_at` / `ended_at`.
   - `board_*` and `num_apples` from `game.board`.
   - `max_rounds`, `rounds_played` from `game.max_rounds`, `game.rounds_played`.
   - `model_a_name`, `model_b_name` from `players["0"].name` and `players["1"].name`.
   - `total_score` = `Σ players[*].final_score`.
   - `total_cost` = `totals.cost`.
   - `total_input_tokens`/`output_tokens` from `totals`.
   - `replay_path` = local file path.

2. **Participant rows (`worm_arena_participants`)**
   For each `sid` in `players`:
   - `player_slot` = `Number(sid)`.
   - `model_name` = `players[sid].name`.
   - `result` = `players[sid].result` (exact string from JSON).
   - `final_score` = `players[sid].final_score`.
   - `death_round` / `death_reason` from `players[sid].death` or `null`.
   - `total_cost` / tokens from `players[sid].totals`.

This mirrors Greg’s `insert_game` + `insert_game_participants` pipeline; we just do it in Node.

### 4.2. Per-model aggregates (how Greg’s `update_model_aggregates` behaves)

To mirror his semantics, we process **finished games in chronological order** (by `started_at` or `ended_at`). For each participant row:

- Increment `games_played`.
- If `result == 'won'` → `wins++`.
- If `result == 'lost'` → `losses++`.
- If `result == 'tied'` → `ties++`.
- `apples_eaten_total += final_score`.
- `total_cost += total_cost`.
- `total_input_tokens += total_input_tokens`.
- `total_output_tokens += total_output_tokens`.
- Death buckets:
  - If `death_reason == 'wall'` → `death_wall++`.
  - If `death_reason == 'head_collision'` → `death_head_collision++`.
  - If `death_reason == 'body_collision'` → `death_body_collision++`.
  - Else if any `death_reason` present → `death_other++`.

After visiting all games, compute **derived columns**:

- `win_rate = wins / games_played` (0 if denominator is 0).
- `avg_score = apples_eaten_total / games_played`.
- `avg_cost_per_game = total_cost / games_played`.
- `avg_cost_per_point = total_cost / max(1, apples_eaten_total)`.

These formulas are consistent with how Greg reads from `game_participants` and then updates model aggregates.

### 4.3. Decision-level stats (optional)

If we populate `worm_arena_decisions`, we can calculate extras:

- `avg_reasoning_length_chars` or `avg_tokens_per_move` per model.
- Correlations:
  - Higher reasoning length → higher score or survival.
  - Cost spikes near critical collisions.

But we keep these as **secondary**; main parity is at game + participant level.

---

## 5. Ingestion & Backfill Strategy

### 5.1. Online ingestion on game completion

Hook into `snakeBenchService.runMatch` (already returns `gameId` and `completed_game_path`):

1. After a successful match:
   - Fire-and-forget call to a new **WormArenaIngestionService**:
     - `ingestCompletedGame(completedGamePath: string): Promise<void>`.

2. `ingestCompletedGame` steps:
   - Parse JSON.
   - Upsert row in `worm_arena_games`.
   - Upsert rows in `worm_arena_participants`.
   - Mark the game as “ingested” in some internal tracking (e.g. `worm_arena_games.ingested = true` if needed).

3. Aggregates update strategy:
   - **Option A (simple):** after each game, run a short aggregation job that recomputes aggregates for **only the models in that game**.
   - **Option B (batch):** periodically run a full rebuild (see backfill below) and just store raw per-game/participant rows.

### 5.2. Offline backfill (SnakeBench-style)

Provide a Node script (e.g. `scripts/wormarena-backfill.ts`):

1. **Reset** `worm_arena_model_aggregates` (truncate table or set counters to 0).
2. Enumerate all `completed_games/snake_game_*.json`.
3. Sort them by `game.started_at` (or file mtime as fallback).
4. For each game:
   - Ensure it exists in `worm_arena_games` / `worm_arena_participants` (ingest if missing).
   - Apply the per-model aggregate update rules from §4.2.

This mirrors Greg’s `cli/backfill_full_stats.py` philosophy: deterministic recomputation from raw game logs.

---

## 6. API Shape for WormArena Stats

All endpoints remain **public, no auth**, consistent with ARC Explainer rules.

### 6.1. Per-model stats

`GET /api/wormarena/models` → returns an array of model aggregates:

```ts
interface WormArenaModelStats {
  modelName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;           // 0–1
  avgScore: number;          // apples per game
  avgCostPerGame: number;
  avgCostPerPoint: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  deathWall: number;
  deathHeadCollision: number;
  deathBodyCollision: number;
  deathOther: number;
}
```

### 6.2. Recent games

`GET /api/wormarena/games/recent?limit=20` →

- Reads from `worm_arena_games` (or `game_index.json` for filename + time) and joins `worm_arena_participants` for scores/results.
- Powers WormArena “recent matches” and tooltips.

### 6.3. Single game

`GET /api/wormarena/games/:gameId` →

- Returns raw replay JSON (parsed) plus our normalized stats, e.g.:

```ts
interface WormArenaGameDetails {
  replay: SnakeBenchReplayJson; // direct JSON
  gameRow: WormArenaGameRow;    // from worm_arena_games
  participants: WormArenaParticipantRow[];
}
```

This is the primary backing for the WormArena replay page.

---

## 7. Implementation Phases

### Phase 1 – Schema & service skeleton

- [ ] Design Drizzle schema for `worm_arena_games`, `worm_arena_participants`, `worm_arena_model_aggregates` (and optionally `worm_arena_decisions`).
- [ ] Implement `WormArenaIngestionService` in Node:
  - `parseReplayFile(path) → { game, players, totals, frames }`.
  - `upsertGameAndParticipants(parsed)`.

### Phase 2 – Hook into `snakeBenchService.runMatch`

- [ ] After successful match, call `ingestCompletedGame(completedGamePath)` asynchronously.
- [ ] Ensure idempotency (re-ingest same game is safe, keyed by `game_id`).

### Phase 3 – Aggregates & backfill

- [ ] Implement `wormArenaModelAggregatesRepository` with APIs to:
  - Recompute aggregates for given models.
  - Truncate + full recompute.
- [ ] Add `scripts/wormarena-backfill.ts` that reads all JSONs and regenerates aggregates.

### Phase 4 – API & UI wiring

- [ ] Add `/api/wormarena/models`, `/api/wormarena/games/recent`, `/api/wormarena/games/:gameId`.
- [ ] Update WormArena page to:
  - Display per-model stats near matchups (win rate, avg score, cost per point).
  - Surface death-reason breakdown for each model.

### Phase 5 – Optional decision-level analytics

- [ ] If needed, implement `worm_arena_decisions` ingestion and expose:
  - Reasoning-length vs. performance.
  - Token efficiency by move type.

---

## 8. Non-goals & Guardrails

- We **do not** depend on Greg’s Postgres, Supabase, or Celery being online.
- We **do not** modify `external/SnakeBench` schemas or logic, beyond potential optional logging improvements.
- We treat SnakeBench as a **log producer** and ARC Explainer as the **analytics and presentation layer**.
- All WormArena stats must be reproducible solely from local `completed_games/snake_game_*.json`.
