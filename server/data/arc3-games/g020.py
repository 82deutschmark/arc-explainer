# ARC-AGI-3 candidate task g020.

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

SMOKE = 5
FLOOR = 1
WALL = 3
BORDER = 4
AVATAR = 7
GATE = 10
GLYPH_A = 14
GLYPH_B = 12
GLYPH_C = 15

BEATS = {0: 1, 1: 2, 2: 0}
GLYPH = (GLYPH_A, GLYPH_B, GLYPH_C)

FRAME = 64
W = 9
H = 10
CELL = 5
SHEAR = 2
OX = 0
OY = 7
PULSE_REACH = 2

HEX_DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0), (1, -1), (-1, 1))

ACTION_STEP = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
    GameAction.ACTION5: (1, -1),
    GameAction.ACTION7: (-1, 1),
}

OPEN_CHARS = ".ePX"
SEAL_CHARS = "ABC"
SEAL_TYPE = {"A": 0, "B": 1, "C": 2}
VOID = " "

LAMP_XY = ((48, 8), (2, 38), (2, 46))


def cell_px(q: int, r: int) -> tuple[int, int]:
    return OX + q * CELL + r * SHEAR, OY + r * CELL


def in_board(rows, q: int, r: int) -> bool:
    return 0 <= r < len(rows) and 0 <= q < len(rows[r]) and rows[r][q] != VOID


def passable(rows, dissolved, q: int, r: int) -> bool:
    if not in_board(rows, q, r):
        return False
    return rows[r][q] in OPEN_CHARS or (q, r) in dissolved


def pulse_reveal(rows, dissolved, sq, sr, ptype, reach=PULSE_REACH):
    learned = {(sq, sr)}
    seen = {(sq, sr)}
    opened = set()
    front = [(sq, sr)]
    for _ in range(reach):
        nxt = []
        absorbed = False
        for q, r in front:
            for dq, dr in HEX_DIRS:
                n = (q + dq, r + dr)
                if not in_board(rows, *n) or n in seen:
                    continue
                if passable(rows, dissolved | opened, *n):
                    seen.add(n)
                    learned.add(n)
                    nxt.append(n)
                    continue
                learned.add(n)
                ch = rows[n[1]][n[0]]
                if ch not in SEAL_CHARS:
                    continue
                seal = SEAL_TYPE[ch]
                if BEATS[ptype] == seal:
                    seen.add(n)
                    opened.add(n)
                    nxt.append(n)
                elif BEATS[seal] == ptype:
                    absorbed = True
        front = nxt
        if absorbed or not front:
            break
    return learned, opened


def walkable_from(rows, known, dissolved, start):
    reached = {start}
    stack = [start]
    while stack:
        q, r = stack.pop()
        for dq, dr in HEX_DIRS:
            n = (q + dq, r + dr)
            if n in reached or n not in known:
                continue
            if not passable(rows, dissolved, *n):
                continue
            reached.add(n)
            stack.append(n)
    return reached


LEVELS_SPEC = [
    {"charges": {0: 1, 1: 1, 2: 0}, "min_pulses": 2, "needed_types": 1, "rows": [
        "         ",
        "         ",
        "  #####  ",
        "  #...#  ",
        "  #.P.#  ",
        "  #.e.#  ",
        "  ##B##  ",
        "  #.X.#  ",
        "  #####  ",
        "         ",
    ]},
    {"charges": {0: 1, 1: 2, 2: 0}, "min_pulses": 3, "needed_types": 1, "rows": [
        "         ",
        "  #####  ",
        "  #.P.#  ",
        "  #.#.#  ",
        "  #B#e#  ",
        "  #.#.#  ",
        "  #.###  ",
        "  #X###  ",
        "  #####  ",
        "         ",
    ]},
    {"charges": {0: 1, 1: 0, 2: 3}, "min_pulses": 4, "needed_types": 2, "rows": [
        "         ",
        " ####### ",
        " #..P..# ",
        " #.#B#.# ",
        " #e#.#e# ",
        " #A#.#A# ",
        " #.#.#.# ",
        " #..#..# ",
        " #.#X#.# ",
        " ####### ",
    ]},
    {"charges": {0: 1, 1: 2, 2: 2}, "min_pulses": 5, "needed_types": 2, "rows": [
        " ####### ",
        " #..P..# ",
        " #.###.# ",
        " #B###.# ",
        " #.###C# ",
        " #...#.# ",
        " ##C##.# ",
        " #e.#.e# ",
        " #.X#..# ",
        " ####### ",
    ]},
    {"charges": {0: 2, 1: 1, 2: 3}, "min_pulses": 6, "needed_types": 3, "rows": [
        " ####### ",
        " #.P...# ",
        " #A###C# ",
        " #e###.# ",
        " #.###e# ",
        " #B###.# ",
        " #.###A# ",
        " ##.B.e# ",
        " ##X#### ",
        " ####### ",
    ]},
    {"charges": {0: 2, 1: 1, 2: 4}, "min_pulses": 7, "needed_types": 3, "rows": [
        "#########",
        "#.P....##",
        "##A###C##",
        "#.####.##",
        "#e####A##",
        "#.####e##",
        "#B####.##",
        "##...B.##",
        "##X######",
        "#########",
    ]},
]


