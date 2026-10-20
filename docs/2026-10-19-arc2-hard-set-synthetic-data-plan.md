<!--
Author: Claude Fable 5.1 High
Date: 19-October-2026
PURPOSE: Plan for Claude Opus 5.5 to build the synthetic ARC-AGI-2 training set modelled on the
  hard set (the public-eval puzzles no logged attempt has solved, or only one or two have). Says what
  to build, where, how it is verified, how it is measured, and what must not happen (eval leakage,
  one-experiment-a-day cadence, generating from notes that are not solvers). Companion pages:
  /arc2/hard-set (the puzzles, every recorded attempt, the plain-language notes) and
  /arc2/hard-set/findings (why they are hard). Notes live in shared/arc2HardSet.ts.
  20-Oct-2026, Claude Opus 5.5 Medium: section 7 added for the Boss-approved change (build by
  difficulty tier, separate sets per tier, score only on a never-copied holdout) and the holdout chosen.
SRP/DRY check: Pass - points at the pages, the notes file and the team repos instead of copying them.
-->

# Synthetic ARC-AGI-2 data from the hard set: plan for Opus 5.5 (19-Oct-2026)

**Status: plan, awaiting the Boss's approval. Nothing generated yet.**

## 0. The ask in one paragraph

The Boss's role on the merged Kaggle team is puzzle creation (see `~/GitHub/arc-2/README.md`, "Roles").
Jack Cole's post-training line consumes task data (continued pretraining, the NVARC v2 RFT and hint
pools, LoRA experiments on the 27B); Son Pham runs inference. This plan produces a synthetic task set,
in ARC task JSON, modelled on the eighteen hardest public-eval puzzles, for training, reinforcement
learning and post-training of our ARC-AGI-2 entry. Final Kaggle deadline 2-Nov-2026, so the loop has
about two weeks; it must run many experiments a day, not one.

## 1. Inputs

- **The hard set.** `GET /api/arc2/hard-set` on arc.markbarney.net, rendered at `/arc2/hard-set`.
  Today: six puzzles never solved, four solved once, eight solved twice, out of every scored record in
  the database (our runs plus the Hugging Face ingests of the ARC Prize team's official harness, every
  published model folder including Claude Opus 4.8, GPT-5.4 Pro and Gemini 3 Deep Think). The official
  dataset was last updated 4-Jun-2026; our ingest ran 17-Jun; the leaderboard site publishes no
  per-puzzle results beyond it. Membership is computed from the database, so re-check the page before
  starting: it moves when results are ingested.
- **The puzzle files.** `~/GitHub/arc-explainer/data/evaluation2/<id>.json`.
- **The recorded attempts.** The browser on each hard-set row; the frontier failures are the evidence
  for which traps to build.
- **The notes.** `shared/arc2HardSet.ts`: eighteen plain-language solve notes written by Dr. Fable 5.1
  with the answers open, each tagged `checked` (a rule was coded and reproduces every pair), `read`
  (worked out by eye), or `partial` (could not be pinned down). **Only `checked` notes are specs.**
  `read` notes are hypotheses to verify before use. `partial` notes are descriptions of confusion and
  must not drive a generator.
- **Findings.** `/arc2/hard-set/findings`: the five failure shapes and the six families they imply.

## 2. What to build

A Python package of task generators, one per family, each paired with a verifier, producing ARC
task JSON (`{"train": [...], "test": [...]}`) plus a manifest. Proposed home: the team's own repo,
`sonpham-org/autoresearch-arena`, folder `arc2/synth_hardset/` (next to the existing `arc2/replay/`
and notebook builders). Generated data goes on the SSD: `/Volumes/Samsung 9100 SSD/kaggle/arc2-synth/`
(Boss directive, 2-Oct-2026: nothing that can grow past a few GB lives on the internal drive; if the
SSD is not mounted, stop and say so).

### 2.1 Families, in priority order

