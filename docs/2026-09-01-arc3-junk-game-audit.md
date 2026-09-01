<!--
Author: Claude Opus 5 (Bubba sub-agent, label arc3-junk-audit)
Date: 01-September-2026
PURPOSE: Static AST audit of the arc3 generated game catalog (arc3.markbarney.net) for the
"commit-or-die with a hidden goal" junk class the boss hit while playing q742-v1. Reports
per-signal results for 823 fetched sources, the flagged game list, and the count sitting in
the arc-explainer review queue. Read-only audit; no catalog or repo was modified.
SRP/DRY check: Pass — new analysis, no existing audit of this failure class was found.
-->

# ARC3 Catalog Audit — the "commit-or-die with a hidden goal" junk class

> **Correction, 01-Sep-2026 (same day, by the legibility-gate task).** The headline numbers
> below are **40 flagged / 22 queued**. They are an undercount: the real figures are
> **41 flagged / 23 queued**. Signal A as implemented in `analyze2.py` counted the
> unguarded `self.lose()` inside a wrapper — `def fail(self): self.bad=True; self.lose()` —
> as an *environmental* death, so any game that wraps its death in a helper appeared to
> have a hazard and could not trip Signal A. `q718-v1` is commit-or-die with a hidden
> target vector (`self.amounts == l["target"] and effective == l["phase"] and self.sealed
> == l["intervene"]`, none of the three drawn by its renderer) and was sitting in the
> queue at rank 157. `scripts/arc3/legibility_gate.py` classifies the wrapper's call sites
> instead and reproduces every other verdict in this document exactly, game for game,
> across all 823 sources. The rest of the analysis below stands unchanged.


**Date:** 2026-09-01 · **Analyst:** Bubba sub-agent · **Mode:** read-only (network + `~/GitHub/arc-explainer`)
**Artifacts:** `/tmp/arc3audit/results.json` (per-game signals), `/tmp/arc3audit/flagged_detail.json`, `/tmp/arc3audit/crossref.json`

---

## Headline

> **22 games currently sitting in the arc-explainer review queue are of this class** — 6.0% of the 364 queued games.
> Three of them sit at **queue positions 39, 40 and 49 of 364** — a reviewer working the queue in order meets junk within the first forty games.

Total flagged across the whole generated catalog: **40 of 823** analyzed sources (all 40 are `ai-generated`; **zero** in the 252-game `redbluepill` set).
The redbluepill zero is structural, not vacuous: those 252 games register **0** Signal-A hits and only 2 Signal-B hits, while 129 of them do have environmental deaths. They are built with real hazards, so no commit-or-die game can exist among them.
Triage breakdown of the 40: **22 queued · 7 weak · 11 duplicate**. None were unprobed.

---

## The defect, stated plainly

`q742-v1` (`Tide Obligation`) — the game the boss hit:

```python
elif a==6:
 if tuple(self.history)==x["plan"] and self.actors==self.target[0] \
    and self.evidence==self.target[2] and self.claim==self.target[1]:
  self.next_level()
 else:
  self.bad=True;self.lose()
else:self.bad=True;self.lose()
```

Three properties combine into an unplayable game:

1. **ACTION6 is the only way to die.** No wall, no hazard, no timer, no enemy. Every other action is safe and reversible.
2. **The win condition is an exact match against a hidden literal** — `x["plan"]` is `(3,1,2,3,4,1,2)` at the last level, baked into the `LEVELS` table and *never drawn to the screen*. The renderer draws `actors`, `evidence`, `claim`, `debt`, `bad`; it never draws `plan`, `target`, or `history`.
3. **A wrong commit is terminal.** No partial credit, no "you were close," no retry — `lose()` ends the run instantly. The triage data corroborates this rather than merely asserting it: q742's *first* level needs only a 2-move plan, yet across 25 deaths the probe never once cleared it (`randomClearedLevel: 0`), because every wrong commit ended the run before a second guess was possible. The only flagged games random ever cleared a level of are the 12 with the shortest opening plans.

