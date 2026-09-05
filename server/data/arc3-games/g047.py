# ARC-AGI-3 candidate task g047.

import numpy as np

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    RenderableUserDisplay,
    Sprite,
)
from sprite_book import core, outline, ring

FIELD = 1
GRIT = 3
M_FLOOR = 1
M_WALL = 3
M_PLAYER = 8
M_EXIT = 14
M_EMPTY = 15
CHROME = 3
BAR_ARMED = 11
FITTINGS = (3, 14, 8, 1, 3)

N = 12
CELL = 4
ORIGIN = 8
SPAN = N * CELL
SLOT_DEEP = 6
BAND_DEEP = 8

ANCHORS = ((5, 0), (11, 5), (6, 11), (0, 6))
DIRS = ((0, -1), (1, 0), (0, 1), (-1, 0))

CORNERS = ((0, 0), (0, 64 - ORIGIN), (64 - ORIGIN, 0), (64 - ORIGIN, 64 - ORIGIN))

def _grit_mask():
    mask = np.zeros((SPAN, SPAN), dtype=bool)
    seed = 0x5EED47
    for y in range(SPAN):
        for x in range(SPAN):
            seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
            mask[y, x] = (seed >> 16) % 29 == 0
    return mask


GRIT_MASK = _grit_mask()


def strip_cells(rows, anchor, orient):
    cells = []
    x, y = anchor
    dx, dy = DIRS[orient]
    while 0 <= x < N and 0 <= y < N and len(cells) < N:
        cells.append((x, y))
        if rows[y][x] == "#":
            break
        x += dx
        y += dy
    return cells


def visible_cells(rows, orients):
    seen = set()
    for k in range(4):
        seen.update(strip_cells(rows, ANCHORS[k], orients[k]))
    return seen


LEVELS_SPEC = [
    {"orients": [2, 3, 0, 1], "rows": [
        "............",
        ".....P......",
        "............",
        "............",
        "............",
        "............",
        "............",
        "............",
        "............",
        ".....X......",
        "............",
        "............",
    ]},
    {"orients": [2, 3, 3, 1], "rows": [
        "............",
        ".....P......",
        "............",
        "......X.....",
        "............",
        "............",
        "............",
        "............",
        "............",
        "............",
        "............",
        "............",
    ]},
    {"orients": [2, 1, 0, 1], "rows": [
        "............",
        ".##########.",
        ".#........#.",
        ".#.######.#.",
        ".#.#....#.#.",
        "..X.........",
        ".#.#....#.#.",
        ".#.######.#.",
        ".#........#.",
        ".##########.",
        ".....P......",
        "............",
    ]},
    {"orients": [1, 0, 3, 0], "rows": [
        "............",
        "..####.####.",
        "..#......#..",
        "..#.#.##.#..",
        "....#..#....",
        "..#.#..#.#..",
        "....#..#....",
        "..#.####.#..",
        "..#......#..",
        "..####.####.",
        "...........X",
        "..P.........",
    ]},
    {"orients": [0, 0, 1, 0], "rows": [
        "............",
        ".#.#######.#",
        ".#P......#.#",
        ".#.#####.#.#",
        ".#.#...#.#.#",
        "...#.#.#....",
        ".#.#.#.#.#.#",
        ".#.#.#.#.#.#",
        ".#...#...#.#",
        ".#####.####.",
        "............",
        "..X.........",
    ]},
    {"orients": [1, 1, 0, 3], "rows": [
        "..#....#....",
        "..#.##.#.##.",
        "..#.#..#..#.",
        "....#.###.#.",
        ".####.#...#.",
        "......#.###.",
        ".###..#...#.",
        ".#..#.###.#.",
        ".#.##.....#.",
        "X#....###.#.",
        ".####.#.....",
        ".........P..",
    ]},
    {"orients": [3, 3, 1, 3], "rows": [
        "....#.......",
        ".##.#.#####.",
        ".#P.#.....#.",
        ".#.##.###.#.",
        ".#....#.#.#.",
        "...####.#...",
        ".#.#....#.#.",
        ".#.#.####.#.",
        ".#...#....#.",
        ".#####.####.",
        ".......#....",
        ".........#.X",
    ]},
]


