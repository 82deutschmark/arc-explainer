# Slop Breaks a Rule: Letting the Game Say No

*Team Turducken, ARC Prize 2026, ARC-AGI-3.*

> "Slop doesn't respect the constraints of the domain." (Mark Barney, our team lead)

## The number, and the gap next to it

ARC-AGI-3 is a set of turn-based games with no instructions. An agent has to find the goal and the rules by playing, and the benchmark scores each level by how close its move count comes to people's.

This paper documents submission 57721173: Kaggle notebook sonphamorg/arc3-daniel-cnp3k5mx-ff-nosplice-o34g, script version 363005415, public score 53.70 on 28 October. The same package, resubmitted unchanged two days later, scored 50.34. Our team best, 56.02 (submission 57572304, the sibling notebook this one was built from), sat fifth of 4,923 teams on the public board, as read from our own mirror of it on 9 November. We have not seen the private board.

[Figure 1: The climb, Kaggle public score by date to 23 October, marking 41.37, 53.70, 50.34 and 56.02. Also the cover.]

## Slop breaks a rule

Budd and Scarfe, in "Why Creativity Cannot Be Interpolated" (MLST, 2026), define it: "Slop is what happens when an artefact is generated without path-dependence, without understanding, without respecting the phylogeny or the constraints." And the other half: "The constraints do the work that deep structural knowledge would otherwise provide." Our working test is shorter. Slop looks new, and it breaks a rule the domain cares about.

ARC-AGI-3 is a good place to watch this, because every game is a program: a model's story about a game can be held against the rule that runs, and when they disagree, the story is wrong.

Chollet, from the other side: priors "are not a limitation to our generalization capabilities; to the contrary, they are their source." He also warns that hard-coded knowledge can "buy" performance without any generalization. Our priors are written by people: objects (our code does the segmenting), change, cause, a hint about edge bars. Nothing in our harness names a game. They can still be wrong.

## Fluent lost to the source

Their slop is a made thing; we stretch the word to a model's account of a game, and to our own writing.

In the game wa30 the player carries crates to its goal squares while rival haulers carry them to theirs, and pressing the interact key on a rival deletes it. Across 348,000 characters of thinking in one earlier run, the model said "bot" 615 times and "rival" or "ally" not once. It wrote that "a bot removed them (thinking it was delivering to the frame)". The rival was winning, not confused, and the model never tried the key on it. One trace, not a survey.

In September our prompt told the model that an edge bar is probably a timer and to "not get distracted by it". In 21 of the 25 public games that bar counts down a move budget and ends the game at zero. Our own documents did it too: a g50t action was written up as "rewind" in three of our files until someone read the source. It casts a ghost that holds down pressure plates.

Our generated games, outside this submission, had it too. Random play cleared the first level of ten of twelve, and plain search solved every level of three in under a tenth of a second. The complexity was in the drawing, not in the game.

## The harness

The model is Qwen3.8-Flash-Next in Intel's 4-bit AutoRound build, on one RTX PRO 6000, playing Kaggle's 110 hidden games in about nine hours. It runs inside Daniel Franzen's public Milestone 2 harness and serving fork, which is built on Tufa Labs' harness. Its only tool is a fresh Python sandbox. It sees each frame (the screen after a move) as same-color objects plus the changes between frames; the raw grid of cell values is withheld. Functions it writes are kept until the game ends.

We added notes that survive history trims, a scheduler that shares one card among the games, and two checks, both switched on in this package. Checked play runs a list of moves, each with a predicted result, and halts at the first move whose prediction fails. The rule check replays a stated rule against every recorded move of the level and answers "no evidence" when the rule never applied. This submission leaves out the splice, a cache shortcut after history trims that lost on Kaggle each time we tried it.

The loop needs no game content, and that is the whole of our universality claim. We have no result on games held out from tuning, and none outside ARC.

[Figure 2: Rule against story. "A bot removed them" beside the wa30 rule that deletes a rival.]

## What lost

In the run we can read, the checks went unused. We have no trace from the Kaggle run itself. In the nearest one, the same package cleaned of dead settings and run on our own 50-game test board, the model never called either check in the 6,608 Python calls the trace kept. It brought up checked play in its thinking more than a dozen times ("Let me not rely on it.") and then wrote its own loop that moves, compares and stops. We built the tool because winning traces wrote such a runner by hand; offered ours, the model kept writing its own. The frame still said no, through the model's code.

A bundle with compulsory prediction lost. Submission 57399562 forced a predict-before-acting check along with other changes and scored 41.37 against 52.82 for the package beneath it. A later prediction variant scored 49.07, inside the spread of our own reruns. None of these runs isolates the cause.

The model reads its notes in about one code call in a hundred. In one audit, most hypotheses were never closed, and 16 of 20 sampled corrections left the wrong claim standing beside the right one. Yet the notes arm scored 58.8 against a base of 55.9 on the test board, four runs each, with kept functions also on, so the two cannot be separated. Notes are not shown to hurt, and the store is not shown to help.

## The ruler and the luck

Our test board's standard deviation is 1.9 points over eight identical controls, so two runs cannot see effects under about four. Of the ideas we sent to Kaggle, our board liked twelve and Kaggle three. Our best, 56.02, was never rerun and was probably partly a lucky draw. The author of forge, third at Milestone 1, reported the same: local public-game checks were not a reliable leaderboard proxy.

[Figure 3: Board against Kaggle, paired per idea, with the 1.9-point noise band.]

## Adding capacity, and losing it

Our line is that intelligence is the capacity to add capacity. Budd and Scarfe write "the capacity to acquire capacity". Chollet calls intelligence "the rate at which a learner turns its experience and priors into new skills". Ours is a stock where his is a rate. Here the stock is the functions the model writes and keeps within a game. On our board it kept a median of 88 per game. The harness clears them at each new game, and 2,622 of 3,108 function names appeared in one game only. In Boden's terms, which Budd and Scarfe apply to AlphaGo, that is exploratory creativity in a fixed space whose concepts cannot "be extracted and reapplied".

Growth can also break itself. In dx22 the model rewrote its grid helper from simulator to frame reader while its solver still called the old form. Budd and Scarfe call one trap the supervisor illusion: "the creativity lives in the human's understanding, not in the AI's computation." We claim a loop, not a creative model.

## Lineage, limits, and a bet

Little of the mechanism is new: programs as world models (WorldCoder, Code World Models), replay against every recorded move (OPINE-World, with a frontier model), the interpreter as critic (Greenblatt, Berman), refinement loops (ARC Prize's 2025 theme) and library learning. Rodionov found replay verification ranks first on public ARC-AGI-3 games but costs "substantially more resources". ARC Prize's Milestone 1 page says Tufa Labs found that "hand-crafted tools actually hurt the model". Ours are hand-crafted too, and in our trace the model left them alone. What we add is narrow: a small open model, a measured case of a model ignoring an offered check, and the record of what lost.

Our bet, untested: on held-out games, with the same model and budget, a check that can halt the model will beat advice, if the model can be brought to call it unforced.

**Credits.** Daniel Franzen (Milestone 2 harness and serving fork), Tufa Labs (the harness beneath it), Intel AutoRound (4-bit weights). Team Turducken.
