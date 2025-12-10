# 2025-12-10 – Worm Arena Stats & Placement Page Plan

> Author: Cascade  
> Purpose: Define a production-ready Worm Arena stats & placement experience that exposes TrueSkill-based ratings, 9-game placement progress, and model performance, mirroring Greg’s SnakeBench math while fitting ARC Explainer’s UI and DB integration.

This plan builds on:

- **TrueSkill / placement logic** from `external/SnakeBench/backend/placement_system.py`.
- **Local TrueSkill integration** in `server/repositories/SnakeBenchRepository.ts`.
- **Worm Arena replay UI plans**:
  - `docs/plans/WormArenaUI.md`
  - `docs/plans/2025-12-10-wormarena-snakebench-ui-parity-plan.md`

The goal is a **Stats & Placement** surface that tells a clear story: *“After ~9 games, where does my model sit, how confident are we, and what happened in those games?”*

---

## 1. Goals

- **Expose TrueSkill ratings clearly**
  - Show `mu`, `sigma`, **conservative rating**, and **display score** for each model.
  - Keep terminology simple: “Skill estimate” and “Confidence” instead of raw symbols.

- **Tell the 9-game placement story**
  - Visualize **placement progress** for models going through the `max_games = 9` pipeline.
  - Explain why each game matters (opponent strength, margin, confidence).

- **Unify with existing SnakeBench data**
  - Reuse `public.models`, `public.games`, `public.game_participants` as the source of truth.
  - Use the same TrueSkill configuration as Greg:
    - `mu = 25.0`, `sigma = 25/3 ≈ 8.33`, `beta = mu/6 ≈ 4.17`, `tau = 0.5`, `draw_probability = 0.1`.
    - **Conservative rating (exposed)**: `mu - 3 * sigma`.
    - **Display score**: `exposed * 50.0` (maps to ~1000–1800 UI range).

- **Be understandable to non-experts**
  - Use copy like “**pessimistic rating**” instead of “exposed TrueSkill”.
  - Emphasize that `sigma` starts large (uncertain) and shrinks as the model plays.

- **No new auth / infra complexity**
  - All endpoints remain **public, no authentication**, consistent with ARC Explainer rules.
  - Build as a standard React page and hooks under `client/src/`.

---

## 2. Background: TrueSkill & Placement System

### 2.1 TrueSkill parameters (SnakeBench-compatible)

- **Defaults** (from `SnakeBenchRepository.ts` + backend `services.trueskill_engine`):
  - `mu` (mean skill): **25.0**.
  - `sigma` (uncertainty): **8.333… ≈ mu / 3**.
  - `beta` (performance variance): **4.166… ≈ mu / 6**.
  - `tau` (dynamic factor): **0.5** (small drift per game).
  - `draw_probability`: **0.1**.

- **Conservative rating / exposed skill**
  - TrueSkill uses `mu ± k * sigma` as a credibility interval.
  - Greg’s **exposed rating** (what gets stored as `trueskill_exposed`) is:
    - `exposed = mu - 3 * sigma`.
  - ARC Explainer uses a **display multiplier** for UI:
    - `display = exposed * 50.0` → yields an Elo-like number ~1000–1800.

### 2.2 Confidence-weighted placement (9-game story)

From `external/SnakeBench/backend/placement_system.py`:

- **SkillEstimate**
  - Starts at `mu = 25`, `sigma = INITIAL_SIGMA = TS_DEFAULT_SIGMA ≈ 8.33`.
  - Each game:
    - Updates `mu` based on **result vs expected** outcome (`won/lost/tied`).
    - Decreases `sigma` by:
      - `sigma_reduction = 0.8 * confidence * (0.5 + 0.5 * norm_margin)`.
      - **Floor**: `MIN_SIGMA = 2.0`.

- **Confidence & margin**
  - `calculate_result_confidence(...)` gives `win_confidence` and `loss_confidence`.
  - Factors:
    - Score difference (0, ≤2, ≤5, ≤10, >10 apples).
    - Death reason (`wall`, `body_collision`, `head_collision`).
    - Game length (`total_rounds`).
  - Key policy:
    - **Losses are treated more carefully than wins** during placement.
    - “Fluky” losses → lower confidence → smaller updates + potential **rematch**.

- **Rematches for fluky losses**
  - If `result == 'lost'` and `confidence < FLUKY_LOSS_THRESHOLD (0.25)` and
    `play_count <= MAX_REMATCHES` (1 extra), placement may **schedule a rematch**.

