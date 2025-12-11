# 2025-12-10 – Worm Arena TrueSkill Leaderboard Plan

> Author: Cascade  
> Purpose: Add a TrueSkill-based global leaderboard to the Worm Arena Stats & Placement page with full SnakeBench column parity, minimum 3 games per model, and up to 150 ranked rows.

---

## 1. Goals

- **Expose a global TrueSkill leaderboard** for Worm Arena that matches SnakeBench’s leaderboard semantics and columns.
- **Respect placement quality** by requiring **at least 3 games** before a model appears on the board.
- **Support a large leaderboard view** with **up to 150 rows** (top 150 models by conservative TrueSkill rating).
- **Maintain open-access API**: new endpoint must be **public, unauthenticated**, consistent with ARC Explainer rules.
- **Avoid new schema changes** – reuse existing `public.models`, `public.games`, `public.game_participants` tables.

---

## 2. Requirements (from user)

- **Minimum games**: a model must have **≥ 3 games** to be included.
- **Row limit**: the leaderboard should support **up to 150 entries** (for a “gigantic UI” view).
- **Columns** with **SnakeBench parity** (based on `external/SnakeBench/frontend/src/components/home/LeaderboardSection.tsx`):
  - Rank (1-based, sorted by TrueSkill exposed)
  - Model (model slug)
  - TS Rating (TrueSkill exposed / conservative rating)
  - TS Uncertainty (σ)
  - Games (count of Worm Arena / `arc-explainer` games)
  - Wins
  - Losses
  - Ties
  - Apples Eaten (cumulative apples for this model)
  - Top Score (max apples in a single game for this model)
  - Win Rate (%)
  - Total Cost (USD spent on this model’s Worm Arena games)

Where possible, **definitions mirror SnakeBench**:
- **TS Rating**: `exposed = mu - 3 * sigma` from `public.models.trueskill_*`.
- **Display score**: derived UI score (but we only need exposed rating + σ for columns; display score can still exist for model snapshot).

---

## 3. Backend Design

### 3.1 New shared types

File: `shared/types.ts`

Add new interfaces next to other SnakeBench types:
- `SnakeBenchTrueSkillLeaderboardEntry`
  - `modelSlug: string`
  - `mu: number`
  - `sigma: number`
  - `exposed: number` (TrueSkill conservative rating)
  - `displayScore: number` (optional for UI if needed)
  - `gamesPlayed: number` (Worm Arena / `arc-explainer` games)
  - `wins: number`
  - `losses: number`
  - `ties: number`
  - `applesEaten: number`
  - `topScore: number`
  - `winRate?: number` (0–1 or 0–100, we’ll pick **0–1** internally and format in UI)
  - `totalCost: number`

- `SnakeBenchTrueSkillLeaderboardResponse`
  - `success: boolean`
  - `entries: SnakeBenchTrueSkillLeaderboardEntry[]`
  - `error?: string`
  - `timestamp: number`

### 3.2 Repository method – TrueSkill leaderboard query

File: `server/repositories/SnakeBenchRepository.ts`

Add a new method:

- `getTrueSkillLeaderboard(limit: number = 150, minGames: number = 3): Promise<SnakeBenchTrueSkillLeaderboardEntry[]>`

Query strategy (PostgreSQL):

- Use `public.models` as the **rating source of truth** (for `mu`, `sigma`, `trueskill_exposed`).
- Use `public.games` + `public.game_participants` filtered by `g.game_type = 'arc-explainer'` to compute Worm Arena–specific aggregates:
  - `gamesPlayed`: `COUNT(*)` over `game_participants` for this model + `game_type = 'arc-explainer'`.
  - `wins/losses/ties`: conditional `COUNT` over `gp.result` with the same filter.
  - `applesEaten`: `SUM(gp.score)` for `arc-explainer` games.
  - `topScore`: `MAX(gp.score)` for `arc-explainer` games.
  - `totalCost`: `SUM(gp.cost)` for `arc-explainer` games.
- **HAVING clause**: require `gamesPlayed >= minGames` (with minGames defaulting to 3 as per user).
- **Ordering**: sort by **TrueSkill exposed** descending:
  - `exposed = COALESCE(m.trueskill_exposed, m.trueskill_mu - 3 * m.trueskill_sigma)`.
- **Limit**: clamp `limit` to `1–150`.

The method should:
- Use the existing `DEFAULT_TRUESKILL_*` constants when fields are null.
- Compute `displayScore = exposed * TRUESKILL_DISPLAY_MULTIPLIER` for completeness.
- Return data mapped into the new shared type.

### 3.3 Service method

File: `server/services/snakeBenchService.ts`

Add method:

- `getTrueSkillLeaderboard(limit?: number, minGames?: number): Promise<SnakeBenchTrueSkillLeaderboardEntry[]>`
  - Clamp `limit` to `1–150`, default `150`.
  - Default `minGames` to `3` if undefined.
  - Delegate to `repositoryService.snakeBench.getTrueSkillLeaderboard(limit, minGames)`.

