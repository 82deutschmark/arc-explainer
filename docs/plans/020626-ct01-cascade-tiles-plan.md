# 020626-ct01-cascade-tiles-plan

## Objective

Create a new ARCEngine game `ct01` ("Cascade Tiles") as a reskin of `ft09` (Functional Tiles). The game reuses ft09's proven constraint-satisfaction mechanic but makes the **click-effect pattern** the central puzzle element -- the one feature ft09 defines but never varies.

## ft09 Reverse-Engineering Reference

This section documents every decoded mechanic so the implementer does not need to re-read the obfuscated source.

### Tag System

| Tag | Role | Example Sprites |
|-----|------|-----------------|
| `Hkx` | Clickable color tiles (3x3 solid color, `collidable=True`) | `Hkx` |
| `bsT` | Constraint sprites (3x3, encode adjacency rules) | `ajm`, `aPM`, `APy`, etc. |
| `NTi` | Special tiles with custom click-effect shapes (3x3, pink/light-pink pattern) | `NTi`, `ZkU`, `ciC`, `fsp`, `ImU`, etc. |
| `gOi` | Union tag for "anything clickable" (both `Hkx` and `NTi` have this) | -- |
| `Ycb` | Tutorial flash border (level 0 only, flashes on misclick) | `UEq` |

### Core Data Fields (per-level `data` dict)

| Key | Type | Purpose | ft09 values |
|-----|------|---------|-------------|
| `kCv` | int | Timer budget (steps before game over). 0 = no timer. | 32, 32, 96, 96, 128, 128 |
| `cwU` | int[] | Color cycle list. Clicking a tile advances its center pixel through these colors. | `[9,8]`, `[9,12]`, `[8,12]`, `[9,8,12]`, `[14,15]`, `[11,14]` |
| `elp` | int[3][3] | Effect pattern. 1 = affected, 0 = not. Determines which neighbors also cycle when a tile is clicked. | Always `[[0,0,0],[0,1,0],[0,0,0]]` (center-only) in ALL 6 levels |

### How Clicking Works (`step()` method, decoded)

1. Player sends `ACTION6` with `(x, y)` screen coordinates
2. Engine converts to grid coordinates via `camera.display_to_grid(x, y)`
3. Engine looks for sprite at that position with tag `Hkx`, then `NTi`
4. If `NTi` tile was clicked: effect pattern is read from the tile's own pixel art (pixels with color `6` (pink) in the 3x3 mark affected neighbors)
5. If `Hkx` tile was clicked: effect pattern is the level's `elp` data
6. For each `1` in the 3x3 effect pattern: find the tile at that relative offset (4 pixels apart), cycle its center color through `cwU`
7. Color cycling: `current_index = cwU.index(tile.pixels[1][1]); next = cwU[(current_index + 1) % len(cwU)]`; then `color_remap(old, new)` on the tile

### How Win-Checking Works (`cgj()` method, decoded)

For every constraint sprite (tag `bsT`):
- Center pixel `[1][1]` = the target color
- Each of the 8 surrounding pixels encodes a rule for the corresponding adjacent tile (4px offset):
  - Pixel value `0` (white): the adjacent tile's center color **MUST equal** the target color
  - Pixel value non-`0`: the adjacent tile's center color **MUST NOT equal** the target color
- If ANY constraint has an unsatisfied rule, the level is not won
- When all constraints are satisfied: `next_level()` is called

### How the Timer Works (`sve` class, decoded)

- `sve(budget, game_ref)`: stores initial budget and current remaining
- Each step that does NOT win: `remaining -= 1`
- When `remaining` reaches 0: `lose()` is called
- Rendered as a 1-pixel-tall bar on row 63 of the 64x64 frame: filled pixels = color 12 (orange), empty = color 11 (yellow)
- `RESET` action restores the timer to full

### Visual Layout

- Camera: `Camera(0, 0, 16, 16, 4, 4, [timer_hud])` -- 16x16 logical grid at 4x scale = 64x64 output
- Grid: 32x32 per level. Tiles at 4px spacing (positions like 6,7 / 10,7 / 14,7 etc.)
- Background: solid black (color 5) sprites at layer -2
- Reference area: top-right corner. Contains:
  - 2x2 color swatches stacked vertically showing the available colors (e.g., blue swatch at (30,0), orange swatch at (30,2))
  - 11x11 minimap sprite showing a 3x3 grid of 3x3 color blocks representing the target state
