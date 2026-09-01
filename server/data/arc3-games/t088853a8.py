# ARC-AGI-3 candidate task t088853a8.

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
RATCHET_OPEN = 7
RATCHET_SEALED = 13
DRONE_COLOURS = (9, 8, 15, 10)
TICK_ON = 11
TICK_OFF = 3

N = 16
CELL = 4

DIRS = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
    GameAction.ACTION5: (0, 0),
}


def shuttle(cells, hold=0):
    cells = [tuple(c) for c in cells]
    return cells + [cells[-1]] * hold + list(reversed(cells[1:-1]))


def hstrip(x0, x1, y, hold=0):
    step = 1 if x1 >= x0 else -1
    return shuttle([(x, y) for x in range(x0, x1 + step, step)], hold)


def vstrip(x, y0, y1, hold=0):
    step = 1 if y1 >= y0 else -1
    return shuttle([(x, y) for y in range(y0, y1 + step, step)], hold)


def gate_pair(tx, ty, ax, ay, bx, by):
    return [[(tx, ty), (ax, ay)], [(bx, by), (tx, ty)]]


LEVELS_SPEC = [
    {"rows": [
        "################",
        "#..............#",
        "#..............#",
        "#......P.......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#######.########",
        "#..............#",
        "#..............#",
        "#..............#",
        "#......X.......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
     ], "drones": gate_pair(7, 7, 7, 6, 7, 8)},

    {"rows": [
        "################",
        "#..............#",
        "#......P.......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#######.########",
        "#..............#",
        "#..............#",
        "#..............#",
        "#......X.......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
     ], "drones": [[(7, 6), (7, 7)], [(7, 8), (7, 7)]]},

    {"rows": [
        "################",
        "#..P...........#",
        "#..............#",
        "#..............#",
        "#####.##########",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "##########.#####",
        "#..............#",
        "#..............#",
        "#.........X....#",
        "#..............#",
        "#..............#",
        "################",
     ], "drones": gate_pair(5, 4, 5, 3, 5, 5) + [
        [(10, 8), (10, 9)], [(10, 10), (10, 9)]]},

    {"rows": [
        "################",
        "#P.............#",
        "#..............#",
        "####.###########",
        "#..............#",
        "#..............#",
        "##########.#####",
        "#..............#",
        "#..............#",
        "####.###########",
        "#..............#",
        "#..............#",
        "#..........X...#",
        "#..............#",
        "#..............#",
        "################",
     ], "drones": [[(4, 2), (4, 3)], [(4, 4), (4, 3)]]
        + gate_pair(10, 6, 10, 5, 10, 7)
        + [[(4, 8), (4, 9)], [(4, 10), (4, 9)]]},

    {"rows": [
        "################",
        "#...P..........#",
        "#..............#",
        "#########.######",
        "#..............#",
        "#..............#",
        "#..............#",
        "###.############",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.........X....#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
     ], "drones": [[(9, 2), (9, 3)], [(9, 4), (9, 3)]]
        + gate_pair(3, 7, 3, 6, 3, 8)
        + [hstrip(3, 7, 9), hstrip(11, 7, 9, hold=1)]},

    {"rows": [
        "################",
        "#P.............#",
        "#..............#",
        "#####.##########",
        "#..............#",
        "#..............#",
        "#..........r####",
        "#..............#",
        "#..............#",
        "####.###########",
        "#..............#",
        "#..............#",
        "#..............#",
        "#............X.#",
        "#..............#",
        "################",
     ], "drones": [[(5, 2), (5, 3)], [(5, 4), (5, 3)]]
        + gate_pair(11, 6, 11, 5, 11, 7)
        + [[(4, 8), (4, 9)], [(4, 10), (4, 9)]]
        + [hstrip(2, 6, 5), hstrip(10, 6, 5, hold=1)]},

    {"rows": [
        "################",
        "#..P...........#",
        "#..............#",
        "####r###########",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "##########r#####",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.......X......#",
        "#..............#",
        "#..............#",
        "################",
     ], "drones": [[(4, 2), (4, 3)], [(4, 4), (4, 3)]]
        + gate_pair(10, 8, 10, 7, 10, 9)
        + [hstrip(3, 7, 6), hstrip(11, 7, 6, hold=1)]},

    {"rows": [
        "################",
        "#.P............#",
        "#..............#",
        "###r############",
        "#..............#",
        "#..............#",
        "#########r######",
        "#..............#",
        "#..............#",
        "#..............#",
        "####.###########",
        "#..............#",
        "#..........X...#",
        "#..............#",
        "#..............#",
        "################",
     ], "drones": [[(3, 2), (3, 3)], [(3, 4), (3, 3)]]
        + gate_pair(9, 6, 9, 5, 9, 7)
        + [[(4, 9), (4, 10)], [(4, 11), (4, 10)]]
        + [hstrip(2, 6, 8), hstrip(10, 6, 8, hold=1)]},
]


def start_of(index):
    rows = LEVELS_SPEC[index]["rows"]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "P":
                return (x, y)
    raise AssertionError(f"level {index} has no start")


