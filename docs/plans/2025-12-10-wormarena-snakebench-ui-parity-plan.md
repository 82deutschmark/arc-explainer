# 2025-12-10 – Worm Arena SnakeBench UI Parity Plan

## 1. Goals

- Bring the Worm Arena experience closer to Greg's official SnakeBench UI.
- Remove the low-value, mostly-empty bottom "Game Selection" bar and replace it with an information-dense match/history strip.
- Surface global SnakeBench stats (total games, models, apples, cost) directly in ARC Explainer.
- Add **model-centric exploration**: search/filter by model on the Worm Arena page.
- Reuse our own DB-backed SnakeBench integration as the source of truth.

## 2. Reference: SnakeBench frontend behavior

Based on `external/SnakeBench/frontend/src`:

- `app/page.tsx`
  - Renders a **HeroSection**, then a `StatsSection` and `LeaderboardSection` in a centered container.
- `components/home/StatsSection.tsx`
  - Fetches `/api/stats?simple=true`.
  - Computes:
    - **Total Snake Matches** (`totalMatches`).
    - **Models Competing** (distinct models with at least one game).
    - **Top Apples Eaten** (max top_score across models).
    - **Total Testing Cost** (sum of `total_cost`).
  - Displays 4 metric cards in a responsive 1×4 grid.
- `components/home/LeaderboardSection.tsx`
  - Also calls `/api/stats?simple=true`.
  - Builds a **Global Leaderboard** table:
    - Rank, Model (linked), TS Rating, TS Uncertainty, W/L, Apples, Top Score, Win Rate, Cost.
  - Uses a LIVE badge and a scrollable table body.

We want analogous concepts in Worm Arena, but adapted to our layout and color scheme.

## 3. Current Worm Arena layout issues

File: `client/src/pages/WormArena.tsx`

- Bottom section is:
  - A full-width bordered card with a **Hide/Show Game Selection** toggle.
  - Inside: `WormArenaRecentGames`, which shows only:
    - `gameId` (truncated monospace ID).
    - `totalScore` and `roundsPlayed` as `X pts · Y rds`.
- Problems:
  - Huge horizontal white/beige bar where only the **left 20–30%** contains content.
  - Vertical space is spent on the header and padding, while the list itself is a single short column.
  - Information density is low compared to SnakeBench (no model names, winners, cost, etc.).
  - Accordion hides something the user always needs.

## 4. Planned UX for Worm Arena (SnakeBench parity)

### 4.1 High-level structure

- Keep Worm Arena as a **replay-first page**, but add:
  1. A **stats strip** under the header (similar to SnakeBench `StatsSection`).
  2. A compact **model-focused summary / leaderboard slice**.
  3. A redesigned **Match History & Filters** bar under the board that:
     - Is **always visible** (no accordion).
     - Contains search/filter controls and an information-dense match list.

### 4.2 Stats strip (top of Worm Arena)

- Position: below `WormArenaHeader`, above replay controls.
- Content (using our DB-backed SnakeBench data):
  - **Total Worm Arena Matches** – number of SnakeBench games with `game_type = 'arc-explainer'`.
  - **Models Competing** – distinct `model_slug` seen in `game_participants`.
  - **Top Apples Eaten (single game)** – max participant `score` for our games.
  - **Total Testing Cost** – sum of `cost` across participants (once cost pipeline is wired).
- Visual style:
  - 2×2 (mobile) / 1×4 (desktop) card grid.
  - Earthy palette and our fonts, but follow SnakeBench's metric hierarchy (big numbers, small labels).

### 4.3 Model-centric summary & search

- Add a **Model Search + Summary** row just above the bottom history strip:
  - Text input: "Search models".
  - When typing, filter both:
    - The **recent games list** (only show games where `modelA` or `modelB` contains the query).
    - The **mini-leaderboard** slice (optional initial version: only a pill row of most played models).
- For v1, keep it simple:
  - One text box + a small helper text: "Filter by model name (e.g., `openai/gpt-5.1`)."
  - No pagination or advanced filters yet.

### 4.4 Match History & Filters strip (bottom)

