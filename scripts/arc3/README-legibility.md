<!--
Author: Claude Opus 5 (Bubba sub-agent, label arc3-legibility-gate)
Date: 01-September-2026
PURPOSE: Who owns the legibility gate, how the copy in this repo is kept honest, and how to
re-run it when a new batch of generated tasks lands in the review queue.
SRP/DRY check: Pass — the rules live in legibility_gate.py; this is the operating manual.
-->

# The legibility gate

**The rule:** every term a win or lose condition depends on must be reachable from
something the renderer draws. A goal the player cannot see is not a goal.

41 of 823 generated tasks broke it in the same way: ACTION6 is a commit button comparing
the player's whole action history against a hidden literal plan the renderer never draws,
any mismatch calls `lose()`, and that is the only death. One blind guess at an invisible
sequence, no feedback. 23 of them were in the review queue. Full account:
`docs/2026-09-01-arc3-junk-game-audit.md`.

## Ownership and the copy

`legibility_gate.py` here is a **byte-identical copy**. The canonical file is
`arc3games/legibility_gate.py` in `sonpham-org/autoresearch-arena`, where it also gates
publishing (`make_submission.py` refuses to package a game that fails it) and where its
corpus regression lives (`selftest_legibility_gate.py`). It is copied here because triage
regeneration runs in this repo and cannot depend on cloning a private one.

**Change the rules in the arena repo, then copy the file across and update the hash below.**

Canonical sha256, 01-Sep-2026:

```
5632b833d67e74207c7e16770df9789a8e4ae9ac6beac8a1427614d0e69d58c7
```

Drift check — this must print that value, and so must `shasum -a 256
arc3games/legibility_gate.py` in the arena repo:

```bash
shasum -a 256 scripts/arc3/legibility_gate.py
```

The copy carries no added header precisely so that check is one command with no
`tail -n +N` in it. If the two hashes disagree, two gates disagree about what is
publishable, and the disagreement is silent in both directions.

## Re-running it

After `probe_one.py` / `funnel.py` regenerate `arc3Triage.json` for a new batch:

```bash
python3 scripts/arc3/apply_legibility_gate.py --report    # verdicts, writes nothing
python3 scripts/arc3/apply_legibility_gate.py --write     # rewrite arc3Triage.json
```

It reads each task's Python — from `server/data/arc3-games/` for the 50 hand-authored
tasks, from the mirror (`ARC3_MIRROR_BASE`, default `https://arc3.markbarney.net/api/arc3-mirror`)
for the generated ones, cached under `--src-dir`. A queued task that fails becomes
`status: "illegible"` and carries an `illegibility` block with the offending comparison and
the status it held before. Tasks already `weak` or `duplicate` keep their status and gain
the same evidence; the totals still sum to `probed`.

Re-running with a changed gate **restores** `previousStatus` on rows that no longer fail,
so the file cannot accumulate verdicts no rule still produces.

## Checking one file by hand

```bash
python3 scripts/arc3/legibility_gate.py path/to/game.py          # exit 1 if illegible
python3 scripts/arc3/legibility_gate.py path/to/*.py --json
```

## What it does not do

- **It does not execute anything.** Pure `ast`. It cannot tell you a game is winnable, only
  that its goal is drawn. Solvability is the verifier's job in the arena repo.
- **It does not judge difficulty.** The execution probe is the lower bound (can random play
  beat it); this is one specific upper bound (can anyone). Neither replaces the other, and
  the probe demonstrably cannot see this class — the flagged tasks score *above* the median
  queued task on `frames` and `responsive`, the two things `rank` sorts on.
- **It does not catch every illegible game**, only the exact-hidden-answer shape. A game
  that draws a goal too small to read is illegible to a person and invisible to this.
