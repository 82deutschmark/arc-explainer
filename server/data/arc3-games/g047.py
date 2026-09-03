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

DARK = 5
M_WALL = 1
M_FLOOR = 4
M_PLAYER = 12
M_EXIT = 14
BAR_IDLE = 3
BAR_ARMED = 11

N = 12
CELL = 4
ORIGIN = 8

ANCHORS = ((5, 0), (11, 5), (6, 11), (0, 6))
DIRS = ((0, -1), (1, 0), (0, 1), (-1, 0))


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
                        pixels=_cell_block(DARK), name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif char == "X":
                    sprites.append(Sprite(
                        pixels=_cell_block(DARK), name="exit",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0, tags=["exit"],
                    ).set_position(px, py))
                elif char == "P":
                    sprites.append(Sprite(
                        pixels=_cell_block(DARK), name="player",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=1,
                    ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(64, 64)))
    return levels


class G047A(RenderableUserDisplay):

    def __init__(self, game: "G047") -> None:
        super().__init__()
        self._game = game

    def _slot_colour(self, cell) -> int:
        g = self._game
        if cell == (g.px, g.py):
            return M_PLAYER
        if cell == g.exit:
            return M_EXIT
        return M_WALL if g.rows[cell[1]][cell[0]] == "#" else M_FLOOR

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game
        for k in range(4):
            cells = strip_cells(g.rows, ANCHORS[k], g.orients[k])
            for i in range(N):
                colour = self._slot_colour(cells[i]) if i < len(cells) else DARK
                lo = ORIGIN + i * CELL
                if k == 0:
                    frame[0:6, lo:lo + CELL] = colour
                elif k == 1:
                    frame[lo:lo + CELL, 58:64] = colour
                elif k == 2:
                    frame[58:64, lo:lo + CELL] = colour
                else:
                    frame[lo:lo + CELL, 0:6] = colour
            bar = BAR_ARMED if g.held == k else BAR_IDLE
            if k == 0:
                frame[6:8, ORIGIN:ORIGIN + N * CELL] = bar
            elif k == 1:
                frame[ORIGIN:ORIGIN + N * CELL, 56:58] = bar
            elif k == 2:
                frame[56:58, ORIGIN:ORIGIN + N * CELL] = bar
            else:
                frame[ORIGIN:ORIGIN + N * CELL, 6:8] = bar
        return frame


class G047(ARCBaseGame):

    def __init__(self) -> None:
        spec = LEVELS_SPEC[0]
        self.rows = spec["rows"]
        self.orients = list(spec["orients"])
        self.held: int | None = None
        self.px, self.py = self._find(spec["rows"], "P")
        self.exit = self._find(spec["rows"], "X")
        camera = Camera(
            width=64, height=64, background=DARK, letter_box=DARK,
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
        self.px, self.py = self._find(spec["rows"], "P")
        self.exit = self._find(spec["rows"], "X")
        self._sync_sprite()
        self._arm()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
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
            self.next_level()

        self.complete_action()
