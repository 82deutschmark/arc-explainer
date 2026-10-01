<!--
Author: GPT-6 (Codex)
Date: 2026-09-30
PURPOSE: Training handoff for complete reconstructed human play traces, screenshot evidence
         and independently executed winning demonstrations on the 25 public ARC-3 games.
SRP/DRY check: Pass — source notes stay in shared/arc3Games; reviewed reconstruction stays
         in annotations.json; release files are generated and checked before committing.
-->

# Mark Barney's ARC-3 reasoning traces

**66 complete synthetic play traces across all 25 public games**, grounded in
[Mark's game write-ups](https://arc3.markbarney.net/arc3/games), game screenshots, current
game mechanics and working demonstrations. Each fills in the situation, hypothesis, action,
expected result, result, revised understanding and next move.

Start with [the illustrated write-up](release/TRACE_WRITEUP.md). The committed
[release directory](release/) contains the training files, images and replay evidence.

## What is inside

| File | Contents |
| --- | --- |
| `train.jsonl`, `validation.jsonl` | Complete chronological conversations and provenance, one per source note |
| `decisions-train.jsonl`, `decisions-validation.jsonl` | Two supervised targets per trace: decision before the result, update after the result |
| `sources.jsonl` | All 66 original curated observations, unchanged |
| `TRACE_WRITEUP.md` | Illustrated human-readable reconstructions |
| `assets/` | Referenced opening frames and human captures, bundled for offline use |
| `evidence/*.transitions.jsonl.gz` | 6,732 actual before/action/after transitions from replaying recorded winning moves |
| `evidence/replay-verification.json` | Builds, code hashes, run GUIDs and checks: 25 wins, 183 levels cleared |
| `validation-report.json`, `manifest.json` | Coverage, checks performed and checksums for every bundled artifact |

Every note now has a complete reconstruction, including notes that originally recorded only
an impression or a difficulty. There are 132 trainable decisions in the 66 conversations.
See the validation report for exact split sizes and game membership.

## Read one trace

For Skewer Kebabs level 7, the targets are blue–green–blue and red–green–red, but the board
contains only one green bead. The reconstructed hypothesis is that the green can count for
both rods at their intersection. The action is to arrange the two ordered sequences around
that crossing. The result follows the actual goal check, which examines each rod separately.
The independent winning replay clears on its 53rd action, ACTION4.

This captures a specific inference and solution. Other traces reconstruct discovering
off-screen space, testing a previously useless control on a new level, moving a completed
piece out of the way, exploiting reset or undo, and revising a failed interpretation.

## Training format

Each episode has:

- `messages`: system, initial situation, assistant decision, result, assistant update.
  The first assistant response includes a hypothesis, action and expected result. The final
  response explains the revision and next move.
- `trace`: the same seven stages as named fields for custom loaders.
- `provenance`: original source ID/hash, human credit, reconstruction author, and whether
  action/expectation were expanded from a recorded field or inferred.
- `sourceLevel`: the level originally recorded, which can be null.
- `scenarioLevel`: the concrete worked-example level chosen for the reconstruction.
  Game-wide notes retain their original scope while gaining a concrete example.
- `evidence`: relevant screenshot paths, rules with source citations and a separately
  verified demonstration of the same level.

The narrative is **synthetic**, including plausible missing thoughts and actions. Original
human fields remain intact in `sources.jsonl`. `outcomeBasis` distinguishes a reported
human outcome from a consequence reconstructed using game mechanics. Screenshots can support
layout or an intermediate state; they are not automatically matched to a specific action.

## Using it

**Supervised reasoning:** train on `messages`, masking user messages. Alternatively load the
decision files as `prompt` / `response`. They contain the correct chronological prefix:
the first decision never receives its future result. Keep metadata, reference rules and the
full trace out of that initial policy prompt.

**Gameplay demonstrations / offline training:** unzip each transition stream with gzip.
Each row supplies `before` and `after` as 64×64 color grids, the actual action ID and click
coordinates where applicable, state, and levels completed before and after. Groups are
identified by game, build, level and action index. A clear is an observed event, not a
preassigned official ARC score. Use your trainer's reward definition when converting events
to rewards. Winning replay data is limited behavioral coverage; it is not an online RL run.

**RL initialization:** use the reconstructed traces as reasoning demonstrations, then collect
policy rollouts in the environment. The prose actions may describe several inputs; they are
not machine actions. Use the transition files for exact executable inputs. No arbitrary
judge score is substituted for game success.

The engine demonstrations use the OY Labs OY1 public scorecard
[75d9c8e7-ade9-4a8f-a747-6acbea51bb1b](https://arcprize.org/scorecards/75d9c8e7-ade9-4a8f-a747-6acbea51bb1b).
Only its recorded moves and provenance are used. The model's original shorthand is excluded
from this training package, respecting the project's existing instruction.

## Splits

Whole games stay together across notes, conversations and decisions. SHA-256 of
`arc3-human-reasoning-v1:<gameId>`, first eight hex digits modulo five, assigns zero to
validation. A game's replay file must follow that same split when used in training; the
shared evidence folder contains both partitions. Otherwise demonstrations can leak validation
game solutions into training.

These are public tutorial games. This small holdout checks corpus-level development and does
not establish performance on unseen private games. Withdrawn as66 is excluded.

## Rebuild and check

From the arc-explainer repository root, with its existing Node dependencies and Python
environment containing arcengine, NumPy and Pillow:

```sh
python3 scripts/arc3/verify_reasoning_replays.py
node --import tsx scripts/arc3/export_human_reasoning.ts
npm exec -- vitest run tests/unit/arc3HumanReasoningDataset.test.ts
```

The first command replays all 25 games and writes scratch evidence under `evidence/`.
The second checks the live Markdown against the registry, checks annotations against their
source hashes, verifies game-code hashes and every replay chain, and bundles the release.
Scratch evidence is ignored; `release/` is committed so other assistants can inspect it.
Game code is not bundled. Each report identifies the installed arcengine version.

When source material changes, review and update the reconstruction before refreshing its
source hash. Correct prose in `annotations.json`, not the generated JSONL or write-up.

## Attribution

Human material: Mark Barney / ARC Explainer. Synthetic reconstruction: GPT-6 (Codex).
Winning action demonstrations: OY Labs, OY1 AGI public scorecard, using gpt-6-astra.
Game environments and visual assets retain their existing ownership and licensing.
The user requested this GitHub handoff; no Hugging Face publication or model training run
has been performed.
