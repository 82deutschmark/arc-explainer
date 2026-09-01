# ARC-AGI-3 candidate task tca5096fc.

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

FLOOR = 4
WALL = 1
EXIT = 14
PLAYER = 12
PLAYER_CORE = 0
MOVER_LIVE = 8
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


def _block(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _player_block() -> list[list[int]]:
    px = _block(PLAYER)
    px[1][1] = px[1][2] = px[2][1] = px[2][2] = PLAYER_CORE
    return px


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                if ch == "#":
                    sprites.append(Sprite(
                        pixels=_block(WALL), name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif ch == "X":
                    sprites.append(Sprite(
                        pixels=_block(EXIT), name="exit",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-1,
                        tags=["exit"],
                    ).set_position(px, py))
        sx, sy = start_cell(spec["rows"])
        sprites.append(Sprite(
            pixels=_player_block(), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=1,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G405c3999(RenderableUserDisplay):

    def __init__(self, game: "Ga5c6b0d3") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self._game
        seen = game.seen
        truth = set(mover_cells(game.level_index, game.tick))
        for (x, y), remembered in game.memory.items():
            if (x, y) in seen:
                if (x, y) not in truth:
                    continue
                colour = MOVER_LIVE
            else:
                if not remembered:
                    continue
                colour = MOVER_STALE
            frame[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = colour
        return frame


class Ga5c6b0d3(ARCBaseGame):

    def __init__(self) -> None:
        self.pos = start_cell(LEVELS_SPEC[0]["rows"])
        self.tick = 0
        self.memory = initial_memory(0)
        self.seen = visible_cells(LEVELS_SPEC[0]["rows"], self.pos)
        self.deaths = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G405c3999(self)],
        )
        super().__init__(game_id="tca5096fc", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        index = self.level_index
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
            self.level_reset()
            self.complete_action()
            return

        self.memory = observe(rows, self.memory, self.pos,
                              mover_cells(index, self.tick))
        self.seen = visible_cells(rows, self.pos)
        self._redraw()

        if escaped:
            self.next_level()
        self.complete_action()
