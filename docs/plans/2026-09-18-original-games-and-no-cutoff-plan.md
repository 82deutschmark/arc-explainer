<!--
Author: Claude Opus 5
Date: 2026-09-18
PURPOSE: Plan for Boss's four fixes to the ARC-AGI-3 game pages: call out the replays of the
         original game versions, drop the 90-day cutoff everywhere, take the notes/corrections
         log off the page, and call him Boss.
SRP/DRY check: Pass -- plan only.
-->

# Original games, and no cutoff (18 Sep 2026)

## What "old" means

An old game is the **original version** of a game, the build ARC Prize later reworked to make
it harder. It is not about dates. The replays of those originals are valuable because they
are the only record of how the games used to look:

| Game | Original build (in the video) | Recorded | How much it changed |
|------|-------------------------------|----------|---------------------|
| vc33 | vc33-6ae7bf49eea5 | 5 Jan 2026 | a lot |
| ls20 | ls20-fa137e247ce6 | 4 Jan 2026 | a lot |
| ft09 | ft09-b8377d4b7815 | 5 Jan 2026 | a little |
| sp80 | sp80-0605ab9e5b2a | 4 Jan 2026 | a little |

## TODO

- [x] `GameVideo.originalGame` (build, date, intro, original-vs-today rows) and
      `GameResource.originalGame` in `shared/arc3Games/types.ts`.
- [x] `OriginalGameReplay` component: open section above the levels, not in the fold-out.
      `GameSources` skips a video that section already shows.
- [x] vc33: comparison table, each row checked against frames from the MP4 and today's renders.
- [x] ls20: 8 levels vs 7 (the one cited difference). Fix the wrong "Dec 2025" caption.
- [x] ft09, sp80: labelled only, no invented differences.
- [x] Remove `HUMAN_DATA_CUTOFF` / `isOnOrAfterCutoff`; `Top10Stats` counts every row
      (`recentWins` -> `wins`, `recentRows` and `cutoff` gone); owner summary `recentRuns` -> `runs`.
- [x] Leaderboard service: no `recent` flag, no re-sort -- ARC's own order.
- [x] Client: no greyed rows, no "(old)", no "since 18 Jun" wording.
- [x] Scorecard script: no date filter; warn (not fail) when the 50-card list is full.
      Re-pull `humanPlay.generated.json`.
- [x] Recalibration check: the 0.20 / 0.50 spread cuts still sit in gaps with every row counted.
- [x] Stop rendering `game.notes`; rename the fold-out "Replays and sources".
- [x] "site owner" / "the owner" -> Boss in page text.
- [x] Tests, changelog.
