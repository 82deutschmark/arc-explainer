# ARC-AGI-3 candidate task g027.

import functools

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

BACKGROUND = 5
WALL = 2
FLOOR = 3
HAZARD = 15
GOAL = 0
MARK = 0
BLOCK_A = 11
BLOCK_B = 14
BLOCK_C = 9
PIP_ON = 0
PIP_OFF = 3

TYPE_COLOUR = (BLOCK_A, BLOCK_B, BLOCK_C)

WALL_C = "#"
PIT_C = "P"
SOCK_C = "T"
MAX_SPEED = 4

NX, NY = 12, 11
CELL = 5
PAD_X, PAD_Y = 2, 1

STEP = {"L": (-1, 0), "R": (1, 0), "V": (0, 1)}
EDGES = {
    0: ((-1, 0), (1, 0), (0, 1)),
    1: ((-1, 0), (1, 0), (0, -1)),
}
FACES = ("L", "R", "V")

OUTCOME = {
    (0, 0): "couple", (0, 1): "drive", (0, 2): "jam",
    (1, 0): "jam", (1, 1): "couple", (1, 2): "drive",
    (2, 0): "drive", (2, 1): "jam", (2, 2): "couple",
}
N_TYPES = 3

LEVELS_SPEC = [
    {"ptype": 0, "rows": [
        "############",
        "############",
        "############",
        "############",
        "############",
        "#S...aA..T.#",
        "############",
        "############",
        "############",
        "############",
        "############",
    ]},
    {"ptype": 0, "rows": [
        "############",
        "############",
        "############",
        "#S...cA.T..#",
        "############",
        "############",
        "############",
        "############",
        "############",
        "############",
        "############",
    ]},
    {"ptype": 2, "rows": [
        "############",
        "############",
        "############",
        "############",
        "############",
        "############",
        "#S...aB.T..#",
        "############",
        "############",
        "############",
        "############",
    ]},
    {"ptype": 1, "rows": [
        "############",
        "############",
        "#S.........#",
        "########..##",
        "########..##",
        "#T.Cb.....##",
        "############",
        "############",
        "############",
        "############",
        "############",
    ]},
    {"ptype": 2, "rows": [
        "############",
        "############",
        "############",
        "############",
        "#S...cC.T.P#",
        "############",
        "############",
        "############",
        "############",
        "############",
        "############",
    ]},
    {"ptype": 0, "rows": [
        "############",
        "#S...bbC.T.#",
        "#..#########",
        "#..#########",
        "#....cA.T..#",
        "############",
        "############",
        "############",
        "############",
        "############",
        "############",
    ]},
]

for _spec in LEVELS_SPEC:
    _spec["rows"] = tuple(_spec["rows"])

RELAY_CHARS = "abc"
PAYLOAD_CHARS = "ABC"


def up_cell(x, y):
    return (x + y) % 2 == 0


def edge_step(x, y, face):
    dx, dy = EDGES[0 if up_cell(x, y) else 1][FACES.index(face)]
    return x + dx, y + dy


def cell_at(rows, x, y):
    if 0 <= y < len(rows) and 0 <= x < len(rows[0]):
        return rows[y][x]
    return WALL_C


@functools.lru_cache(maxsize=None)
def parse(rows):
    start = None
    bodies = []
    kinds = []
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "S":
                start = (x, y)
            elif ch in RELAY_CHARS:
                bodies.append((x, y, RELAY_CHARS.index(ch)))
                kinds.append("B")
            elif ch in PAYLOAD_CHARS:
                bodies.append((x, y, PAYLOAD_CHARS.index(ch)))
                kinds.append("O")
    if start is None:
        raise ValueError("level has no start")
    return start, tuple(bodies), tuple(kinds)


def initial_state(spec):
    (sx, sy), bodies, _ = parse(spec["rows"])
    return (sx, sy, 0, None, spec["ptype"], bodies)


def _shove(rows, pos, occupied, index, face, budget, avatar, trace):
    x, y, kind = pos[index]
    del occupied[(x, y)]
    remaining = budget
    came_from = None
    while remaining > 0:
        nx, ny = edge_step(x, y, face)
        if (nx, ny) == came_from:
            break
        char = cell_at(rows, nx, ny)
        if char == WALL_C or (nx, ny) == avatar:
            break
        if (nx, ny) in occupied:
            struck = occupied[(nx, ny)]
            pos[index] = (x, y, kind)
            occupied[(x, y)] = index
            verdict = OUTCOME[(kind, pos[struck][2])]
            handed = remaining - 1 if verdict == "drive" else remaining
            if verdict != "jam" and handed > 0:
                _shove(rows, pos, occupied, struck, face, handed, avatar, trace)
            return
        came_from = (x, y)
        x, y = nx, ny
        remaining -= 1
        pos[index] = (x, y, kind)
        if trace is not None:
            trace.append((avatar[0], avatar[1], tuple(pos)))
        if char == PIT_C:
            pos[index] = None
            if trace is not None:
                trace.append((avatar[0], avatar[1], tuple(pos)))
            return
    pos[index] = (x, y, kind)
    occupied[(x, y)] = index


