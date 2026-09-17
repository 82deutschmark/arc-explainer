<!--
Author: Claude Fable 5.1 (16-Sep-2026); corrected by Claude Opus 5 (17-Sep-2026)
Date: 2026-09-17
PURPOSE: Product requirements for recreating AS66 "Always Sliding" -- the ARC-AGI-3 preview
         game that was withdrawn from the public set -- as an ARCEngine Python game, so it can
         serve as a held-out, semi-private task. Every rule below was read off Boss's own
         9-level winning recording (155 frames rows, 27-Dec-2025); the recording is the source
         of truth, this document is the reading of it. Companion data files hold the exact
         level layouts and the winning move sequences.
SRP/DRY check: Pass -- this is the only spec for the faithful recreation. The glow-up and the
         synthetic series live in docs/plans/2026-09-16-as66-glowup-synthetic-series-prd.md.
-->

# AS66 "Always Sliding" -- Recreation PRD

**Owner:** Boss. **Implementer:** the developer assigned to `external/ARCEngine`.
**Status:** BUILT 16-Sep-2026 (Claude Fable 5.1); FIXED 17-Sep-2026 (Claude Opus 5). Every frame of
every recorded action now matches, all nine level layouts match Boss's screenshots (level 1 and
levels 3-9; level 2 has none), and no reachable position on any level crashes. The 17-Sep pass fixed
the lap rule (3.6), a level 4 two-block crash, the meter on the winning move (3.7) and the stale
par column (4). Fix plan: `external/ARCEngine/docs/plans/17-September-2026-as66-mechanics-fix-plan.md`.
Tests: `external/ARCEngine/tests/games/test_as66.py` (section 6).

## 0. The one-paragraph brief

Build `external/ARCEngine/games/official/as66.py` (single file, ARCEngine `ARCBaseGame` subclass,
same conventions as `ls20.py` and `gw01.py`) that reproduces the withdrawn ARC-AGI-3 preview game
AS66 frame-for-frame on its nine levels: a colored block slides until it hits something, the
field wraps at its edges like a torus, orange patrol enemies kill on contact, colored bars
recolor the block, and every block must sit in a white cup whose back wall matches its color.
Nine levels, four actions, a perimeter meter that is the move budget. The layouts,
colors, pixel geometry and reference solutions are in
[as66_levels.json](../arc3-game-analysis/as66_levels.json) and
[as66_solutions.json](../arc3-game-analysis/as66_solutions.json); acceptance is that the
recorded winning action sequence wins the recreation, level by level, and the two recorded
deaths die.

## 1. Provenance: where AS66 came from and where it went

