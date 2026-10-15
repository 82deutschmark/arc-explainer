# The morning check-in

Author: Claude Opus 5.5 Low · 15 October 2026 · at the Boss's request: the editions land while he
sleeps, so a Discord alarm alone helps no one. Claude has to look, fix what it safely can, and
report. The Boss is around in the evenings, so one morning run is enough.

**Who and when.** Claude Sonnet 5.5, as the scheduled task "ARC Daily check-in" in the Claude
desktop app on the Mac Mini, every day at about 7:05 to 7:20 am America/New_York. That is after the
morning edition goes up (usually around 6:30) and after the backup desk's own check (6:50), so the
check-in sees what both did. It covers the morning edition plus everything since the previous
morning (last night's edition, the wire, research and the plumbing). A run at another hour checks
the latest edition that should already be out; never treat an edition whose time has not come as
missing.

**Where you work.** Read from anywhere listed in [README.md](README.md). Do any git work in the
backup desk's checkout, `~/GitHub/arc-explainer-fallback` (fetch first, and only if no backup run is
active and `git status` is clean). Never touch the Boss's own checkout `~/GitHub/arc-explainer`,
the newsroom or wire checkouts, the Codex job settings or database (read only), or X.

## What to check

1. **Editions.** `git fetch origin` in the fallback checkout, then look for this half-day's files on
   `origin/main`: `content/news/articles/<date>-morning-arc-3.json` and `-arc-2.json` (or
   `-evening-`). Confirm `https://arc.markbarney.net/news/<id>` answers. Read both editions quickly:
   right date, real headline, standings that match the board, no copy of the last edition.
2. **Backup desk.** The day's log in `~/Library/Logs/arc-daily-fallback/` (`<date>-morning.log`,
   `-evening.log`, `-wire.log`): did it step in, and did it finish?
3. **Codex runs.** `sqlite3 -readonly ~/.codex/sqlite/codex-dev.db`, table `automation_runs`
   (`created_at` is milliseconds): for each active job in table `automations`, count the runs in
   the window against its schedule, and read `inbox_summary` for anything blocked, failed, skipped
   or refused. A run stuck `IN_PROGRESS` for more than two hours is a problem. The two paused
   one-off jobs are expected to stay paused.
4. **Wire.** The newest file in `content/news/wire/` on `origin/main`: there should be one for
   most two-hour shifts (a quiet shift may file nothing; the run summary says so).
5. **Site and boards.** `https://arc.markbarney.net/api/news/health` (status ok, nothing skipped)
   and `/api/news/markets` (each board's `fetched` under 75 minutes old).
6. **Plumbing.** The relay's state file `~/bubba-workspace/state/arc-daily-announced.json` should be
   under 20 minutes old with no open `alarms`; the collector log
   `~/GitHub/arc-daily-collector/job.log` should end with two "push ok" lines from the last hour.

## What you may fix

Only these, and say in the report that you did:

- **An edition is missing and the backup desk did not publish it:** if no Codex edition run is in
  progress, run `scripts/newsroom_fallback.sh morning` (or `evening`) from the fallback checkout.
  It checks again itself, so it never writes a second copy. Then read its log for the outcome.
- **The collector or the relay has stopped:** `launchctl kickstart gui/$(id -u)/com.arc3.leaderboard`
  (or `ai.bubba.arc-daily-announce`), wait a minute, and look again.

Anything else (a news file the site is leaving out, a wrong story, a Codex job failing every run, a sign-in problem, an X post) is not
yours to fix: describe it plainly in the report so the Boss or Claude can act on it.

## Report

- Write the report to `~/bubba-workspace/reports/arc-daily-checkins/<date>.md`, one file
  per day, nothing else in that folder.
  List each check as fine or not, with the evidence in a line, then what you fixed and what is left.
- Post one short plain message to the Digest's Discord channel through the relay:
  `/opt/homebrew/bin/python3.13 ~/bubba-workspace/tools/arc_daily_announce.py --alert "check-in: ..."`.
  If everything is fine, say so in one sentence. If not, say what is wrong and what you did.
- End the session with the same summary as your last message, so it shows in the Claude app.

Write plainly for the Boss: no code, no hashes, no stat dumps; call him Boss. Credit yourself as
"Claude Sonnet 5.5" in anything you write.
