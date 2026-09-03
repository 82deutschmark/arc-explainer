# ARC-AGI-3 candidate task g029.

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

def ring(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for y in range(1, cell - 1):
        for x in range(1, cell - 1):
            px[y][x] = -1
    return px

def figure(body: int, mark: int | None = None, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    mid = cell // 2
    for x in range(1, cell - 1):
        px[0][x] = body
    for y in range(1, cell - 1):
        for x in range(cell):
            px[y][x] = body
    px[cell - 1][0] = px[cell - 1][mid] = -1
    for x in range(cell):
        if px[cell - 1][x] != -1:
            px[cell - 1][x] = body
    px[cell - 1][1] = body
    px[cell - 1][cell - 1] = body
    if mark is not None and cell >= 4:
        px[mid][mid] = mark
    return px

def medallion(rim: int, centre: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    last = cell - 1
    for x in range(1, last):
        px[0][x] = px[last][x] = rim
    for y in range(1, last):
        px[y][0] = px[y][last] = rim
    for y in range(1, last):
        for x in range(1, last):
            px[y][x] = centre
    return px

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

def fixture(colours: tuple, phase: int, seed: int = 0, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[1][1] = px[cell - 2][cell - 2] = colours[(phase + seed) % len(colours)]
    return px


FLOOR = 0
WALL = 5
BODY_A = 9
BODY_B = 13
LIVE = 14
SPENT = 7

DECOR_HUES = (BODY_A, BODY_B, SPENT)

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


_BEAMS = (
    ("1111",
     "0110",
     "0110",
     "1111"),
    ("1001",
     "1111",
     "1111",
     "1001"),
    ("1100",
     "1110",
     "0111",
     "0011"),
)


def beam(mirror: int, colour: int, gap: int = -1) -> list[list[int]]:
    return [[colour if ch == "1" else gap for ch in row] for row in _BEAMS[mirror]]


def pylon_pixels(mirror: int, spent: bool = False) -> list[list[int]]:
    return beam(mirror, SPENT if spent else LIVE)


def body_pixels(colour: int, mate: int) -> list[list[int]]:
    return figure(colour, mate)


def wall_pixels(x: int, y: int) -> list[list[int]]:
    if x in (0, N - 1) or y in (0, N - 1):
        return block(WALL)
    return rounded(WALL)


def decor_cells(rows: list[str], seed: int) -> list[tuple[int, int]]:
    live = {(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row)
            if ch in "abxy" + PYLON_CHARS}
    free = [(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row)
            if ch == "."
            and all(max(abs(x - lx), abs(y - ly)) >= 2 for lx, ly in live)]
    if len(free) < 3:
        return free
    stride = len(free) // 3
    return [free[(seed * 11 + k * stride) % len(free)] for k in range(3)]


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for index, spec in enumerate(LEVELS_SPEC):
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
                if char == "#":
                    add(wall_pixels(x, y), f"wall_{x}_{y}", -2)
                elif char in PYLON_CHARS:
                    add(pylon_pixels(PYLON_CHARS.index(char)), f"pylon_{x}_{y}", -1,
                        ["pylon"])
                elif char == "x":
                    add(ring(BODY_A), "goal_a", 0)
                elif char == "y":
                    add(ring(BODY_B), "goal_b", 0)
                elif char == "a":
                    add(body_pixels(BODY_A, BODY_B), "body_a", 1)
                elif char == "b":
                    add(body_pixels(BODY_B, BODY_A), "body_b", 1)
                else:
                    continue
                sprites[-1].set_position(x * CELL, y * CELL)
        for x, y in decor_cells(spec["rows"], index):
            add(fixture(DECOR_HUES, 0, x + y), f"decor_{x}_{y}", -1, ["decor"])
            sprites[-1].set_position(x * CELL, y * CELL)
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G029A(RenderableUserDisplay):

    def __init__(self, game: "G029") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        mark = np.array(beam(self._game.mirror, self._game.readout_hue, WALL),
                        dtype=frame.dtype)
        height, width = frame.shape
        west = (N // 2 - 1) * CELL
        east = (N // 2) * CELL
        frame[west:west + CELL, 0:CELL] = mark
        frame[east:east + CELL, width - CELL:width] = mark
        return frame


class G029(ARCBaseGame):

    REFUSE_FRAMES = 4
    SPARK_FRAMES = 4
    CLEAR_FRAMES = 6

    def __init__(self) -> None:
        self.mirror = LEVELS_SPEC[0]["mirror"]
        self.grid: list[list[str]] = []
        self.a = (0, 0)
        self.b = (0, 0)
        self.goal_a = (0, 0)
        self.goal_b = (0, 0)
        self._fx = 0
        self._fx_kind = ""
        self._blocked: list[tuple[tuple[int, int], int]] = []
        self._fired: list[tuple[int, int, int]] = []
        self._beat = 0
        self.readout_hue = LIVE
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G029A(self)],
        )
        super().__init__(game_id="g029", levels=build_levels(), camera=camera)

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
        self._fx = 0
        self._fx_kind = ""
        self._blocked = []
        self._fired = []
        self.readout_hue = LIVE
        self._place("body_a", self.a)
        self._place("body_b", self.b)
        self._paint_bodies()
        self._paint_decor()

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

    def _face(self, name: str, pixels: list[list[int]]) -> None:
        for sprite in self.current_level.get_sprites_by_name(name):
            sprite.pixels[:] = np.array(pixels, dtype=sprite.pixels.dtype)

    def _paint_bodies(self, face_a=None, face_b=None) -> None:
        self._face("body_a", face_a if face_a else body_pixels(BODY_A, BODY_B))
        self._face("body_b", face_b if face_b else body_pixels(BODY_B, BODY_A))

    def _paint_pylon(self, x: int, y: int, mirror: int, spent: bool) -> None:
        self._face(f"pylon_{x}_{y}", pylon_pixels(mirror, spent=spent))

    def _paint_wall(self, x: int, y: int, blush: int | None = None) -> None:
        face = wall_pixels(x, y)
        if blush is not None:
            face = [[blush if (v >= 0 and (cx + cy) % 2 == 0) else v
                     for cx, v in enumerate(row)] for cy, row in enumerate(face)]
        self._face(f"wall_{x}_{y}", face)

    def _paint_decor(self) -> None:
        for sprite in self.current_level.get_sprites_by_tag("decor"):
            seed = (sprite.x + sprite.y) // CELL
            sprite.pixels[:] = np.array(fixture(DECOR_HUES, self._beat, seed),
                                        dtype=sprite.pixels.dtype)

    def _open(self, x: int, y: int) -> bool:
        return 0 <= x < N and 0 <= y < N and self.grid[y][x] != "#"

    def _spend_pylon(self, x: int, y: int) -> int | None:
        char = self.grid[y][x]
        if char not in PYLON_CHARS:
            return None
        which = PYLON_CHARS.index(char)
        self.mirror = which
        self.grid[y][x] = "."
        return which

    def _start_fx(self, kind: str, frames: int) -> None:
        self._fx_kind = kind
        self._fx = frames
        self._paint_fx()

    def _paint_fx(self) -> None:
        lit = self._fx % 2 == 0
        if self._fx_kind == "refuse":
            self._paint_bodies(weave(BODY_A) if lit else None,
                               weave(BODY_B) if lit else None)
            for (x, y), hue in self._blocked:
                self._paint_wall(x, y, hue if lit else None)
        elif self._fx_kind == "spark":
            self.readout_hue = LIVE if lit else SPENT
            for x, y, which in self._fired:
                self._paint_pylon(x, y, which, spent=not lit)
        elif self._fx_kind == "clear":
            self._paint_bodies(medallion(LIVE, BODY_A) if lit else None,
                               medallion(LIVE, BODY_B) if lit else None)

    def _settle(self) -> None:
        kind, self._fx_kind = self._fx_kind, ""
        self.readout_hue = LIVE
        self._paint_bodies()
        for (x, y), _hue in self._blocked:
            self._paint_wall(x, y)
        self._blocked = []
        for x, y, which in self._fired:
            self._paint_pylon(x, y, which, spent=True)
        self._fired = []
        if kind == "clear":
            self.next_level()
        self.complete_action()

    def step(self) -> None:
        self._beat += 1
        self._paint_decor()

        if self._fx:
            self._fx -= 1
            if self._fx:
                self._paint_fx()
            else:
                self._settle()
            return

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
        if not (self._open(*na) and self._open(*nb)):
            self._blocked = [(cell, hue) for cell, hue in ((na, BODY_A), (nb, BODY_B))
                             if not self._open(*cell)
                             and self.current_level.get_sprites_by_name(
                                 f"wall_{cell[0]}_{cell[1]}")]
            self._start_fx("refuse", self.REFUSE_FRAMES)
            return

        self.a, self.b = na, nb
        self._place("body_a", na)
        self._place("body_b", nb)
        for cell in (na, nb):
            which = self._spend_pylon(*cell)
            if which is not None:
                self._fired.append((cell[0], cell[1], which))
        if self.a == self.goal_a and self.b == self.goal_b:
            self._start_fx("clear", self.CLEAR_FRAMES)
            return
        if self._fired:
            self._start_fx("spark", self.SPARK_FRAMES)
            return
        self.complete_action()