| Date | Event | Evidence |
|---|---|---|
| Jul 2025 | ARC-AGI-3 preview ships six games: ls20, as66, ft09, lp85, sp80, vc33. AS66 is one of the three "preview" (public-from-start) games. | `docs/archives/CHANGELOG-OLD-Dec2025.md:1240` |
| Dec 2025 | Boss names it "Always Sliding", adds it to the spoiler pages, screenshots levels 3-9 (`client/public/as66-lvl*.png`, `as66.png`), records a 415-move completion. | CHANGELOG 3825-3832, `shared/arc3Games/as66.ts` |
| 27-Dec-2025 | Boss records the full 9-level WIN used here: `as66-821a4dcad9c2 / db85123a-891c-4fde-8bd3-b85c6702575d` (154 actions, 3 deaths, 9 resets). Kept at `public/replays/` and `arc3/`. | this document, section 3 |
| 7-15 Jan 2026 | 13 gpt-5-nano gold-agent runs plus a second human run on AS66; best human 6/9, best agent 2/9. | `arc-3/docs/trace-findings/2026-09-15-as66-the-withdrawn-26th-game.md` |
| Jan 2026 | Test video `client/public/videos/arc3/as66-test.mp4` (154 frames at 1 fps) generated for the landing replay player. | CHANGELOG 2255-2260 |
| 31-Aug-2026 | ARCEngine `environment_files/` download batch pulls the 25 public builds. No `as66` directory. **No Python source for AS66 exists anywhere we can reach**, and `arc-3/docs/static/games/src/` has no as66 either. | CHANGELOG 9.x entry line 67, this session's search |
| 11-Sep-2026 | Confirmed withdrawn from the public demo set by three independent sources (arcprize.org/tasks, ARC Prize's 2-Sep results, the download batch). Destination (semi-private or private) unknowable. | `docs/2026-09-11-arc3-25-game-names-plan.md`, `as66.ts` notes |
| 15-Sep-2026 | `three.arcprize.org` still serves the recordings; leaderboard endpoint returns zero rows for as66 while all 25 live builds return ten. | arc-3 trace finding above |

The page at `/arc3/games/as66` already exists and is already hidden from the index and the
"nearest games" navigation by the `WITHDRAWN_IDS` set in `shared/arc3Games/index.ts`. It stays
reachable by direct URL. Nothing to do there.

Why this matters: the withdrawal makes AS66 the one preview game whose mechanics are documented
publicly but whose source is not, so a faithful rebuild is a holdout with a known human baseline
(Boss, 154 actions with mistakes; the reference solutions below are the clean per-level paths)
and a known agent baseline (gpt-5-nano, 11 of 13 runs stuck on level 1).

## 2. Screen geometry (what the 64x64 frame contains)

Every frame is a 64x64 grid of ARC-3 palette indices (`Arc3Colors.md`: 0 white, 1 light gray,
3 dark gray, 4 darker gray, 5 black, 6 pink, 8 red, 9 blue, 10 light blue, 11 yellow, 12 orange,
13 dark red, 14 green, 15 purple).

```
row 0            : par meter, orange 12 -> fills with dark red 13 left to right
cols 0 and 63    : par meter continues down both sides, orange -> dark red, top to bottom
row 63           : level progress bar, black 5 -> fills white 0 left to right, 7 px per level (64/9)
between          : letterbox, dark gray 3
ring             : light gray 1, one cell thick, darker-gray 4 corner cells, one side green 14
field            : purple 15 floor, inside the ring
```

The field is a grid of square cells. Cell size and field size change per level (this is how the
original fits different board sizes into 64 pixels; the glow-up PRD removes that constraint):

| Level | Field (cols x rows) | Cell px | Field origin px (x, y) | Green side at start |
|---|---|---|---|---|
| 1 | 12 x 12 | 4 | (8, 8) | TOP |
| 2 | 12 x 12 | 4 | (8, 8) | LEFT |
| 3 | 12 x 12 | 4 | (8, 8) | TOP |
| 4 | 14 x 12 | 4 | (4, 8) | BOTTOM |
| 5 | 18 x 18 | 3 | (5, 5) | LEFT |
| 6 | 13 x 15 | 3 | (12, 9) | RIGHT |
| 7 | 13 x 10 | 4 | (6, 12) | RIGHT |
| 8 | 17 x 17 | 3 | (6, 6) | LEFT |
| 9 | 21 x 17 | 2 | (11, 15) | LEFT |

The ring is one cell wide and sits directly outside the field. Corners are color 4.
Implementation note: with ARCEngine the cleanest way to get this is a `Camera` whose viewport is
`(cols+2) x (rows+2)` cells... except cells are several pixels wide, so instead build every level
at native 64x64 pixel scale (sprites scaled by the cell size via `set_scale`) with a full 64x64
camera. The par meter and progress bar are `RenderableUserDisplay` interfaces drawn over the
frame (see `ct03.py` / `ws03.py` for the pattern).

Contact sheet of all nine starting frames:
[as66-levels-contact-sheet.png](../arc3-game-analysis/as66-levels-contact-sheet.png).
Boss's original screenshots (levels 3-9 with an alternate level 6): `client/public/as66-lvl*.png`.

## 3. Mechanics (each with the recording rows that prove it)

Row numbers refer to the 155 rows of `public/replays/as66-821a4dcad9c2.db85123a-....jsonl`,
row 0 = initial RESET. "Counted move" = an action that moved anything.

### 3.1 Actions
- `available_actions = [1, 2, 3, 4, 6]`. ACTION1 up, 2 down, 3 left, 4 right. ACTION6 (click)
  is accepted and does nothing (rows 25, 32, 34, 103, 113, 133: one frame, no change, no cost).
  No ACTION5, no ACTION7: **there is no undo**. RESET restarts the current level (rows 10, 19, 26,
  33, 35, 40, 59, 94, 142: score kept, layout, enemies and meter restored).
- `win_score = 9`. `next_level()` on every clear, `win()` on level 9 (row 153).

### 3.2 The block slides
- A block is one cell. On a direction press it moves one cell per frame in that direction until
  the next cell is not free, then stops (row 1: 3 frames for a 2-cell slide plus the settle frame).
- Not free = wall cell (color 4), a cup's white cell or back wall, or the far side of the field
  when... no: **the field edge is not a wall.** Leaving the field on one side re-enters on the
  opposite side (torus). Row 15: up from (9,5) to (9,0), wraps to (9,11), continues to (9,10).
  Row 24: a column with no obstacle loops all the way around and the block ends where it began.
- A press in the direction the green ring side already shows is a no-op: one frame, no meter
  change, enemies do not move (rows 20, 36, 115, 116). A blocked press in a *new* direction is not
  free; see 3.7.
- The green ring side moves to the side matching the direction just pressed (row 1 DOWN ->
  BOTTOM, row 2 LEFT -> LEFT). It is a "last direction" indicator only. On a lap it flips for the
  slide and flips back when the block gets home (row 24; see 3.6). Each level has its own starting side (table above).

### 3.3 Cups (the exit)
- A cup is five white cells in a U: a 3-cell back wall and two legs, opening on one side, with
  one free pocket cell inside. The center cell of the back wall is the marker: white = any block,
  colored = only a block of that color.
- A block enters the pocket through the open side and stops against the back wall. A block that
  is already in a pocket is **not locked**: a later press slides it out again if the opening is
  in that direction (L9, row 146: light-blue block leaves pocket (11,11) on RIGHT, returns at
  row 152).
- The level clears the instant a slide ends with **every** block sitting in a pocket whose
  marker is white or its own color (L4 row 63, L9 row 153: two blocks, two cups).

### 3.4 Multiple blocks
- Every press moves every block (L4 rows 57-63: the pink and light-blue blocks slide together;
  L9 likewise). Blocks never met each other in the recording; see 9.2 for the ordering decision.

### 3.5 Color bars (recolor gates)
- A straight run of 3 colored cells (blue 9 or yellow 11) that is not part of a cup. A block
  slides **through** the bar and comes out the bar's color; it does not stop (L5 row 70: light
  blue crosses the yellow bar at column 9 and arrives yellow; L7 row 109: pink crosses the blue
  bar and arrives blue). A block already that color passes unchanged (L5 row 77).

