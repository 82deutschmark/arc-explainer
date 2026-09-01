# ARC-AGI-3 candidate task t35352a03.

from typing import NamedTuple

import numpy as np

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

WALL = 13
FLAT_TILE = 0
SLAB_TILE = 2
SOCKET_TILE = 4
SCAR_TILE = 5
GOAL = 12
PLAYER = 7
PLAYER_CORE = 13
PIP_ON = 0
PIP_OFF = 5
BLOOM_BANDS = (14, 11, 8)

COLS, ROWS = 19, 15
CELL = 3
FRAME = 64
OX = (FRAME - COLS * CELL) // 2
OY = (FRAME - ROWS * CELL) // 2

SPREAD_PERIOD = 2
LIFESPAN = 8

ROCK_CH = "#"
FLAT_CH = "."
SOCKET_CH = "o"
START_CH = "@"
GOAL_CH = "X"
SLAB_CHARS = "=" + START_CH + GOAL_CH
GROWABLE_CHARS = FLAT_CH + SOCKET_CH

STEPS = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0)}
NEIGHBOURS = ((0, -1), (0, 1), (-1, 0), (1, 0))

LEVELS_SPEC = [
    {"cuttings": 1, "rows": [
        "###################",
        "###################",
        "###################",
        "###################",
        "###################",
        "##======.....====##",
        "##======.....====##",
        "##==@===o....==X=##",
        "##======.....====##",
        "##======.....====##",
        "###################",
        "###################",
        "###################",
        "###################",
        "###################",
    ]},
    {"cuttings": 1, "rows": [
        "###################",
        "###################",
        "###################",
        "###########......##",
        "###########......##",
        "###########......=#",
        "#######====o.....X#",
        "#######=###......=#",
        "#######=###......##",
        "#######=###......##",
        "#####===###########",
        "######=############",
        "##@====############",
        "###################",
        "###################",
    ]},
    {"cuttings": 1, "rows": [
        "###################",
        "###################",
        "###################",
        "###################",
        "#############..####",
        "#############..####",
        "###########....===#",
        "###########....=X=#",
        "######....#....===#",
        "##====.........####",
        "##====o...#########",
        "##=@==....#########",
        "##====#############",
        "###################",
        "###################",
    ]},
    {"cuttings": 1, "rows": [
        "###################",
        "###################",
        "###################",
        "###################",
        "###################",
        "##===##############",
        "##===######..#====#",
        "##=@=o.......#=X==#",
        "##===###.##..#====#",
        "##===###.####.====#",
        "########......#####",
        "###################",
        "###################",
        "###################",
        "###################",
    ]},
    {"cuttings": 2, "rows": [
        "###################",
        "###################",
        "#===.....===#######",
        "#===.....===#######",
        "#=@=o....===#######",
        "#===.....===#######",
        "#===.....===#######",
        "#########===#######",
        "#########===#######",
        "#########===#######",
        "#########o.....===#",
        "#########......=X=#",
        "#########......===#",
        "#########......===#",
        "###################",
    ]},
    {"cuttings": 2, "rows": [
        "###################",
        "###################",
        "##############===##",
        "##############X==##",
        "##########....===##",
        "##########.########",
        "##########.########",
        "##########o########",
        "#########==########",
        "######...==########",
        "#===##.##==########",
        "#===##.############",
        "#=@=o......########",
        "#===###############",
        "###################",
    ]},
]

for _spec in LEVELS_SPEC:
    assert len(_spec["rows"]) == ROWS and all(len(r) == COLS for r in _spec["rows"])


class Gd7c05021(NamedTuple):

    x: int
    y: int
    bloom: frozenset
    scar: frozenset
    cuttings: int


def cells(rows, ch):
    return [(x, y) for y, row in enumerate(rows) for x, c in enumerate(row) if c == ch]


def opening(spec):
    x, y = cells(spec["rows"], START_CH)[0]
    return Gd7c05021(x, y, frozenset(), frozenset(), spec["cuttings"])


def ages_of(bloom):
    return {(x, y): age for x, y, age in bloom}


def footing(rows, w, x, y):
    if not (0 <= x < COLS and 0 <= y < ROWS):
        return False
    ch = rows[y][x]
    if ch in SLAB_CHARS:
        return True
    if ch in GROWABLE_CHARS:
        return (x, y) in ages_of(w.bloom)
    return False


def takes_cutting(rows, w, x, y):
    if not (0 <= x < COLS and 0 <= y < ROWS) or w.cuttings <= 0:
        return False
    if rows[y][x] != SOCKET_CH:
        return False
    return (x, y) not in ages_of(w.bloom) and (x, y) not in w.scar


