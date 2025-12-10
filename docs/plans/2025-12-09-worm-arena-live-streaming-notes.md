# 2025-12-09 — Worm Arena live data from upstream SnakeBench

Author: Codex  
Date: 2025-12-09  
Scope: What already exists in the Python SnakeBench backend for “live” games, and how to tap it from our Node/SSE layer.

## What already exists (Python, external/SnakeBench/backend)
- Live endpoints: `app.py` exposes `GET /api/games/live` and `GET /api/games/<game_id>/live` (see `external/SnakeBench/backend/app.py:553`+). Data is pulled from `data_access/live_game.py`.
- Game loop emits live state each round: `main.py` updates the live DB row every round via `update_game_state(...)` and marks completion via `complete_game(...)`.
- Stdout per round: the game loop prints `Finished round {n}. Alive: ...` each round, so tailing stdout yields incremental progress even if no SSE exists.
- Storage: live state is persisted in the database; completed games still land in `external/SnakeBench/backend/completed_games/` with full JSON replays.
- There is no SSE/WebSocket in Python; the “live” concept is pollable HTTP + DB plus stdout prints.

## How to surface this in our Node/Express layer
- Fastest path: wrap the existing runner process in `snakeBenchService.runMatchStreaming` and stream stdout lines to SSE (`stream.frame`/`stream.status`) while still parsing the final JSON for persistence.
- Optional/alternative: poll the Python live endpoints during the match using the returned `game_id` (once known) and forward snapshots to SSE.
- Keep `/api/snakebench/run-match` behavior unchanged; add a streaming route that reuses the same spawn code but forwards stdout to clients.

## Notes for implementation
- Status events we can emit immediately: `starting` (spawned), `in_progress` (first stdout line), `completed` (final JSON parsed), `failed` (non-zero exit or parse error).
- Frame-ish data: stdout includes per-round prints; if Python later emits structured JSON per line, parse and forward as `stream.frame`.
- Clean up: ensure child is killed on timeout and SSE clients are notified with `stream.error` on failures.

