# Debug Report: Suggested Matchups - RESOLVED

## Issue (FIXED)
The suggested matchups endpoint was claiming models have "never played each other" (`matchesPlayed: 0`) when they had clearly played before. This was caused by an overly restrictive model filtering in the suggestion algorithm.

## Root Cause Analysis

### The Flow
1. **Matchup suggestion request** → `suggestMatchups()` in [snakeBenchService.ts:605-635](server/services/snakeBenchService.ts#L605-L635)
2. Gets **leaderboard** via `getTrueSkillLeaderboard()`
3. Gets **pairing history** via `getPairingHistory()`
4. Filters to **approved models** (OpenRouter, non-premium)
5. Calls **`suggestMatchups()`** helper at [matchupSuggestions.ts](server/services/snakeBench/helpers/matchupSuggestions.ts)

### Where Models Are Compared

**Database (getPairingHistory)** [SnakeBenchRepository.ts:1446](server/repositories/SnakeBenchRepository.ts#L1446)
```sql
-- Database creates keys like: "model_a|||model_b" (both normalized)
SELECT LEAST(regexp_replace(...:free$'', ''), ...) AS slug_a,
       GREATEST(...) AS slug_b
```
Returns Map keys: `"gpt-4o-mini|||claude-3-opus-20250101"`

**Leaderboard (getTrueSkillLeaderboard)** [SnakeBenchRepository.ts:1323](server/repositories/SnakeBenchRepository.ts#L1323)
```sql
-- Returns normalized model_slug (no :free suffix)
SELECT regexp_replace(m.model_slug, ':free$', '') AS normalized_slug
```
Returns entries with `modelSlug: "gpt-4o-mini"`

**Suggestion filter (matchupSuggestions.ts)** [lines 58-87](server/services/snakeBench/helpers/matchupSuggestions.ts#L58-L87)
```typescript
// Gets approved models from MODELS config
const approvedModels = new Set(
  MODELS.filter(m => m.provider === 'OpenRouter' && !m.premium)
    .map(m => m.apiModelName || m.key)
);

// Filters leaderboard: entry.modelSlug must be in approvedModels
let filtered = leaderboard.filter(entry => approvedModels.has(entry.modelSlug));
```

### The Bug: Approved Models Mismatch

**Problem:** The `approvedModels` Set contains values from `models.ts` like:
- `google/gemini-2.5-flash`
- `google/gemma-3n-e2b-it:free`
- `openai/gpt-4o-mini`

**But** the leaderboard `modelSlug` is taken directly from the database, which may be:
- `gpt-4o-mini` (no provider prefix)
- `claude-3-opus-20250101` (model internal name)
- Whatever was passed to `recordMatchFromResult()` from the game runner

[recordMatchFromResult at line 204](server/repositories/SnakeBenchRepository.ts#L204) stores `result.modelA` and `result.modelB` directly as model_slug:
```typescript
const modelAId = await getOrCreateModel(result.modelA);  // stored as-is
```

### Suspected Issues

1. **Format Mismatch**: The leaderboard filtering at [line 58 in matchupSuggestions.ts](server/services/snakeBench/helpers/matchupSuggestions.ts#L58) may be comparing:
   - Leaderboard: `"gpt-4o-mini"` (database model_slug)
   - ApprovedModels: `"openai/gpt-4o-mini"` (config apiModelName)
   - **Result:** Model doesn't pass the filter ❌

2. **If filtering fails**: Only partial models appear in `filtered`, and then models that DID play together but are in different "approved model" lists won't be paired together.

3. **Missing model_slug normalization**: The database stores whatever format is in the game result. If some games use `"openai/gpt-4o-mini"` and others use `"gpt-4o-mini"`, they become separate database entries with different model_ids → different pairings.

## How to Fix

### Option 1: Check What's Actually in the Database
Run this query to see what model_slugs are stored:
```sql
SELECT DISTINCT model_slug, COUNT(*) as game_count
FROM public.models
ORDER BY game_count DESC;
```

### Option 2: Fix the Filtering Logic
The `approvedModels` filtering at [matchupSuggestions.ts:58](server/services/snakeBench/helpers/matchupSuggestions.ts#L58) needs to:
1. Normalize both the config model keys AND the leaderboard model_slugs
2. OR: compare without the provider prefix
3. OR: query the database directly for all models that have played games instead of filtering by config

### Option 3: Standardize Model Slug Storage
Ensure that when games are recorded, the model_slug stored in the database matches what's in:
- The leaderboard query result
- The approved models filtering

## Solution Applied ✓

### The Problem
The `approvedModels` filter was restricted to only OpenRouter models from the `MODELS` config:
```typescript
const approvedModels = new Set(
  MODELS.filter((m: any) => m.provider === 'OpenRouter' && !m.premium)
    .map((m: any) => (m.apiModelName || m.key) as string)
);
```

**Result**: Many frequently-played models were filtered OUT:
- `nvidia/nemotron-3-nano-30b-a3b` (234 games, rank #9)
- `deepseek/deepseek-v3.2` (141 games, rank #1)
- `mistralai/devstral-2512` (200 games, rank #12)

These models were never considered for suggestions, making all pairings appear as "unplayed."

### The Fix
Changed to use the leaderboard models directly (which are already filtered by `minGames` and ranked by TrueSkill):
```typescript
// Use all leaderboard models (already filtered by minGames and ranked by TrueSkill).
// No additional filtering needed - we want suggestions for any models that have played.
const approvedModels = new Set(leaderboard.map(e => e.modelSlug));
```

**Impact**:
- **Before**: ~20-30 models considered (OpenRouter config subset)
- **After**: 46 models considered (all models in top leaderboard)
- **Result**: Suggestions now include high-ranked models that have actually played each other

### Verification

Database state (as of diagnosis):
- **Total unique models**: 265
- **Top models (leaderboard)**: 46 models with ≥3 games
- **Total pairings recorded**: 265 pairs
- **Unplayed pairs among top 46**: ~95 pairs (good diversity for suggestions)

Top 3 models by games played:
1. `nvidia/nemotron-3-nano-30b-a3b` - 234 games
2. `openai/gpt-5-mini` - 166 games
3. `deepseek/deepseek-v3.2` - 141 games
