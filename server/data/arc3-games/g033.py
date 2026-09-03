# ARC-AGI-3 candidate task g033.

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

WALL = 3
FLOOR = 4
BED_EMPTY = 5
PLAYER = 12
STOP_SERVED = 1

CRATE_COLOURS = {1: 6, 2: 8, 3: 9, 4: 10, 5: 11, 6: 14, 7: 15}

N = 16
CELL = 4
BED_X = 13

WALL_CH = "#"
FLOOR_CH = "."
BED_CH = "b"
START_CH = "P"

DIRS = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0)}

LEVELS_SPEC = [
    {"stops": [1, 2, 3, 4], "rows": [
        "################",
        "#..............#",
        "#...1........b.#",
        "#............b.#",
        "#............b.#",
        "#............b.#",
        "#....2.........#",
        "#..............#",
        "#.......3......#",
        "#..............#",
        "#..............#",
        "#.......4......#",
        "#..............#",
        "#..............#",
        "#.P............#",
        "################",
    ]},
    {"stops": [3, 1, 5, 2, 4], "rows": [
        "################",
        "#..............#",
        "#..1.........b.#",
        "#............b.#",
        "#......2.....b.#",
        "#............b.#",
        "#....3.......b.#",
        "#..............#",
        "#........4.....#",
        "#..............#",
        "#...5..........#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.P............#",
        "################",
    ]},
    {"stops": [1, 3, 2, 5, 4], "rows": [
        "################",
        "#..............#",
        "#..2.........b.#",
        "#............b.#",
        "#............b.#",
        "#........1...b.#",
        "#............b.#",
        "#..............#",
        "#..............#",
        "#.####.........#",
        "#.#54..........#",
        "#.####.........#",
        "#..........3...#",
        "#..............#",
        "#.P............#",
        "################",
    ]},
    {"stops": [2, 6, 1, 3, 5, 4], "rows": [
        "################",
        "#..............#",
        "#............b.#",
        "#............b.#",
        "#.####.......b.#",
        "#.#34........b.#",
        "#.####.......b.#",
        "#......2.....b.#",
        "#..............#",
        "#........####..#",
        "#........#65...#",
        "#........####..#",
        "#...1..........#",
        "#..............#",
        "#.P............#",
        "################",
    ]},
    {"stops": [1, 2, 6, 3, 5, 4], "rows": [
        "################",
        "#..............#",
        "#............b.#",
        "#............b.#",
        "#.#####......b.#",
        "#.#234.......b.#",
        "#.#####......b.#",
        "#............b.#",
        "#..............#",
        "#.......####...#",
        "#.......#165...#",
        "#.......####...#",
        "#..............#",
        "#..............#",
        "#.P............#",
        "################",
    ]},
    {"stops": [7, 4, 1, 6, 2, 3, 5], "rows": [
        "################",
        "#..............#",
        "#....2.......b.#",
        "#............b.#",
        "#.####.......b.#",
        "#.#65........b.#",
        "#.####.......b.#",
        "#............b.#",
        "#.........1..b.#",
        "#..............#",
        "#.......####...#",
        "#.......#43....#",
        "#.......####...#",
        "#...7..........#",
        "#.P............#",
        "################",
    ]},
    {"stops": [6, 3, 4, 5, 1, 7, 2], "rows": [
        "################",
        "#..............#",
        "#.####.......b.#",
        "#.#52........b.#",
        "#.####.......b.#",
        "#............b.#",
        "#..####......b.#",
        "#..#37.......b.#",
        "#..####......b.#",
        "#..............#",
        "#.....####.....#",
        "#.....#61......#",
        "#.....####.....#",
        "#..........4...#",
        "#.P............#",
        "################",
    ]},
]


def stop_row(index: int) -> int:
    return 14 - 2 * index


def bed_cells(rows):
    return sorted(((x, y) for y, r in enumerate(rows)
                   for x, c in enumerate(r) if c == BED_CH), key=lambda p: p[1])


def push_cell(rows):
    cells = bed_cells(rows)
    mx, my = cells[-1]
    return mx, my + 1


def crates_of(rows):
    return {(x, y): int(c) for y, r in enumerate(rows)
            for x, c in enumerate(r) if c.isdigit()}


def find_start(rows):
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c == START_CH:
                return x, y
    raise AssertionError("level has no start")


def required_order(spec):
    return tuple(reversed(spec["stops"]))


def can_walk(rows, floor_crates, carried, x, y):
    if not (0 <= x < N and 0 <= y < N):
        return False
    ch = rows[y][x]
    if ch == WALL_CH or ch == BED_CH:
        return False
    if (x, y) in floor_crates:
        return carried is None
    return True


def start_state(spec):
    sx, sy = find_start(spec["rows"])
    return (sx, sy, None, (), 0, frozenset(crates_of(spec["rows"]).items()))


