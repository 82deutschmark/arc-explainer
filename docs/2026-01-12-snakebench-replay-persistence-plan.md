# 2026-01-12 - SnakeBench Replay Persistence Plan

## Goal
Ensure Worm Arena and SnakeBench matches persist replays and metadata end to end in production, with consistent replay paths across Python, Node, DB, and the replay resolver.

## Context
- Production matches write replay JSONs to completed_games_local by default.
- The Node runner only checks completed_games for completedGamePath, so DB ingest can miss the file.
- DB rows can end up without replay_path and without full replay ingestion.

## Scope
- Align completed games directory selection between Node and Python.
- Return correct completedGamePath from the runner with fallbacks.
- Store accurate replay_path in DB based on actual file location.
- Align game_index.json handling with the configured completed games directory.
- Update docs and the changelog.

## Non-goals
- Rebuild historical replays that are missing from disk.
- Modify UI layouts or workflows.

## Plan
1. ~~Add a server-side helper to resolve the completed games directory using env override and production default.~~ **Done**
2. ~~Pass SNAKEBENCH_COMPLETED_GAMES_DIR into Python spawn env and update snakebench_runner.py to locate replays in the resolved directory with fallbacks.~~ **Done**
3. ~~Update GameWriteRepository replay parsing to derive replay_path relative to the backend dir so completed_games_local is preserved.~~ **Done**
4. ~~Update GameIndexManager and SnakeBenchService to use the resolved directory, and align any backfill script paths with it.~~ **Done**
5. ~~Update docs to clarify replay storage behavior and add a changelog entry.~~ **Done**

## Verification
- Run a match and confirm completedGamePath is set and replay_path is stored in the DB.
- Confirm /api/snakebench/games and /api/snakebench/games/:id return the replay.
- Confirm listGames fallback works when the DB is unavailable.

## Status
**Completed** – 2026-01-12
