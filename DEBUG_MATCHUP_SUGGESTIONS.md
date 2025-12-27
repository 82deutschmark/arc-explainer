# Debug Report: Suggested Matchups Showing "Never Played" for Models That Have Played

## Issue
The suggested matchups endpoint is claiming models have "never played each other" (`matchesPlayed: 0`) when you know they've clearly played before.

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

## Debug Steps You Can Take

1. **Check current model_slugs in database:**
   ```sql
   SELECT DISTINCT model_slug FROM public.models ORDER BY model_slug;
   ```

2. **Check what's in approvedModels set:**
   Add logging to [snakeBenchService.ts:628-632](server/services/snakeBenchService.ts#L628-L632):
   ```typescript
   const approvedModels = new Set(...);
   console.log('Approved models:', Array.from(approvedModels));
   ```

3. **Check filtered leaderboard:**
   Add logging to [matchupSuggestions.ts:58](server/services/snakeBench/helpers/matchupSuggestions.ts#L58):
   ```typescript
   let filtered = leaderboard.filter(entry => approvedModels.has(entry.modelSlug));
   console.log('Leaderboard before filter:', leaderboard.length);
   console.log('Leaderboard after filter:', filtered.length);
   console.log('Unmatched slugs:', leaderboard
     .filter(e => !approvedModels.has(e.modelSlug))
     .map(e => e.modelSlug));
   ```

4. **Verify pairingHistory is being populated:**
   ```sql
   SELECT COUNT(*) as pair_count FROM public.game_participants gp1
   JOIN public.game_participants gp2 ON gp1.game_id = gp2.game_id
   WHERE gp1.player_slot < gp2.player_slot
   AND EXISTS (SELECT 1 FROM public.games WHERE status = 'completed' AND id = gp1.game_id);
   ```
