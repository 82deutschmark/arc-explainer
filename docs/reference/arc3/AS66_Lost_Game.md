<!--
Author: Claude Fable 5.1; corrected by Claude Opus 5
Date: 2026-09-17
PURPOSE: The single entry point for anything about AS66, "the lost game" (informal name
         "Always Sliding"). If Boss says "the lost AS66 game", "the lost game", "Always Sliding"
         or "the withdrawn preview game", this is the page to read first. It says what the game
         is, what happened to it, where every file lives across the three repos, how to play it,
         and what must NOT be done with it.
SRP/DRY check: Pass -- an index. Rules live in the PRD, code lives in ARCEngine; this points.
-->

# AS66 -- the lost game ("Always Sliding")

**Search terms this page answers:** lost game, lost AS66, as66, Always Sliding, withdrawn
preview game, 26th game, holdout game, recreated game.

## What it is, in four lines

- One of the six ARC-AGI-3 preview games (July 2025). Withdrawn from the public set by
  September 2026; ARC Prize never published its source, and it is not in any download batch.
- Boss recorded a full nine-level win on 27-Dec-2025. That recording was enough to rebuild it.
- The rebuild replays every frame of that recording exactly, and its nine level layouts match
  Boss's screenshots. Mechanics were corrected on 17-Sep (laps, a level 4 crash, the meter).
- **Test only, never trained on** (Boss, 17-Sep). The agent harness in the `arc-3` repo can play
  it from `datasets/test-only-games/`; it is never in the training catalog or any training data.
  On this site it is playable by link and listed nowhere. Public GitHub exposure does not matter
  (agents under test have no internet).

## Play it

`/arc3/play/as66` on arc-explainer (link-only; it is in no gallery, chip, queue or "next task").
Arrows slide the block. Click does nothing. No undo; RESET restarts the level.

Rules in one breath: the block slides until something stops it; the field wraps at its edges (a slide all the way round is charged but changes nothing);
orange squares kill (the dark-red core shows which way they go next); a colored bar recolors a
block that passes through it; every block must end in a white cup whose back-wall marker is
white or its own color; the orange border is a move budget and filling it loses.

## Where everything is

| What | Where |
|---|---|
| **The game (canonical source)** | `external/ARCEngine/games/official/as66.py` |
| Packaged copy (official layout) | `external/ARCEngine/environment_files/as66/v1/` |
| Copy the website plays | `server/data/arc3-holdout-games/as66.py` (+ `manifest.json`, `README.md`) |
| Proof it matches the original | `external/ARCEngine/tests/games/test_as66.py` (21 tests) |
| 17-Sep fix plan (what was wrong and why) | `external/ARCEngine/docs/plans/17-September-2026-as66-mechanics-fix-plan.md` |
| Rules, history, evidence rows | `docs/plans/2026-09-16-as66-always-sliding-recreation-prd.md` |
| Glow-up + synthetic series plan | `docs/plans/2026-09-16-as66-glowup-synthetic-series-prd.md` |
| Level layouts as data | `docs/arc3-game-analysis/as66_levels.json`, `as66_solutions.json` |
| All nine levels, one image | `docs/arc3-game-analysis/as66-levels-contact-sheet.png` |
| Boss's recording (the oracle) | `public/replays/as66-821a4dcad9c2.db85123a-891c-4fde-8bd3-b85c6702575d.jsonl` |
| Boss's screenshots, video | `client/public/as66*.png`, `client/public/videos/arc3/as66-test.mp4` |
| Spoiler page data (URL-only page `/arc3/games/as66`) | `shared/arc3Games/as66.ts` |
| Copy the agent harness tests on | `arc-3` repo: `datasets/test-only-games/as66/v1/` (+ `README.md`: rule, how to run, baselines) |
| Human vs agent runs (15 recordings) | `arc-3` repo: `docs/trace-findings/2026-09-15-as66-the-withdrawn-26th-game.md` |

Run the proof (from `external/ARCEngine`):

```bash
.venv/bin/python -m unittest tests.games.test_as66
```

## If you change the game

Edit the canonical file, then copy it over the other three. All four must stay byte-identical;
the website copy is what people play, the arc-3 copy is what agents are tested on, and the test
only covers the canonical one.

```bash
cp external/ARCEngine/games/official/as66.py server/data/arc3-holdout-games/as66.py
cp external/ARCEngine/games/official/as66.py external/ARCEngine/environment_files/as66/v1/as66.py
cp external/ARCEngine/environment_files/as66/v1/* ../arc-3/datasets/test-only-games/as66/v1/  # then a PR in arc-3
```

The browser runs the file with a bare `exec`, so keep it a single file with no
`from __future__` import and no imports beyond the standard library, numpy and arcengine.

## Do not

- **Do not train on it.** Never put it in `arc-3`'s `docs/static/games/` (the catalog the
  fine-tune pipeline plays and trains on), and never let an AS66 record, human or agent, into
  any training data. Its only place in `arc-3` is `datasets/test-only-games/`. Anyone extracting
  training data from a run that played it adds `as66` to `--exclude-games`.
- Do not add it to the gallery, the landing page or the review queue.
- Do not "fix" the odd rules (enemies move first; a press toward the green side does nothing;
  a slide all the way round the board puts the enemies and ring back when the block gets home;
  the winning move is not charged on the meter). They are in the recording and the tests need them.

## About `external/ARCEngine`

It is a git submodule pointing at Boss's own copy of the engine on GitHub
(`82deutschmark/ARCEngine`). It started as ARC Prize's engine and now carries our own games on
top. Nothing is sent back to ARC Prize and nothing needs to be. Two things follow: a change in
there is its own commit and push, and then arc-explainer needs a second small commit to point at
it. Both were done for AS66.
