# ARC-AGI-3 candidate task g043.

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

BACKGROUND = 5
WALL = 5
FLOOR = 2
CRATE = 7
CRATE_SEATED = 15
PLATE = 15
GATE = 15
EXIT = 12
OX_COLOR = 10
MOTE_COLOR = 11
MOUTH_A_COLOR = 8
MOUTH_B_COLOR = 6
PORTAL_COLOURS = {"a": MOUTH_A_COLOR, "b": MOUTH_B_COLOR}

CELL = 8
N = 8

WEST = (-1, 0)
EAST = (1, 0)
BASE = (0, 1)
DIRS = {
    GameAction.ACTION3: WEST,
    GameAction.ACTION4: EAST,
    GameAction.ACTION1: BASE,
}
SWAP = GameAction.ACTION5
OX, MOTE = 0, 1


def points_up(cell: tuple[int, int]) -> bool:
    return (cell[0] + cell[1]) % 2 == 0


def base_of(cell: tuple[int, int]) -> tuple[int, int]:
    x, y = cell
    return (x, y + 1) if points_up(cell) else (x, y - 1)


def neighbour(cell: tuple[int, int], d: tuple[int, int]) -> tuple[int, int]:
    if d == BASE:
        return base_of(cell)
    return (cell[0] + d[0], cell[1] + d[1])


def on_board(cell: tuple[int, int]) -> bool:
    return 0 <= cell[0] < N and 0 <= cell[1] < N


LEVELS_SPEC = [
    {"rows": [
        "..O.o.=X",
        ".M.a....",
        "........",
        "..#..#..",
        "########",
        "_a......",
        "...##...",
        "........",
    ]},
    {"rows": [
        "..O..o..",
        ".M...a..",
        "=......#",
        "X#......",
        "########",
        "......a_",
        "..##....",
        "........",
    ]},
    {"rows": [
        "..O.o.=X",
        ".M.o.o..",
        "....a...",
        "########",
        "#_.a.._.",
        "..#..#..",
        "........",
        "........",
    ]},
    {"rows": [
        "..o.o.=X",
        ".M......",
        ".O.a.b..",
        "########",
        "#a...b__",
        "..#..#..",
        "........",
        "........",
    ]},
    {"rows": [
        "..O...=X",
        ".Moo....",
        "...a....",
        "..#..#..",
        "########",
        ".a...._.",
        "...##...",
        "........",
    ]},
    {"rows": [
        "..=X#...",
        ".M..#...",
        ".O..#...",
        "o...#...",
        "..o.#...",
        ".oa.#a._",
        "....#...",
        "...b#b._",
    ]},
    {"rows": [
        "..o.o.o.",
        ".M..b..=",
        ".O.a..#X",
        "########",
        "........",
        "_a...b__",
        "..##..#.",
        "........",
    ]},
]


class G043A:

    __slots__ = ("walls", "plates", "gates", "exits", "portals", "starts", "crates")

    def __init__(self, rows: list[str]) -> None:
        self.walls: set[tuple[int, int]] = set()
        self.plates: set[tuple[int, int]] = set()
        self.gates: set[tuple[int, int]] = set()
        self.exits: set[tuple[int, int]] = set()
        self.portals: dict[tuple[int, int], tuple[int, int]] = {}
        self.crates: frozenset[tuple[int, int]] = frozenset()
        self.starts: tuple[tuple[int, int], tuple[int, int]] = ((0, 0), (0, 0))
        groups: dict[str, list[tuple[int, int]]] = {}
        crates: set[tuple[int, int]] = set()
        ox = mote = None
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == "#":
                    self.walls.add((x, y))
                elif ch == "_":
                    self.plates.add((x, y))
                elif ch == "=":
                    self.gates.add((x, y))
                elif ch == "X":
                    self.exits.add((x, y))
                elif ch == "O":
                    ox = (x, y)
                elif ch == "M":
                    mote = (x, y)
                elif ch == "o":
                    crates.add((x, y))
                elif ch in PORTAL_COLOURS:
                    groups.setdefault(ch, []).append((x, y))
        if ox is None or mote is None:
            raise ValueError("every level needs one O and one M")
        self.starts = (ox, mote)
        self.crates = frozenset(crates)
        for letter, cells in groups.items():
            if len(cells) != 2:
                raise ValueError(f"portal '{letter}' needs exactly 2 mouths, got {len(cells)}")
            self.portals[cells[0]] = cells[1]
            self.portals[cells[1]] = cells[0]


