# Fifth Is Evidence: An Outsider's Field Notes from the ARC-AGI-3 Frontier

*Team Turducken. We are not first, so we will not pretend to be. Instead: what a small open model, a handful of universal tools and a few months of stubbornness taught us about measuring intelligence.*

## Where we came from

Mark, who leads this write-up, puts it plainly: "I had never heard of ARC before maybe May 2025. Been watching like a hawk since the preview dropped in July 2025." He is not an AI researcher. He is the kind of person ARC was built to invite: someone who saw a set of puzzles any person could solve and that the best machines could not, and couldn't stop looking.

Our first scored entries to ARC-AGI-3 on Kaggle, in mid-July 2026, landed below one point. On that same day the best score on the entire board was under two. About a year and a half after Mark first heard the name, our team finished the public leaderboard in fifth place out of nearly five thousand teams. We think that path is itself a finding: the frontier on this benchmark is reachable by outsiders who build carefully, measure honestly and copy good public work quickly.

## What we submitted

This paper documents **submission 57721173**, public score **53.70**, kernel *sonphamorg/arc3-daniel-cnp3k5mx-ff-nosplice-o34g*, script version 363005415, submitted 28 October 2026. Our best public score, **56.02** (submission 57572304, 23 October), came from the sibling package this one was built on; that is the score that sits fifth on the board.

The system in one paragraph. A 4-bit build of Qwen3.8-Flash-Next (Intel AutoRound weights) runs on one RTX PRO 6000 through Daniel Franzen's serving fork, inside his public Milestone 2 harness, which is in turn built on Tufa Labs' harness. The game interface is theirs, not ours, and we are grateful for it. The model's only tool is a fresh Python sandbox. It sees each frame as segmented objects and diffs rather than raw numbers, acts through a single action call, and keeps any function it writes for the rest of that game. Our team added notes that survive history trims, checked play that stops at the first move whose prediction fails, rule replay against every recorded move of a level, and a scheduler that shares one card among all 110 hidden games by trimming, swapping and occasionally wiping their conversations. Nothing in the harness names a game.

*[Figure 1: context management]*

## The razor's edge

"At the start of this competition our first submissions scored below 1," Mark wrote. "If this isn't the razor's edge of the frontier, I don't know what is." The board history bears him out, and the real numbers are sharper than his memory. In mid-July the leader stood below two. By the end of August it was 7.51. By the end of September it was just over fifty. The top of the board moved more in September alone than in the five months before it.

That is what novelty looks like from the inside. Nobody had played these games before the competition, so there was no known method to refine. We were part of a crowd inventing one in public, each team building on whatever the last team shared. Our contribution to that commons is a measured one: in a fifty-game trace study on our own test board, the model kept a median of 88 functions per game, and of 3,108 distinct function names, 2,622 appeared in one game only. The agent writes a private language for each world, uses it and throws it away.

## Measured by Chollet's ruler

Chollet's *On the Measure of Intelligence* defines it this way: "The intelligence of a system is a measure of its skill-acquisition efficiency over a scope of tasks, with respect to priors, experience, and generalization difficulty." ARC-AGI-3 measures that directly: hidden games, no instructions, scored on how few actions an agent needs compared with people.

The same paper names the hardest kind of test, developer-aware generalization: "the ability of a system, either learning or static, to handle situations that neither the system nor the developer of the system have encountered before." That is our situation exactly. We never saw the 110 hidden games. So everything we wrote had to be universal: see objects, see change, act, test a guess, keep what works. Those five abilities make sense in any world built from objects and actions, which is why we believe the recipe carries well beyond ARC. Everything specific to a game, the model wrote for itself, during play.

## Why it works: creativity cannot be interpolated

Budd and Scarfe argue that "novelty alone is not creativity": genuine creativity needs respect for constraints, the accumulated structure of what came before, and current models lack it. They are blunt that "constraints, not freedom, are the soul of creativity," and they point out that the pattern which has repeatedly worked on ARC is generate-and-test: a model proposes programs, and something outside it, often a Python interpreter, checks them.

That is the best account we have of why our system scores. A language model on its own interpolates. Put it in a world it has never seen and it will produce plausible moves that are wrong. Our harness surrounds it with constraints it cannot argue with: every guess about a game becomes code, every piece of code meets the real frame, and checked play halts the moment a prediction fails. The functions it keeps are its accumulated structure; the notes are its record of what reality refused. As Budd and Scarfe put it, the constraints "do the work that deep structural knowledge would otherwise provide."

They would also tell us, fairly, where the understanding in our system lives: largely in the universal layer people wrote. We agree. Our five months were humans and models working together, with people choosing the constraints and models doing the tireless exploration inside them. That is the co-creative path their paper recommends, and fifth place suggests it works.

## Fifth place as an argument

"Everyone talks a big game about their philosophy of this that or the other thing," Mark says. "We scored fifth. Something about what we're doing isn't too far off." We take that seriously as a claim, and we also show where it is weak.

The board is noisy. The exact package documented here scored 53.70 when first submitted and 50.34 when resubmitted two days later, unchanged. Our best, 56.02, was never re-run and was probably partly a lucky draw. Our only memory ablation (notes and retained functions switched on together) gained about three points on our own board, with a confidence interval that crosses zero. Library size does not predict winning a game; it tracks how long the game lasts. Many ideas our own board loved lost on Kaggle.

What survives the noise is the shape of the result: across many submissions, a small open model with universal tools and no game-specific code stayed in the top handful of nearly five thousand teams.

*[Figure 2: what our board liked versus what Kaggle scored]*

## Accurate enough?

"5th on the LB out of 5k... accurate enough? Over 50% too!" The facts, precisely: this submission scored 53.70; our team best of 56.02 placed fifth of 4,923 teams on the public leaderboard when the board closed. ARC-AGI-3 scores each level on action efficiency against human players, so over fifty is not "half the games solved". It means that in worlds it had never seen, our agent earned more than half of what matching human efficiency on every level would earn. On the razor's edge, that is accurate enough for us.

## For the next team

Write tools for what is universal and let the model write the rest. Check every guess against the frame. Keep the model's own code, and re-test it when it changes. Treat one leaderboard score as one draw. And if you are an outsider who heard of ARC last year: the edge is closer than it looks.

## Credits and references

Daniel Franzen (Milestone 2 harness and serving fork), Tufa Labs (the harness beneath it), Intel AutoRound (4-bit weights). Team Turducken: Son Pham, Mark Barney, Ronen Dunlea, Keith Tyser, NT, Cho Royou, Slow∞Loop.

- F. Chollet, *On the Measure of Intelligence*, arXiv:1911.01547, 2019. https://arxiv.org/abs/1911.01547
- J. Budd and T. Scarfe, *Why Creativity Cannot Be Interpolated: And Why Understanding Is the Path to Get There*, Machine Learning Street Talk, version 1.2, February 2026. https://archive.mlst.ai/paper/why-creativity-cannot-be-interpolated

