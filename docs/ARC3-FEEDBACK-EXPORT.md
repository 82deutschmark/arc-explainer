<!--
Author: Claude Sonnet 5
Date: 2026-09-06
PURPOSE: What the daily ARC-3 feedback export is, where its pieces live, and how to
         check on it, rerun it, or take it apart. Written so this doesn't need
         re-discovering the next time someone iterates on these games.
SRP/DRY check: Pass — no existing doc describes this pipeline end to end.
-->

# ARC-3 player feedback → autoresearch-arena, daily

## The gap this closes

Players leave feedback (checkboxes + a free-text note) on ARC-3 tasks through
arc-explainer's site. The counts already leave the database publicly, via
`/api/arc3-play/feedback-summary` and `/api/arc3-play/promoted`. The note text — the
actual *why* a game got flagged, which is what a revision decision is made from — is
deliberately write-only: no endpoint returns it (see the header comment in
`server/repositories/Arc3FeedbackRepository.ts`). Until 05-Sep-2026 the only way to read
it was a hand-run SQL query, written up as a one-off doc
(`docs/2026-09-02-arc3-game-feedback-synthesis.md`) that would have needed re-doing by
hand every time.

This pipeline reads that same table and lands the notes in
`sonpham-org/autoresearch-arena`, next to `revisions.jsonl`, once a day, automatically.

## The pieces

| File | Repo | What it does |
|---|---|---|
| [`server/scripts/export-arc3-feedback.ts`](../server/scripts/export-arc3-feedback.ts) | arc-explainer | Reads `community_game_feedback`, appends new rows to `feedback.jsonl`, refreshes `game-versions.json`. Read-only against the DB. |
| [`scripts/arc3/daily-feedback-export.sh`](../scripts/arc3/daily-feedback-export.sh) | arc-explainer | Runs the script above, then commits + pushes the result in autoresearch-arena. What the cron actually calls. |
| [`scripts/arc3/com.markbarney.arc3-feedback-export.plist`](../scripts/arc3/com.markbarney.arc3-feedback-export.plist) | arc-explainer | The launchd job definition (checked in so a machine reset doesn't lose it). Installed copy lives in `~/Library/LaunchAgents/`. |
| `arc3games/feedback.jsonl` | autoresearch-arena | One line per feedback row: `id`, `gameId`, `sourceVersion`, `flags`, `note`, `reachedLevel`, `outcome`, `createdAt`. Append-only, never rewritten. |
| `arc3games/game-versions.json` | autoresearch-arena | Current `sourceVersion` per `gameId`, as of the last run. Fully overwritten every run. |

Runs **on the Mac Mini** (not Railway) via `launchd`, daily at 06:00 local time. Why not
Railway cron: Railway's cron runs in a fresh, stateless container with no access to the
autoresearch-arena checkout, so it would have to clone the repo and hold a write-capable
git credential to Son's org as a cloud secret, firing unattended. The Mac Mini already has
both repos checked out and the Railway token used to reach the DB — this reuses that
instead of creating a second, riskier credential surface.

## Versioning — why there are two files, not one

These games get revised repeatedly, so "which build was this feedback about" has to
survive a rebuild. Each `feedback.jsonl` row already carries the `sourceVersion` it was
recorded against — a content hash, stamped client-side at submit time. Rows from before
04-Sep-2026 have `sourceVersion: null`; that predates the stamp and is not a claim about
the build.

That answers "which build the note is about." It does **not** answer "is that build still
what's being served" — that fact changes the moment someone publishes a revision, so baking
a `current: true/false` flag directly into a feedback row would go stale the day after
export and quietly lie from then on.

So freshness is a separate, always-fresh snapshot: `game-versions.json` maps every
`gameId` that has ever received feedback to whatever `Arc3MirrorCatalog` is serving for it
*right now*, and gets overwritten in full on every run — even a run with zero new
feedback, because a revision published today with no feedback yet is exactly the case a
skipped snapshot would hide.

**To tell whether a note is about the live build:** compare that row's `sourceVersion` in
`feedback.jsonl` against `versions[gameId]` in `game-versions.json`. Equal → the note is
about what's live now. Unequal (or the row's `sourceVersion` is `null`) → the note is
about a build that has since been revised, or predates versioning entirely. `null` in
`game-versions.json` itself means the id could not be resolved at all (retired/renamed),
not that the build is unversioned.

This is the same comparison `server/services/arc3Mirror/Arc3Promotion.ts` already makes
for the in-app promotion signal — this pipeline reuses `Arc3MirrorCatalog.getSource()` the
same way rather than re-deriving version hashes.

## Checking it's alive

- **Log:** `~/Library/Logs/arc3-feedback-export.log` — every run appends a timestamped
  block, success or failure.
- **Git history:** `git -C ~/GitHub/autoresearch-arena log --oneline -- arc3games/` — a
  commit lands daily even when no new feedback arrived, because `game-versions.json`'s
  `generatedAt` timestamp always changes. That daily commit **is** the proof this is still
  running; a gap of more than a day means the job stopped.
- **Job status:** `launchctl print gui/$(id -u)/com.markbarney.arc3-feedback-export`

## Running it by hand

```bash
scripts/arc3/daily-feedback-export.sh
```

Safe to run any time — the export is watermarked on the feedback table's own `id` (read
back from `feedback.jsonl` itself, not a separate state file) and only appends what's new.

## Install / reinstall / remove

```bash
# install (or reinstall after editing the plist)
cp scripts/arc3/com.markbarney.arc3-feedback-export.plist ~/Library/LaunchAgents/
launchctl bootout gui/$(id -u)/com.markbarney.arc3-feedback-export 2>/dev/null
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.markbarney.arc3-feedback-export.plist

# run it right now instead of waiting for 06:00
launchctl kickstart gui/$(id -u)/com.markbarney.arc3-feedback-export

# remove entirely
launchctl bootout gui/$(id -u)/com.markbarney.arc3-feedback-export
rm ~/Library/LaunchAgents/com.markbarney.arc3-feedback-export.plist
```

## Known caveats

- Only runs while the Mac Mini is on. A missed day catches up automatically the next time
  it runs — the watermark just picks up wherever it left off.
- Depends on `~/.railway/bubba-token` staying valid. If the export step starts failing,
  check that first (`railway whoami` with the token exported).
- `sourceVersion: null` on an older row is expected, not a bug (see Versioning above) —
  don't backfill it, the bytes those players actually saw were never recorded.