def _ground_face(fleck: int = -1) -> list[list[int]]:
    face = [[FLOOR] * CELL for _ in range(CELL)]
    face[4][1] = BORDER
    face[3][0] = BORDER
    if fleck >= 0:
        face[1][3] = fleck
    return face


def _masonry_face(q: int, r: int) -> list[list[int]]:
    face = [[WALL] * CELL for _ in range(CELL)]
    for x in range(CELL):
        face[0][x] = BORDER
    face[2][(q * 2 + r * 3) % CELL] = BORDER
    face[3][(q * 2 + r * 3) % CELL] = BORDER
    return face


def _seal_face(seal: int) -> list[list[int]]:
    colour = GLYPH[seal]
    face = [[colour] * CELL for _ in range(CELL)]
    for x in range(CELL):
        face[0][x] = BORDER
        face[4][x] = BORDER
    weak = GLYPH[(seal + 2) % 3]
    face[2][1] = weak
    face[2][3] = weak
    face[1][2] = BORDER
    face[3][2] = BORDER
    return face


def _gate_face() -> list[list[int]]:
    face = [[GATE] * CELL for _ in range(CELL)]
    for y, x in ((0, 0), (0, 4), (4, 0), (4, 4)):
        face[y][x] = -1
    face[2][2] = BORDER
    face[1][2] = BORDER
    return face


def _avatar_face(under: list[list[int]]) -> list[list[int]]:
    face = [row[:] for row in under]
    for y, x in ((1, 2), (2, 1), (2, 2), (2, 3), (3, 2)):
        face[y][x] = AVATAR
    face[2][2] = BORDER
    return face


def _lamp_face(seal_type: int, left: int) -> list[list[int]]:
    t = GLYPH[seal_type]
    face = [[-1] * CELL for _ in range(CELL)]
    for y, x in ((0, 2), (1, 1), (1, 3), (2, 0), (2, 4), (3, 1), (3, 3), (4, 2)):
        face[y][x] = WALL
    for i, (y, x) in enumerate(((1, 2), (2, 1), (2, 3), (3, 2))):
        face[y][x] = t if i < left else BORDER
    return face


MOTE_PIXELS = ((2, 2), (1, 2), (2, 1))


def _mote_face(shade: int) -> list[list[int]]:
    face = [[-1] * CELL for _ in range(CELL)]
    for y, x in MOTE_PIXELS:
        face[y][x] = shade
    return face


MOTE_XY = ((30, 2), (58, 30), (36, 59), (12, 60))


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for r, row in enumerate(spec["rows"]):
            for q, char in enumerate(row):
                if char == VOID:
                    continue
                px, py = cell_px(q, r)
                sprites.append(Sprite(
                    pixels=_ground_face(GLYPH_B if char == "e" else -1),
                    name=f"ground_{q}_{r}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=-3,
                ).set_position(px, py))
                if char == "#":
                    sprites.append(Sprite(
                        pixels=_masonry_face(q, r), name=f"masonry_{q}_{r}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-2,
                    ).set_position(px, py))
                elif char in SEAL_CHARS:
                    sprites.append(Sprite(
                        pixels=_seal_face(SEAL_TYPE[char]), name=f"seal_{q}_{r}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-1,
                        tags=["seal"],
                    ).set_position(px, py))
                elif char == "X":
                    sprites.append(Sprite(
                        pixels=_gate_face(), name="gate",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.INTANGIBLE, layer=-1,
                        tags=["gate"],
                    ).set_position(px, py))
        for i, (lx, ly) in enumerate(LAMP_XY):
            sprites.append(Sprite(
                pixels=_lamp_face(i, spec["charges"].get(i, 0)), name=f"lamp_{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1,
                tags=["sys_click", f"emit_{i}"],
            ).set_position(lx, ly))
        for i, (mx, my) in enumerate(MOTE_XY):
            sprites.append(Sprite(
                pixels=_mote_face(GLYPH[i % 3]), name=f"mote_{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1,
            ).set_position(mx, my))
        levels.append(Level(sprites=sprites, grid_size=(FRAME, FRAME)))
    return levels


