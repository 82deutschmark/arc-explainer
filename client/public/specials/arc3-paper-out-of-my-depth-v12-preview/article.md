# Out of My Depth

*Mark Barney and Son Pham, Team Turducken. ARC Prize 2026, ARC-AGI-3.*

> **Abstract.** Our entry sat fifth on the public ARC-AGI-3 board with a small open model whose weights never change. This essay is by the team's co-lead, a video game producer and not an engineer. It argues one claim from three sides: intelligence is the capacity to acquire capacity, the second half of that phrase is keeping it, and in our entry the keeping lives in the people and the loop around the model, not in the model.

By December 2024, when OpenAI announced o3, machines were doing the work that diplomas certify: the bar exam, the medical licensing boards. They held no credential for it and needed none. I was the opposite case. I do work I hold no credential for. I left university without a degree, my mathematics stops at calculus, and people have told me all my life that I am smart without my ever being able to check. Credential and capability had come apart from both ends, and I lost my footing. What had the exams been measuring?

School had given me a hint, early. In the late 1980s I was asked to grind through multiplication tables by hand when calculators existed, and I could not see the point. I spent the time teaching myself computers instead. Once a machine does the computation, doing it slowly by hand stops being learning and becomes a show of compliance. It cost me. I never got good at mathematics, and I am not certain the trade was right. What the calculator never told me was which problems were worth solving.

Paulo Freire described this kind of schooling as banking: the teacher makes deposits, the student receives, files and stores them, and the exam audits the account [2]. He argued for education that poses problems and treats people as unfinished beings, always still becoming. A language model is the most diligent depositor's student ever enrolled. It was filled, and it passed the finals. That told me less about the machine than about the finals.

## The test anyone can referee

I went looking for the exams it failed; I trust a thing more once I know where it breaks. That led me to François Chollet. Skill can be bought with data and built-in knowledge, so skill alone is weak evidence. Intelligence is "the rate at which a learner turns its experience and priors into new skills at valuable tasks that involve uncertainty and adaptation" [1].

His benchmark had a second property that mattered to me. I could referee it. Almost nobody can judge a model's repair of a large codebase. An ARC task a child can check. "Easy for humans, hard for AI" once sounded like a curiosity. Now that so much that is hard for humans has become easy for machines, it is the one kind of test where everyone can still see for themselves.

So I joined a machine learning contest, far out of my depth. That is a producer's ordinary condition: I am answerable for work done by people who know more than I do. When I don't know something I go and find out. Son Pham led the team with me and did the agent and performance engineering. We sat fifth of 4,923 on the public board.

## A frozen mind, one game at a time

ARC-AGI-3 is a set of turn-based games with no instructions. The player finds the goal and rules by playing, and is scored against people's move counts.

Our entry [3] runs Qwen3.8-Flash-Next, a small open model in Intel's 4-bit build, through 110 hidden games. It runs inside Daniel Franzen's public harness. The model's weights are frozen: nothing it meets in a game changes them. We did try to change them. Our fine-tunes and reinforcement learning never beat the base model on Kaggle [4].

Inside a game, though, it learns hard. The harness shows it each screen as objects and the changes between screens: general knowledge about seeing, and nothing about any game. The model guesses a rule, writes Python to test it, and the game answers. The functions it writes are kept until the game ends, a median of 88 a game on our test board. We added notes, a scheduler and two checking tools. In the nearest run we can read, the model never called our checks. It wrote its own.

This notebook scored 53.70, and 50.34 when resubmitted unchanged. A sibling scored our best, 56.02. The full record, with prior work and what lost, is in our write-up [4].

Why does it work? Almost nothing is deposited. Once we did deposit an answer: an early prompt called the bar at the edge of the screen a distraction. In 21 of the 25 public games it is the move budget. And a model that recites instead of testing loses: in one run it called a rival a confused "bot" while the rival won.

But when a game ends, the harness throws the library away. Of 3,108 functions the model named, 2,622 appeared in one game only. It begins every game having kept nothing from the last.

## Posing the problem

When ARC Prize released its game engine, we ran the benchmark in reverse. Could a machine make a game that a person finds easy?

Each official environment was given to ten people, and admitted only if at least two solved it independently, at first sight [5]. Our brief added a word: easy for people, hard for AI, and fun.

I began by repainting games that already existed. Son was making original ones, unlike anything in the public set. Then we set coding agents to it. What an agent hands back runs, has levels, and can be won. It is seldom a game. A rule turns on timing no one can see; the picture cannot show a difference the code depends on. Budd and Scarfe have the word: "Slop is what happens when an artefact is generated without path-dependence, without understanding, without respecting the phylogeny or the constraints" [6].

A game is a problem posed to someone who does not know the answer yet. To pose one well you must play it as that person, get lost where they would, and notice when being lost stops being interesting. In our hands, today's agents wrote a passable first draft and could not finish it.

Together with the agents we made 1,046 games and kept 46. Eight hundred were batch output from GPT models, and not one of those was kept [7]. Every game we kept is one a person played and sent back, in one case eight times. That person was usually me.

[[games]]

## Acquire, and keep

Beside Chollet's rate I keep a phrase of Budd and Scarfe's: "the capacity to acquire capacity" [6]. It wants a second verb. Ask of three things what each acquires and what each keeps.

Our model acquires inside a game, from its own code and a game able to say no, and keeps none of it past the last screen. Its weights acquire nothing once training ends. When a larger model ships this one will be retired and replaced, not taught. In Freire's terms it is finished. The team around it did both. Each rerun taught us something and we kept it. The entry's capacity lives in the people and the plumbing.

Everyone is talking about agency. I take it to be this capacity: meeting what you cannot do, finding out how, keeping it, and choosing what is worth doing next. Budd and Scarfe write that AI amplifies what you bring to it [6]. A tool amplifies the unfinished.

I am 44, and there is no next version of me. There is the same mind, revised daily, including this year. That is what the benchmark exists to measure and what our entry lacks. The gap worth closing is learning that outlasts a game. We also offer the games, open and each played by a person [7]. We bet they are better practice than games only a solver has checked. Nobody has measured that.

One person's taste judged the games, where ARC used ten. Our best score was never rerun, and we have not seen the private board.

I still cannot tell you how smart I am. I can tell you that I keep what I learn, and that a year ago I could do none of this.

**Thanks.** Ronen, Daniel Franzen, Tufa Labs, Intel AutoRound.

## References

[1] François Chollet. On the Measure of Intelligence. 2019. https://arxiv.org/abs/1911.01547

[2] Paulo Freire. Pedagogy of the Oppressed, chapter 2. Translated by Myra Bergman Ramos. 30th anniversary edition. Continuum, 2000.

[3] Team Turducken. Kaggle notebook, version 363005415. https://www.kaggle.com/code/sonphamorg/arc3-daniel-cnp3k5mx-ff-nosplice-o34g?scriptVersionId=363005415

[4] Team Turducken. Stuffing the Turducken. November 2026.

[5] ARC Prize. ARC-AGI-3 Technical Report, section 3.6. 2026. https://arcprize.org/media/ARC_AGI_3_Technical_Report.pdf

[6] Jeremy Budd and Tim Scarfe. Why Creativity Cannot Be Interpolated. 2026. https://archive.mlst.ai/paper/why-creativity-cannot-be-interpolated/

[7] Mark Barney. ARC-3 Synthetic Games. 8 November 2026. https://82deutschmark.github.io/arc3-synthetic-games/
