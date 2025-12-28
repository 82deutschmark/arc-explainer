# Arc3 Games Modular Refactoring Plan

**Author:** Claude Haiku 4.5
**Date:** 2025-12-27
**Purpose:** Split monolithic `shared/arc3Games.ts` into modular, extensible structure for 100+ game scalability. Includes epic replay integration and LS20 analysis.
**SRP/DRY Check:** Pass - Restructures to maximize modularity and minimize duplication.

---

## Problem Statement

### Current Architecture (BAD)
- **File:** `shared/arc3Games.ts` (383 lines, monolithic)
- **Issue 1:** All 6 games in one file → merge conflicts when collaborating
- **Issue 2:** Adding game #100 requires editing central file
- **Issue 3:** Violates SRP - one file responsible for all games
- **Issue 4:** Doesn't scale (monolithic gets worse with 100+ games)
- **Issue 5:** No clear ownership boundaries per game

### Target Architecture (GOOD)
```
shared/arc3Games/
  ├── types.ts          # All TypeScript interfaces (EpicReplay, Arc3GameMetadata, etc.)
  ├── index.ts          # Registry aggregation + helper functions
  ├── ls20.ts           # Locksmith game data (self-contained)
  ├── as66.ts           # Always Sliding game data (self-contained)
  ├── ft09.ts           # Functional Tiles game data (self-contained)
  ├── lp85.ts           # Loop & Pull game data (self-contained)
  ├── sp80.ts           # Streaming Purple game data (self-contained)
  └── vc33.ts           # Volume Control game data (self-contained)
```

**Benefits:**
- ✅ Each game is isolated and self-contained
- ✅ Adding game #100: create `game100.ts` + add 1 import in `index.ts`
- ✅ Zero merge conflicts on different games
- ✅ Clear ownership per game
- ✅ Scales to 100+ games effortlessly
- ✅ Maintains backward compatibility (consumers still import from `shared/arc3Games`)

---

## Implementation Steps

### Phase 1: Create Directory Structure (10 min)

Create directory: `shared/arc3Games/`

Files to create:
1. `shared/arc3Games/types.ts` - All interfaces
2. `shared/arc3Games/index.ts` - Registry + helpers
3. `shared/arc3Games/ls20.ts` - LS20 data
4. `shared/arc3Games/as66.ts` - AS66 data
5. `shared/arc3Games/ft09.ts` - FT09 data
6. `shared/arc3Games/lp85.ts` - LP85 data
7. `shared/arc3Games/sp80.ts` - SP80 data
8. `shared/arc3Games/vc33.ts` - VC33 data

### Phase 2: Extract Types to `types.ts` (5 min)

Move from current file:
- `DifficultyRating` type
- `GameCategory` type
- `ActionMapping` interface
- `GameHint` interface
- `GameResource` interface
- `LevelScreenshot` interface
- **NEW:** `EpicReplay` interface
- `Arc3GameMetadata` interface

**New EpicReplay interface:**
```typescript
export interface EpicReplay {
  /** Title/description of the replay (e.g., "Zanthous - 92 moves") */
  title: string;

  /** Direct URL to replay on three.arcprize.org */
  url: string;

  /** Who played it (e.g., "Zanthous") */
  player: string;

  /** Final move count or score (e.g., "92 moves", "415 moves") */
  result?: string;

  /** When this replay was recorded (ISO date or description) */
  dateRecorded?: string;

  /** Difficulty indicator or stage reached */
  level?: number | string;
}
```

**Update Arc3GameMetadata:**
```typescript
export interface Arc3GameMetadata {
  // ... existing fields ...

  /** Epic/grandmaster replays - expert playthroughs demonstrating mastery */
  epicReplays?: EpicReplay[];
}
```

### Phase 3: Create Game Data Files (20 min)

Each game file exports single `Arc3GameMetadata` object.

