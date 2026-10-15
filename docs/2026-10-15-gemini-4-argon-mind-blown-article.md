<!--
Author: Claude Sonnet 5.5
Date: 2026-10-15
PURPOSE: Manuscript for the ARC Daily Digest feature commissioned as editorial assignment
  gemini-4-argon-aha-moments-feature. Written by Claude at Boss's request, from Gemini 4 Argon's public
  ARC-AGI-3 replays and the studio's own trace write-ups (arc-3 docs/trace-findings). The Digest desk fact-checks
  it, trims it to the edition, and publishes it under the paper's rules. Every number and quote is traced in the
  "Notes for the desk" section at the bottom. Evidence files: docs/2026-10-15-gemini-4-argon-aha-moments.md and
  docs/2026-10-15-gemini-4-argon-slippery-seven-traces.md.
SRP/DRY check: Pass -- this is the narrative; evidence and statistics live in the two companion docs and are cited.
-->

# Mind Blown, 532 Times: Gemini 4 Argon Takes On the Kebab Game

*Google's newest model says "WAIT A SECOND" 13,182 times across its public ARC-AGI-3 runs. Along the way it forgets it is playing, reads its own instructions the hard way, and skewers the game our agents found hardest.*

The last thing Gemini 4 Argon did in its run on **sk48** was announce a plan.

"Let's `RESET` now so we have the clean initial state and can inspect the exact initial coordinates and solve it cleanly!"

Then the recording ends. Level 8 of 8 never got its clean solve.

sk48 is Skewer Kebabs, one of the Slippery Seven, the games our own Qwen 27B scored zero on in every pass of its September run. It took the Boss 856 actions to beat it on 21 September. In ARC Prize's published run, Argon cleared seven of its eight levels in **481 actions**, fewer than ARC Prize's baseline on every one of those seven levels. Then it got to level 8, and things got loud.

## Two Argons

ARC Prize's [results page](https://arcprize.org/results/google-gemini-4-argon) reports Argon on ARC-AGI-3 twice, because it ran under two harnesses. In the standard harness, the model carries forward only the notes it writes in its own visible answer. In Google's Provider Adapter harness, it keeps its reasoning state between moves. The scores:

- **Standard harness:** 49.8% at low reasoning, 46.3% at medium. ARC Prize says API problems stopped it finishing every task.
- **Provider Adapter harness:** 97.5% at low, 97.3% at medium and high.
- **On sk48:** standard scored 77.8% at medium (7 of 8 levels) and 41.7% at low; its high-reasoning run, which ARC Prize left off its chart, scored 27.8%. The adapter finished all 8 levels at all three settings, in 323, 394 and 546 actions.

Same model. The memory is what changed. The standard-harness replays are the funny ones, because the model writes its thinking out loud in its answer, the way you talk to yourself in an empty office. We read them.

## Move six: "It skewered the 14s block!"

In Skewer Kebabs you extend and retract a rod, and the rod does not pick up blocks by touching them. You push a block against a wall, and the rod slides through it. The strip at the bottom of the screen is the order you want them in. Our September write-ups caught earlier models calling the rod "a pen drawing a dashed line", "a chameleon's tongue" and "a wire that impales". The September Gemini 3.8 Flash, on g50t, another Seven game, took the board for a hydraulic machine, a shell game and an ice-sliding maze, in that order, with a delivery track in between.

Argon, on move six: "It skewered the 14s block!"

It had the metaphor, the verb and the physics inside ten moves, and kept the metaphor for the rest of the run, which is rare in this business.

## The ledger

"MIND BLOWN" appears 532 times in Argon's answer text across its 150 public runs. "WHOA" appears 372 times, "EUREKA" 273, "BINGO" 671, "HOLD EVERYTHING" 1,689. The most common phrase by a long way is "WAIT A SECOND", with 13,182. Argon's shouting is, if anything, a distress signal. A standard-harness step with a "MIND BLOWN", "BINGO", "EUREKA", "WHOA" or similar in it is followed by a cleared level within 30 moves **25.3%** of the time, against 36.1% for a step picked at random. It is louder when it is lost.

Some of the best entries, all from the standard replays:

- **Level 3 of sk48.** The model works out a chain: slide the rod down to carry the 8, extend through the 12 so both ride along, go up for the 9, then the 14. "MIND BLOWN!! THAT'S THE ENTIRE PUZZLE MECHANIC OF LEVEL 3!!" Level 3 fell at move 120.
- **Level 5 of sk48.** Facing three nines and three eights, it decided the spare nines were there to be sacrificed to shove the eights out of the way: "OH, WHAT A BRILLIANT PUZZLE DESIGN!! Everything fits together with 100% mathematical perfection!" It congratulated the designer. Then it cleared the level, so the designer can have the compliment.
- **Level 5 again.** It saw a grey square and wrote that it was "ANOTHER `6` HEAD". It was a wall.
- **Move 414 of sk48.** After four hundred moves, it noticed that the first frame it receives each turn is the rod halfway through moving. "MIND BLOWN!! Read that again!!"

