# 2025-12-11 – Worm Arena Live GPT-5 Tournament & Smart Matchmaking Plan

**Author:** Cascade  
**Date:** 2025-12-11  
**Purpose:** Fix Worm Arena Live streaming UX, standardize on GPT‑5 family defaults, and add smart tournament matchmaking that prioritizes underplayed models and unseen model–model matchups, while fitting into the existing SnakeBench/Worm Arena architecture.

This plan builds on and complements:
- `2025-12-09-worm-arena-streaming-plan.md`
- `2025-12-09-worm-arena-live-streaming-notes.md`
- `2025-12-10-worm-arena-multi-opponent-refactor.md`
- `2025-12-11-worm-arena-greatest-hits-plan.md`

It focuses specifically on **live tournament setup and matchmaking for Worm Arena Live**, with **GPT‑5 as the default family**.

---

## 1. Current State & Gaps

### 1.1 What Works Today

- **Core game pipeline** is solid and in production:
  - `POST /api/snakebench/run-match` → `snakeBenchController.runMatch` → `snakeBenchService.runMatch` → Python `snakebench_runner.py` → `external/SnakeBench/backend/main.py`.
  - Completed games written to `external/SnakeBench/backend/completed_games/` and ingested into Postgres via `SnakeBenchRepository.recordMatchFromResult()` + `ingestReplayFromFile()`.
  - TrueSkill ratings and aggregates maintained via `SnakeBenchRepository.updateAggregatesForGame()` and `updateTrueSkillForGame()`.
- **Replay & stats surfaces** are wired:
  - WormArena replay page (`WormArena.tsx`) shows DB-backed recent games + full replay.
  - Stats & leaderboards use `getTrueSkillLeaderboard`, `getModelRating`, `getModelMatchHistory`, `getBasicLeaderboard`.
- **Live streaming shell exists**:
  - `/api/wormarena/prepare` + `/api/wormarena/stream/:sessionId` via `wormArenaStreamController`.
  - `useWormArenaStreaming` hook subscribes to SSE events (`stream.status`, `batch.*`, etc.).
  - `WormArenaLive.tsx` page exists with a match setup area and a live status/batch table.
- **Multi-opponent batches** work:
  - `wormArenaStreamController` loops over `opponents[]` and runs `snakeBenchService.runMatch` per opponent.
  - Batch progress and results are streamed via `batch.match.start`, `batch.match.complete`, `batch.complete`, etc.

### 1.2 Key Gaps

1. **No true frame-level streaming to Worm Arena Live**
   - `wormArenaStreamController` currently calls blocking `snakeBenchService.runMatch()` and only emits batch-level events.
   - No `stream.frame` events are emitted; `useWormArenaStreaming.frames` never gets populated with live frames.
   - Live board UI (`WormArenaLive.tsx`) usually shows "Waiting for live updates…" instead of animated gameplay.

2. **Default model selection is misaligned with GPT‑5 focus**
   - `WormArenaLive` currently defaults `modelA` to `x-ai/grok-4.1-fast` when available.
   - For this project phase, we want **GPT‑5 family as the primary/default options** (OpenRouter `openai/gpt-5-*` and `openai/gpt-5.1-codex*`).

3. **No smart matchmaking based on games played or unseen matchups**
   - Opponent selection on `WormArenaLive` is currently just **"top N OpenRouter models"**, or manual checkboxes.
   - TrueSkill works best when models:
     - Play **multiple distinct opponents**, not just the same rival.
     - Avoid severe imbalance in games played across models.
   - We are not:
     - Prioritizing models with **low total games played**.
     - Prioritizing **unseen pairings** (model A vs model B never played before).
     - Providing any automated "suggested opponents" UX.

4. **Tournaments vs stats are not clearly connected**
   - Worm Arena Live can run batches, but there is no clear guidance that **GPT‑5 tournaments** should be structured so that:
     - Each GPT‑5 variant plays **every other GPT‑5 variant** (round-robin core).
     - Underplayed GPT‑5 variants are preferentially matched against diverse opponents (including non‑GPT‑5 models, if enabled).
   - Existing PowerShell tournament scripts (`scripts/worm-arena-tournaments/*.ps1`) are not explicitly aligned with the UI-powered tournament UX.

5. **Rate limiting and cost visibility are implicit**
   - Batch size is bounded by `MAX_BATCH_COUNT`, but the UX doesn’t surface:
     - Approximate **token/cost expectations** for multi-match GPT‑5 tournaments.
     - That sequential multi-opponent matches are used to respect provider limits.

