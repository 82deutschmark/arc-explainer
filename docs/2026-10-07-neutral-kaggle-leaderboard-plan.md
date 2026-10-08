<!--
Author: GPT-6 / Codex
Date: 07-October-2026
PURPOSE: Record the requested public-facing leaderboard wording and defaults while retaining the existing pinned team.
SRP/DRY check: Pass — reuse the existing leaderboard components, API data, and browser watchlist.
-->

# Public leaderboard wording

The user requested a leaderboard useful to everyone, without referring to the site owners as
"we", "us", or "our team", while keeping team `15605182` pinned. This is an authorized
presentation change; no collection or scoring changes are needed.

- [x] Lead the headline row with the leader, medal cutoffs, and competition-wide movement.
- [x] Retain the pinned team's rank, chart marker, and table highlight using neutral labels.
- [x] Default new watchlists to leaders, medal cutoffs, and the pinned team; preserve saved lists.
- [x] Add compact competitor cards for the current top three, NVARC3, David Hartmann, Jan Disselhoff, Lord Han Solo, the last dance, and the pinned team. Resolve all names from stable IDs and show only observed history.
- [x] Check the production frontend build and review the final diff for remaining ownership labels.

The API's existing `ourTeamId`/`ourRow` names remain internal compatibility details. The
landing page is outside this request. Production deploys from `main`; the repository README
names `ARC3` as the staging branch, so deployment is coordinated separately.

## Expanded scope

The user also requested baseball-card-style profiles and the equivalent ARC-2 board.
The reusable page now selects a shared competition registry, queries each competition's
API documents separately, and isolates stored watchlists. Existing ARC-3 stars retain
their storage key. Both ARC-2 entries (`17023174`, `15605185`) stay pinned; the first is
the primary rank-history line. ARC-3 retains `15605182`. Pins cannot be removed by stars.

ARC-2 gets live leaders plus its own verified familiar-team IDs, never copied ARC-3 IDs.
Both deadlines were verified by the Kaggle CLI as 2026-11-02 23:59 UTC. Scores arrive
on a 0–100 point scale. ARC-2 has no backfill: its first snapshot has unknown daily deltas,
and charts/week comparisons wait for sufficient observations. No history is invented.
The backend already partitions documents and gzip caches by competition; no schema
migration or API write change is required.

Team trails only append on rank/score changes. Cards label old endpoints as the last
recorded change, not as proof that data collection stopped. Charts draw observed points
without projecting stale trails to the current date.

## Verification

- Vite production frontend build passed.
- Two focused Vitest checks passed: competition cache/watchlist isolation with required
  pins, and honest rendering of an ARC-2 first capture without invented daily/weekly moves.
- Full TypeScript checking still reports existing errors outside this change; none remain
  in the edited leaderboard files or the new tests.
- Browser reviewed both boards against real data (live ARC-3 API and genuine ARC-2 first
  capture), confirmed competition switching, neutral labels, and both ARC-2 pins.
- Screenshots: `~/bubba-workspace/reports/leaderboard-preview/arc3-competitor-cards.jpg`
  and `arc2-competitor-cards.jpg`.
- No remote push or deployment performed.
