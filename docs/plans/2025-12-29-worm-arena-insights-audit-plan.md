# WormArena Model Insights Comprehensive Audit & Enhancement Plan

**Date:** 2025-12-29
**Author:** Claude Haiku 4.5
**Status:** Planning
**Objective:** Ensure all pre-calculated metrics are passed to the LLM for comprehensive model analysis

---

## Executive Summary

The WormArena Model Insights system calculates rich performance metrics in `AnalyticsRepository.getModelInsightsData()` but **fails to pass several key statistics to the LLM prompt**. This results in the LLM generating insights with incomplete context.

**Current State:** 25+ metrics calculated, ~15 passed to LLM, ~10 missing from prompt
**Goal:** Audit all available data and ensure complete payload reaches the LLM

---

## Current Data Flow

### What's Calculated (AnalyticsRepository.ts:29-189)

**Summary Statistics (107-136):**
- `gamesPlayed`, `wins`, `losses`, `ties`, `winRate`
- `totalCost`, `costPerGame`, `costPerWin`, `costPerLoss`
- `averageRounds`, `minRounds`, `maxRounds`
- `averageScore`, `minScore`, `maxScore`, `medianScore`, `p75Score`, `totalApples`
- `averageDeathRoundLoss`, `earlyLosses`, `earlyLossRate`, `lossDeathReasonCoverage`, `unknownLosses`
- `trueSkillMu`, `trueSkillSigma`, `trueSkillExposed`

**Ranking Data (76-100):**
- `leaderboardRank` — model's position in TrueSkill leaderboard
- `totalModelsRanked` — total models with games played

**Failure Modes (138-153):**
- `reason`, `losses`, `percentOfLosses`, `averageDeathRound`

**Loss Opponents (155-182):**
- `opponentSlug`, `gamesPlayed`, `wins`, `losses`, `ties`, `lossRate`, `lastPlayedAt`

### What's Passed to LLM (snakeBenchService.ts:79-127)

**buildInsightsSummaryPrompt() includes:**
- `modelSlug`
- `gamesPlayed`, `wins`, `losses`, `winRate`
- `minRounds`, `avgRounds`, `maxRounds`
- `minScore`, `medianScore`, `p75Score`, `maxScore`, `totalApples`
- `avgScore`, `costPerLoss`
- `earlyLossRate`, `lossCoverage` (lossDeathReasonCoverage)
- `trueSkillNote` (formatted from mu/sigma/exposed)
- Top 4 failure modes (formatted)
- Top 4 tough opponents (formatted)

---

## Identified Gaps

### Missing from WormArenaModelInsightsSummary Type (shared/types.ts:813-841)

The type has **no fields for**:
- ❌ `leaderboardRank` — Calculated (line 99) but type doesn't include it
- ❌ `totalModelsRanked` — Calculated (line 100) but type doesn't include it

### Missing from LLM Prompt (snakeBenchService.ts:78-127)

Data calculated but **not passed to the LLM**:
1. ❌ `ties` — How many draws occurred (valuable for competitive context)
2. ❌ `totalCost` — Total API spend (helps contextualize cost efficiency)
3. ❌ `costPerGame` — Normalized cost metric
4. ❌ `costPerWin` — Win efficiency in dollars
5. ❌ `averageDeathRoundLoss` — **Critical gap!** Average round of death is calculated but not shown (only early loss rate is shown)
6. ❌ `unknownLosses` — Count of losses without recorded death reason
7. ❌ `leaderboardRank` & `totalModelsRanked` — Competitive context (where does this model rank?)

### Win-Rate Denominator Clarification (AnalyticsRepository.ts:110)

**Current definition:**
```typescript
winRate: (wins + losses) > 0 ? wins / (wins + losses) : 0,
```

**Issue:** This excludes ties, showing "win % of decisive games" not "win % of all games"

**Current usage (snakeBenchService.ts:119):**
```
`Games: ${summary.gamesPlayed}, Wins: ${summary.wins}, Losses: ${summary.losses}, Win rate: ${formatPercent(summary.winRate)}`
```

**Action:** Clarify labeling in prompt to avoid ambiguity:
- Show both: win rate (decisive games) AND match record with ties explicit
- Option 1: Add tie count and label clearly: `"Wins: ${wins}, Losses: ${losses}, Ties: ${ties} — Win rate: ${formatPercent(winRate)} (ties excluded)"`
- Option 2: Show "match win rate" as `wins / gamesPlayed` separately
- **Recommendation:** Use Option 1 — keep current calculation but add tie count to context so LLM understands the denominator

### Current Prompt Gaps Analysis

**Line 121 - Score Distribution:**
```
`Apples: Min ${minScore} / Median ${medianScore} / 75th %ile ${p75Score} / Max ${maxScore} (Total: ${totalApples})`
```
✓ Good coverage BUT missing `p25Score` for complete quartile analysis

**Line 122 - Cost Context:**
```
`Average score: ${avgScore}, Cost per loss: ${costPerLoss}`
```
- `avgScore` is less informative than median (already shown) in a competitive context
- Missing `costPerGame` and `costPerWin` for comprehensive cost analysis
- Missing `totalCost` for understanding overall investment

**Missing Entirely:**
- Ties count and tie rate
- Average death round for losses (only "early loss rate" shown)
- Unknown losses (data quality indicator)
- Leaderboard rank (competitive positioning)

---

