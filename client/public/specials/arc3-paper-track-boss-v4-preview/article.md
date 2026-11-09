# Slop Breaks a Rule: Letting the Game Say No

*Team Turducken, ARC Prize 2026, ARC-AGI-3. A small open model, a live frame as critic, and a record of what lost.*

> "Slop doesn't respect the constraints of the domain." (Mark Barney, our team lead)

## The number, and the gap next to it

This paper documents submission 57721173: kernel sonphamorg/arc3-daniel-cnp3k5mx-ff-nosplice-o34g, script version 363005415, public score 53.70 on 28 October. The same package, resubmitted unchanged two days later, scored 50.34. The gap between them is part of what we found. Our team best, 56.02 (submission 57572304, the sibling kernel this one was built from), sat fifth of 4,923 teams on the public board, as read from our own mirror of it on 9 November. We have not seen the private board. Our scored entries started below one point in mid-July.

[Figure 1: The climb. Kaggle public score by date, mid-July to 23 October; marks 41.37, 53.70, the 50.34 rerun, 56.02. Also the cover.]

## Slop breaks a rule

Budd and Scarfe, in "Why Creativity Cannot Be Interpolated", define it: "Slop is what happens when an artefact is generated without path-dependence, without understanding, without respecting the phylogeny or the constraints." And the other half: "The constraints do the work that deep structural knowledge would otherwise provide." Our working test is shorter. Slop looks new, and it breaks a rule the domain cares about.

ARC-AGI-3 is a good place to watch this: every game is a program. A model's story about a game can be held up against the rule that actually runs, and when they disagree, the story is wrong.

Chollet makes the same point from the other side: priors "are not a limitation to our generalization capabilities; to the contrary, they are their source." He also warns that hard-coded knowledge can "buy" performance without any generalization. Our priors are written by people: objects, change, cause. Nothing in our harness names a game or states its rules.

## Fluent lost to the source, again and again

We stretch Budd and Scarfe's word here: their slop is a made thing, and we apply it to a model's account of a game and to our own writing.

In the game wa30, pressing the interact key on a rival hauler deletes it. Across 348,000 characters of one run's thinking, the model said "bot" 615 times and "rival" or "ally" not once. It wrote that "a bot removed them (thinking it was delivering to the frame)". The rival was not confused. It was winning. The model never tried the key on it. One trace, not a survey.

Our prompt did the same thing. In September it told the model that an edge bar is probably a timer and to "not get distracted by it". In 21 of the 25 public games that bar counts down a move budget and ends the game at zero. Our own documents did it too: a g50t action was written up as "rewind" in three of our files until someone read the source. It casts a ghost that holds down pressure plates.

Our own generated games, outside this submission, had the same disease: random play cleared the first level of ten of twelve, and plain search solved every level of three in under a tenth of a second. The complexity was in the drawing, not in the game. A program can certify that a game is winnable. Only a person playing can certify that it is easy for people.

## The harness: let the frame say no

The model is Qwen3.8-Flash-Next in Intel's 4-bit AutoRound build, on one RTX PRO 6000, playing all 110 hidden games in about nine hours. It runs inside Daniel Franzen's public Milestone 2 harness and serving fork, which is built on Tufa Labs' harness. Its only tool is a fresh Python sandbox. It sees each frame as segmented objects and the changes between frames; the raw grid is withheld. Functions it writes are kept until the game ends.

We added notes that survive history trims, a scheduler that shares one card among the games, and two checks. Checked play runs a list of moves with predicted results and halts at the first move whose prediction fails. The rule check replays a stated rule against every recorded move of the level and answers "no evidence" when the rule never applied. This submission leaves out the splice.

Every guess about a game becomes code, and every piece of code meets the real frame. The critic is the live frame. The checks are aids the model may call, and we do not know how often it called them in the submitted run. That is the number this paper most lacks.

The loop needs no game content; that is the honest extent of our universality claim. We have no result on games held out from tuning, and none outside ARC.

[Figure 2: Rule against story. "A bot removed them" beside the wa30 source rule that deletes a rival.]

## What lost

Compulsory prediction lost. Submission 57399562 forced a predict-before-acting check, bundled with other changes, and scored 41.37 against 52.82 for the package beneath it. A later prediction variant scored 49.07, inside the spread of our own reruns. In July, forcing a smaller model to predict took its predictions from none to 1,346 and its score only to baseline. A check forced on every move lost; a similar check offered as a tool is in the 53.70 package. Nothing isolates why.

Notes are murkier. The model reads its notes in about one code call in a hundred. In one audit, most hypotheses were never closed, and 16 of 20 sampled corrections left the wrong claim standing beside the right one. A belief written down gets repeated, not checked. Yet the notes arm scored 58.8 against a base of 55.9 on our board, four runs each, with kept functions switched on alongside. Notes are not shown to hurt, and the store is not shown to help.

## The ruler and the luck

Our test board's standard deviation is 1.9 points over eight identical controls; two runs cannot see effects under about four. Of the ideas we sent to Kaggle, our board liked twelve and Kaggle three. The 53.70 package rescored 50.34. Our best, 56.02, was never rerun and was probably partly a lucky draw. The author of forge, third at Milestone 1, reported the same: local public-game checks were not a reliable leaderboard proxy. We claim the measurement, not the discovery. One Kaggle score is one draw.

[Figure 3: Board against Kaggle. Paired dots per idea, board versus Kaggle, with the 1.9-point noise band.]

## Adding capacity, and losing it

Our own line for this: intelligence is the capacity to add capacity. Budd and Scarfe write "the capacity to acquire capacity". Chollet calls intelligence "the rate at which a learner turns its experience and priors into new skills". Ours is a stock where his is a rate, and the model does add some. On our own 50-game board it kept a median of 88 functions per game, and 2,622 of 3,108 function names appeared in one game only. It writes a private language for each world and loses it at the next: capacity inside a game, not across games.

Growth can break itself: in dx22 the model rewrote its grid helper from simulator to frame reader while its solver still called the old form. Library size tracks how long a game lasts, not whether it is won. Budd and Scarfe would say the creativity in a system like ours lives in its supervisors. Fair enough. We claim a sturdy loop, not a creative model.

## Lineage, limits, and a bet

Little of the mechanism is new: programs as world models (WorldCoder, Code World Models), replay against every recorded move (OPINE-World, with a frontier model), the interpreter as critic (Greenblatt, Berman). Rodionov found replay verification ranks first on public ARC-AGI-3 games but costs "substantially more resources". ARC Prize's Milestone 1 page says Tufa Labs found that "hand-crafted tools actually hurt the model". Ours are hand-crafted too; they refuse rather than advise, and we cannot yet show that the difference matters. What we add: a small open model, checks that can say no, and a record of what lost.

**What a hostile reviewer would say.** No ablation isolates the harness: true. Fifth may be luck: partly. The checks may have sat unused: we do not know.

Our bet: on games held out from tuning, tools that refuse will beat tools that advise.

**Credits.** Daniel Franzen (Milestone 2 harness and serving fork), Tufa Labs (the harness beneath it), Intel AutoRound (4-bit weights). Team Turducken.
