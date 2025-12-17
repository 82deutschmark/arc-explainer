# SnakeBench & Worm Arena API Reference

**Author:** Cascade  \
**Date:** 2025-12-17  \
**Purpose:** Document the public SnakeBench and Worm Arena HTTP APIs exposed by ARC Explainer for running matches, querying game stats, and streaming live tournaments.

All endpoints described here are **public** and require **no authentication**.

---

## 1. Overview

The embedded SnakeBench backend powers Worm Arena (LLM Snake) inside ARC Explainer. This integration exposes two families of public endpoints:

1. **SnakeBench API** – JSON-based endpoints under `/api/snakebench/*` for:
   - Running matches and batches
   - Listing and loading replays
   - Health checks
   - TrueSkill-style stats and leaderboards
   - Worm Arena "greatest hits" summaries

2. **Worm Arena Live Streaming API** – SSE wrapper under `/api/wormarena/*` for watching live Worm Arena matches and multi-opponent batches.

These APIs are primarily used by:

- The Worm Arena pages in the ARC Explainer frontend
- Local tournament scripts under `scripts/worm-arena-tournaments/`
- External research scripts that want direct access to replay data and model stats

---

## 2. SnakeBench Match & Replay API

### 2.1 Run a Single Match

**Endpoint:**

```text
POST /api/snakebench/run-match
```

**Description:** Run a single Worm Arena match between two LLM models via the embedded SnakeBench backend.

**Request Body (JSON):**

```json
{
  "modelA": "openai/gpt-5-nano",
  "modelB": "moonshotai/kimi-k2-thinking",
  "width": 10,          // optional, default 10 (clamped to [4, 50])
  "height": 10,         // optional, default 10 (clamped to [4, 50])
  "maxRounds": 150,     // optional, default 150 (clamped to [10, 500])
  "numApples": 5,       // optional, default 5 (clamped to [1, 20])
  "apiKey": "...",     // optional BYO provider key, never stored
  "provider": "openrouter"  // optional, one of: openrouter | openai | anthropic | xai | gemini
}
```

**Notes:**

- `modelA` and `modelB` must be valid **OpenRouter model slugs**.
- ARC Explainer accepts:
  - curated OpenRouter slugs present in the central `MODELS` config, and
  - DB-discovered OpenRouter slugs marked active (so newly-discovered models can be used immediately).
- If `apiKey` + `provider` are supplied, the backend uses that key only for this match (BYO key); otherwise it uses server-side keys.

**Response (success):**

```json
{
  "success": true,
  "result": {
    "gameId": "836b435a-bfcf-4a5e-be66-d87dd0d92153",
    "modelA": "openai/gpt-5-nano",
    "modelB": "moonshotai/kimi-k2-thinking",
    "scores": {
      "openai/gpt-5-nano": 12,
      "moonshotai/kimi-k2-thinking": 10
    },
    "results": {
      "openai/gpt-5-nano": "won",
      "moonshotai/kimi-k2-thinking": "lost"
    },
    "completedGamePath": "external/SnakeBench/backend/completed_games/snake_game_836b435a-bfcf-4a5e-be66-d87dd0d92153.json"
  },
  "timestamp": 1733920000000
}
```

On failure, `success=false` and `error` contains a message.

---

### 2.2 Run a Batch of Matches

**Endpoint:**

```text
POST /api/snakebench/run-batch
```

**Description:** Run `count` sequential matches between the same pair of models.

**Request Body:** Same as `/run-match`, plus:

```json
{
  "count": 9
}
```

- `count` is a small positive integer, clamped to an internal safety limit (currently 10).

**Response (success):**

```json
{
  "success": true,
  "batch": {
    "results": [
      { "gameId": "...", "modelA": "...", "modelB": "...", "scores": { ... }, "results": { ... } }
      // up to "count" entries
    ],
    "errors": [
      { "index": 3, "error": "Model 'foo' not available for SnakeBench" }
    ]
  },
  "timestamp": 1733920000000
}
```

---

### 2.3 List Games & Load Replays

#### List Recent Games

```text
GET /api/snakebench/games?limit=50
```

- **Query:** `limit` (optional) – max number of summaries to return.
- **Behavior:** Only returns matches that have an available replay asset (local file, DB `replay_path` URL, or GitHub raw fallback). This prevents the UI from offering non-replayable matches.
- **Response:**

