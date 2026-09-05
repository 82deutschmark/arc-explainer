# ARC-AGI-3 candidate task g015.

import numpy as np

from sprite_book import hatch, weave

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

FLOOR = 1
WALL = 5
SAND_FILL = 3
BUFFER_EDGE = 13
DRUM_FILL = 9
PLAYER = 12
PLAYER_MARK = 5
GOAL = 10
PART_GLYPH = 6
PART_EYE = 5

PART_KINDS = ("R", "W", "M", "S")

NX, NY = 12, 10
CELL = 5
PAD_X, PAD_Y = 2, 3

STEP = {"L": (-1, 0), "R": (1, 0), "V": (0, 1)}
EDGES = {
    0: ((-1, 0), (1, 0), (0, 1)),
    1: ((-1, 0), (1, 0), (0, -1)),
}
FACES = ("L", "R", "V")
ACTIONS = ("L", "R", "V", "TAKE", "FIRE", "WAIT")

OPEN = ".~vX"

PAIRS = {
    ("R", "W"): "crank",
    ("S", "W"): "chock",
    ("M", "R"): "auger",
    ("R", "S"): "line",
}

LEVELS_SPEC = [

    ["############",
     "############",
     "############",
     "#..........#",
     "#..R..W....#",
     "#P..D.....X#",
     "#..........#",
     "############",
     "############",
     "############"],

    ["############",
     "############",
     "############",
     "#..........#",
     "#P.R.W.S...#",
     "#=..{..~~.X#",
     "#..........#",
     "############",
     "############",
     "############"],

    ["############",
     "#..S.#######",
     "#.R..#######",
     "#..W.#######",
     "#...########",
     "#P.D..D..X##",
     "############",
     "############",
     "############",
     "############"],

    ["############",
     "############",
     "############",
     "#..........#",
     "#.R.W...WS.#",
     "#=......XDP#",
     "#..........#",
     "############",
     "############",
     "############"],

    ["############",
     "############",
     "#..........#",
     "#.M.R.R.W..#",
     "#P.D#...v..#",
     "########.X##",
     "############",
     "############",
     "############",
     "############"],

    ["############",
     "############",
     "########.#.#",
     "########...#",
     "########.M.#",
     "#RWD.R.SPX##",
     "############",
     "############",
     "############",
     "############"],

    ["############",
     "############",
     "############",
     "#####......#",
     "#####MRRWS.#",
     "#=..D.#P.X##",
     "############",
     "############",
     "############",
     "############"],
]


def _parse(rows: list[str]) -> dict:
    base = [list(r) for r in rows]
    parts: list[tuple[int, int, str]] = []
    drums: list[tuple[int, int, int, int]] = []
    start = cradle = None
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in PART_KINDS:
                parts.append((x, y, ch))
                base[y][x] = "."
            elif ch == "D":
                drums.append((x, y, 0, 1))
                base[y][x] = "."
            elif ch == ">":
                drums.append((x, y, 1, 1))
                base[y][x] = "."
            elif ch == "<":
                drums.append((x, y, 1, -1))
                base[y][x] = "."
            elif ch == "}":
                drums.append((x, y, 2, 1))
                base[y][x] = "."
            elif ch == "{":
                drums.append((x, y, 2, -1))
                base[y][x] = "."
            elif ch == "P":
                start = (x, y)
                base[y][x] = "."
            elif ch == "X":
                cradle = (x, y)
    if start is None or cradle is None or not drums:
        raise ValueError("a level needs a start, a cradle and at least one drum")
    return {
        "rows": rows,
        "base": ["".join(r) for r in base],
        "parts": parts,
        "drums": tuple(sorted(drums)),
        "start": start,
        "cradle": cradle,
    }


LEVELS = [_parse(rows) for rows in LEVELS_SPEC]
for _lv in LEVELS:
    assert len(_lv["rows"]) == NY and all(len(r) == NX for r in _lv["rows"])


def up_cell(x: int, y: int) -> bool:
    return (x + y) % 2 == 0


def _edge(x: int, y: int, name: str) -> tuple[int, int]:
    dx, dy = EDGES[0 if up_cell(x, y) else 1][FACES.index(name)]
    return x + dx, y + dy


def initial_state(index: int) -> tuple:
    lv = LEVELS[index]
    return (lv["start"][0], lv["start"][1], "R", (),
            tuple(0 for _ in lv["parts"]), lv["drums"], 0, ())


def momentum(state: tuple) -> int:
    return sum(d[2] for d in state[5]) + state[6]


