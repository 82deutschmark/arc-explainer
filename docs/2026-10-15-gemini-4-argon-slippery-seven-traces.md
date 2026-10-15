<!--
Author: Claude Sonnet 5.5
Date: 2026-10-15
PURPOSE: What Gemini 4 Argon's public ARC-AGI-3 replays show on our "Slippery Seven" (dc22, g50t, m0r0,
  sc25, sk48, tn36, tr87), and what Google's API docs say about whether the reasoning in them is real.
  Written to be lifted into the ARC Daily Digest evening edition: section 0 is the digest blurb, the rest
  is the evidence. Raw material is in data/gemini-4-argon-traces/ (script-reproducible, see section 7).
SRP/DRY check: Pass -- the Seven list lives in shared/arc3Games/slipperySeven.ts and the 27B baseline in
  arc-3 docs/trace-findings/2026-09-17-the-slippery-seven.md; both are cited, not restated.
-->

# Gemini 4 Argon on the Slippery Seven: what the traces show

Source: https://arcprize.org/results/google-gemini-4-argon (posted 13 Oct 2026). All 150 public replays
(25 games x 6 configs) were pulled from the public `arcprize.org/api/recordings/...` endpoints.

## 0. Digest blurb

Gemini 4 Argon scores 97-100% on all seven of our hardest ARC-3 games when run through Google's own
"Provider Adapter" harness, and as low as 0% on the same games through ARC Prize's standard harness. Same
model. In the standard harness the replays show it working out the solution to g50t, then forgetting its own
plan one move later. The 97% runs are worth a second look: their moves are 88-99% identical across three
independent reasoning levels on several games. And the "reasoning" in them is a summary: Google's docs
confirm raw thoughts are not exposed.

## 1. The scores

Semi-private v3 headline from the results page: 49.8% standard harness (low reasoning), 97.5% Provider
Adapter (low). Per game on the public demo set, seven games only:

| game | standard harness (medium / low / high) | Provider Adapter (medium / low / high) |
|---|---|---|
| g50t | 0 / 0 / 0 (GAME_OVER at 390 actions, 0 levels) | 100 / 100 / 100 |
| tn36 | 28.4 / 58.0 / 100 | 100 / 100 / 100 |
| sc25 | 47.6 / 47.6 / 47.6 (4 of 6 levels) | 100 / 97.3 / 100 |
| m0r0 | 71.4 / 71.4 / 71.4 (5 of 6) | 85.0 / 100 / 100 |
| dc22 | 47.6 / 47.6 / 71.4 | 100 / 100 / 100 |
| sk48 | 77.8 / 41.7 / 27.8 | 100 / 100 / 100 |
| tr87 | 100 / 93.5 / 100 | 100 / 100 / 100 |

Per-session numbers: `data/gemini-4-argon-traces/index.csv`, `slippery_stats.csv`.
The standard-harness high-reasoning point is not on ARC Prize's chart (19 of 55 tasks completed, API issues).

## 2. Standard harness: it knows, then forgets

**g50t, the clearest case.** Prompt size is 87,034 tokens on almost every step across all three reasoning
levels: exactly seven 64x64 frames (the slide animation from the last move) and nothing else. Games that
return one frame per move run about 150K tokens with 20-60% cached input, i.e. roughly ten turns of history.
g50t's multi-frame moves fill the window with a single turn.

- High run, step 151: "Switch to `2` (ACTION5), slide `2` right onto the button (ACTION4) to open the gate,
  switch back to `9` (ACTION5), slide `9` down (ACTION2) and right (ACTION4) into the goal." That is the
  solution.
- Step 152: "I will take ACTION2 to observe how the block responds and determine the action mappings."
- It repeats this for all 390 actions, then the move budget ends the game. One step spent 362,449 thinking
  tokens.

Inference, not proven: the model's own "Context:" notes are the only memory, and in g50t they are not carried.
The flat 87,034 is the evidence; we cannot see the prompt.

**Games with real history fail differently: the rules change under it.**
- m0r0 (level 6, all three levels stall): "ACTION6 is NOT a valid action in this game (it's ignored by the
  engine)", deduced from a timer that did not move, then built on.
- sc25 (level 5, all three levels stall): dozens of steps on "why does DOWN move 2 pixels, then 3?"; one step
  burned 68,342 thinking tokens.