6. **Fallback and DB-off modes are not clarified for tournaments**
   - `SnakeBenchRepository` already treats DB as optional (`isConnected()` guards).
   - The tournament UX plan needs to explicitly state:
     - What happens if DB is unavailable (still run games, but some smart matchmaking features may be disabled).
     - How to degrade gracefully in the UI (e.g., fallback to manual opponent selection only).

---

## 2. Goals & Non-Goals

### 2.1 Goals

- **G1 – Live page that “feels live” for tournaments**
  - Users can start a **multi-opponent GPT‑5 tournament** from Worm Arena Live and watch:
    - Live status updates per match.
    - A live (or pseudo-live) board for the **current match**.
    - A running table of completed GPT‑5 vs X games and scores.

- **G2 – GPT‑5-first defaults**
  - Default champion model and presets in Worm Arena Live should come from the **GPT‑5 family** (via OpenRouter), while still allowing other models to be chosen.

- **G3 – Smart tournament matchmaking**
  - Provide a backend-assisted mechanism that suggests **sensible opponents**:
    - Prioritize models with **fewest games played**.
    - Prioritize **unseen pairings** (modelA vs modelB never played).
    - Be aware of **TrueSkill/leaderboard usage**, but not change the rating algorithm itself.

- **G4 – Respect existing architecture & plans**
  - Reuse and extend:
    - `SnakeBenchRepository` for all rating and match history queries.
    - Existing streaming controller + SSE infrastructure.
    - Existing tournament scripts where possible.
  - Stay consistent with existing `docs/plans` Worm Arena docs.

### 2.2 Non-Goals

- **N1:** Redesigning the entire Worm Arena UI layout (that is covered by `WormArenaUI.md` and related plans).
- **N2:** Changing TrueSkill parameters or rating formulas.
- **N3:** Introducing authentication or paywalling any endpoints (all APIs remain public).
- **N4:** Implementing a full Python-side streaming protocol for every frame in this plan. We will **design for it** and optionally stub a simpler “sampled frame” mode, but full high-frequency streaming can be split into a follow-up plan if needed.

---

## 3. High-Level Design

### 3.1 Smart Matchmaking API

Introduce a simple HTTP API that can suggest good opponents for a champion model:

- **Endpoint (proposed):**
  - `GET /api/snakebench/smart-opponents?modelSlug={slug}&limit={n}&scope={scope}`
- **Parameters:**
  - `modelSlug` – champion (usually GPT‑5 variant).
  - `limit` – max number of recommended opponents (default 9 or 10).
  - `scope` – optional filter, e.g.:
    - `gpt5_only` – only suggest GPT‑5 family models.
    - `all` – consider all active models.
- **Response:**
  - Ordered list of opponent candidates with metadata:
    - `modelSlug`
    - `gamesPlayed`
    - `wins / losses / ties`
    - `lastPlayedAt`
    - `hasPlayedChampionBefore: boolean`

**Selection heuristic:**

1. Compute:
   - For each candidate model `m ≠ modelA`:
     - Total `games_played` from `models` aggregates.
     - Whether a game exists where `model_slug = modelA` and `opponent_slug = m`.
2. Score each candidate with a composite score, e.g.:
   - `score = (hasPlayedChampionBefore ? 1 : 0) * W_seen + (gamesPlayed / maxGames) * W_games`
   - Lower `score` = higher priority (unseen and underplayed).
3. Sort ascending by `score`, return top `limit` models.

This leverages existing tables (no schema change) and keeps logic in `SnakeBenchRepository` for SRP.

### 3.2 GPT‑5-First Defaults in Worm Arena Live

Adjust `WormArenaLive.tsx` to:

- Detect GPT‑5 family models using `ModelDefinitions` / `models.ts` metadata (e.g., `modelType === 'gpt5'` or `key`/`apiModelName` starting with `gpt-5` or `openai/gpt-5`).
- When models are loaded and `modelA` is empty:
  - Prefer `openai/gpt-5-mini`, then `openai/gpt-5-nano`, then other GPT‑5 variants.
- Provide **quick-selection buttons** for GPT‑5 presets above the selector:
  - "GPT‑5 Nano", "GPT‑5 Mini", "GPT‑5.1", "GPT‑5.2", "GPT‑5.1 Codex Mini".
- Still allow **any model** to be chosen; GPT‑5 is a UX default, not a hard constraint.

### 3.3 Tournament Structure on the Live Page

For a **GPT‑5-centric tournament** started from Worm Arena Live:

- **Champion mode:** User selects a champion model A (often GPT‑5 variant).
- **Suggested opponents:** Worm Arena Live calls `smart-opponents` to populate a recommended list.
- **User controls:**
  - Can accept all suggested opponents, or toggle them individually.
  - Can optionally add manual opponents (advanced users).