def _terrain(lv: dict, opened: tuple, x: int, y: int) -> str:
    if not (0 <= x < NX and 0 <= y < NY):
        return "#"
    ch = lv["base"][y][x]
    if ch == "#" and (x, y) in opened:
        return "."
    return ch


def _drum_at(drums, x: int, y: int, skip: int = -1):
    for i, d in enumerate(drums):
        if i != skip and d[0] == x and d[1] == y:
            return i
    return None


def _standable(lv, opened, drums, x: int, y: int) -> bool:
    return (_terrain(lv, opened, x, y) in OPEN
            and _drum_at(drums, x, y) is None)


def _tick(lv: dict, opened: tuple, drums: tuple, spent: int, trace=None):
    live = [list(d) for d in drums]
    settled = [False] * len(live)

    def snapshot():
        if trace is not None:
            trace.append(tuple(sorted(tuple(d) for d in live)))

    for i in range(len(live)):
        if settled[i]:
            continue
        settled[i] = True
        x, y, s, h = live[i]
        moved = 0
        while s > 0 and moved < s:
            nx, ny = x + h, y
            ch = _terrain(lv, opened, nx, ny)
            if ch == "#":
                spent += s
                s = 0
                break
            if ch == "=":
                h = -h
                moved += 1
                live[i] = [x, y, s, h]
                snapshot()
                continue
            j = _drum_at(live, nx, ny, skip=i)
            if j is not None:
                live[j][2] += s
                live[j][3] = h
                settled[j] = True
                s = 0
                break
            x, y = nx, ny
            if _terrain(lv, opened, x, y) == "v":
                vx, vy = _edge(x, y, "V")
                if (_terrain(lv, opened, vx, vy) in OPEN
                        and _drum_at(live, vx, vy, skip=i) is None):
                    x, y = vx, vy
            if _terrain(lv, opened, x, y) == "~":
                spent += 1
                s -= 1
            moved += 1
            live[i] = [x, y, s, h]
            snapshot()
        live[i] = [x, y, s, h]
    snapshot()
    return tuple(sorted(tuple(d) for d in live)), spent


def _tool(lv: dict, hands: tuple) -> str | None:
    if len(hands) != 2:
        return None
    return PAIRS.get(tuple(sorted(lv["parts"][i][2] for i in hands)))


def _apply(lv, tool, px, py, face, drums, spent, opened):
    if tool == "crank":
        if face == "V":
            return px, py, drums, spent, opened
        tx, ty = _edge(px, py, face)
        i = _drum_at(drums, tx, ty)
        if i is not None:
            d = list(drums)
            x, y, s, _h = d[i]
            d[i] = (x, y, s + 1, -1 if face == "L" else 1)
            return px, py, tuple(sorted(d)), spent, opened

    elif tool == "chock":
        tx, ty = _edge(px, py, face)
        i = _drum_at(drums, tx, ty)
        if i is not None and drums[i][2] > 0:
            d = list(drums)
            x, y, s, h = d[i]
            d[i] = (x, y, 0, h)
            return px, py, tuple(sorted(d)), spent + s, opened

    elif tool == "auger":
        if face == "V":
            return px, py, drums, spent, opened
        dx = -1 if face == "L" else 1
        tx, ty = px + dx, py
        if (_terrain(lv, opened, tx, ty) == "#"
                and _terrain(lv, opened, tx + dx, ty) in OPEN):
            return px, py, drums, spent, tuple(sorted(opened + ((tx, ty),)))

    elif tool == "line":
        if face == "V":
            return px, py, drums, spent, opened
        dx = -1 if face == "L" else 1
        land = None
        k = 1
        while True:
            cx = px + dx * k
            if _terrain(lv, opened, cx, py) not in OPEN:
                break
            if _drum_at(drums, cx, py) is None:
                land = (cx, py)
            k += 1
        if land is not None and land != (px, py):
            return land[0], land[1], drums, spent, opened

    return px, py, drums, spent, opened


def _part_underfoot(lv, status, px, py):
    for i, (qx, qy, _k) in enumerate(lv["parts"]):
        if status[i] == 0 and (qx, qy) == (px, py):
            return i
    return None


