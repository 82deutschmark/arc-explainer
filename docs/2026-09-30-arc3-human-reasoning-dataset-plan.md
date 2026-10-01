<!--
Author: GPT-6 (Codex)
Date: 2026-09-30
PURPOSE: Approved scope and completion record for reconstructing Mark's ARC-3 play reasoning,
         validating game evidence, publishing the dataset and referencing it from the arena.
SRP/DRY check: Pass — canonical observations, reviewed reconstructions and executed replay
         evidence each have one source; generated artifacts are shipped for assistant review.
-->

# ARC-3 complete human reasoning dataset

## Approved scope

Mark requested complete synthetic traces, explicitly authorizing missing actions and
expectations to be inferred using screenshots, game investigation and existing resources.
He also requested commit/push and a reference in autoresearch-arena.

Reconstruct every source note as: situation, hypothesis, action, expected result, result,
revised understanding and next move. Preserve the original observations for attribution.
Use specific mechanics and concrete worked examples, including failed assumptions and
recovery. Keep reconstruction distinct from the exact human recording.

## Completed work

- All 66 notes from the 25 public game pages have complete reconstructions.
- Inspected opening frames, human captures and the later-level frames used by the scenarios.
- Read current-build mechanics and focused engine source for ambiguous behavior.
- Re-executed the stored OY Labs winning moves: 25 games won, 183 levels cleared, 6,732 actions.
  Retained actual 64×64 before/after frames, action IDs and click coordinates. Excluded the
  original model shorthand from training.
- Packaged 44 training and 22 validation trajectories, with 88 and 44 decision targets.
  Whole games remain in one partition.
- Bundled 78 screenshots, original source records, code/source hashes and replay evidence.
- Before-outcome decisions receive only the prior situation and available input IDs.
  Outcomes enter later in the conversation, before the belief update.
- Every trace names an independently verified demonstration of its scenario level.
  Prose actions may span several inputs; they are not asserted to match a human frame exactly.

## Concrete improvements

- Skewer Kebabs level 7: the single green bead counts for both rods at their intersection;
  the verified last move is ACTION4, action 53.
- Skewer Kebabs level 8: the short pink rail cannot retrieve the low green; purple provides
  access, and final reference prefixes differ from temporary useful attachments.
- Leapfrog level 1: five pegs require four captures. Mark's tentative three-action estimate
  becomes a hypothesis corrected by the rules rather than an unsupported training label.
- Sucking Up: the lander-like creature reduces and ejects a block; it does not produce two
  daughter blocks. The reconstruction makes the player's shorthand precise.
- Warehouse Associates level 9: the constraint is the counted 70-action budget, including
  grabs/releases, not elapsed wall-clock time.

## Implementation

- `shared/arc3Games` and `buildArc3GameDatasetBundle()`: unchanged source authority.
- `data/arc3-human-reasoning/annotations.json`: 66 reviewed authored reconstructions.
- `scripts/arc3/human_reasoning_dataset.ts`: validates coverage/provenance and constructs
  chronological training conversations.
- `scripts/arc3/verify_reasoning_replays.py`: executes recorded moves with the actual engine.
- `scripts/arc3/export_human_reasoning.ts`: validates and packages the committed release.
- `data/arc3-human-reasoning/release/`: the readable write-up, datasets, images and evidence.

## Verification

Ten focused tests pass on the real registry and replay reports, including corruption
checks for missing/stale/duplicate traces, wrong builds, failed demonstrations and leaked
agent shorthand. Strict TypeScript checks of both new scripts pass. The exporter verifies
every replay checksum, game source hash, frame shape, sequential frame chain and clear event.
The live Markdown export matches the local canonical renderer.

The repository-wide TypeScript check previously reported 12 diagnostics outside these files;
the scoped check is the validation for this change. No training job was launched.

## Publication and handoff

Publish the scoped changes on `codex/arc3-human-reasoning-traces` based on origin/main.
The initial checkout has rewritten history relative to origin/main, but their source trees
match except for .env.example. The user requested a full reclone. A fresh remote clone at arc-explainer-reclone-20260930
receives only the scoped dataset files on top of rewritten main; the existing checkout
and other assistants' edits stay intact.
Reference the exact published commit from autoresearch-arena's ARC-3 README and training
handoff document. That reference describes how to load this data; it does not claim an
automatic trainer integration or a private-game performance result.
