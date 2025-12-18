# Worm Arena Live Page: Stats Integration Plan

**Author:** Cascade
**Date:** 2025-12-18
**Purpose:** Implementation plan for enhancing the Live page with TrueSkill-driven statistics, written for the next developer who picks this up.

---

## Context: What You Need to Understand First

Before touching any code, read `docs/WORM_ARENA_STATS_DESIGN_PHILOSOPHY.md`. The key insight: **TrueSkill is a probabilistic skill model, not a simple rating number.** Every model has:

- **mu (μ)** - skill estimate (center of the bell curve)
- **sigma (σ)** - uncertainty (width of the bell curve)
- **exposed (μ - 3σ)** - pessimistic bound used for leaderboard ranking

The magic is that sigma **shrinks** as games are played. A new model starts at σ ≈ 8.33 and converges toward σ ≤ 3.0 after ~9 games. This is the "placement journey" - the story the Stats page tells.

---

## The Architecture You're Working With

### Data Flow (Codemap Reference)

```
Frontend Hook                    Backend API                      Database
─────────────────────────────────────────────────────────────────────────────
useModelRating(slug)      →   GET /api/snakebench/model-rating   →   models table
                              ├─ snakeBenchController.ts:192         (trueskill_mu,
                              └─ snakeBenchService.ts:1180            trueskill_sigma,
                                                                      trueskill_exposed)

useWormArenaTrueSkillLeaderboard()  →  GET /api/snakebench/trueskill-leaderboard
                                       ├─ Joins: models → game_participants → games
                                       └─ Returns top N models by exposed rating
```

### Key Types (shared/types.ts)

```typescript
interface SnakeBenchModelRating {
  modelSlug: string;
  mu: number;           // Skill estimate
  sigma: number;        // Uncertainty
  exposed: number;      // mu - 3*sigma (pessimistic bound)
  displayScore: number; // exposed * 50 for UI
  wins: number;
  losses: number;
  ties: number;
  gamesPlayed: number;
  totalCost: number;
}
```

### Existing Components to Reuse

| Component | Location | What It Does |
|-----------|----------|--------------|
| `WormArenaModelSnapshotCard` | `components/wormArena/stats/` | Full stats panel with mu/sigma/exposed, KaTeX equations |
| `WormArenaWinProbability` | `components/wormArena/` | Calculates P(A beats B) using TrueSkill formula |
| `DataNumber` | `components/wormArena/` | Styled number display with role-based coloring |
| `useModelRating` | `hooks/useSnakeBench.ts` | Fetches single model's TrueSkill data |

---

## What the Live Page Currently Does

Looking at `WormArenaLive.tsx`:

1. **Setup phase**: User selects two models via `useWormArenaSetup`
2. **Streaming phase**: SSE connection via `useWormArenaStreaming` delivers frame-by-frame game state
3. **Display**: Shows reasoning panels (left/right), live board (center), apple scores

**What's missing**: Any TrueSkill context. Users see "Model A vs Model B" but don't know:
- Which model is favored?
- What are their ratings?
- How many games has each played?

---

## The Integration Plan

### Phase 1: Pre-Match Stats Strip

**Goal**: When models are selected (before match starts), show a compact stats strip.

**Implementation**:
1. Create `useMatchupRatings(modelA: string, modelB: string)` hook
   - Calls `useModelRating` for both models
   - Returns combined loading/error states
   - Memoizes win probability calculation

2. Create `WormArenaMatchupStatsStrip` component
   - Displays: Model A rating | Win Prob | Model B rating
   - Compact format: `gpt-5.1 (μ 28.5, σ 2.1) — 67% — deepseek-v3 (μ 21.6, σ 3.4)`
   - Uses role colors (green = model A, blue = model B)

3. Insert into `WormArenaLive.tsx` header area
   - Shows when `setupConfig.modelA && setupConfig.modelB` are set
   - Collapses/hides once streaming begins (optional - discuss with user)

### Phase 2: Live Scoreboard Enhancement

**Goal**: Apple score + TrueSkill context during match.

**Implementation**:
1. Extend `WormArenaLiveScoreboard` props:
   ```typescript
   interface WormArenaLiveScoreboardProps {
     playerAName: string;
     playerBName: string;
     playerAScore: number;
     playerBScore: number;
     // NEW:
     playerARating?: { mu: number; sigma: number; gamesPlayed: number };
     playerBRating?: { mu: number; sigma: number; gamesPlayed: number };
     winProbability?: number;
   }
   ```

2. Display beneath model names:
   - Rank badge: `#4` (leaderboard position)
   - Mini stats: `μ 28.5 · 122 games`
   - Win probability bar between the two sides

### Phase 3: Post-Match Context

**Goal**: After match completes, show outcome in TrueSkill context.

**Implementation**:
1. When `finalSummary` arrives, compare actual result to predicted probability
2. Display contextual message:
   - "Expected win - gpt-5.1 was favored at 67%"
   - "Upset! deepseek-v3 won despite 33% odds"
   - "Close match - both models rated similarly"

---

## Technical Notes

### Win Probability Calculation

Already implemented in `WormArenaWinProbability.tsx`:

```typescript
// P(A beats B) = Phi((muA - muB) / sqrt(sigmaA^2 + sigmaB^2))
const diff = compareMu - baselineMu;
const combinedSigma = Math.sqrt(compareSigma ** 2 + baselineSigma ** 2);
const zScore = diff / combinedSigma;
const winProbability = normalCDF(zScore);
```

### Styling Consistency

Use the established Worm Arena design tokens:
- `worm-pill-green` for highlighted metrics
- `worm-header-*` for header elements
- Role colors via `getWormArenaRoleColors('compare' | 'baseline')`

### State Management

The Live page already has complex state. Don't add more hooks than necessary:
- Fetch ratings ONCE when models are selected
- Store in local state, don't refetch during match
- Ratings don't change mid-match anyway

---

## Files to Modify

| File | Change |
|------|--------|
| `client/src/hooks/useMatchupRatings.ts` | NEW - combined hook for both models |
| `client/src/components/WormArenaMatchupStatsStrip.tsx` | NEW - pre-match stats display |
| `client/src/components/WormArenaLiveScoreboard.tsx` | Extend with optional rating props |
| `client/src/pages/WormArenaLive.tsx` | Wire up new hooks and components |

---

## Why This Matters

The design philosophy doc says: *"This isn't a UI about a game. It's a window into how TrueSkill learned about a model's skill."*

For the Live page, that means:
- Users should understand WHO is playing (ratings, not just names)
- Users should have EXPECTATIONS going in (win probability)
- Users should get CONTEXT after (was the result expected?)

This transforms the Live page from "watch two snakes" into "watch a TrueSkill experiment unfold."

---

## Open Questions for User

1. Should stats collapse when streaming starts, or stay visible?
2. Full snapshot cards (like Stats page) or compact strip?
3. Show head-to-head history if models have played before?

---

**Next step**: Implement Phase 1 (pre-match stats strip) and get user feedback before expanding.
