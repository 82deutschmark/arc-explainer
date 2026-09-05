# ARC-AGI-3 candidate task g136.

import numpy as np

from sprite_book import block, door, figure, fixture, ring, rounded

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

FLOOR = 5
WALL = 1
WALL_JOINT = 5
PLATE_UP = 1
PLATE_DOWN = 14
EXIT_FRAME = 14
EXIT_BAR = 1
CRATE = 7
PLAYER = 12
PLAYER_MARK = 1
SPIKE = 15
SPIKE_TIP = 1
DECOR_COLOURS = (WALL, PLATE_DOWN)
PAIR_COLOURS = (12, 15, 7, 14, 1)

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


def _stamp(frame, cell, face):
    x, y = cell
    for j, row in enumerate(face):
        for i, v in enumerate(row):
            if v >= 0:
                frame[y * CELL + 1 + j, x * CELL + 1 + i] = v


def _no_corner(face):
    face[0][0] = -1
    return face


def _wall_face(x, y):
    px = block(WALL)
    px[CELL - 1] = [WALL_JOINT] * CELL
    for j in range(CELL - 1):
        px[j][2 if (x + y) % 2 else 0] = WALL_JOINT
    return px


def _spike_face():
    px = _no_corner(rounded(SPIKE, 3))
    px[1][1] = SPIKE_TIP
    return px


def _crate_face():
    return _no_corner(block(CRATE, 3))


def _player_face(mark):
    px = _no_corner(figure(PLAYER, cell=3))
    px[2][0], px[2][1] = PLAYER, -1
    px[1][1] = PLAYER_MARK if mark == PLAYER else mark
    return px


def _exit_face(state):
    if state == "lintel":
        return [[-1, EXIT_FRAME, EXIT_FRAME], [-1] * 3, [-1] * 3]
    bar = {"shut": EXIT_BAR, "flare": EXIT_FRAME}.get(state)
    return _no_corner(door(EXIT_FRAME, bar, 3))


def _plate_socket(held):
    px = ring(PLATE_DOWN if held else PLATE_UP, 3)
    px[0][1] = -1
    return px


def _plate_studs(held):
    c = PLATE_DOWN if held else PLATE_UP
    px = [[-1] * 3 for _ in range(3)]
    px[0][0] = px[0][2] = px[2][0] = px[2][2] = c
    return px


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for y in range(N):
            for x in range(N):
                c = rows[y][x]
                if c == "#":
                    px = _wall_face(x, y)
                elif c == "^":
                    px = [[-1] * CELL for _ in range(CELL)]
                    for j, row in enumerate(_spike_face()):
                        for i, v in enumerate(row):
                            px[j + 1][i + 1] = v
                else:
                    continue
                sprites.append(Sprite(
                    pixels=px, name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0, collidable=False,
                ).set_position(x * CELL, y * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


def _decor_cells(spec, seed):
    rows = spec["rows"]
    taken = {tuple(c) for pair in spec["pairs"] for c in pair}
    hits = [(x, y)
            for y in range(N) for x in range(N)
            if rows[y][x] == "." and (x, y) not in taken
            and (x * 7 + y * 11 + seed * 5) % 13 == 0]
    return tuple(hits[::max(1, len(hits) // 5)])[:5]


DECOR = tuple(_decor_cells(s, i) for i, s in enumerate(LEVELS_SPEC))


class G136A(RenderableUserDisplay):

    def __init__(self, game: "G136") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game
        rows = g.rows
        plates = find_all(rows, "=")
        held = held_plates(rows, g.twins, g.player, g.crates)
        pair_of = {}
        for i, (a, b) in enumerate(g.spec["pairs"]):
            for c in (tuple(a), tuple(b)):
                pair_of[c] = PAIR_COLOURS[i % len(PAIR_COLOURS)]

        for i, cell in enumerate(DECOR[g.level_index]):
            _stamp(frame, cell, fixture(DECOR_COLOURS, g.tick // 2, i, cell=3))

        for p in plates:
            _stamp(frame, p, _plate_socket(p in held))

        ex = find_char(rows, "X")
        opened = len(held) == len(plates)
        state = "open" if opened else "shut"
        if g.winning and g.winning % 2 == 0:
            state = "flare"
        _stamp(frame, ex, _exit_face(state))

        for k in g.crates:
            for c in occupies(g.twins, k):
                _stamp(frame, c, _crate_face())

        if g.dying:
            body = _no_corner(rounded(SPIKE if g.dying % 2 else PLAYER, 3))
            body[1][1] = PLAYER if g.dying % 2 else SPIKE
        elif g.winning:
            body = _player_face(PLAYER_MARK)
            if g.winning % 2 == 0:
                body = [[EXIT_FRAME if v >= 0 else v for v in row] for row in body]
        else:
            body = _player_face(PLATE_DOWN if g.player in held
                                else pair_of.get(g.player, PLAYER_MARK))
        _stamp(frame, g.player, body)

        _stamp(frame, ex, _exit_face("lintel"))

        for p in plates:
            _stamp(frame, p, _plate_studs(p in held))

        for cell, colour in pair_of.items():
            x, y = cell
            frame[y * CELL, x * CELL:(x + 1) * CELL] = colour
            frame[y * CELL:(y + 1) * CELL, x * CELL] = colour
        return frame


class G136(ARCBaseGame):

    DYING_FRAMES = 6
    WINNING_FRAMES = 4

    def __init__(self) -> None:
        self.player = (0, 0)
        self.crates = ()
        self.twins = {}
        self.tick = 0
        self.dying = 0
        self.winning = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=FLOOR,
            interfaces=[G136A(self)],
        )
        super().__init__(game_id="g136", levels=build_levels(), camera=camera,
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
        self.dying = 0
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
        if self.dying:
            self.dying -= 1
            if self.dying == 0:
                self.level_reset()
                self.complete_action()
            return
        if self.winning:
            self.winning -= 1
            if self.winning == 0:
                self.next_level()
                self.complete_action()
            return

        d = {GameAction.ACTION1: (0, -1), GameAction.ACTION2: (0, 1),
             GameAction.ACTION3: (-1, 0), GameAction.ACTION4: (1, 0)}.get(self.action.id)
        if d is not None:
            self.player, self.crates, dead = step_player(
                self.rows, self.twins, self.player, self.crates, d)
            if dead:
                self.dying = self.DYING_FRAMES
                return
            if solved(self.rows, self.twins, self.player, self.crates):
                self.winning = self.WINNING_FRAMES
                return
        self.complete_action()
