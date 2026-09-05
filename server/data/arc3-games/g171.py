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


def block(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour] * cell for _ in range(cell)]

def rounded(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for (y, x) in ((0, 0), (0, cell - 1), (cell - 1, 0), (cell - 1, cell - 1)):
        px[y][x] = -1
    return px

def core(colour: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(1, cell - 1):
        for x in range(1, cell - 1):
            px[y][x] = colour
    return px

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

def outline(frame, box: tuple, colour: int):
    x0, y0, x1, y1 = box
    h, w = frame.shape
    for x in range(max(0, x0), min(w, x1)):
        if 0 <= y0 < h:
            frame[y0, x] = colour
        if 0 <= y1 - 1 < h:
            frame[y1 - 1, x] = colour
    for y in range(max(0, y0), min(h, y1)):
        if 0 <= x0 < w:
            frame[y, x0] = colour
        if 0 <= x1 - 1 < w:
            frame[y, x1 - 1] = colour
    return frame

def blink(step: int, period: int = 3) -> bool:
    return (step // period) % 2 == 0


WALL = 1
FLOOR = 4
WATER = 10
SOURCE = WATER
BASIN = 12
DAM = 15
CURSOR = 8
GAUGE_ON = WATER
GAUGE_OFF = FLOOR

GAUGE_X = 2
GAUGE_FOOT = (16 - 2) * 4 + 2
GAUGE_PITCH = 2
DAM_TOP = 18
DAM_GAP = 12
DAM_RISE = 2
SPLASH_FRAMES = 2
SETTLE_FRAMES = 6

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


def _face(ch):
    if ch == "#":
        return block(WALL, CELL)
    if ch == "S":
        return rounded(SOURCE, CELL)
    if ch == "B":
        return rounded(BASIN, CELL)
    return None


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for y in range(N):
            for x in range(N):
                face = _face(rows[y][x])
                if face is None:
                    continue
                sprites.append(Sprite(
                    pixels=face, name=f"cell_{x}_{y}",
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

        def stamp(cell, px):
            x, y = cell
            for j in range(CELL):
                row = px[j]
                for i in range(CELL):
                    if row[i] >= 0:
                        frame[y * CELL + j, x * CELL + i] = row[i]

        for cell in g.dams:
            stamp(cell, rounded(DAM, CELL))

        basins = find_all(g.rows, "B")
        arriving = g.front if g.splash else set()
        thin = bool(g.settle) and not g.ok and blink(g.settle, 1)
        for cell in g.flooded:
            stamp(cell, weave(WATER, CELL) if (thin or cell in arriving)
                  else block(WATER, CELL))
            if cell in basins:
                stamp(cell, core(BASIN, CELL))
        if g.settle and g.ok and blink(g.settle, 1):
            for cell in basins:
                stamp(cell, block(BASIN, CELL))

        for k in range(g.spec["tank"]):
            yy = GAUGE_FOOT - GAUGE_PITCH * k
            if yy < CELL:
                break
            frame[yy:yy + 1, 0:GAUGE_X] = GAUGE_ON if k < g.units else GAUGE_OFF

        unspent = g.spec["dams"] - len(g.dams)
        for i in range(g.spec["dams"]):
            top = DAM_TOP + i * DAM_GAP
            frame[top:top + 3 + i * DAM_RISE, N * CELL - GAUGE_X:N * CELL] = (
                DAM if i < unspent else GAUGE_OFF)

        if not g.pouring:
            cx, cy = g.cursor
            outline(frame, (cx * CELL, cy * CELL, (cx + 1) * CELL, (cy + 1) * CELL),
                    CURSOR)
        return frame


class G171(ARCBaseGame):

    def __init__(self) -> None:
        self.dams: set = set()
        self.flooded: set = set()
        self.front: set = set()
        self.pouring = False
        self.cursor = (0, 0)
        self.units = 0
        self.splash = 0
        self.settle = 0
        self.ok = False
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=WALL,
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
        self.front = set()
        self.pouring = False
        self.cursor = find_char(self.rows, "S")
        self.units = self.spec["tank"]
        self.splash = 0
        self.settle = 0
        self.ok = False

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _ring(self) -> set:
        ring = set()
        for (x, y) in self.flooded:
            for dx, dy in DIRS:
                n = (x + dx, y + dy)
                if n not in self.flooded and open_cell(self.rows, self.dams, *n):
                    ring.add(n)
        return ring

    def _tick(self) -> bool:
        ring = self._ring()
        if not ring or len(ring) > self.units:
            return False
        self.flooded |= ring
        self.units -= len(ring)
        self.front = ring
        return True

    def step(self) -> None:
        move = {GameAction.ACTION1: (0, -1), GameAction.ACTION2: (0, 1),
                GameAction.ACTION3: (-1, 0), GameAction.ACTION4: (1, 0)}.get(
                    self.action.id)

        if self.pouring:
            if self.settle:
                self.settle -= 1
                if self.settle == 0:
                    if find_all(self.rows, "B") <= self.flooded:
                        self.next_level()
                    else:
                        self.level_reset()
                    self.complete_action()
                return
            if self.splash:
                self.splash -= 1
                if self.splash == 0:
                    self.front = set()
                    self.complete_action()
                return
            if self._tick():
                self.splash = SPLASH_FRAMES
                return
            self.ok = find_all(self.rows, "B") <= self.flooded
            self.settle = SETTLE_FRAMES
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