So the player is asked to guess an invisible 7-symbol sequence, gets exactly one attempt, and receives zero feedback either way. That is not a hard puzzle; it is a game with no legitimate solution path. **q742 is representative, not an outlier** — 39 other games do the same thing, most of them with the *identical* `tuple(self.history)==x["plan"]` idiom.

---

## Method

All 823 `ai-generated` + `redbluepill` sources were fetched from the mirror API (5-way concurrency, cached to `/tmp/arc3audit/src/`) and parsed with Python `ast`. 823/823 parsed cleanly; zero fetch failures.

Per-game signals, each reported independently in `results.json`:

- **Signal A — commit-only death.** All `lose()` call sites (including indirect calls through helper methods that wrap `lose()`) are collected with their full enclosing if/elif guard chain. A site is `commit` if guarded by `action == 6` alone, `dispatch_else` if it sits in the trailing `else` of the action-dispatch chain (unreachable in practice, since these games declare their action set explicitly — treated as **neutral**, not as a death path), otherwise `environmental`. **Signal A fires when ≥1 commit site exists and zero environmental sites exist.**
- **Signal B — hidden-literal win gate.** Every `next_level()`/`win()` call site's guard is decomposed into equality comparisons. A comparison fires B when (a) one side is a literal sequence, a level-dict key from a suspicious set (`plan`, `solution`, `answer`, `order`, `flow`, `target`, …), or a history-like accumulator, **and** (b) at least one term in that comparison is never read by any render/draw method. The renderability test is the discriminator that separates "hard puzzle" from "junk": a goal the renderer draws is a fair goal.
- **Signal C — wrong commit is terminal.** At least one `lose()` site is guarded by `action == 6`, i.e. pressing commit at the wrong moment ends the run. This is strictly weaker than A (429 games have a commit-death; only 216 have *no other* death), and A implies C.

**Junk verdict = A ∧ B.**

The classifier is not degenerate: 480 of 823 games have at least one environmental death site, and 213 games have *both* a commit death and an environmental death — those are correctly excluded by A. The 216 that pass A are a real architectural subset, not an artefact of `environmental` never being assigned.

### Signal counts (823 games)

| Signal | Count |
|---|---|
| A — commit-only death | 216 |
| B — hidden-literal win gate (tight) | 82 |
| B — hidden term in win gate (loose) | 522 |
| C — wrong commit terminal | 429 |
| **A ∧ B (junk verdict)** | **40** |

The loose variant of B (522) is far too broad to act on — nearly every game compares against *some* unrendered intermediate. The tight variant, which requires an exact-sequence or named-solution literal, is the actionable one.

### Validation

- **Hand spot-check, 3 flagged queued games, 3/3 confirmed:** `q246-v1` (exact `plan` tuple + hidden threshold), `q484-v1` (`self.token == checksum(x["order"], x["mod"])` — hidden permutation), `q328-v1` (`self.first == x["solution"][0]` — the *first* observation must have been the right one, decided before the player could know anything).
- **Empirical false-positive filter:** any flag on a game where random mashing cleared a level is suspect. 12 of the 40 have `randomClearedLevel: 1` — every one of them is `weak` or `duplicate`, **none are queued**. Those 12 are still commit-or-die, but their first level is short enough to be brute-forced, so the "nobody can win this" claim is weaker for them. **All 22 queued flags have `randomClearedLevel: 0` and `randomWin: false`.** The headline number is unaffected.

---

## Two sub-classes

| Sub-class | Count | Queued | Shape |
|---|---|---|---|
| Hidden **action sequence** | 31 | 14 | `tuple(self.history) == x["plan"]` — an invisible move ordering |
| Hidden **target state** | 9 | 8 | `self.v == x["target"]` — an invisible goal configuration |

