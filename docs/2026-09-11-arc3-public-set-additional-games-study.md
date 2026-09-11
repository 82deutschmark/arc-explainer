<!--
Author: Claude Sonnet 5
Date: 2026-09-11
PURPOSE: Mechanics analysis for the 13 ARC-AGI-3 public-demo games that had no prior
         write-up anywhere in this repo (AR25, CD82, G50T, KA59, M0R0, R11L, RE86, S5I5,
         SB26, SC25, SU15, TN36, TU93). Each was read from its obfuscated source in
         external/ARCEngine/environment_files/ by a single agent per game, instructed to
         ground every claim in the actual step()/win-condition code rather than in sprite
         names or visual guesses (docs/2026-09-02-arc3-official-game-studies.md documents
         3 of 6 games elsewhere in this set having a wrong first visual read, for exactly
         that reason). This is a SINGLE-PASS read per game, not adversarially double-checked
         the way that doc's six were -- treat "confidence: high" as "the agent traced the
         win condition in code", not as a second-reader-verified claim.
         Companion to docs/2026-09-11-arc3-25-game-names-plan.md, which tracks the broader
         effort to extend shared/arc3Games/ informal names to the full 25-game public set.
SRP/DRY check: Pass - this doc holds only the mechanics evidence; shared/arc3Games/*.ts
         will hold the resulting Arc3GameMetadata once names are confirmed with the user.
-->

# Thirteen more public-demo games, read as source

The ARC-AGI-3 public demo set grew from the original 6 games (`ls20`, `as66`, `ft09`,
`lp85`, `sp80`, `vc33`) to 25. Six of the newcomers already had verified mechanics analysis
in `docs/2026-09-02-arc3-official-game-studies.md` (`tr87`, `bp35`, `wa30`, `cn04`, `dc22`,
`lf52`). These are the other 13, each read cold from `external/ARCEngine/environment_files/`.

## What each game turned out to be

**`ar25` — mirrors that do the reaching for you.** A colored piece and one or two
axis-aligned mirror-lines share a 21x21 board scattered with single-pixel targets. Every
cell touched by the piece *or by its live reflection* counts as filled, so a level often
solves by relocating a mirror rather than the piece — the win check
(`vplrhaovhr`) fires the instant the composite reflection map covers every target, even if
the controlled piece never moves onto one itself. A shrinking step budget and a
positions-only undo (it doesn't refund spent steps) keep the symmetry from being brute-forced.

**`cd82` — dyeing a target from eight compass stations.** A selector cycles among eight
fixed throwing stations ringing a 10x10 target square; picking a color and firing washes half
the target (cardinal stations) or a diagonal triangle of it (intercardinal stations) in that
color. The win check compares the painted result to a reference pattern pixel-for-pixel but
masks out both diagonals, so the triangular paints' jagged edges never need to line up
exactly. A 100-action countdown bar ends the level if the pattern isn't reproduced in time.

**`g50t` — ghosts you leave behind on purpose.** You navigate a dungeon room toward a goal
chest; a fifth action doesn't move you, it rewinds you to the start and freezes your
just-finished run into a silent ghost that replays those exact moves on every future attempt.
With only 2-3 rewinds per level before every ghost is wiped, the puzzle is routing a handful
of past selves to hold plates and block patrols long enough for the "real" you to slip past,
before a draining timer bar runs out.

**`ka59` — Sokoban with a fuse.** Click to select a box, push it with the arrow actions;
pushing into another movable object doesn't move it instantly but starts a multi-turn
chain-push. Every box must land exactly inside its own outline frame, and one special block
— never directly selectable — can only be repositioned by being pushed or by a bomb's blast
knockback once its fuse burns down. (The source also wires up a full "enemy chases the
special block" system that no shipped level ever uses — dead code, not a real mechanic here.)

**`m0r0` — a mirrored pair you have to break apart on purpose.** Two tokens always move as
mirror images: vertical input shifts both identically, horizontal input pushes them apart or
together by equal amounts — so their relative gap never changes from open-field movement
alone. The actual puzzle is driving one twin into a wall or gate on purpose so only it stops,
permanently shifting the gap, repeated until both land on the same cell and merge. Checkerboard
trap tiles reset every draggable piece to its level-start position if a twin lands on one.

**`r11l` — arranging shapes onto their silhouettes.** Click-only: click a piece, click a
destination cell, it relocates instantly (blocked by walls). Each shape group's invisible
"shadow" recenters to the group's average position after every move, and a level clears once
every shadow overlaps its own fixed outline elsewhere on the board. Hidden hazard zones
punish a bad drop by reverting it and counting a strike; colored keyhole targets turn out to
be mostly cosmetic — the win-check explicitly skips them, except on the final level.

**`re86` — stamping pieces onto a hidden answer key.** One piece is active at a time, sliding
3 pixels per press; a fifth action cycles which piece is selected. Rigid pieces stop dead at
walls, elastic ones compress instead of stopping, and colored pads recolor whatever touches
them in a slow spreading stain. The win check composites every piece onto a blank canvas each
turn and does a pixel-for-pixel comparison against a level-specific hidden target image.

**`s5i5` — telescoping rods walked onto pins.** Click-only: a two-headed slider handle
extends or retracts a color-matched rod, and small diamond buttons pivot every rod of that
color 90° around its fixed anchor. Rods are chained into parent/child groups, so moving a
base rod drags everything welded to it; any move that would overlap two rods is silently
undone. The goal is walking a marker riding a rod-tip onto a fixed pin, for every pin, within
a shrinking click budget.

**`sb26` — reading a tile belt against a required sequence.** Colored tiles sit in fixed
slots along a chain of "machine" containers; clicking swaps/arranges them, and a run (Space)
reads every machine's slots in order against a top-row sequence of goal colors. Ring-shaped
tiles act as portals that redirect the read into a different container mid-sequence and later
return via a stack. Any mismatch or empty slot stops the run early rather than winning.

**`sc25` — drawing a sigil to cast a spell.** A wizard walks a maze toward an exit archway;
a 3x3 grid of clickable dots in the corner auto-casts one of three hardcoded spells the
instant its lit pattern matches a known sigil — teleport, grow/shrink, or a directional
fireball that destroys crystal obstacles. Spells are gated per level (drawing an unlocked
sigil does nothing), and a shared move-and-click budget ends the level if exhausted.

**`su15` — pulling blocks together until the count is exact.** A magnetic click pulls every
nearby numbered block toward it; two same-tier blocks that touch fuse into the next tier,
Suika-style, while diamond hazard critters merge among themselves and demote any block that
touches one instead. Each level's win condition is an *exact* head-count of specific block
and/or critter tiers sitting in a marked zone simultaneously — not a minimum. Undo is
available but costs escalating steps each consecutive use.

**`tn36` — deducing an opcode table before the clock scrolls out.** Two side-by-side panels
each hold a token, a bank of binary toggle switches, and a target marker; the switches'
combined bits index a fixed, undocumented instruction (move, rotate, scale, recolor). Only the
right panel counts toward winning — position, rotation, scale, and color must all match at
once — while the left panel is a free-play sandbox with preset programs for reverse-engineering
what a given switch code does. Every click scrolls a background strip toward a cutoff; passing
it is a loss, so it's an implicit countdown on how many experiments you can afford.

**`tu93` — outrunning your own trail.** A token hops along printed circuit-board connectors.
Some blocks are breakable walls that wake and lunge at you if you stop in front of them
without destroying them; others stay dormant until you pass within two cells, then wake and
replay your own past moves one turn behind, chasing you with your own history. A third kind
just slides back and forth on its own wire every turn. A shrinking move budget and reaching
a marked exit tile are the two ways the level ends.

## The four codes that don't fit the two-letter-prefix pattern

You asked specifically about `G50T`, `M0R0`, `R11L`, and `S5I5` — the codes shaped
letter-digit-letter-digit instead of the usual letter-letter-digit-digit (`SK48`, `LP85`,
`VC33`, ...). Each analysis was told to actually check whether the source itself carries any
structural difference tied to that shape — a different engine version, an extra action, a
distinct authoring pattern — rather than assume there must be one.

The answer, consistently, across all four: **no.** Every one of the four is a completely
ordinary ARCEngine game file — same imports, same obfuscated-identifier style, same
`sprites` dict + `Level(...)` list + one `ARCBaseGame` subclass shape as every other game in
the batch. In each case the class is simply named after its own id verbatim (`G50t`, `M0r0`,
`R11l`, `S5i5`), exactly the way `Sk48` or `Lp85` are — the digit placement is not
special-cased anywhere in the code. `m0r0`'s analysis went further and diffed it directly
against `lp85`, `sk48`, and `ls20`'s class-naming pattern to confirm this. The letter-split
shape is best explained as an artifact of however ARC Prize's id generator assigns opaque
codes, not a signal about the game underneath it — and it isn't even rare: 4 of the 25
public-demo codes have it.

## Proposed informal names

Following the site's established convention (the name's word-initials spell the code's two
letters, in order) and grounded in the mechanics above:

| Code | Proposed name | Why |
|---|---|---|
| AR25 | **A**xis **R**eflectors | The two mirrors are always axis-aligned, and their live reflections are what the win-check actually reads. |
| CD82 | **C**ompass **D**ye | Eight compass-style stations, each dyeing a slice of the target. |
| G50T | **G**host **T**imer | A rewind mechanic that leaves replaying ghosts of you, raced against a draining timer bar. |
| KA59 | **K**inetic **A**ssembly | Chain-pushing boxes and a bomb-knocked block into an exact assembled layout. |
| M0R0 | **M**irror **R**endezvous | A mirrored pair that can only win by deliberately desyncing until they rendezvous on one cell. |
| R11L | **R**earrange **L**ayout | Clicking pieces until each group's shadow overlaps its fixed layout target. |
| RE86 | **Re**ach **E**mblems | Sliding pieces until, together, they reach and cover a hidden set of target marks. |
| S5I5 | **S**liding **I**ndicator | Extending/rotating rods to walk a tip-mounted indicator marker onto each pin. |
| SB26 | **S**equence **B**elt | A belt of tiles read in order against a required color sequence. |
| SC25 | **S**igil **C**aster | Drawing a lit pattern (sigil) on a toggle grid auto-casts a spell. |
| SU15 | **S**orting **U**rn | Pulling and merging numbered blocks until an exact tiered mix sits in the goal zone. |
| TN36 | **T**oggle **N**avigator | Toggling binary switches to compose the opcode that navigates a token onto its target. |
| TU93 | **T**rail **U**nwind | Hazards that unwind and replay your own trail against you, while your move budget unwinds too. |

These are proposals, not yet written into `shared/arc3Games/` — pending confirmation.
