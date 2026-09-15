<!--
Author: Claude Opus 5
Date: 02-September-2026
PURPOSE: What six official ARC-AGI-3 games actually do, read as a player rather than as a
         codebase, and what that says about the 50 synthetic games in this directory.
         Written to be consumed by the polishing loop alongside GLOWUP_RECIPE.md, and
         mirrored into arc-explainer so the site can serve it.
         CORRECTED 15-September-2026: the `cn04` reading below, and two of the seven patterns
         drawn from it, were wrong about level 5. See "Correction, 15-Sep-2026" under the
         `cn04` entry. The correction is itself a finding about method, not just about cn04.
SRP/DRY check: Pass. GLOWUP_RECIPE.md owns the rules a cycle must follow; this owns the
         evidence behind them and the design ideas not yet turned into rules. Nothing here
         restates a rule; where an idea has become one, this points at its name.
-->

# Six official games, read as a player

Six games from `arc-explainer/external/ARCEngine/environment_files/`, each studied and then
**challenged by a second reader whose job was to refute the first**. That check was not a
formality: **three of the six first readings were substantially wrong**, including two where
the obvious visual interpretation was the trap. Corrected readings are below.

**All six readings are now checked.** The first pass lost two agents to a session limit; both
were re-run. Notably `dc22`'s checker **actually played the game** rather than reading it, and
still found the second half of it missing from the first description.

**And "checked" was still not enough.** On 15-Sep-2026 a human won `cn04` and reported a level-5
mechanic that neither the reading nor its refuter had found, and that a *third* pass had actively
deleted as fabricated. Both readings here were done by reading source. `dc22`'s was the only one
done by playing, and it is the only one that found a game's second half. That is the pattern: a
source read finds the primitives, a playthrough finds what the primitives add up to on screen.
See the correction under `cn04`.

---

## What each game turned out to be

**`tr87` — translation with a dictionary.** A phrase in one alphabet, a wall of paired runes
as the only dictionary, and you spell the phrase out in a second alphabet. The trap is
assuming the pink rune is the cyan one rotated: the angles are random and mean nothing, so
it can only be looked up, never derived. Late levels route through a third alphabet that
appears in the dictionary and never in the phrase, then freeze the phrase and hand you the
**dictionary itself to repair**.

**`bp35` — floating up a flooded shaft.** You steer only left and right; height is always a
consequence, never a command, which is exactly why it reads as floating. Something rises
from below and **only gains on you during moves where you failed to rise**. Later, the
specks you had written off as wallpaper turn out to be the controls — see-through shapes you
had been swimming through go solid when clicked, and a decorative band flips which way is
down.

**`wa30` — Sokoban with company.** Crate-hauling with Sokoban's verbs but no dread, because
you can always pull, so no move is unrecoverable. From the second board on you are never the
only one hauling: a unit on the far side of an uncrossable line does your job for you, one
cell per key you press. Later a second unit does the identical thing toward the wrong bay
and will lift a crate out of your hands.

**`cn04` — matching marks, not welding.** The welding read was wrong. **Two to five** loose
parts, each printed with marks; you hold one at a time and slide, turn or **grow** it until
every mark meets a matching mark on another part. A mark goes dark the instant it is
satisfied. From level 3 on, **only the part in your hand shows its colour and marks at all** —
everything else is flattened to grey.

> **Correction, 15-Sep-2026 — and the correction is the interesting part.**
>
> This reading said "slide, turn or stretch". A later re-verification pass grepped `cn04.py`
> for a resize primitive, found none, and deleted "stretch" as a fabrication. **Both of those
> passes were wrong, in opposite directions, and the deletion was the worse error.**
>
> What actually happens: Interact (`ACTION5`) is a 90° rotation on every part in **all of
> levels 1–4**. From level 5 some parts are built as a **stack of nested variants of the same
> shape sharing one spawn anchor**, and on those parts Interact **never rotates at all** — it
> steps up the stack, so the part visibly **grows**. It always opens on the smallest variant,
> the stepping **bounces** at the largest rather than wrapping, and the larger variants carry
> marks the smaller ones do not have. Level 5's yellow part shows **3 marks at its starting
> size and 7 at full extent**. Level 6 does it twice: a six-deep yellow stack and a four-deep
> purple one. Levels 1–4 contain **zero** stacks.
>
> So there is no resize *action* and the part gets bigger anyway, because the growth is a
> **sprite swap**. The original reading was describing something real; the re-verification
> looked for an implementation of it, found none, and concluded the observation was invented.
> **A documentation method that only trusts implementation primitives will keep deleting true
> player-observed behaviour**, and that is a standing hazard for every game in this document,
> not a one-off about `cn04`.
>
> Also still wrong after that pass: the part count. It was "corrected" from "three to five" to
> "2 to 13", but 13 counts **sprite entries**, and levels 5 and 6 stack several entries on one
> anchor. Distinct anchors per level are 2, 4, 3, 4, 4, 5 — the manipulable-part range is
> **2 to 5**, so the original "three to five" was closer than its correction.
>
> Source, cited: `cn04.py:1066-1075` (the `ACTION5` branch — `if len(group) > 1: cycle else:
> rotate(90)`), `:843-858` (stacks grouped by shared anchor, sorted by `layer`; in every stack
> the only `visible=True` member is `layer=1`, the smallest), `:1111-1135` (the bouncing cycle),
> `:677-775` (the level table). Found by a human win, guid
> `f714032e-914d-4bb5-bc95-386dfacebca0` — WIN, 6/6, 454 actions, under the per-level action
> baseline on all six levels.

