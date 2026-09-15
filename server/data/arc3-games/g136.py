# ARC-AGI-3 candidate task g136.

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

def facing(body: int, visor: int, heading: tuple, cell: int = 4) -> list[list[int]]:
    px = rounded(body, cell)
    dx, dy = heading
    last = cell - 1
    if dy < 0:
        px[0][1] = px[0][cell - 2] = visor
    elif dy > 0:
        px[last][1] = px[last][cell - 2] = visor
    elif dx < 0:
        px[1][0] = px[cell - 2][0] = visor
    elif dx > 0:
        px[1][last] = px[cell - 2][last] = visor
    else:
        px[1][1] = visor
    return px

def fixture(colours: tuple, phase: int, seed: int = 0, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[1][1] = px[cell - 2][cell - 2] = colours[(phase + seed) % len(colours)]
    return px


FLOOR = 4
WALL = 13
WALL_EDGE = 4
FLOOR_GRIT = 3
PLATE_OPEN = 1
PLATE_HELD = 10
PLAYER = 9
PLAYER_MARK = 0
PLAYER_IDLE = 3
GUARD = 8
GUARD_MARK = 0
HAZARD = 8
HAZARD_MARK = 0
GRIT_COLOURS = (FLOOR_GRIT, WALL)
PAIR_COLOURS = (7, 0, 1, 15, 9)

DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))

