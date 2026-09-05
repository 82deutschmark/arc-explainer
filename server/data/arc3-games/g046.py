# ARC-AGI-3 candidate task g046.

from functools import lru_cache
from math import gcd

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


FLOOR = 14
WALL = 5
EXIT = 10
PLAYER = 0
PLAYER_CORE = 5
MOVER_LIVE = 6
MOVER_STALE = 13

N = 16
CELL = 4

DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))

LEVELS_SPEC = [
    {"rows": [
        "################",
        "#..............#",
        "#..P...........#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..........X...#",
        "#..............#",
        "#..............#",
        "################",
     ], "movers": [("H", 7, 4, 11, 0)]},

    {"rows": [
        "################",
        "#..P...........#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..........X...#",
        "#..............#",
        "#..............#",
        "################",
     ], "movers": [("H", 6, 4, 9, 0), ("V", 10, 4, 9, 3)]},

    {"rows": [
        "################",
        "#..P...........#",
        "####.###########",
        "#..............#",
        "########.#######",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..........X...#",
        "################",
     ], "movers": [("H", 3, 2, 13, 18)]},

    {"rows": [
        "################",
        "#..P...........#",
        "####.###########",
        "#..............#",
        "#######.########",
        "#..............#",
        "##########.#####",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#...........X..#",
        "################",
     ], "movers": [("H", 3, 2, 13, 17), ("H", 5, 2, 13, 6)]},

    {"rows": [
        "################",
        "#.P............#",
        "###.############",
        "#..............#",
        "######.#########",
        "#..............#",
        "#########.######",
        "#..............#",
        "############.###",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#...........X..#",
        "################",
     ], "movers": [("H", 3, 2, 13, 10), ("H", 5, 2, 13, 4), ("H", 7, 2, 13, 21)]},

    {"rows": [
        "################",
        "#..P...........#",
        "####.###########",
        "#..............#",
        "#######.########",
        "#..............#",
        "####.###########",
        "#..............#",
        "########.#######",
        "#..............#",
        "###########.####",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.X............#",
        "################",
     ], "movers": [("H", 3, 2, 13, 9), ("H", 5, 2, 13, 16), ("H", 7, 2, 13, 19), ("H", 9, 2, 13, 7)]},

    {"rows": [
        "################",
        "#.P............#",
        "##.#############",
        "#..............#",
        "####.###########",
        "#..............#",
        "#######.########",
        "#..............#",
        "#########.######",
        "#..............#",
        "############.###",
        "#..............#",
        "##########.#####",
        "#..............#",
        "#.........X....#",
        "################",
     ], "movers": [("H", 3, 2, 13, 0), ("H", 5, 2, 13, 5), ("H", 7, 2, 13, 15), ("H", 9, 2, 13, 18), ("H", 11, 2, 13, 11)]},
]


@lru_cache(maxsize=None)
def _route(mover: tuple) -> list[tuple[int, int]]:
    axis, fixed, lo, hi, _ = mover
    out = list(range(lo, hi + 1))
    back = list(range(hi - 1, lo, -1))
    line = out + back
    return [(v, fixed) if axis == "H" else (fixed, v) for v in line]


def _routes(level_index: int) -> list[list[tuple[int, int]]]:
    return [_route(m) for m in LEVELS_SPEC[level_index]["movers"]]


def period(level_index: int) -> int:
    p = 1
    for route in _routes(level_index):
        p = p * len(route) // gcd(p, len(route))
    return p


def mover_cells(level_index: int, tick: int) -> list[tuple[int, int]]:
    out = []
    for mover, route in zip(LEVELS_SPEC[level_index]["movers"], _routes(level_index)):
        out.append(route[(mover[4] + tick) % len(route)])
    return out


@lru_cache(maxsize=None)
def _find(rows: tuple[str, ...], mark: str) -> tuple[int, int]:
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == mark:
                return x, y
    raise AssertionError(f"level has no {mark}")


def start_cell(rows) -> tuple[int, int]:
    return _find(tuple(rows), "P")


def exit_cell(rows) -> tuple[int, int]:
    return _find(tuple(rows), "X")


def line_of_sight(rows: list[str], a: tuple[int, int], b: tuple[int, int]) -> bool:
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    n = max(abs(dx), abs(dy))
    for i in range(1, n):
        t = i / n
        gx = int(ax + dx * t + 0.5)
        gy = int(ay + dy * t + 0.5)
        if rows[gy][gx] == "#":
            return False
    return True


@lru_cache(maxsize=None)
def _visible(rows: tuple[str, ...], pos: tuple[int, int]) -> frozenset:
    return frozenset((x, y)
                     for y in range(N) for x in range(N)
                     if rows[y][x] != "#" and line_of_sight(rows, pos, (x, y)))


def visible_cells(rows, pos: tuple[int, int]) -> frozenset:
    return _visible(tuple(rows), pos)


def observe(rows: list[str], memory: dict, pos: tuple[int, int],
            movers: list[tuple[int, int]]) -> dict:
    new = dict(memory)
    occupied = set(movers)
    for cell in visible_cells(rows, pos):
        new[cell] = cell in occupied
    return new


def initial_memory(level_index: int) -> dict:
    rows = LEVELS_SPEC[level_index]["rows"]
    occupied = set(mover_cells(level_index, 0))
    return {(x, y): (x, y) in occupied
            for y in range(N) for x in range(N) if rows[y][x] != "#"}