| # | Family | Modelled on | Note status | Trap to build in |
|---|---|---|---|---|
| 1 | Marble maze: marbles slide per a corner arrow sign, stop at walls | 88e364bc | checked | corner-squeeze rule on in half the tasks, off in the other half; the examples must disambiguate |
| 2 | Torn picture: one hidden master, each example a piece, answer the whole in the fitting orientation | 269e22fb | checked | pieces placed as-is vs flipped; piece sizes that fit in more than one place unless all examples are read |
| 3 | Onion rooms: walls make rooms, dots set ring colours by depth, colours repeat | 13e47133 | checked | depth lists where "clamp" and "repeat" differ only on the second pair |
| 4 | Fill the chain: markers at line ends, hollow shapes linked to the line get filled | 8b7bacbf | partial on corner-touch | decoy shapes placed where a left/right-half guess fails; **ship only once a solver reproduces all six real pairs** |
| 5 | Spiral and corridor fills: trivial rule, long exact drawing | da515329, 9bbf930d | read | grids to 30x30; marble turn rules verified against the real puzzle first |
| 6 | Leaky boxes: framed boxes leak their colour through frame holes to the edge | e12f9a14 | read | side holes straight, corner holes diagonal; rays crossing other boxes |
| 7 | Repair the lines; Jigsaw | 7b80bb43, 446ef5d2 | read | crossings that stay open; pieces that fit two ways unless the frame is used |
| 8 | Legend families (arrow signs, one-to-one colour keys) | 88e364bc sign, abc82100 | checked only for the sign | keep to mappings that can be verified; the colour-key puzzle itself is **waiting list** |
| — | Waiting list, no generator yet | abc82100, 5545f144, d35bdbdc, 88bcf3b4, a32d8b75, 21897d95, faa9f03d, 2b83f449, 195c6913 | partial / read | each needs a solver that reproduces the real puzzle before any task is generated |

### 2.2 Generator contract (every family)

- `generate(seed, params) -> task` and `solve(task) -> outputs`; `verify(task)` asserts
  `solve(task.train[i].input) == task.train[i].output` for every pair and for every test pair.
- Params expose the difficulty dials: grid size, colour count, object count, trap on/off, number of
  train pairs (two to five, like the real set), number of test pairs (one to three).
- Before a family is enabled, its `solve()` is run on the real puzzle it is modelled on and must
  reproduce every train and test pair. That is the gate. The three `checked` rules were already
  reproduced this way in a scratch script on 19-Oct; port them, do not re-derive.
- A reference check in the manifest: family, seed, params, solver version, the real puzzle id it is
  modelled on.

### 2.3 Volume and shape

- First cut: a few thousand tasks per family across the dials, enough to see a signal in a day, not a
  corpus. Scale a family only after it moves the ruler (section 4).
- Augmentation (D4 geometry, simultaneous bijective colour permutations, pair reordering) is applied
  **after** generation and only with a true permutation. Jack documented the NVARC corpus's in-place
  colour-mapping bug (`jcole75/arc2026`, `color_permutation_bug.md`); reuse his clean augmenter
  rather than writing another.
- Output format: ARC task JSON per task, plus a flat JSONL with the row shape Jack's rebuilt corpus
  uses, so the set drops straight into his pipeline. Ask Jack for the row schema; do not guess it.

## 3. What must not happen

- **No eval leakage.** The 120 public-eval tasks (`data/evaluation2/`) are also eval120 and Jack's
  30-task holdout basis. Hash every eval task's pairs; reject any generated task whose input or
  output grid matches an eval grid, and reject near-copies (same shape set, same colour multiset).
  The eighteen hard-set puzzles are never trained on; they are the hard test.
- **No generating from `partial` notes.** If the solver does not reproduce the real puzzle, the family
  waits. A plausible-looking generator that encodes a wrong rule trains the wrong thing.
- **No one-a-day cadence.** No pre-registered pass marks on tiny rulers, no idle GPUs with an empty
  queue, no single-seed closes. The direction of 18-Oct (`autoresearch-arena/datacomps/
  DIRECTION-2026-10-18-outside-read.md`) applies in full.
- **No numbers invented for the write-ups.** Report what the ruler measured, with seeds.

## 4. The ruler and the loop

- **Superseded on 20-Oct-2026 for decisions: see section 7.** Decisions are scored on the holdout;
  the split below stays as a record.