def press(rows, state, face, trace=None):
    px, py, speed, facing, ptype, bodies = state
    if face == "SWAP":
        return (px, py, speed, facing, (ptype + 1) % N_TYPES, bodies), None
    if face is None:
        slower = max(0, speed - 1)
        return (px, py, slower, facing if slower else None, ptype, bodies), None

    pos = list(bodies)
    occupied = {(b[0], b[1]): i for i, b in enumerate(pos) if b is not None}
    _, _, kinds = parse(rows)

    launched = min(speed + 1, MAX_SPEED) if facing == face else 1
    remaining = launched
    struck_kind = None
    came_from = None
    while remaining > 0:
        nx, ny = edge_step(px, py, face)
        if (nx, ny) == came_from:
            break
        char = cell_at(rows, nx, ny)
        if char == WALL_C or char == PIT_C:
            launched = 0
            break
        if (nx, ny) in occupied:
            struck = occupied[(nx, ny)]
            struck_kind = kinds[struck]
            verdict = OUTCOME[(ptype, pos[struck][2])]
            handed = launched - 1 if verdict == "drive" else launched
            if verdict != "jam" and handed > 0:
                _shove(rows, pos, occupied, struck, face, handed, (px, py), trace)
            launched = 0
            break
        came_from = (px, py)
        px, py = nx, ny
        remaining -= 1
        if trace is not None:
            trace.append((px, py, tuple(pos)))

    return (px, py, launched, face if launched else None, ptype, tuple(pos)), struck_kind


def is_won(rows, state):
    _, _, kinds = parse(rows)
    for i, kind in enumerate(kinds):
        if kind != "O":
            continue
        body = state[5][i]
        if body is None or cell_at(rows, body[0], body[1]) != SOCK_C:
            return False
    return True


def payload_lost(rows, state):
    _, _, kinds = parse(rows)
    return any(kinds[i] == "O" and b is None for i, b in enumerate(state[5]))


UP_WIDTHS = (1, 3, 3, 5, 5)
DOWN_WIDTHS = (5, 5, 3, 3, 1)


def _mask(up):
    out = []
    for w in (UP_WIDTHS if up else DOWN_WIDTHS):
        a = (CELL - w) // 2
        out.append([a <= i < a + w for i in range(CELL)])
    return out


def _tri(colour, up):
    m = _mask(up)
    return [[colour if m[y][x] else -1 for x in range(CELL)] for y in range(CELL)]


def _hollow(colour, up):
    face = _tri(colour, up)
    row = CELL - 2 if up else 1
    for x in range(1, CELL - 1):
        face[row][x] = -1
    return face


def _floor_face(up):
    return _tri(FLOOR, up)


def _wall_face(x, y):
    face = [[WALL] * CELL for _ in range(CELL)]
    face[(x * 3 + y) % CELL][(x + y * 2) % CELL] = FLOOR
    face[(x + y * 3 + 2) % CELL][(x * 2 + y + 1) % CELL] = FLOOR
    return face


def _pit_face(up, lit=False):
    face = _tri(HAZARD, up)
    if not lit:
        for y in range(CELL):
            for x in range(CELL):
                if face[y][x] >= 0 and (x + y) % 2:
                    face[y][x] = -1
    return face


def _socket_face(up):
    return _hollow(GOAL, up)


