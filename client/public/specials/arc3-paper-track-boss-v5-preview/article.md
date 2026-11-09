# Slop Breaks a Rule: Letting the Game Say No

*Team Turducken, ARC Prize 2026, ARC-AGI-3.*

> "Slop doesn't respect the constraints of the domain." (Mark Barney, our team lead)

## The number, and the gap next to it

ARC-AGI-3 is a set of turn-based games with no instructions. An agent has to find the goal and the rules by playing, and the benchmark scores each level by how close its move count comes to people's. Kaggle runs each entry on 110 hidden games.

This paper documents submission 57721173: Kaggle notebook sonphamorg/arc3-daniel-cnp3k5mx-ff-nosplice-o34g, script version 363005415, public score 53.70 on 28 October. The same package, resubmitted unchanged two days later, scored 50.34. Our team best, 56.02 (submission 57572304, the sibling notebook this one was built from), sat fifth of 4,923 teams on the public board, as read from our own mirror of it on 9 November. We have not seen the private board.

[Figure 1: The climb. Kaggle public score by date, mid-July to 23 October; marks 41.37, 53.70, the 50.34 rerun, 56.02. Also the cover.]

## Slop breaks a rule

Budd and Scarfe, in "Why Creativity Cannot Be Interpolated" (MLST, 2026), define it: "Slop is what happens when an artefact is generated without path-dependence, without understanding, without respecting the phylogeny or the constraints." And the other half: "The constraints do the work that deep structural knowledge would otherwise provide." Our working test is shorter. Slop looks new, and it breaks a rule the domain cares about.

ARC-AGI-3 is a good place to watch this, because every game is a program. A model's story about a game can be held up against the rule that actually runs, and when they disagree, the story is wrong.

Chollet, from the other side: priors "are not a limitation to our generalization capabilities; to the contrary, they are their source." He also warns that hard-coded knowledge can "buy" performance without any generalization. Our priors are written by people: objects, change, cause, a hint about edge bars. Nothing in our harness names a game. They can still be wrong.

## Fluent lost to the source, again and again

Their slop is a made thing; we stretch the word to a model's account of a game, and to our own writing.

In the game wa30 the player carries crates to its goal squares while rival haulers carry them to theirs, and pressing the interact key on a rival deletes it. Across 348,000 characters of thinking in one earlier run, the model said "bot" 615 times and "rival" or "ally" not once. It wrote that "a bot removed them (thinking it was delivering to the frame)". The rival was not confused. It was winning. The model never tried the key on it. One trace, not a survey.

In September our prompt did the same thing: it told the model that an edge bar is probably a timer and to "not get distracted by it". In 21 of the 25 public games that bar counts down a move budget and ends the game at zero. Our own documents did it too: a g50t action was written up as "rewind" in three of our files until someone read the source. It casts a ghost that holds down pressure plates.

Our own generated games, outside this submission, had it too: random play cleared the first level of ten of twelve, and plain search solved every level of three in under a tenth of a second. The complexity was in the drawing, not in the game. A program can certify that a game is winnable, not that people find it easy.

## The harness: let the frame say no

The model is Qwen3.8-Flash-Next in Intel's 4-bit AutoRound build, on one RTX PRO 6000, playing the hidden games in about nine hours. It runs inside Daniel Franzen's public Milestone 2 harness and serving fork, which is built on Tufa Labs' harness. Its only tool is a fresh Python sandbox. It sees each frame (the screen after a move) as same-color objects plus the changes between frames; the raw grid of cell values is withheld. Functions it writes are kept until the game ends.

We added notes that survive history trims, a scheduler that shares one card among the games, and two checks. Checked play runs a list of moves, each with a predicted result, and halts at the first move whose prediction fails. The rule check replays a stated rule against every recorded move of the level and answers "no evidence" when the rule never applied. This submission leaves out the splice, a cache shortcut after history trims that lost on Kaggle each time we tried it.

The aim is that every guess about a game becomes code and the code meets the real frame. The checks are aids the model may call; we do not yet know how often it called them in the submitted run.

The loop needs no game content, and that is the whole of our universality claim. We have no result on games held out from tuning, and none outside ARC.

[Figure 2: Rule against story. "A bot removed them" beside the wa30 rule that deletes a rival.]

## What lost

A bundle with compulsory prediction lost. Submission 57399562 forced a predict-before-acting check along with other changes and scored 41.37 against 52.82 for the package beneath it. A later prediction variant scored 49.07, inside the spread of our own reruns. In July, forcing a smaller model to predict took its predictions from none to 1,346 and its score only to baseline. A check forced on every move lost; a similar check offered as a tool is in the 53.70 package. None of these runs isolates the cause.

The model reads its notes in about one code call in a hundred. In one audit, most hypotheses were never closed, and 16 of 20 sampled corrections left the wrong claim standing beside the right one. Writing a belief down did not get it checked. Yet the notes arm scored 58.8 against a base of 55.9 on our own 50-game test board, four runs each, with kept functions also on, so the two cannot be separated. Notes are not shown to hurt, and the store is not shown to help.

## The ruler and the luck

Our test board's standard deviation is 1.9 points over eight identical controls, so two runs cannot see effects under about four. Of the ideas we sent to Kaggle, our board liked twelve and Kaggle three. Our best, 56.02, was never rerun and was probably partly a lucky draw. The author of forge, third at Milestone 1, reported the same: local public-game checks were not a reliable leaderboard proxy.

[Figure 3: Board against Kaggle, paired per idea, with the 1.9-point noise band.]

## Adding capacity, and losing it

Our own line for this: intelligence is the capacity to add capacity. Budd and Scarfe write "the capacity to acquire capacity". Chollet calls intelligence "the rate at which a learner turns its experience and priors into new skills". Ours is a stock where his is a rate. Here the stock is the functions the model writes and keeps within a game. On our board it kept a median of 88 per game. The harness clears them at each new game, and 2,622 of 3,108 function names appeared in one game only. It builds a private toolkit for each world and drops it at the next: capacity inside a game, not across games.

Growth can break itself: in dx22 the model rewrote its grid helper from simulator to frame reader while its solver still called the old form. Library size tracks how long a game lasts, not whether it is won. Budd and Scarfe would say the creativity in a system like ours lives in its supervisors. We agree, and claim a loop, not a creative model.

## Lineage, limits, and a bet

Little of the mechanism is new: programs as world models (WorldCoder, Code World Models), replay against every recorded move (OPINE-World, with a frontier model), the interpreter as critic (Greenblatt, Berman). Rodionov found replay verification ranks first on public ARC-AGI-3 games but costs "substantially more resources". ARC Prize's Milestone 1 page says Tufa Labs found that "hand-crafted tools actually hurt the model". Ours are hand-crafted too; they refuse rather than advise, and we cannot yet show that this matters. What we add is narrow: a small open model, checks that refuse, and the record of what lost.

Our bet, untested: on held-out games, with the same model and budget, tools that refuse (halt, or answer "no evidence") will beat tools that advise.

**Credits.** Daniel Franzen (Milestone 2 harness and serving fork), Tufa Labs (the harness beneath it), Intel AutoRound (4-bit weights). Team Turducken.
