# 2026-01-13 Worm Arena greatest-hits pin plan

## Context
- The Worm Arena Greatest Hits card uses a pinned list (`PINNED_GAMES`) so standout matches always show up, even if the API does not return them.
- A new live replay (`11b4453f-aef9-4387-b60e-28fa934cad0f`) must be highlighted immediately so viewers can rewatch it from the /worm-arena and /worm-arena/live experiences.
- The pinned list currently contains December 2025 matches only; without a manual insert, the new match will eventually scroll out of the default API window.

## Goals
1. Add the new match to the very top of `PINNED_GAMES` with accurate metadata (models, scores, duration, highlight text).
2. Confirm the replay/card link opens `/worm-arena?matchId=<id>` correctly so the new live link is discoverable from the homepage card as well.
3. Keep the list SRP/DRY compliant (manual data only, no new fetching logic) and update documentation/change log per repo policy.

## Deliverables
- Updated `client/src/components/WormArenaGreatestHits.tsx` with the new pinned entry prepended.
- Supporting metadata pulled from existing sources (e.g., replay JSON or SnakeBench DB) so stats shown in the card are truthful.
- Updated `CHANGELOG.md` (top entry) noting the new highlight addition, plus any doc references touched.

## Task Breakdown
1. **Gather match metadata**
   - Use existing replay fetch helpers (or local JSON) to capture `startedAt`, player model slugs, rounds, score info, etc.
   - Double-check whether the replay already exists locally or requires a remote fetch.
2. **Update PINNED_GAMES**
   - Insert a new object at the start of the array with the gathered metadata and a clear `highlightReason` referencing why the match matters.
   - Ensure TypeScript typing remains satisfied (duration, sumFinalScores optional handling).
3. **Verification**
   - Run the app (or rely on Storybook-style checks) to ensure the card renders and the new match appears first.
   - Click the replay link to confirm it navigates to the expected match ID.
4. **Documentation & bookkeeping**
   - Update this plan (mark completed) after implementation.
   - Add a concise CHANGELOG entry (SemVer-compliant) describing the addition and author.

## Risks & Mitigations
- **Incomplete stats**: If the replay metadata is missing, fall back to partial fields but document the omission in the highlight text.
- **Out-of-date data**: Verify values directly from the replay JSON to avoid copy mistakes.
- **Card ordering regressions**: Keep insertion logic simple (prepend) so other pinned matches follow as before.

## Approval Checklist
- [x] User approves plan before implementation.
- [x] Update plan status to "done" once code + docs ship.
