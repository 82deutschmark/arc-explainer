# 2025-12-16 – SnakeBench Local Replay Output Directory Plan

## Goal
Stop local SnakeBench game runs from writing generated replay JSONs into tracked paths that block `git pull`.

## Problem
SnakeBench currently writes replays to `backend/completed_games/`.

That folder can contain tracked files from upstream. When local runs create untracked `snake_game_*.json` (or modify tracked artifacts like `game_index.json`), future pulls can fail with:

- untracked files would be overwritten by merge

## Solution
Introduce an environment-variable controlled replay directory so local output can be redirected to a local-only folder.

- Environment variable: `SNAKEBENCH_COMPLETED_GAMES_DIR`
- Default: `completed_games` (keeps upstream behavior unchanged)
- Recommended local value for arc-explainer: `completed_games_local`

## Files to Change
- `external/SnakeBench/backend/main.py`
- `external/SnakeBench/backend/app.py`
- `external/SnakeBench/backend/services/video_generator.py`
- `external/SnakeBench/backend/cli/analyze_local_games.py`
- `external/SnakeBench/backend/cli/generate_videos_local.py`
- `external/SnakeBench/backend/cli/backfill_videos.py`
- `external/SnakeBench/backend/tests/test_main.py`
- `external/SnakeBench/.gitignore`
- `CHANGELOG.md`

## Execution
1. Implement a shared helper (per-file, minimal) to resolve the completed-games directory using `SNAKEBENCH_COMPLETED_GAMES_DIR`.
2. Make all local replay reads/writes use that directory.
3. Add `backend/completed_games_local/` (and local video output folders) to `.gitignore`.
4. Clean current working tree conflicts in `external/SnakeBench` and then pull.

## Verification
- Running a local game writes `snake_game_*.json` under `backend/completed_games_local/`.
- `git status` in `external/SnakeBench` stays clean after local runs.
- `git pull --tags origin main` succeeds even after local runs.
