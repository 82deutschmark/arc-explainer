# 012126-worm-arena-greatest-hits-tests

## Goal
Add regression tests that lock in the deduplication and recency ordering logic for Worm Arena Greatest Hits so future pin/API changes cannot reintroduce duplicates or stale ordering.

## Tasks
1. [ ] Extract the merge/dedup logic from `client/src/components/WormArenaGreatestHits.tsx` into a pure helper for easier testing.
2. [ ] Create Vitest coverage validating:
   - Pinned entries win metadata when API duplicates appear.
   - API-only entries still show up ordered by `startedAt` (desc).
   - Missing timestamps fall back to epoch 0 so they sort last.
3. [ ] Ensure test file lives next to the helper (e.g., `client/src/components/__tests__/wormArenaGreatestHits.test.tsx`) and follows repo metadata/comment rules.
