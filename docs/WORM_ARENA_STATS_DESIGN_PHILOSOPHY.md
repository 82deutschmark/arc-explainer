# Worm Arena Stats Page — Design Philosophy

**Author:** Claude Haiku
**Date:** 2025-12-10
**Purpose:** Design principles grounded in deep project knowledge, not generic patterns

---

## What I Learned That Changes Everything

After analyzing the **actual codebase**, not assumptions:

1. **TrueSkill is not Elo** — It's a probabilistic skill model with uncertainty (`sigma`) that shrinks with games. This is the *story*, not just decoration. Users need to see `sigma` reduce from ~8.3 → ~3.5 across 9 games. That's placement working.

2. **Result confidence weighting is the secret sauce** — A loss to a same-skill opponent with a close score has `0.25 confidence` (fluke). A wall death at round 1 with low score has `1.0 confidence` (definitive). This isn't trivia—it directly explains *why* one game moved your rating 0.1 points and another moved it 2 points.

3. **The 9-game narrative is real** — Players go through actual placement. They play game 1, then we compute which opponent gives maximum information gain. That opponent is selected automatically. After 9 games (or when `sigma <= 3.0`), placement is done. Users should **see this unfolding**, not be told it happened.

4. **Game structure reveals model differences** — The data shows:
   - Top models: 8–10 apples/game average
   - Bottom models: 0.1–0.4 apples/game average
   - Death reasons encode *how* models fail: wall deaths (early, bad play) vs head collisions (both died, random tiebreaker)

   This is visible data that explains skill without jargon.

5. **Opponent matching reveals strategic selection** — The `information_gain` calculation prefers opponents near your current rating. A model at rank 50 doesn't play rank 1 then rank 100; it plays rank 45, rank 55, rank 40. The UI should show *why* each opponent was chosen.

---

## What This Means for Design

### Principle 1: Show Uncertainty as the Core Story

The `sigma` value **is** the placement progress, not a separate metric. Design around `sigma` reducing visually:

- Graph of `mu ± 2*sigma` per game, showing the confidence band narrowing
- "Uncertainty shrinking" is the visual metaphor, not "progressing through 9 games"
- When sigma drops below 3.0, the rating "locks in"—this is a moment of clarity in the UI

### Principle 2: Explain Confidence, Not Hide It

Each game in the history table should show:
- **Confidence level** (visual indicator: low/medium/high)
- **Why** that confidence (score diff + death reason + game length)
- How this game moved the rating (delta mu, delta sigma)

This is what makes SnakeBench's placement system *better* than Elo—it's transparent about uncertainty.

### Principle 3: Surface Opponent Selection Logic

Rather than showing "vs Opponent X, won 5–2", show:
- **Opponent's rating** at time of game
- **Information gain value** (how informative was this matchup for us?)
- **Outcome**: Did the game land as expected? (high confidence win, close game, upset loss?)

This explains why the backend picked that opponent.

### Principle 4: Make the Math Visible, Not Hidden

Show equations/formulas subtly:
- "μ = 25.0 (your current estimate)"
- "σ = 3.2 (we're 95% sure you're between 14.4–35.6)"
- "Exposed = μ - 3σ = 15.4 (pessimistic bound)"
- "Display = 15.4 × 50 = 770 (UI score)"

**Not** as a tutorial, but as tooltips and legends. Users want to *understand* the number, not just see it.

### Principle 5: Respect the Competitive Context

This is **ARC Explainer's Worm Arena**—a research tool where model developers understand their placement *scientifically*. The design should:
- Assume users read the TrueSkill docs (at least the basics)
- Show data, not simplifications
- Honor precision (3 decimal places where it matters)
- Avoid patronizing copy ("Your snake is very skilled!")

---

## What the UI Reflects

### The Data Model is the Design

The UI structure follows SnakeBench's actual data flow:

```
1. User selects model
   ↓
2. Query: model's current trueskill_mu, trueskill_sigma, trueskill_exposed
   ↓
3. Query: model's placement state (games_played, sigma trajectory)
   ↓
4. Query: match history with opponent ratings & result confidence
   ↓
5. Derive: how many games left? (max 9, or until sigma <= 3.0)
   ↓
6. Visualize: each game as a point on (sigma, mu) graph, showing convergence
```

**Not** "show me a dashboard"—show me *this model's placement journey*.

### Colors Encode Data

- **Green** (#9ece6a) = High confidence, decisive wins, low uncertainty
- **Orange** (#ff9a56) = Medium confidence, placement in progress, sigma still shrinking
- **Red** (#ff6b6b) = Low confidence losses, upsets, rematches
- **Muted tones** elsewhere (not "fun colors everywhere")

This creates visual meaning: green-dominated graphs show converged, confident ratings.

### Tables are Dense Because Data is Rich

Match history isn't a simple list. Each row encodes:
- Opponent strength at time of match (not just name)
- Result + confidence (won with 0.9 confidence vs won with 0.4 confidence)
- Score differential (raw apples)
- Game length (did it end early or run long?)
- Death reason (wall, body, head collision—reveals strategic error vs randomness)
- Impact on mu and sigma (delta values)

**This is real information density**, not decorative data.

---

## What This is NOT

- **Not a leaderboard UI** — This is a single-model placement viewer, not a competitive ranking board
- **Not a game replay analyzer** — It doesn't show move-by-move; it's aggregated stats
- **Not a tutorial** — Users know TrueSkill basics; don't explain from scratch
- **Not a motivational dashboard** — Avoid "You're awesome!" copy; users want *truth*

---

## Technical Constraints That Inform Design

1. **Live data from `/api/snakebench/stats/model-rating?modelSlug=...`**
   - Must handle models mid-placement (gamesPlayed < 9, sigma > 3)
   - Must handle completed placement (gamesPlayed >= 9 and sigma <= 3)
   - Must gracefully show models with 0 games (mu=25, sigma=8.33, exposed≈0)

2. **Opponent ratings change over time**
   - Historical game shows opponent's rating *at match time* (from opponent_rank_at_match)
   - Can't retroactively recalculate; must show what was true then

3. **Sparse cost data**
   - Some games may have `cost = NULL`
   - UI must flag this and not pretend precision we don't have

4. **Sigma reduction is non-linear**
   - Each game reduces sigma by `0.8 * confidence * margin_factor`
   - Can't predict remaining games needed; must compute from history

---

## Design Output Criteria

The final design should:

✓ **Show sigma's reduction trajectory** — The core visual metric
✓ **Explain each game's confidence & impact** — Not hide the math
✓ **Display opponent selection rationale** — Why was this opponent chosen?
✓ **Respect data precision** — Don't round away signal
✓ **Work with real, incomplete data** — Handle sparse costs, model states
✓ **Assume researcher audience** — No patronization, embrace complexity
✓ **Use color semantically** — Green = confident/converged, orange = in-progress, red = uncertain
✓ **Be mobile-responsive but dense** — Information first, even on small screens

---

## The One Thing to Remember

This isn't a UI about a game. It's a **window into how TrueSkill learned about a model's skill**. Every visual choice should serve understanding that learning process.

If a design choice doesn't help explain "why did this model's rating move this way after this game?", it doesn't belong.

---

**This is the design philosophy. The actual UI implementation should flow from these principles.**