The second is subtler and easier to miss in review: `q297-v1` renders the player's current seed vector but never renders the target vector, so the game looks legible while being unsolvable. `q783-v1` is the worst of these — the win gate includes `self.claim == parity(x)`, a parity computed from a `signals` list and a `bad` index that the renderer never touches, so one of the three required terms is not merely hidden but uncomputable from anything on screen.

---

## Top 10 worst offenders (queued only, by triage rank)

Note: `rank` is the probe's quality score within a generation (lower = higher `frames`/`responsive`), **not** the reviewer's queue position — see the probe section below for real queue positions.

| # | Game | Triage rank | One-line reason |
|---|---|---|---|
| 1 | `q246-v1` | 1 | Carries the batch's top `frames`/`responsive` score. Requires exact hidden 5-move `plan` **plus** matching a hidden `threshold`; any other commit = instant loss. |
| 2 | `q280-v1` | 22 | Exact hidden 7-move `plan`; commit is the only death. |
| 3 | `q742-v1` | 30 | The boss's case. Hidden 7-move `plan` + three hidden target fields, all four must match on one blind commit. |
| 4 | `q249-v1` | 37 | Exact hidden 6-move `plan`, no feedback, terminal on miss. |
| 5 | `q279-v1` | 40 | Exact hidden 7-move `plan`. |
| 6 | `q464-v1` | 41 | Exact hidden 8-move `plan` — largest hidden sequence in the queued set. |
| 7 | `q269-v1` | 44 | Exact hidden `plan`; levels generated, plan never rendered. |
| 8 | `q271-v1` | 63 | Exact hidden 8-move `plan`. |
| 9 | `q270-v1` | 67 | Exact hidden 8-move `plan`; seed of a 5-game duplicate cluster (`q272`,`q273`,`q275`,`q276`) that all share the defect. |
| 10 | `q291-v1` | 87 | Whole game state **including move history** compared to a single hidden `self.target` tuple. |

Dishonourable mentions outside the top 10: `q484-v1` (rank 241, hidden checksum over a hidden completion order), `q783-v1`/`q784-v1` (ranks 193/185, win gate depends on an uncomputable parity), `q328-v1` (rank 212, the required first move is decided before the player has any information).

---

## Full flagged list (40)

