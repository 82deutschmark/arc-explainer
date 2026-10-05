<!--
Author: Claude Opus 5.5
Date: 05-October-2026
PURPOSE: Handoff for moving the Kaggle leaderboard page off the private arc-3 site
         (arc3.sonpham.net/leaderboard.html, behind Google sign-in) and onto ARC Explainer
         as a public page. Lists every source file, the data pipeline and its schedule,
         the data shapes, what Mark wants changed on the way over, and the cut-over steps.
SRP/DRY check: Pass. docs/2026-09-02-kaggle-leaderboard-monitoring.md is the general
         "how to track a Kaggle board" how-to; this doc is only the port of one existing
         page. Client/src/pages/Leaderboards.tsx is the unrelated model leaderboard.
-->

# Port the Kaggle leaderboard page to ARC Explainer

Boss's call (05-Oct-2026): the leaderboard belongs on ARC Explainer, where it can be public.
On arc-3 it sits behind Google sign-in, so only the allow-listed emails can see it.

## What the page does today

One page that shows the public ARC-AGI-3 Kaggle board (competition
`arc-prize-2026-arc-agi-3`) with our team (Son Pham & Mark Barney, team id `15605182`)
always highlighted:

- headline tiles: our rank/score, the gold/silver/bronze cut lines, days to the close (2-Nov-2026)
- "Score by rank" chart: every team as a dot, medal zones shaded
- "Today so far": movers since the end of the previous UTC day
- "Teams we are watching": score trails for starred teams (stars kept in localStorage)
- "Recent moves": feed of score changes between snapshots
- weekly pace / trend chart, and the full searchable table (paged 100 at a time)

All charts are hand-built SVG in plain JavaScript. No chart library.

## Source files (all in the arc-3 repo, sonpham-org/arc-3)

| file | what |
|---|---|
| `docs/leaderboard.html` | page shell (107 lines) |
| `docs/static/js/leaderboard.js` | everything: load, merge, tiles, charts, feed, table (344 lines) |
| `docs/static/css/leaderboard.css` | page styles, colour tokens on `.lb` (66 lines) |
| `docs/static/css/theme.css`, `rl-shell.css` | shared arc-3 site shell; do NOT port, use Explainer's own layout |
| `scripts/leaderboard_snapshot.py` | pulls the board with the `kaggle` CLI, writes the four data files |
| `scripts/leaderboard_backfill.py` | one-off: rebuilt history back to March from a third-party poller (tonghuikang's Modal endpoint) into `backfill.json` |
| `scripts/leaderboard_publish.sh` | runs the snapshot, raises macOS alerts, commits and pushes the data to arc-3 main |
| `~/Library/LaunchAgents/com.arc3.leaderboard.plist` (Mac Mini) | runs the publish script every 30 minutes from its own clone at `~/.cache/arc3-leaderboard-bot` |

## Data files (`docs/static/data/leaderboard/`)

- `latest.json` (~320 KB): `{fetched, teams, medalRanks:{gold,silver,bronze}, ourTeamId, rows:[[rank, teamId, name, lastSubmission, score, submissionCount, members, rankAtStartOfDay, scoreAtStartOfDay], ...]}`
- `history.json` (~25 KB): `{snaps:[{t, teams, top, gold, silver, bronze}], trails:{teamId:{name, pts:[[t, score, rank], ...]}}}`; trails kept for the top 300 plus us
- `events.json`: `[{t, id, name, from, to, rankFrom, rankTo}]`, score changes between snapshots
- `base.json`: `{date, ranks:{teamId: [rank, score]}}`, end-of-previous-day standings for the "today" columns
- `backfill.json` (~900 KB): same shape as history plus events, for days before our own snapshots began; the page merges it in front of `history.json`

Medal cut-offs follow Kaggle's rule: gold = top 10 + 0.2% of teams, silver = top 5%, bronze = top 10%.

## What to change on the way over

1. **Header.** Mark dislikes the current top: a big padded hero band with an eyebrow line,
   a large two-part headline and a paragraph of lede before any data. Replace it with one
   compact title row (title + "saved N minutes ago · N teams") and put the tiles directly
   under it. The data should be visible without scrolling.
2. **Build it the Explainer way.** A React page under `client/src/pages/` with its own route,
   using existing shadcn/ui pieces for the table, tiles and cards. Port the SVG chart code
   rather than adding a chart library. Do not name it `Leaderboards` (taken by the model
   leaderboard); something like `KaggleLeaderboard` at `/kaggle-leaderboard`.
3. **Public on purpose.** Everything shown is already public on Kaggle, and Mark is fine with
   it being public. Keep our team highlighted.
4. **Where the data lives.** Today the job commits roughly a third of a megabyte to git every
   half hour, which bloats the repo. Recommended: have the Explainer server run the snapshot
   on a timer (or accept a push from the Mac Mini job) and keep the files outside git, served
   from one API route. The quick route (point the existing job at an Explainer clone and keep
   committing) works but carries the same bloat; only take it as a stopgap.
5. **Load fast.** `latest.json` plus `backfill.json` is well over a megabyte. Serve them
   compressed and cacheable for a few minutes; the snapshot only changes every 30 minutes, so
   `no-store` (what arc-3 uses) is wasted. Consider folding the backfill into history once so
   the page fetches one file.

## Cut-over

1. Build and ship the Explainer page reading live data.
2. Repoint or replace the Mac Mini LaunchAgent (`com.arc3.leaderboard.plist`) so the
   snapshot lands where Explainer reads it. Keep the ALERT notifications.
3. On arc-3, replace the Leaderboard tab in every page's top nav with a link to the
   Explainer page, then stop the arc-3 job so it no longer commits snapshots there.
   The old files can stay in arc-3 history.