def _cell_block(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                px, py = ORIGIN + x * CELL, ORIGIN + y * CELL
                if char == "#":
                    sprites.append(Sprite(
                        pixels=_cell_block(FIELD), name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif char == "X":
                    sprites.append(Sprite(
                        pixels=_cell_block(FIELD), name="exit",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0, tags=["exit"],
                    ).set_position(px, py))
                elif char == "P":
                    sprites.append(Sprite(
                        pixels=_cell_block(FIELD), name="player",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=1,
                    ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(64, 64)))
    return levels


class G047A(RenderableUserDisplay):

    def __init__(self, game: "G047") -> None:
        super().__init__()
        self._game = game

    @staticmethod
    def _put(frame, k, a0, a1, d0, d1, colour) -> None:
        if k == 0:
            frame[d0:d1, ORIGIN + a0:ORIGIN + a1] = colour
        elif k == 1:
            frame[ORIGIN + a0:ORIGIN + a1, 64 - d1:64 - d0] = colour
        elif k == 2:
            frame[64 - d1:64 - d0, ORIGIN + a0:ORIGIN + a1] = colour
        else:
            frame[ORIGIN + a0:ORIGIN + a1, d0:d1] = colour

    def _slot_colour(self, cell) -> int:
        g = self._game
        if cell == (g.px, g.py):
            if g.flash and cell == g.exit:
                return M_EXIT if g.flash % 2 else M_PLAYER
            return M_PLAYER
        if cell == g.exit:
            return M_EXIT
        return M_WALL if g.rows[cell[1]][cell[0]] == "#" else M_FLOOR

    def _paint_field(self, frame) -> None:
        field = frame[ORIGIN:ORIGIN + SPAN, ORIGIN:ORIGIN + SPAN]
        field[:] = FIELD
        field[GRIT_MASK] = GRIT

    def _paint_panel(self, frame, k) -> None:
        g = self._game
        cells = strip_cells(g.rows, ANCHORS[k], g.orients[k])
        lit = BAR_ARMED if g.held == k else CHROME
        self._put(frame, k, 0, SPAN, SLOT_DEEP, BAND_DEEP, M_EMPTY)
        for i in range(N):
            a = i * CELL
            self._put(frame, k, a, a + CELL, 0, SLOT_DEEP,
                      self._slot_colour(cells[i]) if i < len(cells) else M_EMPTY)
            self._put(frame, k, a, a + CELL - 1, SLOT_DEEP, BAND_DEEP, lit)
            if i % 4 == 3 and i != N - 1:
                self._put(frame, k, a + CELL - 1, a + CELL, BAND_DEEP - 1, BAND_DEEP, lit)

    def _paint_corners(self, frame) -> None:
        tick = self._game.tick
        for seed, (top, left) in enumerate(CORNERS):
            frame[top:top + ORIGIN, left:left + ORIGIN] = M_EMPTY
            phase = (tick + seed) % len(FITTINGS)
            art = ring(FITTINGS[phase]) if phase % 2 == 0 else core(FITTINGS[phase])
            for y in range(CELL):
                for x in range(CELL):
                    if art[y][x] >= 0:
                        frame[top + 2 + y, left + 2 + x] = art[y][x]

    def _paint_flash(self, frame) -> None:
        step = G047.FLASH_FRAMES - self._game.flash
        inset = 4 * (G047.FLASH_FRAMES - step)
        lo, hi = ORIGIN + inset, ORIGIN + SPAN - inset
        if hi - lo >= 4:
            outline(frame, (lo, lo, hi, hi), M_EXIT)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        self._paint_field(frame)
        for k in range(4):
            self._paint_panel(frame, k)
        self._paint_corners(frame)
        if self._game.flash:
            self._paint_flash(frame)
        return frame


class G047(ARCBaseGame):

    FLASH_FRAMES = 5

    def __init__(self) -> None:
        spec = LEVELS_SPEC[0]
        self.rows = spec["rows"]
        self.orients = list(spec["orients"])
        self.held: int | None = None
        self.flash = 0
        self.tick = 0
        self.px, self.py = self._find(spec["rows"], "P")
        self.exit = self._find(spec["rows"], "X")
        camera = Camera(
            width=64, height=64, background=FIELD, letter_box=FIELD,
            interfaces=[G047A(self)],
        )
        super().__init__(game_id="g047", levels=build_levels(), camera=camera)

    @staticmethod
    def _find(rows, char) -> tuple[int, int]:
        for y, row in enumerate(rows):
            for x, c in enumerate(row):
                if c == char:
                    return x, y
        raise AssertionError(f"board has no {char}")

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.rows = spec["rows"]
        self.orients = list(spec["orients"])
        self.held = None
        self.flash = 0
        self.px, self.py = self._find(spec["rows"], "P")
        self.exit = self._find(spec["rows"], "X")
        self._sync_sprite()
        self._arm()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.tick = 0
        self.on_set_level(self.current_level)

    def _sync_sprite(self) -> None:
        found = self.current_level.get_sprites_by_name("player")
        if found:
            found[0].set_position(ORIGIN + self.px * CELL, ORIGIN + self.py * CELL)

    def _arm(self) -> None:
        for k, (ax, ay) in enumerate(ANCHORS):
            if abs(self.px - ax) + abs(self.py - ay) <= 1:
                self.held = k
                return

    def visible(self) -> set:
        return visible_cells(self.rows, self.orients)

    def step(self) -> None:
        self.tick += 1

        if self.flash:
            self.flash -= 1
            if self.flash == 0:
                self.next_level()
                self.complete_action()
            return

        aid = self.action.id
        if aid in (GameAction.ACTION1, GameAction.ACTION2,
                   GameAction.ACTION3, GameAction.ACTION4):
            dx, dy = {
                GameAction.ACTION1: (0, -1),
                GameAction.ACTION2: (0, 1),
                GameAction.ACTION3: (-1, 0),
                GameAction.ACTION4: (1, 0),
            }[aid]
            nx, ny = self.px + dx, self.py + dy
            if 0 <= nx < N and 0 <= ny < N and self.rows[ny][nx] != "#":
                self.px, self.py = nx, ny
                self._sync_sprite()
                self._arm()
        elif aid == GameAction.ACTION5:
            if self.held is not None:
                self.orients[self.held] = (self.orients[self.held] + 1) % 4

        if (self.px, self.py) == self.exit and self.exit in self.visible():
            self.flash = self.FLASH_FRAMES
            return

        self.complete_action()