| Game | Triage status | Triage rank / dup | Hidden seq len | Random cleared lvl | Win-gate comparison |
|---|---|---|---|---|---|
| `q246-v1` | queued | 1 | 5 | 0 | `tuple(self.history) == x['plan']` |
| `q280-v1` | queued | 22 | 7 | 0 | `tuple(self.history) == x['plan']` |
| `q742-v1` | queued | 30 | 7 | 0 | `tuple(self.history) == x['plan']` |
| `q249-v1` | queued | 37 | 6 | 0 | `tuple(self.history) == x['plan']` |
| `q279-v1` | queued | 40 | 7 | 0 | `tuple(self.history) == x['plan']` |
| `q464-v1` | queued | 41 | 8 | 0 | `tuple(self.history) == x['plan']` |
| `q269-v1` | queued | 44 | — | 0 | `tuple(self.history) == x['plan']` |
| `q271-v1` | queued | 63 | 8 | 0 | `tuple(self.history) == x['plan']` |
| `q270-v1` | queued | 67 | 8 | 0 | `tuple(self.history) == x['plan']` |
| `q434-v1` | queued | 68 | — | 0 | `tuple(self.history) == plan` |
| `q291-v1` | queued | 87 | 7 | 0 | `(self.stock, self.control, self.direction, self.history) == self.target` |
| `q393-v1` | queued | 91 | — | 0 | `tuple(self.history) == x['flow']` |
| `q649-v1` | queued | 99 | — | 0 | `(self.p2, self.p3) == (x['steps'] % 2, x['steps'] % 3)` |
| `q392-v1` | queued | 100 | — | 0 | `tuple(self.history) == tuple(x['flow'])` |
| `q342-v1` | queued | 118 | 6 | 0 | `tuple(self.history) == x['plan']` |
| `q722-v1` | queued | 182 | — | 0 | `self.v == x['target']` |
| `q784-v1` | queued | 185 | — | 0 | `self.phase == x['target']` |
| `q783-v1` | queued | 193 | — | 0 | `self.phase == x['target']` |
| `q328-v1` | queued | 212 | — | 0 | `self.first == x['solution'][0]` |
| `q721-v1` | queued | 216 | — | 0 | `self.v == x['target']` |
| `q484-v1` | queued | 241 | — | 0 | `self.token == checksum(x['order'], x['mod'])` |
| `q297-v1` | queued | 250 | — | 0 | `self.v == x['target']` |
| `q238-v1` | weak | — | — | 1 | `tuple(self.history) == x['invites']` |
| `q239-v1` | weak | — | 4 | 1 | `tuple(self.history) == x['need']` |
| `q295-v1` | weak | — | 3 | 1 | `self.amounts == LEVELS[self.level_index]['target']` |
| `q339-v1` | weak | — | 6 | 1 | `tuple(self.history) == x['plan']` |
| `q341-v1` | weak | — | 6 | 1 | `tuple(self.history) == x['plan']` |
| `q556-v1` | weak | — | 8 | 1 | `tuple(self.history) == x['demo']` |
| `q794-v1` | weak | — | 7 | 1 | `tuple(self.history) == x['plan']` |
| `q240-v1` | duplicate | dup of q239-v1 | 4 | 1 | `tuple(self.history) == x['need']` |
| `q241-v1` | duplicate | dup of q239-v1 | 4 | 1 | `tuple(self.history) == x['need']` |
| `q242-v1` | duplicate | dup of q239-v1 | 4 | 1 | `tuple(self.history) == x['need']` |
| `q244-v1` | duplicate | dup of q239-v1 | 4 | 1 | `tuple(self.history) == x['need']` |
| `q245-v1` | duplicate | dup of q239-v1 | 4 | 1 | `tuple(self.history) == x['need']` |
| `q272-v1` | duplicate | dup of q270-v1 | 8 | 0 | `tuple(self.history) == x['plan']` |
| `q273-v1` | duplicate | dup of q270-v1 | 8 | 0 | `tuple(self.history) == x['plan']` |
| `q275-v1` | duplicate | dup of q270-v1 | 8 | 0 | `tuple(self.history) == x['plan']` |
| `q276-v1` | duplicate | dup of q270-v1 | 8 | 0 | `tuple(self.history) == x['plan']` |
| `q394-v1` | duplicate | dup of q393-v1 | 6 | 0 | `tuple(self.history) == x['flow']` |
| `q395-v1` | duplicate | dup of q393-v1 | 6 | 0 | `tuple(self.history) == x['flow']` |
---

## 4. Could the execution probe ever have caught this?

**No — not by accident of implementation, but by construction.**

The probe culls games that random mashing can *beat* (`randomWin == true`, `randomClearedLevel > 0`). This class is defined by being unbeatable. On every metric the probe records, a junk game is **indistinguishable from a legitimately hard, well-ranked game**:

| Metric | Flagged & queued (22) | Other queued (342) |
|---|---|---|
| `randomWin` true | 0 | 0 |
| `randomClearedLevel` max | 0 | 0 |
| `deaths` (min / med / max) | 25 / 25 / 25 | 0 / 25 / 25 |
| `frames` (min / med / max) | 10 / **60.5** / 123 | 2 / **30.5** / 783 |
| `responsive` (min / med / max) | 39 / **117.5** / 150 | 3 / **76.5** / 1200 |

The junk games don't just survive the probe — they **score better than the median queued game** on the responsiveness and frame-diversity signals, because a commit-or-die game with five safe, freely-explorable actions produces plenty of distinct frames and reacts to every input. `Arc3Triage.ts` documents `rank` as "position when its own batch's queued rows are sorted by `frames` descending, then `responsive`" — so the probe's own quality ordering actively *rewards* this class. `q246-v1` carries `rank: 1`.

