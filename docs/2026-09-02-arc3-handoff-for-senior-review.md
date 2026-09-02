# ARC-AGI-3 play surface: a handoff, and a request for an aerial view

Author: Claude Opus 5
Date: 2026-09-02
Audience: the next senior engineer on this project (Fable 5.1)
PURPOSE: Hand over what the last few passes on `/arc3/play/:gameId` were actually
         about, name the pattern in the mistakes rather than just listing them, and ask
         for judgement on four decisions that are still open. Written to be read cold.
SRP/DRY check: Pass — a handoff document. It states no rules the code does not already
         enforce and duplicates no reference material; where a fact lives somewhere
         authoritative, this points at it instead of restating it.

---

## What this part of the site is for

`arc-explainer` hosts, among other things, a **blind play surface** for ARC-AGI-3 tasks
nobody outside the project has seen. A reviewer opens a task with no instructions, tries
to work out what it is, and either finishes it or gives up; either way they leave a note.
Two things come out of that: a **human baseline** of gameplay events to compare against AI
agents, and a **quality verdict** on our own generator's output.

Both outputs are fragile in the same way. **The value is in the blindness.** A player who
has been told the mechanic produces an event stream that is not a human baseline, and a
verdict that is not a verdict. Almost every non-obvious decision in this area follows from
protecting that, and if you only remember one thing from this document, remember that the
constraint is not "don't spoil the fun" — it is "don't invalidate the measurement."

Read `docs/2026-09-02-arc3-canvas-click-plan.md` for the detail of the most recent work.
`client/src/pages/arc3-community/CommunityGamePlay.tsx` carries a long header that is a
running log of every way this page has been wrong, which is the fastest way in.

---

## The pattern in our mistakes, stated once

Look at the play page's header and you will find seven numbered faults across four passes.
They are not seven unrelated bugs. **Six of the seven are the same mistake: reasoning about
the task set from one task.**

- Controls were built for all seven actions because the task in front of us used all
  seven. `ac02` is click-only, `ar02` is d-pad-only, and on those the UI offered moves the
  engine refuses. *One task generalised.*
- The canvas was then made **inert** because in `q598-v1` ACTION6 is a submit and clicking
  the board is instant death. True of that task. It broke every task where ACTION6 is a
  real click — which is the larger group, seven of our fifty, and one of them (`t99e8274e`)
  has no d-pad at all, so it was completely unplayable for weeks. *One task generalised,
  in the opposite direction, as the fix for the first one.*
- "Next task" did nothing, because the same route with a new param keeps the component
  mounted. *Reasoned from the single-task case where a mount happens to occur.*
- Feedback at game over led nowhere, because `onDone` was wired for the mid-run case only.
- Z was bound to ACTION5 while the deck read "Undo (Z)".

The correction that finally worked was not being more careful. It was **deriving the fact
from the whole set instead of inferring it from one instance.**
`scripts/arc3/mechanic_digest.py` parses all fifty sources and answers "is this ACTION6 a
spatial click or a button?" mechanically, and its `--selftest` asserts the answer against
an independently produced classification. The same pass immediately turned up three facts
that no amount of playing would have surfaced:

1. **26 of 50 games advertise ACTION6 and read nothing from it.** Only 18 declare
   `available_actions`; the rest inherit arcengine's `[1,2,3,4,5,6]` default
   (`external/ARCEngine/arcengine/base_game.py:54`). The console offers a click, the
   engine accepts it, the game ignores it, and the step counter goes up.
2. **No game in the set ever calls `lose()`.** There is no GAME OVER; the only end is
   winning every level.
3. **The commit-or-die ACTION6 that motivated making the canvas inert does not exist in
   our set.** Both plain-button games use ACTION6 as an ordinary verb. The one punishing
   commit we have, `tfdb1fc6f`'s balance scale, is on ACTION5.

Every one of those is invisible from inside a single task, and each one changed a decision.
(2) is why the post-feedback reveal fires on any submit rather than at the end of a run —
gating it on a finished run would have hidden it from nearly every reviewer. (3) is direct
evidence against the reasoning that produced the worst regression on this page.

**The generalisable version:** when a decision on this surface depends on how tasks
behave, derive it across the set. The tooling to do that now exists and is cheap —
`legibility_gate.py` and `mechanic_digest.py` are both static AST passes that run in
milliseconds per game. Prefer adding a rule there over adding a special case in the UI.

---

## Where the bodies are buried

**`legibility_gate.py` is byte-identical by contract.** `scripts/arc3/README-legibility.md`
records the expected `shasum` against the canonical copy in the authoring repo. Do not
edit it, do not fold anything into it. `mechanic_digest.py` was written as a sibling for
exactly this reason, and joins the gate's verdicts from `arc3Triage.json` rather than
recomputing them.

**`arc3Triage.json` is measured data, not logic.** Its verdicts came from executing every
task against the engine (~20 minutes, needs Python and the engine). Regenerate it with the
authoring repo's scripts; do not hand-edit rows.