### 3.6 Enemies
- A 3x3 orange (12) square with one dark-red (13) core cell. Contact with a block, in either
  direction, ends the game (`lose()`): the block sliding into the enemy's cells (L3 row 18) or
  the enemy stepping onto the block (L9 row 141).
- **Order of resolution per counted move: enemies step first, then the block slides** (row 18:
  the block stops one cell inside the enemy's *new* position, not its old one).
- Core position encodes behavior:
  - center core = static enemy, never moves (L5: three of its four enemies);
  - core on an edge = moves one cell per counted move along that axis;
  - core in a corner = moves one cell on **both** axes per counted move (diagonal, L8).
  - After a step the core is redrawn on the leading edge or corner of the current heading, so
    the core always shows where the enemy goes next (L3 rows 14-15: block shifts, core flips
    from right edge to left edge on the reversal).
- Patrol path: the enemy shuttles on the straight line from its **start cell** to the last
  position before a wall, cup, bar or field edge blocks it, then reverses. The start is a hard
  end of the path even if the cells behind it are free (L3: patrols columns 1..5 although
  column 0 is open; L8 both enemies return exactly to their start corners and reverse). Diagonal
  enemies retrace the same diagonal, they do not billiard-bounce off one axis.
- Enemies do not wrap and do not kill each other. Enemies never move on a no-op press.
- **Laps** (rows 24, 30, 31): a slide that carries the block all the way round the torus to its
  own cell plays like any move. On the first frame the ring flips and the enemy steps; the block
  goes round; on the frame it gets home the ring and the enemy are put back as they were. The move
  stays charged on the meter. (Corrected 17-Sep: first read as "the enemy does not step", which
  matched only the last frame.)

### 3.7 The perimeter meter and the move budget (corrected after implementation)
- The meter is one 188-pixel path: it starts at the top center and grows both ways at once,
  along the top row (32 px each way) and then down each side column (rows 1..62). After `m`
  counted moves it shows `round(188 * m / budget)` pixels, the left half taking the odd pixel.
  Python's round (half to even) reproduces every recorded frame.
- Per-level budgets, read off the fill rate: 15, 12, 18, 10, 20, 16, 20, 28, 30. **The move
  that fills the meter loses the level** (L6 row 93: 16th counted move, budget 16, no contact
  anywhere in the frame). A winning move is checked first.
- The meter is redrawn on settle frames and on blocked-press frames, never on a death frame
  (row 18 shows the previous move's meter) and never for the winning move (all nine recorded clears
  show the count from before the move that cleared the level; corrected 17-Sep).
- The meter resets on level clear and on RESET (rows 10, 56).
- Bottom row: `round(64 * levels_completed / 9)` white pixels from the left, the rest black.
  Never resets on RESET.
- Blocked presses: a press in the direction the green side already shows is a no-op (rows 20,
  36, 115, 116). A blocked press in a new direction counts: enemies step, the meter fills, the
  green side flips, one frame (rows 12, 114). A lap counts on the meter; its ring flip and enemy
  step are put back when the block gets home (rows 24, 30, 31).

### 3.8 Level start
- Each level starts with the block(s) at rest, enemies at their start cells with the core on the
  side they will move first (or centered if static), the meter empty, and the green side set per
  the table.

## 4. Level data

Exact grids, walls, enemies, cups, bars and block starts for all nine levels are in
[as66_levels.json](../arc3-game-analysis/as66_levels.json) (field coordinates, x right, y down,
origin at the field's top-left cell). Summary:

| L | Field | Blocks (color @ cell) | Cups (pocket, opens, needs) | Bars | Enemies (top-left, heading) | Fewest moves |
|---|---|---|---|---|---|---|
| 1 | 12x12 | red @ (8,2) | (4,8) UP, any | - | - | 3 |
| 2 | 12x12 | yellow @ (9,5) | (2,8) RIGHT, any | - | - | 3 |
| 3 | 12x12 | yellow @ (4,4) | (5,10) DOWN, any | - | (1,0) RIGHT, patrols x 1..5 | 7 |
| 4 | 14x12 | light blue @ (7,8); pink @ (4,4) | (2,7) RIGHT needs light blue; (4,10) DOWN needs pink | - | - | 4 |
| 5 | 18x18 | light blue @ (7,9) | (3,4) LEFT needs yellow | yellow (9,3)-(9,5) | (0,2) DOWN y 2..7; static at (5,6), (5,12), (11,14) | 13 |
| 6 | 13x15 | pink @ (8,9) | (3,10) DOWN needs blue | blue (8,1)-(10,1) | (0,11) RIGHT x 0..4 | 8 |
| 7 | 13x10 | pink @ (1,3) | (10,8) DOWN needs blue | blue (6,2)-(6,4) | - | 7 |
| 8 | 17x17 | yellow @ (2,12) | (15,14) RIGHT needs blue | blue (6,1)-(6,3) | (7,5) UP_RIGHT to (9,3); (3,10) DOWN_RIGHT to (7,14) | 9 |
| 9 | 21x17 | yellow @ (3,10); light blue @ (11,14) | (3,3) UP needs blue; (11,11) RIGHT any | blue (11,2)-(11,4); yellow (9,2)-(9,4) | (3,13) RIGHT x 3..7 | 11 |

Reference solutions (Boss's final successful attempt on each level, exactly as recorded, including
the timing-wait moves he used against enemies) are in
[as66_solutions.json](../arc3-game-analysis/as66_solutions.json). Level 1 is `DOWN, LEFT, DOWN`.
"Fewest moves" is the fewest counted moves that clear the level, found by exhaustive search of the
recreation and asserted by the sweep test. It replaces a "Par" column (5 4 6 3 7 5 7 9 10) that came
from the first, wrong meter theory; five of those were below what the level allows.

## 5. Engine mapping

- File: `external/ARCEngine/games/official/as66.py`, class `As66(ARCBaseGame)`, registered in
  `games/official/__init__.py`. Header per `Mark's Coding Standards.md`. Also emit
  `environment_files/as66/v1/as66.py` + `metadata.json` (`baseline_actions` = Boss's recorded
  per-level solution lengths `[3,3,16,4,14,8,9,17,11]`, `default_fps: 5`) so it can be served the way the 25 public builds are.
- `super().__init__("as66", levels, Camera(0,0,64,64, background=3, letter_box=3,
  interfaces=[meter, progress]), available_actions=[1,2,3,4,6], seed=seed)`.
- One `Level` per row of the table, `data={"par": P, "cell": px, "origin": (x,y),
  "green": side}`. Build sprites from the JSON at import time rather than hand-typing pixel
  arrays: walls as one PIXEL_PERFECT sprite per level, cups as sprites tagged `cup` with
  `data` for pocket/opening/required color, bars tagged `bar` with a color, enemies tagged
  `enemy` with heading and start, blocks tagged `block`.
- `step()`: on ACTION1-4 compute the direction; if the first cell is blocked for every block,
  `complete_action()` with no state change. Otherwise: count the move, advance the meter, move
  every enemy one step (reverse first if blocked), check enemy-onto-block death, then loop:
  advance every block one cell (with wrap), recolor on bars, check block-into-enemy death, render
  a frame per step (do **not** call `complete_action()` until all blocks are at rest), then check
  all-cups-satisfied -> `next_level()` / `win()`, else check meter -> `lose()`. Mind the
  1000-frame cap in `perform_action`; a full loop is at most 21 frames.
- ACTION6 and RESET: `handle_reset()` for RESET (level reset only: set `ONLY_RESET_LEVELS`
  behaviour so score is kept); ACTION6 -> `complete_action()` immediately.
- Rendering the green side: four thin sprites on the ring, toggle visibility.
- Use `self.current_level.get_sprite_at` only for clicks; movement uses the cell grid the level
  builds in `on_set_level` (a dict of cell -> kind), which is far cheaper than sprite collision
  for a 21x17 torus.

## 6. Acceptance tests (`tests/games/test_as66.py`)

Run from `external/ARCEngine`: `.venv/bin/python -m unittest tests.games.test_as66` (21 tests).
Rewritten 17-Sep. The first version compared only the last frame of each action with 6 pixels of
meter slack, which is how the lap misreading and the winning-move meter got through.

1. **Against the recording.** Every recorded action replayed from the first RESET; every frame,
   frame count, state and score must match. Exact pixels are not the goal in themselves; they are
   the cheapest proof the mechanics are the recorded ones, since some rules only show mid-move.
2. **One test per rule**, each from a level start, using the shortest sequence that shows it:
   slide until stopped; wrap at the edge; a lap is charged but the ring and enemy go back; two
   blocks where one laps and the other moves (the old level 4 crash); a press toward the ring side
   is free; a blocked press in a new direction costs a move and steps enemies; a patrol reverses at
   its start and at a wall; corner-core enemies move diagonally and retrace (the level 8 paths);
   center-core enemies never move; sliding into an enemy loses; an enemy walking into a resting
   block loses; a bar recolors a passing block; a wrong-colored block sits in a marked cup without
   clearing; every press moves every block and all must be home; filling the meter loses; winning
   on the last budget move wins; the winning move is not charged; RESET restores the level and
   keeps the score; click is inert.
3. **Whole-game sweep.** Every position reachable within each level's budget, all four presses from
   each: nothing crashes, every level can be won, and the fewest winning moves equal the level's
   `par` in `LEVEL_SPECS`.

## 7. Deliverables checklist

- [x] `games/official/as66.py` + registration, `environment_files/as66/v1/`.
- [x] `tests/games/test_as66.py` passing.
- [x] Plan doc in ARCEngine: `docs/plans/17-September-2026-as66-mechanics-fix-plan.md`.
- [x] CHANGELOG entries in both repos.
- [x] Level layouts checked against Boss's screenshots (17-Sep, all match).
- [ ] Boss plays it through.

## 8. What the recreation is for

- Holdout task: a human-verified baseline exists (this recording), an agent baseline exists
  (gpt-5-nano), and ARC Prize never published the source. Keep the build out of any public
  listing; the arc-explainer page stays URL-only.
- **Boss's decision, 17-Sep: test only, never trained on.** AS66 is semi-public and its
  withdrawal suggests games like it are in the private set, which is what makes it worth testing
  agents on. The code being on public GitHub does not matter (agents under test have no
  internet). The harness copy is in `arc-3` at `datasets/test-only-games/as66/v1/` (merged in
  `sonpham-org/arc-3#38`), with the rule written into that folder's README, `AGENTS.md`,
  `harnesses/README.md` and the `--exclude-games` help on `distill/extract_sft.py`.
- Corpus: the `arc-3` decision-step corpus rejected AS66 records only because there was no
  source to cite (`2026-09-15-as66-the-withdrawn-26th-game.md` section 4a). The source now
  exists, but under the test-only decision AS66 records still stay out of the corpus and every
  other kind of training data.

## 9. Decisions on things the recording does not show

1. **Wrong-colored block in a marked cup.** Never happened. Decision: geometry only. Any block
   may enter any pocket; the cup just does not count as satisfied. (Alternative, stricter: the
   marker repels non-matching blocks. Do not pick it; it would change L9's difficulty.)
2. **Two blocks in one line.** Never happened. Decision: resolve blocks front-most first along
   the direction of motion each frame; a block treats another block as a wall. Two blocks can
   therefore end adjacent. A block may not enter a pocket another block occupies.
3. **Winning on the move that would fill the meter.** Untested in the recording. Implemented:
   the win is checked first, so it wins. Consistent with the recording, where the winning move is
   never charged on the meter.
4. **Laps.** No longer a decision: see 3.6. The recording shows the enemy step and ring flip
   mid-lap and both put back at the end. (The 16-Sep version skipped them; corrected 17-Sep.)
5. **Enemy colliding with a bar or cup.** Bars and cups block enemies (treated as walls);
   otherwise identical.
6. **Level 4's meter.** Resolved: budget 10, fill `round(188*m/10)` = 19/38/56 px. Exact.
7. **Two blocks, one laps.** Never happened in the recording (the 16-Sep build crashed on it,
   level 4). Decision: each block stops when it gets back to its own start cell, so no slide runs
   longer than one lap. The ring and enemies are put back only if every block ended where it
   started with its starting color; if the other block really moved, the move stands.
8. **A lap through a color bar.** Never happened. The block comes home a different color, so by
   rule 7 the move stands and nothing is put back.
