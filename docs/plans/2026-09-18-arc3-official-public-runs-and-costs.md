<!--
Author: Claude Opus 5
Date: 2026-09-18
PURPOSE: What ARC Prize's own model runs on the 25 public ARC-AGI-3 games cost (ARC publishes
         Semi-Private costs only), rebuilt from the token usage in ARC's public recordings with
         ARC's own published method; plus what those 799 runs add to our training data, and a
         readable digest of Claude Opus 5's level clears. Backend note for Boss and the
         training pipeline (Bubba); nothing here is shown on the site.
SRP/DRY check: Pass -- reports numbers written by scripts/arc3/pull_official_public_runs.py and
         scripts/arc3/official_run_costs.py; method details live in those scripts' headers.
-->

# ARC's own runs on the public games: what they cost, and the data they give us

> **Do not train on Astra (Boss, 18-Sep-2026).** gpt-6-astra's text is its own shorthand, unreadable to humans. Every Astra record carries `source.doNotTrain: true`; filter those out. Keep them for costs and moves only.

**Status 18-Sep-2026: all 799 public-set runs from ARC's results pages pulled and checked.
Backend only.**

## The short answer

ARC publishes what each model costs on the hidden Semi-Private set (55 games). It does not
publish the public set (25 games). But every public run's recording logs the tokens used on
every move, and ARC's own harness docs say how its published costs are made from those tokens.
So we rebuilt it.

**GPT-6 Astra on the 25 public games:**

| Setup | Games won | ARC's method | What OpenAI would bill | ARC's Semi-Private cost (55 games) |
| --- | --- | --- | --- | --- |
| Provider Adapter, max | 25 | $8,173 | $4,621 | $17,332 |
| Provider Adapter, xhigh | 25 | $8,652 | $4,812 | $18,147 |
| Provider Adapter, high (the 99.9% run) | 25 | $9,053 | $5,033 | $18,817 |
| Provider Adapter, medium | 25 | $9,166 | $5,108 | $19,285 |
| Provider Adapter, low | 25 | $9,952 | $5,561 | $21,298 |
| Provider Adapter, none | 24 | $10,886 | $6,126 | $23,457 |
| Standard, max | 12 | $16,318 | $13,942 | $26,098 |
| Standard, xhigh | 10 | $23,392 | $19,629 | $37,317 |
| Standard, high | 11 | $20,415 | $17,252 | $40,705 |
| Standard, medium | 10 | $26,384 | $22,395 | $48,090 |
| Standard, low | 4 | $30,117 | $26,208 | $38,166 |
| Standard, none | 10 | $29,771 | $25,621 | $49,791 |
| **All 12 setups, 300 runs** | | **$202,278** | **$156,308** | **$358,503** |

- **ARC's method** is the number to compare with ARC's published costs.
- **What OpenAI would bill** is lower because OpenAI charges cached input at $1 per million
  instead of $10. It could be up to $193,380 for all 12 if every new input token were also
  charged as a cache write ($12.50), which the logs can't tell us.
- The Standard harness costs 2-3 times as much because only 14-18% of its input is reused from
  cache (the Provider Adapter reuses about 50%), and the games it fails run long.

## How it was rebuilt

1. **Tokens.** Every move in ARC's public recordings carries `usage`: input tokens, cached
   input tokens, output tokens, reasoning tokens. The recording's own `cost` field is always
   zero. ARC's harness adds any conversation-compaction call into the next move's usage, so
   adding up the moves counts every model call once.
2. **ARC's method.** ARC's harness repo (`arcprize/arc-agi-3-benchmarking`,
   `docs/runtime-state.md`): "Published v3 costs are reconstructed downstream from ARC-facing
   action token usage and configured input/output prices." The code
   (`runtime_models.action_metadata_from_model_response`) prices a move as input tokens x input
   price + output tokens x output price. So there's no cached-input discount and no
   long-context surcharge.
3. **Prices.** GPT-6 Astra: $10 input, $1 cached input, $12.50 cache write, $50 output per
   million tokens; requests over 272K input tokens cost 2x input and 1.5x output. That's from
   OpenAI's model page, and OpenRouter's live price list says the same. Checked 18-Sep-2026.

**The check that it's right.** The Semi-Private set has 55 games, the public set 25
(ARC-AGI-3 technical report, Table 1), so the Semi-Private set is 2.2x bigger. The Provider
Adapter wins nearly every game on both sets, so its cost should scale with game count. Using
ARC's method, Semi-Private / public comes out at **2.08 to 2.15 for all six effort levels**.
So a hidden game costs about what a public one does ($342 vs $362 at high), which is what
you'd expect if we're pricing it the way ARC does. The Standard harness ratios vary more (1.27
to 1.99) because it fails different games on each set, and a failed game runs to the move cap.