- `BACKGROUND_COLOR = 4`, `PADDING_COLOR = 4`

---

## CT01 Design Specification

### Game Identity

- **Game ID**: `ct01`
- **Class Name**: `Ct01`
- **Display Name**: "Cascade Tiles"
- **Concept**: Same constraint-satisfaction puzzle as ft09, but each level uses a **different click-effect pattern** (`elp`). The player must figure out which neighbors are affected by each click and use that knowledge to satisfy all constraints.

### What Is Identical to ft09

1. **Constraint system**: 3x3 `bsT`-tagged sprites with center = target color, surrounds = match/not-match rules. Exact same `cgj()` win-check logic.
2. **Color cycling**: clicking advances tile center through `cwU` list via `color_remap`. Exact same cycling logic.
3. **Timer HUD**: `sve` class (renamed to `TimerBar`), same render on row 63.
4. **Camera**: `Camera(0, 0, 16, 16, 4, 4, [timer_hud])`.
5. **Grid sizing**: 32x32 per level, tiles at 4px spacing.
6. **Action**: `ACTION6` (click) only. `available_actions=[6]`.
7. **Reset**: Standard `ARCBaseGame` reset behavior.

### What Changes from ft09

1. **`elp` varies per level** -- this is the entire twist. Patterns below are specified exactly.
2. **No `NTi` special tiles** -- the varying `elp` provides all the complexity. Simpler sprite set.
3. **No tutorial level** -- no `Ycb` flash-on-misclick. Level 0 is a real (easy) level.
4. **New sprite pixel art** -- different visual identity. Tiles use color 14 (green) base instead of 9 (blue).
5. **Reference area shows the effect pattern** -- a small 3x3 indicator in the top-right corner showing which cells are active (color 11 for active, color 3 for inactive).
6. **Different color palettes per level**.
7. **Clean variable names** -- no obfuscation.

### Exact Level Specifications

#### Level 0: "intro" -- Center-Only

```
Grid:       3x3 tiles (9 tiles)
elp:        [[0,0,0],[0,1,0],[0,0,0]]  (center only -- same as ft09)
cwU:        [14, 8]                      (green / red, 2-color toggle)
Timer:      40 steps
Constraints: 1 bsT sprite
Tile area:  positions (10,10), (14,10), (18,10),
                      (10,14), (14,14), (18,14),
                      (10,18), (14,18), (18,18)
```

**Why solvable**: Center-only click = each tile is independent. 1 constraint with 2-color toggle is trivially solvable.

#### Level 1: "cross" -- Plus Shape

```
Grid:       3x3 tiles (9 tiles)
elp:        [[0,1,0],[1,1,1],[0,1,0]]  (cross/plus)
cwU:        [9, 12]                      (blue / orange, 2-color toggle)
Timer:      48 steps
Constraints: 2 bsT sprites
Tile area:  positions (10,10), (14,10), (18,10),
                      (10,14), (14,14), (18,14),
                      (10,18), (14,18), (18,18)
```

**Why solvable**: Cross pattern on 3x3 grid -- clicking center affects all 5 tiles (itself + 4 cardinal). Clicking corner affects 3 tiles. With 2-color toggle and 2 constraints, solution exists within ~4 clicks.

#### Level 2: "hline" -- Horizontal Line

```
Grid:       3x4 tiles (12 tiles)
elp:        [[0,0,0],[1,1,1],[0,0,0]]  (horizontal line)
cwU:        [8, 11]                      (red / yellow, 2-color toggle)
Timer:      64 steps
Constraints: 2 bsT sprites
Tile area:  3 columns x 4 rows at 4px spacing, starting (10,6)
            Row 0: (10,6),  (14,6),  (18,6)
            Row 1: (10,10), (14,10), (18,10)
            Row 2: (10,14), (14,14), (18,14)
            Row 3: (10,18), (14,18), (18,18)
```

