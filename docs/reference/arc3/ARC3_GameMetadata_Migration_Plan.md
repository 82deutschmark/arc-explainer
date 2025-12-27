# ARC3 Game Metadata Migration Plan
**Status:** Planning
**Date:** 2025-12-27
**Scope:** Move game metadata from hardcoded TypeScript to PostgreSQL database

---

## Problem Statement

Currently, all ARC3 game metadata lives in a single hardcoded TypeScript file:

```
shared/arc3Games.ts (383 lines, 6 games)
```

### Issues
- **Not Scalable:** ARC3 will launch with ~100 games; this approach cannot support that
- **SRP Violation:** One file contains all metadata for all games
- **DRY Violation:** Metadata structure duplicated across entries
- **Maintenance Burden:** Adding/editing games requires code changes
- **No Admin Interface:** No way to edit metadata without code deployment

### Current State
```
shared/arc3Games.ts
├── ARC3_GAMES object (hardcoded)
├── Type definitions (Arc3GameMetadata, GameResource, etc.)
├── Helper functions (getAllGames, getGameById, getGamesByCategory)
└── 6 games: ls20, as66, ft09, lp85, sp80, vc33
```

---

## Architecture Overview

### Data Sources
1. **External ARC Prize API** (`https://three.arcprize.org/api/games`)
   - Only provides: `{ game_id, title }`
   - Does NOT provide rich metadata
   - Called via `Arc3ApiClient.listGames()`

2. **Rich Metadata** (currently hardcoded)
   - Descriptions, mechanics explanations, hints, action mappings
   - Manually curated community knowledge and "spoilers"
   - Must be stored internally (not from external API)

3. **Screenshot Auto-Discovery**
   - Currently discovers level screenshots from filesystem
   - Service: `arc3ScreenshotService.ts`
   - Should continue working post-migration

### Current Usage
**6 files import from `shared/arc3Games.ts`:**

**Frontend (3 files):**
- `client/src/pages/Arc3GameSpoiler.tsx` → `getGameById()`
- `client/src/pages/Arc3GamesBrowser.tsx` → `getAllGames()`, `getGamesByCategory()`
- `client/src/pages/ARC3Browser.tsx` → `getAllGames()`

**Backend (3 files):**
- `server/routes/arc3.ts` → Wraps in API endpoints
- `server/controllers/arc3Controller.ts` → Direct `ARC3_GAMES` access
- `server/services/arc3ScreenshotService.ts` → Type imports

### Existing API Endpoints (Currently Unused)
- `GET /api/arc3/metadata/games` - Returns all games
- `GET /api/arc3/metadata/games/:gameId` - Returns single game
- `GET /api/arc3/metadata/games/:gameId/screenshots` - Returns discovered screenshots

These endpoints exist but frontend imports directly from TypeScript instead of calling them.

---

## Solution Design

### 1. Database Schema

**Add to:** `server/repositories/database/DatabaseSchema.ts`

```sql
CREATE TABLE IF NOT EXISTS arc3_game_metadata (
  id SERIAL PRIMARY KEY,

  -- Core identifiers
  game_id VARCHAR(120) NOT NULL UNIQUE,
  official_title VARCHAR(255) NOT NULL,
  informal_name VARCHAR(255),

  -- Description and mechanics
  description TEXT NOT NULL,
  mechanics_explanation TEXT,

  -- Classification
  category VARCHAR(50) NOT NULL CHECK (category IN ('preview', 'evaluation')),
  difficulty VARCHAR(50) NOT NULL DEFAULT 'unknown'
    CHECK (difficulty IN ('easy', 'medium', 'hard', 'very-hard', 'unknown')),

  -- Game configuration
  win_score INTEGER,
  max_actions INTEGER,
  level_count INTEGER,

  -- Rich metadata (stored as JSONB to preserve nested structures)
  action_mappings JSONB DEFAULT '[]',     -- ActionMapping[]
  hints JSONB DEFAULT '[]',               -- GameHint[]
  resources JSONB DEFAULT '[]',           -- GameResource[]
  level_screenshots JSONB DEFAULT '[]',   -- LevelScreenshot[]
  tags TEXT[] DEFAULT '{}',               -- String array

  -- Documentation and UI
  thumbnail_url VARCHAR(500),
  is_fully_documented BOOLEAN DEFAULT FALSE,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX idx_arc3_metadata_game_id ON arc3_game_metadata(game_id);
CREATE INDEX idx_arc3_metadata_category ON arc3_game_metadata(category);
CREATE INDEX idx_arc3_metadata_documented ON arc3_game_metadata(is_fully_documented);
```