**File structure (example: `ls20.ts`):**
```typescript
/*
 * Author: Claude Haiku 4.5
 * Date: 2025-12-27
 * PURPOSE: Game metadata for LS20 (Locksmith).
 * SRP/DRY check: Pass - Single responsibility for LS20 data only.
 */

import { Arc3GameMetadata } from './types';

export const ls20: Arc3GameMetadata = {
  gameId: 'ls20',
  officialTitle: 'ls20',
  informalName: 'Locksmith',
  description: '...',
  mechanicsExplanation: '...',
  // ... all LS20 data
};
```

**Special handling for LP85 & AS66 with epic replays:**

LP85 gets:
```typescript
epicReplays: [
  {
    title: 'Zanthous - 92 moves',
    url: 'https://three.arcprize.org/replay/lp85-d265526edbaa/dcae645c-3fec-4388-b805-7427f8cdb318',
    player: 'Zanthous',
    result: '92 moves',
    dateRecorded: 'Early 2025',
    level: 'Complete'
  }
]
```

AS66 gets:
```typescript
epicReplays: [
  {
    title: 'Zanthous - 415 moves',
    url: 'https://three.arcprize.org/replay/as66-821a4dcad9c2/515e3de3-0b2a-4199-b268-4b1f84d75e10',
    player: 'Zanthous',
    result: '415 moves',
    dateRecorded: 'Early 2025',
    level: 'Complete'
  }
]
```

### Phase 4: Create Index Registry (`index.ts`) (5 min)

```typescript
/*
 * Author: Claude Haiku 4.5
 * Date: 2025-12-27
 * PURPOSE: Central registry aggregating all Arc3 games and providing helper functions.
 * SRP/DRY check: Pass - Single responsibility for game registry aggregation.
 */

import { ls20 } from './ls20';
import { as66 } from './as66';
import { ft09 } from './ft09';
import { lp85 } from './lp85';
import { sp80 } from './sp80';
import { vc33 } from './vc33';

// Re-export all types
export * from './types';

// The main registry
export const ARC3_GAMES: Record<string, Arc3GameMetadata> = {
  ls20,
  as66,
  ft09,
  lp85,
  sp80,
  vc33,
};

// Helper functions (move from original file)
export function getAllGames(): Arc3GameMetadata[] {
  return Object.values(ARC3_GAMES).sort((a, b) => {
    if (a.category !== b.category) {
      return a.category === 'preview' ? -1 : 1;
    }
    return a.gameId.localeCompare(b.gameId);
  });
}

export function getGamesByCategory(category: GameCategory): Arc3GameMetadata[] {
  return getAllGames().filter(game => game.category === category);
}

export function getGameById(gameId: string): Arc3GameMetadata | undefined {
  return ARC3_GAMES[gameId];
}

export function hasGameMetadata(gameId: string): boolean {
  return gameId in ARC3_GAMES;
}
```

### Phase 5: Update LS20 with Analysis Resource (5 min)

**Create analysis file:**
- Copy `.cache/external/ARC-AGI-3-ClaudeCode-SDK/notes/game-ls20-016295f7601e-analysis.md`
- → `docs/arc3-game-analysis/ls20-analysis.md`

**Update LS20 game data (`ls20.ts`):**
Add to `resources` array:
```typescript
{
  title: 'LS20 Game Analysis',
  url: 'https://github.com/anthropics/arc-explainer/blob/main/docs/arc3-game-analysis/ls20-analysis.md',
  type: 'article',
  description: 'Detailed frame-by-frame analysis of LS20 grid patterns, color mappings, and action effects'
}
```

### Phase 6: Update UI to Display Epic Replays (10 min)

**File:** `client/src/pages/Arc3GameSpoiler.tsx`

Add new section after "Mechanics" and before "Resources":

```typescript
{game.epicReplays && game.epicReplays.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Gamepad2 className="h-5 w-5" />
        Expert Playthroughs
      </CardTitle>
      <CardDescription>
        Watch expert players master this game
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {game.epicReplays.map((replay, idx) => (
          <div
            key={idx}
            className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
          >
            <div className="flex-1">
              <div className="font-semibold text-sm">{replay.title}</div>
              {replay.dateRecorded && (
                <div className="text-xs text-muted-foreground">{replay.dateRecorded}</div>
              )}
            </div>
            <a
              href={replay.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 inline-flex items-center gap-1 px-3 py-1 rounded text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Watch <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

### Phase 7: Verify Backward Compatibility (10 min)

**Test all imports still work:**
```typescript
// Old import path still works (via index re-exports)
import { ARC3_GAMES, getGameById } from '@/shared/arc3Games';

