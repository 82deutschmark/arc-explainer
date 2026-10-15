# ARC Daily Digest: pipeline sanity check

Author: Claude Opus 5.5 Max
Date: 2026-10-14 (late evening, Eastern)
PURPOSE: A read-only review of how the ARC Daily Digest is produced and published: the Codex
automations, the newsroom checkouts, the helper scripts, the site's news store, the leaderboard
collector, the Discord announcer and the Claude Code backup desk. It lists what is duplicated,
what could break the paper and what is fragile, ordered by how much damage each could do, and
ends with a recommended fix order. Nothing was changed while writing it.
SRP/DRY check: Pass. This reviews existing pieces and points to their files; it proposes no new
systems. Companion to `docs/2026-10-14-claude-code-fallback-plan.md`.

## How the paper actually runs (as of tonight)

- **Writers (Codex app on the Mac Mini).** Six active jobs, about 41 runs a day: morning edition
  6 am, evening edition 6 pm, wire every two hours, research desk every hour, personal briefing
  5:30 am and 5:30 pm, X recap 2 pm. Two more one-off jobs are paused. Prompts live in
  `~/.codex/automations/<id>/automation.toml`; changes go through GPT-6.
- **Checkouts.** `arc-explainer-newsroom` (editions, research, briefing and X recap all share it),
  `arc-explainer-wire` (wire), `arc-explainer-fallback` (Claude backup). All three are locked
  worktrees of the main `arc-explainer` repository now; the old `arc-explainer-leaderboard-neutral`
  repository is gone.
- **Data.** The leaderboard collector (launchd `com.arc3.leaderboard`, every 30 minutes) downloads
  both Kaggle boards and uploads them to the site. The newsroom reads them back from the site's
  board and market-digest endpoints.
- **Publishing.** A desk commits JSON (and images) under `content/news/` and pushes to `main`.
  Railway rebuilds and redeploys the whole site on every push, about 20 times a day.
- **After publishing.** The Discord announcer (launchd, every 10 minutes) posts each edition once
  it is live; editions post their own X announcement through the signed-in Chrome.
- **Backup.** launchd `com.arcdaily.fallback` runs Claude Haiku 5.5 headless if an edition is
  missing at 6:50 (am/pm), or for the wire if Codex is signed out.

## What is healthy

- Every scheduled Codex slot ran in the last 24 hours (24 research runs, 12 wire runs, both
  editions, both briefings, the X recap).
- Editions take about 15 to 20 minutes, well before the 6:50 backup check.
- All live news content passes the site's own validation (checked with the site's loader against
  a copy of `origin/main`), and all 59 newsroom script tests pass on that copy.
- The Discord announcer log is clean.
- The backup's "don't race a running Codex job" guard is valid: the Codex app does mark a run
  `IN_PROGRESS` while it works (checked in the app bundle). The backup's command line is accepted
  by the installed Claude Code.

## Could break the paper

### 1. One bad edition file takes down the whole news API and the wire desk's data

`server/services/news/newsStore.ts` loads wire stories forgivingly (a bad file is skipped and
logged), but loads articles, dispatches, `people.json`, `competitors.json`, `social.json`,
`social-archive.json` and `discussions.json` strictly: one invalid record throws. That fails
`/api/news` and also `/api/news/markets`, because `newsMarkets.ts` calls the same loader. The
market digest is the wire desk's only data source and the front page's ticker, so a single bad
edition file blinds the wire desk too, not just readers.

Nothing stands in the way before it goes live: the Docker build only runs `npm run build`, no
tests or content checks; the Railway health check (`/api/health`) does not touch news; there is
no GitHub CI. The only gate is the Python validator the writing model runs, which is a separate
copy of the rules (see 2).

Fix: load every news file the way wire stories are loaded (skip and log the bad one), and add a
content check to the build so a bad file fails the deploy instead of the paper.

### 2. The validation rules exist twice and must be kept in step by hand

The Python helpers (`scripts/newsroom*.py`) and the site's TypeScript schemas
(`newsStore.ts`, `shared/news.ts`) each define what a valid article, dispatch, person or post
looks like. If Python accepts something TypeScript rejects, the writer publishes it and finding 1
takes the paper down.

The clearest case is the writer list, which lives in four places: `WRITERS` in `newsroom.py`,
`WRITERS` in `newsroom_wire.py`, and `NEWS_EDITION_WRITERS`, `NEWS_WIRE_WRITERS` and
`WRITER_CREDITS` in `shared/news.ts`. Only `claude-haiku-5-5` is allowed for Claude. **The
decision to run the backup on Sonnet 5.5 cannot be made by changing the model in the backup
script alone:** the backup would be refused at the command line; and if only the Python side were
updated, its edition would publish and then take the site's news API down.

Fix: one shared writer list (a small JSON file both sides read), and a test that runs the site's
loader over the live `content/news/` folder.