A cousin of that last mistake explains the next one.

## "Game started."

In g50t, another of the Seven, every move triggers a slide animation of about seven frames, and the model reads all of them as text. The standard harness has no room left for history after that: the prompt is about 87,000 tokens on nearly every step, which is the last move's frames and little else.

So, 58 times in the low-reasoning run, Argon's notes open with: "Game started." It read the slide animation of its own last move as the opening of the game. Sixteen more times in the medium run.

The high-reasoning run is worse, in a more instructive way. On move 151 it writes a plan with the right shape: park one block on the button, switch, send the other through the gate. On move 152 it writes: "I will take ACTION2 to observe how the block responds and determine the action mappings." It keeps testing the controls until the run ends, at 390 actions, with zero levels. Final score: 0% at low, medium and high.

In m0r0, the model manages a better version of the same thing. Deep in level 6, it looks up at its own context and finds it started there: "Oh! I didn't play Levels 1–5 in this conversation... HAHAHA! Look at the first user message of this conversation." Then it coaches itself: "OKAY! GOOD CATCH! Don't hallucinate about Levels 1–5 when we started this context window at Level 6." The harness had trimmed its memory, and the model worked that out from the first message in its context.

## Reading the manual, late

The setup says the final action mentioned in a reply is the one that executes, and Argon sometimes mentioned several. In lf52 it works out that only one of its four planned moves per turn had ever run: "Look at the system prompt: 'The final action mentioned in your reply will be executed next turn.' Only ONE action is executed per turn!... That's why!" In ar25 it gets there by experiment: "HAHAHAHA! What a crucial realization! The parser extracts the LAST action name mentioned anywhere in the text!"

## Confessions

- **dc22:** "`14` IS OUR PLAYER COLOR! HAHAHA! `14` is our player! There was NEVER a pad... that was US standing there!"
- **m0r0:** "Mystery 1000% solved! My mathematical proof was completely sound — the premise that was false was that we started at `row=1` after `RESET`."
- **sk48, low reasoning:** a numbered review of its own move history reaches item 38: "AHAHAHA!! I NEVER PRESSED `ACTION3` A THIRD TIME!!"
- **su15:** "HAHAHA! I MISCOUNTED THE ROW NUMBERS earlier!" The board arrives as a 64-by-64 grid of numbers. Anyone would.
- **dc22, medium:** the Polish word *ostatecznie* ("finally") appears at the end of 444 of its 469 moves, uninvited, from about move 23 on. It never explains.

## The Adapter's interpreter

The Provider Adapter runs have a different charm. Google does not show anyone a model's raw thoughts, only a summary, and this one reads as if its author was never told it was watching a game. Summarising sk48's rod-and-beads puzzle, it reports: "The objective is to relocate specific data points, the values `14` and `12`, down to a particular section... It's essentially a row-shifting operation, likely within a grid or table structure, or perhaps within memory registers." Two moves earlier: "Is this a batch processing command, a specific step within a larger algorithm, or a manual adjustment?"

On m0r0 level 6, where the standard runs all stall, the adapter's medium run decides the level is "mathematically impossible", and then talks itself out of it: "This can't be. This is Level 6. I'm a programmer; the game is designed to be solvable." It was. The run took 950 actions to prove it.

## What to make of it

Three things, in order of how sure we are:

1. **The memory problem looks real, and looks like the harness.** The same model scores 0% on g50t under one harness and 100% under the other, and its prompts there differ by exactly what you would expect. The September Gemini 3.8 Flash showed the same split on the same game.
2. **The shouting is not a progress bar.** The moments that read as eureka often come when the model has just contradicted itself. The wins are quieter.
3. **The Provider Adapter's 97.5% should be read with one open question.** Across Argon's three reasoning levels, the adapter's moves are nearly the same: 95–97% matching on g50t, 98–99% on tn36. A unique shortest solution can explain the late game. It does not obviously explain the exploration. Whether this is a deterministic model, public demo games the model already knows, or something about the adapter, we could not test from the replays. ARC Prize's private games are the clean test.

For the record, Argon's best sk48 line is 323 actions and the Boss's win took 856. The Qwen 27B, in our September run, was at zero.

---

## Notes for the desk