- **One honest ruler, written once:** solve rate on the public eval set split into (a) the eighteen
  hard-set puzzles (never trained on) and (b) the other 102, scored with the official two-attempt
  union rule (`arc-agi-benchmarking` scoring; this repo's `/scoring` page explains it). (a) is the
  signal we want; (b) guards against regression.
- **Three seeds** per configuration before a family is kept or dropped. Report mean and spread.
- **Many a day:** the generators are cheap, so the GPU queue should never be empty. Fine-tune runs
  on the 4B grid model first (it is the NVARC backbone and cheap), then whatever Jack's line can
  take. RL: the verifier is the reward (exact match), so each family is also an RFT pool.
- **Copy the best public work the same day:** Jack's rebuilt corpus and his symbolic/code-bred
  offspring tasks are the closest prior art; read `docs/RESULTS_2026_WRITEUP.md` in his repo before
  designing anything that overlaps.

## 5. Deliverables

1. `arc2/synth_hardset/` with the generator package, verifiers, manifest writer and the leakage
   check, each file carrying the standard header and credited to the model and effort that wrote it.
2. The generated sets on the SSD, with manifests, and a private Hugging Face dataset if Jack wants
   to pull from there.
3. A results note in the team repo: per family, per seed, the ruler's two numbers, and a decision
   (keep, scale, drop) for each family. Updated as experiments land, not once at the end.
4. A short update to `/arc2/hard-set/findings` if the experiments contradict any of the findings.

## 6. Open questions for the Boss

- Where the generator package lives: the team repo (`sonpham-org/autoresearch-arena`, proposed) or
  Jack's repo. The data location on the SSD is not in question.
- Whether Jack wants the JSONL row format or plain task JSON; the plan assumes both.

## 7. Tiers and the scoring holdout (approved 20-Oct-2026)

Source: Bubba's hand-off note `~/bubba-workspace/docs/2026-10-20-arc2-tiered-synthetic-datasets.md`.
The Boss approved Jack Cole's recommendation in #arc-2 at 09:52 ET on 20-Oct-2026.

- **Every tier, not only never-solved.** Jack's report tiers every eval test output by how often his
  27B and Flash-Next runs solve it: never, rare, sometimes, usually, always
  (`jcole75/arc2026` `docs/experiments/unsolved_puzzles_20261019.md`, pipeline `scripts/unsolved_atlas/`).
  New families are drawn from all tiers.
- **One set per tier**, so training mixes tiers on purpose, weighted toward rare and sometimes.
  The eleven families built so far come from never-solved puzzles, so they form the "never" tier.
- **Training-set tiers need re-runs.** Nearly every ARC-2 training task in Jack's report was run one
  to three times, so its "never" label there is thin. Re-run those before treating them as hard.
- **Shared code base.** The Boss chose Jack's `arc2026` as the shared code and research base
  (consolidation in jcole75/arc2026 pull request 1, under review). The generator package moves there
  once that lands; until then it stays in `autoresearch-arena/arc2/synth_hardset/`.

**The scoring holdout.** It contains 28 eval tasks. Decisions are scored only on these. No family may
copy them or be modelled on them.

It starts from Jack's holdout30 (`jcole75/arc2026` `data/arc2_holdout30_task_ids.json`). Exposure was
checked on 20-Oct-2026:

- Two of the thirty had already been modelled: jigsaw (446ef5d2) and marble corridors (9bbf930d).
  Both are dropped, which leaves 28.
- Five waiting-list puzzles fall inside the holdout: e12f9a14, abc82100, d35bdbdc, 88bcf3b4 and
  16b78196. They are frozen and will never get a generator.
- `build.py` refuses any family modelled on a holdout task.
- **Base model.** Our 4B base is Sorokin's original NVARC checkpoint, which trained on public eval,
  holdout included. Arms still compare fairly on the same base. A clean holdout reading needs Jack's
  93k checkpoint, which never trained on holdout30.

The 28 task ids:

16b78196, 16de56c4, 221dfab4, 247ef758, 2d0172a1, 332f06d7, 36a08778, 3dc255db, 409aa875, 4a21e3da,
4c416de3, 53fb4810, 581f7754, 62593bfd, 7666fa5d, 78332cb0, 7b0280bc, 7b3084d4, 88bcf3b4, 8f215267,
9385bd28, abc82100, b6f77b65, c7f57c3e, d35bdbdc, dd6b8c4b, e12f9a14, f560132c.

The same list is `HOLDOUT` in `arc2/synth_hardset/families/__init__.py`. The ruler reports it as
holdout28, and past runs were rescored from their saved per-task scores.

**Ruler, restated (Fable, 20-Oct).** Score only on holdout28, two-attempt union, three seeds per arm, and
report two numbers: the whole holdout, and its hard five (16b78196, 88bcf3b4, abc82100, d35bdbdc,
e12f9a14, the holdout tasks that are also in the hard 18 or Jack's atlas extras). The other 92 public-eval
tasks are watched for regression only; families are modelled on some of them, so they are not the ruler.
The leakage check keeps rejecting matches against all 120. Tier datasets live beside the `hs_v*` sets on
the SSD, one folder per tier with its own manifest and leakage report. Fable's independent exposure check
on 20-Oct reached the same 28-task holdout from the generator manifests, so the two readings agree.
