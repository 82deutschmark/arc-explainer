# 2025-12-11 – Worm Arena "Greatest Hits" Matches Plan

Author: GPT-5.1 Codex CLI  
Date: 2025-12-11  
Scope: Worm Arena replay viewer (`/worm-arena`) + SnakeBench-backed stats APIs  
Goal: Surface a small, curated set of especially interesting Worm Arena matches ("greatest hits") based on rounds played, total cost, and final scores, and make them easy to discover and replay from the main Worm Arena UI.

---

## 1. Motivation and UX Goals

- Help users quickly find **memorable matches** instead of scrolling through a flat recent-games list.
- Highlight games that are:
  - **Long-running** (many rounds played).
  - **Expensive** (high token/cost usage).
  - **High-scoring** (lots of apples eaten / large score deltas).
- Keep the experience **simple and hobby-friendly**:
  - A small list (e.g., top 5–10) of clearly labeled "greatest hits".
  - Each entry is a **one-click replay** link (`/worm-arena?gameId=...`).
  - Avoid new complex filters or dashboards; reuse existing styling components.

Non-goals:

- No new ranking system for models (TrueSkill already covers that).
- No new DB tables if we can derive metrics from existing SnakeBench game storage.
- No heavy analytics or time-series charts; this is a **curated list**, not a full analytics page.

---

## 2. Data Model – What We Have Per Game

Sample completed-game JSON (`external/SnakeBench/backend/completed_games/*.json`) shows:

- `game`:
  - `id` – UUID for the game.
  - `game_type` – `"arc-explainer"` vs other modes.
  - `max_rounds`, `rounds_played` – turn counts.
  - `board.width`, `board.height`, `board.num_apples`.
- `players` (keyed by `"0"`, `"1"`, etc.):
  - `name` – model slug (e.g., `"openai/gpt-5-nano"`).
  - `result` – `"won" | "lost" | "tied"`.
  - `final_score` – apples eaten / score.
  - `death.reason`, `death.round` – termination cause and round.
  - `totals.input_tokens`, `totals.output_tokens`, `totals.cost` – per-player cost.
- `totals`:
  - `cost` – total game cost (sum of players).
  - `input_tokens`, `output_tokens` – aggregate tokens.

SnakeBench DB and API already expose:

- `SnakeBenchGameSummary` for recent games (via `useSnakeBenchRecentGames`).
- Global stats and TrueSkill ratings (`useSnakeBenchStats`, `useModelRating`, `useModelHistory`).

We will treat the **DB-backed game summaries** as the primary source and only fall back to reading JSON files if necessary for additional metrics that aren’t in the DB yet.

---

## 3. Greatest-Hits Metrics and Ranking

### 3.1 Core Metrics

For each completed game we define these derived metrics:

- `roundsPlayed`: `game.rounds_played`.
- `totalCost`: `totals.cost` (fallback to sum of `players[*].totals.cost` if needed).
- `maxFinalScore`:
  - `max(players[*].final_score)` – highlights offensive / apple-rich games.
- `scoreDelta`:
  - `abs(score_player0 - score_player1)` – blowouts vs tight matches.
- `isMaxRounds`: `roundsPlayed >= max_rounds`.

### 3.2 Selection Strategy

We want a **small, interpretable set** drawn from three angles:

1. **Most Rounds Played**  
   - Filter by `game_type = 'arc-explainer'` and a minimum `roundsPlayed` threshold (e.g., `>= 100`), then sort by `roundsPlayed DESC`.  
   - Take top `N1` (e.g., 5) matches.

2. **Highest Total Cost**  
   - Same base filter, but require a small minimum cost (e.g., `totalCost >= $0.01`) to avoid zero-cost baselines.  
   - Sort by `totalCost DESC`.  
   - Take top `N2` (e.g., 5) matches.

3. **Highest Final Score / Most Apples**  
   - Compute `maxFinalScore` and/or `scoreDelta`.  
   - Sort primarily by `maxFinalScore DESC`, tie-breaker `roundsPlayed DESC`.  
   - Take top `N3` (e.g., 5) matches.

Then:

