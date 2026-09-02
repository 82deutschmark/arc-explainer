<!--
Author: Claude Opus 5 (Bubba sub-agent, label arc3-polish-resync)
Date: 02-September-2026
PURPOSE: The runbook for re-publishing our authored ARC-AGI-3 tasks into this repository
after they are polished upstream. Records the order the steps have to run in, the two
gates that must pass before anything is committed, and why this is a human-run step rather
than a cron.
SRP/DRY check: Pass -- sequencing and rationale only. The steps themselves live in
scripts/arc3/import_authored_games.py and scripts/arc3/build_authored_manifest.py; this
file does not reimplement them and no wrapper script duplicates them either.
-->

# Re-syncing the authored task catalog

## What this is for

`server/data/arc3-games/` is the first-party catalog the play surface serves — 50 task
modules under opaque ids plus a generated `manifest.json`, read by
`server/services/arc3Mirror/Arc3MirrorCatalog.ts` as its `local` source.

Those tasks are authored in a private repository and polished there. Polishing that
repository changes nothing here: the two are connected by a publish step, and until
someone runs it this repository keeps serving the build it last imported. This document is
that step.

## The property that must not break

A published id is `"t" + sha256("arena:" + <authoring id>)[:8]` — a pure function of the
authoring id, with no randomness and no state. That is what makes a re-import safe:
**an updated task is rewritten under the same id it already had.**

Ids must not churn. All 50 rows in `server/services/arc3Mirror/arc3Triage.json` are keyed
by them, as are the feedback rows and the human-play telemetry, and none of those live in
this repository. An id change would not fail a build or a type-check; it would type-check,
sort, render, and address nothing.

`import_authored_games.py --check` exists to assert exactly this, and is the reason step 5
below is not optional.

## Order of operations

Steps 1–3 happen in the authoring repository, 4 onward here. Run with `python3.13` or
newer on both sides — several tasks use structural pattern matching, which the macOS
system `python3` (3.9) cannot parse, and under it every task reports a bogus `SyntaxError`.

Use `set -euo pipefail`, or run the commands unpiped. Piping a step into `tail` makes `$?`
report the pipe, so a real failure reads as success.

1. **Find stale builds.** In the authoring repo: `python3.13 check_dist_current.py`.
   It reports any task whose packaged build no longer matches its source — i.e. a polish
   cycle that never re-ran the packager. It compares content, not mtime; mtime
   false-positives on comment-only edits, which packaging strips anyway.
2. **Re-package each stale task**, one at a time.
3. **Run the verifier for every task you re-packaged**, against both the source and the
   packaged lane. **A task whose packaged lane fails does not get published.** Nothing
   downstream catches it — a broken build still imports and still renders.
4. **Import.** The source is the authoring repo's packaged directory, and `--map-out`
   is mandatory and must point outside this repository:
   ```
   python3 scripts/arc3/import_authored_games.py \
       --source /path/to/authoring/dist --map-out ~/somewhere/private/map.json
   python3 scripts/arc3/build_authored_manifest.py
   ```
   Both are idempotent. Re-running with an unchanged source rewrites identical bytes.
   The import prints a note if the published directory holds files the source no longer
   produces; it does not delete them, and neither should you without checking what still
   references the id.
5. **Prove the round trip.** Both must exit 0:
   ```
   python3 scripts/arc3/import_authored_games.py --source <same dir> --map-out /tmp/x.json --check
   python3 scripts/arc3/build_authored_manifest.py --check
   ```
6. **Prove nothing leaked.** The authoring names — filenames, class names, `gNNN` ids —
   must not appear on any added line. `git diff --cached` and grep for them, driven off
   the private map rather than from memory. This is the one step with no automated gate
   behind it and it is the one that matters most: this repository is public and permanent.
7. **Type-check and build.** Compare `npx tsc --noEmit` against a baseline captured on an
   unmodified checkout in the same worktree — this tree carries pre-existing errors, so
   the test is "no new ones", not "zero". `npm run build` must exit 0.

## Import from the authoring repo's merged state, not a branch

Publish from what the authoring repository's default branch actually contains. Importing
a task from an unmerged branch puts bytes in this public repository that do not exist in
the source of truth, and `--check` in step 5 then fails against that source and keeps
failing until the branch merges. A task polished in an open PR waits for the merge and
lands on the next sync.

## Cron or manual?

**Recommendation: manual. Do not schedule the publishing path.**

- It writes to a public, permanent repository. The leak check in step 6 is a judgement
  call with no automated gate; an unattended publish is only as trustworthy as that step,
  and that step is the one a machine cannot make.
- It is gated on a human merge in a private repository owned by someone else. A scheduler
  cannot decide whether a PR is ready.
- Polish cycles are bursty, not periodic. A task set can sit unchanged for a fortnight and
  then move three times in a day, so a timer is wrong in both directions.
- Step 3 can legitimately refuse to publish. "Verifier failed, publish nothing" needs a
  person to read it, not a retry.

**The scheduleable middle ground**, if drift going unnoticed is the actual worry: the
`--check` invocations in step 5 are read-only and write nothing. Those could run on a
timer purely to *report* that the catalog has drifted from upstream, leaving the publish
itself manual. That is a separate decision and nothing here installs it.
