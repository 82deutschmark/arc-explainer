# ARC-AGI-3 candidate task taa5fdde0.

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

FLOOR = 4
WALL = 1
BODY_A = 10
BODY_B = 6
MARK = 5
SPENT = 3
PYLON_COLOUR = (11, 14, 12)

MIRROR_V, MIRROR_H, MIRROR_D = 0, 1, 2
PYLON_CHARS = "VHD"


def mirror_vector(mirror: int, dx: int, dy: int) -> tuple[int, int]:
    if mirror == MIRROR_V:
        return (-dx, dy)
    if mirror == MIRROR_H:
        return (dx, -dy)
    return (dy, dx)


LEVELS_SPEC = [
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.....x..y.....#",
        "#..............#",
        "#..............#",
        "#..a........b..#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#..............#",
        "#..#........#..#",
        "#..#..#..#..#..#",
        "#..#..#..#..#..#",
        "#.....#..#.....#",
        "#..x........y..#",
        "#..............#",
        "#####......#####",
        "#..............#",
        "#..a........b..#",
        "#..............#",
        "#..#........#..#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#....######....#",
        "#..............#",
        "#..............#",
        "#..Hy........x.#",
        "#..............#",
        "#..a........b..#",
        "#..............#",
        "#....######....#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#........##....#",
        "#..............#",
        "#..............#",
        "#..D.........x.#",
        "#..y...........#",
        "#....##........#",
        "#..............#",
        "#..a........b..#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#..y.#....#....#",
        "#.H..#....#..D.#",
        "#....#....#...x#",
        "#..............#",
        "#####..##..#####",
        "#..............#",
        "#..a........b..#",
        "#..............#",
        "#####..##..#####",
        "#..............#",
        "#..V........V..#",
        "#....#....#....#",
        "#....#....#....#",
        "#..............#",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#..............#",
        "#.####...####..#",
        "#...y#...#.....#",
        "#.##.#...#.##..#",
        "#..H.......D...#",
        "#.####...####..#",
        "#............x.#",
        "#....#####.....#",
        "#..............#",
        "#..a........b..#",
        "#..............#",
        "#..###...###...#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#..............#",
        "#.####...#.###.#",
        "#....#..y#...#.#",
        "#.##.#.H.#.#...#",
        "#.#......x.#.#.#",
        "#.#.####.#.#.#.#",
        "#...#......#.D.#",
        "#.#.#.####.###.#",
        "#.#....#.......#",
        "#.####.#.#####.#",
        "#......#.......#",
        "#.####...####..#",
        "#..a........b..#",
        "#..............#",
        "################",
    ]},
    {"mirror": MIRROR_V, "rows": [
        "################",
        "#y........x....#",
        "#.##.#####.##..#",
        "#.#D.......#D#.#",
        "#.#..#####.#...#",
        "#....#...#.....#",
        "#.##.#...#.###.#",
        "#..........#...#",
        "#.####.###.#.#.#",
        "#......#.....#.#",
        "#.####.#.####..#",
        "#.#..........#.#",
        "#.#.######.#.#.#",
        "#..a..H.....b..#",
        "#..............#",
        "################",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 4


def _solid(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _ring(colour: int) -> list[list[int]]:
    block = [[colour] * CELL for _ in range(CELL)]
    for r in range(1, CELL - 1):
        for c in range(1, CELL - 1):
            block[r][c] = FLOOR
    return block


def pylon_pixels(mirror: int, spent: bool = False) -> list[list[int]]:
    base = SPENT if spent else PYLON_COLOUR[mirror]
    block = [[base] * CELL for _ in range(CELL)]
    if mirror == MIRROR_V:
        for r in range(CELL):
            block[r][1] = block[r][2] = MARK
    elif mirror == MIRROR_H:
        for c in range(CELL):
            block[1][c] = block[2][c] = MARK
    else:
        for i in range(CELL):
            block[i][i] = MARK
    return block


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []

        def add(pixels, name, layer, tags=()):
            sprites.append(Sprite(
                pixels=pixels, name=name,
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE,
                layer=layer, tags=list(tags),
            ))

        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                px, py = x * CELL, y * CELL
                if char == "#":
                    add(_solid(WALL), f"wall_{x}_{y}", -2)
                    sprites[-1].set_position(px, py)
                elif char in PYLON_CHARS:
                    add(pylon_pixels(PYLON_CHARS.index(char)), f"pylon_{x}_{y}", -1,
                        ["pylon"])
                    sprites[-1].set_position(px, py)
                elif char == "x":
                    add(_ring(BODY_A), "goal_a", 0)
                    sprites[-1].set_position(px, py)
                elif char == "y":
                    add(_ring(BODY_B), "goal_b", 0)
                    sprites[-1].set_position(px, py)
                elif char == "a":
                    add(_solid(BODY_A), "body_a", 1)
                    sprites[-1].set_position(px, py)
                elif char == "b":
                    add(_solid(BODY_B), "body_b", 1)
                    sprites[-1].set_position(px, py)
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class Gf562a6d6(RenderableUserDisplay):

    def __init__(self, game: "Gd3852a1f") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        glyph = np.array(pylon_pixels(self._game.mirror), dtype=frame.dtype)
        frame[0:CELL, 0:CELL] = glyph
        return frame


class Gd3852a1f(ARCBaseGame):

    def __init__(self) -> None:
        self.mirror = LEVELS_SPEC[0]["mirror"]
        self.grid: list[list[str]] = []
        self.a = (0, 0)
        self.b = (0, 0)
        self.goal_a = (0, 0)
        self.goal_b = (0, 0)
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[Gf562a6d6(self)],
        )
        super().__init__(game_id="taa5fdde0", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.mirror = spec["mirror"]
        self.grid = [list(row) for row in spec["rows"]]
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                if char == "a":
                    self.a = (x, y)
                elif char == "b":
                    self.b = (x, y)
                elif char == "x":
                    self.goal_a = (x, y)
                elif char == "y":
                    self.goal_b = (x, y)
        self._place("body_a", self.a)
        self._place("body_b", self.b)

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _place(self, name: str, cell: tuple[int, int]) -> None:
        found = self.current_level.get_sprites_by_name(name)
        if found:
            found[0].set_position(cell[0] * CELL, cell[1] * CELL)

    def _open(self, x: int, y: int) -> bool:
        return 0 <= x < N and 0 <= y < N and self.grid[y][x] != "#"

    def _spend_pylon(self, x: int, y: int) -> None:
        char = self.grid[y][x]
        if char not in PYLON_CHARS:
            return
        self.mirror = PYLON_CHARS.index(char)
        self.grid[y][x] = "."
        found = self.current_level.get_sprites_by_name(f"pylon_{x}_{y}")
        if found:
            found[0].pixels[:] = np.array(
                pylon_pixels(PYLON_CHARS.index(char), spent=True),
                dtype=found[0].pixels.dtype,
            )

    def step(self) -> None:
        dx = dy = 0
        if self.action.id == GameAction.ACTION1:
            dy = -1
        elif self.action.id == GameAction.ACTION2:
            dy = 1
        elif self.action.id == GameAction.ACTION3:
            dx = -1
        elif self.action.id == GameAction.ACTION4:
            dx = 1
        else:
            self.complete_action()
            return

        tdx, tdy = mirror_vector(self.mirror, dx, dy)
        na = (self.a[0] + dx, self.a[1] + dy)
        nb = (self.b[0] + tdx, self.b[1] + tdy)
        if self._open(*na) and self._open(*nb):
            self.a, self.b = na, nb
            self._place("body_a", na)
            self._place("body_b", nb)
            self._spend_pylon(*na)
            self._spend_pylon(*nb)
            if self.a == self.goal_a and self.b == self.goal_b:
                self.next_level()

        self.complete_action()