// Also supports direct type imports
import type { Arc3GameMetadata, EpicReplay } from '@/shared/arc3Games';
```

**Update all imports in codebase:**
- `client/src/pages/Arc3GamesBrowser.tsx` - ✓ (auto-works)
- `client/src/pages/Arc3GameSpoiler.tsx` - ✓ (auto-works)
- `server/routes/arc3.ts` - ✓ (auto-works)
- Any other imports of arc3Games - ✓ (auto-works)

### Phase 8: Delete Original Monolithic File (2 min)

Delete: `shared/arc3Games.ts`

(All functionality is now in `shared/arc3Games/` directory)

---

## Migration Path - Zero Breaking Changes

**Current imports work unchanged:**
```typescript
import { ARC3_GAMES, getGameById } from '@/shared/arc3Games';
import type { Arc3GameMetadata, DifficultyRating } from '@/shared/arc3Games';
```

**Why it works:**
- `shared/arc3Games.ts` becomes `shared/arc3Games/index.ts`
- TypeScript module resolution treats `/arc3Games` as directory import → `/arc3Games/index.ts`
- All re-exports in `index.ts` maintain same API surface

---

## Future Extensibility (100+ Games)

**To add game #100:**

1. Create: `shared/arc3Games/game100.ts`
```typescript
import { Arc3GameMetadata } from './types';

export const game100: Arc3GameMetadata = {
  gameId: 'game100',
  // ... game data
};
```

2. Update: `shared/arc3Games/index.ts` (2 lines added)
```typescript
import { game100 } from './game100';

export const ARC3_GAMES: Record<string, Arc3GameMetadata> = {
  // ... existing games
  game100,  // Add this line
};
```

Done. Zero other changes needed.

---

## Files to Modify

| File | Action | Lines |
|------|--------|-------|
| `shared/arc3Games/types.ts` | Create | 130 (extract types) |
| `shared/arc3Games/index.ts` | Create | 60 (registry + helpers) |
| `shared/arc3Games/ls20.ts` | Create | 60 |
| `shared/arc3Games/as66.ts` | Create | 55 |
| `shared/arc3Games/ft09.ts` | Create | 50 |
| `shared/arc3Games/lp85.ts` | Create | 25 (with epic replay) |
| `shared/arc3Games/sp80.ts` | Create | 20 |
| `shared/arc3Games/vc33.ts` | Create | 20 |
| `client/src/pages/Arc3GameSpoiler.tsx` | Edit | +35 (epic replays section) |
| `docs/arc3-game-analysis/ls20-analysis.md` | Create | (copy from cache) |
| `shared/arc3Games.ts` | Delete | (old monolithic file) |

---

## Success Criteria

- [ ] All types extracted to `shared/arc3Games/types.ts`
- [ ] Each game has its own file (ls20.ts, as66.ts, etc.)
- [ ] Index file aggregates all games and exports same API
- [ ] LP85 displays epic replay (92 moves by Zanthous)
- [ ] AS66 displays epic replay (415 moves by Zanthous)
- [ ] LS20 has analysis resource link
- [ ] Arc3GameSpoiler shows "Expert Playthroughs" section when replays exist
- [ ] All existing imports work unchanged (zero breaking changes)
- [ ] No console errors or import failures
- [ ] Game detail pages render correctly on mobile

---

## Timeline Estimate

- **Phase 1-2:** 15 min (setup + types)
- **Phase 3:** 20 min (create game files)
- **Phase 4:** 5 min (create index)
- **Phase 5:** 5 min (LS20 analysis)
- **Phase 6:** 10 min (UI updates)
- **Phase 7:** 10 min (verify imports)
- **Phase 8:** 2 min (cleanup)
- **Testing:** 10 min (verify all pages)

**Total: ~75 minutes**

