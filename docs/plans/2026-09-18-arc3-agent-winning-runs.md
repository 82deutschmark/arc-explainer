<!--
Author: Claude Opus 5
Date: 2026-09-18
PURPOSE: Backend note for the training pipeline (Bubba, sonpham-org/arc-3 distill): a set of
         winning AI runs on all 25 public ARC-AGI-3 games, with the agent's per-batch notes,
         pulled from a public arcprize.org scorecard into data/arc3-agent-runs/. Says what the
         file holds, how to read it, how trustworthy the notes are, and how to pull more.
         Internal data only: nothing here is shown on the site.
SRP/DRY check: Pass -- describes data written by scripts/arc3/pull_agent_scorecard.py; the
         script's own header covers the endpoints and checks.
-->

# Winning AI runs as extra training data

**Status 18-Sep-2026: pulled and checked. Backend only, not on the site. Not yet read by
the training pipeline.**

## What it is

A public ARC scorecard from an external team's harness on gpt-6-astra (high), 9 Sep 2026,
won all 25 public games. ARC keeps a recording of every public scorecard. This agent sent a
one-line note with each batch of moves, saying what it was testing and what it expected.
Those notes are in the recording.

- 183 won levels, 6,732 moves, 1,436 notes, every level cleared.
- Every game is the exact build we document, and every per-level move count matches the
  scorecard.
- Source: <https://arcprize.org/scorecards/75d9c8e7-ade9-4a8f-a747-6acbea51bb1b>. Team, harness
  name and code link are in each record's `source` field for provenance.

## Where it lives

| What | Where | In git? |
| --- | --- | --- |
| **One record per won level** | `data/arc3-agent-runs/<card_id>.levels.jsonl` | yes, 421 KB |
| The 25 raw recordings, every frame (about 340 MB) | `data/arc3-agent-runs/raw/<card_id>/` | no, gitignored; re-pull any time |
| The script | `scripts/arc3/pull_agent_scorecard.py` | yes |

## One record, in words

Each line of the `.levels.jsonl` file is one (game, level):

- `gameId`, `build`, `envId`: the game and its exact version (always our live build).
- `guid`: the play session. `recordingLines` is the first and last line of this level in the
  raw recording, so frames can be joined back.
- `level`, `levelCount`, `cleared`, `moves`, `baselineActions` (ARC's human baseline).
- `steps`: the level in play order. Each step is one note and the moves made under it, e.g.
  `{"note": "Click blue control: test whether checkerboard blue walkway becomes solid...", "moves": ["ACTION6(48,36)"]}`.
  Clicks carry their x,y. A `RESET` is a move like any other.
- `source`: card id, team, harness, model, scorecard link, date.

## How good the notes are

**They're in the shape we want the model to write:** what it's testing and what it expects.
Example from dc22 level 1: "Enable goal blue bridge, then ascend red path to blue. Red button
rotates bridge about fixed magenta hub, not player."

**The colour words are usable.** Using the colour test from
`docs/astra/reasoning-trace-audit.md` (a note says "<colour> at (x,y)", then we check that
cell on the board the agent was looking at):

| Run | colour claims checked | right | a random cell would be right |
| --- | --- | --- | --- |
| ARC's own Astra runs (from that audit) | 155 | 5.8% | 11.6% |
| This card | 45 | 44.4% | 4.3% |

This harness shows the model a picture every turn, which is the likely difference. Most misses
land on black, as if the agent gave the corner of an object's box rather than a cell inside it.
Treat a coordinate in a note as "near here", not an exact cell.

**Limits.**
- One note covers a batch of up to 8 moves. The moves in a batch share it.
- It is one model's playstyle. Use it to add to the human data, not to replace it.
- The agent's full thinking is not in the recording, only these notes.

## Using it in the pipeline

It fits the "C. demonstrations" idea in the dataset brief
(`2026-09-18-arc3-game-page-glowup-and-dataset-prd.md`, Part 3): winning moves per level, with
the reasoning written down. The corpus is stuck at 381 turns because it only keeps levels our
own model beat. This covers all 25 games.

1. Read the `.levels.jsonl`. One line per level, no frames.
2. For frames, read the raw recording at `recordingLines` (re-pull with the command below), or
   replay the moves on the local engine. The builds match, so the boards come out the same.
3. One training turn = the board before the step, the note as reasoning, the moves as the
   action. That's 1,436 turns before any splitting by move.

## Pulling another card

Any public AI scorecard with one run per game:

```bash
python scripts/arc3/pull_agent_scorecard.py <card_id> --team "<who>" --agent "<harness>" --model "<model (effort)>" --source-url <their code>
```

It downloads only what's missing, and writes nothing if a build or a per-level move count
doesn't match the card. Each card gets its own file.

Next candidate: ARC's own Astra Provider Adapter runs on the public games (see `docs/astra/`).
Those need their scorecard ids.