def step_state(index: int, state: tuple, action: str, trace=None) -> tuple:
    lv = LEVELS[index]
    px, py, face, hands, status, drums, spent, opened = state

    if action in STEP:
        face = action
        nx, ny = _edge(px, py, action)
        if _standable(lv, opened, drums, nx, ny):
            px, py = nx, ny

    elif action == "TAKE":
        here = _part_underfoot(lv, status, px, py)
        if here is not None and len(hands) < 2:
            st = list(status)
            st[here] = 1
            hands, status = hands + (here,), tuple(st)
        elif hands:
            st = list(status)
            for i in hands:
                st[i] = 0
            hands, status = (), tuple(st)

    elif action == "FIRE":
        tool = _tool(lv, hands)
        if tool is not None:
            world = _apply(lv, tool, px, py, face, drums, spent, opened)
            if world != (px, py, drums, spent, opened):
                px, py, drums, spent, opened = world
                st = list(status)
                for i in hands:
                    st[i] = 2
                hands, status = (), tuple(st)

    drums, spent = _tick(lv, opened, drums, spent, trace)
    return (px, py, face, hands, status, drums, spent, opened)


def is_won(index: int, state: tuple) -> bool:
    cx, cy = LEVELS[index]["cradle"]
    return any(x == cx and y == cy and s == 0 for x, y, s, _h in state[5])


UP_WIDTHS = (1, 3, 3, 5, 5)
DOWN_WIDTHS = (5, 5, 3, 3, 1)


def _mask(up: bool) -> list[list[bool]]:
    out = []
    for w in (UP_WIDTHS if up else DOWN_WIDTHS):
        a = (CELL - w) // 2
        out.append([a <= i < a + w for i in range(CELL)])
    return out


def _tri(colour: int, up: bool) -> list[list[int]]:
    m = _mask(up)
    return [[colour if m[y][x] else -1 for x in range(CELL)] for y in range(CELL)]


def _cut(face: list, texture: list, up: bool) -> list:
    m = _mask(up)
    for y, row in enumerate(texture):
        for x, v in enumerate(row):
            if v >= 0 and m[y][x]:
                face[y][x] = v
    return face


def _floor_face(up: bool) -> list:
    return _tri(FLOOR, up)


def _sand_face(up: bool) -> list:
    return _cut(_tri(SAND_FILL, up), weave(WALL, CELL), up)


def _buffer_face(up: bool) -> list:
    return _cut(_tri(BUFFER_EDGE, up), hatch(WALL, CELL), up)


