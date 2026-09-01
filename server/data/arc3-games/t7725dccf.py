# ARC-AGI-3 candidate task t7725dccf.

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
PLATE_UP = 12
PLATE_DOWN = 14
SPIKE = 8
CRATE = 7
PLAYER = 10
EXIT = 14
EXIT_SHUT = 2
PAIR_COLOURS = (0, 9, 13, 15, 1)

DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))

LEVELS_SPEC = [
    {"pairs": [((4, 4), (11, 10))], "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#...=..........#",
        "#..............#",
        "#..o...........#",
        "#..P...........#",
        "#..............#",
        "#..............#",
        "#..........=...#",
        "#..............#",
        "#.............X#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"pairs": [((4, 4), (11, 10)), ((6, 7), (14, 12)), ((8, 7), (11, 4))], "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#...=......^...#",
        "#..............#",
        "#..o...........#",
        "#..P..=........#",
        "#..............#",
        "#..............#",
        "#..........=...#",
        "#..............#",
        "#.............X#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"pairs": [((4, 4), (11, 10)), ((14, 12), (6, 6))], "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#...=..........#",
        "#..............#",
        "#..o..=........#",
        "#..P...........#",
        "#..............#",
        "#..............#",
        "#..........=...#",
        "#..............#",
        "#.............X#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"pairs": [((4, 6), (9, 6)), ((5, 10), (12, 4))], "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#...........=..#",
        "#..............#",
        "#..o...........#",
        "#..P...........#",
        "#..............#",
        "#..............#",
        "#....=.........#",
        "#..............#",
        "#.............X#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"pairs": [((14, 5), (10, 9)), ((3, 11), (14, 13))], "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.............=#",
        "#..o...........#",
        "#..P...........#",
        "#..............#",
        "#.........=....#",
        "#..............#",
        "#..=...........#",
        "#..............#",
        "#.............X#",
        "#..............#",
        "################",
    ]},
    {"pairs": [((4, 4), (11, 10)), ((7, 6), (4, 12)), ((6, 9), (9, 3))], "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#........^.....#",
        "#...=..........#",
        "#..............#",
        "#..o...=.......#",
        "#..P...........#",
        "#..o...........#",
        "#..............#",
        "#..........=...#",
        "#..............#",
        "#...=.........X#",
        "#..............#",
        "#..............#",
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
    return tuple((x, y) for y in range(N) for x in range(N) if rows[y][x] == ch)


def twin_map(pairs):
    out = {}
    for a, b in pairs:
        out[tuple(a)] = tuple(b)
        out[tuple(b)] = tuple(a)
    return out


def twin_of(twins, cell):
    return twins.get(cell)


def occupies(twins, cell):
    t = twins.get(cell)
    return (cell,) if t is None else (cell, t)


def is_wall(rows, cell):
    x, y = cell
    return not (0 <= x < N and 0 <= y < N) or rows[y][x] == "#"


def tile_blocked(rows, twins, cell):
    if is_wall(rows, cell):
        return True
    return any(is_wall(rows, c) for c in occupies(twins, cell))


def crate_cells(twins, crates):
    out = set()
    for k in crates:
        out.update(occupies(twins, k))
    return out


def push_to(rows, twins, crates, at, d):
    dest = (at[0] + d[0], at[1] + d[1])
    if tile_blocked(rows, twins, dest):
        return None
    if any(c in crate_cells(twins, crates) for c in occupies(twins, dest)):
        return None
    if any(rows[c[1]][c[0]] == "^" for c in occupies(twins, dest)):
        return None
    return dest


def which_crate(twins, crates, cell):
    for k in crates:
        if cell in occupies(twins, k):
            return k
    return None


def step_player(rows, twins, player, crates, d):
    dest = (player[0] + d[0], player[1] + d[1])
    if tile_blocked(rows, twins, dest):
        return player, crates, False
    k = which_crate(twins, crates, dest)
    if k is not None:
        moved = push_to(rows, twins, [c for c in crates if c != k], dest, d)
        if moved is None:
            return player, crates, False
        crates = tuple(sorted([c for c in crates if c != k] + [moved]))
    dead = any(rows[c[1]][c[0]] == "^" for c in occupies(twins, dest))
    return dest, crates, dead


def held_plates(rows, twins, player, crates):
    resting = set(occupies(twins, player)) | crate_cells(twins, crates)
    return {p for p in find_all(rows, "=") if p in resting}


def solved(rows, twins, player, crates):
    plates = set(find_all(rows, "="))
    return (player == find_char(rows, "X")
            and held_plates(rows, twins, player, crates) == plates)


def start_state(rows):
    return find_char(rows, "P"), tuple(sorted(find_all(rows, "o")))


def _block(colour):
    return [[colour] * CELL for _ in range(CELL)]


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for y in range(N):
            for x in range(N):
                c = rows[y][x]
                colour = {"#": WALL, "^": SPIKE}.get(c)
                if colour is None:
                    continue
                sprites.append(Sprite(
                    pixels=_block(colour), name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0, collidable=False,
                ).set_position(x * CELL, y * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G9418a9c5(RenderableUserDisplay):

    def __init__(self, game: "G1716746d") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game
        rows = g.rows

        def fill(cell, colour):
            x, y = cell
            frame[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = colour

        held = held_plates(rows, g.twins, g.player, g.crates)
        for p in find_all(rows, "="):
            fill(p, PLATE_DOWN if p in held else PLATE_UP)

        ex = find_char(rows, "X")
        fill(ex, EXIT if len(held) == len(find_all(rows, "=")) else EXIT_SHUT)

        for k in g.crates:
            for c in occupies(g.twins, k):
                fill(c, CRATE)

        for i, (a, b) in enumerate(g.spec["pairs"]):
            colour = PAIR_COLOURS[i % len(PAIR_COLOURS)]
            for (x, y) in (tuple(a), tuple(b)):
                frame[y * CELL:(y + 1) * CELL, x * CELL:x * CELL + 1] = colour
                frame[y * CELL:y * CELL + 1, x * CELL:(x + 1) * CELL] = colour

        px, py = g.player
        frame[py * CELL + 1:py * CELL + 4, px * CELL + 1:px * CELL + 4] = PLAYER
        return frame


class G1716746d(ARCBaseGame):

    def __init__(self) -> None:
        self.player = (0, 0)
        self.crates = ()
        self.twins = {}
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G9418a9c5(self)],
        )
        super().__init__(game_id="t7725dccf", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4])
        self.on_set_level(self.current_level)

    @property
    def spec(self):
        return LEVELS_SPEC[self.level_index]

    @property
    def rows(self):
        return self.spec["rows"]

    def on_set_level(self, level: Level) -> None:
        self.twins = twin_map(self.spec["pairs"])
        self.player, self.crates = start_state(self.rows)

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def step(self) -> None:
        d = {GameAction.ACTION1: (0, -1), GameAction.ACTION2: (0, 1),
             GameAction.ACTION3: (-1, 0), GameAction.ACTION4: (1, 0)}.get(self.action.id)
        if d is not None:
            self.player, self.crates, dead = step_player(
                self.rows, self.twins, self.player, self.crates, d)
            if dead:
                self.level_reset()
            elif solved(self.rows, self.twins, self.player, self.crates):
                self.next_level()
        self.complete_action()
