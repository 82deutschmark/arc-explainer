# Implementation Plan: Recent Matches Component & Clickable Leaderboard

**Date:** 2025-12-20
**Author:** Claude Sonnet 4.5
**Status:** Ready for Implementation

## Overview
Two tasks:
1. Create a reusable `WormArenaRecentMatches` component to display recent matches for a specific model
2. Make the TrueSkill leaderboard clickable on the Stats page

## Task 1: Create WormArenaRecentMatches Component

### Files to Create

#### 1. `client/src/hooks/useWormArenaRecentMatches.ts` (NEW)
**Purpose:** Hook for fetching recent matches for a specific model

**Implementation:**
- Accepts `modelSlug: string` and `limit: number = 10` parameters
- Fetches from `/api/snakebench/matches?model={modelSlug}&limit={limit}&sortBy=startedAt&sortDir=desc`
- Returns `{ matches, isLoading, error, refresh }`
- Uses `apiRequest` helper (same pattern as `useWormArenaGreatestHits`)
- Auto-fetches on mount and when `modelSlug` or `limit` changes

**File Header:**
```typescript
/**
 * Author: Claude Sonnet 4.5
 * Date: 2025-12-20
 * PURPOSE: Hook for fetching recent matches for a specific model from /api/snakebench/matches.
 *          Used by WormArenaRecentMatches component.
 * SRP/DRY check: Pass - focused on recent matches data fetching only.
 */
```

#### 2. `client/src/components/wormArena/WormArenaRecentMatches.tsx` (NEW)
**Purpose:** Reusable component for displaying recent matches

**Props Interface:**
```typescript
interface WormArenaRecentMatchesProps {
  modelSlug: string;      // Required: which model's matches to display
  limit?: number;         // Optional: default 10
  className?: string;     // Optional: additional styling
}
```

**Layout Structure:**
- Card container with CardHeader and CardContent
- Title: "Recent Matches"
- Scrollable content area (max-h-[560px]) - matches WormArenaGreatestHits pattern
- Each match displayed as a bordered card/row with:
  - Opponent name (font-mono)
  - Result badge (won/lost/tied with color coding)
  - Score display (myScore - opponentScore)
  - Metadata badges: rounds, cost (if > 0), death reason
  - Date (formatted)
  - "View replay" link

**Styling:**
- Follow WormArenaGreatestHits pattern exactly
- Use worm-card, worm-border, worm-ink, worm-muted classes
- Result badges: green for won, red for lost, gray for tied
- Grid layout: `grid grid-cols-1 md:grid-cols-[1fr_auto]`
- Badge styling: `variant="outline"` with `font-semibold text-sm px-2 py-1`

**Helper Functions:**
- `normalizeGameId(gameId)` - Remove 'snake_game_' prefix and '.json' suffix
- `formatDate(isoString)` - Convert to localized date string
- Reuse from WormArenaGreatestHits where possible

**States:**
- Loading: "Loading recent matches..."
- Error: Display error message in red
- Empty: "No matches found for {modelSlug}"
- Success: Display scrollable list of matches

**File Header:**
```typescript
/**
 * Author: Claude Sonnet 4.5
 * Date: 2025-12-20
 * PURPOSE: Reusable component for displaying recent Worm Arena matches for a specific model.
 *          Fetches match data internally via useWormArenaRecentMatches hook.
 *          Each match is clickable and links to replay viewer.
 *          Follows WormArenaGreatestHits pattern for layout and styling.
 * SRP/DRY check: Pass - single responsibility of displaying recent matches.
 *                Reuses existing API endpoint and types.
 */
```

### Files to Modify

#### 3. `client/src/pages/WormArenaModels.tsx`
**Location:** After stats cards section (around line 236, before Match History Table)

**Changes:**
1. Import the component:
   ```typescript
   import WormArenaRecentMatches from '@/components/wormArena/WormArenaRecentMatches';
   ```

2. Add component between stats cards and match history table:
   ```tsx
   {/* Recent Matches */}
   {selectedModel && (
     <div className="mb-6">
       <WormArenaRecentMatches modelSlug={selectedModel} limit={10} />
     </div>
   )}
   ```

**Rationale:** The page already has `selectedModel` state. This placement shows recent matches prominently while keeping full history below.

## Task 2: Make TrueSkill Leaderboard Clickable

### Files to Modify

#### 4. `client/src/pages/WormArenaStats.tsx`
**Location:** Lines 118-122

**Current Code:**
```typescript
<WormArenaTrueSkillLeaderboard
  entries={trueSkillEntries}
  isLoading={loadingTrueSkill}
  error={trueSkillError}
/>
```

**Updated Code:**
```typescript
<WormArenaTrueSkillLeaderboard
  entries={trueSkillEntries}
  isLoading={loadingTrueSkill}
  error={trueSkillError}
  selectedModelSlug={selectedModel}
  onSelectModel={handleSelectModel}
/>
```

**Rationale:** The component already supports these props (onSelectModel callback and selectedModelSlug for highlighting). The page already has handleSelectModel function (lines 85-87) that updates state. This two-line change enables clicking.

## Implementation Order

1. **Fix clickable leaderboard** (`WormArenaStats.tsx`) - 2 min
   - Add two props to existing component
   - Quick win to test immediately

2. **Create hook** (`useWormArenaRecentMatches.ts`) - 10 min
   - Define interface and state
   - Implement fetch logic
   - Add useEffect for auto-fetching

3. **Create component** (`WormArenaRecentMatches.tsx`) - 25 min
   - Define props interface
   - Create layout following WormArenaGreatestHits pattern
   - Add helper functions
   - Implement loading/error/empty states
   - Style with worm theme

4. **Integrate into Models page** (`WormArenaModels.tsx`) - 3 min
   - Import component
   - Add to layout

## Testing Checklist

- [ ] Stats page: Click leaderboard rows, verify model details update
- [ ] Models page: Select model, verify recent matches appear
- [ ] Recent matches: Click replay links, verify navigation to correct game
- [ ] Recent matches: Verify all badges display correctly (rounds, cost, result)
- [ ] Recent matches: Test with model that has no matches (empty state)
- [ ] Recent matches: Verify loading state appears briefly
- [ ] Recent matches: Verify scrolling works with many matches

## Key Design Decisions

**Why model-specific component?**
- User specified "initially used on Models page" which has model context
- Matches the pattern of WormArenaGreatestHits (focused, specific data)
- Can be extended later for global view if needed

**Why internal data fetching?**
- Follows WormArenaGreatestHits pattern (component fetches own data)
- Better encapsulation and reusability
- Simpler API for consumers

**Why separate hook?**
- Reusability (can use hook independently)
- Easier testing
- Follows existing codebase patterns

## Files Summary

**New Files:**
1. `client/src/hooks/useWormArenaRecentMatches.ts`
2. `client/src/components/wormArena/WormArenaRecentMatches.tsx`

**Modified Files:**
1. `client/src/pages/WormArenaStats.tsx` (lines 118-122)
2. `client/src/pages/WormArenaModels.tsx` (around line 236)

**Reference Files:**
- `client/src/components/WormArenaGreatestHits.tsx` - Layout/styling pattern
- `client/src/hooks/useWormArenaGreatestHits.ts` - Hook pattern
- `shared/types.ts` - Type definitions (SnakeBenchMatchSearchRow)

## Estimated Time
Total: ~40 minutes