```json
{
  "success": true,
  "games": [
    {
      "gameId": "836b435a-bfcf-4a5e-be66-d87dd0d92153",
      "filename": "snake_game_836b435a-bfcf-4a5e-be66-d87dd0d92153.json",
      "startedAt": "2025-12-11T02:51:32.618418",
      "totalScore": 22,
      "roundsPlayed": 56,
      "path": "external/SnakeBench/backend/completed_games/snake_game_836b435a-bfcf-4a5e-be66-d87dd0d92153.json"
    }
  ],
  "total": 600,
  "timestamp": 1733920000000
}
```

#### Get Full Game JSON

```text
GET /api/snakebench/games/:gameId
```

- **Path:** `gameId` – SnakeBench game UUID.
- **Response:**

```json
{
  "success": true,
  "gameId": "836b435a-bfcf-4a5e-be66-d87dd0d92153",
  "data": { /* full SnakeBench replay JSON */ },
  "timestamp": 1733920000000
}
```

If the replay asset is missing (local file, DB `replay_path`, and remote fallback all fail), `success=false` with an `error` message.

---

### 2.4 Health & Recent Activity

#### Health Check

```text
GET /api/snakebench/health
```

- Verifies Python availability, embedded backend directory, and runner script.
- Response shape: `SnakeBenchHealthResponse` (see `shared/types.ts`).

#### Recent Activity

```text
GET /api/snakebench/recent-activity?days=7
```

- **Query:**
  - `days` (optional): Number of days of history (default 7). Use `all` to disable filtering.
- Returns aggregated recent-match stats used by the Worm Arena stats page.

---

## 3. SnakeBench Stats & Leaderboards

### 3.1 Basic Leaderboard

```text
GET /api/snakebench/leaderboard?limit=50&sortBy=winRate
```

- **Query:**
  - `limit` (optional): 1–150 (default 10).
  - `sortBy` (optional): `winRate` or `gamesPlayed` (default `gamesPlayed`).
- Response includes per-model wins, losses, ties, apples, games played.

### 3.2 Global Worm Arena Stats

```text
GET /api/snakebench/stats
```

- Returns `SnakeBenchArcExplainerStats` with:
  - `totalGames`, `activeModels`, `topApples`, `totalCost`.

### 3.3 Per-Model Rating & History

#### Model Rating

```text
GET /api/snakebench/model-rating?modelSlug=openai/gpt-5-nano
```

- Returns TrueSkill-like snapshot and aggregate stats for a single model.

#### Match History

```text
GET /api/snakebench/model-history?modelSlug=openai/gpt-5-nano&limit=50
```

- **Query:** `modelSlug` (required), `limit` (optional).
- Returns recent head-to-head match history for that model.

### 3.4 TrueSkill Leaderboard

```text
GET /api/snakebench/trueskill-leaderboard?limit=150&minGames=3
```

- **Query:**
  - `limit` (optional): Max entries (default 150).
  - `minGames` (optional): Minimum games per model (default 3).
- Response: `SnakeBenchTrueSkillLeaderboardResponse` with `entries[]` containing:
  - `mu`, `sigma`, `exposed`, `displayScore`, `gamesPlayed`, `wins`, `losses`, `ties`, `applesEaten`, `topScore`, `winRate`, `totalCost`.

---

## 4. Worm Arena Greatest Hits API

```text
GET /api/snakebench/greatest-hits?limitPerDimension=5
```

- **Purpose:** Return a curated list of especially interesting Worm Arena games (longest, most expensive, highest-scoring).
- **Query:** `limitPerDimension` (optional, default 5, small number).
- Response: `WormArenaGreatestHitsResponse` with `games[]` of:
  - `gameId`, `startedAt`, `modelA`, `modelB`,
  - `roundsPlayed`, `maxRounds`, `totalCost`,
  - `maxFinalScore`, `scoreDelta`, `boardWidth`, `boardHeight`,
  - `highlightReason` (human-readable label such as "Longest game by rounds").

**Important:**

- This endpoint is generated from the **database** (`public.games`, `public.game_participants`).
- The service layer filters results so only games with an available replay asset are returned.
- See `docs/reference/data/WormArena_GreatestHits_Local_Analysis.md` for details.

---

## 5. Worm Arena Live Streaming API (SSE)

Worm Arena live matches use a two-step SSE pattern similar to the analysis streaming API:

