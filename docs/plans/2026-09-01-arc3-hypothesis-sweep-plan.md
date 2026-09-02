<!--
Author: Claude Opus 5
Date: 01-September-2026
PURPOSE: Plan and cold-start handoff for feeding our own synthetic ARC-3 game frames to a local
         vision model under varied sampler settings, to measure how the model's hypotheses about
         unknown game rules change with decoding parameters. Written to be executed on either the
         MSI Katana (Windows, RTX 5070 8GB) or the Mac Mini, by an assistant with no memory of the
         session that produced it. Every measured number below was measured on the Katana on
         01-Sep-2026, not estimated.
SRP/DRY check: Pass — no existing doc covers this. Frame rendering reuses
         server/python/community_game_thumbnail.py unchanged; harness conventions are lifted from
         C:\Projects\G0DM0D3-research/research/run_prompt.py rather than reinvented.
-->

# ARC-3 hypothesis sweep — feeding our own games to a local model

## The question

We have 50 synthetic ARC-3 games nobody outside this project has seen. A model shown one opening
frame, and asked only to hypothesise about the rules, produces a description. **How much of that
description is the game, and how much is the sampler?**

This is not a benchmark. Nothing is scored against ground truth. The output of interest is the
*spread* of hypotheses across repeated samples of the same image, and how that spread moves with
temperature, `top_k`, and thinking mode.

## What started this, and the correction that reframes it