- sk48 medium reached level 8 of 8, wrote "MIND BLOWN!" on discovering the bases slide on tracks, and ran out
  of actions (581) mid-discovery.
- tr87, tn36 (high) and dc22 (levels 1-4) show clean working-out: tr87 cleared at medium and high.

**Glitches.** dc22 medium appends the Polish word "ostatecznie" to 444 of 469 steps. A few m0r0 and tn36 steps
carry a stray `{_thought ... _}` wrapper around plain-text reasoning.

## 3. Provider Adapter: what is different

- Context is 175,000-290,000 tokens per call on g50t (alternating ~176K / ~265K, so two model calls per
  action); history cached 85-92% on most games.
- Thought summaries are carried and visible. In g50t medium it works out ACTION5 (swap which block you control)
  by step 6, parks one block on the button, switches, and walks the other through the gate. 294 actions, 7 levels.
- 50-99% of its steps on most games are a bare action with no text. The reasoning behind those is hidden.

## 4. What to verify before believing the 97%

- **Near-identical play across independent runs.** Sequence similarity of the action lists (difflib ratio)
  between the three Provider Adapter reasoning levels: g50t 0.95-0.97, tn36 0.98-0.99, dc22 0.88-0.90. The same
  comparison on standard-harness runs: g50t 0.21-0.36, tn36 0.58-0.86, dc22 0.44-0.63. On g50t the first
  level clears at step 24, 25 and 27 and the later ones within a few steps of each other. A unique shortest
  solution explains the late game, but not matching exploration.
- **Candidate explanations** (none tested): the 25 demo games are public, so walkthroughs may be in training
  data; decoding may be near-deterministic; the adapter may add something beyond a plain wrapper.
- **Our baseline.** Boss needed 856 actions to win sk48 (21 Sep). Adapter sk48 wins take 323-546.
- A private-set or fresh-game run is the clean test. We cannot do it from the public replays.

## 5. Is the reasoning real? Google's docs

Checked 15 Oct 2026 against Google's
[thinking](https://ai.google.dev/gemini-api/docs/interactions/thinking.md.txt) and
[thought signatures](https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures) pages:

- Only the final output is returned by default; summaries are opt-in (`thinking_summaries: "auto"` in the
  Interactions API; `includeThoughts` in generateContent). No documented way to fetch raw thoughts.
- Each thought step carries a `signature`, "an encrypted representation of the model's internal reasoning
  state", which must be sent back unchanged (a missing one is a 4xx error on Gemini 3 function calling).
  Same pattern as OpenAI's encrypted reasoning items and Anthropic's signed thinking blocks.
- A thought block can be signature-only, with no summary.
- Billing is for the full thinking tokens, not the summary.
- `gemini-4-argon` is documented and defaults to medium thinking.

What the traces show:
- Adapter "[reasoning summary]" text is a second-model summary: third-person, and in 2,528 of 13,271 thinking
  steps it literally includes "tailored for an expert audience".
- Across those steps hidden thinking is 11.49M tokens; the summary text is about 3.16M (chars/4), ~27%.
- Standard-harness runs return no thought text at all; thinking tokens appear only in the usage counts. In many
  of those runs thinking is 0 and the visible "WAIT A SECOND!" passages are chain-of-thought written into the
  normal answer. That text is real and unfiltered but it is output, not the hidden thinking.

## 6. What this means for us

- Our Qwen 27B failed g50t by re-testing controls and quitting (2026-09-17 write-up). Argon in a bare
  harness fails it the same way even with the solution in hand. Part of the Slippery Seven looks like a
  memory-of-plan problem, not a rules-discovery problem. Cheap test: the 27B on g50t, sc25 and m0r0 with a
  harness that carries a running plan forward.
- For the SFT dataset goal: standard-harness visible text is the better signal; adapter summaries are a
  weak one (about a quarter of the thinking, written by another model).

## 7. Reproduce

```
python -I data/gemini-4-argon-traces/fetch_traces.py   # 150 transcripts -> sessions/ (61 MB, not committed) + index.csv
python -I data/gemini-4-argon-traces/harness_stats.py  # slippery_stats.csv
```

Not done: only about 40 passages across the 42 Slippery Seven sessions were read; the other 108 sessions
(18 non-Seven games) were downloaded but not read. Model id in the recordings is
`models/gemini-4-argon-eap`, configs `google-barium-bb3-{low,medium,high}[-provider-adapter]`.