- **Deduplicate** games across all three lists while preserving the highest-ranking reason.
- For each selected game we also compute a **primary highlight reason**, e.g.:
  - `"Longest game by rounds"`
  - `"Top 5 by total cost"`
  - `"Highest-scoring match"`

### 3.3 Greatest-Hits Summary Type

Backend will return a compact shape (shared TS type):

```ts
export interface WormArenaGreatestHitGame {
  gameId: string;
  startedAt: string;
  modelA: string;
  modelB: string;
  roundsPlayed: number;
  maxRounds: number;
  totalCost: number;
  maxFinalScore: number;
  scoreDelta: number;
  boardWidth: number;
  boardHeight: number;
  highlightReason: string;
}

export interface WormArenaGreatestHitsResponse {
  success: boolean;
  games: WormArenaGreatestHitGame[];
  timestamp: number;
}
```

---

## 4. Backend Plan – Greatest-Hits Endpoint

### 4.1 Repository Layer (`SnakeBenchRepository`)

Add a new method:

- `getWormArenaGreatestHits(limitPerDimension: number = 5): Promise<WormArenaGreatestHitGame[]>`

Responsibilities:

- Query the Worm Arena games table(s) for **completed** `arc-explainer` games.
- Compute:
  - `roundsPlayed`, `maxRounds`
  - `totalCost` (sum of per-player cost or stored aggregate)
  - `maxFinalScore`, `scoreDelta`
  - `modelA`, `modelB` (canonical order: snake 0, snake 1).
  - `boardWidth`, `boardHeight`
  - `startedAt`
- Construct three sorted lists (rounds, cost, score) and merge/deduplicate with appropriate `highlightReason` labels.

Implementation details:

- Reuse any existing ORM/query helpers already used for `leaderboard` and `recent-activity` endpoints.
- Apply **reasonable caps**: never return more than, say, 20 greatest-hits matches total.
- Only include games where:
  - Both player names are known.
  - `roundsPlayed > 0`.
  - `maxFinalScore > 0` or `totalCost > 0` (to avoid all-zero trivial games).

### 4.2 Controller + Route

Add a new controller handler in `snakeBenchController.ts` (or a dedicated Worm Arena controller if one already exists for stats):

- `getWormArenaGreatestHits(req, res)`:
  - Optional query params:
    - `limitPerDimension?: number` (default 5, max 10).
  - Calls `SnakeBenchRepository.getWormArenaGreatestHits(limitPerDimension)`.
  - Returns `WormArenaGreatestHitsResponse`.

Route:

- `GET /api/snakebench/greatest-hits`
  - Namespaced under existing SnakeBench API family for reuse from both Worm Arena and admin tools.

Error handling:

- On failure, respond with `{ success: false, error, games: [], timestamp }` and log with existing logger.

### 4.3 Shared Types

Update `shared/types.ts` with `WormArenaGreatestHitGame` and `WormArenaGreatestHitsResponse` (as in Section 3.3) so both backend and frontend share the shape.

---

## 5. Frontend Plan – Highlighting Greatest Hits

### 5.1 New Hook: `useWormArenaGreatestHits`

Location:

- `client/src/hooks/useWormArenaGreatestHits.ts`

Behavior:

- Fetch from `GET /api/snakebench/greatest-hits` on mount.
- State shape:
  - `games: WormArenaGreatestHitGame[]`
  - `isLoading: boolean`
  - `error: string | null`
  - `refresh(): Promise<void>`

Implementation:

- Use existing `apiRequest` helper for consistency.

### 5.2 New Component: `WormArenaGreatestHits.tsx`

Location:

- `client/src/components/WormArenaGreatestHits.tsx`

Responsibilities:

- Present a **small card** with a list of greatest-hits matches:
  - Title: **“Greatest Hits Matches”**.
  - Each row:
    - Model matchup label: `modelA vs modelB` (monospace slugs).
    - Badges for:
      - `roundsPlayed/maxRounds` (e.g., `142 / 150 rounds`).
      - `totalCost` (e.g., `$0.38`).
      - `maxFinalScore` or `scoreDelta` (e.g., `Score: 14–9` or `Max score: 14`).
    - A small label for `highlightReason` (e.g., `Longest game by rounds`).
    - “View replay” link: `/worm-arena?gameId=${gameId}`.
