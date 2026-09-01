<!--
Author: Claude Opus 5 (Bubba sub-agent, label arc3-legibility-gate)
Date: 01-September-2026
PURPOSE: The two questions the legibility-gate task was asked to consider rather than
build — whether the arena's verifier/mutation harness should gain a legibility check, and
whether `rank` should stop rewarding frames/responsive in a way that promotes unwinnable
tasks. Recommendations with the evidence, and what was deliberately left unbuilt.
SRP/DRY check: Pass — no existing doc covers either question; the audit
(2026-09-01-arc3-junk-game-audit.md) reports the defect, this reports what to do next.
-->

# Legibility gate — two open questions

Context: `scripts/arc3/README-legibility.md` and `docs/2026-09-01-arc3-junk-game-audit.md`.
The gate itself shipped. These two were scoped as "recommend, build only if small and
clearly right". Neither met that bar; here is the reasoning and what I would do.

## 1. Should the verifier / mutation harness gain a legibility check?

**Recommendation: yes, but a different check from this one, and not urgently.**

The arena's `arc3games/verifier_harness.py` already asks the strongest question anyone is
asking of these games: it declares an `ai_failure_mode`, supplies a FOIL — a plausible
agent policy that *must fail* on a board legitimately claiming that mode — and refuses
(exit 2) if the foil wins or was never exercised. That is a real adversarial check and it
is the natural home for a *dynamic* legibility test.

The static gate cannot answer the question the harness could. It proves the goal is
*mentioned* by a render method. It cannot prove the goal is **legible from the frame** —
drawn distinctly enough, early enough, and differently enough between a winning and a
losing state that a person could act on it. The check worth building there is:

> Render the frame at every state on a winning path and at the states that differ from it.
> If two states with different correct actions produce identical frames, the game is not
> legible: the player is being asked to distinguish states it never shows apart.

That is a frame-diff over the search the harness already runs (`Model`, `search()`,
`reachable_states()` are all present), so it is genuinely cheap *in the harness*. It is not
cheap in this task's scope — it needs the engine, a real render, and a per-game notion of
"correct action" — and it would have caught **none** of the 41, because they fail the
static test first and never get that far.

**Not built.** It belongs with whoever next touches `verifier_harness.py`, as a Part C
alongside the foil machinery, not bolted on from outside.

## 2. Should `rank` stop rewarding `frames` / `responsive`?

**Recommendation: no change to the ordering. Fix entry, which is what the gate does.**

The evidence that `rank` promotes this class is real. From the audit, flagged-and-queued
(22) against other queued (342):

| Metric | Flagged & queued | Other queued |
| --- | --- | --- |
| `frames` median | 60.5 | 30.5 |
| `responsive` median | 117.5 | 76.5 |

`rank` is "position when its own batch's queued rows are sorted by `frames` descending,
then `responsive`", so an unwinnable task with five safe explorable actions and a commit
button that reacts every time ranks *better* than a real game. `q246-v1` carried rank 1.

Three reasons not to touch it anyway:

1. **It is not the ordering.** `Arc3Triage.queue()` sorts by `generation` descending; rank
   only breaks ties *within* a generation, and since `generation` is parsed per-task from
   `qNNN`, it almost never breaks a tie at all. Reweighting a field that orders nothing
   would be motion, not a fix.
2. **The metrics are not wrong, the inference was.** `frames` and `responsive` measure
   whether a task is built out and reacts to input. They are the right questions. What
   went wrong is that nothing asked whether the task can be *won*, and that is now asked
   at the gate, before rank is ever computed. Fixing a symptom downstream of a fixed cause
   adds a second thing to keep in sync.
3. **Changing queue order is the boss's call, not a side effect of a defect fix.** The
   ordering carries an explicit rationale in `Arc3Triage.ts` ("this site is a filter for
   slop, not a showcase") and reversing part of it inside an unrelated PR is how a
   deliberate decision gets undone by accident.

**Built instead:** a caveat in the `QUEUE` doc comment in `Arc3Triage.ts` saying plainly
that rank rewards exactly what this class is good at, so nobody promotes it to a primary
sort without knowing.

## 3. The dynamic cross-check the audit proposed (Gate 2)

The audit suggested flagging `randomClearedLevel == 0 && deaths == max && responsive high`
as a cheap smell, using data already collected. **Not built, and I would not build it.**
It is strictly weaker than the static gate — it also catches genuinely hard games — and its
only proposed use was to *order a human review queue*, which is the thing we just decided
not to reorder. All 23 tasks it would have surfaced are already gone from the queue by a
check that gives a quotable reason instead of a smell.

## 4. What the gate still does not cover

Stated plainly because it is the honest limit of the fix:

- **The generator that produced all 41 is not in either repo.** `grep -r redbluepill` and
  `grep -r ai-generated` over `sonpham-org/autoresearch-arena` return nothing; the `qNNN-v1`
  set comes from a generator outside both. The arena-side wiring
  (`make_submission.py` refuses to package) protects the hand-authored `gNNN` line, and
  this repo's gate cleans the queue after the fact. **Nothing yet stops the `qNNN`
  generator from emitting a 42nd.** That needs whoever owns that loop to run the gate
  before publish; the file is one stdlib import and a function call.
- **"Never read by a render method" is a lower bar than "legible".** See question 1.
- **The gate reads only the shape it was built for.** A hidden *threshold* compared with
  `<` rather than `==`, or a goal computed at render time from something invisible, is a
  neighbouring defect it does not detect.
