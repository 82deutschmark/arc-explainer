# ARC-AGI-3 candidate task g013.

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

STONE_FILL = 2
STONE_EDGE = 13
LEDGE_TILE = 7
LEDGE_EDGE = 6
LOAM_TILE = 6
LOAM_MARK = 13
MOUTH_MARK = 12
ASH_TILE = 13
ASH_MARK = 2
EXIT_FILL = 11
EXIT_MARK = 12
RIDER_SPRITE = 8
RIDER_PIP = 14
RIDER_EYE_MARK = 7
LICHEN_MARK = 14
DRIP_MARK = 12
VEIN_MARK = 8

BLOOM_YOUNG_FILL = 14
BLOOM_MID_FILL = 12
BLOOM_OLD_FILL = 13
BLOOM_BANDS = (BLOOM_YOUNG_FILL, BLOOM_MID_FILL, BLOOM_OLD_FILL)
BLOOM_NEXT = (BLOOM_MID_FILL, BLOOM_OLD_FILL, ASH_TILE)

COLS, ROWS = 7, 8
CELL = 6
FRAME = 64
ORIGIN_X = 0
ORIGIN_Y = 8

HEX = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
    GameAction.ACTION5: (1, -1),
    GameAction.ACTION7: (-1, 1),
}
NEIGHBOURS = tuple(HEX.values())

SPREAD_PERIOD = 1
LIFESPAN = 5
RIDE_CAP = 16

STONE_CH = "#"
LOAM_CH = "."
MOUTH_CH = "o"
START_CH = "@"
EXIT_CH = "X"
LEDGE_CHARS = "=" + START_CH + EXIT_CH
GROWABLE_CHARS = LOAM_CH + MOUTH_CH

LEVELS_SPEC = [
    {"cuttings": 1, "rows": [
        "#######",
        "#######",
        "#######",
        "@o..###",
        "##X####",
        "#######",
        "#######",
        "#######",
    ], "decor": ((3, 2, "lichen"), (5, 4, "lichen"), (1, 5, "drip"), (4, 1, "vein"))},
    {"cuttings": 1, "rows": [
        "#######",
        "#######",
        "@====##",
        "####o##",
        "####.##",
        "###.###",
        "###.###",
        "##X####",
    ], "decor": ((2, 1, "lichen"), (5, 5, "lichen"), (1, 6, "drip"), (5, 2, "vein"),
                 (0, 4, "vein"))},
    {"cuttings": 1, "rows": [
        "#######",
        "####.=#",
        "@o..#X#",
        "##.####",
        "#.#####",
        "#######",
        "#######",
        "#######",
    ], "decor": ((4, 0, "lichen"), (1, 3, "lichen"), (6, 5, "drip"), (0, 6, "vein"),
                 (3, 4, "vein"))},
    {"cuttings": 1, "rows": [
        "#####=#",
        "@o...##",
        "##..###",
        "#..####",
        "#=#####",
        "#X#####",
        "#######",
        "#######",
    ], "decor": ((2, 0, "lichen"), (0, 3, "lichen"), (6, 6, "drip"), (4, 2, "vein"),
                 (3, 3, "vein"))},
    {"cuttings": 2, "rows": [
        "#######",
        "@o...=#",
        "#####.#",
        "####o.#",
        "###..##",
        "##..###",
        "##X####",
        "#######",
    ], "decor": ((3, 0, "lichen"), (6, 4, "lichen"), (0, 5, "drip"), (2, 2, "vein"),
                 (5, 6, "vein"))},
    {"cuttings": 2, "rows": [
        "@o..=##",
        "####=##",
        "####o.#",
        "###...#",
        "##...##",
        "#X#.###",
        "##.####",
        "#######",
    ], "decor": ((6, 0, "lichen"), (0, 3, "lichen"), (1, 6, "drip"), (2, 1, "vein"),
                 (2, 7, "vein"))},
]

for _spec in LEVELS_SPEC:
    assert len(_spec["rows"]) == ROWS and all(len(r) == COLS for r in _spec["rows"])


class G013A(NamedTuple):

    q: int
    r: int
    bloom: frozenset
    ash: frozenset
    cuttings: int


def cells(rows, ch):
    return [(q, r) for r, row in enumerate(rows) for q, c in enumerate(row) if c == ch]


def opening(spec):
    q, r = cells(spec["rows"], START_CH)[0]
    return G013A(q, r, frozenset(), frozenset(), spec["cuttings"])