LEVELS_SPEC = [
    {"pairs": [((1, 4), (6, 6))], "rows": [
        "........",
        ".=......",
        "A.......",
        "B.###...",
        ".=###...",
        "..###...",
        "......=.",
        "..W.....",
    ]},
    {"pairs": [((1, 1), (6, 6))], "rows": [
        "........",
        ".=......",
        ".####...",
        "A..W#...",
        "B...#...",
        "..###...",
        "..=...=.",
        "........",
    ]},
    {"pairs": [((1, 0), (6, 6)), ((6, 0), (1, 6))], "rows": [
        ".=....=.",
        "W.####..",
        "..#..#..",
        "A.#..#..",
        "B.#..#..",
        "..####..",
        ".=....=.",
        "........",
    ]},
    {"pairs": [((5, 1), (2, 5)), ((2, 6), (6, 6)), ((0, 6), (5, 2))], "rows": [
        "........",
        ".....=..",
        ".....^..",
        "A##.###W",
        "B##.###.",
        "..=.....",
        "..=...=.",
        "........",
    ]},
    {"pairs": [((2, 0), (2, 6)), ((5, 0), (5, 7)), ((0, 0), (7, 4))], "rows": [
        "..=..=..",
        "........",
        ".#####..",
        "A....#..",
        "B....#W.",
        ".####...",
        "..=.....",
        ".....=..",
    ]},
    {"pairs": [((1, 1), (2, 6)), ((5, 1), (5, 6)), ((0, 7), (7, 0))], "rows": [
        "....W...",
        ".=...=..",
        ".#....#.",
        ".A#..#..",
        ".B#..#..",
        ".#....#.",
        "..=..=..",
        "........",
    ]},
    {"pairs": [((1, 1), (6, 5)), ((6, 1), (3, 6)), ((1, 5), (5, 2))], "rows": [
        "........",
        ".=....=.",
        "..##.^W.",
        "A.##....",
        "B.##....",
        "......=.",
        "...=....",
        "........",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 5
PAD = (64-N*CELL)//2


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


def occupies(twins, cell):
    t = twins.get(cell)
    return (cell,) if t is None else (cell, t)


def rep(twins, cell):
    return min(occupies(twins, cell))


def is_wall(rows, cell):
    x, y = cell
    return not (0 <= x < N and 0 <= y < N) or rows[y][x] == "#"


def tile_blocked(rows, twins, cell):
    if is_wall(rows, cell):
        return True
    return any(is_wall(rows, c) for c in occupies(twins, cell))


def is_spiked(rows, twins, cell):
    return any(rows[c[1]][c[0]] == "^" for c in occupies(twins, cell))


def open_cells(rows, twins):
    return tuple((x, y) for y in range(N) for x in range(N)
                 if not tile_blocked(rows, twins, (x, y)))


def class_dist(rows, twins, *, avoid_spikes=False):
    nodes = {}
    for c in open_cells(rows, twins):
        if avoid_spikes and is_spiked(rows, twins, c):
            continue
        nodes.setdefault(rep(twins, c), set())
    adj = {r: set() for r in nodes}
    for c in open_cells(rows, twins):
        r = rep(twins, c)
        if r not in adj:
            continue
        for a in occupies(twins, c):
            for dx, dy in DIRS:
                n = (a[0] + dx, a[1] + dy)
                if tile_blocked(rows, twins, n):
                    continue
                nr = rep(twins, n)
                if nr in adj and nr != r:
                    adj[r].add(nr)
    out = {}
    for src in adj:
        seen = {src: 0}
        frontier = [src]
        d = 0
        while frontier:
            d += 1
            nxt = []
            for cur in frontier:
                for n in adj[cur]:
                    if n not in seen:
                        seen[n] = d
                        nxt.append(n)
            frontier = nxt
        out[src] = seen
    return out


def sills(rows):
    return find_all(rows, "=")


def held_sills(rows, twins, keepers):
    resting = set()
    for k in keepers:
        resting.update(occupies(twins, k))
    return {s for s in sills(rows) if s in resting}


def warder_target(rows, twins, dist, keepers, warder):
    held = held_sills(rows, twins, keepers)
    here = dist.get(rep(twins, warder), {})
    best, pick = None, None
    for i, s in enumerate(sills(rows)):
        if s in held:
            continue
        sr = rep(twins, s)
        near = min((dist.get(rep(twins, k), {}).get(sr, 10 ** 6) for k in keepers),
                   default=10 ** 6)
        if near >= 10 ** 6:
            continue
        key = (near, here.get(sr, 10 ** 6), i)
        if best is None or key < best:
            best, pick = key, s
    return pick


def warder_step(rows, twins, dist, keepers, warder):
    target = warder_target(rows, twins, dist, keepers, warder)
    if target is None:
        return warder
    goal = rep(twins, target)
    bodies = set()
    for k in keepers:
        bodies.update(occupies(twins, k))
    here = dist.get(rep(twins, warder), {}).get(goal, 10 ** 6)
    best, pick = here, warder
    for dx, dy in DIRS:
        n = (warder[0] + dx, warder[1] + dy)
        if tile_blocked(rows, twins, n) or is_spiked(rows, twins, n):
            continue
        if any(c in bodies for c in occupies(twins, n)):
            continue
        d = dist.get(rep(twins, n), {}).get(goal, 10 ** 6)
        if d < best:
            best, pick = d, n
    return pick


def start_state(rows):
    return ((find_char(rows, "A"), find_char(rows, "B")), 0, find_char(rows, "W"))


ORDERS = (("name", 0), ("name", 1)) + tuple(("walk", d) for d in DIRS)


def advance(rows, twins, dist, state, order):
    keepers, sel, warder = state
    keepers = list(keepers)
    kind, arg = order
    if kind == "name":
        sel = arg
    else:
        cur = keepers[sel]
        dest = (cur[0] + arg[0], cur[1] + arg[1])
        others = set()
        for i, k in enumerate(keepers):
            if i != sel:
                others.update(occupies(twins, k))
        blocked = (tile_blocked(rows, twins, dest)
                   or any(c in others for c in occupies(twins, dest))
                   or any(c in occupies(twins, warder) for c in occupies(twins, dest)))
        if not blocked:
            keepers[sel] = dest
    keepers = tuple(keepers)
    if any(is_spiked(rows, twins, k) for k in keepers):
        return (keepers, sel, warder), "spiked"
    warder = warder_step(rows, twins, dist, keepers, warder)
    st = (keepers, sel, warder)
    held = held_sills(rows, twins, keepers)
    if any(s in occupies(twins, warder) for s in sills(rows) if s not in held):
        return st, "sealed"
    return st, ""


def solved(rows, twins, state):
    return held_sills(rows, twins, state[0]) == set(sills(rows))


FACE = CELL - 1


def _stamp(frame, cell, face):
    x, y = cell
    for j, row in enumerate(face):
        for i, v in enumerate(row):
            if v >= 0:
                frame[PAD+y * CELL + 1 + j, PAD+x * CELL + 1 + i] = v


def _wall_face(x, y):
    px = block(WALL, CELL)
    half = CELL // 2
    for band in (0, 1):
        for j in range(band * half, band * half + half):
            px[j][(x * CELL + (y * 2 + band) * (half // 2)) % CELL] = WALL_EDGE
        px[band * half + half - 1] = [WALL_EDGE] * CELL
    return px


def _spike_face():
    px = block(HAZARD, FACE)
    for k in range(FACE):
        px[k][k] = px[k][FACE-1-k] = HAZARD_MARK
    return px


def _sill_socket(held):
    px = ring(PLATE_HELD if held else PLATE_OPEN, FACE)
    px[0][0] = -1
    for i in range(2, FACE - 2):
        px[0][i] = -1
    return px


def _sill_studs(held):
    c = PLATE_HELD if held else PLATE_OPEN
    px = [[-1] * FACE for _ in range(FACE)]
    for (j, i) in ((0, FACE - 1), (FACE - 1, 0), (FACE - 1, FACE - 1)):
        px[j][i] = c
    px[1][1] = c
    return px


def _keeper_face(listening, mark):
    px = figure(PLAYER, None, FACE)
    px[0][0] = -1
    mid = FACE // 2
    px[mid][mid] = mark if mark is not None else (
        PLAYER_MARK if listening else PLAYER_IDLE)
    px[mid - 1][mid - 1] = px[mid - 1][mid + 1] = PLAYER_MARK if listening else PLAYER
    return px


def _warder_face(heading):
    px = facing(GUARD, GUARD_MARK, heading, FACE)
    px[0][0] = -1
    return px


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for y in range(N):
            for x in range(N):
                if rows[y][x] != "#":
                    continue
                sprites.append(Sprite(
                    pixels=_wall_face(x, y), name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0, collidable=False,
                ).set_position(x * CELL, y * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


def _grit_cells(spec, seed):
    rows = spec["rows"]
    taken = {tuple(c) for pair in spec["pairs"] for c in pair}
    hits = [(x, y)
            for y in range(N) for x in range(N)
            if rows[y][x] == "." and (x, y) not in taken
            and (x * 7 + y * 11 + seed * 5) % 9 == 0]
    return tuple(hits[::max(1, len(hits) // 6)])[:6]


GRIT = tuple(_grit_cells(s, i) for i, s in enumerate(LEVELS_SPEC))


class Overlay(RenderableUserDisplay):

    def __init__(self, game: "Quotient") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game
        rows = g.rows
        held = held_sills(rows, g.twins, g.keepers)
        pair_of = {}
        for i, (a, b) in enumerate(g.spec["pairs"]):
            for c in (tuple(a), tuple(b)):
                pair_of[c] = PAIR_COLOURS[i % len(PAIR_COLOURS)]

        frame[PAD-2:PAD, PAD-2:64-PAD+2] = 1
        frame[64-PAD:64-PAD+2, PAD-2:64-PAD+2] = 3
        frame[PAD:64-PAD, PAD-2:PAD] = 1
        frame[PAD:64-PAD, 64-PAD:64-PAD+2] = 3
        for y in range(N):
            for x in range(N):
                if rows[y][x] != '#':
                    frame[PAD+y*CELL+CELL-1, PAD+x*CELL:PAD+(x+1)*CELL] = 3
                    frame[PAD+y*CELL:PAD+(y+1)*CELL, PAD+x*CELL+CELL-1] = 3
        target = warder_target(rows, g.twins, g.dist, g.keepers, g.warder)
        if target is not None:
            for tx,ty in occupies(g.twins,target):
                for dx,dy in ((1,1),(CELL-1,1),(1,CELL-1),(CELL-1,CELL-1)):
                    frame[PAD+ty*CELL+dy,PAD+tx*CELL+dx] = 12

        for cell in open_cells(rows, g.twins):
            if not is_spiked(rows, g.twins, cell):
                continue
            _stamp(frame, cell, _spike_face())

        for s in sills(rows):
            _stamp(frame, s, _sill_socket(s in held))

        for i, k in enumerate(g.keepers):
            if g.dying and i == g.dying_who and g.dying % 2:
                body = rounded(HAZARD, FACE)
                body[FACE // 2][FACE // 2] = PLAYER
                body[0][0] = -1
            else:
                body = _keeper_face(i == g.sel, pair_of.get(k))
            _stamp(frame, k, body)

        if not (g.sealing and g.sealing % 2 == 0):
            _stamp(frame, g.warder, _warder_face(g.heading))

        for s in sills(rows):
            _stamp(frame, s, _sill_studs(s in held))

        for cell, colour in pair_of.items():
            x, y = cell
            frame[PAD+y * CELL, PAD+x * CELL:PAD+(x + 1) * CELL] = colour
            frame[PAD+y * CELL:PAD+(y + 1) * CELL, PAD+x * CELL] = colour

        if target is not None:
            for tx,ty in occupies(g.twins,target):
                frame[PAD+ty*CELL+CELL-1,PAD+tx*CELL+CELL-1]=12
        if g.sealing:
            for cell in occupies(g.twins,g.warder):
                _stamp(frame,cell,_spike_face())
        if g.winning and g.winning % 2 == 0:
            for cell in pair_of:
                _stamp(frame, cell, block(PLATE_HELD, FACE))
        return frame


class Quotient(ARCBaseGame):

    DYING_FRAMES = 6
    SEALING_FRAMES = 6
    WINNING_FRAMES = 4

    def __init__(self) -> None:
        self.keepers = ()
        self.sel = 0
        self.warder = (0, 0)
        self.twins = {}
        self.dist = {}
        self.tick = 0
        self.dying = 0
        self.dying_who = 0
        self.sealing = 0
        self.winning = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[Overlay(self)],
        )
        super().__init__(game_id="g136", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5, 7])
        self.on_set_level(self.current_level)

    @property
    def spec(self):
        return LEVELS_SPEC[self.level_index]

    @property
    def rows(self):
        return self.spec["rows"]

    @property
    def state(self):
        return (self.keepers, self.sel, self.warder)

    @property
    def heading(self):
        nxt = warder_step(self.rows, self.twins, self.dist, self.keepers, self.warder)
        return (nxt[0] - self.warder[0], nxt[1] - self.warder[1])

    def on_set_level(self, level: Level) -> None:
        self.twins = twin_map(self.spec["pairs"])
        self.dist = class_dist(self.rows, self.twins, avoid_spikes=True)
        self.keepers, self.sel, self.warder = start_state(self.rows)
        self.dying = 0
        self.sealing = 0
        self.winning = 0

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.tick = 0
        self.on_set_level(self.current_level)

    def step(self) -> None:
        self.tick += 1
        for name in ("dying", "sealing"):
            if getattr(self, name):
                setattr(self, name, getattr(self, name) - 1)
                if getattr(self, name) == 0:
                    self.level_reset()
                    self.complete_action()
                return
        if self.winning:
            self.winning -= 1
            if self.winning == 0:
                self.next_level()
                self.complete_action()
            return

        order = {GameAction.ACTION5: ("name", 0), GameAction.ACTION7: ("name", 1),
                 GameAction.ACTION1: ("walk", (0, -1)),
                 GameAction.ACTION2: ("walk", (0, 1)),
                 GameAction.ACTION3: ("walk", (-1, 0)),
                 GameAction.ACTION4: ("walk", (1, 0))}.get(self.action.id)
        if order is not None:
            state, outcome = advance(self.rows, self.twins, self.dist, self.state, order)
            self.keepers, self.sel, self.warder = state
            if outcome == "spiked":
                self.dying_who = next(
                    i for i, k in enumerate(self.keepers)
                    if is_spiked(self.rows, self.twins, k))
                self.dying = self.DYING_FRAMES
                return
            if outcome == "sealed":
                self.sealing = self.SEALING_FRAMES
                return
            if solved(self.rows, self.twins, state):
                self.winning = self.WINNING_FRAMES
                return
        self.complete_action()