## Every other model ARC ran on the public games

Same method, prices from OpenRouter's live list on 18-Sep-2026.

| Model (ARC config) | Games won | Levels | ARC's method | ARC's Semi-Private cost |
| --- | --- | --- | --- | --- |
| Claude Opus 5, high | 6 | 95/183 | $8,406 | $20,657 |
| Grok 4.6, xhigh | 0 | 25/183 | $2,478 | $5,612 |
| Grok 4.5, high | 0 | 7/183 | $2,848 | $6,893 |
| GPT-5.6 Sol, max | 1 | 48/183 | $3,705 | $25,064 |
| GPT-5.6 Terra, max (24 games; ARC's page is missing one link) | 0 | 15/176 | $2,516 | $7,918 |
| GPT-5.6 Luna, max | 0 | 0/183 | $155 | $3,189 |

All efforts are in `data/arc3-official-runs/costs.json`. Opus 5 logged no cached input at all,
so for Opus the bill and ARC's method are the same.

**Only trust the first three rows' dollar figures.** For Opus 5 and both Groks, Semi-Private
is about 2.3-2.5x our public figure, which fits a set 2.2x bigger. For GPT-5.6 Sol (about 6x)
and Luna (about 20x) it doesn't fit, so ARC must have priced those two differently from
today's OpenRouter list. Their token counts are solid; their dollar figures here are not.

## For comparison: the external run we pulled this morning

`data/arc3-agent-runs/` holds an outside gpt-6-astra (high) harness that won all 25 public
games in 6,732 moves for $415 (its own ledger, billed prices). ARC's Provider Adapter at high
won the same 25 games in 7,085 moves for **about $5,033 billed ($9,053 by ARC's method)**. So
on the same games it was about 12x cheaper. The difference is how much it sends each move:
about 23K tokens a move against ARC's 127K.

## What it adds to the training data

`data/arc3-official-runs/levels-won.jsonl.gz` holds every level that any of the 799 runs
cleared, with the model's own text for each move. That's 2,149 levels in total.

| Model | Levels cleared | Moves | Text |
| --- | --- | --- | --- |
| GPT-6 Astra (12 setups) | 1,837 | 83,422 | 9.4M characters |
| GPT-5.6 Sol | 135 | 6,701 | 0.8M |
| Claude Opus 5 | 95 | 4,683 | 5.8M |
| GPT-5.6 Terra | 37 | 2,172 | 0.3M |
| Grok 4.6 | 25 | 1,091 | 0.5M |
| Grok 4.5 | 19 | 718 | 0.7M |
| GPT-5.6 Luna | 1 | 31 | - |

What the text is:

- **Standard harness runs:** the model's reply every move, written as notes it carries forward.
- **Provider Adapter runs:** mostly bare actions, plus OpenAI reasoning summaries on some moves.
- **Claude Opus 5:** the richest per move. Every move carries a "Context notes (carry forward)"
  block with the controls it has worked out, its goal guess, progress, and what it expects the
  next press to do. Readable digest, the note on each move that cleared a level:
  [`docs/arc3-official-runs/anthropic-claude-opus-5-high-level-clears.md`](../arc3-official-runs/anthropic-claude-opus-5-high-level-clears.md).

Record shape matches `data/arc3-agent-runs/`: one record per cleared level, with `steps` as
(note, moves) in play order, plus `source` (model, config, harness, effort, card id). Every run
is on our live build of its game.

## Checks and limits

- All 799 runs: per-level move counts rebuilt from the recording match ARC's own card. No
  errors, no mismatches, every build is our live build.
- 1,611 of 269,439 moves (0.6%) have no usage logged. In every run that's no more than the
  number of resets, so they're consistent with resets that never called the model. No paid
  move is missing from the costs.
- Cache writes aren't in the logs, so the bill is a range (see above).
- ARC's configured price for Astra is assumed to be the list price. The 2.1x check above
  supports that.

## Re-running

```bash
python scripts/arc3/pull_official_public_runs.py            # every ARC-AGI-3 model; skips cached runs
python scripts/arc3/official_run_costs.py                    # prices -> data/arc3-official-runs/costs.json
python scripts/arc3/digest_official_reasoning.py <config>    # readable level-clear notes for one config
```

The per-run cache (73 MB, gitignored) is at `data/arc3-official-runs/cache/`. The pull streams
the recordings and throws the frames away, so the ~30 GB of recordings never touch the disk.
