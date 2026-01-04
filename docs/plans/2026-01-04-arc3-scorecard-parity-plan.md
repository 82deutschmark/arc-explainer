# ARC3 Scorecard Parity Implementation Plan

**Author:** Cascade  
**Date:** 2026-01-04  
**Status:** Complete

## Objective

Achieve full parity between our ARC3 agent implementation and the ARC-AGI-3 ClaudeCode SDK's backend functionality, specifically focusing on scorecard management and game session logging.

## Background

The ARC-AGI-3 ClaudeCode SDK manages scorecards and sessions via local JSON files:
- `config.json` - stores `currentScorecardId`
- `scorecards.json` - tracks open/closed scorecards with history
- `sessions.json` - maps game GUIDs to session state

Our implementation replaces file-based storage with PostgreSQL database tables for proper persistence and querying.

## Implementation Summary

### 1. Database Schema Changes

**New `scorecards` table** (`@DatabaseSchema.ts:293-309`):
```sql
CREATE TABLE IF NOT EXISTS scorecards (
  card_id VARCHAR(255) PRIMARY KEY,
  source_url TEXT DEFAULT NULL,
  tags TEXT[] DEFAULT '{}',
  opaque JSONB DEFAULT NULL,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_active BOOLEAN DEFAULT true
)
```

**Updated `arc3_sessions` table** - added `scorecard_id` foreign key:
```sql
scorecard_id VARCHAR(255) DEFAULT NULL REFERENCES scorecards(card_id) ON DELETE SET NULL
```

**Migration** added to `applySchemaMigrations()` for existing databases.

### 2. New Scorecard Service

**File:** `server/services/arc3/scorecardService.ts`

Functions:
- `openScorecard(sourceUrl?, tags?, metadata?)` - Creates new scorecard, returns `card_id`
- `closeScorecard(cardId)` - Marks scorecard closed, aggregates statistics
- `getScorecard(cardId, gameId?)` - Gets scorecard details and per-game stats
- `getActiveScorecard()` - Returns currently active scorecard (if any)

### 3. New Scorecard Routes

**File:** `server/routes/scorecard.ts`

Endpoints:
- `POST /api/scorecard/open` - Open new scorecard
- `POST /api/scorecard/close` - Close scorecard, get final stats
- `GET /api/scorecard/:id` - Get scorecard details (optional `?game=` filter)
- `GET /api/scorecard` - Get active scorecard

### 4. Updated Session Manager

**File:** `server/services/arc3/persistence/sessionManager.ts`

- `createSession()` now accepts optional `scorecardId` parameter
- `SessionMetadata` interface includes `scorecardId?: string`
- All query functions (`getSessionById`, `getSessionByGuid`, `listSessions`) return `scorecardId`

### 5. Updated Game Runners

**Arc3RealGameRunner.ts:**
- Both `run()` and `runWithStreaming()` methods pass `scorecardId` to `createSession()`
- Scorecard is opened at start, closed at end of game

**CodexArc3Runner.ts:**
- `runWithStreaming()` passes `scorecardId` to `createSession()`

### 6. Updated Routes

**arc3.ts `/api/arc3/start-game`:**
- Gets or creates active scorecard before starting game
- Returns `card_id` in response for frontend tracking

## SDK Parity Mapping

| SDK Command | Our Implementation |
|-------------|-------------------|
| `open-scorecard.js` | `POST /api/scorecard/open` |
| `close-scorecard.js` | `POST /api/scorecard/close` |
| `get-scorecard.js` | `GET /api/scorecard/:id` |
| `start-game.js` | `POST /api/arc3/start-game` (auto-creates scorecard) |
| `action.js` | `POST /api/arc3/manual-action` |
| `reset-game.js` | `POST /api/arc3/manual-action` with `action: 'RESET'` |
| `status.js` | `GET /api/scorecard` + session queries |

## Files Modified

1. `server/repositories/database/DatabaseSchema.ts` - Added scorecards table, scorecard_id column, migrations
2. `server/services/arc3/scorecardService.ts` - **NEW** - Scorecard lifecycle management
3. `server/routes/scorecard.ts` - **NEW** - HTTP endpoints for scorecard operations
4. `server/routes.ts` - Added scorecard routes import and registration
5. `server/routes/arc3.ts` - Updated start-game to use scorecard service
6. `server/services/arc3/persistence/sessionManager.ts` - Added scorecard_id support
7. `server/services/arc3/Arc3RealGameRunner.ts` - Pass scorecard_id to createSession
8. `server/services/arc3/CodexArc3Runner.ts` - Pass scorecard_id to createSession
9. `server/services/arc3/Arc3OpenAIRunner.ts` - Fixed import path

## Testing

To verify the implementation:

1. **Open scorecard:**
   ```bash
   curl -X POST http://localhost:5000/api/scorecard/open \
     -H "Content-Type: application/json" \
     -d '{"tags": ["test"], "source_url": "https://example.com"}'
   ```

2. **Start game (uses active scorecard):**
   ```bash
   curl -X POST http://localhost:5000/api/arc3/start-game \
     -H "Content-Type: application/json" \
     -d '{"game_id": "ls20"}'
   ```

3. **Get scorecard stats:**
   ```bash
   curl http://localhost:5000/api/scorecard/{card_id}
   ```

4. **Close scorecard:**
   ```bash
   curl -X POST http://localhost:5000/api/scorecard/close \
     -H "Content-Type: application/json" \
     -d '{"card_id": "{card_id}"}'
   ```

## Notes

- The frontend UI updates are secondary to backend correctness
- All game sessions are now linked to scorecards via `scorecard_id`
- Statistics aggregation happens at scorecard close time
- Active scorecard is automatically used when starting games via web UI