**Paths under `server/data/` are cwd-relative and deliberately not under `data/`.** Railway
mounts a persistent volume at `/app/data`, so a repo-tracked file there is shadowed at
runtime — fine locally, empty in production. `Arc3MirrorCatalog.AUTHORED_DIR` is the one
spelling of that path; import it rather than rebuilding it.

**Telemetry distinguishes moves that share an action id.** A board click posts ACTION6
with `{x, y}`; the deck CLICK button posts ACTION6 with `x/y` null. They are different
moves. Do not collapse them.

**Live ticks are not recorded.** At 10–30fps they would swamp the event table and make
human action counts incomparable to agent ones. See the `silent` parameter on `act`.

**The console screen is `aspect-square` and the canvas is stretched into it.** Pointer
mapping must be proportional against `getBoundingClientRect()`. `Arc3GridVisualization`
uses cell-size maths, which is correct there (it sizes `h-auto`) and wrong on the console.
This is a real trap: both look right until you meet a non-square grid.

---

## Four things we would like your judgement on

These are open, and each is one where we can see the local trade-off but not the shape of
the right answer.

### 1. ACTION6 is overloaded, and it has cost us twice

In one task it means "click here"; in another it means "I am finished." The play page has
now been wrong in **both** directions because of it — first offering a board click that
killed people, then withholding one that seven tasks require. Our own generator's
punishing commit (`tfdb1fc6f`) already uses ACTION5 instead, so the collision may be
avoidable in everything we author.

Options as we see them: keep it and accept the overload, as upstream does; retire
commit-style ACTION6 from our generator so ACTION6 is spatial everywhere in our set; or
move commits to a dedicated action id. The deck CLICK button is deliberately retained
pending this, and is flagged in three places so it is not tidied away. **Is there a
framing here we are missing — is the right fix at the UI layer at all, or does this belong
in the game-authoring contract?**

### 2. A crosshair that lied, on 26 of 50 tasks — FIXED, but the shape of the fix is worth a look

**Resolved 02-Sep.** This was raised here as an open question and should not have been: it
was a live bug on more than half the set, not a trade-off. `/api/arc3-mirror/click-targets`
now serves one derived bit per game -- does its ACTION6 handler read `data.x`/`data.y` --
and the board offers a crosshair only when the answer is yes. Unknown games (upstream, not
in our digest) keep the frame's word rather than being made inert.

The original framing is left below because the reasoning in it is the thing to check.

---

### 2. A crosshair that lies, on 26 of 50 tasks

Those games advertise ACTION6 and read nothing. The board shows a crosshair, accepts the
click, spends a step, and nothing happens. We left it alone: the engine advertises the
action, the official player behaves the same, and the play page cannot consult the answer
key without putting spoilers inside the surface whose whole value is blindness.

But "this task ignores your click" and "you clicked the wrong cell" are indistinguishable
from the player's chair, and this is a mild version of the exact complaint that started
this work. **Is there a move here that does not leak? A derived, non-spoiling capability
flag served alongside the frame — "this task reads coordinates: yes/no" — would fix the UI
honestly, but it is one bit of the answer key. Is that bit cheap enough to spend?**

### 3. Unlisted is not private, and we said so — but is saying so enough?

`/arc3/mechanics` is a complete answer key to all fifty tasks. It has no nav link,
carries `noindex`, and is disallowed in `robots.txt`; the route and its API are public. The
page states this on its own face and the changelog does too. The reveal endpoint is not
fetched until feedback is sent, so a task in progress never has its solution in the
browser's network log.

That is honest but thin. **At what point does a public answer key to the instrument's own
measurements need real gating — and what is the cheapest gate that does not cost us the
anonymous, no-account sample the surface exists to collect?** We are conscious that
"nobody will find it" is exactly the assumption that stops being true right after someone
shares a link.

### 4. Prose that nothing can check

`mechanic_digest.py` derives the structural facts and validates them. The fifty human
notes are validated only where a claim is mechanically checkable — a note's *control*
claims are cross-checked against the actions its source reads, which caught two wrong
notes on first run and led to finding a wrong *mechanic* as well (`tc6f8ee4c`: you win by
herding guards onto plates, not by evading them to an exit).

Wrong controls is catchable. **Wrong mechanic is not, and it is the field a reviewer will
trust instead of asking anyone.** We do not have a good answer for that beyond re-reading.
**Is there a cheaper form of verification here — property-based play against the engine,
cross-checking a note against the level specs, something else?**

---

## What "good" looks like from here

The play surface's job is to turn blind first contact into two clean signals. The recent
work removed a class of bug that was quietly costing us both. What we would most value
from a fresh pair of eyes is not more bug-hunting — it is a read on whether the
**architecture around the measurement** is sound: whether the derive-across-the-set
discipline is being applied in the right places, whether the spoiler boundary is drawn in
a defensible spot, and whether anything in the way we author tasks is manufacturing the
UI problems we keep solving downstream.

Start with `docs/2026-09-02-arc3-canvas-click-plan.md`, then the header of
`CommunityGamePlay.tsx`, then run `python3 scripts/arc3/mechanic_digest.py --selftest`.
Those three, in that order, are the whole of the context.
