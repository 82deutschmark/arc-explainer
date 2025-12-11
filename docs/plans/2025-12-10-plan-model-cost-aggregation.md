# Implementation Plan: Per-Model Cost Aggregation to getModelRating()

**Author:** Planning Doc
**Date:** 2025-12-10
**Goal:** Add total testing cost to individual model rating API response, enabling the "Testing cost" field in WormArenaStats model snapshot to display actual data instead of "TBD".

---

## Overview

Currently, the individual model rating endpoint `/api/snakebench/model-rating?modelSlug=...` returns skill metrics (µ, σ, exposed rating) and game outcomes (wins/losses/ties) but does **not** include the total USD cost spent testing that specific model.

The TrueSkill leaderboard (`/api/snakebench/trueskill-leaderboard`) already aggregates cost successfully via `SUM(gp.cost)` in the repository query. We need to apply the same pattern to the individual model rating.

---

## Affected Files

### Backend (Server)

1. **server/repositories/SnakeBenchRepository.ts** (PRIMARY CHANGE)
   - Method: `getModelRating(modelSlug: string)` (lines 443–505)
   - Current: Queries `public.models` table only
   - Needed: JOIN to `game_participants` and `games` tables to aggregate costs

2. **shared/types.ts** (TYPE UPDATE)
   - Interface: `SnakeBenchModelRating` (lines 653–665)
   - Current: Does not include cost field
   - Needed: Add `totalCost: number` field to interface

3. **server/services/snakeBenchService.ts** (NO CHANGES NEEDED)
   - Method: `getModelRating(modelSlug)` (lines 641–643)
   - This just delegates to repository; no logic changes required
   - Response type is automatically correct once `SnakeBenchModelRating` is updated

4. **server/controllers/snakeBenchController.ts** (NO CHANGES NEEDED)
   - Method: `modelRating(req, res)` (lines 323–354)
   - This already returns whatever the service provides
   - No changes needed once repository and types are updated

### Frontend (Client)

5. **client/src/pages/WormArenaStats.tsx** (DISPLAY CHANGE)
   - Lines 509–530: Current model snapshot metrics grid
   - Currently shows "Testing cost" with "TBD" placeholder
   - Once backend is updated, replace the hardcoded "TBD" display with actual `rating.totalCost` value
   - Keep the existing tooltip and styling; just swap out the data

---

## Implementation Steps

### Phase 1: Update Type Definition

**File:** `shared/types.ts`
**Interface:** `SnakeBenchModelRating`
**Task:**
- Add new field: `totalCost: number` (follow the same pattern as other numeric fields like `applesEaten`, `gamesPlayed`)
- Place it logically after `gamesPlayed` or alongside other aggregate metrics
- Ensure it's a required field (not optional) for consistency with other aggregates

### Phase 2: Update Repository Query

**File:** `server/repositories/SnakeBenchRepository.ts`
**Method:** `getModelRating(modelSlug: string)`
**Current Logic:**
- Line 453–467: SQL selects from `public.models` WHERE `model_slug = $1`
- Returns TrueSkill metrics and game outcome counts from the models table

**Required Changes:**
- Modify the SQL query to JOIN `game_participants` (alias: `gp`) on `m.id = gp.model_id`
- JOIN `games` (alias: `g`) on `gp.game_id = g.id` to filter by game_type
- Add GROUP BY clause grouping on all selected non-aggregate columns from models
- Add `COALESCE(SUM(gp.cost), 0) AS total_cost` to the SELECT list (matching the pattern in `getTrueSkillLeaderboard`)
- Keep WHERE clause filtering to game_type = 'arc-explainer' (consistent with leaderboard behavior)
- Reference: See `getTrueSkillLeaderboard()` (lines 597–678) for the exact SQL pattern to follow

**Data Mapping:**
- Lines 475–488: In the result mapping logic, parse the new `total_cost` field from the query result
- Follow the same pattern as `totalCost` in `getTrueSkillLeaderboard` (line 647): `const totalCost = Number(row.total_cost ?? 0) || 0;`
- Add `totalCost` to the returned `SnakeBenchModelRating` object (line 490–505 range)

### Phase 3: Update Frontend Display

**File:** `client/src/pages/WormArenaStats.tsx`
**Section:** Model snapshot metrics grid (lines 509–530)
**Current Display:**
- Lines 524–530: "Testing cost" field shows hardcoded "TBD" in a disabled-looking badge

**Required Changes:**
- Replace the hardcoded "TBD" display with dynamic value: `${rating.totalCost?.toFixed(4)}` (to match 4-decimal precision shown in leaderboard, line 219 of WormArenaTrueSkillLeaderboard.tsx)
- Or use `2` decimal places if 4 is too granular—match the style of the leaderboard display
- Keep the tooltip, help icon, and all existing styling
- Ensure it only displays when `rating` object exists (already wrapped in `{rating && ...}`)

---

## Validation Checklist

- [ ] `SnakeBenchModelRating` type includes `totalCost: number`
- [ ] `SnakeBenchRepository.getModelRating()` query joins game_participants and games tables
- [ ] Query aggregates cost with `SUM(gp.cost)` matching `getTrueSkillLeaderboard` pattern
- [ ] Query filters to game_type = 'arc-explainer' for consistency
- [ ] Repository mapping extracts `total_cost` from query result and handles null/undefined cases
- [ ] Frontend removes "TBD" and displays `rating.totalCost.toFixed(n)` where n = 2 or 4
- [ ] Test with a model that has multiple games to verify cost aggregation works
- [ ] Verify the leaderboard and individual model ratings show consistent cost totals for the same model

---

## Reference Examples in Codebase

- **Cost aggregation pattern:** `server/repositories/SnakeBenchRepository.ts` lines 621, 647
- **Frontend cost display:** `client/src/components/WormArenaTrueSkillLeaderboard.tsx` line 219
- **Full query example:** `server/repositories/SnakeBenchRepository.ts` lines 609–630 (getTrueSkillLeaderboard SQL)

---

## Notes

1. The database schema already supports per-game cost tracking (`game_participants.cost` column, line 79 of `docs/SNAKE_BENCH_DB.md`)
2. No new database columns or migrations are needed
3. The pattern is already proven to work in the leaderboard—this is applying the same logic to a single-model query
4. Once complete, users will see per-model cost in the individual model snapshot, providing cost context alongside skill metrics