### 3. The backup desk is untested and now contradicts the reporter rules

- It has never actually run: every check so far found Codex had delivered.
- The 14 October correction requires an illustration on every front page. `FALLBACK.md` tells the
  backup to skip browser work, and new art depends on the Codex app's own image tool, which Claude
  Code does not have. The backup is told to follow both documents exactly. It can still reuse an
  existing approved scene through `scripts/newsroom_artwork.py` (no browser needed), but nothing
  tells it so, or what to do when no scene fits.
- `newsroom_fallback.sh` stops if its folder has uncommitted changes. One half-finished backup run
  therefore disables the backup until someone cleans the folder by hand, and the only warning is a
  Mac notification nobody sees overnight.
- It writes its evidence to the same `/tmp/arc-daily-<edition>-brief.json` path Codex uses. Harmless
  while the running-job guard works, but a separate path costs nothing.

### 4. The data feed can go stale with no alarm

The collector logs upload failures and moves on (`leaderboard_push_explainer.py || true`). The
newsroom refuses to write from data more than 90 minutes old, so about three missed half-hour
uploads in a row would block the editions and the wire, and the first sign would be a failed
edition. In ten days it has had three upload failures (the site was mid-redeploy) and two Kaggle
download failures, never enough in a row to matter. Two further weak spots:

- It lives in `~/.cache/arc3-leaderboard-bot`, and its saved board history in
  `~/.cache/arc3-leaderboard-data`. A cache clean-up would remove the paper's data source.
- Every run pulls the shared `arc-3` repository's `main` branch first, so any push there changes
  the live collector within half an hour, untested.

Fix: a Discord alert when the newest uploaded board is over an hour old, and move the collector and
its data out of the cache folder.

## Duplicated or wasteful

### 5. The job instructions have become a pile of dated orders

- The morning prompt is about 35,000 characters, the evening about 28,000 and the research desk
  about 21,000. Twenty-seven of the evening's paragraphs are word-for-word copies of the morning's.
- Most of each prompt is a stack of one-day orders ("For the October 12 morning issue...",
  "October 14 Early edition tweet...") with "superseding" chains, and several contradict each
  other. For example, the morning prompt still says the GPU bridge picture must lead the 14 October
  Early tweet, and a later paragraph says it was already used at midnight. The evening prompt still
  carries an undated "tonight" PunkCyber shout-out and an October 12 bunnies commission.
- The same amendments are repeated a third time in the docs: the first ~330 lines of
  `docs/newsroom/REPORTER.md` are dated amendments before the actual workflow starts, and
  `ART_DESK.md` repeats the art ones.
- Every run has to work out which of dozens of dated orders still apply. This is the most likely
  source of a wrong call on a busy night.

Fix: ask GPT-6 to rewrite each prompt as a short current contract (checkout, steps, permissions,
pointers to the docs), move day-specific orders into `content/news/editorial-assignments.json`,
and fold the dated amendments in `REPORTER.md` and `ART_DESK.md` into the workflow they amend.

### 6. The research desk re-reads the same week of posts every hour

Found by Codex's own audit tonight
(`/Users/macmini/bubba-workspace/reports/arc-daily-social/audits/2026-10-14-automation-duplication-audit.json`)
and confirmed in the code: `collection_plan` in `scripts/newsroom_social.py` only moves an account's
"checked up to here" marker when a scan is complete, and X never shows when something was reposted,
so scans are always "partial" and the marker never moves. The plan keeps asking for the same seven
days. Two runs today were stopped for excessive browsing. The finer per-feed markers the desk keeps
in `founder-coverage.json` are not read by the planner. Separately, the 2 pm X recap does its own
broad search that overlaps the research desk.

Fix: plan from the per-feed markers, and let the X recap read the research archive instead of
searching again.

### 7. Editor assignments can never be closed

`newsroom.py` refuses to close an assignment except by covering it, and nothing ever changes an
assignment's `status`, so anything held or carried stays in every edition's intake forever. The
13 October morning bunnies art commission has now been "held" in four editions in a row, the
13 October former-leaders feature has been carried or held in four, and the GPU bridge assignment
is still open after the picture was used. Each edition has to re-justify all of them.

Fix: let an assignment expire after its target edition (or allow an "expired" decision), and mark
the old ones done.

### 8. Five desks share one folder and one browser

Editions, the hourly research desk, the personal briefing and the X recap all work in
`arc-explainer-newsroom` and each starts with a `git pull`. Today the 5 am research shift ran
through the 5:30 briefing, and the 2 pm research run overlapped the X recap, which also drives the
same signed-in Chrome at the same time. Nothing has visibly broken yet, but two jobs pulling in one
folder, or two jobs steering one browser, is a race waiting to happen.

Fix: the read-only desks (research, briefing, X recap) get their own checkout or skip the pull, and
the research desk skips its 2 pm and 6 am/6 pm focused scans while those jobs run.