def _body_face(btype, up, payload, seated=False):
    face = _tri(TYPE_COLOUR[btype], up)
    if payload:
        row = CELL - 2 if up else 1
        face[row][CELL // 2] = MARK if seated else BACKGROUND
    return face


EDGE_PIXELS = {
    (True, "L"): ((CELL - 1, 0), (CELL - 2, 1)),
    (True, "R"): ((CELL - 1, CELL - 1), (CELL - 2, CELL - 2)),
    (True, "V"): ((CELL - 1, CELL // 2),),
    (False, "L"): ((0, 0), (1, 1)),
    (False, "R"): ((0, CELL - 1), (1, CELL - 2)),
    (False, "V"): ((0, CELL // 2),),
}


def _player_face(ptype, facing, up):
    face = _hollow(TYPE_COLOUR[ptype], up)
    for y, x in EDGE_PIXELS.get((up, facing), ()):
        face[y][x] = MARK
    return face


def _stamp(grid, cx, cy, face):
    height, width = grid.shape
    for dy, row in enumerate(face):
        y = PAD_Y + cy * CELL + dy
        if not 0 <= y < height:
            continue
        for dx, value in enumerate(row):
            x = PAD_X + cx * CELL + dx
            if value >= 0 and 0 <= x < width:
                grid[y, x] = value


DECOR_X = (3, 47, 55)
DECOR_CYCLE = (WALL, WALL, WALL, WALL, WALL, WALL, FLOOR)


def _paint(index, state, over=None, doom=None, dim=False):
    rows = LEVELS_SPEC[index]["rows"]
    px, py, _, facing, ptype, own = state
    bodies = own
    if over is not None:
        px, py, bodies = over
    _, _, kinds = parse(rows)
    grid = np.full((64, 64), BACKGROUND, dtype=np.int64)

    for y in range(NY):
        for x in range(NX):
            ch = rows[y][x]
            up = up_cell(x, y)
            if ch == WALL_C:
                _stamp(grid, x, y, _wall_face(x, y))
            elif ch == PIT_C:
                _stamp(grid, x, y, _pit_face(up, lit=(doom is not None and doom % 2 == 0)))
            elif ch == SOCK_C:
                _stamp(grid, x, y, _socket_face(up))
            else:
                _stamp(grid, x, y, _floor_face(up))

    for i, body in enumerate(bodies):
        if body is None:
            continue
        bx, by, btype = body
        payload = kinds[i] == "O"
        seated = payload and not dim and cell_at(rows, bx, by) == SOCK_C
        _stamp(grid, bx, by, _body_face(btype, up_cell(bx, by), payload, seated))
    _stamp(grid, px, py, _player_face(ptype, facing, up_cell(px, py)))
    return grid


def build_levels():
    levels = []
    for i, spec in enumerate(LEVELS_SPEC):
        canvas = Sprite(
            pixels=_paint(i, initial_state(spec)), name="canvas",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=0,
        ).set_position(0, 0)
        levels.append(Level(sprites=[canvas], grid_size=(64, 64)))
    return levels


RAIL_TOP, RAIL_BOTTOM = 58, 61
RAIL_LEFT = 6


class G027A(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        speed = self._game.state[2]
        frame[RAIL_TOP:RAIL_BOTTOM, RAIL_LEFT:RAIL_LEFT + MAX_SPEED * 3 + 1] = PIP_OFF
        if speed:
            frame[RAIL_TOP:RAIL_BOTTOM, RAIL_LEFT:RAIL_LEFT + speed * 3 + 1] = PIP_ON
        for i, x in enumerate(DECOR_X):
            lit = DECOR_CYCLE[(self._game.beat + 2 * i) % len(DECOR_CYCLE)]
            frame[RAIL_TOP + 1:RAIL_BOTTOM, x:x + 2] = lit
        return frame


class G027(ARCBaseGame):

    DOOM_FRAMES = 6
    CHEER_FRAMES = 5

    def __init__(self) -> None:
        self.state = initial_state(LEVELS_SPEC[0])
        self._frames = []
        self._doom = 0
        self._cheer = 0
        self.beat = 0
        camera = Camera(
            width=64, height=64, background=BACKGROUND, letter_box=5,
            interfaces=[G027A(self)],
        )
        super().__init__(game_id="g027", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    def _rearm(self) -> None:
        self.state = initial_state(LEVELS_SPEC[self.level_index])
        self._frames = []
        self._doom = 0
        self._cheer = 0
        self._repaint()

    def on_set_level(self, level: Level) -> None:
        self._rearm()

    def level_reset(self) -> None:
        super().level_reset()
        self._rearm()

    def full_reset(self) -> None:
        super().full_reset()
        self.beat = 0
        self._rearm()

    def _repaint(self, over=None, doom=None, dim=False) -> None:
        canvas = self.current_level.get_sprites_by_name("canvas")
        if canvas:
            canvas[0].pixels = _paint(self.level_index, self.state, over, doom, dim)

    def _resolve(self) -> None:
        rows = LEVELS_SPEC[self.level_index]["rows"]
        if is_won(rows, self.state):
            self._cheer = self.CHEER_FRAMES
            return
        if payload_lost(rows, self.state):
            self._doom = self.DOOM_FRAMES
            return
        self.complete_action()

    def step(self) -> None:
        if self._frames:
            self._repaint(self._frames.pop(0))
            if not self._frames:
                self._resolve()
            return

        if self._cheer:
            self._cheer -= 1
            self._repaint(dim=self._cheer % 2 == 1)
            if self._cheer == 0:
                self.next_level()
                self.complete_action()
            return

        if self._doom:
            self._doom -= 1
            self._repaint(doom=self._doom)
            if self._doom == 0:
                self.level_reset()
                self.complete_action()
            return

        face = {
            GameAction.ACTION1: "L",
            GameAction.ACTION2: "R",
            GameAction.ACTION3: "V",
            GameAction.ACTION4: "SWAP",
            GameAction.ACTION5: "HOLD",
        }.get(self.action.id)

        if face is None:
            self.complete_action()
            return

        rows = LEVELS_SPEC[self.level_index]["rows"]
        trace = []
        self.state, _ = press(rows, self.state,
                              None if face == "HOLD" else face, trace)
        self.beat += 1

        settled = (self.state[0], self.state[1], self.state[5])
        self._frames = [f for k, f in enumerate(trace)
                        if f != settled and (k == 0 or f != trace[k - 1])]
        if self._frames:
            self._repaint(self._frames.pop(0))
            if not self._frames:
                self._resolve()
            return
        self._repaint()
        self._resolve()
