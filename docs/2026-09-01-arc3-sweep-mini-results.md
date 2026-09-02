<!--
Author: Claude Opus 5
Date: 01-September-2026
PURPOSE: What the Mac Mini produced on the first night of the ARC-3 hypothesis sweep, what was
         verified rather than assumed, and the two harness findings that came out of running it
         on a second machine. The experiment's design and reasoning live in
         2026-09-01-arc3-hypothesis-sweep-plan.md; the operating steps in
         2026-09-01-arc3-sweep-mini-runbook.md. This file is results and caveats only.
SRP/DRY check: Pass — neither existing doc records outcomes, and the measured numbers here are
         not repeated from either.
-->

# Mini results — night of 01-Sep-2026

**Both plans ran, not one.** The runbook assigns the Mini `breadth` alone on a two-hour budget.
That budget did not hold: the Mini runs roughly 7x faster than the Katana's reference rate
(median 42 s per thinking-off run against ~292 s), so `breadth` finished in about 23 minutes and
`confound` followed it. The Mini's `confound` is therefore a cross-machine replication of the
Katana's, not a duplicate of its own work.

Host `mini.local`, `qwen/qwen3.8-27b` 4bit, ctx 262144, arch `qwen3_5`, LM Studio on port 1234.

## What came out

60 rows in `hypotheses_mini.local.jsonl`. Not 64: the `confound` game `t088853a8` is one of the
`breadth` eight at an identical cell, so resume reused those four replicates rather than
repeating them. That game now carries all eight replicates at `effort=none, temp=1.0`.

| cell | n | parsed 5/5 | truncated | empty | collapse | median s |
|---|---|---|---|---|---|---|
| `none` t=1.0 (8 games) | 32 | 32 | 0 | 0 | 0 | 41 |
| `none` t=0.7 | 8 | 8 | 0 | 0 | 0 | 39 |
| `none` t=1.0 (confound game) | 8 | 8 | 0 | 0 | 0 | 43 |
| `medium` t=0.7 | 8 | 8 | 0 | 0 | 0 | 81 |
| `medium` t=1.0 | 8 | 8 | 0 | 0 | 0 | 86 |

**Zero collapses in 60 runs.** The glossolalia that started this experiment did not reproduce
once — not at either temperature, not with thinking on or off. Read as a rate this is 0/60, and
it is the single most important number here.

**It is a hint, not a measurement, and it is not yet a finding.** The report's `collapse?`
column is a crude heuristic, so two answers were hand-read (thinking on and off, both at
temp 1.0): both are coherent, well-structured five-hypothesis responses. That confirms the
heuristic did not miss anything in the samples checked — it does not license citing 0/60 as a
rate until more of the corpus is labelled by hand. The `distinct` column equals the label count
in every cell, meaning it saturated and discriminates nothing at this n.

Nothing hit a token ceiling: `medium` runs spanned 788–1468 completion tokens against a 3500
cap, `none` runs a median 547 against 1500. Every one of the 60 stopped naturally. The empty-content
failure mode the runbook warns about did not occur.

## Verified rather than assumed

- **One `frame_sha` per game** across every replicate, so all runs of a game saw one picture.
- **Engine revision** recorded on every row as `653c3ee+dirty`. The Mini sits on exactly the
  commit the repository records; the `+dirty` is untracked `environment_files/` inside the
  submodule, not modified rendering code. The Katana's rows will read `e243421`, so a pooled
  report may flag a mismatch — **the frame hashes settle it, not the revision strings.** If a
  shared game hashes identically on both hosts the stimulus was the same picture.
- **One system-prompt hash and one user-prompt hash** across all 60 rows.

## Two harness findings

**1. The calibration gate could not see the thinking it was checking for.** Fixed in `172a272`.
`--calibrate` probed with `max_tokens=1`, and a model given one token cannot open a think block,
so `reasoning_content` returns empty however hard the server was told to think. The check
measured the budget, not the lever. It passed on the Katana only because that build reports
`reasoning_content` even at one token; here every level — `none`, `low`, `medium`, `high`,
`xhigh` — measured empty, and `--plan confound` was refused on an axis a real generation proves
works. Probes now run at 48 tokens. The companion "THINKING NOT DISABLED" check was vacuous for
the same reason and now works too.

**2. The effort lever on this build, measured.** All seven values are accepted:

| level | prompt tokens | thinking |
|---|---|---|
| `none` | 92 | off |
| `medium` | 90 | on, injects no text |
| unset / `minimal` / `low` / `high` / `xhigh` | 116 | on, injects instruction text |

This independently confirms on a second machine the plan's central design choice: `medium` is
the only thinking-on level that adds no words to the system prompt, so `none` vs `medium` is the
only comparison that does not cross a thinking switch with a prompt edit. `low` and `xhigh` both
would.

## Concurrency — settled, and it is worth having

Open in both the plan and the runbook, measured here on an idle box, 3 requests, 250 tokens each:

```
serial      3 runs:  59.0s   747 tok  12.66 tok/s
concurrent  3 runs:  33.5s   747 tok  22.31 tok/s   -> 1.76x wall
```

The Katana got 18% from the same experiment because its GPU was saturated at 7.7 of 8.1 GB. The
Mini's shared memory does not have that ceiling. **A future night on this box should run parallel
and can carry roughly 75% more samples.** The runner is serial; this was measured outside it and
the runner was not changed, because changing scheduling mid-experiment would make tonight's rows
incomparable with the Katana's.

## What is still open

- **The pooled comparison.** The interesting question — does the Katana's `confound` agree with
  the Mini's — needs both files in one report and has not been run. Point
  `hypothesis_report.py` at `data/arc3-hypothesis-sweep/*.jsonl`.
- **Hand-labelling.** 0/60 collapse is a heuristic count with two answers spot-checked. Before
  that number is cited anywhere, label the corpus.
- **Cross-model.** Both machines ran `qwen3.8-27b`. The cross-lab arm the runbook wants still
  has not happened.