### 3.4 Controller + route

File: `server/controllers/snakeBenchController.ts`

Add handler:

- `trueSkillLeaderboard(req, res)`:
  - Parse `limit` and `minGames` from `req.query`.
  - Apply safe defaults: `limit=150`, `minGames=3`.
  - Call `snakeBenchService.getTrueSkillLeaderboard(limit, minGames)`.
  - Return `SnakeBenchTrueSkillLeaderboardResponse` JSON.

Error behavior:
- On failure, log and return `{ success: false, entries: [], error, timestamp }` with HTTP 500.

File: `server/routes.ts`

Register new **public GET** endpoint (no auth):

- `GET /api/snakebench/trueskill-leaderboard` → `snakeBenchController.trueSkillLeaderboard`.

This keeps a clean separation from the existing `/api/snakebench/leaderboard` (games-played/win-rate list used for the left sidebar).

---

## 4. Frontend Design

### 4.1 New hook

File: `client/src/hooks/useWormArenaTrueSkillLeaderboard.ts`

- Author header per repo standards.
- Implementation:
  - Uses `apiRequest('GET', '/api/snakebench/trueskill-leaderboard?limit=150&minGames=3')`.
  - Parses `SnakeBenchTrueSkillLeaderboardResponse`.
  - Exposes:
    - `entries: SnakeBenchTrueSkillLeaderboardEntry[]` (frontend-local copy of the shared type)
    - `isLoading: boolean`
    - `error: string | null`
    - `refresh(): Promise<void>`

### 4.2 Leaderboard UI component

Option A (preferred): dedicated component

- File: `client/src/components/WormArenaTrueSkillLeaderboard.tsx`
  - Props: `entries`, `isLoading`, `error`.
  - Renders a `Card` with title **“TrueSkill Leaderboard (Worm Arena)”**.
  - Inside: scrollable `Table` with columns:
    - **Rank**: index + 1.
    - **Model**: monospaced model slug.
    - **TS Rating**: `exposed.toFixed(2)` with tooltip explaining `μ - 3σ`.
    - **TS Uncertainty**: `σ` (two decimals) with tooltip (lower is more confident).
    - **Games**: `gamesPlayed`.
    - **Wins / Losses / Ties**: either separate columns or compact `W/L/T` column; for full SnakeBench parity we’ll mirror its layout (**W/L** and a separate **Ties** or inline text as needed).
    - **Apples Eaten**: `applesEaten`.
    - **Top Score**: `topScore`.
    - **Win Rate**: formatted percentage from `winRate` (e.g., `Math.round(winRate * 100)`).
    - **Total Cost**: formatted as `$X.XXXX`.
  - Uses existing shadcn `Card`, `Table`, and styling aligned with `WormArenaStats` page (same cream/terracotta palette).

Option B: inline table in `WormArenaStats.tsx` (higher coupling).  
**Chosen**: Option A for SRP; `WormArenaStats` remains a composition shell.

### 4.3 Integration into WormArenaStats page

File: `client/src/pages/WormArenaStats.tsx`

- Import `useWormArenaTrueSkillLeaderboard` and `WormArenaTrueSkillLeaderboard`.
- In the main layout, add the leaderboard near the top, likely **below the global stats strip** and above the two-column model/placement row:
  - New section: a full-width `Card` containing the TrueSkill leaderboard table.
  - Keep the existing **“Models” list** (games-played sorted) for selection; this new leaderboard is a **global ranking** view.
- Ensure layout remains responsive:
  - On desktop: leaderboard appears as a wide table.
  - On smaller screens: horizontal scroll via `ScrollArea`.

---

## 5. Testing & Validation

- **Unit/Integration tests** (where practical):
  - Repository-level test for `getTrueSkillLeaderboard` (happy path + empty DB):
    - Ensures filtering by `minGames` and ordering by exposed rating works.
  - Controller test: `GET /api/snakebench/trueskill-leaderboard` returns expected JSON shape and respects `limit`/`minGames` query params.
- **Manual checks**:
  - Seed a few SnakeBench games with known TrueSkill values and confirm ordering matches expectation.
  - Verify models with `< 3` Worm Arena games are **excluded**.
  - Confirm totals (apples, cost) match sums in `public.game_participants` for `game_type = 'arc-explainer'`.
  - Validate UI renders 150-row leaderboard without layout breakage.

---

## 6. Changelog & Docs

- **CHANGELOG.md**
  - Add a new top entry with **semantic version bump** documenting:
    - Added `/api/snakebench/trueskill-leaderboard`.
    - Added Worm Arena TrueSkill leaderboard card on `/worm-arena/stats`.
- **Docs**
  - This plan file (`2025-12-10-wormarena-trueskill-leaderboard-plan.md`) is the primary design reference.
  - Optionally link from `WORM_ARENA_STATS_DESIGN_PHILOSOPHY.md` or the broader Worm Arena plans if cross-references are useful later.
