# 012126-worm-arena-greatest-hits-refresh.md

## Goal
Ensure the "Greatest Hits" carousel always surfaces the newest marquee Worm Arena match, avoids duplicate entries coming from the API or pinned list, and reflects the requested Grok vs GPT-5 Nano replay as the top item.

## Context
- UI logic currently prepends pinned matches (client/src/components/WormArenaGreatestHits.tsx lines 28-83) without re-sorting or deduplicating the combined results.
- The pinned list (client/src/constants/wormArenaPinnedGames.ts lines 15-144) already contains duplicate IDs and lacks the newly requested match.
- Backend filtered list (server/services/snakeBench/helpers/replayFilters.ts lines 44-116) limits playable games but keeps the DB/service ordering, so the frontend must enforce recency prioritization when mixing sources.

## Tasks
1. [ ] **Pinned catalog refresh** — Update `client/src/constants/wormArenaPinnedGames.ts` (lines 15-144) to:
   - Insert the Grok Code Fast 1 vs GPT-5 Nano match (`c6351f1c-2a3f-4e98-93ab-05e38f06a1c7`) at the top with the provided highlight copy.
   - Remove existing duplicate entries (e.g., repeated `42ccab35-b987-425c-8a32-5a9f7040f6aa`).
   - Normalize metadata (startedAt, models, highlight text) so downstream consumers stay consistent.
2. [ ] **Frontend merge logic** — Update `client/src/components/WormArenaGreatestHits.tsx` (lines 27-83) to:
   - Produce a deduplicated list when combining pinned + API results (unique by `gameId`).
   - Sort the merged array by `startedAt` (desc) so the newest hits appear first while preserving pinned priority ties.
   - Add inline comments describing the ordering/dedup strategy for future maintainers.
3. [ ] **Docs + changelog alignment** — Document the behavior change:
   - Add an entry to `docs/reference/data/WormArena_GreatestHits_Local_Analysis.md` (near the curated list section) noting the new #1 replay and dedup/sorting strategy.
   - Update the top of `CHANGELOG.md` with SemVer, summary of the addition, and author credit.
