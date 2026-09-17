"""
Author: Claude Fable 5.1 (16-Sep-2026 recreation); Claude Opus 5 (17-Sep-2026 lap, crash and meter fixes)
Date: 17-September-2026
PURPOSE: AS66 "Always Sliding" -- a faithful ARCEngine recreation of the withdrawn ARC-AGI-3
         preview game. No source for the original exists; every rule here was read off Boss's
         27-Dec-2025 nine-level winning recording (arc-explainer:
         public/replays/as66-821a4dcad9c2.db85123a-891c-4fde-8bd3-b85c6702575d.jsonl) and is
         written up in docs/plans/2026-09-16-as66-always-sliding-recreation-prd.md. Level layouts
         were also checked against Boss's screenshots (arc-explainer client/public/as66*.png:
         level 1 and levels 3-9); all match.

         The game: colored one-cell blocks slide until they hit something; the field wraps at
         its edges like a torus; orange 3x3 enemies with a dark-red core patrol and kill on
         contact; colored 3-cell bars recolor a block that slides through them; every block must
         sit in a white cup whose back-wall marker is white or its own color. Four directions,
         nine levels, a perimeter meter that fills with every counted move; the move that fills
         it loses the level.

         Rendering: the whole 64x64 frame is drawn into one canvas sprite from a cell model
         (walls, cups, bars, enemies, blocks) rather than one sprite per entity, because the
         original's field sizes and cell pitches change per level. Collision uses the cell model,
         never sprites. tests/games/test_as66.py replays the recording and every frame matches.

         Rules the recording forced that a first reading would not guess (keep them):
           * enemies step BEFORE the block slides (row 18 death geometry);
           * a press in the direction the green ring side already shows is a total no-op
             (rows 20, 36, 115, 116), while a blocked press in a new direction still counts:
             enemies step and the meter fills (rows 12, 114);
           * a lap -- a slide that carries the block all the way round the torus to its own cell --
             plays like any move (ring flips, enemies step, block goes round), then on the frame
             the block gets home the ring and enemies go back to how they stood; the move stays
             charged (rows 24, 30, 31). Fixed 17-Sep: this was first read as "enemies do not
             step", which matched only the last frame and could slide forever with two blocks;
           * enemies reverse at their start cell even when the cells behind it are free (L3);
           * the level-6 death at 16 counted moves with no contact is the meter: each level has a
             move budget (15 12 18 10 20 16 20 28 30) and the move that fills the meter loses;
           * the winning move is not charged on the meter (all nine recorded clears).
         Not in the recording, decided here: with two blocks, each stops when it gets home; if
         the other block really moved, nothing is taken back.
SRP/DRY check: Pass -- level data is parsed once by the same reader that produced
         docs/arc3-game-analysis/as66_levels.json; nothing here duplicates engine collision code.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

import numpy as np

from arcengine import ARCBaseGame, Camera, GameAction, Level, Sprite

# --------------------------------------------------------------------------------------
# Palette (ARC-3 indices)
# --------------------------------------------------------------------------------------
WHITE = 0
LIGHT_GRAY = 1
DARK_GRAY = 3
WALL = 4
BLACK = 5
PINK = 6
RED = 8
BLUE = 9
LIGHT_BLUE = 10
YELLOW = 11
ORANGE = 12
DARK_RED = 13
GREEN = 14
PURPLE = 15

BLOCK_COLORS = (RED, YELLOW, LIGHT_BLUE, PINK, BLUE)
BAR_COLORS = (BLUE, YELLOW, LIGHT_BLUE, PINK)
MARKER_COLORS = (WHITE, PINK, BLUE, LIGHT_BLUE, YELLOW)

HEX = "0123456789ABCDEF"

Cell = Tuple[int, int]
DIRS: Dict[str, Cell] = {"UP": (0, -1), "DOWN": (0, 1), "LEFT": (-1, 0), "RIGHT": (1, 0)}
ACTION_TO_DIR = {GameAction.ACTION1: "UP", GameAction.ACTION2: "DOWN", GameAction.ACTION3: "LEFT", GameAction.ACTION4: "RIGHT"}
SIDE_OF_DIR = {"UP": "TOP", "DOWN": "BOTTOM", "LEFT": "LEFT", "RIGHT": "RIGHT"}

# --------------------------------------------------------------------------------------
# Level data -- grids transcribed from the recording (field coordinates, one char per cell)
#   F purple floor   4 wall   0 cup white   C enemy orange   D enemy core
#   8 red block  B yellow  A light blue  6 pink  9 blue  (block, marker, or bar cell)
# --------------------------------------------------------------------------------------
LEVEL_SPECS: List[dict] = [
    dict(
        par=3, budget=15, cell=4, origin=(8, 8), green="TOP",
        grid=[
            "FFFFFF44FF4F", "F4FFFFF444FF", "FF44FF4484FF", "FF444FFFFFFF", "F44444FFFFFF", "FF44FFFFF4FF",
            "FFFFFFF444FF", "FFFFFFF444FF", "FFF0F0FF4F4F", "FFF000FFFFFF", "FFFFFFFFFFFF", "FFFFFFFFFFFF",
        ],
    ),
    dict(
        par=3, budget=12, cell=4, origin=(8, 8), green="LEFT",
        grid=[
            "FFFFFFFFFFFF", "FF4FFFFFFFFF", "F4FFFFFFFFFF", "FFFFFFF4FFFF", "FFFFFF444FFF", "FFFFFF444BFF",
            "FFFFFF44FFFF", "F00FFFFFFFFF", "F0FFFF44FFFF", "F00FF444FF4F", "FFFFFFFFF4FF", "FFFFFFFFFFFF",
        ],
    ),
    dict(
        par=7, budget=18, cell=4, origin=(8, 8), green="TOP",
        grid=[
            "FCCCFFFF4FFF", "FCCDFFFFFFFF", "FCCCFFFFFFFF", "FFF44F44FFFF", "FFF4BFF4FFFF", "FFF4FFFFFF4F",
            "FFFFFF44FF4F", "F44FFFFFFFFF", "F4FF4FFFFFFF", "FFFF000FF44F", "FFFF0F0FFFFF", "FFFFFFFFFFFF",
        ],
    ),
    dict(
        par=4, budget=10, cell=4, origin=(4, 8), green="BOTTOM",
        grid=[
            "FFFFFFFFFFFFFF", "FFF4FFFF44FFFF", "FF44FFFFF44FFF", "FFFFFFFFFFFFFF", "FF446FFFF4FFFF", "FF444FFF44F4FF",
            "F00FFFFFFF444F", "FAFFFFFFFFF44F", "F00FFF4AFFF4FF", "FFF06044FF444F", "FFF0F0FFFFF4FF", "FFFFFFFFFFFFFF",
        ],
    ),
    dict(
        par=13, budget=20, cell=3, origin=(5, 5), green="LEFT",
        grid=[
            "FFFFFFFFFFFFFFFFFF", "FF4F44FFFFFFFFFFFF", "CCC44444FFFF444FFF", "CCC0044FFBFF444FFF", "CDCFB44FFBFFFFFFFF",
            "FFF00444FBFFFFFFFF", "FFFFFCCCFFFFFFFFFF", "FFFFFCDCFFFFFFF4FF", "FFFF4CCCFF4FFFFF4F", "FFF4444AFFFFFFFF4F",
            "FF44444FFFFFFFF44F", "FF44444FFFF44FF4FF", "FFFF4CCCFFFF4FF4FF", "FFFFFCDCFFFFFFFFFF", "FFFFFCCCFFFCCCFFFF",
            "FFFFFFFFFFFCDCFFFF", "FFFFFFFFFFFCCCFFFF", "FFFFFFFFFFFFFFFFFF",
        ],
    ),
    dict(
        par=8, budget=16, cell=3, origin=(12, 9), green="RIGHT",
        grid=[
            "FFFFFFFFFFFFF", "FFFFFFFF999FF", "FFFFFFFFFFFFF", "F44FFFFFFF4FF", "F444F4FF4444F", "FFFFFFFF444FF",
            "FFFFFFFFF4FFF", "FFFFFFFFFFFFF", "FFFFFFFFFFFFF", "FF090F4F64FFF", "FF0F0F44444FF", "CCCFFFF44444F",
            "CCDFFFF44444F", "CCCFFFFFFF4FF", "FFFFFFFFFFFFF",
        ],
    ),
    dict(
        par=7, budget=20, cell=4, origin=(6, 12), green="RIGHT",
        grid=[
            "FFFFFFFFFFFFF", "FFFFFFFFF4FFF", "FF44FF9F4444F", "F644FF9FF4FFF", "F4444F9FF4FFF", "FF44FFFFFFFFF",
            "FFFFFFFFFFFFF", "FFFFFFFFF090F", "FFFFFFFFF0F0F", "FFFFFFFFFFFFF",
        ],
    ),
    dict(
        par=9, budget=28, cell=3, origin=(6, 6), green="LEFT",
        grid=[
            "FFFFFFFFFFFFFFFFF", "FFFFFF9FFFFF4FFFF", "F44FFF9FFFFF44FFF", "F4FFFF9FFFFF4FFFF", "FFFFFFFFFFFFFFFFF",
            "FFFFFFFCCDFFFFFFF", "FFFFFF4CCCFFFFFFF", "F4FFFF4CCCFF4FFFF", "F44FF444FFF44FFFF", "F4FFFF4FFFFF4FFFF",
            "FFFCCCFFFFFFFFFFF", "FFFCCCFFFFFFFFFFF", "F4BCCDFFFFFF4FFFF", "F44FFFFFFFF44400F", "FFFFFFFFFFFFFF9FF",
            "FFFFFFFFFFFFFF00F", "FFFFFFFFFFFFFFFFF",
        ],
    ),
    dict(
        par=11, budget=30, cell=2, origin=(11, 15), green="LEFT",
        grid=[
            "FFFFFFFFFFFFFFFFFFFFF", "FFFFFF44FFFFFF44FFFFF", "FFFFFF44FBF9F444FFFFF", "FF0F0F4FFBF9FF4FFFFFF",
            "FF090FFFFBF9FFFFFFFFF", "FFFFFFFFFFFFFFFFFFFFF", "F444FFFFFFFFFFFFFFFFF", "F44FFFFFFFFFFF44FFFFF",
            "FFFFFFFFFFFFF444FFFFF", "F44FFFFFFFFFFF44F444F", "F44BFFFF4F00FFFFF444F", "FF4FFFF44F0FFFFFFF44F",
            "FFFFFFFFFF00FFFFFFFFF", "FFFCCCFFFF44FFFFFFFFF", "FFFCCDFFFF4AFFFFFF44F", "FFFCCCFFFF444FFFF444F",
            "FFFFFFFFFFFFFFFFFFFFF",
        ],
    ),
]

WIN_LEVELS = len(LEVEL_SPECS)


# --------------------------------------------------------------------------------------
# Level model
# --------------------------------------------------------------------------------------
@dataclass
class Cup:
    pocket: Cell
    opening: str
    marker_cell: Cell
    required: Optional[int]  # None = any color
    whites: List[Cell]


@dataclass
class Enemy:
    origin: Cell  # top-left of the 3x3 at level start
    pos: Cell
    dir0: Cell  # initial heading, (0,0) for static
    heading: Cell

    def cells(self, pos: Optional[Cell] = None) -> List[Cell]:
        x, y = pos or self.pos
        return [(x + dx, y + dy) for dy in range(3) for dx in range(3)]

    def core(self) -> Cell:
        return (self.pos[0] + 1 + self.heading[0], self.pos[1] + 1 + self.heading[1])


@dataclass
class Block:
    pos: Cell
    color: int
    start: Cell = (0, 0)
    moving: bool = False


@dataclass
class FieldModel:
    cols: int
    rows: int
    walls: Set[Cell] = field(default_factory=set)
    cups: List[Cup] = field(default_factory=list)
    bars: Dict[Cell, int] = field(default_factory=dict)
    enemies: List[Enemy] = field(default_factory=list)
    blocks: List[Block] = field(default_factory=list)

    # cells no block or enemy may ever enter
    def solid(self) -> Set[Cell]:
        s = set(self.walls)
        for c in self.cups:
            s.update(c.whites)
            s.add(c.marker_cell)
        return s


def _heading_from_core(dx: int, dy: int) -> Cell:
    return (dx, dy)


def parse_grid(grid: List[str]) -> FieldModel:
    rows, cols = len(grid), len(grid[0])
    g = [[HEX.index(ch) for ch in row] for row in grid]
    m = FieldModel(cols=cols, rows=rows)

    def at(x: int, y: int) -> Optional[int]:
        return g[y][x] if 0 <= x < cols and 0 <= y < rows else None

    for y in range(rows):
        for x in range(cols):
            if g[y][x] == WALL:
                m.walls.add((x, y))

    # enemies: 3x3 orange with one dark-red core
    for y in range(rows - 2):
        for x in range(cols - 2):
            blk = [g[y + dy][x + dx] for dy in range(3) for dx in range(3)]
            if sorted(blk) == [ORANGE] * 8 + [DARK_RED]:
                k = blk.index(DARK_RED)
                d = (k % 3 - 1, k // 3 - 1)
                m.enemies.append(Enemy(origin=(x, y), pos=(x, y), dir0=d, heading=d))

    # cups: a 3-cell white back wall (center may be a colored marker), two white legs, a purple pocket
    for y in range(rows):
        for x in range(cols):
            mk = g[y][x]
            if mk not in MARKER_COLORS:
                continue
            for (ax, ay), (px, py), opening in (((1, 0), (0, -1), "UP"), ((1, 0), (0, 1), "DOWN"), ((0, 1), (-1, 0), "LEFT"), ((0, 1), (1, 0), "RIGHT")):
                b1 = (x - ax, y - ay)
                b2 = (x + ax, y + ay)
                l1 = (b1[0] + px, b1[1] + py)
                l2 = (b2[0] + px, b2[1] + py)
                pocket = (x + px, y + py)
                if all(at(*c) == WHITE for c in (b1, b2, l1, l2)) and at(*pocket) == PURPLE:
                    m.cups.append(Cup(pocket=pocket, opening=opening, marker_cell=(x, y), required=None if mk == WHITE else mk, whites=[b1, b2, l1, l2]))

    cup_cells = {c for cup in m.cups for c in cup.whites} | {cup.marker_cell for cup in m.cups}

    # bars (straight runs of >= 2 colored cells) and single blocks
    for color in BLOCK_COLORS:
        cs = {(x, y) for y in range(rows) for x in range(cols) if g[y][x] == color and (x, y) not in cup_cells}
        for (x, y) in sorted(cs):
            if (x - 1, y) in cs or (x, y - 1) in cs:
                continue
            run = [(x, y)]
            if (x + 1, y) in cs:
                while (run[-1][0] + 1, y) in cs:
                    run.append((run[-1][0] + 1, y))
            elif (x, y + 1) in cs:
                while (x, run[-1][1] + 1) in cs:
                    run.append((x, run[-1][1] + 1))
            if len(run) >= 2:
                for c in run:
                    m.bars[c] = color
            else:
                m.blocks.append(Block(pos=(x, y), color=color, start=(x, y)))
    return m


# --------------------------------------------------------------------------------------
# The game
# --------------------------------------------------------------------------------------
class As66(ARCBaseGame):
    """AS66 -- Always Sliding. See module docstring for the rules and their provenance."""

    def __init__(self, seed: int = 0) -> None:
        levels = [Level(sprites=[Sprite(pixels=np.full((64, 64), DARK_GRAY, dtype=np.int8), name="canvas", layer=0, collidable=False)], data=dict(spec)) for spec in LEVEL_SPECS]
        super().__init__(
            game_id="as66",
            levels=levels,
            camera=Camera(0, 0, 64, 64, background=DARK_GRAY, letter_box=DARK_GRAY),
            available_actions=[1, 2, 3, 4, 6],
            win_score=WIN_LEVELS,
            seed=seed,
        )

    # ---------------------------------------------------------------- level lifecycle
    def on_set_level(self, level: Level) -> None:
        spec = {k: level.get_data(k) for k in ('par', 'budget', 'cell', 'origin', 'green', 'grid')}
        self._spec = spec
        self._model = parse_grid(spec["grid"])
        self._par: int = spec["par"]  # fewest counted moves that clear the level (asserted by the whole-game sweep test)
        self._budget: int = spec["budget"]  # the move on which the meter fills and the level is lost
        self._cell: int = spec["cell"]
        self._origin: Cell = tuple(spec["origin"])  # type: ignore[assignment]
        self._green: str = spec["green"]
        self._moves = 0
        self._meter_moves = 0  # the meter is redrawn on settle frames only, never on a death or winning frame
        self._sliding = False
        self._lapped = False
        self._before_move: Tuple[str, List[Tuple[Cell, Cell]], List[Tuple[Cell, int]]] = (self._green, [], [])
        self._canvas = level.get_sprites_by_name("canvas")[0]
        self._draw()

    # ---------------------------------------------------------------- input
    def step(self) -> None:
        action = self.action.id
        if self._sliding:
            self._slide_frame()
            return
        if action not in ACTION_TO_DIR:
            # RESET (already handled by the engine) and ACTION6 (accepted, inert, free)
            self._draw()
            self.complete_action()
            return
        direction = ACTION_TO_DIR[action]
        if SIDE_OF_DIR[direction] == self._green:
            # pressing the side the ring already shows: nothing happens, nothing is charged
            self.complete_action()
            return
        self._begin_move(direction)

    # ---------------------------------------------------------------- move resolution
    def _begin_move(self, direction: str) -> None:
        """Start a counted move: flip the ring, step the enemies, then slide.

        Every move plays out the same way, laps included. What a lap takes back is decided at
        settle time from the snapshot taken here (see _settle), never predicted up front: a
        prediction made before the enemies step cannot see the lane they are about to open or
        close, and an unpredicted lap used to slide forever.
        """
        self._dir = DIRS[direction]
        self._moves += 1
        self._lapped = False
        self._before_move = (self._green, [(e.pos, e.heading) for e in self._model.enemies], [(b.pos, b.color) for b in self._model.blocks])
        for b in self._model.blocks:
            b.start = b.pos
            b.moving = True

        self._green = SIDE_OF_DIR[direction]
        self._step_enemies()
        if self._any_enemy_on_block():
            self._draw()
            self.lose()
            self.complete_action()
            return
        if not any(self._can_step(b) for b in self._model.blocks):
            # blocked in a new direction: enemies stepped and the meter fills, one frame
            for b in self._model.blocks:
                b.moving = False
            self._settle()
            return
        self._sliding = True
        self._slide_frame()

    def _can_step(self, b: Block) -> bool:
        solid = self._model.solid()
        occupied = {o.pos for o in self._model.blocks if o is not b}
        nxt = self._wrap((b.pos[0] + self._dir[0], b.pos[1] + self._dir[1]))
        return nxt not in solid and nxt not in occupied

    def _slide_frame(self) -> None:
        """Advance every moving block one cell (front-most first), render, and settle."""
        solid = self._model.solid()
        enemy_cells = {c for e in self._model.enemies for c in e.cells()}
        moving = [b for b in self._model.blocks if b.moving]
        if not moving:
            self._settle()
            return
        # front-most first along the direction of motion so trailing blocks stack behind
        moving.sort(key=lambda b: -(b.pos[0] * self._dir[0] + b.pos[1] * self._dir[1]))
        died = False
        arrived_home = False
        for b in moving:
            occupied = {o.pos for o in self._model.blocks if o is not b}
            nxt = self._wrap((b.pos[0] + self._dir[0], b.pos[1] + self._dir[1]))
            if nxt in solid or nxt in occupied:
                b.moving = False
                continue
            b.pos = nxt
            if nxt in self._model.bars:
                b.color = self._model.bars[nxt]
            if nxt in enemy_cells:
                died = True
            if nxt == b.start:
                # all the way round the torus and home: a block never passes its own start cell,
                # so no slide can run longer than one lap
                b.moving = False
                self._lapped = True
                arrived_home = True
            elif not self._can_step(b):
                b.moving = False  # stops now; the next frame is the settle frame
        if died:
            # the fatal frame is the last frame; the meter is not redrawn
            self._draw()
            self._sliding = False
            self.lose()
            self.complete_action()
            return
        if arrived_home and not any(b.moving for b in self._model.blocks):
            # a lap ends on the frame the block gets home (rows 24, 30, 31: 12 frames for a 12-cell lap)
            self._settle()
            return
        self._draw()

    def _settle(self) -> None:
        """End a counted move: win, take back a lap that changed nothing, charge the meter, check the budget."""
        self._sliding = False
        if self._all_cups_satisfied():
            # the winning move is not charged: all nine recorded clears show the previous count
            self._draw()
            self.next_level()  # win() is called by the engine on the last level
            self.complete_action()
            return
        green_before, enemies_before, blocks_before = self._before_move
        if self._lapped and [(b.pos, b.color) for b in self._model.blocks] == blocks_before:
            # A lap that left every block where it was, same color, is taken back: the ring side
            # and the enemies return to how they stood before the press. The move stays charged.
            self._green = green_before
            for e, (pos, heading) in zip(self._model.enemies, enemies_before):
                e.pos, e.heading = pos, heading
        self._meter_moves = self._moves
        self._draw()
        if self._moves >= self._budget:
            self.lose()
        self.complete_action()

    # ---------------------------------------------------------------- enemies
    def _step_enemies(self) -> None:
        solid = self._model.solid()
        for e in self._model.enemies:
            if e.dir0 == (0, 0):
                continue
            others = {c for o in self._model.enemies if o is not e for c in o.cells()}

            def blocked(h: Cell) -> bool:
                nxt = (e.pos[0] + h[0], e.pos[1] + h[1])
                for c in e.cells(nxt):
                    if not (0 <= c[0] < self._model.cols and 0 <= c[1] < self._model.rows):
                        return True
                    if c in solid or c in self._model.bars or c in others:
                        return True
                return False

            back = (-e.dir0[0], -e.dir0[1])
            if e.heading == back and e.pos == e.origin:
                e.heading = e.dir0  # the start cell is a hard end of the patrol
            if blocked(e.heading):
                e.heading = back if e.heading == e.dir0 else e.dir0
                if blocked(e.heading):
                    continue
            e.pos = (e.pos[0] + e.heading[0], e.pos[1] + e.heading[1])
            # after arriving, a further blocked step (or the origin) flips the shown core
            if e.heading == e.dir0 and blocked(e.dir0):
                e.heading = back
            elif e.heading == back and (e.pos == e.origin or blocked(back)):
                e.heading = e.dir0

    def _any_enemy_on_block(self) -> bool:
        cells = {c for e in self._model.enemies for c in e.cells()}
        return any(b.pos in cells for b in self._model.blocks)

    # ---------------------------------------------------------------- rules
    def _wrap(self, c: Cell) -> Cell:
        return (c[0] % self._model.cols, c[1] % self._model.rows)

    def _all_cups_satisfied(self) -> bool:
        by_pos = {b.pos: b for b in self._model.blocks}
        satisfied = 0
        for cup in self._model.cups:
            b = by_pos.get(cup.pocket)
            if b is not None and (cup.required is None or cup.required == b.color):
                satisfied += 1
        return satisfied == len(self._model.blocks) and all(b.pos in {c.pocket for c in self._model.cups} for b in self._model.blocks)

    # ---------------------------------------------------------------- rendering
    def _draw(self) -> None:
        px = self._canvas.pixels
        px.fill(DARK_GRAY)
        m, cell, (ox, oy) = self._model, self._cell, self._origin
        fw, fh = m.cols * cell, m.rows * cell

        def fill(x0: int, y0: int, w: int, h: int, color: int) -> None:
            px[max(0, y0) : min(64, y0 + h), max(0, x0) : min(64, x0 + w)] = color

        # ring (one cell thick) with darker corners, then the green side
        fill(ox - cell, oy - cell, fw + 2 * cell, fh + 2 * cell, LIGHT_GRAY)
        for cx, cy in ((ox - cell, oy - cell), (ox + fw, oy - cell), (ox - cell, oy + fh), (ox + fw, oy + fh)):
            fill(cx, cy, cell, cell, WALL)
        if self._green == "TOP":
            fill(ox, oy - cell, fw, cell, GREEN)
        elif self._green == "BOTTOM":
            fill(ox, oy + fh, fw, cell, GREEN)
        elif self._green == "LEFT":
            fill(ox - cell, oy, cell, fh, GREEN)
        else:
            fill(ox + fw, oy, cell, fh, GREEN)

        # field
        fill(ox, oy, fw, fh, PURPLE)

        def cellfill(c: Cell, color: int) -> None:
            fill(ox + c[0] * cell, oy + c[1] * cell, cell, cell, color)

        for c in m.walls:
            cellfill(c, WALL)
        for cup in m.cups:
            for c in cup.whites:
                cellfill(c, WHITE)
            cellfill(cup.marker_cell, WHITE if cup.required is None else cup.required)
        for c, color in m.bars.items():
            cellfill(c, color)
        for e in m.enemies:
            for c in e.cells():
                cellfill(c, ORANGE)
            cellfill(e.core(), DARK_RED)
        for b in m.blocks:
            cellfill(b.pos, b.color)

        # perimeter meter: one 188-px path that starts at the top center and grows both ways,
        # along the top row and then down each side column (rows 1..62); full on the losing move
        px[0, :] = ORANGE
        px[1:63, 0] = ORANGE
        px[1:63, 63] = ORANGE
        total = min(188, int(round(188 * self._meter_moves / self._budget)))
        left_len, right_len = (total + 1) // 2, total // 2
        for length, top_cols, col in ((left_len, range(31, -1, -1), 0), (right_len, range(32, 64), 63)):
            n_top = min(32, length)
            for c in list(top_cols)[:n_top]:
                px[0, c] = DARK_RED
            n_side = max(0, length - 32)
            px[1 : 1 + n_side, col] = DARK_RED

        # level progress bar
        px[63, :] = BLACK
        done = int(round(64 * self._score / WIN_LEVELS))
        px[63, :done] = WHITE


# --------------------------------------------------------------------------------------
# Local smoke run
# --------------------------------------------------------------------------------------
if __name__ == "__main__":
    from arcengine import ActionInput, GameState

    game = As66()
    frame = game.perform_action(ActionInput(id=GameAction.RESET))
    for name in ("DOWN", "LEFT", "DOWN"):
        act = {v: k for k, v in ACTION_TO_DIR.items()}[name]
        frame = game.perform_action(ActionInput(id=act))
        print(name, frame.state, frame.levels_completed, len(frame.frame))
    assert frame.levels_completed == 1 and frame.state == GameState.NOT_FINISHED
