# ARC-AGI-3 candidate task g171.

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

WALL = 1
FLOOR = 4
WATER = 9
SOURCE = 14
BASIN = 11
DAM = 15
CURSOR = 6
PIP_ON = 10
PIP_OFF = 3
DAM_PIP = 15

DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))

LEVELS_SPEC = [
    {"tank": 13, "dams": 1, "rows": [
        "################",
        "######S#########",
        "######.#########",
        "#..............#",
        "#.....########.#",
        "#.....########.#",
        "#.....########B#",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"tank": 27, "dams": 2, "rows": [
        "################",
        "#S##############",
        "#.##############",
        "#..............#",
        "###.###.###.##.#",
        "##...#...#...#.#",
        "##...#...#...#B#",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"tank": 17, "dams": 2, "rows": [
        "################",
        "#######S########",
        "#######.########",
        "#B............B#",
        "####.#####.#####",
        "###...###...####",
        "###...###...####",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"tank": 20, "dams": 2, "rows": [
        "################",
        "#S##############",
        "#.##############",
        "#..............#",
        "###.#####.####.#",
        "##...###...###.#",
        "##...###...###B#",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"tank": 10, "dams": 2, "rows": [
        "################",
        "#######S########",
        "#######.########",
        "#..............#",
        "#.....#.#......#",
        "#.....#.#......#",
        "#.....#.#......#",
        "#######.########",
        "#######.########",
        "#######B########",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"tank": 15, "dams": 3, "rows": [
        "################",
        "#######S########",
        "#######.########",
        "#B............B#",
        "###.###.###.####",
        "##...#...#...###",
        "##...#...#...###",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 4


def find_char(rows, ch):
    for y, row in enumerate(rows):
        x = row.find(ch)
        if x >= 0:
            return x, y
    return None


def find_all(rows, ch):
    return frozenset((x, y) for y, row in enumerate(rows)
                     for x, c in enumerate(row) if c == ch)


def open_cell(rows, dams, x, y):
    return (0 <= x < N and 0 <= y < N
            and rows[y][x] != "#" and (x, y) not in dams)


def flood_from(rows, dams, tank):
    src = find_char(rows, "S")
    flooded = {src}
    while True:
        ring = set()
        for (x, y) in flooded:
            for dx, dy in DIRS:
                n = (x + dx, y + dy)
                if n not in flooded and open_cell(rows, dams, *n):
                    ring.add(n)
        if not ring or len(ring) > tank:
            return flooded, tank
        flooded |= ring
        tank -= len(ring)


def wins(rows, dams, tank):
    flooded, _ = flood_from(rows, dams, tank)
    return find_all(rows, "B") <= flooded


def placeable(rows):
    return [(x, y) for y in range(N) for x in range(N)
            if rows[y][x] == "."]


def _block(colour, core=None):
    px = [[colour] * CELL for _ in range(CELL)]
    if core is not None:
        px[1][1] = px[1][2] = px[2][1] = px[2][2] = core
    return px


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for y in range(N):
            for x in range(N):
                c = rows[y][x]
                colour = {"#": WALL, "S": SOURCE, "B": BASIN}.get(c)
                if colour is None:
                    continue
                sprites.append(Sprite(
                    pixels=_block(colour), name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0, collidable=False,
                ).set_position(x * CELL, y * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G171A(RenderableUserDisplay):

    def __init__(self, game: "G171") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game

        def paint(cell, colour, core=None):
            x, y = cell
            frame[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = colour
            if core is not None:
                frame[y * CELL + 1:y * CELL + 3, x * CELL + 1:x * CELL + 3] = core

        for cell in g.dams:
            paint(cell, DAM)
        basins = find_all(g.rows, "B")
        for cell in g.flooded:
            paint(cell, WATER, BASIN if cell in basins else None)

        def pip(slot, colour):
            if slot < N - 2:
                x, y = 1 + slot, 0
            else:
                x, y = 1 + slot - (N - 2), N - 1
            frame[y * CELL + 1:y * CELL + 3, x * CELL + 1:x * CELL + 3] = colour

        for i in range(min(g.spec["tank"], 2 * (N - 2))):
            pip(i, PIP_ON if i < g.units else PIP_OFF)
        for i in range(g.spec["dams"]):
            unspent = i < (g.spec["dams"] - len(g.dams))
            frame[(1 + i) * CELL + 1:(1 + i) * CELL + 3,
                  1:3] = DAM_PIP if unspent else PIP_OFF

        if not g.pouring:
            cx, cy = g.cursor
            frame[cy * CELL:cy * CELL + 1, cx * CELL:(cx + 1) * CELL] = CURSOR
            frame[cy * CELL + CELL - 1:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL] = CURSOR
            frame[cy * CELL:(cy + 1) * CELL, cx * CELL:cx * CELL + 1] = CURSOR
            frame[cy * CELL:(cy + 1) * CELL, cx * CELL + CELL - 1:(cx + 1) * CELL] = CURSOR
        return frame


class G171(ARCBaseGame):

    def __init__(self) -> None:
        self.dams: set = set()
        self.flooded: set = set()
        self.pouring = False
        self.cursor = (0, 0)
        self.units = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G171A(self)],
        )
        super().__init__(game_id="g171", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])
        self.on_set_level(self.current_level)

    @property
    def spec(self):
        return LEVELS_SPEC[self.level_index]

    @property
    def rows(self):
        return self.spec["rows"]

    def on_set_level(self, level: Level) -> None:
        self.dams = set()
        self.flooded = set()
        self.pouring = False
        self.cursor = find_char(self.rows, "S")
        self.units = self.spec["tank"]

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _tick(self) -> bool:
        ring = set()
        for (x, y) in self.flooded:
            for dx, dy in DIRS:
                n = (x + dx, y + dy)
                if n not in self.flooded and open_cell(self.rows, self.dams, *n):
                    ring.add(n)
        if not ring or len(ring) > self.units:
            return False
        self.flooded |= ring
        self.units -= len(ring)
        return True

    def step(self) -> None:
        move = {GameAction.ACTION1: (0, -1), GameAction.ACTION2: (0, 1),
                GameAction.ACTION3: (-1, 0), GameAction.ACTION4: (1, 0)}.get(
                    self.action.id)

        if self.pouring:
            if not self._tick():
                if find_all(self.rows, "B") <= self.flooded:
                    self.next_level()
                else:
                    self.level_reset()
            self.complete_action()
            return

        if move is not None:
            nx, ny = self.cursor[0] + move[0], self.cursor[1] + move[1]
            if 0 <= nx < N and 0 <= ny < N and self.rows[ny][nx] != "#":
                self.cursor = (nx, ny)
        elif self.action.id == GameAction.ACTION5:
            if self.cursor == find_char(self.rows, "S"):
                self.pouring = True
                self.flooded = {self.cursor}
            elif self.cursor in self.dams:
                self.dams.discard(self.cursor)
            elif (self.rows[self.cursor[1]][self.cursor[0]] == "."
                  and len(self.dams) < self.spec["dams"]):
                self.dams.add(self.cursor)
        self.complete_action()