One correction on how much that rank means in practice: `rank` is numbered **within a generation**, and since each generated game carries its own `generation` (parsed from `qNNN`), rank almost never breaks a tie. The live queue in `Arc3Triage.ts` sorts by `generation` descending — newest batch first, deliberately, because "this site is a filter for slop, not a showcase." Under that real ordering the flagged games land at queue positions **39, 40, 49, 53, 54, 69, 105, 116, 131, 158, 159, 198, 201, 220, 224, 234, 235, 238, 239, 240, 252, 255** of 364. Six of the first hundred games a reviewer meets are unwinnable.

Note also the `deaths: 25` column — every flagged game shows the maximum death count, because random mashing hits ACTION6 early and often and dies every single time. That signal was already in the data; nothing was looking at it in combination with `randomClearedLevel: 0`.

**The probe is a lower bound on difficulty. This class needs an upper bound, and no amount of random play provides one.**

---

## 5. A cheap automated gate

Two gates, both cheap. The static one is the real fix; the dynamic one is a free cross-check on data already being collected.

### Gate 1 — static, pre-queue (recommended; ~200 lines of `ast`, no execution, milliseconds per game)

Reject a generated game when **all three** hold:

1. Every `lose()` site (including via helper wrappers) is guarded by `action == 6`, and there are **zero** environmental death sites. *Ignore the trailing `else` of the action-dispatch chain — it is dead code when the action set is declared.*
2. A `next_level()` guard contains an equality against an exact literal sequence, a `LEVELS` key from the suspicious-name set, or a history accumulator.
3. **The hidden term is never read by any `render_*`/`draw_*` method.** This is the discriminating condition and it must not be dropped — a puzzle whose goal is drawn on screen is a fair puzzle, and skipping this check inflates the flag count from 40 to 522.

Fail the build with the offending comparison quoted, so the generator prompt can be corrected rather than the game silently discarded.

The generalisable rule underneath it, worth stating in the generator prompt directly: **every term in a win condition must be reachable from something the renderer draws.** A goal the player cannot see is not a goal.

### Gate 2 — dynamic, free (no new instrumentation)

Flag any probed game where `randomClearedLevel == 0` **and** `deaths == max` **and** `responsive` is high. That combination means "the game reacts to everything and kills you regardless" — a strong smell for commit-or-die. It is weaker than Gate 1 (it will also catch genuinely hard games), so use it to *order a human review queue*, not to auto-reject.

### Gate 3 — optional, cheap solver probe

For any game whose win gate is an exact-sequence comparison, the required sequence is a literal in the source. A five-line extractor can read `x["plan"]` directly, replay it, and confirm the game is winnable *only* by that sequence — then compute `len(actions) ** len(plan)` as the blind search space. Anything above ~10³ with no on-screen feedback is unshippable. Computed from each game's *declared* action set minus the commit button, the worst flagged levels reach `5**8` = **390,625** blind possibilities for a single level (`q270-v1`, `q271-v1` and their four duplicates), with one attempt allowed.

---

## Scope and limits

- **Read-only throughout.** Catalog accessed via GET only; `~/GitHub/arc-explainer` was read, never written; all working files live in `/tmp/arc3audit/`.
- 823 of 877 catalog games analyzed — the 29 `custom` and 25 `official` games were out of scope per the task.
- Signal A treats an unreachable dispatch `else` as neutral. If a game declares an action set that does not match its dispatch chain, that `else` becomes live and the game would be misclassified; none were observed.
- The 12 flags with `randomClearedLevel: 1` are reported as flagged but empirically softened — their first level is brute-forceable. All are `weak` or `duplicate`; none affect the queued headline.
- Severity ranking uses the longest literal sequence found in the level table, which reads `0` for games whose levels are built by comprehension rather than literal dicts. Those are not less severe, just not measurable by that particular metric.