- **Opponent selection (information gain)**
  - Tracks a rating interval `[elo_low, elo_high]`, seeded from existing leaderboard.
  - Picks opponents to **maximize information gain**:
    - Opponents near current `mu` are most informative.
    - Avoids playing same opponent repeatedly.
    - Uses **upward probes** if the model keeps **high-confidence wins**.
    - Caps jumps: `MAX_RATING_JUMP = 20.0` (conservative rating units).

### 2.3 Why 9 games is “enough” (for placement)

- Start: `sigma ≈ 8.33` (very uncertain — rating band is wide).
- Each game: expected `sigma` reduction ≈ `0.8 * confidence_factor` where `confidence_factor` is ~`0.5–1.0` depending on margin.
- With **average confidence ≈ 0.7** across 9 games:
  - Rough reduction per game: `0.8 * 0.7 ≈ 0.56`.
  - Total reduction: `~ 9 * 0.56 ≈ 5`.
  - Sigma shrinks from ~8.3 → **~3–4**.
- Result: the **pessimistic rating** (`mu - 3 * sigma`) becomes much more stable.
- Information gain–driven opponent selection ensures those 9 games are **high-signal**, not random.

This is the story we want to **surface explicitly** to the user on the stats/placement page.

---

## 3. User-facing Stats & Placement UX

### 3.1 Page location & routing

- New route: **`/worm-arena/stats`** (or `/worm-arena/placement`).
- Entry points:
  - Header nav in `WormArenaHeader` adds a **“Stats & Placement”** tab.
  - Inline links from:
    - Replay page (`/worm-arena`) → “View model stats”.
    - Live page (`/worm-arena/live/:sessionId`) → “Placement progress for this model”.

### 3.2 High-level layout

Top-to-bottom structure (desktop):

1. **Header**
   - Same farm aesthetic as Worm Arena replay.
   - Tabs: `Replay`, `Live`, `Stats & Placement`.

2. **Global Worm Arena stats strip** (reuses + extends SnakeBench stats)
   - 4 cards (from parity plan) with SnakeBench-backed aggregates:
     - `Total Worm Arena Matches` (our `game_type = 'arc-explainer'`).
     - `Models Competing` (distinct `model_slug`).
     - `Top Apples Eaten (single game)`.
     - `Total Testing Cost` (once cost is wired in).

3. **Model search & selection**
   - Simple text input: “Search model (e.g. `openai/gpt-5.1`)”.
   - Dropdown or pill list of **most-played models**.
   - Once a model is selected, rest of page populates.

4. **Model summary panel (TrueSkill snapshot)**
   - Shows for selected model:
     - Display name (= `model_slug`).
     - **Skill estimate**: `mu` (label: “Estimated skill”).
     - **Confidence / uncertainty**: `sigma` (label: “Uncertainty”).
     - **Pessimistic rating**: `mu - 3 * sigma`.
     - **Display score**: `(mu - 3*sigma) * 50.0` (labeled “Leaderboard score”).
     - Aggregate stats: games played, wins / losses / ties, apples eaten.
   - Copy block explaining in 1–2 sentences:
     - “We start uncertain about each model. After ~9 games with the right opponents, this score stabilizes.”

5. **9-game placement progress visualization**
   - For models **currently in placement** (less than `max_games`, or flagged via state):
     - Horizontal stepper: **Game 1 → Game 9**.
     - Each step shows:
       - Opponent rating band (e.g. “vs mid-tier”, “vs high-tier”).
       - Result: win/loss/tie.
       - Confidence (low/medium/high).
     - Progress bar: `games_played / max_games`.
     - Optional text: “We’ll play up to 9 placement games to lock in your starting rating.”

6. **Rating history chart (mu & confidence)**
   - Simple line chart (or stacked chart) showing per-game:
     - `mu` per completed game (y-axis) vs game index (x-axis).
     - Shaded band for `mu ± 2 * sigma` to show shrinking uncertainty.
   - Tooltips per point: opponent, score, confidence, margin.

7. **Recent matches table (for selected model)**
   - Table limited to **last N games** (e.g., 20):
     - Columns: `When`, `Opponent`, `Result`, `Score (A–B)`, `Rounds`, `Death reason`, `Confidence`.
     - Row click: jump to replay view (open `/worm-arena` with that game selected).

8. **Placement summary callout**
   - Top-right or bottom card summarizing:
     - “Placement complete” or “Placement in progress (X/9 games)”.
     - Current conservative rating and approximate **leaderboard tier** (top %, mid, etc.).

### 3.3 Copy / terminology guidelines

- Avoid raw math terms in UI labels:
  - `mu` → “Skill estimate”.
  - `sigma` → “Uncertainty (how sure we are)”.
  - `exposed` → “Pessimistic rating (we assume you’re this good or better)”.
- Explicitly note:
  - “9 games is a rule of thumb: we can stop earlier if sigma is already low, or continue playing for more precision.”

