<!--
Author: Claude Opus 5
Date: 01-September-2026
PURPOSE: Paste-ready runbook for starting the ARC-3 hypothesis sweep on the Mac Mini, written
         for a session with no memory of the one that built the harness. Covers setup, the
         calibration gate, what to run, and the four ways this can go wrong quietly. The
         reasoning behind the design is in 2026-09-01-arc3-hypothesis-sweep-plan.md and is not
         repeated here.
SRP/DRY check: Pass - operational steps only. The why lives in the plan doc; the measured
         numbers live there too and are referenced rather than copied, except where an operator
         needs one in front of them to judge a PASS.
-->

# Mini runbook — starting the sweep

The Katana is already running `--plan confound` on one game. **The Mini runs `--plan breadth`**:
eight different games, one setting, 32 runs, roughly two hours. Between them you get the
variance on a single board and the range across boards.

## Setup

```bash
git checkout arc3-hypothesis-sweep && git pull
git submodule update --init external/ARCEngine
python3 --version          # must be 3.12+; arcengine requires it
python3 -c "import PIL"    # Pillow, needed by the frame renderer
```

Nothing else to install. The harness is standard library only.

**Load a model in LM Studio before continuing.** The runner will not load one — an extra load
allocates a second instance in memory and can take the machine down — and it aborts if nothing
is resident. It does not have to be the Katana's `qwen3.8-27b`; a different model is the more
interesting run, because it is the cross-lab arm this has never had.

## The gate

```bash
python3 scripts/arc3/hypothesis_sweep.py --plan breadth --calibrate
```

Do not skip this and do not start a batch until it prints **PASS**. It checks the three things
that silently invalidate a night:

1. **The server is where you think.** The port is discovered, not assumed. It was 9099 on the
   Katana, not the 1234 every document claims. If nothing is found, `lms status` reports the
   real one, or set `LM_STUDIO_URL`.
2. **The prompt is the size it should be.** A much larger number means LM Studio inserted a
   system prompt of its own, which is invisible in every other field. Katana reference, for
   scale: 347 tokens. A different model or image size legitimately differs; hundreds more does
   not.
3. **The thinking lever actually works.** This is the one worth understanding. `reasoning_effort`
   is the only control that reaches the chat template over HTTP — `chat_template_kwargs`,
   `enable_thinking` and `/no_think` are all accepted and ignored — and on Qwen it works by
   *injecting a sentence into the system prompt*, so a real effort change moves `prompt_tokens`.
   Calibration checks exactly that. If every level renders an identical prompt, the API value is
   being overridden by the app's own setting (Inference > Custom Fields > Reasoning Effort;
   lmstudio-bug-tracker#988) and the experiment's main axis would vary nothing. It refuses to
   start in that case.

`--plan breadth` runs thinking off throughout, so a failure of point 3 costs it less than it
would cost the Katana's plan. It is still checked.

## Run it

```bash
python3 scripts/arc3/hypothesis_sweep.py --plan breadth
```

Resumable: re-running the same command skips completed work, so sleeping the machine or hitting
Ctrl-C costs only the run in flight. Scheduling is replicate-major, so stopping early leaves
every game equally sampled rather than three finished and five untouched.

Results go to `data/arc3-hypothesis-sweep/hypotheses_<hostname>.jsonl`, which is gitignored.
Because the filename carries the hostname, the two machines' files pool into one report without
colliding.

## Reading it

```bash
python3 scripts/arc3/hypothesis_report.py data/arc3-hypothesis-sweep/*.jsonl
python3 scripts/arc3/hypothesis_report.py data/arc3-hypothesis-sweep/*.jsonl --show <game_id>
```

The table gives format adherence, truncation, empty content and a crude diversity count. The
`collapse?` and `distinct` columns are **hints from blunt heuristics, not measurements** — the
digest prints the triggering text beside every flag so it can be confirmed or thrown out. An
earlier version of the collapse flag fired on a perfectly good answer that used non-breaking
hyphens. Hand-label before citing any rate.

## Four ways this goes wrong quietly

- **A thinking run that returns empty content.** Reasoning can eat the whole token budget and
  return `finish_reason: "length"` with nothing in `content`, which reads exactly like a refusal.
  The ceiling is 3500 for thinking runs and the report counts truncations separately. Do not
  treat a short or empty answer as a failed run; it is an outcome class.
- **Concurrency that does not help.** Three parallel requests on the Katana bought 18%, not 3x,
  because its GPU was saturated. The runner is serial. The Mini has shared memory and may behave
  differently — worth measuring, and if parallelism works there it multiplies the sample count.
- **A malformed answer being mistaken for a bug.** The prompt deliberately imposes no rigid
  output contract, because one strict enough to guarantee clean parsing would also suppress the
  failure modes being measured. The reader is permissive instead. A run it cannot parse is still
  intact in `content`.
- **Comparing two different pictures.** The two machines can sit on different ARCEngine commits;
  on 01-Sep the Katana was on `e243421` while the repository recorded `653c3ee`. Checked at the
  time: the diff between those two touches nothing inside `arcengine/`, so frames are identical
  and no action is needed. Every row still records the sha of the exact image sent, and the
  report warns if one game ever renders two different ways across hosts.

## Do not "improve" the system prompt

It is the Boss's, verbatim, in `scripts/arc3/hypothesis_prompts.py`. Two tidier drafts were
written and deleted: one explained ARC-AGI-3 back to the model, which steers it and pre-answers
what we want to watch it derive; the other imposed a four-field output format, which would have
suppressed the malformed answers this exists to measure. Both decisions are recorded in that
file's comments. Change the prompt and you start a new experiment, not a bigger one — and
re-calibrate, because the token ceiling tracks the prompt.