## Data Quality Insights

### What's Pre-Calculated Well
✓ Complete win/loss/tie breakdown
✓ Percentile analysis (median + p75)
✓ TrueSkill rating with uncertainty (mu/sigma/exposed)
✓ Death reason attribution and categorization
✓ Opponent matchup history
✓ Leaderboard ranking (computed dynamically)

### What Could Be Enhanced
- **25th percentile score** — Would provide lower-quartile context (expensive games)
- **Standard deviation** — Volatility of performance
- **Temporal trends** — Is performance improving/declining? (Requires time-series, not in current schema)
- **Win opponents** — Top opponents the model beats (currently only shows "tough opponents")

---

## Implementation Plan

### Phase 1: Update Type Definition
**File:** `shared/types.ts` (lines 813-841)

Add to `WormArenaModelInsightsSummary`:
```typescript
leaderboardRank: number | null;      // Rank in TrueSkill leaderboard
totalModelsRanked: number | null;    // Total models with >= 1 game
```

### Phase 2: Update Repository Return Value
**File:** `server/repositories/AnalyticsRepository.ts` (lines 107-136)

Modify the `summary` object returned from `getModelInsightsData()` to include:
```typescript
leaderboardRank,
totalModelsRanked,
```

(These are already calculated on lines 99-100; just add to return object)

### Phase 3: Enhance LLM Prompt
**File:** `server/services/snakeBenchService.ts` (lines 78-127)

Update `buildInsightsSummaryPrompt()` to pass all pre-calculated metrics:

1. **Add tie statistics and clarify win-rate denominator** (line 119):
   ```typescript
   `Games: ${summary.gamesPlayed} (${summary.wins}W / ${summary.losses}L / ${summary.ties}T), Win rate: ${formatPercent(summary.winRate)} (ties excluded)`
   ```

2. **Add leaderboard context** (new line after record):
   ```typescript
   `Leaderboard: Rank #${summary.leaderboardRank} of ${summary.totalModelsRanked} models (by TrueSkill exposed rating)`
   ```

3. **Enhance cost breakdown** (replace line 122):
   ```typescript
   `Cost: Total ${formatCost(summary.totalCost)} / Per-game ${formatCost(summary.costPerGame)} / Per-win ${formatCost(summary.costPerWin)} / Per-loss ${formatCost(summary.costPerLoss)}`
   ```

4. **Add death round statistics** (new line after early loss rate):
   ```typescript
   `Death patterns: Avg round ${formatOptionalNumber(summary.averageDeathRoundLoss, 1)} when losing, ${summary.unknownLosses} losses without recorded death reason`
   ```

5. **Optional - review avgScore usage** (current line 122):
   - Currently shown alongside cost metrics
   - Consider if median (already shown in score line) is more informative
   - Decision: Keep if it provides competitive context, remove if redundant with quartile data

### Phase 4: Verify System Instructions
**File:** `server/services/snakeBenchService.ts` (lines 156-157)

Current system prompt is good:
> "You are an eSports commentator covering how this LLM plays Snake..."

With additional context (rank, cost breakdown, death round), LLM can provide richer analysis without prompt changes.

### Phase 5: Consider Future Enhancements (Not in Scope)
These are calculated but could be added later:

- [ ] **p25Score** — Add 25th percentile to score distribution
- [ ] **Win opponent context** — Show top opponents the model beats (not just losses to)
- [ ] **Consistency metric** — Standard deviation or coefficient of variation in scores
- [ ] **Recent performance** — Last N games trend (requires temporal data, not in current schema)

---

## Critical Files to Modify

| File | Lines | Specific Change | Why |
|------|-------|-----------------|-----|
| `shared/types.ts` | 813-841 | Add 2 fields to `WormArenaModelInsightsSummary`: `leaderboardRank: number \| null` and `totalModelsRanked: number \| null` | Rank is calculated but not in type definition |
| `server/repositories/AnalyticsRepository.ts` | 107-136 | Add to return object: `leaderboardRank,` and `totalModelsRanked,` | Rank is computed (lines 97-100) but never included in summary |
| `server/services/snakeBenchService.ts` | 78-127 | Update `buildInsightsSummaryPrompt()` to pass: ties, leaderboard rank, all cost metrics, average death round, unknown losses | Complete metrics coverage |

---

## Testing Strategy

1. **Unit Test:** Verify `getModelInsightsData()` returns non-null rank values
2. **Integration Test:** Call `streamModelInsightsReport()` and verify prompt includes all fields
3. **Manual Test:** Review generated insights and verify LLM references:
   - Leaderboard rank
   - Cost per win (not just per loss)
   - Death round average (not just early loss rate)
   - Tie count
4. **Regression Test:** Ensure existing prompt fields still display correctly

---

## Notes

- **No new queries needed** — All data already calculated and available
- **Backward compatible** — Type additions are optional fields; existing code unaffected
- **LLM prompt is flexible** — Adding context doesn't require instruction changes
- **UI may need updates** — If these fields are displayed anywhere, ensure formatting works (e.g., rank display when totalModelsRanked is null)

---

## Success Criteria

✅ All calculated metrics from `AnalyticsRepository` are represented in the type
✅ All available metrics are included in the LLM prompt
✅ LLM receives complete competitive and cost context
✅ Generated insights reference leaderboard rank, death patterns, and cost efficiency
✅ No performance regression in query or prompt generation time
