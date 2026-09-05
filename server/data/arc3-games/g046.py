# ARC-AGI-3 candidate task g046.

from functools import lru_cache
from math import gcd

import numpy as np

from sprite_book import block, figure, ring, rounded

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

FLOOR = 14
WALL = 5
EXIT = 10
PLAYER = 0
PLAYER_CORE = 5
MOVER_LIVE = 6
MOVER_STALE = 13

N = 10
CELL = 6

HEX_STEPS = (
    ((1, 0), (0, -1), (-1, -1), (-1, 0), (-1, 1), (0, 1)),
    ((1, 0), (1, -1), (0, -1), (-1, 0), (0, 1), (1, 1)),
)


def step_cell(cell: tuple[int, int], d: int) -> tuple[int, int]:
    x, y = cell
    dx, dy = HEX_STEPS[y & 1][d]
    return x + dx, y + dy


def neighbours(cell: tuple[int, int]) -> list[tuple[int, int]]:
    return [step_cell(cell, d) for d in range(6)]


ACTION_SLOTS = {
    GameAction.ACTION1: 1,
    GameAction.ACTION2: 2,
    GameAction.ACTION3: 3,
    GameAction.ACTION4: 4,
    GameAction.ACTION5: 5,
    GameAction.ACTION7: 0,
}


def on_board(cell: tuple[int, int]) -> bool:
    x, y = cell
    return 0 <= x < N and 0 <= y < N


LEVELS_SPEC = [
    {"rows": ["##########",
              "##########",
              "##########",
              "#P.......#",
              "#........#",
              "#.......X#",
              "##########",
              "##########",
              "##########",
              "##########"],
     "movers": [(2, 4, 0, 5, 0)]},

    {"rows": ["##########",
              "#P.......#",
              "#........#",
              "#........#",
              "#........#",
              "#........#",
              "#........#",
              "#.......X#",
              "##########",
              "##########"],
     "movers": [(1, 3, 0, 6, 11), (2, 6, 0, 5, 0)]},

    {"rows": ["##########",
              "#P.......#",
              "####.#####",
              "#........#",
              "#........#",
              "#........#",
              "#........#",
              "#.......X#",
              "##########",
              "##########"],
     "movers": [(1, 3, 0, 6, 5), (2, 6, 0, 5, 0)]},

    {"rows": ["##########",
              "#P.......#",
              "#........#",
              "#######.##",
              "#........#",
              "#........#",
              "##.#######",
              "#........#",
              "#.......X#",
              "##########"],
     "movers": [(1, 2, 0, 5, 0), (2, 5, 0, 4, 3), (2, 7, 0, 4, 7)]},

    {"rows": ["##########",
              "#P.......#",
              "#........#",
              "#######.##",
              "#........#",
              "#........#",
              "##.#######",
              "#........#",
              "#.......X#",
              "##########"],
     "movers": [(2, 2, 0, 4, 6), (2, 4, 0, 4, 0), (2, 7, 0, 4, 1)]},

    {"rows": ["##########",
              "#.......P#",
              "#........#",
              "##.#######",
              "#........#",
              "#........#",
              "#######.##",
              "#........#",
              "#X.......#",
              "##########"],
     "movers": [(1, 1, 0, 6, 8), (1, 4, 0, 6, 8), (2, 5, 0, 5, 2), (2, 7, 0, 5, 9)]},

    {"rows": ["##########",
              "#P.......#",
              "#........#",
              "#######.##",
              "#........#",
              "#........#",
              "##.#######",
              "#........#",
              "#.......X#",
              "##########"],
     "movers": [(1, 1, 0, 6, 11), (1, 2, 0, 6, 3), (2, 4, 0, 5, 9), (2, 7, 0, 5, 3)]},
]


@lru_cache(maxsize=None)
def _route(mover: tuple) -> list[tuple[int, int]]:
    x, y, d, span, _ = mover
    out = [(x, y)]
    cell = (x, y)
    for _ in range(span):
        cell = step_cell(cell, d)
        out.append(cell)
    return out + out[-2:0:-1]


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


def to_cube(cell: tuple[int, int]) -> tuple[int, int, int]:
    x, y = cell
    cx = x - ((y - (y & 1)) // 2)
    return cx, -cx - y, y


def from_cube(c: tuple[int, int, int]) -> tuple[int, int]:
    cx, _, cz = c
    return cx + ((cz - (cz & 1)) // 2), cz


def _cube_round(x: float, y: float, z: float) -> tuple[int, int, int]:
    rx, ry, rz = round(x), round(y), round(z)
    dx, dy, dz = abs(rx - x), abs(ry - y), abs(rz - z)
    if dx > dy and dx > dz:
        rx = -ry - rz
    elif dy > dz:
        ry = -rx - rz
    else:
        rz = -rx - ry
    return int(rx), int(ry), int(rz)


def hex_distance(a: tuple[int, int], b: tuple[int, int]) -> int:
    ax, ay, az = to_cube(a)
    bx, by, bz = to_cube(b)
    return max(abs(ax - bx), abs(ay - by), abs(az - bz))


def line_of_sight(rows, a: tuple[int, int], b: tuple[int, int]) -> bool:
    n = hex_distance(a, b)
    if n <= 1:
        return True
    ax, ay, az = to_cube(a)
    bx, by, bz = to_cube(b)
    for i in range(1, n):
        t = i / n
        cell = from_cube(_cube_round(ax + (bx - ax) * t + 1e-6,
                                     ay + (by - ay) * t + 1e-6,
                                     az + (bz - az) * t - 2e-6))
        x, y = cell
        if not on_board(cell) or rows[y][x] == "#":
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
            move) -> tuple[tuple[int, int], int, bool, bool]:
    rows = LEVELS_SPEC[level_index]["rows"]
    nx, ny = pos if move is None else step_cell(pos, move)
    if not on_board((nx, ny)) or rows[ny][nx] == "#":
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


def cell_origin(cell: tuple[int, int]) -> tuple[int, int]:
    cx, cy = cell
    return cx * CELL + (CELL // 2 if cy & 1 else 0), cy * CELL


def _stamp(frame, cell: tuple[int, int], px: list[list[int]]) -> None:
    ox, oy = cell_origin(cell)
    h, w = frame.shape
    for j in range(CELL):
        for i in range(CELL):
            y, x = oy + j, ox + i
            if px[j][i] >= 0 and 0 <= x < w and 0 <= y < h:
                frame[y, x] = px[j][i]


def _halo(frame, cell: tuple[int, int], colour: int) -> None:
    ox, oy = cell_origin(cell)
    x0, y0 = ox - 1, oy - 1
    x1, y1 = ox + CELL, oy + CELL
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
                px, py = cell_origin((x, y))
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
        for y in range(N):
            for px in (0, (N - 1) * CELL + CELL // 2):
                sprites.append(Sprite(
                    pixels=_wall(), name=f"margin_{px}_{y}",
                    blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.TANGIBLE, layer=-1,
                ).set_position(px, y * CELL))

        sx, sy = start_cell(spec["rows"])
        sprites.append(Sprite(
            pixels=_player(), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=1,
        ).set_position(*cell_origin((sx, sy))))
        levels.append(Level(sprites=sprites,
                            grid_size=(N * CELL + CELL // 2, N * CELL)))
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
            width=N * CELL + CELL // 2, height=N * CELL,
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

        if self.action.id not in ACTION_SLOTS:
            self.complete_action()
            return
        move = ACTION_SLOTS[self.action.id]

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