---

## 4. Data Model & Backend APIs

### 4.1 Existing schema (no new tables)

We reuse **Greg’s schema** already mirrored by `SnakeBenchRepository`:

- `public.models`
  - Important columns:
    - `model_slug` (string, primary identifier for UI).
    - `trueskill_mu`, `trueskill_sigma`, `trueskill_exposed`.
    - `elo_rating` (display score = `trueskill_exposed * 50` — this is already used).
    - Aggregates: `wins`, `losses`, `ties`, `apples_eaten`, `games_played`.

- `public.games`
  - `id`, `start_time`, `end_time`, `rounds`, `board_width`, `board_height`, `num_apples`, `total_score`, `total_cost`, `game_type`.

- `public.game_participants`
  - `game_id`, `model_id`, `player_slot`, `score`, `result`, `death_round`, `death_reason`, `cost`, `opponent_rank_at_match`.

### 4.2 New repository methods

Add to `SnakeBenchRepository`:

1. **Stats strip aggregates** (building on parity plan)
   - `getArcExplainerStats(): Promise<{ totalGames: number; activeModels: number; topApples: number; totalCost: number }>`
   - Query sketch (restate from parity plan):
     - `totalGames`: count of `games` where `game_type = 'arc-explainer'`.
     - `activeModels`: distinct `model_slug` with at least one `game_participants` row for our games.
     - `topApples`: max `score` from `game_participants` for our games.
     - `totalCost`: sum `cost` from `game_participants` for our games.

2. **Model-centric TrueSkill snapshot**
   - `getModelRating(modelSlug: string): Promise<{ modelSlug: string; mu: number; sigma: number; exposed: number; displayScore: number; wins: number; losses: number; ties: number; applesEaten: number; gamesPlayed: number } | null>`
   - Implementation details:
     - `SELECT trueskill_mu, trueskill_sigma, trueskill_exposed, wins, losses, ties, apples_eaten, games_played FROM public.models WHERE model_slug = $1 LIMIT 1;`
     - If `trueskill_exposed` is null, compute `exposed = mu - 3 * sigma` in TypeScript for return only.
     - `displayScore = exposed * TRUESKILL_DISPLAY_MULTIPLIER` (reuse repo constant = 50.0).

3. **Model match history (for charts + table)**
   - `getModelMatchHistory(modelSlug: string, limit: number = 50): Promise<Array<{ gameId: string; startedAt: string; opponentSlug: string; result: 'won' | 'lost' | 'tied'; myScore: number; opponentScore: number; rounds: number; deathReason: string | null }>>`
   - Query sketch:
     - Join `models` → `game_participants` self-joined to get opponent slug.
     - Filter `g.game_type = 'arc-explainer'`.
     - Order by `g.start_time DESC`.

4. **Placement reconstruction helper (optional v1 or v2)**
   - For a **single model**, we can mirror `rebuild_state_from_history` logic **in TypeScript or defer to Python**.
   - v1 (simple): approximate placement progress based on match count and `sigma`:
     - Derive “placement complete” if `games_played >= 9` or `sigma <= threshold (e.g. 3.0)`.
   - v2 (more faithful): call a small Python helper in `tmp_snakebench/backend` that wraps `rebuild_state_from_history`, and store a compact JSON summary in DB.

### 4.3 New controller endpoints (public)

In `server/controllers/snakeBenchController.ts` (or a new controller if cleaner), add:

1. **GET `/api/snakebench/stats`**
   - Returns `{ totalGames, activeModels, topApples, totalCost }`.
   - Used by both `WormArena.tsx` and the new stats page.

2. **GET `/api/snakebench/model-rating?modelSlug=...`**
   - Returns the `getModelRating` payload.

3. **GET `/api/snakebench/model-history?modelSlug=...&limit=50`**
   - Returns match history array.

4. **(Optional v2) GET `/api/snakebench/model-placement?modelSlug=...`**
   - Returns a placement-focused JSON:
     - `gamesPlayed`, `maxGames (default 9)`, `sigma`, `mu`, `exposed`, `conservativeDisplayScore`,
       plus per-game entries: opponent rating, result, confidence, margin, interval `[elo_low, elo_high]`.

All endpoints must remain **unauthenticated**, consistent with ARC Explainer’s open research posture.

---

## 5. Frontend Integration

### 5.1 New hooks

Under `client/src/hooks/` (or existing SnakeBench/WormArena hooks directory):

- **`useSnakeBenchStats`**
  - Fetches `/api/snakebench/stats`.
  - Exposes `{ data, isLoading, error }`.

- **`useModelRating(modelSlug)`**
  - Fetches `/api/snakebench/model-rating?modelSlug=...`.
  - Normalizes into UI-friendly labels (skill estimate, uncertainty, pessimistic rating, display score).