def parse_level(rows: list[str]) -> G043A:
    if len(rows) != N or any(len(r) != N for r in rows):
        raise ValueError("every level must be a square grid of side N")
    return G043A(rows)


def plates_held(st: G043A, crates: frozenset) -> bool:
    return st.plates <= crates


def _crate_blocked(st: G043A, cell: tuple[int, int], others: frozenset,
                   bodies: tuple) -> bool:
    if not on_board(cell):
        return True
    return (cell in st.walls or cell in st.gates or cell in st.exits
            or cell in others or cell in bodies)


def push_crate(st: G043A, crates: frozenset, src: tuple[int, int],
               d: tuple[int, int], bodies: tuple) -> frozenset | None:
    others = crates - {src}
    dest = neighbour(src, d)
    if _crate_blocked(st, dest, others, bodies):
        return None
    if dest not in st.portals:
        return others | {dest}

    out = st.portals[dest]
    if _crate_blocked(st, out, others, bodies):
        return None
    pos = out
    seen = {pos}
    while True:
        nxt = neighbour(pos, d)
        if _crate_blocked(st, nxt, others, bodies):
            break
        if nxt in st.portals:
            hop = st.portals[nxt]
            if _crate_blocked(st, hop, others, bodies) or hop in seen:
                break
            seen.add(hop)
            pos = hop
            continue
        if nxt in seen:
            break
        seen.add(nxt)
        pos = nxt
    return others | {pos}


def apply_move(st: G043A, active: int, ox: tuple[int, int], mote: tuple[int, int],
               crates: frozenset, d: tuple[int, int]):
    me = ox if active == OX else mote
    other = mote if active == OX else ox
    tgt = neighbour(me, d)
    if not on_board(tgt) or tgt in st.walls or tgt == other:
        return active, ox, mote, crates, False

    if tgt in st.gates:
        if active != MOTE or not plates_held(st, crates):
            return active, ox, mote, crates, False
        return active, ox, tgt, crates, False

    if tgt in crates:
        if active == OX:
            if d == BASE:
                return active, ox, mote, crates, False
            moved = push_crate(st, crates, tgt, d, (other,))
            if moved is None:
                return active, ox, mote, crates, False
            return active, tgt, mote, moved, False
        if d != BASE:
            return active, ox, mote, crates, False
        return active, ox, tgt, (crates - {tgt}) | {me}, False

    if tgt in st.exits:
        if active != MOTE:
            return active, ox, mote, crates, False
        return active, ox, tgt, crates, True

    if active == OX:
        return active, tgt, mote, crates, False
    return active, ox, tgt, crates, False


def _tri_rows(up: bool) -> list[tuple[int, int]]:
    spans = [(3 - r // 2, 4 + r // 2) for r in range(CELL)]
    return spans if up else spans[::-1]


def _blank() -> list[list[int]]:
    return [[-1] * CELL for _ in range(CELL)]


def _tile(colour: int, up: bool) -> list[list[int]]:
    block = _blank()
    spans = _tri_rows(up)
    for r, (lo, hi) in enumerate(spans):
        if r == (CELL - 1 if up else 0):
            continue
        for c in range(lo, hi + 1):
            block[r][c] = colour
    return block


def _shrink(block: list[list[int]], colour: int) -> list[list[int]]:
    out = _blank()
    for r in range(CELL):
        for c in range(CELL):
            if block[r][c] < 0:
                continue
            if all(0 <= a < CELL and 0 <= b < CELL and block[a][b] >= 0
                   for a, b in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1))):
                out[r][c] = colour
    return out


def _rim(block: list[list[int]]) -> list[list[int]]:
    inner = _shrink(block, 0)
    return [[-1 if inner[r][c] >= 0 else block[r][c] for c in range(CELL)]
            for r in range(CELL)]


def _over(base: list[list[int]], top: list[list[int]]) -> list[list[int]]:
    return [[top[r][c] if top[r][c] >= 0 else base[r][c] for c in range(CELL)]
            for r in range(CELL)]