### 9. Every story rebuilds the whole site

A wire story is a few kilobytes, but each push rebuilds the full Docker image (Python packages,
`npm ci`, third-party clones, the client build) about 20 times a day. The collector's three
failed uploads were all during a redeploy, and an edition's X post waits up to 20 minutes for the
site to come back, then gives up silently. Not urgent at this size; worth knowing before adding
more desks.

## Clutter (safe to tidy)

- `arc-explainer-digest-afternoon`: a leftover worktree, fully merged, clean, unlocked, used by no job.
- Two paused one-off Codex jobs: the midnight bridge desk and the October 13 morning preflight.
- Six files in `content/news/evidence/` with no matching article (dispatch and artwork-revision
  records). Harmless, but the assignment check reads every file in that folder on every run.
- `FALLBACK.md` still describes its folder as a worktree of "the newsroom's own repository"; all
  three now hang off the main repository.
- Every automation commit is signed with the Boss's git identity, so the history cannot tell which
  desk or model wrote what.

## Recommended fix order

1. Make the site skip a bad news file instead of failing, and add a content check to the build
   (finding 1). Small, and removes the biggest blast radius.
2. One shared writer list, add Sonnet 5.5, switch the backup to it, teach `FALLBACK.md` the picture
   rule, alert by Discord, and recover from a half-finished run (findings 2 and 3). Then rehearse it.
3. Collector staleness alert and move it out of the cache folder (finding 4).
4. Ask GPT-6 to rewrite the prompts and fold the dated amendments into the docs; delete the two
   paused jobs (finding 5).
5. Research planner markers and assignment expiry (findings 6 and 7), coordinated with GPT-6 since
   its desks run those scripts.
6. Separate folder for the read-only desks; remove the leftover worktree (finding 8 and clutter).

Do not change anything while a desk is running: the wire fires on even hours and editions at 6.

## What was done, 15 October 2026 (overnight, Claude Opus 5.5 Max)

The Boss approved the fix order above and allowed changes to the Codex notes and instructions,
with Codex staying the engine. Work was done between desk runs; each step was pushed to `main`.

1. **Done.** The site leaves out a bad news file or ledger record and keeps the rest of the paper,
   including the market digest; `GET /api/news/health` lists what is left out; a content check
   test runs the site's loader over the live archive (CHANGELOG 9.142.0). Deliberately not a
   build-time gate: a failed build would freeze every later publish until someone fixed the file.
2. **Done.** One writer list in `shared/newsWriters.json`; the backup desk runs Claude Sonnet 5.5,
   covers a single missing contest, backs up a stopped (not only signed-out) wire, saves and clears
   a half-finished run, keeps its files out of Codex's `/tmp` paths, updates itself before each
   check, reports to Discord and has a `--rehearse` mode (9.143.0). The rehearsal passed: Sonnet
   prepared, wrote, illustrated and validated both contests in about two minutes and left the
   folder clean. It also exposed the art planner re-offering a picture that had already run on X;
   the planner now skips any approved scene already used in that contest or on X (9.145.1).
3. **Done.** The desk relay (`~/bubba-workspace/tools/arc_daily_announce.py`) raises Discord alarms
   for left-out news files, a leaderboard older than 75 minutes and a silent site, once on start
   and once on clear. The collector moved to `~/GitHub/arc-daily-collector`, a scripts-only clone
   (about 5 MB instead of 670 MB) with its board history inside; its first run there uploaded both
   boards; the old cache copies are in the Trash.
4. **Done, review pending.** New `docs/newsroom/README.md` map; `REPORTER.md`, `ART_DESK.md` and
   `SOCIAL_DESK.md` rewritten with the dated sections folded in; one short instruction per job in
   `docs/newsroom/automation-prompts/` (about 2,000 characters each, down from up to 35,000), applied
   to all six jobs (9.145.0). The afternoon X recap moved to 2:20 pm. Each job's `memory.md` is now
   a short note, with the old notes archived beside it. GPT-6 could not be reached overnight (the
   app starts a queued message only when that conversation is opened), so the prompts were applied
   in `automation.toml` and the `automations` table together, as `automation_update` does, with
   backups in `~/bubba-workspace/reports/arc-daily-social/audits/2026-10-15-automation-backup/`.
   A review request is waiting in the configuration conversation, including deleting the two
   paused one-off jobs, which are still there (paused, harmless).
5. **Done.** The research plan resumes each feed from its own last complete read; editorial
   assignments expire, and the existing ones have expiries (9.144.0).
6. **Done differently.** The leftover worktree is removed. Rather than add another checkout, the
   read-only desks no longer pull over an edition's uncommitted work, and the recap no longer shares
   the 2 pm minute with the hourly scan.

Left as they are: the six evidence files without articles (harmless), automation commits signed
with the Boss's identity, and the full-site rebuild on every push (finding 9; not urgent at this
size).