def ages_of(bloom):
    return {(q, r): age for q, r, age in bloom}


def on_board(q, r):
    return 0 <= q < COLS and 0 <= r < ROWS


def footing(rows, w, q, r):
    if not on_board(q, r):
        return False
    ch = rows[r][q]
    if ch in LEDGE_CHARS:
        return True
    if ch in GROWABLE_CHARS:
        return (q, r) in ages_of(w.bloom)
    return False


def takes_cutting(rows, w, q, r):
    if not on_board(q, r) or w.cuttings <= 0:
        return False
    if rows[r][q] != MOUTH_CH:
        return False
    return (q, r) not in ages_of(w.bloom) and (q, r) not in w.ash


def advance(rows, bloom, ash):
    aged = {(q, r): age + 1 for q, r, age in bloom}
    born = {}
    for (q, r), age in aged.items():
        if age % SPREAD_PERIOD or age >= LIFESPAN:
            continue
        for dq, dr in NEIGHBOURS:
            nq, nr = q + dq, r + dr
            if not on_board(nq, nr):
                continue
            if rows[nr][nq] not in GROWABLE_CHARS:
                continue
            if (nq, nr) in aged or (nq, nr) in ash or (nq, nr) in born:
                continue
            born[(nq, nr)] = 0
    burnt = set(ash)
    live = {}
    for pos, age in aged.items():
        if age >= LIFESPAN:
            burnt.add(pos)
        else:
            live[pos] = age
    live.update(born)
    return (frozenset((q, r, age) for (q, r), age in live.items()), frozenset(burnt))


def tick(rows, w, dq, dr, sow):
    q, r, cuttings = w.q, w.r, w.cuttings
    bloom = w.bloom
    if sow is not None:
        if takes_cutting(rows, w, *sow):
            bloom = bloom | {(sow[0], sow[1], 0)}
            cuttings -= 1
    elif (dq, dr) != (0, 0) and footing(rows, w, q + dq, r + dr):
        q, r = q + dq, r + dr

    bloom, ash = advance(rows, bloom, w.ash)
    moved = G013A(q, r, bloom, ash, cuttings)
    if not footing(rows, moved, q, r):
        return moved, "gone"
    if rows[r][q] == EXIT_CH:
        return moved, "goal"
    return moved, "ok"


def ride(rows, w, dq, dr):
    steps = 0
    while steps < RIDE_CAP:
        if steps and not footing(rows, w, w.q + dq, w.r + dr):
            return w, "ok", steps
        w, outcome = tick(rows, w, dq, dr, None)
        steps += 1
        if outcome != "ok":
            return w, outcome, steps
    return w, "ok", steps


def apply(rows, w, move):
    if isinstance(move, tuple) and len(move) == 3:
        return tick(rows, w, 0, 0, (move[1], move[2]))[:2]
    w, outcome, _ = ride(rows, w, move[0], move[1])
    return w, outcome


def drawn_cells(rows, w):
    ages = ages_of(w.bloom)
    out = {}
    for r in range(ROWS):
        for q in range(COLS):
            if rows[r][q] == STONE_CH:
                continue
            if (q, r) in ages:
                out[(q, r)] = ("bloom", band_index(ages[(q, r)]))
            elif (q, r) in w.ash:
                out[(q, r)] = ("ash", 0)
            else:
                out[(q, r)] = ("bare", 0)
    out[(w.q, w.r)] = ("rider", w.cuttings)
    return out