1. `POST /api/wormarena/prepare` – Prepare a session and store match config.
2. `GET /api/wormarena/stream/:sessionId` – Open SSE stream, run matches, and receive events.

### 5.1 Prepare Live Session

```text
POST /api/wormarena/prepare
```

**Body (multi-opponent batch mode):**

```json
{
  "modelA": "openai/gpt-5-nano",          // required
  "opponents": [                           // required in new format
    "moonshotai/kimi-k2-thinking",
    "mistralai/devstral-2512"
  ],
  "width": 10,                             // optional
  "height": 10,
  "maxRounds": 150,
  "numApples": 5,
  "apiKey": "...",                        // optional BYO key
  "provider": "openrouter"                // optional, see SnakeBench section
}
```

**Legacy body (count-based mode):**

```json
{
  "modelA": "openai/gpt-5-nano",
  "modelB": "moonshotai/kimi-k2-thinking",
  "count": 9
}
```

- In legacy mode, `modelB` and `count` are required; the controller converts this to a repeated opponents array.

**Response:**

```json
{
  "success": true,
  "sessionId": "abc123-session-uuid",
  "expiresAt": "2025-12-11T17:00:00.000Z"
}
```

Sessions expire after a short TTL (currently 5 minutes) if the SSE connection is never opened.

---

### 5.2 Stream Live Matches via SSE

```text
GET /api/wormarena/stream/:sessionId
```

- **Path:** `sessionId` – ID from the prepare step.
- **Protocol:** Server-Sent Events (SSE). The response is a long-lived HTTP connection that emits events in `event: <type>` / `data: <json>` format.

#### Event Types

The stream uses the shared Worm Arena streaming types defined in `shared/types.ts`:

- `WormArenaStreamStatus`
- `WormArenaBatchMatchStart`
- `WormArenaBatchMatchComplete`
- `WormArenaBatchComplete`
- `WormArenaBatchError`
- `WormArenaFinalSummary` (for single-match legacy mode)

Typical event flow in **batch mode**:

1. `event: batch.init` – initial batch metadata
   - `data`:
     ```json
     { "totalMatches": 3, "modelA": "openai/gpt-5-nano", "opponents": ["..."] }
     ```

2. For each opponent in order:
   - `event: batch.match.start` – match index + opponent slug
   - `event: stream.status` – `state: "in_progress"`, human-readable status message
   - `event: batch.match.complete` – per-match result:
     ```json
     {
       "index": 1,
       "total": 3,
       "gameId": "...",
       "modelA": "openai/gpt-5-nano",
       "modelB": "moonshotai/kimi-k2-thinking",
       "scores": { ... },
       "results": { ... }
     }
     ```
   - On per-match failure, `event: batch.error` with `index`, `total`, `error`.

3. After all matches:
   - `event: stream.status` – `state: "completed"`, summary message.
   - `event: batch.complete` – final batch summary:
     ```json
     {
       "totalMatches": 3,
       "completedMatches": 2,
       "failedMatches": 1
     }
     ```

In **single-match legacy mode**, the stream emits:

- `event: stream.init` – initial payload (models, timestamps)
- `event: stream.status` – `state: "starting"` / `"completed"`
- `event: stream.complete` – `WormArenaFinalSummary` with `gameId`, `modelA`, `modelB`, `scores`, `results`.

---

## 6. Usage Notes & Best Practices

- **No authentication:** As with all ARC Explainer endpoints, `/api/snakebench/*` and `/api/wormarena/*` are fully public for research and small external tools.
- **Cost awareness:** SnakeBench replays and stats reflect real token costs based on the central `MODELS` pricing. Large tournaments can be expensive; use small `count`/opponent lists.
- **Replay availability:** DB records can exist without matching local replay JSON files. Always handle missing replays gracefully (see `docs/reference/data/WormArena_GreatestHits_Local_Analysis.md`).
- **SSE clients:** When consuming `/api/wormarena/stream/:sessionId` from browsers or Node, use a standard EventSource client and listen for the event types described above.
- **Tournament scripts:** PowerShell helpers under `scripts/worm-arena-tournaments/` are the canonical examples of how to enqueue batches against `/api/snakebench/run-batch`.

For high-level external API coverage across puzzles, analytics, and feedback, see `docs/reference/api/EXTERNAL_API.md`. This document focuses specifically on SnakeBench/Worm Arena endpoints.