**Why JSONB?**
- Preserves complex nested TypeScript structures without flattening
- Zero serialization/deserialization overhead
- Matches project pattern (used elsewhere for `provider_raw_response`)
- Flexible schema evolution without migrations

---

### 2. Repository Layer

**Create:** `server/repositories/Arc3GameMetadataRepository.ts`

Pattern: Extend `BaseRepository` (same as `ContributorRepository`, `AccuracyRepository`)

**Methods:**
```typescript
class Arc3GameMetadataRepository extends BaseRepository {
  // Read operations
  async getAllGames(filters?: { category?: 'preview' | 'evaluation' }): Promise<Arc3GameMetadata[]>
  async getGameById(gameId: string): Promise<Arc3GameMetadata | null>

  // Write operations
  async createGame(data: CreateGameMetadataRequest): Promise<Arc3GameMetadata>
  async updateGame(gameId: string, data: Partial<CreateGameMetadataRequest>): Promise<Arc3GameMetadata | null>
  async upsertGame(data: CreateGameMetadataRequest): Promise<Arc3GameMetadata>
  async deleteGame(gameId: string): Promise<boolean>

  // Screenshot integration
  async enrichGameWithScreenshots(game: Arc3GameMetadata): Promise<Arc3GameMetadata>

  // Admin helpers
  async getGameCount(): Promise<number>
  async getCountsByCategory(): Promise<Record<string, number>>
  async deleteAllGames(): Promise<void>

  // Internal
  private mapRowToGameMetadata(row: any): Arc3GameMetadata
}
```

**Key Details:**
- JSONB fields auto-serialize/deserialize via `JSON.stringify()` and `safeJsonParse()`
- `enrichGameWithScreenshots()` merges database screenshots + filesystem auto-discovery
- All operations are async and database-backed

---

### 3. Database Seeding

**Create:** `server/services/arc3/seedGameMetadata.ts`

```typescript
export async function seedArc3GameMetadata(repo: Arc3GameMetadataRepository): Promise<void>
```

**Logic:**
1. Check if database is empty (`repo.getGameCount()`)
2. If empty, import `ARC3_GAMES` from `shared/arc3Games.ts`
3. Upsert all 6 games into database
4. Log counts by category

**Integration:** Call from `server/index.ts` after database initialization

**Why This Approach?**
- One-time operation (idempotent)
- Soft migration: old TypeScript file remains as seed source
- No data loss
- Can be re-run safely

---

### 4. Backend Controller Migration

**Update:** `server/controllers/arc3Controller.ts`

**Before:**
```typescript
import { ARC3_GAMES } from '../../shared/arc3Games';

export function getArc3Games(req: Request, res: Response) {
  const games = Object.entries(ARC3_GAMES).map(([_, game]) => game);
  res.json(games);
}
```

**After:**
```typescript
import { Arc3GameMetadataRepository } from '../repositories/Arc3GameMetadataRepository';

const repo = new Arc3GameMetadataRepository();

export async function getArc3Games(req: Request, res: Response) {
  try {
    const games = await repo.getAllGames();
    const enriched = await Promise.all(
      games.map(g => repo.enrichGameWithScreenshots(g))
    );
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch games' });
  }
}

export async function getArc3Game(req: Request, res: Response) {
  try {
    const { gameId } = req.params;
    const game = await repo.getGameById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    const enriched = await repo.enrichGameWithScreenshots(game);
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch game' });
  }
}
```

**Routes:** No changes
- Existing endpoints already defined in `server/routes/arc3.ts`
- Controllers now use repository instead of hardcoded data

---

### 5. Frontend Migration

**Create:** `client/src/hooks/useArc3Games.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import type { Arc3GameMetadata } from '@shared/types';

export function useArc3Games() {
  return useQuery({
    queryKey: ['arc3-games'],
    queryFn: async (): Promise<Arc3GameMetadata[]> => {
      const response = await fetch('/api/arc3/metadata/games');
      if (!response.ok) throw new Error('Failed to fetch games');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useArc3Game(gameId: string | undefined) {
  return useQuery({
    queryKey: ['arc3-game', gameId],
    queryFn: async (): Promise<Arc3GameMetadata> => {
      const response = await fetch(`/api/arc3/metadata/games/${gameId}`);
      if (!response.ok) throw new Error('Failed to fetch game');
      return response.json();
    },
    enabled: !!gameId,
    staleTime: 5 * 60 * 1000,
  });
}
```

**Update Pages:**

