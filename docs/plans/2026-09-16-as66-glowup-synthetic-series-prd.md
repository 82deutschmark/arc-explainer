<!--
Author: Claude Fable 5.1
Date: 2026-09-16
PURPOSE: Product requirements for (A) "Always Sliding XL", a glow-up of AS66 whose world is
         larger than the 64x64 viewport and scrolls, and (B) a series of "super synthetic"
         ARCEngine games that graft mechanics from the 25 public ARC-AGI-3 games onto the
         sliding-block core. Built on the faithful recreation spec in
         docs/plans/2026-09-16-as66-always-sliding-recreation-prd.md; that file owns the base
         rules, this one only states what changes and what is added. Mechanics cited from other
         games are as documented in shared/arc3Games/*.ts (the 25-game registry).
SRP/DRY check: Pass -- no rule from the base PRD is restated here beyond a pointer.
-->

# Always Sliding XL and the Super-Synthetic Series -- PRD

**Owner:** Boss. **Implementers:** the ARCEngine game developers.
**Depends on:** the AS66 recreation (`games/official/as66.py`) being built and passing its
acceptance tests first. Every game here subclasses or reuses that engine code; none re-implements
sliding.

## 1. Why

The 25 public games have been read down to source and their mechanics are on record. AS66 is the
one preview game with no public source. A faithful rebuild gives us one holdout. A family of games
that *recombine* documented mechanics gives us many holdouts whose rules an agent can only learn by
playing, and whose per-mechanic difficulty we can attribute, because each new game adds exactly one
or two named mechanics to a base the agent has already been measured on.

Design principle for the whole series: **one base loop (slide until you stop, wrap at the edge,
get every block into its cup), one or two grafted mechanics per game, every grafted mechanic
taken from a game we have already documented and can cite.** No mechanic soup.

## 2. Part A -- Always Sliding XL (the glow-up)

### 2.1 The change

The world is bigger than the screen. The camera shows a window of the field and follows the
block. This is the `bp35` model (levels 11 wide and far taller than the view, view scrolls to
follow you, exit usually off-screen at the start) applied to a torus.

- Field sizes 24x24 up to 48x48 cells at a fixed cell size of 3 px; the camera viewport is
  20x20 cells (60 px) plus the one-cell ring, letterboxed as today. `Camera(x, y, 66, 66)` is
  over the limit, so the ring becomes a HUD overlay (`RenderableUserDisplay`) drawn at the
  viewport edge, not a world sprite, and the camera is `Camera(x, y, 60, 60)` moved with
  `camera.move(dx, dy)` each frame of a slide.
- Camera rule: the primary block is kept inside a central 12x12-cell dead zone; the camera moves
  only when the block would leave it. On wrap, the camera cuts (no scroll) to the far side, the
  same frame the block does. Two-block levels follow the block that moved farthest; the other
  block is marked by an arrow on the ring edge nearest to it (the `ls20` fog level and `bp35`
  off-screen exits both rely on the player knowing something is out there).
- The ring's green side keeps meaning "last direction". Add a second indicator: the ring edge
  in the direction of each unsatisfied cup glows that cup's marker color (white for "any").
  This is the information the player loses when the cup goes off-screen, and it is what makes
  the level solvable without a map.
- Engine consequence: all collision goes through the cell grid built in `on_set_level` (the base
  PRD already asks for this); sprites are only for rendering, and only sprites inside the
  viewport plus one cell need `visible=True` (cheap culling, `Camera._raw_render` already skips
  off-view sprites but scaling every sprite each frame is what costs).

### 2.2 Level set (9 levels, mirrors the original's ramp)

| L | World | New thing | Borrowed from |
|---|---|---|---|
| 1 | 24x24 | The original level 1 layout, but the cup is two screens away. Teaches the ring glow. | bp35 (off-screen exit) |
| 2 | 24x24 | Wrap across an off-screen edge: the shortest path leaves the viewport and re-enters from the other side. | AS66 torus |
| 3 | 30x30 | One patrol enemy whose path crosses the viewport edge, so it appears and disappears; the player must count its period. | AS66, tu93 (enemies move after you, patroller reverses at wire end) |
| 4 | 30x30 | Two blocks, two cups, one block starts off-screen. | AS66 L4, m0r0 (two tokens moved by one input) |
| 5 | 36x36 | Color bar + a marked cup, both off-screen in different directions. | AS66 L5 |
| 6 | 36x36 | Static enemies form a maze; diagonal patrol; budget 3x par. | AS66 L5/L8 |
| 7 | 42x42 | Three blocks, three cups. | AS66 L9 + one |
| 8 | 42x42 | Fog: only cells within 6 of a block are drawn; the ring glow is the only long-range information. | ls20 (final level fog-of-war) |
| 9 | 48x48 | Everything, plus one **decoy block** that looks like a player block but never moves. | tu93 L5 (decoy that looks like your token) |

Par per level is set by a search (BFS over the state space of block positions x enemy phase;
the state space is small because slides are deterministic) and stored in `metadata.json` as
`baseline_actions`; budget = 3x par as in the original.

### 2.3 Acceptance

- Level 1 of XL, with the camera pinned, is pixel-identical to the AS66 L1 field region.
- A BFS solver (`tools/as66_solve.py`, also a deliverable) finds the par and confirms every
  level is solvable without dying and inside budget.
- Frames never exceed 64x64; a full-world slide on L9 (48 cells + wrap) stays under the 1000-frame
  cap (it is 49 frames).

## 3. Part B -- the Super-Synthetic Series

Each entry is a 4-character id in the house convention (informal-name initials appear in order
in the id; see `arc3_game_naming_convention` memory), 6-9 levels, built by subclassing the AS66
game class and overriding one or two hooks: `on_before_slide`, `on_cell_entered`,
`on_after_move`, `is_level_complete`, `extra_actions`. The base PRD's step order is the contract.

Graded from "same family, agent should transfer" to "looks the same, plays differently".

### B1. `sg1t` -- Slide Ghost (AS66 + g50t)
- ACTION5 rewinds the block to the level start and leaves a **ghost** that replays your move
  list one press per press. Ghosts are solid to the live block and satisfy cups. Levels need
  two blocks in two cups but give you only one block: you record a path into cup A, rewind,
  and drive the live block into cup B while the ghost re-runs into A, timed against a patrol.
- Cite: g50t (history replayed in lockstep, one step per step, two ghosts max, rewind again
  wipes them). Keep g50t's rule that the fifth action does not move you.
- Difficulty knob: enemy phase. Because ghosts replay presses, not positions, a ghost that
  meets a moved enemy dies and takes the run with it (g50t: a gate that shuts on you kills).

### B2. `sw3h` -- Slide Warehouse (AS66 + wa30)
- The block is a forklift: ACTION5 grabs the adjacent crate in the last-moved direction; while
  held, the crate slides with you (push when in front, drag when behind) and both stop when
  either is blocked. Cups want crates, not the block. From level 3 an **orange helper** takes one
  step per press toward the nearest loose crate and slides it into any cup; from level 6 a
  **purple thief** does the same toward its own gray drop zone and takes crates out of cups.
- Cite: wa30 (grab/drag/release, helper acts once per action, thief steals from bays, face it
  and press Action 5 to remove it). Sliding makes the thief lethal in a new way: a crate the
  thief releases mid-corridor becomes a new wall in your slide line.

### B3. `sk4b` -- Slide Kebab (AS66 + sk48)
- Beads instead of blocks. The player controls a **rod** with a fixed handle on the ring: press
  its direction to extend one segment, opposite to retract, sideways to slide along its rail.
  Extending pushes loose beads ahead; a bead that cannot move is skewered and rides the rod.
  Beads that fall off the rod tip slide (AS66 rule) until they stop. The cup asks for a bead
  **sequence** shown as a reference rod on the bottom strip.
- Cite: sk48 (push-then-skewer, beads ride along, reference rod, energy 196, undo free but no
  energy refund). This is the first entry with ACTION7.

### B4. `sl2f` -- Slide Leapfrog (AS66 + lf52)
- Green pegs on a torus. Click a peg, then a landing ring: it hops over the next peg and then
  **keeps sliding** in that direction (AS66) until stopped. Jumped pegs of the same color are
  removed. From level 2, rail carts (orange with a yellow rim) advance one square per arrow
  press and carry a peg to another region of the torus. Win: one green peg left. Red pegs can be
  hopped but never removed.
- Cite: lf52 verbatim except the post-hop slide. The slide is what breaks memorized peg-solitaire
  patterns.

### B5. `sr8e` -- Slide Reflectors (AS66 + ar25)
- The block is reflected live across one or two light-blue mirror lines; reflections are drawn
  in darker gray and **also count as blocks for cups**, but not for enemies. Mirrors are
  selectable (click) and slide with the arrows on their own axis, costing steps from a bar on the
  right edge (64/128/320). Cups may be placed where only a reflection can reach them, because a
  reflection passes through walls that the block does not.
- Cite: ar25 (reflections satisfy targets, pieces pass through mirrors, Cycle costs a step, the
  move that empties the bar loses unless it wins).

### B6. `sd2c` -- Slide Deck (AS66 + dc22)
- A button panel on the right: red/pink bars swing a quarter turn around a pivot, blue/purple
  tiles flip solid/checkered (checkered is not floor -- a sliding block passes over it and falls:
  the dc22 no-floor penalty of 20 steps and the click is undone). Buttons cost 2, a missed click
  1, a level 4 gray button closes a gap 2 cells per press.
- Cite: dc22 (panel semantics, 20-step fall, budgets 128/192/512/1024 shown as the bottom row
  turning dark gray). Sliding turns "is there floor under me" into "is there floor under my whole
  slide line", which is a genuinely new inference.

### B7. `ss5u` -- Slide Suction (AS66 + su15)
- Blocks come in su15's nine tiers (1x1 light blue up to 10x10 green). A click is a vacuum pull
  with radius 8 that drags every block near it to the click point; overlapping same-tier blocks
  merge one tier up. Arrows still slide everything. Cups want a specific tier, shown as a
  life-size shopping list in the header. Mixing tiers is a foul with an escalating penalty
  (2, 4, 6...).
- Cite: su15 (tier chain, merge-on-catch, header legend, exact-count win, foul penalty, creatures
  from level 4 that chase the nearest block only while a click plays out).

### B8. `sp4b` -- Slide Pontoons (AS66 + bp35), the honest cousin
- Only LEFT and RIGHT; every sideways step is followed by a forced slide in the current pull
  direction (up at start). Red blocks flip the pull when clicked and are used up; purple blocks
  spread purple into every empty neighbor when clicked (bridges); spikes kill on carry-in.
  Torus wrap applies on the sideways axis only. Levels are 11 wide and 3 screens tall.
- Cite: bp35 verbatim plus wrap. Exists to measure whether an agent that learned XL's camera
  transfers to a different control scheme.

### B9. `sm0r` -- Slide Mirror (AS66 + m0r0)
- Two blocks, always moved together: vertical input moves both the same way, horizontal input
  moves them toward or away from each other. Both slide until stopped, separately. Win when they
  merge on the same cell or stand adjacent and are pressed together. Checkerboard trap tiles snap
  both back to start. Colored gates open only while a twin stands on the matching button tile.
- Cite: m0r0 (mirror input, deliberate one-twin-stops-on-a-wall to shift the meeting column, live
  gates, traps, 150-move cap counting every action).

### B10. `st9n` -- Slide Toggle (AS66 + tn36), program-then-run
- No live arrows. A right-hand panel of switch columns encodes a program (each column is one
  instruction: slide up/down/left/right, wait, recolor). A blue run button plays the program one
  instruction per frame against the live enemies. A miss returns the block to start. From level 3
  a left panel with tabs plays preset demos on a gray block so the instruction set can be
  learned by watching.
- Cite: tn36 (columns sum to numbers, numbers are fixed instructions, demo tabs, beams that fire
  after the third instruction on level 7, 60/121 click budgets).

### B11. `sc4d` -- Slide Compass Dye (AS66 + cd82 + ft09)
- Cups have no color marker. Instead a 3x3 **marker tile** (ft09 style: center is the target
  color, border cells say which neighbors must match) sits beside each cup, and color bars are
  replaced by cd82's stations: the block cycles through eight compass stations around a small
  target square and fires to wash half of it; the wash is what recolors the block passing
  through. 100-action countdown per level.
- Cite: ft09 (marker semantics, white/gray/dark-gray border codes, only tile clicks cost), cd82
  (stations, half/triangle washes, the 100th action loses).

### B12. `sv3c` -- Slide Volume (AS66 + vc33)
- The field is a set of tanks. Blocks float on liquid surfaces (they are vc33 riders) and slide
  only along the surface. Blue pumps at wall feet move liquid between tanks; a block is delivered
  when its surface is level with a stripe of its color on the adjacent wall, and it then slides
  off through a gate (light gray, opens when both sides are level) into the cup.
- Cite: vc33 (pumps, level-with-shorter-wall limit, gates open at equal level, black caps from
  level 6, riders move only with the surface).

### B13. `sr1l` -- Slide Reach (AS66 + r11l + re86)
- The player is an amoeba: click an arm, click a destination, the body re-centers to the mean of
  the arms and then **slides** from there. Cups are outlines that must be overlapped by a body of
  exactly the right color set; from level 5 the body starts white and eats pellets to gain
  colors, and re86's color pads repaint a piece that slides across them.
- Cite: r11l (arms, body at mean, outline overlap wins, pellets paint the body, hazard zones with
  five strikes, 60 clicks), re86 (pads repaint as a stain during that one move, refused moves
  still cost).

### B14. `sn0t` -- Slide Notches (AS66 + cn04)
- Blocks are cn04 parts printed with marks; a level completes when every mark meets a matching
  mark on another part, and marks go dark when satisfied *or* when they meet the wrong kind.
  Parts slide (AS66) instead of stepping. From level 3 only the held part shows its marks.
  Interact quarter-turns a part on levels 1-4 and grows it through a stack of nested variants
  from level 5.
- Cite: cn04 verbatim; this is the memory-load entry of the series.

### B15. `sb2t` -- Slide Belt (AS66 + sb26 + lp85)
- The cups are slots in a machine. Blocks sliding into a slot stay; a run button checks the slot
  sequence against a goal row; ring-shaped slots jump the run into the machine of that color.
  lp85's loop buttons rotate the blocks already in a machine one slot forward or back.
- Cite: sb26 (run semantics, red flash on mismatch, 64 energy), lp85 (loops, crossing loops,
  stacked buttons from level 6, 13-150 step budgets).

### B16. `st8r` -- Slide Runes (AS66 + tr87)
- Blocks carry glyphs. A dictionary wall at the top maps glyph-on-color to a translation. The cup
  row accepts a block only if its glyph is the translation of the phrase glyph above that cup.
  Sliding through a color bar changes the block's alphabet (its tile color), which changes what
  its glyph means.
- Cite: tr87 (entries, one-to-many and many-to-one from levels 2-3, the hidden middle alphabet on
  level 4, budgets 128/256).

### B17. `sk9a` -- Slide Assembly (AS66 + ka59)
- Arrow presses move the selected green box 3 cells; if it would hit another piece it does not
  move and instead **knocks** that piece, which slides AS66-style until stopped. Yellow special
  blocks can only be moved by knocking. From level 5 bombs fill one row per press and fire a
  blast that knocks whatever it hits. Win when every outline frame holds a piece of its size.
- Cite: ka59 (select by click, 3-cell steps, ~15-cell knock, purple stops you but not knocked
  pieces, budgets 100-200).

### B18. `sc2s` -- Slide Sigils (AS66 + sc25)
- A 3x3 dot grid at the bottom; lit patterns cast spells when they match an unlocked sigil:
  grow/shrink (a 2x2 block fits different corridors), teleport to a pad of your size, fireball in
  the last-moved direction which removes a pink-framed target and every block of its middle
  color. Small green squares refund 10 actions.
- Cite: sc25 (sigil grid, gated spells per level, fireball fizzles on walls, budgets 25-65).

### B19. `ss5i` -- Slide Indicator (AS66 + s5i5)
- Telescoping rods with anchors form the walls. Two-headed slider buttons grow/shrink every rod
  of a color by one segment; plus buttons rotate rods a quarter turn about their anchor. The
  block's slide lines are therefore built by the player, not given. Cups are hollow diamond pins
  that must have the block's marker on them.
- Cite: s5i5 (chained rods carry children, overlap cancels the click but costs it, 50-200 click
  budgets).

### B20. `sp0r` -- Slide Pour (AS66 + sp80)
- Action 5 pours liquid from every spout one cell per frame; red bars split streams; the block
  can be pushed one cell by a stream and then slides. Cups fill only through their notch. Four
  failed pours lose. Levels 2, 3, 5 are drawn upside down with controls turned to match.
- Cite: sp80 verbatim; the upside-down levels test whether an agent's "gravity" prior is a bias.

## 4. Series-wide rules

- Every game keeps AS66's HUD (perimeter par meter, bottom progress bar) so the agent has the
  same budget signal everywhere; games whose source mechanic has its own bar (ar25 right edge,
  bp35 bottom edge) draw both.
- Every game ships with its BFS/IDDFS solver proving solvability and computing par. No hand-set
  par. `metadata.json` carries `baseline_actions`.
- Every game has a `docs/DESIGN_<id>.md` in ARCEngine following `DESIGN_world_shifter.md`, and a
  `shared/arc3Games/<id>.ts` entry in arc-explainer marked `category: 'synthetic'` (new enum value,
  hidden from the public index exactly like `as66`, reachable by URL) so the play notes and
  screenshots pipeline that feeds the arc-3 fine-tune works unchanged.
- Order of build: AS66 recreation, then XL, then B1 (ghost), B2 (warehouse), B4 (leapfrog) --
  the three whose source games we have the most human play data on -- then the rest by the
  difficulty ladder above.

## 5. Open questions for Boss

1. Should XL replace the original's per-level cell-size trick entirely (fixed 3 px cells), or
   should levels 1-3 keep 4 px so they match the original exactly? (Recommendation: fixed 3 px;
   the recreation is the exact copy.)
2. Should synthetic entries get a public spoiler page at all, or stay documentation-only until
   an agent has been measured on them? (Recommendation: URL-only pages, like as66.)
3. Series ids above follow the initials convention but were not checked against the live 25 for
   collisions; confirm before files are named.