HEX_TILE_MASK = (
    (-1, -1, 0, 0, -1, -1),
    (-1, 0, 1, 1, 0, -1),
    (0, 1, 1, 1, 1, 0),
    (0, 1, 1, 1, 1, 0),
    (-1, 0, 1, 1, 0, -1),
    (-1, -1, 0, 0, -1, -1),
)
LOAM_MASK = (
    (-1, -1, 0, 0, -1, -1),
    (-1, 0, 0, 1, 0, -1),
    (0, 0, 1, 0, 0, 0),
    (0, 1, 0, 0, 1, 0),
    (-1, 0, 0, 0, 0, -1),
    (-1, -1, 0, 0, -1, -1),
)
MOUTH_MASK = (
    (-1, -1, 0, 0, -1, -1),
    (-1, 0, 1, 1, 0, -1),
    (0, 1, 1, 1, 1, 0),
    (0, 1, 1, 1, 1, 0),
    (-1, 0, 1, 1, 0, -1),
    (-1, -1, 0, 0, -1, -1),
)
ASH_MASK = (
    (-1, -1, 0, 0, -1, -1),
    (-1, 0, 1, 0, 0, -1),
    (0, 0, 0, 0, 1, 0),
    (0, 1, 0, 0, 0, 0),
    (-1, 0, 0, 1, 0, -1),
    (-1, -1, 0, 0, -1, -1),
)
EXIT_MASK = (
    (-1, -1, 0, 0, -1, -1),
    (-1, 0, 1, 1, 0, -1),
    (0, 1, 0, 0, 1, 0),
    (0, 1, 0, 0, 1, 0),
    (-1, 0, 1, 1, 0, -1),
    (-1, -1, 0, 0, -1, -1),
)
BLOOM_MASK = (
    (-1, -1, 0, 0, -1, -1),
    (-1, 0, 0, 0, 0, -1),
    (0, 0, 1, 1, 0, 0),
    (0, 0, 1, 1, 0, 0),
    (-1, 0, 0, 0, 0, -1),
    (-1, -1, 0, 0, -1, -1),
)
STONE_MASK = (
    (1, 0, 0, 0, 0, 0),
    (1, 0, 0, 0, 0, 0),
    (1, 0, 0, 0, 0, 0),
    (0, 0, 0, 1, 0, 0),
    (0, 0, 0, 1, 0, 0),
    (1, 1, 1, 1, 1, 1),
)
RIDER_MASK = (
    (-1, -1, 0, 0, -1, -1),
    (-1, 0, 3, 3, 0, -1),
    (-1, 0, 0, 0, 0, -1),
    (-1, 0, 1, 2, 0, -1),
    (-1, -1, 0, 0, -1, -1),
    (-1, -1, -1, -1, -1, -1),
)
LICHEN_MASK = (
    (0, 1, 0, 0, 0, 0),
    (1, 1, 0, 1, 0, 0),
    (0, 1, 1, 0, 0, 0),
    (0, 0, 1, 0, 1, 0),
    (0, 0, 0, 1, 1, 0),
    (0, 0, 0, 0, 1, 0),
)
VEIN_MASK = (
    (1, 0, 0, 0, 0, 0),
    (0, 1, 0, 0, 0, 0),
    (0, 0, 1, 0, 0, 0),
    (0, 0, 0, 1, 0, 0),
    (0, 0, 0, 0, 1, 0),
    (0, 0, 0, 0, 0, 1),
)


def stamp(mask, colours, under=None):
    face = np.empty((CELL, CELL), dtype=np.int8) if under is None else under.copy()
    for j, row in enumerate(mask):
        for i, slot in enumerate(row):
            if slot >= 0:
                face[j, i] = colours[slot]
    return face


def screen_of(q, r):
    return ORIGIN_X + q * CELL + (r * CELL) // 2, ORIGIN_Y + r * CELL


def stone_face(gx, gy):
    return stamp(STONE_MASK, (STONE_FILL, STONE_EDGE))