class G020A(RenderableUserDisplay):

    def __init__(self, game: "G020") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        out = frame.copy()
        rows = LEVELS_SPEC[self._game.level_index]["rows"]
        for r, row in enumerate(rows):
            for q, char in enumerate(row):
                if char == VOID or (q, r) in self._game.known:
                    continue
                px, py = cell_px(q, r)
                out[py:py + CELL, px:px + CELL] = SMOKE
        q, r = self._game.pos
        px, py = cell_px(q, r)
        under = out[py:py + CELL, px:px + CELL]
        out[py:py + CELL, px:px + CELL] = np.array(
            _avatar_face(under.tolist()), dtype=out.dtype)
        return out


class G020B(RenderableUserDisplay):

    def __init__(self, game: "G020") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        phase = self._game.tick // 2
        for i, (mx, my) in enumerate(MOTE_XY):
            shade = GLYPH[(i + phase) % 3]
            for dy, dx in MOTE_PIXELS:
                frame[my + dy, mx + dx] = shade
        return frame


class G020(ARCBaseGame):

    def __init__(self) -> None:
        spec = LEVELS_SPEC[0]
        self.charges = dict(spec["charges"])
        self.known: set[tuple[int, int]] = set()
        self.dissolved: set[tuple[int, int]] = set()
        self.pos = (0, 0)
        self.tick = 0
        camera = Camera(
            width=FRAME, height=FRAME,
            background=BORDER, letter_box=BORDER,
            interfaces=[G020A(self), G020B(self)],
        )
        super().__init__(game_id="g020", levels=build_levels(),
                         camera=camera, available_actions=[1, 2, 3, 4, 5, 6, 7])

    def rows(self) -> list[str]:
        return LEVELS_SPEC[self.level_index]["rows"]

    def start_cell(self) -> tuple[int, int]:
        for r, row in enumerate(self.rows()):
            q = row.find("P")
            if q >= 0:
                return q, r
        raise AssertionError("board has no start")

    def gate_cell(self) -> tuple[int, int]:
        for r, row in enumerate(self.rows()):
            q = row.find("X")
            if q >= 0:
                return q, r
        raise AssertionError("board has no gate")

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.charges = dict(spec["charges"])
        self.known = set()
        self.dissolved = set()
        self.pos = self.start_cell()
        self._redraw_lamps()

    def _redraw_lamps(self) -> None:
        for i in range(3):
            for lamp in self.current_level.get_sprites_by_name(f"lamp_{i}"):
                lamp.pixels[:, :] = np.array(
                    _lamp_face(i, self.charges.get(i, 0)), dtype=lamp.pixels.dtype)

    def _clear_seal(self, cell: tuple[int, int]) -> None:
        for sprite in list(self.current_level.get_sprites_by_tag("seal")):
            if (sprite.x, sprite.y) == cell_px(*cell):
                self.current_level.remove_sprite(sprite)

    def _fire(self, ptype: int) -> None:
        if self.charges.get(ptype, 0) <= 0:
            return
        self.charges[ptype] -= 1
        learned, opened = pulse_reveal(
            self.rows(), self.dissolved, *self.pos, ptype)
        self.known |= learned
        self.dissolved |= opened
        for cell in opened:
            self._clear_seal(cell)
        self._redraw_lamps()
        if sum(self.charges.values()) == 0 and not self._gate_still_winnable():
            self.level_reset()

    def _gate_still_winnable(self) -> bool:
        gate = self.gate_cell()
        if gate not in self.known:
            return False
        return gate in walkable_from(self.rows(), self.known, self.dissolved, self.pos)

    def _clicked_emitter(self, x: int, y: int) -> int | None:
        for i in range(3):
            for lamp in self.current_level.get_sprites_by_name(f"lamp_{i}"):
                if lamp.x <= x < lamp.x + CELL and lamp.y <= y < lamp.y + CELL:
                    return i
        return None

    def _walk(self, dq: int, dr: int) -> None:
        target = (self.pos[0] + dq, self.pos[1] + dr)
        if target not in self.known:
            return
        if not passable(self.rows(), self.dissolved, *target):
            return
        self.pos = target
        if target == self.gate_cell():
            self.next_level()

    def step(self) -> None:
        self.tick += 1
        if self.action.id == GameAction.ACTION6:
            hit = self._clicked_emitter(int(self.action.data.get("x", -1)),
                                        int(self.action.data.get("y", -1)))
            if hit is not None:
                self._fire(hit)
            self.complete_action()
            return
        move = ACTION_STEP.get(self.action.id)
        if move is not None:
            self._walk(*move)
        self.complete_action()