**Why solvable**: Horizontal line means each click affects the tile and its left/right neighbors in the same row. Rows are independent from each other. 2-color toggle with row-independent mechanics = straightforward.

#### Level 3: "vline" -- Vertical Line

```
Grid:       4x3 tiles (12 tiles)
elp:        [[0,1,0],[0,1,0],[0,1,0]]  (vertical line)
cwU:        [15, 12, 9]                  (purple / orange / blue, 3-color cycle)
Timer:      80 steps
Constraints: 3 bsT sprites
Tile area:  4 columns x 3 rows at 4px spacing, starting (6,10)
            Row 0: (6,10),  (10,10), (14,10), (18,10)
            Row 1: (6,14),  (10,14), (14,14), (18,14)
            Row 2: (6,18),  (10,18), (14,18), (18,18)
```

**Why solvable**: Vertical line means each click affects the tile and its above/below neighbors in the same column. Columns are independent. 3-color cycle with 3 constraints increases difficulty but columns can be solved independently.

#### Level 4: "diag" -- Diagonal

```
Grid:       4x4 tiles (16 tiles)
elp:        [[1,0,0],[0,1,0],[0,0,1]]  (top-left to bottom-right diagonal)
cwU:        [14, 8]                      (green / red, 2-color toggle)
Timer:      96 steps
Constraints: 4 bsT sprites
Tile area:  4 columns x 4 rows at 4px spacing, starting (6,6)
            (6,6),  (10,6),  (14,6),  (18,6)
            (6,10), (10,10), (14,10), (18,10)
            (6,14), (10,14), (14,14), (18,14)
            (6,18), (10,18), (14,18), (18,18)
```

**Why solvable**: Diagonal affects self + upper-left + lower-right. 2-color toggle means each click is its own inverse. With 16 tiles and 4 constraints, the system is under-constrained enough to always have solutions.

#### Level 5: "full" -- Full 3x3 Area

```
Grid:       4x4 tiles (16 tiles)
elp:        [[1,1,1],[1,1,1],[1,1,1]]  (all 9 neighbors including self)
cwU:        [9, 11, 8]                   (blue / yellow / red, 3-color cycle)
Timer:      128 steps
Constraints: 4 bsT sprites
Tile area:  Same as Level 4
```

**Why solvable**: Full 3x3 effect is the hardest pattern. Every click affects up to 9 tiles. With 3-color cycle, each click advances all affected tiles by one step. The large timer (128) gives ample room for trial-and-error. Constraint count (4) is moderate for a 4x4 grid.

### Sprite Definitions (Exact Pixel Art)

#### Clickable Tiles (tag: `tile`)

```python
"tile": Sprite(
    pixels=[
        [14, 14, 14],
        [14, 14, 14],
        [14, 14, 14],
    ],
    name="tile",
    visible=True,
    collidable=True,
    tags=["tile"],
)
```

All tiles clone from this template. Initial color is always `cwU[0]` for the level -- set via `color_remap` in `on_set_level`.

#### Constraint Sprites (tag: `cst`)

Each level needs unique constraint sprites. The format is identical to ft09's `bsT` sprites:

```python
# Example: "target color is 8 (red), north and east neighbors must match, others must not"
"c_example": Sprite(
    pixels=[
        [2, 0, 0],   # [NW=notmatch, N=match, NE=match]
        [2, 8, 2],   # [W=notmatch, CENTER=red(8), E=notmatch]
        [2, 2, 2],   # [SW=notmatch, S=notmatch, SE=notmatch]
    ],
    name="c_example",
    visible=True,
    collidable=True,
    tags=["cst"],
)
```

Encoding (same as ft09):
- Center `[1][1]` = the target color value
- Surrounding pixels: `0` = adjacent tile MUST equal target color; any non-`0` value = adjacent tile MUST NOT equal target color
- Non-zero values use `2` (gray) or `3` (dark gray) as visual indicators. This is purely cosmetic -- only the zero/non-zero distinction matters to the win-check.

The implementer must design constraint sprites per level such that the level is solvable. Specific constraint sprites will be defined during implementation based on each level's grid layout and color palette.

**Constraint placement rule**: Each constraint sprite is placed at the grid position of the tile it describes. Its 8 surrounding pixels refer to the 8 tiles adjacent to that position (4px offset in each direction). If an adjacent position has no tile, the rule for that direction is ignored.