def resolve(level_index: int, pos: tuple[int, int], tick: int,
            move: tuple[int, int]) -> tuple[tuple[int, int], int, bool, bool]:
    rows = LEVELS_SPEC[level_index]["rows"]
    nx, ny = pos[0] + move[0], pos[1] + move[1]
    if rows[ny][nx] == "#":
        nx, ny = pos
    before = mover_cells(level_index, tick)
    after = mover_cells(level_index, tick + 1)
    died = False
    for old, new in zip(before, after):
        if (nx, ny) == new or ((nx, ny) == old and pos == new):
            died = True
    return (nx, ny), tick + 1, died, (not died and (nx, ny) == exit_cell(rows))


def _wall() -> list[list[int]]:
    return block(WALL, CELL)


def _exit_pad() -> list[list[int]]:
    return ring(EXIT, CELL)


def _player() -> list[list[int]]:
    return figure(PLAYER, PLAYER_CORE, CELL)


def _mover_live() -> list[list[int]]:
    return rounded(MOVER_LIVE, CELL)


def _mover_stale() -> list[list[int]]:
    return ring(MOVER_STALE, CELL)


def _impact(phase: int) -> list[list[int]]:
    lit = phase % 2 == 0
    px = block(MOVER_LIVE if lit else PLAYER, CELL)
    inner = PLAYER if lit else MOVER_LIVE
    for y in range(1, CELL - 1):
        for x in range(1, CELL - 1):
            px[y][x] = inner
    return px


def _stamp(frame, cell: tuple[int, int], px: list[list[int]]) -> None:
    cx, cy = cell
    for j in range(CELL):
        for i in range(CELL):
            if px[j][i] >= 0:
                frame[cy * CELL + j, cx * CELL + i] = px[j][i]


def _halo(frame, cell: tuple[int, int], colour: int) -> None:
    cx, cy = cell
    x0, y0 = cx * CELL - 1, cy * CELL - 1
    x1, y1 = cx * CELL + CELL, cy * CELL + CELL
    h, w = frame.shape
    edge = ([(x, y0) for x in range(x0, x1 + 1)] + [(x, y1) for x in range(x0, x1 + 1)]
            + [(x0, y) for y in range(y0 + 1, y1)] + [(x1, y) for y in range(y0 + 1, y1)])
    for x, y in edge:
        if 0 <= x < w and 0 <= y < h and int(frame[y, x]) in (FLOOR, WALL):
            frame[y, x] = colour


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                if ch == "#":
                    sprites.append(Sprite(
                        pixels=_wall(), name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif ch == "X":
                    sprites.append(Sprite(
                        pixels=_exit_pad(), name="exit",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-1,
                        tags=["exit"],
                    ).set_position(px, py))
        sx, sy = start_cell(spec["rows"])
        sprites.append(Sprite(
            pixels=_player(), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=1,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G046A(RenderableUserDisplay):

    def __init__(self, game: "G046") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self._game
        seen = game.seen
        live, stale = _mover_live(), _mover_stale()

        if game.dying:
            for cell, remembered in game.memory.items():
                if remembered:
                    _stamp(frame, cell, live if cell in seen else stale)
            _stamp(frame, game.pos, _impact(game.dying))
            _halo(frame, game.pos, MOVER_LIVE if game.dying % 2 else PLAYER)
            return frame

        truth = set(mover_cells(game.level_index, game.tick))
        for cell, remembered in game.memory.items():
            if cell in seen:
                if cell in truth:
                    _stamp(frame, cell, live)
            elif remembered:
                _stamp(frame, cell, stale)
        return frame


class G046(ARCBaseGame):

    DYING_FRAMES = 6

    def __init__(self) -> None:
        self.dying = 0
        self.pos = start_cell(LEVELS_SPEC[0]["rows"])
        self.tick = 0
        self.memory = initial_memory(0)
        self.seen = visible_cells(LEVELS_SPEC[0]["rows"], self.pos)
        self.deaths = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G046A(self)],
        )
        super().__init__(game_id="g046", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        index = self.level_index
        self.dying = 0
        self.pos = start_cell(LEVELS_SPEC[index]["rows"])
        self.tick = 0
        self.memory = initial_memory(index)
        self.seen = visible_cells(LEVELS_SPEC[index]["rows"], self.pos)

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)
        self._redraw()

    def full_reset(self) -> None:
        super().full_reset()
        self.deaths = 0
        self.on_set_level(self.current_level)
        self._redraw()

    def _redraw(self) -> None:
        for sprite in self.current_level.get_sprites_by_name("player"):
            sprite.set_position(self.pos[0] * CELL, self.pos[1] * CELL)

    def step(self) -> None:
        if self.dying:
            self.dying -= 1
            if self.dying == 0:
                self.level_reset()
                self.complete_action()
            return

        move = {
            GameAction.ACTION1: (0, -1),
            GameAction.ACTION2: (0, 1),
            GameAction.ACTION3: (-1, 0),
            GameAction.ACTION4: (1, 0),
            GameAction.ACTION5: (0, 0),
        }.get(self.action.id)
        if move is None:
            self.complete_action()
            return

        index = self.level_index
        rows = LEVELS_SPEC[index]["rows"]
        self.pos, self.tick, died, escaped = resolve(index, self.pos, self.tick, move)

        if died:
            self.deaths += 1
            self._redraw()
            self.dying = self.DYING_FRAMES
            return

        self.memory = observe(rows, self.memory, self.pos,
                              mover_cells(index, self.tick))
        self.seen = visible_cells(rows, self.pos)
        self._redraw()

        if escaped:
            self.next_level()
        self.complete_action()
