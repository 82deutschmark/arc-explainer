# ARC-AGI-3 candidate task g044.

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

VOID = 5
FLOOR = 0
WALL = 4
KEY = 12
EXIT = 14
PLAYER = 13

N = 16
S = 4
CELL = 4

DIRS = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
}


def _neg(v):
    return (-v[0], -v[1], -v[2])


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _scale(v, k):
    return (v[0] * k, v[1] * k, v[2] * k)


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def net_slots(rows: list[str]) -> list[tuple[int, int]]:
    out = []
    for fy in range(N // S):
        for fx in range(N // S):
            if any(rows[fy * S + j][fx * S + i] != " " for j in range(S) for i in range(S)):
                out.append((fx, fy))
    return out


def fold_faces(rows: list[str]) -> list[tuple[tuple[int, int], tuple, tuple, tuple]]:
    slots = set(net_slots(rows))
    start = sorted(slots, key=lambda s: (s[1], s[0]))[0]
    frames = {start: ((0, 0, 1), (1, 0, 0), (0, 1, 0))}
    stack = [start]
    while stack:
        slot = stack.pop()
        n, r, d = frames[slot]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nxt = (slot[0] + dx, slot[1] + dy)
            if nxt not in slots or nxt in frames:
                continue
            if dx == 1:
                frames[nxt] = (r, _neg(n), d)
            elif dx == -1:
                frames[nxt] = (_neg(r), n, d)
            elif dy == 1:
                frames[nxt] = (d, r, _neg(n))
            else:
                frames[nxt] = (_neg(d), r, n)
            stack.append(nxt)
    order = sorted(frames, key=lambda s: (s[1], s[0]))
    return [(s, frames[s][0], frames[s][1], frames[s][2]) for s in order]


def step_cell(faces, fi: int, u: int, v: int, du: int, dv: int):
    nu, nv = u + du, v + dv
    if 0 <= nu < S and 0 <= nv < S:
        return fi, nu, nv, du, dv
    _, n, r, d = faces[fi]
    if nu >= S:
        e = r
    elif nu < 0:
        e = _neg(r)
    elif nv >= S:
        e = d
    else:
        e = _neg(d)
    p = _add(_scale(n, S), _add(_scale(r, 2 * u - (S - 1)), _scale(d, 2 * v - (S - 1))))
    q = _add(_sub(p, n), e)
    ni = next(i for i, f in enumerate(faces) if f[1] == e)
    _, _, r2, d2 = faces[ni]
    heading = _neg(n)
    return (ni, (_dot(q, r2) + (S - 1)) // 2, (_dot(q, d2) + (S - 1)) // 2,
            _dot(heading, r2), _dot(heading, d2))


LIPS = {">": (1, 0), "<": (-1, 0), "v": (0, 1), "^": (0, -1)}


def attempt(rows: list[str], faces, fi: int, u: int, v: int, du: int, dv: int):
    nf, nu, nv, ndu, ndv = step_cell(faces, fi, u, v, du, dv)
    char = cell_char(rows, faces, nf, nu, nv)
    if char == "#":
        return None
    if char in LIPS and LIPS[char] != (ndu, ndv):
        return None
    return nf, nu, nv, char


def cell_char(rows: list[str], faces, fi: int, u: int, v: int) -> str:
    sx, sy = faces[fi][0]
    return rows[sy * S + v][sx * S + u]


def cell_screen(faces, fi: int, u: int, v: int) -> tuple[int, int]:
    sx, sy = faces[fi][0]
    return sx * S + u, sy * S + v


def find_chars(rows, faces, want: str) -> list[tuple[int, int, int]]:
    return [(fi, u, v) for fi in range(len(faces)) for u in range(S) for v in range(S)
            if cell_char(rows, faces, fi, u, v) == want]


LEVELS_SPEC = [
    {"rows": [
        "    .k..        ",
        "    ....        ",
        "    ....        ",
        "    ....        ",
        ".....P..........",
        ".k........k..k..",
        ".....k..........",
        "....####........",
        "    ....        ",
        "    .k..        ",
        "    ..X.        ",
        "    ....        ",
        "                ",
        "                ",
        "                ",
        "                ",
    ]},
    {"rows": [
        ".P......        ",
        "......k.        ",
        ".k..####        ",
        "........        ",
        "    ....#.>.    ",
        "    .k....k.    ",
        "    ........    ",
        "    ..#.....    ",
        "        ####....",
        "        .k....kv",
        "        .....X..",
        "        ........",
        "                ",
        "                ",
        "                ",
        "                ",
    ]},
    {"rows": [
        ".P..            ",
        "....            ",
        "..k.            ",
        "....            ",
        "#..#....        ",
        ".k....k.        ",
        ".......#        ",
        "........        ",
        "    #.....>.    ",
        "    .k....kv    ",
        "    ......##    ",
        "    ........    ",
        "        ....    ",
        "        .k..    ",
        "        ..X.    ",
        "        ....    ",
    ]},
    {"rows": [
        "        .k..    ",
        "        ....    ",
        "        ####    ",
        "        ....    ",
        ".P......####....",
        "####.k....k.vk..",
        ".k....#........^",
        "................",
        "####            ",
        "..k.            ",
        ".X..            ",
        "....            ",
        "                ",
        "                ",
        "                ",
        "                ",
    ]},
    {"rows": [
        "        .P......",
        "        .^....k.",
        "        .k....#.",
        "        .....>.v",
        "    ....####    ",
        "    .k....k.    ",
        "    #.......    ",
        "    .....>..    ",
        ".X......        ",
        "......k.        ",
        ".k..####        ",
        "........        ",
        "                ",
        "                ",
        "                ",
        "                ",
    ]},
    {"rows": [
        ".k..            ",
        "....            ",
        "####            ",
        "....            ",
        ".P....#.....vk.>",
        ".....k#.#k..####",
        ".k....#.........",
        ".....^..........",
        "            ....",
        "            ..kv",
        "            .X..",
        "            ...v",
        "                ",
        "                ",
        "                ",
        "                ",
    ]},
    {"rows": [
        "    #k#.        ",
        "    .>..        ",
        "    ####        ",
        "    ....        ",
        "...#.P#......#..",
        ".k.#.>#...k^.kv.",
        "..##.k#.#...>#..",
        "....########....",
        "    ####        ",
        "    .k..        ",
        "    ..X.        ",
        "    ....        ",
        "                ",
        "                ",
        "                ",
        "                ",
    ]},
    {"rows": [
        "    vk..        ",
        "    ####        ",
        "    ....        ",
        "    .vv.        ",
        "..#<vP..####    ",
        ".k..#####k..    ",
        "..#.<k...^..    ",
        "########....    ",
        "    ####        ",
        "    .k..        ",
        "    ####        ",
        "    ....        ",
        "    ....        ",
        "    ..k.        ",
        "    .X..        ",
        "    ....        ",
    ]},
]


def _block(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _rounded(colour: int) -> list[list[int]]:
    block = _block(colour)
    for (y, x) in ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1)):
        block[y][x] = -1
    return block


def _walker(colour: int) -> list[list[int]]:
    block = _rounded(colour)
    block[0][1] = block[0][2] = -1
    return block


def _lip(direction: tuple[int, int]) -> list[list[int]]:
    block = [[-1] * CELL for _ in range(CELL)]
    du, dv = direction
    for i in range(CELL):
        if du != 1:
            block[i][0] = WALL
        if du != -1:
            block[i][CELL - 1] = WALL
        if dv != 1:
            block[0][i] = WALL
        if dv != -1:
            block[CELL - 1][i] = WALL
    return block


def _face_block() -> list[list[int]]:
    return [[FLOOR] * (S * CELL) for _ in range(S * CELL)]


def _exit_ring() -> list[list[int]]:
    block = _block(EXIT)
    for j in range(1, CELL - 1):
        for i in range(1, CELL - 1):
            block[j][i] = -1
    return block


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for fx, fy in net_slots(rows):
            sprites.append(Sprite(
                pixels=_face_block(), name=f"face_{fx}_{fy}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.TANGIBLE, layer=-2,
            ).set_position(fx * S * CELL, fy * S * CELL))
        for y, row in enumerate(rows):
            for x, char in enumerate(row):
                if char in " .P":
                    continue
                if char == "#":
                    pixels, layer, name = _block(WALL), -1, f"w_{x}_{y}"
                elif char in LIPS:
                    pixels, layer, name = _lip(LIPS[char]), -1, f"l_{x}_{y}"
                elif char == "k":
                    pixels, layer, name = _rounded(KEY), 0, f"k_{x}_{y}"
                else:
                    pixels, layer, name = _exit_ring(), 0, "exit"
                sprites.append(Sprite(
                    pixels=pixels, name=name,
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.TANGIBLE, layer=layer,
                ).set_position(x * CELL, y * CELL))
        sprites.append(Sprite(
            pixels=_walker(PLAYER), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(0, 0))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G044(ARCBaseGame):

    def __init__(self) -> None:
        self.faces = fold_faces(LEVELS_SPEC[0]["rows"])
        self.face = self.u = self.v = 0
        self.keys_left: set[tuple[int, int, int]] = set()
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=VOID, letter_box=5,
        )
        super().__init__(game_id="g044", levels=build_levels(), camera=camera)

    @property
    def rows(self) -> list[str]:
        return LEVELS_SPEC[self.level_index]["rows"]

    def on_set_level(self, level: Level) -> None:
        rows = self.rows
        self.faces = fold_faces(rows)
        self.face, self.u, self.v = find_chars(rows, self.faces, "P")[0]
        self.keys_left = set(find_chars(rows, self.faces, "k"))
        self._sync()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _sync(self) -> None:
        player = self.current_level.get_sprites_by_name("player")
        if player:
            sx, sy = cell_screen(self.faces, self.face, self.u, self.v)
            player[0].set_position(sx * CELL, sy * CELL)
        exits = self.current_level.get_sprites_by_name("exit")
        if exits:
            fill = EXIT if not self.keys_left else FLOOR
            exits[0].pixels[1:CELL - 1, 1:CELL - 1] = fill

    def step(self) -> None:
        d = DIRS.get(self.action.id)
        if d is None:
            self.complete_action()
            return

        landed = attempt(self.rows, self.faces, self.face, self.u, self.v, d[0], d[1])
        if landed is not None:
            nf, nu, nv, char = landed
            if char == "X":
                if not self.keys_left:
                    self.next_level()
                    self.complete_action()
                    return
            else:
                self.face, self.u, self.v = nf, nu, nv
                if (nf, nu, nv) in self.keys_left:
                    self.keys_left.discard((nf, nu, nv))
                    sx, sy = cell_screen(self.faces, nf, nu, nv)
                    for sprite in self.current_level.get_sprites_by_name(f"k_{sx}_{sy}"):
                        self.current_level.remove_sprite(sprite)

        self._sync()
        self.complete_action()