- Replace the current "Hide Game Selection" accordion with a fixed panel:

  - **Header row**:
    - Left: label `Match History · {total} games`.
    - Right: model search input (from 4.3).

  - **Body**: table-like list of recent games, using the `SnakeBenchGameSummary` + replay metadata:

    Columns per row:
    - **Models**: `ModelA vs ModelB` (winner bolded or with a small crown icon).
    - **Result**: `Opus won`, `Gemini lost`, or `Tied`.
    - **Score & rounds**: `Score: 7–3 · 42 rounds`.
    - **Board**: `10×10`.
    - **When**: `2025-02-09 19:03` (short, localized).

  - Row interactions:
    - Clicking a row selects the game and triggers the existing replay load.
    - The selected row is highlighted using Worm Arena colors.

  - Scrolling:
    - Prefer a short list (e.g., 10–15 games) that fits without vertical scroll on typical screens.
    - If we need scroll, use a single small scroll area for the rows, not a huge card with empty space.

## 5. Backend changes needed

### 5.1 Aggregated stats API

- Add a new method to `SnakeBenchRepository`:
  - `getArcExplainerStats(): Promise<{ totalGames: number; activeModels: number; topApples: number; totalCost: number; }>`
  - Implementation sketch (conceptual, not code):
    - `totalGames`: count of `public.games` where `game_type = 'arc-explainer'`.
    - `activeModels`: count of distinct `model_slug` in `public.models` with at least one `game_participants` row.
    - `topApples`: max `score` from `game_participants` joins for our games.
    - `totalCost`: sum of `cost` from `game_participants` for our games.
- Add `SnakeBenchService.getArcExplainerStats()` to call the repository.
- Expose `/api/snakebench/stats` (or `/api/snakebench/arc-explainer-stats`) in `snakeBenchController` and routes.

### 5.2 Model search + enriched recent games

- Extend `SnakeBenchGameSummary` (shared types) to optionally include:
  - `modelA`, `modelB`, `winnerModelSlug`, `boardWidth`, `boardHeight`.
- Update `SnakeBenchRepository.getRecentGames(limit)` to:
  - Join `game_participants` and `models` to compute model slugs and infer winner.
  - Populate the new fields.
- Extend `useSnakeBenchRecentGames` hook to accept an optional `modelFilter` string:
  - For v1, filter client-side: `games.filter(g => (g.modelA+g.modelB).toLowerCase().includes(filter))`.
  - Later we can add a backend `?model=` filter if needed.

## 6. Frontend implementation steps

1. **Stats strip**
   - Add a new hook `useSnakeBenchStats` that calls the new `/api/snakebench/stats` route.
   - In `WormArena.tsx`, render a 4-card stats grid under `WormArenaHeader` when stats are available.

2. **Model search controls**
   - Add a small `ModelFilter` component reused between stats/leaderboard and bottom strip.
   - Wire it into `WormArena` state and pass the filter down to `WormArenaRecentGames`.

3. **Redesigned WormArenaRecentGames**
   - Replace the current simple list with a dense row layout using the enriched `games` entries.
   - Always rendered; remove the accordion toggle and wrapper padding that create the empty beige bar.

4. **Optional: local mini-leaderboard**
   - Once global stats are stable, add a small 3–5 row "Top Models" sidebar or strip above the history list (wins, apples, cost).

5. **Styling & polish**
   - Match Worm Arena's earthy theme while borrowing typography hierarchy from SnakeBench (monospace labels, big numbers).
   - Ensure mobile layout stacks gracefully (stats -> board -> history).

## 7. Out of scope (for now)

- Full replication of SnakeBench's dedicated `/live-games` page.
- Deep per-model detail pages (`/models/[id]`) – we can link out to SnakeBench proper for those.
- Advanced filters (date ranges, cost caps) and pagination; these can be layered later.

## 8. Next steps

- Implement backend stats endpoint and enrich `getRecentGames`.
- Implement `useSnakeBenchStats` and wire the stats strip into `WormArena`.
- Redesign `WormArenaRecentGames` + model filter UI, following this plan.
- Validate against both local and staging data, then iterate on styling with real tournaments.