#### Background Sprite (layer -2)

```python
"bg": Sprite(
    pixels=[[4] * 32 for _ in range(32)],  # 32x32 solid darker-gray
    name="bg",
    visible=True,
    collidable=False,
    layer=-2,
)
```

#### Effect Pattern Indicator (top-right reference)

A 3x3 sprite showing the current level's `elp` pattern. Active cells = color 11 (yellow), inactive = color 3 (dark gray).

```python
# Built dynamically per level in on_set_level, example for cross pattern:
"epat": Sprite(
    pixels=[
        [3, 11, 3],
        [11, 11, 11],
        [3, 11, 3],
    ],
    name="epat",
    visible=True,
    collidable=False,
)
```

Positioned at `(28, 1)` -- top-right corner of the 32x32 grid (appears at top-right of screen at 4x scale).

#### Color Swatch Reference (top-right, below pattern indicator)

2x2 solid color blocks showing the available colors for cycling, stacked vertically. Same concept as ft09's reference swatches.

Positioned at `(29, 5)`, `(29, 7)`, `(29, 9)` for 2-color or 3-color levels.

### Game Class Structure

```python
class TimerBar(RenderableUserDisplay):
    """Identical to ft09's sve class. Renders a 1px bar on row 63."""
    def __init__(self, budget: int, game: "Ct01"): ...
    def tick(self) -> bool: ...       # Returns False when timer expires
    def reset(self) -> None: ...      # Reset to full budget
    def render_interface(self, frame): ...  # Draw bar on row 63

class Ct01(ARCBaseGame):
    def __init__(self):
        # Init with levels, camera (16x16 logical, 4x scale)
        super().__init__("ct01", levels, Camera(0, 0, 16, 16, 4, 4, [self.timer]))

    def on_set_level(self, level):
        # Read cwU, elp, kCv from level data
        # Collect tile sprites (tag "tile") and constraint sprites (tag "cst")
        # Remap all tiles to cwU[0]
        # Reset timer

    def step(self):
        # If no ACTION6: complete and return
        # Convert screen coords to grid coords
        # Find tile at that position
        # If no tile found: complete and return
        # Apply elp pattern: for each 1 in the 3x3 pattern,
        #   find tile at relative offset, cycle its color through cwU
        # Check win condition
        # If win: next_level()
        # If timer expired: lose()
        # complete_action()

    def check_win(self) -> bool:
        # For each constraint sprite (tag "cst"):
        #   For each of 8 surrounding pixels:
        #     Find tile at corresponding offset
        #     If pixel == 0: tile center must match constraint center
        #     If pixel != 0: tile center must NOT match constraint center
        #     If any rule fails: return False
        # Return True
```

### Files to Create

1. **`external/ARCEngine/games/official/ct01.py`** -- The complete game file (sprites, levels, classes)

### Files to Modify

1. **`external/ARCEngine/games/__init__.py`** -- Add `ct01` to `_GAME_REGISTRY` and `get_game()` function

### Constants

```python
BACKGROUND_COLOR = 4   # Darker Gray (matching ft09)
PADDING_COLOR = 4      # Darker Gray (matching ft09)
```

---

## Verification Plan

1. **Python import test**: `python -c "from games.official.ct01 import Ct01; g = Ct01(); print('OK', g.game_id)"`
2. **Catalog test**: `python server/python/arcengine_official_game_catalog.py` -- ct01 should appear in output
3. **Per-level smoke test**: For each level, send a RESET action and verify the initial frame renders without error
4. **Solvability audit**: For each level, manually trace through a solution sequence to verify the constraints can be satisfied given the effect pattern and color palette
5. **Timer test**: Verify that sending enough no-op-equivalent actions (clicking empty space) eventually triggers `GAME_OVER`
6. **Win test**: Verify that satisfying all constraints triggers `next_level()` or `WIN` on the last level

## Open Questions (None)

All mechanics are fully specified above. The implementer should design specific constraint sprite pixel art per level during implementation, following the encoding rules documented in this plan. The constraint pixels must be chosen so that each level is solvable.