- Loading/error states:
  - Show compact “Loading greatest hits…” text.
  - On error, show a small warning but don’t break the rest of the page.

Styling:

- Match the existing Worm Arena card aesthetic:
  - Background `#faf6f1`, border `#d4b5a0`.
  - Rounded corners, subdued badges.

### 5.3 Integration on Main Arena Page

Target page:

- `client/src/pages/WormArena.tsx` (`/worm-arena?gameId=...`).

Placement options (pick one, based on actual visual fit during implementation):

1. **Above the recent-games accordion** (recommended):
   - Keep greatest-hits visible without scrolling open an accordion.
   - Recent-games list remains as a secondary way to browse.

2. **Inside the existing stats/metadata strip**:
   - E.g., below the “Scores / Round / Board” line but above the `WormArenaStatsPanel`.

Planned integration:

- Import and render `<WormArenaGreatestHits />` near the existing `WormArenaStatsPanel`:
  - Either stacked vertically (`StatsPanel` then `GreatestHits`) or side-by-side on large screens.
- Ensure that selecting “View replay” from the greatest-hits card:
  - Updates `gameId` via navigation (`href=/worm-arena?gameId=...`) so the existing deep-link logic in `WormArena.tsx` handles selection + autoplay.

---

## 6. Edge Cases and Performance

- **No qualifying games yet**:
  - Return an empty `games` array; UI shows “No greatest hits yet – run more matches!”.
- **All-zero-cost or ultra-short games**:
  - Filter out games with `roundsPlayed < 5` and `totalCost === 0` to avoid trivial matches.
- **Mixed game types** (`game_type` not `"arc-explainer"`):
  - Restrict to `game_type = 'arc-explainer'` for now to avoid mixing ladders or other experiments.
- **Pagination / volume**:
  - Hard limit (e.g., 20 games max) ensures the query and response remain lightweight.
- **Consistency with stats page**:
  - Use the same cost formatting and slug display conventions as `WormArenaStats` to avoid user confusion.

---

## 7. Implementation Checklist

Backend:

- [ ] Add `WormArenaGreatestHitGame` and `WormArenaGreatestHitsResponse` to `shared/types.ts`.
- [ ] Implement `SnakeBenchRepository.getWormArenaGreatestHits(limitPerDimension)` using DB queries.
- [ ] Add controller handler `getWormArenaGreatestHits` in `snakeBenchController.ts` (or Worm Arena controller).
- [ ] Wire route `GET /api/snakebench/greatest-hits` in `server/routes.ts`.
- [ ] Add basic logging and error handling.

Frontend:

- [ ] Implement `useWormArenaGreatestHits` hook (`client/src/hooks/useWormArenaGreatestHits.ts`).
- [ ] Implement `WormArenaGreatestHits` component (`client/src/components/WormArenaGreatestHits.tsx`).
- [ ] Integrate `WormArenaGreatestHits` into `WormArena.tsx` near the existing stats panel.
- [ ] Verify deep-linking (`?gameId=`) works seamlessly when clicking “View replay” from greatest hits.

Validation:

- [ ] Manually hit `GET /api/snakebench/greatest-hits` and check that returned games align with expectations (high rounds/cost/scores).
- [ ] Open `/worm-arena` and confirm that greatest-hits matches look correct and navigate to replays as expected.
- [ ] Optionally extend tests or add a small integration test around the repository method if the codebase already covers similar stats endpoints.

---

## 8. Open Questions (for future refinement)

- Should we treat **ties with high scores** as “greatest hits” separately from blowouts?
- Do we want a **time window** (e.g., greatest hits in the last 30 days) or all-time only?
- Should we allow **manual pinning** of specific matches as featured, alongside the algorithmic picks?

For this first pass, we keep it simple: all-time, automatically selected by clear metrics, presented as a short, clickable “Greatest Hits” list on the main Worm Arena replay page.