1. **`client/src/pages/Arc3GamesBrowser.tsx`**
   - Replace: `import { getAllGames, getGamesByCategory } from '../../../shared/arc3Games'`
   - With: `import { useArc3Games } from '@/hooks/useArc3Games'`
   - Filter client-side: `allGames.filter(g => g.category === 'preview')`
   - Add Skeleton loading state

2. **`client/src/pages/Arc3GameSpoiler.tsx`**
   - Replace: `import { getGameById } from '../../../shared/arc3Games'`
   - With: `import { useArc3Game } from '@/hooks/useArc3Games'`
   - Add Skeleton loading state

3. **`client/src/pages/ARC3Browser.tsx`**
   - Replace: `import { getAllGames } from '../../../shared/arc3Games'`
   - With: `import { useArc3Games } from '@/hooks/useArc3Games'`
   - Add loading state

---

## Implementation Checklist

### Phase 1: Database & Repository (Day 1)
- [ ] Add `arc3_game_metadata` table schema to `DatabaseSchema.ts`
- [ ] Add table creation method and call from `initialize()`
- [ ] Create `Arc3GameMetadataRepository.ts` with all CRUD methods
- [ ] Test locally: insert/update/query game metadata

### Phase 2: Seeding & Backend (Day 1-2)
- [ ] Create `seedGameMetadata.ts` service
- [ ] Integrate seeding call in `server/index.ts`
- [ ] Update `arc3Controller.ts` to use repository
- [ ] Test: verify all 6 games populate on startup
- [ ] Test: verify API endpoints still work

### Phase 3: Frontend (Day 2)
- [ ] Create `useArc3Games.ts` custom hooks
- [ ] Update `Arc3GamesBrowser.tsx` to use hooks
- [ ] Update `Arc3GameSpoiler.tsx` to use hooks
- [ ] Update `ARC3Browser.tsx` to use hooks
- [ ] Test: loading states, error handling
- [ ] Verify no breaking changes to UI

### Phase 4: Cleanup & Docs (Day 2-3)
- [ ] Move TypeScript types to `shared/types.ts` (if not already there)
- [ ] Update CHANGELOG.md with migration details
- [ ] Update developer guide if applicable
- [ ] Remove old imports from codebase
- [ ] Optionally: deprecate `shared/arc3Games.ts` in favor of DB

---

## Success Criteria

### Before Migration
```
shared/arc3Games.ts
├── 383 lines of code
├── 6 games hardcoded
├── Static TypeScript object
├── Manual code changes for new games
└── Direct imports in 6+ files
```

### After Migration
```
PostgreSQL Database
├── arc3_game_metadata table
├── 6 games seeded automatically
├── Scalable to 100+ games
├── Add games via API/admin interface
├── No code changes needed for new games

Frontend
├── Custom hooks with TanStack Query caching
├── Loading states on all pages
├── API-driven data flow

Backend
├── Repository pattern for data access
├── Existing endpoints now database-backed
├── Screenshot auto-discovery still works
```

---

## Migration Path & Backward Compatibility

### Zero-Downtime Migration
1. **Day 1:** Deploy database schema + repository + seeding
2. **Day 1-2:** Deploy backend controller updates
3. **Day 2:** Deploy frontend hook changes
4. **Day 2+:** Old TypeScript file becomes deprecated (can be removed later)

### Safety Nets
- Seeding is idempotent (can be re-run safely)
- Old `shared/arc3Games.ts` remains as seed source
- API endpoints unchanged (no client updates required)
- All data preserved in database

---

## Future Enhancements

### Not in MVP, but possible
- Admin UI for editing game metadata
- Import/export games as JSON
- Version history for metadata changes
- Community contributions via pull requests (review metadata diffs)

---

## Files Created
- `server/repositories/Arc3GameMetadataRepository.ts`
- `server/services/arc3/seedGameMetadata.ts`
- `client/src/hooks/useArc3Games.ts`

## Files Modified
- `server/repositories/database/DatabaseSchema.ts` (add table)
- `server/index.ts` (call seeding)
- `server/controllers/arc3Controller.ts` (use repository)
- `client/src/pages/Arc3GamesBrowser.tsx` (use hooks)
- `client/src/pages/Arc3GameSpoiler.tsx` (use hooks)
- `client/src/pages/ARC3Browser.tsx` (use hooks)
- `CHANGELOG.md` (document migration)

## Estimated Effort
- Database schema + repository: 3 hours
- Seeding + backend integration: 2 hours
- Frontend migration: 2 hours
- Testing & cleanup: 2 hours
- **Total: ~9 hours**