- **Execution:**
  - `startLiveMatch(payload, opponents[])` already maps to `wormArenaStreamController` for sequential execution.
  - For GPT‑5 tournaments, we recommend 5–10 opponents per run, respecting `MAX_BATCH_COUNT`.

Over multiple tournament runs, this naturally focuses on:
- Filling in **missing pairings** between GPT‑5 variants and other models.
- Giving **underplayed GPT‑5 models** more exposure.

### 3.4 Streaming Behaviour

Given current constraints (no Python streaming yet):

- Maintain **batch-level streaming** as the primary mechanism:
  - `stream.status` updates for starting / in-progress / completed.
  - `batch.match.start`, `batch.match.complete`, and `batch.complete` events for tournament progress.
- For the **live board**:
  - Short term: After each `batch.match.complete`, the client can:
    - Immediately fetch the completed game by ID via existing `/api/snakebench/games/:id` and render a **snapshot replay** as if it were “live”.
    - Optionally animate a few frames using the replay data for the latest game.
  - Long term (future plan): Introduce Python → Node frame streaming (`runMatchStreaming`) that surfaces `WormArenaFrameEvent` via SSE in near-real-time.

This plan **does not attempt** to fully implement frame-by-frame streaming but ensures the Live page actually shows gameplay shortly after each match completes.

---

## 4. Implementation Phases

### Phase 1 – Smart Matchmaking Backend

**Objective:** Add a read-only API to compute good opponents for a given model.

**Backend tasks:**
- **T1.1 – Repository helper(s)**
  - Add new methods to `SnakeBenchRepository`:
    - `getModelOpponentStats(modelSlug: string, limit: number, scope?: string)`
      - Uses `game_participants` and `models` to compute, per candidate opponent:
        - `gamesPlayed` (overall)
        - `hasPlayedChampionBefore`
        - `wins/losses/ties` vs all.
    - Alternatively, re-use `getBasicLeaderboard` and join with a small `modelA` vs `modelB` pivot query for seen/unseen edges.
- **T1.2 – Service and controller**
  - Add method to `snakeBenchService`:
    - `getSmartOpponents(modelSlug, options)` that delegates to the repository and applies scoring/ordering.
  - Add controller endpoint:
    - `snakeBenchController.getSmartOpponents` mapped from `GET /api/snakebench/smart-opponents`.
  - Wire route in `server/routes.ts` without any auth.
- **T1.3 – Error handling & DB-off mode**
  - If DB is disconnected or query fails:
    - Return an empty list with a flag like `dbUnavailable: true` so the frontend can gracefully fall back to manual selection.

**Deliverables:**
- New API that returns a ranked set of opponents for a given champion.

### Phase 2 – GPT‑5 Defaults & Smart Opponent UX (Frontend)

**Objective:** Make GPT‑5 tournaments first-class in the Worm Arena Live UI.

**Frontend tasks:**
- **T2.1 – GPT‑5 model detection utility**
  - Add a helper (e.g., in `useModels` or a small util) that filters `ModelConfig[]` down to GPT‑5 family.
  - Use `modelType`, `key`, and/or `apiModelName` to detect GPT‑5 models reliably.
- **T2.2 – Default champion selection**
  - In `WormArenaLive.tsx`, when models load and `modelA` is empty:
    - Set `modelA` to most appropriate GPT‑5 default (e.g., `openai/gpt-5-mini` if present; else `openai/gpt-5-nano`; else first GPT‑5; else existing fallback).
- **T2.3 – GPT‑5 quick-select buttons**
  - Add a small row of buttons in `WormArenaSetup` or `WormArenaLive` labelled with GPT‑5 variants discovered in config.
  - Clicking a button sets `modelA` and refreshes suggested opponents.
- **T2.4 – Smart opponents panel**
  - Create a new hook and/or call within `WormArenaLive`:
    - `useSmartOpponents(modelA, limit, scope)` that hits the new API.
  - Display suggested opponents above the manual checkbox list, with hints:
    - Badge for **"Never played"** vs champion.
    - Badge for **"Low games"** (e.g., `< 5` games overall).
  - Provide a button: **"Use suggested opponents"** to quickly set `selectedOpponents`.
  - If API fails or DB is unavailable, show a subtle message and fall back to existing manual list.

**Deliverables:**
- Worm Arena Live defaults to GPT‑5 champion and surfaces high-quality suggested opponents.

### Phase 3 – Tournament Execution UX Improvements

**Objective:** Make multi-opponent GPT‑5 tournaments understandable and readable while leveraging existing streaming.

**Frontend tasks:**
- **T3.1 – Match progress clarity**
  - Improve batch status text in `WormArenaLive`:
    - Show: `"Match X / N • modelA vs modelB"` prominently when streaming.
    - Reflect failures from `batch.error` events clearly (but non-blocking).
