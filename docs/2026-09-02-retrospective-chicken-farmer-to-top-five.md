# A retrospective, written the week we hit the leaderboard

Author: Claude Opus 5, for Mark Barney
Date: 2026-09-02 (corrected the same day — see "What the first draft got wrong")
PURPOSE: Not a plan and not a spec. A record of what this project is, written at the
         moment it stopped being a thing one person made to understand a benchmark and
         became a thing that places on one. Kept in `docs/` because that is where this
         project has always put its reasoning.
SRP/DRY check: N/A — reflection, not code. Every number is checkable from the repo or the
         public leaderboard. Where a fact is Mark's account rather than something in the
         repo, it says so.

---

## The name is the whole story

This repository is called **arc-explainer**.

Not arc-solver. Not arc-agent. Not arc-bench. It is named for what it was built to do:
explain ARC to somebody who did not understand it. That somebody was the person who wrote
it. Everything since came out of that, not instead of it.

On 31 August 2026 the ARC Prize account posted: *"@82deutschmark and Son Pham now join the
leaderboard."*

## Two different things, which the first draft of this document confused

This matters more than anything else here, so it goes near the top.

**The ARC-AGI-3 technical report figures** — humans clear 100%, the best frontier model at
release scored 0.50% — measure models given essentially unlimited resources. That is the
number on the landing page, and it is an argument about what these systems can and cannot
do.

**The ARC Prize 2026 competition on Kaggle** is a different exercise entirely. It is the
benchmark *under constraints*: fixed GPUs, a bounded notebook runtime, **no internet
access**, and therefore open-weights models you can carry in with you rather than an API
call to a frontier lab. The leaderboard score of **4.52** is that. Fourth place a few days
ago, fifth as of 1 September 2026.

Mixing the two makes the achievement unreadable in both directions. Placing fifth on a
constrained offline competition is not "scoring 4.52% where humans get 100%". It is a
different event with different rules, and the constraint is most of the difficulty.

## Standing on the duck harness

The entry is built on **Tufa Labs' duck harness** — published 1 July 2026, documented on
this site's own `/arc3` page, source at
[github.com/Tufalabs/duck-harness](https://github.com/Tufalabs/duck-harness), write-up at
[tufalabs.ai/research/duck-harness](https://tufalabs.ai/research/duck-harness/).

The name to know is **Dries Smit**, who is in this repository's history repeatedly and
long before this: he led StochasticGoose, which won the ARC-AGI-3 agent preview competition
in late 2025 with 12.58% and 18 levels, using a four-layer CNN with reinforcement learning
to predict which actions change the frame.

**Tufa Labs sits at fourth, 4.71. This entry sits at fifth, 4.52 — one place behind, on
their harness.** Mark's own description of that: like collecting sports cards and then
finding yourself on the field. That is the right register for it, and any place this
project mentions the leaderboard should mention the harness in the same breath.

## And it is mostly Son Pham

Mark's account, recorded here because it will not be visible from the code: this is largely
his project-managing **Son Pham's** work. arc3.sonpham.net is the source of truth for the
synthetic programme — the catalog, the harness, the submissions, the run data — and this
repository is the public play surface that mirrors it. The leaderboard line reads *Son Pham
& Mark Barney* and the order is not an accident.

## The project is not as young as its git history

The visible git history starts on **18 December 2025**, already at version 6.6.5, already
merging pull request #391. It is easy to read that as a lost origin. It is not lost — it is
filed.

The record goes back to **v2.0.1**, whose entry reads: *"Updated release to support
multi-test puzzles. This was a major hurdle and took a long time to implement"*, pointing
at a document dated **24 August 2025**. It lives in `docs/oldPlans/CHANGELOG-SEPT2025.md`.
Across `docs/archives/`, `docs/oldPlans/` and the live file there are **19,898 lines** of
changelog.

**Why it is split across five files is itself the story.** Mark's account: the changelog
kept being archived because it outgrew the assistants of the day. Sonnet 3.5, Haiku 3.5 and
Haiku 4 could not hold a file that size and keep working. The archive boundaries are a
record of model context limits, not of project phases.

Which means this repository has been growing in step with the capability of the tools
building it — and the current file, with its long "what this got wrong and why" entries, is
a document that could not have existed here eighteen months ago.

What the git history does show, December 2025 to September 2026: **589 commits**, versions
6.1.56 → 9.31.0, a peak of 223 commits in January 2026, and **April and May 2026 empty**.
The project stopped for a quarter and came back. Most do not.

## What actually happened, in one paragraph

Someone who did not understand ARC built a tool to explain ARC to himself. Explaining it
properly meant running models against it, which meant a harness. Comparing models meant
scoring, which meant getting scoring exactly right — hence `arc-agi-benchmarking` treated as
source of truth in CLAUDE.md, and the long note about `num_pairs` being legacy naming.
Trustworthy numbers made it obvious which models were bad and why. Understanding why they
are bad is the same activity as competing, and a collaborator who could act on that turned
it into a placement.

There is no pivot in that story. Nobody decided to become a competitor.

## The habit

This repository's code argues with its own past. `CommunityGamePlay.tsx` opens with seven
numbered ways that one page has been wrong, each kept with the reasoning that produced it.
`Arc3Triage.ts` records what was measured *and what was not*. `legibility_gate.py` documents
that an earlier audit said 40 and it says 41, names the game the audit miscounted, and
explains the rule change. The changelog says why, not what.

That is the same act as the original one: refusing to let a thing stand unexplained.

## What the first draft of this document got wrong

Kept deliberately, in the house style.

1. **It conflated the Kaggle competition with the ARC-AGI-3 report figures** — put 4.52
   next to "humans clear 100%" as if they were the same scale. They are not the same
   measurement or the same event, and the constrained, offline nature of the competition is
   most of what makes the placement mean anything.
2. **It said the origin was lost in a rewrite.** The origin is in `docs/oldPlans/` and
   `docs/archives/`, and the reason it is split there is more interesting than the loss
   would have been.
3. **It credited nobody.** No Son Pham, no Dries Smit, no Tufa Labs, no duck harness — for
   a placement that is one seat behind the people whose harness it runs on.
4. **It nearly recorded a model identifier as a date.** `2024-07-18` is the most common
   date-shaped string in the archives and it is `gpt-4o-mini-2024-07-18`.

## For the record

An eccentric chicken farmer who did not understand a benchmark built a thing to explain it
to himself. Twelve months later, with Son Pham doing the hard part and Tufa Labs' harness
underneath, that thing places fifth in a constrained offline competition — one seat behind
the lab that wrote the harness.

It does make sense. It only looks like it does not because we assume understanding
something and competing at it are different activities. On ARC they are not, which is the
entire point of ARC.

The chickens remain unimpressed.