def step_state(spec, state, action):
    rows = spec["rows"]
    px, py, carried, bed, served, floor = state
    floor_map = dict(floor)
    total = len(spec["stops"])
    order = required_order(spec)
    pcell = push_cell(rows)

    if action in DIRS:
        dx, dy = DIRS[action]
        nx, ny = px + dx, py + dy
        if can_walk(rows, floor_map, carried, nx, ny):
            if (nx, ny) in floor_map:
                carried = floor_map.pop((nx, ny))
            px, py = nx, ny

    elif action == "S":
        if served == 0 and len(bed) < total:
            if carried is not None and (px, py) == pcell:
                bed = bed + (carried,)
                carried = None
        else:
            if served < total and (px, py) == (1, stop_row(served)):
                mouth = bed[-1]
                if mouth == spec["stops"][served]:
                    bed = bed[:-1]
                    served += 1
                    if served == total:
                        return (px, py, carried, bed, served,
                                frozenset(floor_map.items())), "won"
                else:
                    return (px, py, carried, bed, served,
                            frozenset(floor_map.items())), "fail"

    elif action == "Z":
        if served == 0 and len(bed) < total and carried is None and bed and (px, py) == pcell:
            carried = bed[-1]
            bed = bed[:-1]

    return (px, py, carried, bed, served, frozenset(floor_map.items())), "ok"


def _cell_block(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _player_block(carried):
    block = [[PLAYER] * CELL for _ in range(CELL)]
    if carried is not None:
        for i in (1, 2):
            for j in (1, 2):
                block[i][j] = CRATE_COLOURS[carried]
    return block


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites = []
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                colour = WALL if ch == WALL_CH else (BED_EMPTY if ch == BED_CH else FLOOR)
                sprites.append(Sprite(
                    pixels=_cell_block(colour), name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=-1,
                ).set_position(x * CELL, y * CELL))
        sx, sy = find_start(rows)
        sprites.append(Sprite(
            pixels=_cell_block(PLAYER), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=1,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G033A(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        spec = LEVELS_SPEC[self._game.level_index]
        for i, colour in enumerate(spec["stops"]):
            y = stop_row(i) * CELL
            shade = STOP_SERVED if i < self._game.served else CRATE_COLOURS[colour]
            frame[y + 1:y + 3, 1:3] = shade
        return frame


class G033(ARCBaseGame):

    def __init__(self):
        self.spec = LEVELS_SPEC[0]
        self.px, self.py, self.carried, self.bed, self.served, self.floor = \
            start_state(LEVELS_SPEC[0])
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G033A(self)],
        )
        super().__init__(game_id="g033", levels=build_levels(), camera=camera)

    def on_set_level(self, level):
        self.spec = LEVELS_SPEC[self.level_index]
        self.px, self.py, self.carried, self.bed, self.served, self.floor = \
            start_state(self.spec)
        self._repaint()

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)

    @property
    def state_tuple(self):
        return (self.px, self.py, self.carried, self.bed, self.served, self.floor)

    def _repaint(self):
        level = self.current_level
        rows = self.spec["rows"]
        floor_map = dict(self.floor)
        cells = bed_cells(rows)
        bed_colour = {}
        for i, crate in enumerate(self.bed):
            bed_colour[cells[i]] = CRATE_COLOURS[crate]
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == WALL_CH:
                    continue
                found = level.get_sprites_by_name(f"cell_{x}_{y}")
                if not found:
                    continue
                if ch == BED_CH:
                    colour = bed_colour.get((x, y), BED_EMPTY)
                elif (x, y) in floor_map:
                    colour = CRATE_COLOURS[floor_map[(x, y)]]
                else:
                    colour = FLOOR
                found[0].pixels = np.array(_cell_block(colour))
        player = level.get_sprites_by_name("player")
        if player:
            player[0].pixels = np.array(_player_block(self.carried))
            player[0].set_position(self.px * CELL, self.py * CELL)

    def step(self):
        action = None
        if self.action.id == GameAction.ACTION1:
            action = "U"
        elif self.action.id == GameAction.ACTION2:
            action = "D"
        elif self.action.id == GameAction.ACTION3:
            action = "L"
        elif self.action.id == GameAction.ACTION4:
            action = "R"
        elif self.action.id == GameAction.ACTION5:
            action = "S"
        elif self.action.id == GameAction.ACTION7:
            action = "Z"

        if action is None:
            self.complete_action()
            return

        state, outcome = step_state(self.spec, self.state_tuple, action)
        self.px, self.py, self.carried, self.bed, self.served, self.floor = state
        self._repaint()

        if outcome == "fail":
            self.level_reset()
        elif outcome == "won":
            self.next_level()

        self.complete_action()
