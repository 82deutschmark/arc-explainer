# Worm Arena Tweet Kit Plan

**Status: IMPLEMENTED** (v6.12.4 - Dec 27, 2025)

## Objective
Provide a repeatable process to produce tweet-ready Worm Arena "Greatest Hits" posts containing:
- Short blurb explaining why the match is interesting
- Official site link: `https://arc.markbarney.net/worm-arena?matchId=<gameId>`
- MP4 highlight video rendered from the replay

## Scope
- Uses existing Greatest Hits API and SnakeBench video tooling (no new backend code required in this plan).
- Focuses on workflow and roles: data source, blurb template, video generation, assembly for social.

## Inputs
- **Game ID** from Greatest Hits API (`/api/snakebench/greatest-hits`) or pinned list.
- **Replay JSON** located under `external/SnakeBench/backend/completed_games` (or via API download).
- **Highlight metadata**: `highlightReason`, `roundsPlayed`, `maxFinalScore`, `sumFinalScores`, `totalCost`, `durationSeconds`, `modelA`, `modelB`.

## Outputs
- **Tweet text** (≤240 chars after URL): blurb + models + key stat + link.
- **MP4 video** stored in `external/SnakeBench/backend/completed_games_videos` (or `_local` depending on env).

## Blurb template (examples)
1. Close/high score: `"{modelA} vs {modelB}: {highlightReason} ({roundsPlayed}r, max {maxFinalScore} apples). Watch: <link>"
2. Monster haul: `"{modelA} grabbed {maxFinalScore} apples vs {modelB} — {highlightReason}. Watch: <link>"
3. Duration/cost: `"{modelA} vs {modelB}: {roundsPlayed} rounds, ${totalCost.toFixed(2)} run, {durationLabel}. Watch: <link>"

Rules:
- Trim provider prefixes if too long (optional): keep the last segment after `/`.
- Ensure single space before URL; keep total length under 240 chars.
- Prefer highlightReason from API; fall back to a generic string if missing.

## Video generation pipeline (SnakeBench tooling)
- Renderer: `external/SnakeBench/backend/services/video_generator.py`
- CLIs:
  - `external/SnakeBench/backend/cli/generate_video.py` (single game)
  - `external/SnakeBench/backend/cli/generate_videos_local.py` (batch)
- Assets output: `external/SnakeBench/backend/completed_games_videos/` (or `completed_games_videos_local/` when `SNAKEBENCH_COMPLETED_GAMES_DIR=completed_games_local`).
- Default FPS: 2; Resolution: 1920x1080; Uses Pillow + MoviePy/FFmpeg.

### Prereqs
- Python env with Pillow, moviepy, ffmpeg available (SnakeBench backend requirements.txt).
- Replay JSON present locally (`completed_games` or `completed_games_local`).
- Env var `SNAKEBENCH_COMPLETED_GAMES_DIR` if using non-default location.

### Commands (PowerShell examples, cwd = repo root)
- Single video (local replay):
  ```powershell
  python external/SnakeBench/backend/cli/generate_video.py --game-id <gameId>
  ```
- Batch greatest hits (top N from API saved locally first):
  ```powershell
  python external/SnakeBench/backend/cli/generate_videos_local.py --limit 10
  ```
- Output file naming: `completed_games_videos/snake_game_<gameId>.mp4`

### If replay not local
1) Fetch JSON via API:
   - `GET /api/snakebench/games/<gameId>`; if `replayUrl` returned, download it.
2) Save as `external/SnakeBench/backend/completed_games/snake_game_<gameId>.json` (or `_local`).
3) Run generate_video.py as above.

## Assembly workflow (human/automation)
1) Pick game from Greatest Hits response; copy `gameId`, `highlightReason`, stats.
2) Build link: `https://arc.markbarney.net/worm-arena?matchId=<gameId>`.
3) Choose blurb template and fill values; ensure <240 chars including URL.
4) Generate MP4 via CLI; verify output plays.
5) Post tweet manually (or via API if keys available): attach MP4, paste blurb + link.

## Optional automation ideas
- Small Node/Python script to:
  1) Fetch Greatest Hits JSON.
  2) For each gameId, ensure replay is local (download if needed).
  3) Invoke `generate_video.py` (subprocess) if MP4 missing.
  4) Emit `tweet.txt` per game with composed blurb and link, plus `mp4Path`.
- Add a Make/NPX shortcut: `npm run worm:tweets -- --limit 5` that wraps the script above.

## Risks / notes
- Twitter upload requires API keys and quota; not covered here.
- Very long model slugs may still exceed tweet length; manual edit may be needed.
- Rendering speed depends on FFmpeg availability; ensure it’s on PATH.

## References
- Video service: `external/SnakeBench/backend/services/video_generator.py`
- CLI: `external/SnakeBench/backend/cli/generate_video.py`, `generate_videos_local.py`
- Greatest Hits API: `/api/snakebench/greatest-hits`
- Replay fetch: `/api/snakebench/games/:id`
