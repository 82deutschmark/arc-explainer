# 2026-01-15 WormArena Greatest Hit Addition Plan

## Goal
Add the specific Worm Arena match `d8cd9202-5121-448a-a5bb-194ce5095e5e` (openai/gpt-oss-120b vs deepseek/deepseek-v3.2) to the pinned Greatest Hits list so it appears in the frontend card.

## Scope
- Frontend only: update the pinned games array in `client/src/components/WormArenaGreatestHits.tsx`.
- No backend/API changes.

## Plan
1) Verify match metadata from local replay JSON: started_at, rounds_played, board size, scores, cost, highlight reason.
2) Add a new pinned entry with normalized gameId and highlight text into `PINNED_GAMES` while preserving existing structure.
3) Sanity check for style/ordering consistency and ensure no duplicate IDs.

## Out of Scope
- Backend greatest hits logic or hall of fame service.
- Live streaming or replay generation changes.
- Any leaderboard or suggestion logic.

## Completion Criteria
- `PINNED_GAMES` includes the provided match with accurate metadata and highlight reason.
- Builds/tests unaffected (no functional regressions expected).