**`dc22` — building the floor you walk on.** A walker has to reach a goal, but most of the
floor does not exist yet; you press buttons on a side panel that reshape platforms across the
board. A wrong press irises the screen to black, rewinds one move and charges the budget — it
never kills you, it just makes mistakes expensive. **The half we missed:** from the fifth level
the panel stops being more colour buttons and grows a claw that rides a painted track, moving
twice as far as the walker and clamping onto a pillar you then stand on. Coloured pads fling
you to their twin. The panel itself grows: a missing button appears only after you fetch a
token on foot.

**`lf52` — peg solitaire across linked rooms.** Click a piece, click where it lands, it hops
a neighbour off the board. A rail cart ferries a piece between rooms. Its famous button is
**not** a move-confirm: it restarts a level you have broken.

---

## The patterns worth copying

**1. Every move should return a verdict.** `cn04` is the clearest case in the set: the win
condition is printed on the pieces as a per-cell checklist that goes out one mark at a time,
so you can always count what is left and see which cell is still wrong. Our games hide the
rule and grade per room — you either open the door or you do not, and a wrong hypothesis
returns silence, so the player wanders. **Narrowed 15-Sep-2026:** "you can always count what
is left" holds through level 4 and **fails on levels 5 and 6**, where a stacked part's larger
variants carry marks that are not on the board until the part is grown into them. The pattern
still stands — a per-item checklist beats a per-room pass/fail — but `cn04` does not actually
show you the whole checklist at all times, and this document said it did, twice.

**2. Charge the clock for failure, not for time.** In `bp35` the thing chasing you only gains
ground on moves where you did not make progress. Thinking is free; flailing costs. It reads
as generous, and it silently teaches the player what the game counts as progress without a
word of instruction. Where we run a clock at all, it ticks on every action, punishing thought
exactly as hard as it punishes mashing.

**3. Let the scenery turn out to be load-bearing.** `bp35` again. Decoration that is genuinely
inert for three levels and then becomes a control is worth far more than decoration that is
inert forever, because the player must re-examine everything they had dismissed. Our
`decoy` rule currently asks only for the inert half.

**4. Make a control arrive as an event.** `lf52` does not leave a dead button on screen from
the start. The board reacts first, then a beat of silence, then the button rises in from
off-screen and settles. Nothing else in that game ever enters from outside, so its arrival is
unmistakable and never needs explaining. In our set, whatever is on screen at the start is on
screen forever, so a control appearing could never mean anything.

**5. Put somebody else on the board who wants something.** `wa30`'s helper does the player's
job unasked; its twin does the same job toward the wrong bay. Both move exactly one cell per
keypress, so neither outruns the player. That one addition turns a barrier from a dead end
into a hand-off counter. Our push-block games are solitaire against a fixed world: nothing on
our boards wants anything, so each level has one plan, worked out once and then executed.

**6. Hide the arrangement, not the goal.** `cn04` shows the whole win condition and hides only
which pieces carry which marks. That makes wandering almost impossible while keeping the
puzzle hard. It is the opposite of our habit, which is to hide the goal and let the player
discover it by failing.

**Corrected 15-Sep-2026 — this was drawn from a false premise, and the true version is a better
idea.** `cn04` does **not** show the whole win condition. On level 5, four of the yellow part's
seven marks **do not exist on the board** until you grow the part, and nothing on screen says
the part can grow. So the real move is not "show the goal, hide the arrangement" — it is
**hold back part of the goal behind an action the player has been taught means something else.**
Interact is a rotation across the whole of levels 1–4. An agent or a player who induces
"Interact = rotate" from four levels of consistent evidence arrives at level 5 holding a rule
that is **false, not incomplete**, and the board they are planning against is not the whole
board. That is a rule *inversion* after a deliberate training period, and it is strictly harder
and more interesting than withholding the goal outright — which, as pattern 6 originally said,
just makes players wander. Our 50 have nothing like it: an action in our set means the same
thing on every object from the first frame to the last.