- **`useModelHistory(modelSlug, limit)`**
  - Fetches `/api/snakebench/model-history?...`.
  - Splits into:
    - `historyForTable` (recent games list).
    - `historyForChart` (ordered by date asc for charting).

- **Optional: `useModelPlacement(modelSlug)`**
  - For v1, can simply wrap `useModelRating` and `useModelHistory` and derive placement progress heuristics.

### 5.2 New page component

- File: `client/src/pages/WormArenaStats.tsx` (or similar naming).
  - Follows header + content container pattern from `WormArena.tsx`.
  - Sections mapped to UX above:
    - Header with nav (via `WormArenaHeader` + `links` prop from WormArenaUI plan).
    - Stats strip using `useSnakeBenchStats`.
    - Model search & selection.
    - Model summary card using `useModelRating`.
    - 9-game progress + chart using `useModelHistory` (and optional `useModelPlacement`).
    - Recent matches table.

### 5.3 Shared components

- Smaller, reusable pieces:
  - `ModelStatCard` – generic card for “Skill estimate”, “Uncertainty”, “Pessimistic rating”.
  - `ModelHistoryTable` – table rendering recent matches for a selected model.
  - `PlacementProgressBar` – horizontal 1–9 step indicator.
  - `RatingHistoryChart` – thin chart wrapper (can start with a simple SVG/HTML representation; no heavy chart lib needed for v1).

### 5.4 Linking from existing Worm Arena views

- `WormArenaHeader.tsx`
  - Extend `links` prop to include: `{ label: 'Stats & Placement', href: '/worm-arena/stats', active: ... }`.

- `WormArena.tsx` (replay page)
  - Next to model names or in metadata, add small link: “View full stats →” → prefill `modelSlug` query param for stats page.

- `WormArenaLive.tsx` (live page)
  - After match ends or in side panel, show “Placement status” snippet with link to `/worm-arena/stats?model=<slug>`.

---

## 6. Edge Cases & Future Extensions

### 6.1 Edge cases (v1 must handle)

- **Models with zero games**
  - Show baseline rating: `mu = 25`, `sigma ≈ 8.33`, `exposed = 25 - 3 * 8.33 ≈ 0`, `display ≈ 0`.
  - Copy: “No games yet. Once this model plays, we’ll start estimating its skill.”

- **Sparse history (1–3 games)**
  - Very high `sigma`; highlight: “We’re still very uncertain about this rating.”

- **Inactive models**
  - If `is_active = FALSE` in `public.models`, show a small banner: “This model is currently inactive but stats are preserved.”

- **Partial placement history**
  - If a model has `games_played < 9` but `sigma` already very low, label: “Placement effectively complete” and explain.

### 6.2 Future extensions (nice-to-have)

- **Full placement reconstruction**
  - Implement a service that replays `placement_system.py`’s `rebuild_state_from_history` using real database rows, returning:
    - `elo_low`, `elo_high` interval per step.
    - Confidence per result.
    - Exact opponent selection rationale.
  - Use that to enrich the UI stepper.

- **Per-opponent breakdown**
  - For selected model, show “best vs worst matchups” by opponent model.

- **Confidence graphs**
  - Visualize `sigma` over time + per-game confidence.

- **Leaderboard integration**
  - Reuse or extend `getBasicLeaderboard` to show global rank position and percentile on the stats page.

---

## 7. Implementation Phases

1. **Backend foundations**
   - Implement `getArcExplainerStats`, `getModelRating`, `getModelMatchHistory` in `SnakeBenchRepository`.
   - Wire `/api/snakebench/stats`, `/api/snakebench/model-rating`, `/api/snakebench/model-history` in `snakeBenchController` and routes.

2. **Frontend data hooks**
   - Add `useSnakeBenchStats`, `useModelRating`, `useModelHistory` hooks.
   - Verify they handle empty / error states gracefully.

3. **Worm Arena Stats page shell**
   - Create `WormArenaStats` page with header and stats strip only.
   - Add route and header link.

4. **Model selection + summary**
   - Implement model search, basic model summary card using `useModelRating`.

5. **History table + basic progress indicator**
   - Build `ModelHistoryTable` from `useModelHistory`.
   - Implement simple progress indicator: `gamesPlayed / 9` + `sigma` text.

6. **Charts and richer placement UX**
   - Add `RatingHistoryChart` and `PlacementProgressBar`.
   - Add copy explaining the placement/TrueSkill story in user-friendly terms.

7. **Polish & documentation**
   - Update `docs/` (this file plus any additional reference) after implementation.
   - Ensure CHANGELOG entry and tests where appropriate.