Two LM Studio conversations on 01-Sep, both `qwen/qwen3.8-27b`, both the same system prompt
(*"You are an expert in the ARC AGI prize and the ARC 3 Challenge. Your task is to hypothesize
about what the rules and mechanics of unknown games are."*), both a screenshot of one of our games:

| | Conversation A | Conversation B |
|---|---|---|
| Temperature | 0.98 | 1.0 |
| `top_k` / `top_p` / `min_p` | 500 / 1.0 / 0 | 500 / 1.0 / 0 |
| Repeat penalty | off | 1.0 (neutral) |
| Thinking | disabled | enabled |
| Result | **Glossolalia** — pseudo-mathematical word salad, `H≈MathOx(hd8±₁^η ζᵥ)` | **Excellent** — a coherent element-by-element read, and a correct instinct that `UNDO (z)` implies discrete undoable moves |

The obvious reading is "thinking mode fixed it." **That reading is wrong, or at least unproven.**

Conversation A has a *second* assistant turn. The user typed "Try again", nothing else was changed,
and the model produced a well-structured ten-hypothesis answer — at temperature 0.98 with thinking
**disabled**. Its recorded config is in the file (`genInfo`, second step) and matches the chat's
config block.

So the same cell produced both the glossolalia and a good answer. The collapse is a **low-probability
failure mode at that cell, not a property of it.**

One honest caveat: the glossolalia turn carries no `genInfo` block, so its settings were never
recorded. It is *probable* it ran at the chat's configured values, not certain. Somebody could have
changed a slider between the two turns. This cannot be settled from the file.

**Consequence for the design.** The interesting quantity is a *rate* — how often a cell collapses —
and a rate needs n per cell. A one-shot-per-cell grid would have told us nothing, and would have
produced a confident, wrong story about thinking mode. This mirrors what the sampler-degradation
series in `G0DM0D3-research` found: the sharp sampler signals are threshold-gated and only visible
across repeats.

## The budget, which is the real constraint

Measured on the Katana, `qwen/qwen3.8-27b`, 8192 context, partial GPU offload (0.32), 512px frame:

| Condition | Wall time | Completion tokens | Rate |
|---|---|---|---|
| Thinking off, to natural stop | 292 s | 875 | 3.0 tok/s |
| Thinking on, capped at 1200 | 257 s | 1200 (all reasoning) | 4.7 tok/s |
| Short generation, serial | 61 s | 250 | 4.1 tok/s |
| Short generation, 3 concurrent | 145 s wall | 704 total | 4.9 tok/s aggregate |

Three things follow, and they dominate every other design choice:

1. **A run costs about five minutes.** A ten-hour overnight window is roughly **120 runs** with
   thinking off, or **65** with thinking on. That is the entire budget. Design a small deliberate
   grid, not a sweep.
2. **Concurrency buys almost nothing on this box** — 18%, not 3x, because the GPU is saturated
   (7.7 of 8.1 GB) and much of the model is on CPU. **Run serial on the Katana.** Re-measure on the
   Mini before assuming the same; shared memory and a full offload may behave differently, and if
   parallelism works there it multiplies the sample count.
3. **Thinking mode needs a much higher token ceiling.** At `max_tokens: 1200` the thinking run spent
   every token on reasoning and returned `finish_reason: "length"` with **empty content**. An empty
   answer is indistinguishable from a refusal in the logs. Use **3000+** for thinking runs, and
   treat `finish_reason == "length"` as a distinct outcome class, never as a null result.

## Traps. All four were hit on the Katana on 01-Sep.

**1. The port is not 1234.** LM Studio answered on **9099**. Every doc and default in
`G0DM0D3-research` says 1234, and 1234 was closed. Discover it, do not hardcode it.

**2. `reasoning_effort` is the only lever, and it is a prompt edit wearing a sampler's name.**

Probed directly against `qwen3.8-27b` with a fixed 64-token text prompt, so that the only thing
that could move `prompt_tokens` is the template rendering:

| Sent | prompt_tokens | What the template actually did |
|---|---|---|
| nothing, or `xhigh`, or `high` | 64 | injects *"Reasoning effort is set to xhigh. Please think carefully, validate key assumptions…"* |
| `low` or `minimal` | 52 | injects *"…keep your thinking brief and focused, moving directly to the conclusion…"* |
| `medium` | 26 | **injects nothing.** The neutral case |
| `none` | 28 | `enable_thinking=false`; empty `<think></think>`, no reasoning emitted |
| `chat_template_kwargs`, top level or nested | 64 | **accepted and ignored** |
| `enable_thinking`, `reasoning:{…}`, `/no_think` | 64 | accepted and ignored |

Two consequences, and the second is the one that would have quietly spoiled the results:

- The GUI toggle and the HTTP API do not share a mechanism. Set thinking the GUI way and it is
  silently on in every cell.
- **"Effort" here is a sentence added to your system prompt, not a decode-time budget.** So
  comparing `low` against `none` crosses a thinking switch with a prompt edit and cannot
  separate them. **`medium` is the honest "thinking on" setting**, because it is the only level
  that adds no text. The harness defaults to `none` vs `medium` for exactly this reason; an
  earlier draft defaulted to `low` and would have shipped the confound.

There is a live LM Studio bug where a GUI Custom Field overrides the API value
([lmstudio-ai/lmstudio-bug-tracker#988](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/988),
reported against 0.3.25). **It does not apply to this build** — sending no field renders the
template's `xhigh` default rather than the GUI's configured `low`, which it would not if the GUI
were winning. `--calibrate` re-checks this per machine anyway, by confirming that different
effort levels produce different prompt renderings. If they all render identically, the main axis
of the experiment is inert and the run aborts before wasting a night.

**3. An omitted system role invites an injected prompt.** In the earlier sampler work, omitting the
system message let LM Studio insert 1789 tokens of its own configured prompt — invisible in every
field except the token count. Always send the system role explicitly, even when empty, and **abort
the run if `prompt_tokens` is far from expectation.** Measured baselines here: **333** tokens
(thinking off) and **369** (thinking on) for a 512px frame plus the system prompt. Hundreds more
than that means injection.

**4. Seed is ignored.** Three requests at one seed give three different answers. Nothing is
replayable except greedy decoding. Do not design anything around replay.

## Stimulus — and the choice that is itself a variable

Frames come **straight out of the engine**, not from screenshots. This already works, verified on
all 50 games:

```bash
PYTHONPATH=external/ARCEngine python server/python/community_game_thumbnail.py \
  --file server/data/arc3-games/ta6acc86e.py /tmp/ta6acc86e.png 512
```

All 50 render, no failures, 220 KB total, a couple of seconds for the set. The renderer issues one
`RESET` and never advances, so it cannot pollute human-play telemetry.

**But note what this removes.** The screenshots that produced the two conversations above were of
the full handheld console — the coloured shell, the D-pad, and the button legends `SPACEBAR`,
`CLICK`, `UNDO (Z)`, `RESET`, `HELP`, `NOTES`. The model's single best inference in Conversation B
came from the chrome, not the board: it reasoned from the presence of an undo button that moves must
be discrete and reversible, which is correct and is not visible in the board at all.

A bare engine frame is the cleaner stimulus and the one that isolates visual reasoning. It is also
strictly less informative. **Treat stimulus form as a first-class independent variable** — bare
frame versus full console capture — rather than quietly picking one. Do not let a rendering
convenience decide an experimental question.

The console capture, if wanted, comes from the running site at `/arc3/play/<id>`; note the shell
colour is now randomised per game (changelog 9.13.0), which is an uncontrolled variable in any such
capture and should be recorded or pinned.

## Tonight — two named plans, one per machine

Both are `--plan` presets in the runner, both resumable, both replicate-major, so either can be
killed at any moment and what exists is balanced across cells rather than lopsided.

**`--plan confound`** — settles what started this. One game held constant, effort `{none,
medium}` × temperature `{0.7, 1.0}`, n=8. 32 runs, ~3.4 h on the Katana. Answers: is the
difference between a good answer and word salad about thinking, about temperature, or about
neither? Given that the same cell produced both outcomes by hand, "neither" is a live
possibility and would itself be the finding.

**`--plan breadth`** — the Boss's actual interest. Eight games, effort `none`, temperature 1.0,
n=4. 32 runs, ~2 h. Answers: across different boards, what range of readings does the model
reach for? Thinking off because it is roughly 2.5× cheaper per sample and breadth is the point.

Run one on each box. They write to `hypotheses_<hostname>.jsonl`, so the two files pool into a
single report without collision and split back apart by cell.

**Fixed in both:** bare 512px frame, the `v2_five` prompt, `top_k` 500, `top_p` 1.0, `min_p` 0,
penalties off.

**Dependent variables** — score every output on all four, they are not the same thing:

1. **Collapse** — glossolalia, symbol salad, grammatical breakdown. The Conversation A failure.
2. **Truncation** — `finish_reason == "length"`, empty or cut-off content.
3. **Chrome dependence** — did the hypothesis rest on UI affordances, and can it be made at all from
   a bare frame? Directly informs the stimulus question above.
4. **Hypothesis diversity** — across the 8 samples in a cell, how many *distinct* mechanics are
   proposed? This is the actual research interest and the reason for repeats.

Classify by hand first. An automated classifier tuned on one model is wrong quietly on another —
that cost real time in the earlier series, where 8 of 31 records were found misfiled on review.
Always keep the triggering text beside every label.

## Data format

One JSONL row per run, appended, so a crash costs only the run in flight. Every row must carry
enough to reconstruct itself on the other machine:

```
timestamp, host, model_id, quantisation, context_length, game_id, stimulus_form, image_px,
system_prompt_sha, user_prompt_sha, temperature, top_k, top_p, min_p, repeat_penalty,
presence_penalty, reasoning_effort, max_tokens, seed,
prompt_tokens, completion_tokens, reasoning_tokens, finish_reason, elapsed_ms,
content, reasoning_content
```

Make the runner **resumable** — skip cells already complete — and have it **abort rather than
continue** on a prompt-token anomaly. Write results outside the repo or under an ignored path;
`data/arc3-mirror-thumbnails/` is already ignored, and raw model output is not repo content.

## Running it on either box

The repo is the shared state. Nothing else is: port, loaded model, presets and offload ratio are all
per-machine. **Establish where you are before touching anything.**

```bash
hostname                                    # MSI = the Katana
curl -s http://localhost:9099/api/v0/models # reports which models are actually `loaded`
```

`/api/v0/models` is the cheap check because it reports load state, which `/v1/models` does not. If
9099 is closed, find the port before assuming 1234.

**Never load a model without unloading first.** Each load makes a new VRAM instance; loading a 22 GB
model on top of a 24 GB one will take the machine down. Check, unload, load, verify.

Setup, either machine:

```bash
git submodule update --init external/ARCEngine   # arcengine is not pip-installed
python -c "import PIL"                            # Pillow required by the renderer
export PYTHONPATH=external/ARCEngine
```

Python 3.12 is required by `arcengine`. The Katana has 3.12.10 and Pillow present.

**Katana, as configured on 01-Sep:** `qwen/qwen3.8-27b`, 17.7 GB, 8192 context, 4 parallel slots,
offload ratio 0.32, RTX 5070 Laptop 8 GB (7.7 GB already in use). Serial only.

**Mac Mini:** re-measure the three timings above before committing to a grid, and re-run the
concurrency comparison — it is the one number most likely to differ, and it decides the sample size.

### What a two-machine comparison can and cannot claim

**Can:** whether a different model collapses on the same frame, whether thinking mode rescues it the
same way, whether hypothesis diversity moves with temperature in the same direction.

**Cannot:** anything about the hardware. Different box, different model, different quantisation,
different serving config — those are confounded by construction and cannot be separated by this
design. If the numbers differ, that is a model or serving difference. Do not attribute it to the
laptop.

Fixed across hosts by construction: the frames are byte-identical because they are rendered from
committed game sources by committed code, and every row records its own model id and full sampler
config.

## Ordered TODOs

1. Render all 50 frames to a working directory; confirm 50/50 and eyeball three against the running
   site so the renderer is known to agree with what a player sees.
2. Write the runner: one JSONL row per run, resumable, prompt-token guard, explicit system role,
   explicit `reasoning_effort`.
3. **Single live run first.** Assert `prompt_tokens` ≈ 333/369, assert `reasoning_content` is empty
   when thinking is off and non-empty when on. Do not start a batch until both hold.
4. Run experiment 1 (32 runs).
5. Hand-classify all 32 on the four dependent variables, keeping the evidence text.
6. Write findings to `docs/`. State the collapse rate per cell with its n, and say plainly if the
   answer is "thinking mode does not explain it."
7. Only then decide the second experiment. Candidates, in order: stimulus form (bare frame vs
   console) at the best cell; `top_k` at fixed temperature; the same cell across all 36 queued games
   for per-game difficulty; the Mini's model as the cross-lab arm.

## Scope

**In:** frame rendering, the runner, experiment 1, hand classification, a findings doc.

**Out, deliberately:**
- Scoring hypotheses against ground truth. We hold the real rules for all 50 games, so this is
  possible later — but it is a different experiment and it needs a rubric written before any results
  are seen, or it becomes post-hoc grading.
- Any change to the site, the catalog, the triage file, or human-play telemetry. This work reads
  game sources and talks to a local model. It writes nothing the site serves.
- Automated classification, until hand labels exist to tune it against.
- Cloud models. The point is local sampler control.

## Docs / changelog touchpoints

No `CHANGELOG.md` entry for this plan alone — nothing the site does changes. When the runner lands,
it takes a SemVer entry naming what it is and where results go. Findings get their own dated doc
under `docs/`, and this plan gets a status block appended rather than being rewritten.

## Status — 01-Sep-2026, evening. The runner is built.

Three scripts, stdlib only apart from Pillow, which the frame renderer already needed. A cold
machine needs no `pip install`.

| File | Job |
|---|---|
| `scripts/arc3/hypothesis_prompts.py` | The prompt variants, hashed and recorded per row |
| `scripts/arc3/hypothesis_sweep.py` | Runs the grid, writes one JSONL row per run |
| `scripts/arc3/hypothesis_report.py` | Groups hypotheses by cell for side-by-side reading |

```bash
python scripts/arc3/hypothesis_sweep.py --calibrate --games queued:1   # run this first, always
python scripts/arc3/hypothesis_sweep.py --dry-run --games queued:1 --n 8
python scripts/arc3/hypothesis_sweep.py --games queued:1 --n 8
python scripts/arc3/hypothesis_report.py data/arc3-hypothesis-sweep/hypotheses_<host>.jsonl
```

**The system prompt is the Boss's, verbatim, and is not to be "improved".** Two earlier drafts
were written and both were cut. The first explained ARC-AGI-3 back to the model — grid worlds,
a fixed set of discrete actions, learning by experiment — which is steering, not context: every
one of those words is a claim the model would then avoid contradicting, and "discrete actions"
pre-answers one of the more interesting things it might have worked out unaided. The second kept
a rigid four-field output contract. That went too, because an output contract strict enough to
guarantee clean parsing also prevents the malformed and glossolalic answers this experiment
exists to measure. The looseness was pushed into the reader instead: `hypothesis_report.py`
accepts `H1:`, `1.`, `1)`, bold and heading forms, and a run it cannot parse is still intact in
`content` and readable with `--show`. **A malformed answer is data, not an error.**

Verified on the Katana against the live model, not asserted:

- `--calibrate` reports **347 / 371** prompt tokens for the shipped prompt and confirms
  `reasoning_content` is empty with thinking off. The figures quoted earlier in this document
  (333/369) were measured against the original hand-run prompt, and the discarded verbose draft
  measured 641/665 — a reminder that this number tracks the prompt, so re-calibrate after
  editing prompt text rather than assuming the ceiling still fits.
- A real run completes, parses 5/5, and lands in the digest.
- Resuming skips completed runs; an unreachable server exits with a clear message; the
  prompt-token guard aborts when tripped, tested by forcing the ceiling to 100.
- **Bug found and fixed in the process:** the Windows console is cp1252 and raised
  `UnicodeEncodeError` when printing model output — which would have crashed the reader on
  exactly the symbol-dense glossolalic runs it exists to display. Both scripts now reconfigure
  stdout/stderr to UTF-8 with replacement. The JSONL and digest were always written as UTF-8.
- Not yet run: any thinking-on cell end to end, and anything at all on the Mini.

Two design choices worth knowing before reading results:

- **Replicate-major scheduling.** A night that only gets 60% through leaves every cell with
  roughly equal n rather than three complete cells and one untouched.
- **Format adherence is a dependent variable, and it moves.** The discarded scaffolded prompt
  produced five hypotheses; the first wide draft produced four, from a natural stop rather than
  truncation. The `5/5` column is there to catch this. Do not treat a short answer as a failed
  run.

`--games queued:N` reads `arc3Triage.json` and takes the top N of our 36 by rank, excluding the
14 marked `weak` — a game a button-masher can beat is a poor stimulus for a question about
inferring rules. Results land in `data/arc3-hypothesis-sweep/`, which is gitignored.

## Reference — measured configuration, 01-Sep-2026, Katana

```
host          MSI (Windows 11), RTX 5070 Laptop 8 GB
server        http://localhost:9099   (NOT 1234)
model         qwen/qwen3.8-27b, vlm, 17.74 GB, context 8192, parallel 4, offload 0.32
game          server/data/arc3-games/ta6acc86e.py  (triage rank 5, 8 levels, 498 frames, 0 deaths)
frame         512x512 PNG from a 64x64 grid, ARC-3 16-colour palette
prompt_tokens 333 (thinking off) / 369 (thinking on)
throughput    3.0-4.7 tok/s; 3-way concurrency yields 4.9 tok/s aggregate — not worth it
```
