# 2025-12-11 - Worm Arena live streaming and tournament defaults plan

Author: GPT-5.1 Codex CLI  
Date: 2025-12-11  
Scope: Worm Arena live streaming reliability, GPT-5-first defaults, and tournament scheduling UX/logic across `/worm-arena` and `/worm-arena/live` (frontend) plus `wormArenaStreamController` / `snakeBenchService` (backend).

## Goals and success criteria
- Live matches stream reliably end-to-end using the documented SSE handshake (prepare + stream) without losing frames, status, or final summaries; replay JSON and DB rows still land as today.
- Default model presets on Worm Arena favor the GPT-5 family while keeping other models opt-in.
- Tournament starts are sensible: each model plays a different opponent, prioritizing models with the fewest total games and opponent pairs that have never occurred.
- Users can launch a “smart tournament” that auto-fills fair pairings, shows why each pairing was chosen, and opens the live view with clear progress.

## Current state and observed gaps
- Streaming: `runMatch` only returns a final JSON; `runMatchStreaming`/SSE wiring exists on paper but does not yet forward stdout/live state from the Python loop (`external/SnakeBench/backend/main.py` + `data_access/live_game.py`). Live endpoints in Python are pollable but not surfaced to the client.
- UI: Worm Arena replay and live pages share components but the live page does not yet expose tournament-friendly controls or pairing rationale; default selectors list all models, not GPT-5-first.
- Scheduling: Multi-opponent flow (see 2025-12-10 multi-opponent refactor plan) still relies on manual opponent selection; no automatic priority for low-play models or unseen opponent pairs.
- Data flow reminder (must stay intact): PowerShell scripts or UI -> `/api/wormarena/prepare` -> `wormArenaStreamController` -> `snakeBenchService.runMatch*` -> Python game engine -> DB + `completed_games/` -> replay/stats viewers. Replay persistence and DB writes are non-negotiable.

## Plan A - Streaming hardening (backend + SSE)
1) Service layer: refactor `snakeBenchService.runMatch` onto a robust `runMatchStreaming` that:
   - Emits `starting` immediately, `in_progress` on first stdout or live poll, `completed/failed` on exit.
   - Parses stdout lines opportunistically: if structured JSON frames appear, emit `stream.frame`; otherwise emit `stream.status` logs per round (leveraging `Finished round ...` prints).
   - On close, parses final JSON exactly as today, triggers DB/file persistence, then emits `stream.complete` with `gameId`.
   - Includes timeouts, kill-on-exit, and SSE heartbeat via `SSEStreamManager` to avoid orphaned sessions.
2) Live snapshots: optionally poll Python `GET /api/games/live/:id` after `gameId` is known to enrich frames if stdout lacks structure; merge with stdout events without duplicating rounds.
3) Controller: ensure `/api/wormarena/prepare` + `/api/wormarena/stream/:sessionId` follow the two-step SSE handshake already documented in `docs/reference/api/SnakeBench_WormArena_API.md` and reuse the same event names as the 2025-12-09 streaming plan.
4) Telemetry: log match duration, rounds streamed, and whether live snapshots were used; surface stream errors to the client and close SSE cleanly.

## Plan B - GPT-5-first defaults
1) Model catalog: derive the GPT-5 family from `server/config/models.ts` (e.g., `openai/gpt-5`, `gpt-5.1`, `gpt-5.1-codex-mini`, `gpt-5.2`), respecting current availability flags.
2) Default selections: on Worm Arena setup/lobby, preselect GPT-5 models for both “My model” and auto-generated opponents; keep a “Show all models” expander to preserve full access.
3) Validation: guard against self-play and ensure fallbacks when a GPT-5 entry is disabled or missing pricing; surface a clear notice if no GPT-5 models are available in the current environment.
4) Docs/tooltips: label the defaults as “GPT-5-first (can switch to any model)” to keep the UX clear for hobbyist users.

## Plan C - Smart tournament scheduling (prioritize low-play and unseen pairs)
1) Data inputs:
   - `public.games` and `public.game_participants` filtered to Worm Arena (`game_type = 'arc-explainer'`) for per-model game counts and pair counts.
   - Local replay index (`completed_games/game_index.json`) as a fallback for counts when DB rows are missing.
2) Priority function (per candidate pairing A vs B):
   - Base score = (gamesPlayedA + gamesPlayedB) with a strong bonus for zero-game models.
   - Add large negative weight for unseen pairs (pairCount(A,B) = 0) to prioritize novel opponents.
   - Secondary tie-breakers: highest sigma/uncertainty if available from model stats; otherwise random shuffle to avoid deterministic repetition.
3) Scheduler flow:
   - Compute metrics once when opening the tournament tab; cache for the session.
   - Generate a batch of N pairings (default 9) where each model appears at most once unless the pool is too small.
   - Validate model availability (OpenRouter/OpenAI) before finalizing the queue; drop or replace unavailable models.
   - Emit the chosen pair list to the UI with “why picked” badges (low games, unseen pair, high uncertainty).
4) Backend execution:
   - Extend `wormArenaStreamController` to accept a prepared queue of `(modelA, modelB)` pairs (superset of current opponents array).
   - Execute sequentially via `runMatchStreaming`, emitting `batch.match.start/complete` per pairing; persist each match normally.
5) Post-run wiring:
   - Live page shows progress across pairings, replay links, and a CTA to open the completed match in `/worm-arena?matchId=...`.

## Plan D - Page/UI redesign for sensible tournaments
1) Split tabs: “Replay”, “Live”, “Tournament”. Tournament tab hosts the smart pairing table and GPT-5-first presets.
2) Tournament setup panel:
   - Model picker (default GPT-5), opponent pool summary, “Smart pairings” preview list with rationale tags, and a single “Start tournament” button.
   - Status strip mirroring Saturn/analysis streaming (state badge, round counter, latest log).
3) Live board integration:
   - Reuse `WormArenaGameBoard` for the active pairing; show upcoming/remaining pairings in a side list.
   - On completion, offer “Watch replay” and “Next pairing” controls.
4) Accessibility and clarity:
   - Plain language labels (“We picked this opponent because they have 1 game and have never played you”).
   - Keep the farm aesthetic; avoid dense admin styling.

## Plan E - Testing and rollout
- Unit: scheduler priority function, SSE event sequencing, GPT-5 default selection fallback.
- Integration: end-to-end live run with stdout-only streaming; run with live polling enabled; verify replay JSON saved and DB rows inserted.
- UI: manual smoke on Replay/Live/Tournament tabs; confirm tournament queue avoids duplicate pairings when enough models exist.
- Monitoring: log per-session streaming health and pairing reasons for auditability.

## Open questions for the user
- Acceptable default tournament size? (Assuming 9 to align with placement, but can tune.)
- Should we strictly lock defaults to GPT-5 or allow “include non-GPT-5” toggle in the smart generator?
- Is it acceptable to auto-open the live tab for tournaments, or should we stay within the main page?