def _ramp_face(up: bool) -> list:
    face = _tri(FLOOR, up)
    row = CELL - 1 if up else 0
    for x in range(CELL):
        if face[row][x] >= 0:
            face[row][x] = WALL
    face[row - 1 if up else row + 1][CELL // 2] = WALL
    return face


def _cradle_face(up: bool) -> list:
    m = _mask(up)
    face = _tri(FLOOR, up)
    for y in range(CELL):
        for x in range(CELL):
            if not m[y][x]:
                continue
            edge = (y in (0, CELL - 1) or x in (0, CELL - 1)
                    or not m[y - 1][x] or not m[y + 1][x]
                    or not m[y][x - 1] or not m[y][x + 1])
            if edge:
                face[y][x] = GOAL
    return face


DRUM_RIM = ((2, 0), (1, 1), (3, 1), (0, 2), (4, 2), (1, 3), (3, 3), (2, 4))
DRUM_BODY = ((2, 1), (1, 2), (2, 2), (3, 2), (2, 3))
PIP_ROWS = (0, 4, 1, 3)


def _drum_face(s: int, h: int) -> list:
    face = [[-1] * CELL for _ in range(CELL)]
    for x, y in DRUM_RIM:
        face[y][x] = DRUM_FILL
    if s <= 0:
        return face
    for x, y in DRUM_BODY:
        face[y][x] = DRUM_FILL
    lead = 0 if h < 0 else CELL - 1
    for ry in PIP_ROWS[:min(s, len(PIP_ROWS))]:
        face[ry][lead] = DRUM_FILL
    return face


def _part_face(kind: str) -> list:
    face = [[-1] * CELL for _ in range(CELL)]
    if kind == "R":
        for y in (1, 2, 3):
            face[y][2] = PART_GLYPH
        face[3][1] = face[3][3] = PART_GLYPH
    elif kind == "W":
        for y in (1, 2, 3):
            for x in (1, 2, 3):
                if not (y == 2 and x == 2):
                    face[y][x] = PART_GLYPH
    elif kind == "M":
        for y in (1, 2, 3):
            for x in (1, 2, 3):
                face[y][x] = PART_GLYPH
        face[2][2] = PART_EYE
    else:
        for y, x in ((1, 1), (1, 2), (2, 2), (3, 2), (3, 3)):
            face[y][x] = PART_GLYPH
    return face


def _player_face(face_name: str, up: bool) -> list:
    face = _tri(PLAYER, up)
    if face_name == "L":
        face[3 if up else 1][1] = PLAYER_MARK
    elif face_name == "R":
        face[3 if up else 1][3] = PLAYER_MARK
    else:
        face[4 if up else 0][2] = PLAYER_MARK
    return face


def _stamp(grid: np.ndarray, cx: int, cy: int, face: list) -> None:
    height, width = grid.shape
    for dy, row in enumerate(face):
        y = PAD_Y + cy * CELL + dy
        if not 0 <= y < height:
            continue
        for dx, value in enumerate(row):
            x = PAD_X + cx * CELL + dx
            if value >= 0 and 0 <= x < width:
                grid[y, x] = value


TERRAIN_FACE = {
    ".": _floor_face,
    "~": _sand_face,
    "=": _buffer_face,
    "v": _ramp_face,
    "X": _cradle_face,
}


def _paint(index: int, state: tuple, drums=None) -> np.ndarray:
    lv = LEVELS[index]
    px, py, face_name, _hands, status, own, _spent, opened = state
    if drums is None:
        drums = own
    grid = np.full((64, 64), WALL, dtype=np.int8)

    for y in range(NY):
        for x in range(NX):
            builder = TERRAIN_FACE.get(_terrain(lv, opened, x, y))
            if builder is not None:
                _stamp(grid, x, y, builder(up_cell(x, y)))

    for i, (qx, qy, kind) in enumerate(lv["parts"]):
        if status[i] == 0:
            _stamp(grid, qx, qy, _part_face(kind))
    for dx, dy, s, h in drums:
        _stamp(grid, dx, dy, _drum_face(s, h))
    _stamp(grid, px, py, _player_face(face_name, up_cell(px, py)))
    return grid


def build_levels() -> list[Level]:
    levels = []
    for i in range(len(LEVELS)):
        canvas = Sprite(
            pixels=_paint(i, initial_state(i)), name="canvas",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=0,
        ).set_position(0, 0)
        levels.append(Level(sprites=[canvas], grid_size=(64, 64)))
    return levels


RACK_TOP, RACK_BOTTOM = 56, 61
SOCKET_X = (22, 36)


class G015A(RenderableUserDisplay):

    def __init__(self, game: "G015") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        lv = LEVELS[self._game.level_index]
        hands = self._game.state[3]
        frame[RACK_TOP:RACK_BOTTOM, SOCKET_X[0] - 5:SOCKET_X[1] + CELL + 5] = FLOOR
        for slot, x0 in enumerate(SOCKET_X):
            frame[RACK_TOP:RACK_BOTTOM, x0:x0 + CELL] = WALL
            if slot < len(hands):
                face = _part_face(lv["parts"][hands[slot]][2])
            else:
                face = [[-1] * CELL for _ in range(CELL)]
                face[2][2] = FLOOR
            for dy, row in enumerate(face):
                for dx, value in enumerate(row):
                    if value >= 0:
                        frame[RACK_TOP + dy, x0 + dx] = value
        return frame


class G015(ARCBaseGame):

    def __init__(self) -> None:
        self.state = initial_state(0)
        self._frames: list = []
        camera = Camera(
            width=64, height=64, background=WALL, letter_box=5,
            interfaces=[G015A(self)],
        )
        super().__init__(game_id="g015", levels=build_levels(), camera=camera)

    def _rearm(self) -> None:
        self.state = initial_state(self.level_index)
        self._frames = []
        self._repaint(self.state[5])

    def on_set_level(self, level: Level) -> None:
        self._rearm()

    def level_reset(self) -> None:
        super().level_reset()
        self._rearm()

    def full_reset(self) -> None:
        super().full_reset()
        self._rearm()

    def _repaint(self, drums) -> None:
        canvas = self.current_level.get_sprites_by_name("canvas")
        if canvas:
            canvas[0].pixels = _paint(self.level_index, self.state, drums)

    def step(self) -> None:
        if self._frames:
            self._repaint(self._frames.pop(0))
            if not self._frames:
                self._settle()
            return

        action = {
            GameAction.ACTION1: "L",
            GameAction.ACTION2: "R",
            GameAction.ACTION3: "V",
            GameAction.ACTION4: "TAKE",
            GameAction.ACTION5: "FIRE",
            GameAction.ACTION6: "WAIT",
        }.get(self.action.id)

        if action is None:
            self.complete_action()
            return

        trace: list = []
        self.state = step_state(self.level_index, self.state, action, trace)
        seen = self.state[5]
        self._frames = [f for k, f in enumerate(trace)
                        if f != seen and (k == 0 or f != trace[k - 1])]
        if self._frames:
            self._repaint(self._frames.pop(0))
            return
        self._settle()

    def _settle(self) -> None:
        self._repaint(self.state[5])
        if is_won(self.level_index, self.state):
            self.next_level()
        self.complete_action()
