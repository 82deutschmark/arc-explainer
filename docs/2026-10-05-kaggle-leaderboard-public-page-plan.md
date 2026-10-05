<!--
Author: Claude Opus 5.5
Date: 05-October-2026
PURPOSE: Plan and record for the public /kaggle-leaderboard page, ported from the private
         arc-3 site. Follows docs/2026-10-05-kaggle-leaderboard-port-handoff.md.
SRP/DRY check: Pass. The handoff describes the old page; this records what was built.
-->

# Public Kaggle leaderboard page

## Objective
A public copy of the arc-3 leaderboard page on ARC Explainer, so visitors need no sign-in
and never land on the research site.

## Decisions
- **Data path.** The site cannot read Kaggle itself (the CLI login expires). The Mac Mini's
  existing half-hourly job (`scripts/leaderboard_publish.sh` in arc-3, run from
  `~/.cache/arc3-leaderboard-bot`) keeps its state in `~/.cache/arc3-leaderboard-data` and runs
  `scripts/leaderboard_push_explainer.py`, which POSTs latest/history/events/backfill to
  `/api/kaggle/board` with the existing ARC3 admin token from the keychain. Non-fatal.
- **Storage.** `kaggle_board_documents`, one row per document, overwritten on each push.
- **Serving.** One gzipped GET for everything that changes (5 minute cache), one for the
  static backfill (1 day cache). In-memory gzip cache, cleared on push.
- **Standing.** Each board push records our row into `kaggle_leaderboard_snapshots`, which
  keeps the landing page's live placing current every half hour.
- **Page.** Compact title row, tiles straight under it, then the arc-3 sections. SVG charts
  ported by hand, colours from theme variables.

## TODO
- [x] Server table, repository, push and read routes
- [x] Page, sections, route, nav link
- [x] Push step in the arc-3 job
- [x] Cut-over (Boss, 05-Oct): arc-3's Leaderboard tab on every page links here and its old
      leaderboard.html forwards here; the old page code and data files are gone from arc-3.
      The job keeps its state in ~/.cache/arc3-leaderboard-data (LEADERBOARD_DATA_DIR) and
      no longer commits to arc-3. The arc-3 Sprints tile reads /api/kaggle/.../board.