def exit_of(index):
    rows = LEVELS_SPEC[index]["rows"]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "X":
                return (x, y)
    raise AssertionError(f"level {index} has no exit")


def ratchets_of(index):
    rows = LEVELS_SPEC[index]["rows"]
    return [(x, y) for y, row in enumerate(rows)
            for x, ch in enumerate(row) if ch == "r"]


def period_of(index):
    from math import gcd
    p = 1
    for path in LEVELS_SPEC[index]["drones"]:
        p = p * len(path) // gcd(p, len(path))
    return p


def drone_cells(index, tick):
    return [path[tick % len(path)] for path in LEVELS_SPEC[index]["drones"]]


def lethal(index, cell, tick):
    return drone_cells(index, tick).count(cell) >= 2


def resolve(index, pos, tick, sealed, move):
    rows = LEVELS_SPEC[index]["rows"]
    ratchets = set(ratchets_of(index))
    nx, ny = pos[0] + move[0], pos[1] + move[1]
    nxt = pos
    if 0 <= nx < N and 0 <= ny < N and rows[ny][nx] != "#" and (nx, ny) not in sealed:
        nxt = (nx, ny)
    if nxt != pos and pos in ratchets:
        sealed = sealed | frozenset({pos})
    tick += 1
    return nxt, tick, sealed, lethal(index, nxt, tick)


def _solid(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _ring(colour):
    block = [[colour] * CELL for _ in range(CELL)]
    for y in range(1, CELL - 1):
        for x in range(1, CELL - 1):
            block[y][x] = -1
    return block


def _core(colour):
    block = [[-1] * CELL for _ in range(CELL)]
    for y in range(1, CELL - 1):
        for x in range(1, CELL - 1):
            block[y][x] = colour
    return block


_TRACE_CORNER = ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1))


def _trace(colour, drone_index):
    block = [[-1] * CELL for _ in range(CELL)]
    ty, tx = _TRACE_CORNER[drone_index % len(_TRACE_CORNER)]
    block[ty][tx] = colour
    return block


def build_levels():
    levels = []
    for index, spec in enumerate(LEVELS_SPEC):
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                if ch == "#":
                    sprites.append(Sprite(
                        pixels=_solid(WALL), name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-3,
                    ).set_position(px, py))
                elif ch == "X":
                    sprites.append(Sprite(
                        pixels=_solid(EXIT), name="exit",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-2,
                    ).set_position(px, py))
                elif ch == "r":
                    sprites.append(Sprite(
                        pixels=_solid(RATCHET_SEALED), name=f"sealed_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-2,
                    ).set_position(px, py))
                    sprites.append(Sprite(
                        pixels=_ring(RATCHET_OPEN), name=f"ratchet_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=0,
                    ).set_position(px, py))

        for di, path in enumerate(spec["drones"]):
            colour = DRONE_COLOURS[di % len(DRONE_COLOURS)]
            for (cx, cy) in sorted(set(path)):
                sprites.append(Sprite(
                    pixels=_trace(colour, di), name=f"trace_{di}_{cx}_{cy}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=-1,
                ).set_position(cx * CELL, cy * CELL))
            dx, dy = path[0]
            sprites.append(Sprite(
                pixels=_ring(colour), name=f"drone_{di}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1,
            ).set_position(dx * CELL, dy * CELL))

        sx, sy = start_of(index)
        sprites.append(Sprite(
            pixels=_core(PLAYER), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=2,
        ).set_position(sx * CELL, sy * CELL))

        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


SLOTS = 20


class G081d9642(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        here = self._game.tick % SLOTS
        for i in range(SLOTS):
            x = 1 + i * 3
            if x + 2 > frame.shape[1]:
                break
            frame[1:3, x:x + 2] = TICK_ON if i == here else TICK_OFF
        return frame


class G5b009c25(ARCBaseGame):

    def __init__(self):
        self.pos = start_of(0)
        self.tick = 0
        self.sealed = frozenset()
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G081d9642(self)],
        )
        super().__init__(game_id="t088853a8", levels=build_levels(), camera=camera)

    def on_set_level(self, level):
        self.pos = start_of(self.level_index)
        self.tick = 0
        self.sealed = frozenset()

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)
        self._redraw()

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)
        self._redraw()

    def _redraw(self):
        level = self.current_level
        for di, (cx, cy) in enumerate(drone_cells(self.level_index, self.tick)):
            for s in level.get_sprites_by_name(f"drone_{di}"):
                s.set_position(cx * CELL, cy * CELL)
        for s in level.get_sprites_by_name("player"):
            s.set_position(self.pos[0] * CELL, self.pos[1] * CELL)
        for (rx, ry) in self.sealed:
            for s in level.get_sprites_by_name(f"ratchet_{rx}_{ry}"):
                level.remove_sprite(s)

    def step(self):
        move = DIRS.get(self.action.id)
        if move is None:
            self.complete_action()
            return

        self.pos, self.tick, self.sealed, dead = resolve(
            self.level_index, self.pos, self.tick, self.sealed, move)

        if dead:
            self.level_reset()
            self.complete_action()
            return

        self._redraw()
        if self.pos == exit_of(self.level_index):
            self.next_level()
        self.complete_action()