**7. Eventually, hand over the rulebook.** `tr87`'s late levels freeze both the question and
the answer and let the player repair the broken dictionary that connects them. Same board,
same controls, opposite direction of thought. Not one of our 50 ever lets the player edit the
rules rather than execute them.

---

## The Sokoban verdict, which does not go the way we assumed

The premise was that `wa30` already does Sokoban well, so our push-block games have nothing
left to offer. **That is half right, and the half that is wrong matters.**

`wa30` lets you pull as well as push. No move is unrecoverable, so it has no dead corners and
no moment where you realise the level died ten turns ago and must restart. **Our four Sokoban
games are built on exactly that tension**, which `wa30` deliberately does not have. So they
are not redundant with it.

What they genuinely lack is `wa30`'s real idea, which is not pushing at all — it is that
somebody else is on the board hauling too. That is the thing worth taking.

**So the standing rule holds but for a better reason.** Sokoban stays at the back of the
queue because the genre is in-distribution, not because `wa30` has already covered it. And
if a push-block game is ever revisited, the change worth making is adding a second hauler,
not improving the pushing.

---

## The brief, written after all six were checked

# What we're missing

Our games are correct and legible, which is most of the job. What separates them is that every one of ours states its single idea in the first ten seconds and never revises it. The official games are built around a moment where the player's model breaks — you discover there is no up button, that the wall you can't cross has a worker on the other side of it, that the button which has meant "turn" for four levels now means "stretch." They get that out of four to six controls, not out of more content. They add meanings rather than buttons, and they raise difficulty by changing what the player can *see* rather than by enlarging the board. That's the gap. It isn't art, theme, or variety.

# The recurring shapes

**One button, many meanings.** In the connector game the turn button silently becomes a stretch button the first time you hold a piece that grows; in the crate game the same key drops your cargo when your hands are full and destroys a thief when they're empty. The control set never grows, so every new meaning is learned by pressing a key you already trusted.

**The world moves without you.** In the floating game you steer only left and right and rise on your own, so pressing sideways isn't walking — it's hunting for the gap in the ceiling. Elsewhere a claw rides a painted track, coloured pads fling you across the level, and whole rooms slide in from off-screen; position becomes a consequence of a decision rather than the decision itself.

**The board is not one kind of block.** Two shades of red that look identical on screen and only count against their own kind; pegs you may hop over that are never captured, sitting among pegs that are; a yellow button that drives a grey platform. Pieces that look alike behave differently, and you find out by touching them — that is the direct cure for "blocky."

**Someone else is working.** A helper on the far side of an uncrossable line hauls loose crates to the delivery floor, one step for every key you press, and a thief does the same in reverse — lifting crates out of your hands and off floor you already finished. Nothing is banked until the last crate lands and the thief is gone.

**The game never answers.** The rune game's move budget is roomy — roughly double what a good solve costs. What kills guessing is silence: no tick on a correct tile, no partial credit, no warmer-or-colder. The board says nothing until the whole line is right at once, then simply ends.

# The Sokoban verdict

Plenty is left. The verb was never the problem — the solitaire is. A room where nothing else wants anything has one plan, worked out once and then typed in. The proven fix is cheap: a barrier that stops people but not cargo, a worker on the far side who delivers on your clock, a rival who undoes you, and at least one level with no delivery floor on your side at all so the hand-off is mandatory. That's a level-design pass on games we already have. What we should stop shipping is the fiftieth empty room of crates and marked squares.

# Five things to do next

1. Put a helper and a thief across an uncrossable line in our three best push-block games, with one level we cannot finish alone.
2. Strip all partial feedback out of one game and see whether it still plays — if guessing dies and reading survives, do it everywhere.
3. Cap every game at six controls, then give one control a second meaning that arrives mid-game, and check a fresh player finds it unaided.
4. Print the win condition onto the pieces as a live readout that lights and unlights as you move — then three levels in, rub it off everything but the piece in hand.
5. Give failure a performance instead of a message: a beat where nothing happens, then the board reacting, then a control we have never seen arriving on screen.

---

## What this changes in the recipe

Three of these are already rules: showing a rule rather than teaching it by death is
`showrule`, a confirm you can see coming is `commit`, and inert decoration is `decoy`.

Four are not rules yet and are the strongest candidates for the next amendment:

- charge the clock on failed progress rather than on every action
- decoration that becomes load-bearing later
- a second agent on the board with its own goal
- show the goal completely and hide only the arrangement

None of them needs an engine feature we do not have.