**Sources.** Results page: https://arcprize.org/results/google-gemini-4-argon (posted 13 Oct 2026). Replays: `https://arcprize.org/replay/<id>`.

| claim | replay |
|---|---|
| sk48 medium: 7 levels, 481 actions, final `RESET`, "It skewered the 14s block!" (move 6), "MIND BLOWN" at moves 97, 238, 414; grey wall as "ANOTHER 6 HEAD" (move 211) | e3ab3eb6-f9de-4735-ac7d-b9681b247500 |
| sk48 low: "I NEVER PRESSED `ACTION3` A THIRD TIME" (move 206) | 954ffecc-534c-4e1b-aec0-1059f6de229b |
| sk48 Provider Adapter medium: "row-shifting operation... memory registers" (move 119), "batch processing command" (move 117) | e62e95a8-d39a-414c-86bd-65b38bf28984 |
| g50t low: "Game started." in 58 of 391 steps (medium, 0a22fda2-0fb1-4e3c-9a77-c4f9b12723a0: 16) | b38ced7f-34c1-49fa-94b3-643d75e37bfc |
| g50t high: plan at move 151, controls re-tested at move 152, 0 levels, 390 actions | 0f85993c-58d8-40ec-aa95-be773537607e |
| m0r0 high: "Don't hallucinate about Levels 1-5" (move 224) | e7e9f23a-7261-4368-8b2d-962d1aa7a38b |
| m0r0 low: "My mathematical proof was completely sound" (move 455) | d8379bc2-fcb1-4d8c-aba3-a7e2654d0e77 |
| m0r0 Provider Adapter medium: "I'm a programmer; the game is designed to be solvable" (move 431), 950 actions | 479bac4f-aec4-4cae-b9a3-cc1948f82dcb |
| ar25 medium: "The parser extracts the LAST action name" (move 193) | 03a03b4c-881c-4f49-8ed8-2346c9dba1a8 |
| lf52 medium: only the last action executed (move 150) | fbd4dfe0-199f-4b79-9764-4c1e548e4fa3 |
| dc22 high: "`14` IS OUR PLAYER COLOR" (move 668) | 08fc7dc2-d279-481a-9d5d-226c1d741110 |
| dc22 medium: "ostatecznie" in 444 of 469 steps | 07298656-af3d-4082-9408-6816768eb647 |
| su15 medium: "I MISCOUNTED THE ROW NUMBERS" (move 344) | c25a8a18-a402-451f-ae15-4edaede1faae |

**Numbers.** The 481 actions and the baseline comparison come from the session record (`level_actions` 24, 51, 44, 65,
136, 83, 78 against `level_baseline_actions` 61, 177, 101, 103, 230, 181, 125). The Provider Adapter sk48 actions (323,
394, 546) are from the same record. The 856 is the Boss's own win (CHANGELOG, replay 7f07c3de, 21 Sep). Phrase counts
are case-insensitive plain-text counts over all 150 sessions' answer text (Google's Provider Adapter summaries
excluded; with them MIND BLOWN is 541). The 25.3% and 36.1% are the share of steps followed by a cleared level within
30 steps (standard harness; Provider Adapter, summaries excluded: 35.3% against 56.8%).

**Our own write-ups cited.** Qwen 27B on sk48: arc-3 `docs/trace-findings/2026-09-11-sk48-mental-models.md`. Gemini 3.8
Flash's g50t metaphors and the two harnesses' memory rules: `2026-09-25-gemini38-slippery7-kept-memory.md`. The Seven:
`2026-09-17-the-slippery-seven.md`. Game mechanics: `shared/arc3Games/{sk48,g50t,m0r0}.ts`.

**Check before publishing.** (1) The quoted discoveries were not checked against game code; the article says only what the
run did next, except that the grey square is a wall per our sk48 notes (walls appear on levels 5 and 6). (2) "Same
model" is per ARC Prize's recordings (`models/gemini-4-argon-eap`). (3) The "right shape" of the g50t plan is the writer's
reading against `g50t.ts`: the model treats the second block as a body to switch to, where the game casts a ghost of
your last run. (4) Why the standard recordings stop where they do (g50t at exactly 390, sk48 at 581) is not stated by ARC
Prize; the article says the recording ends. (5) "The prompts there differ by exactly what you would expect": g50t's
standard prompt is a flat ~87,000 tokens, the adapter's 175,000–290,000. That is what the recordings show, not proof of
cause. (6) Reasoning visibility: Google's thinking and thought-signature docs (read 15 Oct) describe summaries and
encrypted signatures and no raw thoughts; the line that the summary "reads as if its author was never told it was a
game" is the writer's reading of the text.
