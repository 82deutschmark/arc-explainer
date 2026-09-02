<!--
Author: Claude Opus 5
Date: 02-September-2026
PURPOSE: Portable how-to for tracking a public Kaggle competition leaderboard over time —
         prerequisites, the two operating modes (periodic full-board snapshot + diff, and
         a daily chat digest), exact CLI invocations, state-file schemas, scheduling on
         both macOS (LaunchAgent) and Linux (cron), failure modes, and storage growth.
         Written so a developer on any machine can reproduce leaderboard tracking for any
         Kaggle competition from scratch. Also records why the kaggle-CLI path is used for
         scheduled jobs instead of the headless-Chrome scraper in
         scripts/_pull_leaderboard.py.
SRP/DRY check: Pass. The existing doc at
         ~/bubba-workspace/docs/2026-08-27-kaggle-leaderboard-monitor.md is a
         machine-specific operator runbook for one LaunchAgent on one Mac Mini; this is
         the portable, reproduce-anywhere version and is the only such doc in either repo.
         Both reference implementations live OUTSIDE both repos (see "Reference
         implementation" below) — nothing here duplicates checked-in code.
-->

# Tracking a Kaggle leaderboard over time

Every number in this doc was read off a live system on 02-Sep-2026. Nothing is illustrative.

## The problem

A Kaggle leaderboard page tells you the board *right now*. It does not tell you:

- whether you went up or down since yesterday, or by how much
- who is new in the top 25 and what rank they climbed from
- whether the leader's score jumped because someone found something, or drifted
- how fast the field is growing
- whether your last look actually succeeded, or your auth quietly expired

Screenshots do not answer those. Two small jobs do: one that **archives the full board on a
schedule and diffs consecutive snapshots**, and one that **posts a short daily digest to a
chat channel**. They are separate jobs with separate state and they answer different
questions. Run one, the other, or both.

## Prerequisites

**Kaggle CLI.** Verified against **Kaggle CLI 2.2.2** (`kaggle --version`). Older 1.x
releases used a `~/.kaggle/kaggle.json` username+key file; 2.x uses an OAuth-style token
obtained through a browser login. If you are on 1.x, the invocations below still work but
the auth section does not.

```bash
pip install --user kaggle      # or: pipx install kaggle
kaggle --version               # confirm 2.2.2 or later before trusting this doc
```

**Auth.** Log in once, interactively:

```bash
kaggle auth login                        # opens a browser
kaggle auth login --no-launch-browser    # headless box: prints a URL to paste elsewhere
kaggle auth login --force                # re-run the flow when the token has expired
```

That writes a token into `~/.kaggle/`. Never print it, commit it, or paste it into a chat
channel; never hand-edit it either — if it is broken, re-run `kaggle auth login --force`.
`kaggle auth print-access-token` and `kaggle auth revoke` exist; the first one emits a
secret, so treat it accordingly.

For CI or a container where an interactive login is impossible, the SDK reads the
environment variable **`KAGGLE_API_TOKEN`**, and that value **takes precedence over the
token file on disk**. Useful for injecting a token; also a trap, because a stale
`KAGGLE_API_TOKEN` in a shell profile will silently override a perfectly good token file.

**Sanity check before you automate anything:**

```bash
kaggle competitions leaderboard <competition-slug> -d -p /tmp/lbcheck
ls /tmp/lbcheck        # expect a .zip containing one .csv
```

The slug is the last path segment of the competition URL. One request returns the *entire*
public board — there is no pagination to handle. The CSV columns are `Rank`, `TeamId`,
`TeamName`, `LastSubmissionDate`, `Score`, `SubmissionCount`, `TeamMemberUserNames`, and
Kaggle prepends a UTF-8 BOM to the header row, so parse with `encoding="utf-8-sig"` or your
first column name comes back as `﻿Rank`.

Two things about the rows, both of which will corrupt your numbers if you miss them:

- Host benchmark and baseline entries are given **`Rank` 0**. They are not competitors.
  ARC-AGI-3 ships three of them (Stochastic Goose, Random Agent, Just Explore). Drop
  `Rank < 1` before you compute the leader, the top-N table, or the field size.
- Identity is **`TeamId`, not `TeamName`.** Teams rename themselves. Match on the name and
  a rename reads as one team vanishing and a different team appearing out of nowhere.

## Mode A — periodic snapshot archive + differ

Fetch the full board on an interval, gzip it under a UTC-stamped filename, and diff the
newest snapshot against the previous one. Output is a plain-text report on stdout plus a
machine-readable state file. It does **not** post anywhere.

What the differ reports: rank changes inside the top N, new entrants into the top N with
the rank they climbed from, teams that fell out of the top N and where they landed, score
changes at or above a threshold, and the field-size delta.

```bash
# fetch + archive + diff + report
python3 kaggle_leaderboard.py --competition <slug>

# wider band than the default top 25
python3 kaggle_leaderboard.py --competition <slug> --top 50

# report a score move only if it is at least 5.0 (default 1.0)
python3 kaggle_leaderboard.py --competition <slug> --score-jump 5.0

# do not touch Kaggle at all; diff the two most recent stored snapshots
python3 kaggle_leaderboard.py --competition <slug> --no-fetch

# relocate the archive and the state file
python3 kaggle_leaderboard.py --competition <slug> \
  --snap-dir /var/lib/kaggle-lb/snapshots \
  --state-path /var/lib/kaggle-lb/state.json
```

`--no-fetch` is the mode to use while you are changing the differ: it re-reads history and
makes zero network calls. It exits 1 if fewer than two snapshots exist rather than printing
an empty diff.

Snapshot filenames are `<slug>-<YYYYMMDD>T<HHMMSS>Z.csv.gz`, UTC-stamped so that a plain
lexical sort is a chronological sort. Do not order snapshots by mtime — a copy or a restore
rewrites mtime and silently reverses your history.

### Mode A state file

Written atomically (temp file + `os.replace`), so a reader never sees a half-written file.
Real excerpt, trimmed to two of twenty-five `top` entries:

```json
{
  "status": "ok",
  "competition": "kaggriculture",
  "captured_at": "2026-09-02T16:00:22.751252+00:00",
  "snapshot": ".../kaggle_top/kaggriculture-20260902T160022Z.csv.gz",
  "compared_to": ".../kaggle_top/kaggriculture-20260902T100020Z.csv.gz",
  "top_n": 25,
  "score_jump_threshold": 1.0,
  "team_count": 7343,
  "team_count_delta": 56,
  "top": [
    {"rank": 1, "team_id": "16774712", "team": "icelemon2004",
     "score": 2950.4, "rank_delta": 414, "score_delta": 727.3, "is_new": true},
    {"rank": 2, "team_id": "16698308", "team": "Yuan800",
     "score": 2947.2, "rank_delta": 308, "score_delta": 628.6, "is_new": true}
  ],
  "movers": [{"rank": 15, "team": "Haiku 4.5 is Goated", "rank_delta": 3429}],
  "score_jumps": [{"rank": 15, "team": "Haiku 4.5 is Goated",
                   "score": 2824.0, "score_delta": 2001.3}],
  "new_entrants": [],
  "dropped_out": [],
  "error": null,
  "error_at": null,
  "note": "Kaggle 'score' here is the competition's public leaderboard score..."
}
```

Read `status` first. `"ok"` means fetched and diffed. `"baseline"` means this was the first
snapshot and there was nothing to compare against. `"error"` means **the run failed** —
`error` and `error_at` say how and when.

`rank_delta` is **positive for moving up** the board, toward rank 1. It is the one field
people get backwards.

The example above is a real 6-hour window on a competition in its final month: the leader
changed, the #15 team climbed 3,429 places, and 56 teams joined. That is the kind of thing
a daily screenshot loses entirely.

## Mode B — daily digest for a chat channel

One fetch, one short formatted message on stdout, one overwritten state file. Point a
scheduler at it and pipe stdout into your channel. It reports the top 10 with per-team rank
movement since the last run, a tracked team's rank and score with its movement, the gap to
the leader, the field size and its change, days to the deadline, and which Kaggle medal zone
the tracked rank sits in.

The tracked team is found by **Kaggle member username**, not team name, for the rename
reason above.

```bash
# defaults
python3 kaggriculture_leaderboard.py

# a different competition, verbatim from the live ARC-AGI-3 cron job
python3 kaggriculture_leaderboard.py \
  --competition arc-prize-2026-arc-agi-3 \
  --title 'ARC-AGI-3 leaderboard' \
  --deadline '2026-11-02 23:59' \
  --tracked-username sonphamorg \
  --score-digits 2
```

Flags: `--competition` (slug), `--title` (headline), `--deadline` (`YYYY-MM-DD HH:MM`,
**UTC**, used only for the days-remaining count), `--tracked-username`, `--score-digits`
(ARC-AGI-3 scores need 2 decimals, a points-based agriculture comp needs 1), and
`--state-name` (state filename stem; defaults to the competition slug, which is why the
ARC-AGI-3 job above does not pass it).

Medal zones are computed from Kaggle's published rank cutoffs for the current field size.
They are indicative of where you are standing. **Medals are awarded on the private
leaderboard at close**, so a public-board medal zone is not a medal.

### Mode B state file

```json
{
  "captured_at": "2026-09-02T10:00:00.691059+00:00",
  "team_count": 2708,
  "top": [
    {"rank": 1, "team": "cstl", "score": 7.51},
    {"rank": 2, "team": "Lord Han Solo", "score": 4.99},
    {"rank": 3, "team": "Tufa Labs", "score": 4.71}
  ],
  "tracked": {"rank": 4, "team": "Son Pham & Mark Barney",
              "score": 4.52, "submissions": "35"}
}
```

Flat and small on purpose — it exists only to compute "since last look". `tracked` is
`null` when the username is not found, and the digest says so loudly instead of omitting
the line.

Note the two modes disagree on team count for `kaggriculture` on 02-Sep-2026: 7,343 at
16:00 UTC (Mode A) and 7,287 at 10:00 UTC (Mode B). Not a bug — different fetch times, six
hours apart, on a board taking on roughly 56 teams per 6-hour window. Always print the
timestamp next to the count.

## Scheduling

Both jobs are one-shot and idempotent: each tick writes one snapshot and one state file, so
a missed tick just means a wider diff window on the next one. Do **not** make either a
daemon and do not use `KeepAlive` — that hammers the Kaggle API for no benefit.

### Linux / plain cron

```cron
# Mode A — full-board snapshot + diff every 6 hours
0 */6 * * * /srv/kaggle-lb/.venv/bin/python /srv/kaggle-lb/kaggle_leaderboard.py --competition <slug> >> /var/log/kaggle-lb.log 2>&1

# Mode B — daily digest at 06:00 local, piped to your channel
0 6 * * * /srv/kaggle-lb/.venv/bin/python /srv/kaggle-lb/kaggriculture_leaderboard.py --competition <slug> --title '<Title>' --deadline '2026-11-02 23:59' --tracked-username <kaggle-username> | /srv/kaggle-lb/post-to-chat.sh
```

Two cron gotchas that will cost you an afternoon each. Cron's `PATH` is minimal, so use
absolute interpreter paths — a venv python, not `python3`. And cron does not read your shell
profile, so `HOME` must be set for `~/.kaggle/` to resolve; add `HOME=/home/youruser` at the
top of the crontab if the job runs as a user whose `HOME` cron does not set.

### macOS / LaunchAgent

`launchd` replaces cron on macOS. Drop this at
`~/Library/LaunchAgents/<reverse.dns.label>.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.example.kaggle-leaderboard</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/you/kaggle-lb/.venv/bin/python</string>
        <string>/Users/you/kaggle-lb/kaggle_leaderboard.py</string>
        <string>--competition</string>
        <string>your-competition-slug</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/you/kaggle-lb</string>
    <!-- 6 hours, in seconds. -->
    <key>StartInterval</key>
    <integer>21600</integer>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/Users/you/kaggle-lb/logs/kaggle-leaderboard.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/you/kaggle-lb/logs/kaggle-leaderboard.log</string>
    <key>ProcessType</key>
    <string>Background</string>
    <key>LowPriorityIO</key>
    <true/>
    <key>Nice</key>
    <integer>5</integer>
</dict>
</plist>
```

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.example.kaggle-leaderboard.plist
launchctl kickstart -k gui/$(id -u)/com.example.kaggle-leaderboard   # force a run right now
launchctl list | grep kaggle-leaderboard                             # runs + last exit code
launchctl bootout gui/$(id -u)/com.example.kaggle-leaderboard        # stop it
```

`StartInterval` is an interval, not a wall-clock time — with `RunAtLoad` false, the first
run is one full interval after loading. Use `kickstart` if you want it now. For a job that
must land at a specific hour, use `StartCalendarInterval` instead. Spell out the venv
interpreter in `ProgramArguments`; `launchd` gives you an even barer environment than cron,
and a bare `python3` there is a crash waiting for its turn.

Note that `launchd` has no `MAILTO`. If the job fails, the only evidence is a non-zero exit
code in `launchctl list` and whatever landed in the log — which is precisely why both tools
below are built to fail loudly.

## Failure modes

**Both tools exit non-zero on every error, on purpose.** A scheduled fetch that dies quietly
on an expired token looks *identical* to "the leaderboard did not move". That is the single
failure this whole design exists to prevent. Never wrap either in something that swallows
the exit code.

**Auth failure or expired token.** Mode A sets `status: "error"` in its state file *without
destroying the last-good fields*, so the diff baseline survives to the next successful run,
and it promotes the previous good timestamp into `last_ok_captured_at` so a stale
`captured_at` sitting next to `status: "error"` cannot be misread as "fetched then". Fix by
re-running `kaggle auth login --force`. Check for a stale `KAGGLE_API_TOKEN` in the
environment before you blame the token file.

**Wrong competition slug.** Verified live on 02-Sep-2026 against CLI 2.2.2:

```
$ kaggle competitions leaderboard not-a-real-competition-xyz -d -p /tmp/kagtest2
404 Client Error: Not Found for url: https://api.kaggle.com/v1/competitions.CompetitionApiService/DownloadLeaderboard
$ echo $?
1
```

Both tools additionally check that a `.zip` actually appeared in the download directory and
raise if it did not, rather than trusting the CLI's exit code alone. Keep that check if you
port this — an exit code is a claim, a file on disk is evidence.

**Fewer than two snapshots.** `--no-fetch` needs two. With zero or one it exits 1 with an
explicit message instead of printing a diff of nothing, which would read as "no change". A
normal fetching run with no prior snapshot is not an error: it records `status: "baseline"`
and stores the first snapshot.

**Private or unauthorized leaderboard.** You must have accepted the competition rules for
its leaderboard to be readable, and some competitions do not publish one at all. This
surfaces as a 401/403 from the CLI, no zip on disk, and a non-zero exit — same path as a bad
slug. Accept the rules on the competition page with the same account the token belongs to.

**Empty CSV or no ranked teams.** Guarded explicitly. An empty file, or a board where every
row is a `Rank` 0 host benchmark, raises rather than reporting a field of zero teams.

**Tracked username not found (Mode B).** Not fatal — the digest prints an explicit warning
that rank tracking is off and to check the `--tracked-username` flag. A silently missing
rank line is how a wrong placement gets believed.

## Storage growth, and why nothing is pruned

Measured on the live archive, 02-Sep-2026:

- 29 snapshots, **5.9 MB** total on disk
- 27-Aug-2026, 6,622 teams: **203,080 bytes** gzipped
- 02-Sep-2026, 7,343 teams: **226,180 bytes** gzipped

That is roughly **31 gzipped bytes per team**, and the per-snapshot size grows with the
field. At 4 fetches/day and ~226 KB each, budget about **0.9 MB/day, ~27 MB/month**, rising
slowly as teams join. (Those 29 files are about six days of scheduled ticks plus five manual
test fetches taken minutes apart on 27-Aug.)

Snapshots are **never overwritten and never pruned.** That is a decision, not an oversight.
The entire point is movement over time; a pruned archive can only answer questions you
thought to ask before you deleted the evidence, and 27 MB/month is not worth the option to
be wrong about that later. A competition running six months costs under 200 MB. If you do
need a retention policy, prune by keeping one snapshot per day beyond N days rather than
dropping whole date ranges — you keep the long arc and lose only intraday resolution.

## Why not scrape the leaderboard with a browser

The `sonpham-org/autoresearch-arena` repo contains `scripts/_pull_leaderboard.py`, which
drives a headless Chrome session
through a persistent cookie-authenticated profile and calls Kaggle's internal
`competitions.LeaderboardService/GetLeaderboard` endpoint directly. It was written as a
workaround for a dead Orbit Wars API token, and for that interactive purpose it is fine.

**Do not put it on a schedule.** Concretely:

- Its module-level `try/except Exception` prints a traceback and never re-raises, and it
  catches `SystemExit` too. **It exits 0 when it fails.** A cron wrapper would report success
  every time while producing nothing — the exact failure mode the two kaggle-CLI tools were
  built to make impossible.
- The cookie-auth Chrome profile expires and needs a human at a browser to restore. A
  headless scheduled job cannot do that.
- It calls an undocumented internal `/api/i/` endpoint that Kaggle can change without
  notice. `kaggle competitions leaderboard` is the supported public interface.
- It writes fixed paths under `/tmp` and keeps no archive and no state, so it can tell you
  the board now but never how the board moved.

Where the plain kaggle CLI authenticates for a competition, use it. Reserve the browser path
for competitions where the CLI genuinely cannot authenticate, and run it by hand.

## Reference implementation

Both scripts described here currently live **outside both repositories**, on the Mac Mini
that runs them:

- Mode A — `~/kaggriculture-worker/tools/kaggle_leaderboard.py`
- Mode B — `~/bubba-workspace/tools/kaggriculture_leaderboard.py`

They are checked into neither `82deutschmark/arc-explainer` nor
`sonpham-org/autoresearch-arena`. This doc is written so you can reproduce the behaviour
without them; if you want the source, it has to be copied off that machine. The machine-specific operator runbook for the Mac Mini's
LaunchAgent lives at `~/bubba-workspace/docs/2026-08-27-kaggle-leaderboard-monitor.md`.

Three things to change if you port either script rather than rewriting it. All three are
module-level constants, not flags:

- `KAGGLE_BIN` is hardcoded to `~/.local/bin/kaggle` in both. On a box where `kaggle` is on
  `$PATH` or installed elsewhere, this fails. Change it or make it an argument.
- `STATE_DIR` in Mode B is a module constant pointing into `~/bubba-workspace/state`.
  `--state-name` changes only the *filename stem*, not the directory. (Mode A does expose
  `--state-path` and `--snap-dir`.)
- `TOP_N = 10` in Mode B is a constant, not a flag. Mode A's band is `--top`.

## One warning worth carrying over

A Kaggle `Score` column and any rating you compute locally — Elo, Bradley-Terry, a private
eval — are **different, non-comparable scales**. They frequently land in a similar numeric
range, which is exactly what makes the mistake easy: on 27-Aug-2026 the Kaggle top score on
one competition was about 3113 while the top local Bradley-Terry rating for the same agents
was about 2952 — close enough to look subtractable, and it is not. Never subtract one from the
other, never rank across them, never put them in the same table. Mode A carries this warning
inside its own state file under `note` so nobody reading the JSON six weeks later can miss
it.
