# 2026-01-19 - Worm Arena Greatest Hits Local Fallback Fix Plan

Author: GPT-5 Codex
Date: 2026-01-19
Scope: Worm Arena greatest hits API and local replay fallback behavior.
Goal: Ensure recent local matches appear in Greatest Hits even when the DB is empty or unavailable.

## Objectives
- Use DB-ranked greatest hits when available.
- Fall back to locally available replay JSONs for ranking when DB has no results.
- Keep the replay availability filter so only playable games are returned.
- Align backfill tooling with the configured completed-games directory.
- Document the behavior and update the changelog.

## TODOs
1. Add a local greatest-hits builder that scans the resolved completed-games directory, parses replay JSONs, and computes the same metrics used by the DB query.
2. Wire the local builder into the greatest-hits service: use DB results when present; otherwise return the local ranking (still filtered to replay availability).
3. Update `server/scripts/snakebench-backfill.ts` to backfill from `getCompletedGamesAbsolutePath(...)` instead of the hard-coded `completed_games` directory.
4. Update docs to reflect the new fallback behavior:
   - `docs/reference/api/SnakeBench_WormArena_API.md`
   - `docs/reference/data/WormArena_GreatestHits_Local_Analysis.md`
5. Add a top-of-file entry to `CHANGELOG.md` with SemVer, what/why/how, and author.

## Testing
- Manual: call `GET /api/snakebench/greatest-hits` with and without DB connectivity and confirm local games show up.
- Optional: add a unit test for the local builder if time allows.

## Notes
- Keep all new text ASCII-only.
- Avoid changing existing replay formats or storage locations.