def _solid(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _pip(up: bool, colour: int) -> list[list[int]]:
    return _shrink(_tile(FLOOR, up), colour)


def _mouth(up: bool, colour: int) -> list[list[int]]:
    return _rim(_shrink(_tile(FLOOR, up), colour))


def _barred(up: bool) -> list[list[int]]:
    block = _tile(GATE, up)
    for r in (2, 5):
        for c in range(CELL):
            if block[r][c] >= 0:
                block[r][c] = FLOOR
    return block


def _cargo(shell: int) -> list[list[int]]:
    block = _blank()
    for r in range(2, 6):
        for c in range(2, 6):
            block[r][c] = shell
    for r in range(3, 5):
        for c in range(3, 5):
            block[r][c] = BACKGROUND
    return block


def _ox(up: bool, active: bool) -> list[list[int]]:
    block = _shrink(_tile(FLOOR, up), OX_COLOR)
    return block if active else _rim(block)


def _mote(up: bool, active: bool) -> list[list[int]]:
    block = _blank()
    top = 2 if up else 3
    for r, cols in ((top, (3, 4)), (top + 1, (2, 3, 4, 5)),
                    (top + 2, (2, 3, 4, 5)), (top + 3, (3, 4))):
        for c in cols:
            block[r][c] = MOTE_COLOR
    return block if active else _rim(block)


def _static_sprite(pixels, name, layer, tags=()) -> Sprite:
    return Sprite(
        pixels=pixels, name=name, blocking=BlockingMode.BOUNDING_BOX,
        interaction=InteractionMode.TANGIBLE, layer=layer, tags=list(tags),
    )


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        st = parse_level(spec["rows"])
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                cell = (x, y)
                up = points_up(cell)
                if ch == "#":
                    art = _solid(WALL)
                elif ch == "_":
                    art = _over(_tile(FLOOR, up), _pip(up, PLATE))
                elif ch in PORTAL_COLOURS:
                    art = _over(_tile(FLOOR, up), _mouth(up, PORTAL_COLOURS[ch]))
                elif ch == "X":
                    art = _tile(EXIT, up)
                else:
                    art = _tile(FLOOR, up)
                sprites.append(_static_sprite(art, f"t_{x}_{y}", -1)
                               .set_position(x * CELL, y * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G043(ARCBaseGame):

    def __init__(self) -> None:
        self._statics = [parse_level(spec["rows"]) for spec in LEVELS_SPEC]
        self._st = self._statics[0]
        self._active = OX
        self._ox, self._mote = self._st.starts
        self._crates = self._st.crates
        camera = Camera(width=N * CELL, height=N * CELL, background=BACKGROUND,
                        letter_box=5)
        super().__init__(game_id="g043", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self._st = self._statics[self.level_index]
        self._active = OX
        self._ox, self._mote = self._st.starts
        self._crates = self._st.crates
        self._sync()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _sync(self) -> None:
        level = self.current_level
        for sprite in list(level.get_sprites_by_tag("dyn")):
            level.remove_sprite(sprite)
        if not plates_held(self._st, self._crates):
            for (x, y) in sorted(self._st.gates):
                level.add_sprite(
                    _static_sprite(_barred(points_up((x, y))), f"gate_{x}_{y}", 0,
                                   ["dyn", "gate"])
                    .set_position(x * CELL, y * CELL))
        for (x, y) in sorted(self._crates):
            shell = CRATE_SEATED if (x, y) in self._st.plates else CRATE
            level.add_sprite(
                _static_sprite(_cargo(shell), f"crate_{x}_{y}", 1, ["dyn", "crate"])
                .set_position(x * CELL, y * CELL))
        for who, cell, art in ((OX, self._ox, _ox), (MOTE, self._mote, _mote)):
            level.add_sprite(
                _static_sprite(art(points_up(cell), self._active == who),
                               "ox" if who == OX else "mote", 2, ["dyn"])
                .set_position(cell[0] * CELL, cell[1] * CELL))

    def step(self) -> None:
        if self.action.id == SWAP:
            self._active = MOTE if self._active == OX else OX
            self._sync()
            self.complete_action()
            return
        d = DIRS.get(self.action.id)
        if d is not None:
            self._active, self._ox, self._mote, self._crates, reached = apply_move(
                self._st, self._active, self._ox, self._mote, self._crates, d)
            self._sync()
            if reached:
                self.next_level()
        self.complete_action()
