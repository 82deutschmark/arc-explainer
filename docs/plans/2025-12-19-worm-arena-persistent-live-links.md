# Plan: Implement Persistent Worm Arena Live-Link Resolution

**Author:** Cascade
**Date:** 2025-12-19
**PURPOSE:** Enable durable `/worm-arena/live/:sessionId` links that can redirect to exact replays even after server restarts. Currently, live session mappings are in-memory, so old live links can’t resolve to replays if the server restarted.

## Problem
- Live links like `/worm-arena/live/abc-123` are shareable, but if the server restarts, the `sessionId -> gameId` mapping is lost.
- `resolve()` returns `status: "unknown"` and Live page redirects to replay hub (`/worm-arena`) instead of the specific replay.
- User wants: old live links should reliably redirect to the exact replay (`/worm-arena?matchId=...`) even after server restart.

## Solution
Add a Postgres table to persist `sessionId -> gameId` mappings for completed matches.

## Files to create/modify
- **NEW** `server/repositories/WormArenaSessionRepository.ts` - Repository for DB ops.
- **MOD** `server/repositories/database/DatabaseSchema.ts` - Add runtime table creation.
- **MOD** `shared/schema.ts` - Add Drizzle schema definition.
- **NEW** `migrations/0005_worm-arena-sessions.sql` - Drizzle migration.
- **MOD** `server/repositories/RepositoryService.ts` - Expose new repository.
- **MOD** `server/controllers/wormArenaStreamController.ts` - Wire in DB ops for prepare/stream/resolve.
- **MOD** `CHANGELOG.md` - Add new entry.

## Implementation Steps
1. Add DB table + migration (runtime + Drizzle).
2. Create repository with basic CRUD.
3. Wire repository into controller (prepare/create, stream/complete, resolve/lookup).
4. Test end-to-end: create live session, complete it, restart server, visit old live URL, verify redirects to exact replay.

## Security
- No BYO `apiKey` stored (ever).
- `sessionId` is a random UUID, not sensitive.

## Fallbacks
- If DB down: fall back to in-memory (same as current behavior).
- If session expired before completion: no redirect possible (expected).

## SRP/DRY Check
- Repository: single responsibility for session persistence.
- Controller: delegates to repository, keeps in-memory for active sessions.
