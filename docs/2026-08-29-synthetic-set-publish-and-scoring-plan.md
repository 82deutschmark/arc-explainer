<!--
Author: Claude Opus 5
Date: 2026-08-29
PURPOSE: Plan and completion record for publishing the remaining autoresearch-arena
synthetic tasks (g007-g010) to arc3.markbarney.net, the curation route that publishing
them exposed as missing, and the scoring bug the post-publish play-through uncovered in
six of the seven games. Kept because the verification method -- play the published game to
completion over HTTP, do not trust a 200 -- is the reusable part.
SRP/DRY check: Pass - documents existing routes and services; adds no duplicate logic.
-->

# Synthetic set: publish g007–g010, and the scoring bug it surfaced

**Status: complete.** Seven synthetic tasks live, tagged, and each verified to a full
score against the production server.

## Objective

Publish the autoresearch-arena synthetic tasks that were built and verified but never
uploaded, and make the human-vs-agent comparison the telemetry work depends on actually
trustworthy.

## What shipped

| task | levels | live |
|---|---|---|
| g001 Toll Gate | 8 | already live |
| g005 Rube Hall | 6 | already live |
| g006 Chain Bloom | 6 | already live |
| g007 Tumble Block | 8 | published this pass |
| g008 Two Skins | 7 | published this pass |
| g009 Prism Run | 7 | published this pass |
| g010 Lantern Ledger | 8 | published this pass |

Every one is `approved`, `isPlayable`, tagged `['synthetic','autoresearch']`, with
`levelCount` derived by the server actually running the file at publish time rather than
declared by the submitter.

## Two problems found, both fixed

### 1. A published game could not be tagged (shipped in 7.8.0)

`SyntheticLanding.tsx` selects the synthetic set with
`games.filter(g => g.tags.includes('synthetic'))`. Tags were settable only at creation and
only through `POST /games`; the public `POST /submissions` path — the one our own games now
use — stores `tags: []`, and no route could set them afterwards. g007 and g008 published
**playable, approved, thumbnailed, and absent from the page meant to list them.**

The `tags: []` default is correct: a submitter must not be able to tag their own game into
a curated collection. What was missing was a way for a reviewer who has *already approved*
a game to file it. Added admin-gated `PATCH /games/:gameId/curation`, which touches tags,
difficulty and the featured flag only — never source, status, playability or level counts,
so it cannot publish anything.

### 2. Nobody could score 100% on any game

Playing g008 to completion **through the production HTTP session** — rather than checking
that actions returned `200` — returned `state=WIN score=6 win_score=7`.

Six of the seven games finished a level with `if is_last_level(): win() else:
next_level()`. ARCEngine's `next_level()` already handles the last level and is what
performs `_score += 1`, so calling `win()` directly skipped it: a flawless run ended in
`WIN` reporting `win_score - 1`.

`CommunityGameValidator` cannot catch this — static analysis does not execute, and runtime
validation proves the game *instantiates*. The game loads, runs, advances and reports
`WIN`; only the number is wrong, and that number is the metric the comparison rests on.

Fixed in `82deutschmark/autoresearch-arena` (`efd5631`, `243e8d1`), with fixed sources
pushed to every live game here via `PUT /games/:gameId/source`. Full write-up, including
why six independent verifiers all passed a broken game, is at
`arc3games/SCORING_BUG_FINDINGS.md` in that repo.

## Verification

Not "the endpoint returned 200". Each published game was replayed to completion against
production, asserting the final frame reports both `WIN` and a full score:

```
g008  state=WIN score=7/7 levels=7/7   170 actions
g009  state=WIN score=7/7 levels=7/7    63 actions
g010  state=WIN score=8/8 levels=8/8   950 actions
```

This is the check that found the bug and the one worth repeating on every future publish.
Thumbnail and `/arc3/play/<id>` return 200 for all seven.

## Follow-ups, not done here

- `POST /session/:guid/action` returns **500** when `coordinates` is sent as `{x, y}`
  instead of the expected `[x, y]` tuple. A malformed client payload should be a 400 from
  the route, not an unhandled error out of the Python bridge. Cosmetic to a correct client;
  misleading to anyone writing one.
- `/human-stats` holds two g001 sessions, neither completed, neither a real human play
  (level 1, ~43 actions — consistent with scripted probing). No stored run was scored under
  the bug, but the table is not the clean slate it was believed to be, and clearing it
  needs database access.