def advance(rows, bloom, scar):
    aged = {(x, y): age + 1 for x, y, age in bloom}
    born = {}
    for (x, y), age in aged.items():
        if age % SPREAD_PERIOD or age >= LIFESPAN:
            continue
        for dx, dy in NEIGHBOURS:
            nx, ny = x + dx, y + dy
            if not (0 <= nx < COLS and 0 <= ny < ROWS):
                continue
            if rows[ny][nx] not in GROWABLE_CHARS:
                continue
            if (nx, ny) in aged or (nx, ny) in scar or (nx, ny) in born:
                continue
            born[(nx, ny)] = 0
    burnt = set(scar)
    live = {}
    for pos, age in aged.items():
        if age >= LIFESPAN:
            burnt.add(pos)
        else:
            live[pos] = age
    live.update(born)
    return (frozenset((x, y, age) for (x, y), age in live.items()), frozenset(burnt))


def apply(rows, w, move):
    x, y, cuttings = w.x, w.y, w.cuttings
    bloom = w.bloom
    if isinstance(move, tuple):
        _, sx, sy = move
        if takes_cutting(rows, w, sx, sy):
            bloom = bloom | {(sx, sy, 0)}
            cuttings -= 1
    elif move in STEPS:
        dx, dy = STEPS[move]
        if footing(rows, w, x + dx, y + dy):
            x, y = x + dx, y + dy

    bloom, scar = advance(rows, bloom, w.scar)
    moved = Gd7c05021(x, y, bloom, scar, cuttings)
    if not footing(rows, moved, x, y):
        return moved, "gone"
    if rows[y][x] == GOAL_CH:
        return moved, "goal"
    return moved, "ok"


def tile(colour):
    return np.full((CELL, CELL), colour, dtype=np.int8)


def eyed(colour, core):
    face = tile(colour)
    face[CELL // 2, CELL // 2] = core
    return face


def band_of(age):
    return BLOOM_BANDS[min(age * len(BLOOM_BANDS) // LIFESPAN, len(BLOOM_BANDS) - 1)]


def face_of(rows, ages, scar, x, y):
    ch = rows[y][x]
    if (x, y) in ages:
        return tile(band_of(ages[(x, y)]))
    if (x, y) in scar:
        return tile(SCAR_TILE)
    if ch == ROCK_CH:
        return tile(WALL)
    if ch == SOCKET_CH:
        return eyed(SOCKET_TILE, FLAT_TILE)
    if ch == FLAT_CH:
        return tile(FLAT_TILE)
    if ch == GOAL_CH:
        return tile(GOAL)
    return tile(SLAB_TILE)


def paint(rows, w, total):
    board = np.full((FRAME, FRAME), WALL, dtype=np.int8)
    ages = ages_of(w.bloom)
    for y in range(ROWS):
        for x in range(COLS):
            board[OY + y * CELL:OY + (y + 1) * CELL,
                  OX + x * CELL:OX + (x + 1) * CELL] = face_of(rows, ages, w.scar, x, y)
    for i in range(total):
        left = OX + i * (CELL + 1)
        board[OY - 2 * CELL:OY - CELL, left:left + CELL] = (
            PIP_ON if i < w.cuttings else PIP_OFF)
    return board


def build_levels():
    made = []
    for spec in LEVELS_SPEC:
        start = opening(spec)
        flat = Sprite(
            pixels=paint(spec["rows"], start, spec["cuttings"]), name="flat",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=-1,
        ).set_position(0, 0)
        walker = Sprite(
            pixels=eyed(PLAYER, PLAYER_CORE), name="walker",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(OX + start.x * CELL, OY + start.y * CELL)
        made.append(Level(sprites=[flat, walker], grid_size=(FRAME, FRAME)))
    return made


class G8e07018d(ARCBaseGame):

    def __init__(self):
        self.world = opening(LEVELS_SPEC[0])
        super().__init__(
            game_id="t35352a03", levels=build_levels(),
            camera=Camera(width=FRAME, height=FRAME,
                          background=WALL, letter_box=WALL),
        )

    @property
    def spec(self):
        return LEVELS_SPEC[self.level_index]

    @property
    def rows(self):
        return self.spec["rows"]

    def on_set_level(self, level):
        self.world = opening(self.spec)
        self.repaint()

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)

    def repaint(self):
        flat = self.current_level.get_sprites_by_name("flat")
        if flat:
            flat[0].pixels[:, :] = paint(self.rows, self.world, self.spec["cuttings"])
        walker = self.current_level.get_sprites_by_name("walker")
        if walker:
            walker[0].set_position(OX + self.world.x * CELL, OY + self.world.y * CELL)

    def read_move(self):
        heading = {
            GameAction.ACTION1: "U",
            GameAction.ACTION2: "D",
            GameAction.ACTION3: "L",
            GameAction.ACTION4: "R",
            GameAction.ACTION5: "W",
        }.get(self.action.id)
        if heading is not None:
            return heading
        if self.action.id != GameAction.ACTION6:
            return None
        x = (int(self.action.data.get("x", -1)) - OX) // CELL
        y = (int(self.action.data.get("y", -1)) - OY) // CELL
        return ("S", x, y) if 0 <= x < COLS and 0 <= y < ROWS else "W"

    def step(self):
        move = self.read_move()
        if move is None:
            self.complete_action()
            return

        self.world, outcome = apply(self.rows, self.world, move)
        self.repaint()

        if outcome == "gone":
            self.level_reset()
        elif outcome == "goal":
            self.next_level()

        self.complete_action()