def band_index(age):
    return min(age * len(BLOOM_BANDS) // LIFESPAN, len(BLOOM_BANDS) - 1)


def face_of(rows, ages, ash, q, r, under):
    ch = rows[r][q]
    if (q, r) in ages:
        i = band_index(ages[(q, r)])
        return stamp(BLOOM_MASK, (BLOOM_BANDS[i], BLOOM_NEXT[i]), under=under)
    if (q, r) in ash:
        return stamp(ASH_MASK, (ASH_TILE, ASH_MARK), under=under)
    if ch == MOUTH_CH:
        return stamp(MOUTH_MASK, (LOAM_TILE, MOUTH_MARK), under=under)
    if ch == LOAM_CH:
        return stamp(LOAM_MASK, (LOAM_TILE, LOAM_MARK), under=under)
    if ch == EXIT_CH:
        return stamp(EXIT_MASK, (EXIT_FILL, EXIT_MARK), under=under)
    if ch == STONE_CH:
        return under
    return stamp(HEX_TILE_MASK, (LEDGE_EDGE, LEDGE_TILE), under=under)


def rider_face(under, cuttings):
    pips = (RIDER_PIP if cuttings >= 1 else RIDER_SPRITE,
            RIDER_PIP if cuttings >= 2 else RIDER_SPRITE)
    return stamp(RIDER_MASK,
                 (RIDER_SPRITE, pips[0], pips[1], RIDER_EYE_MARK), under=under)


def decorate(board, decor, pulse):
    for q, r, kind in decor:
        left, top = screen_of(q, r)
        if top + CELL > FRAME or left + CELL > FRAME:
            continue
        patch = board[top:top + CELL, left:left + CELL]
        if kind == "lichen":
            patch[:, :] = stamp(LICHEN_MASK, (patch[0, 0], LICHEN_MARK), under=patch)
        elif kind == "vein":
            patch[:, :] = stamp(VEIN_MASK, (patch[0, 0], VEIN_MARK), under=patch)
        else:
            patch[pulse % CELL, (pulse // CELL) % CELL] = DRIP_MARK
            patch[(pulse + 3) % CELL, CELL - 1] = DRIP_MARK


def paint(rows, w, decor, pulse):
    board = np.full((FRAME, FRAME), STONE_FILL, dtype=np.int8)
    for gy in range(FRAME // CELL + 1):
        for gx in range(FRAME // CELL + 1):
            top, left = gy * CELL, gx * CELL
            patch = board[top:top + CELL, left:left + CELL]
            if patch.shape == (CELL, CELL):
                patch[:, :] = stone_face(gx, gy)
    ages = ages_of(w.bloom)
    for r in range(ROWS):
        for q in range(COLS):
            left, top = screen_of(q, r)
            patch = board[top:top + CELL, left:left + CELL]
            patch[:, :] = face_of(rows, ages, w.ash, q, r, patch)
    decorate(board, decor, pulse)
    return board


def build_levels():
    made = []
    for spec in LEVELS_SPEC:
        start = opening(spec)
        garden = Sprite(
            pixels=paint(spec["rows"], start, spec["decor"], 0), name="garden",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=-1,
        ).set_position(0, 0)
        left, top = screen_of(start.q, start.r)
        under = np.full((CELL, CELL), LEDGE_TILE, dtype=np.int8)
        rider = Sprite(
            pixels=rider_face(
                face_of(spec["rows"], {}, frozenset(), start.q, start.r, under),
                start.cuttings),
            name="rider",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(left, top)
        made.append(Level(sprites=[garden, rider], grid_size=(FRAME, FRAME)))
    return made


class G013(ARCBaseGame):

    def __init__(self):
        self.world = opening(LEVELS_SPEC[0])
        self.pulse = 0
        super().__init__(
            game_id="g013", levels=build_levels(),
            camera=Camera(width=FRAME, height=FRAME,
                          background=STONE_FILL, letter_box=STONE_FILL),
            available_actions=[1, 2, 3, 4, 5, 6, 7],
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
        garden = self.current_level.get_sprites_by_name("garden")
        if garden:
            garden[0].pixels[:, :] = paint(
                self.rows, self.world, self.spec["decor"], self.pulse)
        rider = self.current_level.get_sprites_by_name("rider")
        if rider:
            left, top = screen_of(self.world.q, self.world.r)
            under = np.array(garden[0].pixels[top:top + CELL, left:left + CELL]) \
                if garden else np.full((CELL, CELL), LEDGE_TILE, dtype=np.int8)
            rider[0].pixels[:, :] = rider_face(under, self.world.cuttings)
            rider[0].set_position(left, top)

    def read_move(self):
        heading = HEX.get(self.action.id)
        if heading is not None:
            return heading
        if self.action.id != GameAction.ACTION6:
            return None
        hit = self.camera.display_to_grid(int(self.action.data.get("x", -1)),
                                          int(self.action.data.get("y", -1)))
        if hit is None:
            return (0, 0)
        for r in range(ROWS):
            for q in range(COLS):
                left, top = screen_of(q, r)
                if left <= hit[0] < left + CELL and top <= hit[1] < top + CELL:
                    return ("S", q, r)
        return (0, 0)

    def step(self):
        move = self.read_move()
        if move is None:
            self.complete_action()
            return

        if move == (0, 0):
            self.world, outcome = tick(self.rows, self.world, 0, 0, None)[:2]
        else:
            self.world, outcome = apply(self.rows, self.world, move)
        self.pulse += 1
        self.repaint()

        if outcome == "gone":
            self.level_reset()
        elif outcome == "goal":
            self.next_level()

        self.complete_action()