- **T3.2 – Live board snapshot per completed match**
  - When `batch.match.complete` arrives:
    - Fetch `/api/snakebench/games/:id` for that `gameId` (if not already present).
    - Use first few frames from that replay to render a short animated “highlight” on the live board, or at minimum a stable final board state.
  - This makes the Live page **visually dynamic** even before full Python streaming exists.
- **T3.3 – Batch summary enhancements**
  - Extend the existing results table to:
    - Highlight GPT‑5 champion row (if champion is GPT‑5 variant).
    - Provide a quick link into stats or leaderboard for each opponent.

**Deliverables:**
- Tournaments feel structured and informative; the GPT‑5 champion’s run is obvious.

### Phase 4 – (Optional) Frame Streaming Design Hook

**Objective:** Prepare for a future `runMatchStreaming` implementation without overcommitting in this plan.

**Backend design tasks (lightweight, mostly comments/types):**
- **T4.1 – Service API sketch**
  - In `snakeBenchService`, design a `runMatchStreaming()` signature that:
    - Accepts the same request as `runMatch`.
    - Returns an async iterator or callback-based interface for frames and final result.
  - No implementation yet; just clearly documented function shape and TODO.
- **T4.2 – SSE integration points**
  - In `wormArenaStreamController`, identify spots where `stream.frame` events would be emitted for future work.
  - Add TODO comments referencing the Responses API / streaming docs for guidance.

**Deliverables:**
- Clear contract for a future Python/Node streaming upgrade with minimal risk of breaking this plan’s work.

---

## 5. Risks & Mitigations

- **R1 – DB dependency for smart opponents**
  - *Risk:* If the Postgres connection is down, smart matchmaking cannot function.
  - *Mitigation:* API returns an empty list + `dbUnavailable` flag; UI gracefully falls back to manual lists and displays a short note.

- **R2 – GPT‑5 cost and rate limits**
  - *Risk:* GPT‑5 tournaments may be expensive and/or hit provider limits.
  - *Mitigation:* Keep `MAX_BATCH_COUNT` conservative (≤10), run matches sequentially, and optionally surface a note in the UI that GPT‑5 tournaments may be higher cost.

- **R3 – UX complexity**
  - *Risk:* Combining smart suggestions, manual overrides, and GPT‑5 presets could clutter the setup panel.
  - *Mitigation:* Maintain a simple hierarchy:
    - Step 1: Pick champion (GPT‑5 preset buttons + dropdown).
    - Step 2: Accept or tweak smart opponents list.
    - Step 3: Optional advanced manual additions.

- **R4 – Future streaming changes**
  - *Risk:* When full frame-level streaming is added later, it might change the SSE contract.
  - *Mitigation:* Keep `WormArenaFrameEvent` and SSE event names stable; treat new streaming as additive (extra events) rather than breaking existing ones.

---

## 6. Testing & Validation Checklist

- **Backend:**
  - `GET /api/snakebench/smart-opponents` returns:
    - 200 + ordered opponents list for a valid `modelSlug`.
    - 4xx for missing/invalid `modelSlug`.
    - Empty list + `dbUnavailable` when DB is off.
  - Opponents with `hasPlayedChampionBefore = false` float to the top for a champion with some history.

- **Frontend – GPT‑5 defaults:**
  - Worm Arena Live loads with `modelA` set to a GPT‑5 variant when available.
  - GPT‑5 quick-select buttons correctly switch `modelA`.

- **Frontend – Smart opponents:**
  - Suggested opponents load and match API output ordering.
  - “Never played” and “Low games” badges reflect real data.
  - Accepting suggestions populates the opponent checkbox list.

- **Frontend – Tournament runs:**
  - Starting a GPT‑5 tournament with multiple opponents:
    - Emits batch progress in the status panel.
    - Fills completed matches table with accurate scores/results.
    - Fetches and shows a snapshot board for each completed match (where replay JSON exists).

- **Regression checks:**
  - Existing non-live Worm Arena replay page still functions.
  - Existing `run-match` and `run-batch` endpoints are unaffected.
  - No authentication is added to any Worm Arena/SnakeBench endpoints.

---

## 7. Summary

This plan turns Worm Arena Live into a **GPT‑5-focused tournament console** with:
- GPT‑5-first defaults and presets.
- Backend-powered smart opponent suggestions that prioritize **underplayed** and **never-before-seen** matchups.
- Improved tournament UX that ties together live progress, match results, and replay visualization.

True frame streaming is left as a **clearly defined follow-up**, while this plan delivers immediately useful GPT‑5 tournament workflows grounded in the existing SnakeBench/Worm Arena architecture.
