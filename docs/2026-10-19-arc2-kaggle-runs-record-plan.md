<!--
Author: Claude Opus 5.5 Low
Date: 19-October-2026
PURPOSE: Plan for the ARC-AGI-2 runs record on ARC Explainer: Son asked for something like the
  ARC-3 "Kaggle runs record" (arc-3 repo, docs/2026-10-11-kaggle-runs-record.md), and the Boss
  chose to build it here, behind a new team-only login (19-Oct-2026). Rewritten the same day after
  probing Kaggle: the first draft assumed per-task comparisons that the data can't support.
SRP/DRY check: Pass - plan only. Reuses the arc3 admin-token guard for machine writes and the
  site's existing Postgres document pattern (kaggle_board_documents).
-->

# ARC-AGI-2 runs record (plan, 19-Oct-2026)

## What the ARC-3 one does

Every ARC-3 Kaggle run gets a one-line description and a baseline. A watcher on the Mac Mini
polls Kaggle every five minutes (because Kaggle only serves a kernel's newest output, so a missed
window loses the evidence), downloads the output, has Claude write a four-heading note against
the baseline from the run's turn-by-turn traces, and publishes it to a team-only page on Son's site.

## What the ARC-2 data actually looks like (probed 19-Oct-2026)

- **The team's submission list is the record.** One Kaggle call (as markbarney, now on team ARC
  Mutants) returns every team submission from every member, Jack's (jcole75) included: the
  author's own description of the change, the public score, who submitted it, when, and the
  notebook and script version it came from. It works retroactively, so nothing is lost between
  polls and there is no "needs a description" scan.
- **Jack's notebooks are readable to us.** Their status, newest output and source download fine.
- **There are no turn traces.** A notebook's saved-version run is a short check, and different
  people's checks use different task sets (Jack's uses four public evaluation tasks and says
  itself it is not an accuracy comparison; ours used a different set). So there is no fair
  task-by-task comparison between runs. The outcome is the public board score, against the
  baseline's score.
- **What can be audited** is whether the code and the log show the described change: the
  notebook source of this submission and its baseline (a code diff), and the saved-version log.

## Design

**Spine:** a Mini script reads the submission list every fifteen minutes. Each submission is a
run, keyed by Kaggle's submission number.

**Baseline:** most descriptions name the run they build on by its score ("the 39.31 serving").
The script proposes the earlier submission with that score as the baseline and marks it as
guessed. Anyone signed in can change it; the team's choice wins.

**Enrichment (best effort):** when the notebook's newest version is the one submitted, the
script keeps its logs and small JSON outputs and its source on the Samsung SSD
(data/arc2-runs/), never weights or caches.

**Claude's note** (headless Claude Code on the Mini, read-only tools inside a scratch folder,
fixed prompt arc2-impact-v1): Change (the author's words), Outcome against the baseline (score
vs score; a single swing needs a repeat), Where the code and log show it, Verdict. It sits under
the author's own description, never in place of it.

**Site:**
- Login: one shared team passphrase (env ARC2_TEAM_PASSPHRASE on Railway), posted once; the
  server sets an httpOnly signed cookie that lasts sixty days. Changing the passphrase signs
  everyone out. Closed by default: with no passphrase set, nobody gets in.
- Who holds which secret: the passphrase lives on Railway (what the site checks) with a copy in the
  Mac Mini's keychain (service arc2-team-passphrase) so the Boss can hand it out; rotate both
  together. The Mini publishes with the separate arc3 admin token, which has nothing to do with the
  team login.
- Storage: run documents as JSON text in a new table shaped like kaggle_board_documents, plus a
  notes table (baseline choice, team note, who, when) with an append-only log of every edit.
- Routes: team routes behind the cookie (index, one run, edit note); machine routes behind the
  existing arc3 admin token (publish a run document, read the notes).
- Pages: /team/login, /team/arc2-runs (every submission newest first: date, who, description,
  score, baseline and difference, note status), /team/arc2-runs/:key (everything for one run,
  Claude's note, the log).

## Order

1. Login, storage, routes. 2. Pages. 3. The Mini script with publishing, no Claude note; backfill
all submissions. 4. Claude's note, last, since it is the part most likely to need tuning.
