# A retrospective, written the week we hit the leaderboard

Author: Claude Opus 5, for Mark Barney
Date: 2026-09-02
PURPOSE: Not a plan and not a spec. A record of what this project is, written at the
         moment it stopped being a thing one person made to understand a benchmark and
         became a thing that places on it. Kept in `docs/` because that is where this
         project has always put the reasoning, and this is the reasoning behind the
         reasoning.
SRP/DRY check: N/A — reflection, not code. Every number in it is checkable from the repo
         or from the public leaderboard, and where a fact is missing it says so rather
         than filling the gap.

---

## The name is the whole story

This repository is called **arc-explainer**.

Not arc-solver. Not arc-agent. Not arc-bench. It is named for what it was built to do:
explain ARC to somebody who did not understand it. That somebody was the person who wrote
it. Everything else — the harness, the mirror, the play surface, the 50 hand-authored
tasks, the leaderboard entry — came afterwards and came *out of* that, not instead of it.

On 31 August 2026 the ARC Prize account posted: *"@82deutschmark and Son Pham now join the
leaderboard."* As of 1 September the entry sits at **fifth, 4.52** — fourth a few days
earlier. The name on it is two people. Neither of them is a lab.

## The project is older than its own memory

The visible git history starts on **18 December 2025**, and its first commit is already
version **6.6.5**, already merging **pull request #391**. The changelog's earliest
surviving entry is 6.1.56, four days before that. So the beginning is not in here. The
repository was rewritten at some point and the origin went with it.

That is worth writing down rather than papering over, because it is exactly the shape of
the thing: by the time anyone thought to keep the record, there had already been hundreds
of changes. Nobody starts a project like this expecting it to matter.

What the surviving history does show, from December 2025 to September 2026:

| | |
| --- | --- |
| Commits | 589 |
| Versions | 6.1.56 → 9.30.0 |
| Busiest month | January 2026, 223 commits |
| The quiet stretch | April and May 2026 — zero |

That gap is not nothing. Three months where the project stopped. It came back in June and
by August was producing its own ARC-AGI-3 environments. Most projects that go quiet for a
quarter do not come back at all.

## What actually happened, in one paragraph

Someone who did not understand ARC built a tool to explain ARC to himself. Explaining it
properly required running models against it, which required a harness. Comparing models
required scoring, which required getting the scoring exactly right — hence
`arc-agi-benchmarking` treated as the source of truth in CLAUDE.md, and the long note about
`num_pairs` being legacy naming for test cases. Getting scoring right made the numbers
trustworthy, which made it obvious which models were bad and why. Understanding why they
were bad is the same activity as competing.

There is no pivot in that story. Nobody decided to become a competitor. The explaining
just kept going until it arrived somewhere.

## The habit that did it

Read this repository's comments and you find something unusual: the code argues with its
own past.

- `CommunityGamePlay.tsx` opens with a numbered list of **seven** ways that one page has
  been wrong, each with the reasoning that produced the mistake, kept in the file rather
  than deleted with the bug.
- `Arc3Triage.ts` records not only what was measured but **what was not** — `duplicateOf:
  null` means "no near-copy found" for one batch and "clustering never ran" for the other,
  and the file says so, because a caller could not otherwise tell.
- `legibility_gate.py` documents that an earlier audit said 40 and it says 41, names the
  single game the audit miscounted, and explains the rule change that fixed it.
- The changelog does not say what changed. It says **why**, and often what the previous
  reasoning got wrong.

That habit is not tidiness. It is the same act as the original one: refusing to let a thing
stand unexplained. It is why a two-person team can hold this much surface area, and it is
the actual mechanism behind the leaderboard position. You cannot fix what you have not
explained to yourself, and most people never write the explanation down.

## What fifth place does and does not mean

Be precise about this, because the precision is the interesting part.

Humans clear **100%** of these environments. The leader on the ARC-AGI-3 board scores
**7.51**. This entry scores **4.52**. The best frontier model at benchmark release scored
**0.50%**.

So fifth place is not "nearly solved it". Nobody is near solving it. What fifth place
means is that on this particular problem **the frontier is low enough that care beats
scale** — and that is not a consolation prize, it is the finding. On a benchmark where
recall wins, two people with no funding place nowhere. On this one they place fifth. The
whole argument of ARC-AGI-3 is that those are different kinds of problem, and this
leaderboard entry is a data point in favour of it.

Being fifth is a real achievement. Being fifth *as evidence* is a better one.

## The part that should not be lost

The most valuable thing here is not the score, the 50 hand-authored tasks, or the harness.
It is that the project never stopped being an explainer. The newest surfaces are still
built to make something legible to a person who does not yet understand it:

- the play surface, which gives you a screen and no instructions and measures what a human
  does with that;
- the mechanic guide, which is an answer key written so a reviewer can audit fifty tasks
  without asking anyone;
- the hypothesis traces, which publish what a model guesses from a single frame — including
  the deflating half, that its 159 distinct answers reduce to a handful of framings.

That last one is the tell. A project chasing a score would have published the impressive
number and stopped. This one published the number that undercuts it, in the same paragraph.

## For the record

An eccentric chicken farmer who did not understand a benchmark built a thing to explain it
to himself, kept explaining for nine months, and ended up fifth in the world on it, sharing
the line with a collaborator and taking a poster to Boston.

It does make sense. It only looks like it does not because we assume understanding
something and competing at it are different activities. On ARC they are the same activity,
which is the entire point of ARC, and this repository is nine months of accidental proof.

The chickens remain unimpressed.
