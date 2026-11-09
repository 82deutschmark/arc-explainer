# Out of My Depth

*Mark Barney and Son Pham, Team Turducken. ARC Prize 2026, ARC-AGI-3.*

> **Abstract.** Our entry sat fifth on the public ARC-AGI-3 board with a small open model whose weights never change. This essay is by the team's co-lead, a video game producer and not an engineer. It argues one claim from three sides: intelligence is the capacity to acquire capacity, a frozen model keeps none of what it acquires, and what our entry has lives in the loop built around it.

By December 2024, when OpenAI announced o3, machines had passed the bar exam and the medical licensing boards, and I lost my footing for a while. I hold none of those papers. I left university without a degree, and my mathematics stops at calculus. People have told me all my life that I am smart. I never had a way to check, and I never believed a diploma would have settled it. So I was not awed when a machine collected the diplomas. I was unsettled. If this is what the exams reward, what had they been measuring?

Paulo Freire had a name for the schooling I walked out of. He called it banking: the teacher makes deposits and the student stores them [2]. The exam, on that model, is an audit. It never took with me. It takes perfectly with a language model, the most diligent student that system ever enrolled, and the model passed its finals. That told me less about the machine than about the finals.

## The test anyone can referee

I went looking for the exams it failed, because I trust a thing more once I know where it breaks. That led me to François Chollet, who had made the argument in 2019. Skill can be bought with data and built-in knowledge, so skill alone is weak evidence. Intelligence is "the rate at which a learner turns its experience and priors into new skills at valuable tasks that involve uncertainty and adaptation" [1].

His benchmark had a second property that mattered to me. I could referee it. I cannot judge a model's repair to a large codebase, or its answer to a question written for specialists. Almost nobody can, so we take the machine's word, or an expert's. An ARC task a child can check. "Easy for humans, hard for AI" once sounded like a curiosity. Now that so much that is hard for humans has become easy for machines, it is the one kind of test where everyone can still see for themselves.

So I joined a machine learning contest, far out of my depth. That is a producer's ordinary condition. I produce video games, which means being answerable for work done by people who know more than I do. When I don't know something I go and find out. Son Pham led the team with me and did the agent and performance engineering. We sat fifth of 4,923 on the public board.

## A frozen mind, one game at a time

ARC-AGI-3 is a set of turn-based games with no instructions. The player has to find the goal and the rules by playing, and is scored on how its move count compares with people's.

Our entry [3] runs Qwen3.8-Flash-Next, a small open model in Intel's 4-bit build, through 110 hidden games in about nine hours. It sits inside Daniel Franzen's public harness, built on Tufa Labs'. The model's weights are frozen. It learned nothing during the contest and will learn nothing after it.

Everything the entry learns, it learns outside the weights. The harness shows the model each screen as objects and the changes between screens: general knowledge about seeing, and nothing about any game. The model guesses a rule, writes Python to test it, and the game answers. The functions it writes are kept until the game ends, a median of 88 a game on our test board. We added notes that survive trimming, a scheduler and two checking tools. In the nearest run we can read, the model never called our checks. It wrote its own.

This notebook scored 53.70, and 50.34 when resubmitted unchanged. A sibling holds our best, 56.02. Little of the mechanism is new, and the full record, with prior work and everything that lost, is in our technical write-up [4].

Why does it work? Because almost nothing is deposited. Once we did deposit an answer: an early prompt advised the model not to be distracted by the bar at the edge of the screen. In 21 of the 25 public games that bar is the move budget. And when the model recites where it should test, it loses. In one run it spent the game describing a rival as a confused "bot" while the rival was winning.

But when a game ends, the harness throws the library away. Of 3,108 functions the model named, 2,622 appeared in one game only. It begins every game having kept nothing from the last.

## Posing the problem

When ARC Prize released its game engine, we ran the benchmark in reverse. Could a machine make a game that a person finds easy?

Each official environment was given to ten people, and admitted only if at least two solved it independently, at first sight [5]. Our own brief added a word: easy for people, hard for AI, and fun.

I began by repainting games that already existed. Son was making original ones, unlike anything in the public set. Then we set coding agents to it. What an agent hands back runs, has levels, and can be won; a solver will confirm it. It is seldom a game. A rule turns on timing no one can see. The picture cannot show a difference the code depends on. Budd and Scarfe have the word: "Slop is what happens when an artefact is generated without path-dependence, without understanding, without respecting the phylogeny or the constraints" [6].

A game is a problem posed to someone who does not know the answer yet. To pose one well you have to play it as that person, get lost where they would get lost, and notice when being lost stops being interesting. In our hands, today's agents wrote a passable first draft and could not finish it.

Between the agents and ourselves we made 1,046 games and kept 46. Eight hundred were batch output from GPT models, and not one of those was kept [7]. Every game we kept is one a person played and sent back, in one case eight times. That person was usually me. Saying what a game is for, and when it is finished, is a producer's whole job. If anything in this paper is mine, it is these.

[[games]]

## The measure

Beside Chollet's rate I keep a phrase of Budd and Scarfe's: "the capacity to acquire capacity" [6].

Hold our entry to it. The model at its centre can acquire capacity only for as long as one game lasts, and only because a loop holds it: its own code, and a game able to say no. Then it is wiped. Soon a larger model will ship and this one will be retired. No one will teach it anything more. They will replace it.

I am 44, and there is no next version of me. There is the same mind, revised daily, including this year, when it learned to do this. That is the difference the benchmark exists to measure, and it is not special to games. Of a student, a model or a team, ask what it can still become, and whether it keeps what it learns.

## What this is worth

To anyone chasing the target, three things. First, a location for the gap. A small model, told nothing about any game, reached fifth. What it lacks most visibly is learning that outlasts a game, which our entry discards and which we would build next. Second, the kept games: open, each played by a person, with notes on why a machine finds each one hard [7]. We bet they are better practice than games only a solver has checked. Nobody has measured that. Third, the record of what lost [4].

One person's taste judged the games, where ARC used ten. Our best score was never rerun. We have not seen the private board.

I still cannot tell you how smart I am. I can tell you that a year ago I could do none of this.

**Thanks.** Ronen, Daniel Franzen, Tufa Labs, Intel AutoRound, and Jeremy Budd and Tim Scarfe.

## References

[1] François Chollet. On the Measure of Intelligence. 2019. https://arxiv.org/abs/1911.01547

[2] Paulo Freire. Pedagogy of the Oppressed, chapter 2. 1970.

[3] Team Turducken. Kaggle notebook, version 363005415. https://www.kaggle.com/code/sonphamorg/arc3-daniel-cnp3k5mx-ff-nosplice-o34g?scriptVersionId=363005415

[4] Team Turducken. Stuffing the Turducken. November 2026.

[5] ARC Prize. ARC-AGI-3 Technical Report, section 3.6. 2026. https://arcprize.org/media/ARC_AGI_3_Technical_Report.pdf

[6] Jeremy Budd and Tim Scarfe. Why Creativity Cannot Be Interpolated. 2026. https://archive.mlst.ai/paper/why-creativity-cannot-be-interpolated/

[7] Mark Barney. ARC-3 Synthetic Games. 8 November 2026. https://82deutschmark.github.io/arc3-synthetic-games/
