# ARC-AGI-3 candidate task g015.

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

def core(colour: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(1, cell - 1):
        for x in range(1, cell - 1):
            px[y][x] = colour
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

def key_shape(colour: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[0][1] = px[0][2] = colour
    px[1][1] = px[1][2] = colour
    px[2][1] = colour
    px[3][1] = px[3][2] = colour
    return px

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

def hatch(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 3 == 0 else -1 for x in range(cell)] for y in range(cell)]

def fixture(colours: tuple, phase: int, seed: int = 0, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[1][1] = px[cell - 2][cell - 2] = colours[(phase + seed) % len(colours)]
    return px

def hairline(frame, a: tuple, b: tuple, colour: int, only_over=None):
    x0, y0 = a
    x1, y1 = b
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    h, w = frame.shape
    while True:
        if 0 <= x0 < w and 0 <= y0 < h:
            if only_over is None or int(frame[y0, x0]) in only_over:
                frame[y0, x0] = colour
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy
    return frame

def ease_out(t: float) -> float:
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return 1 - (1 - t) * (1 - t)

def tween(a: int, b: int, step: int, span: int) -> int:
    if span <= 0:
        return b
    return int(round(a + (b - a) * ease_out(step / span)))


FLOOR = 1
WALL = 5
PIT = 5
DECK = 1
GOAL = 14
CRATE = 9
PLAYER = 12
PLAYER_VISOR = 5
PART = 7
PART_CORE = 5
SLOT_EMPTY = 1

PART_KINDS = ("R", "W", "M", "O")

N = 16
CELL = 4

PAIRS = {
    ("R", "W"): "cart",
    ("M", "R"): "drill",
    ("M", "O"): "winch",
    ("O", "W"): "grapple",
    ("R", "R"): "plank",
}

DIRS = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0)}
MOVES = ("U", "D", "L", "R")
ACTIONS = MOVES + ("ACT", "RET")

LEVELS_SPEC = [
    ["################",
     "################",
     "################",
     "################",
     "################",
     "#..............#",
     "#..............#",
     "#..............#",
     "#.P.R.W....C.G##",
     "################",
     "################",
     "################",
     "################",
     "################",
     "################",
     "################"],

    ["################",
     "################",
     "################",
     "################",
     "################",
     "#..........#####",
     "#..........#####",
     "#.P.R.M.R.W#..##",
     "#..........#CG##",
     "#..........#####",
     "################",
     "################",
     "################",
     "################",
     "################",
     "################"],

    ["################",
     "################",
     "################",
     "################",
     "#..............#",
     "#.O.M.W........#",
     "#..............#",
     "#.P...Goo...C..#",
     "#..............#",
     "################",
     "################",
     "################",
     "################",
     "################",
     "################",
     "################"],

    ["################",
     "################",
     "################",
     "#..............#",
     "#.R.R.R.W......#",
     "#..............#",
     "#.P......C.o.G##",
     "#..............#",
     "#..............#",
     "################",
     "################",
     "################",
     "################",
     "################",
     "################",
     "################"],

    ["################",
     "################",
     "#..............#",
     "#.P.O.W........#",
     "#..............#",
     "#..............#",
     "#oooooooooooooo#",
     "#..............#",
     "#.O.M.....C.G..#",
     "#..............#",
     "################",
     "################",
     "################",
     "################",
     "################",
     "################"],

    ["################",
     "################",
     "#..............#",
     "#.R.M.O.W......#",
     "#..............#",
     "#.P......C..o..#",
     "#..............#",
     "#........G.#...#",
     "#..............#",
     "################",
     "################",
     "################",
     "################",
     "################",
     "################",
     "################"],

    ["################",
     "################",
     "#.......o......#",
     "#.......o......#",
     "#.R.W.O.o......#",
     "#.......o......#",
     "#.P.C.C.o..G...#",
     "#.....M.o......#",
     "#.......o......#",
     "#.......o......#",
     "################",
     "################",
     "################",
     "################",
     "################",
     "################"],

    ["################",
     "################",
     "#.R.R.R.R.W.M..#",
     "#..............#",
     "#..............#",
     "#......#.......#",
     "#.P..C.#.o.G####",
     "#......#.......#",
     "#..............#",
     "################",
     "################",
     "################",
     "################",
     "################",
     "################",
     "################"],
]


def _parse(rows: list[str]) -> dict:
    base = [list(r) for r in rows]
    parts: list[tuple[int, int, str]] = []
    crates: list[tuple[int, int]] = []
    start = goal = None
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in PART_KINDS:
                parts.append((x, y, ch))
                base[y][x] = "."
            elif ch == "C":
                crates.append((x, y))
                base[y][x] = "."
            elif ch == "P":
                start = (x, y)
                base[y][x] = "."
            elif ch == "G":
                goal = (x, y)
    if start is None or goal is None or not crates:
        raise ValueError("level needs a start, a goal and at least one payload")
    return {
        "rows": rows,
        "base": ["".join(r) for r in base],
        "parts": parts,
        "crates": tuple(sorted(crates)),
        "start": start,
        "goal": goal,
    }


LEVELS = [_parse(rows) for rows in LEVELS_SPEC]


def initial_state(index: int) -> tuple:
    lv = LEVELS[index]
    return (lv["start"][0], lv["start"][1], 1, 0, (),
            tuple(0 for _ in lv["parts"]), lv["crates"], (), ())


def _in_bounds(x: int, y: int) -> bool:
    return 0 <= x < N and 0 <= y < N


def _is_wall(lv: dict, opened: tuple, x: int, y: int) -> bool:
    return lv["base"][y][x] == "#" and (x, y) not in opened


def _is_pit(lv: dict, filled: tuple, x: int, y: int) -> bool:
    return lv["base"][y][x] == "o" and (x, y) not in filled


def _player_can_stand(lv, opened, filled, crates, x, y) -> bool:
    return (_in_bounds(x, y) and not _is_wall(lv, opened, x, y)
            and not _is_pit(lv, filled, x, y) and (x, y) not in crates)


def _crate_can_rest(lv, opened, filled, crates, x, y) -> bool:
    return (_in_bounds(x, y) and not _is_wall(lv, opened, x, y)
            and not _is_pit(lv, filled, x, y) and (x, y) not in crates)


def _tool(lv: dict, hands: tuple) -> str | None:
    if len(hands) != 2:
        return None
    key = tuple(sorted(lv["parts"][i][2] for i in hands))
    return PAIRS.get(key)


def _fire(lv, tool, px, py, dx, dy, crates, opened, filled):
    if tool == "drill":
        tx, ty = px + dx, py + dy
        if (_in_bounds(tx, ty) and 0 < tx < N - 1 and 0 < ty < N - 1
                and _is_wall(lv, opened, tx, ty)):
            return px, py, crates, tuple(sorted(opened + ((tx, ty),))), filled

    elif tool == "plank":
        tx, ty = px + dx, py + dy
        if _in_bounds(tx, ty) and _is_pit(lv, filled, tx, ty):
            return px, py, crates, opened, tuple(sorted(filled + ((tx, ty),)))

    elif tool == "cart":
        cx, cy = px + dx, py + dy
        if (cx, cy) in crates:
            rest = [c for c in crates if c != (cx, cy)]
            ax, ay = cx, cy
            while True:
                nx, ny = ax + dx, ay + dy
                if not _in_bounds(nx, ny) or _is_wall(lv, opened, nx, ny) or (nx, ny) in rest:
                    break
                if _is_pit(lv, filled, nx, ny):
                    return (px, py, tuple(sorted(rest)), opened,
                            tuple(sorted(filled + ((nx, ny),))))
                ax, ay = nx, ny
            if (ax, ay) != (cx, cy):
                return px, py, tuple(sorted(rest + [(ax, ay)])), opened, filled

    elif tool == "winch":
        k = 1
        while True:
            sx, sy = px + dx * k, py + dy * k
            if not _in_bounds(sx, sy) or _is_wall(lv, opened, sx, sy):
                break
            if (sx, sy) in crates:
                tx, ty = px + dx, py + dy
                rest = [c for c in crates if c != (sx, sy)]
                if k >= 2 and _crate_can_rest(lv, opened, filled, tuple(rest), tx, ty):
                    return px, py, tuple(sorted(rest + [(tx, ty)])), opened, filled
                break
            k += 1

    elif tool == "grapple":
        k = 1
        while True:
            sx, sy = px + dx * k, py + dy * k
            if (not _in_bounds(sx, sy) or _is_wall(lv, opened, sx, sy)
                    or (sx, sy) in crates):
                break
            k += 1
        land = k - 1
        if land >= 1:
            lx, ly = px + dx * land, py + dy * land
            if _player_can_stand(lv, opened, filled, crates, lx, ly):
                return lx, ly, crates, opened, filled

    return px, py, crates, opened, filled


def step_state(index: int, state: tuple, action: str) -> tuple:
    lv = LEVELS[index]
    px, py, fx, fy, hands, status, crates, opened, filled = state

    if action in DIRS:
        dx, dy = DIRS[action]
        fx, fy = dx, dy
        nx, ny = px + dx, py + dy
        if _player_can_stand(lv, opened, filled, crates, nx, ny):
            px, py = nx, ny
        return (px, py, fx, fy, hands, status, crates, opened, filled)

    if action == "RET":
        st = list(status)
        for i in hands:
            st[i] = 0
        return (px, py, fx, fy, (), tuple(st), crates, opened, filled)

    if action == "ACT":
        tool = _tool(lv, hands)
        if tool is not None:
            world = _fire(lv, tool, px, py, fx, fy, crates, opened, filled)
            if world != (px, py, crates, opened, filled):
                npx, npy, ncr, nop, nfi = world
                st = list(status)
                for i in hands:
                    st[i] = 2
                return (npx, npy, fx, fy, (), tuple(st), ncr, nop, nfi)
            return state
        if len(hands) < 2:
            for i, (qx, qy, _kind) in enumerate(lv["parts"]):
                if status[i] == 0 and (qx, qy) == (px, py):
                    st = list(status)
                    st[i] = 1
                    return (px, py, fx, fy, hands + (i,), tuple(st),
                            crates, opened, filled)
        return state

    return state


def is_won(index: int, state: tuple) -> bool:
    return LEVELS[index]["goal"] in state[6]


def _over(base: list, top: list) -> list:
    px = [row[:] for row in base]
    for y, row in enumerate(top):
        for x, value in enumerate(row):
            if value >= 0:
                px[y][x] = value
    return px


def _stamp_px(grid: np.ndarray, x0: int, y0: int, face: list) -> None:
    height, width = grid.shape
    for dy, row in enumerate(face):
        y = y0 + dy
        if not 0 <= y < height:
            continue
        for dx, value in enumerate(row):
            x = x0 + dx
            if value >= 0 and 0 <= x < width:
                grid[y, x] = value


def _stamp(grid: np.ndarray, cx: int, cy: int, face: list) -> None:
    _stamp_px(grid, cx * CELL, cy * CELL, face)


def _pit_face() -> list:
    return weave(PIT, CELL)


def _deck_face() -> list:
    return _over(ring(WALL, CELL), core(DECK, CELL))


def _goal_face() -> list:
    return ring(GOAL, CELL)


def _crate_face() -> list:
    return rounded(CRATE, CELL)


def _player_face(heading: tuple) -> list:
    return facing(PLAYER, PLAYER_VISOR, heading, CELL)


def _part_face(kind: str) -> list:
    if kind == "R":
        return key_shape(PART, CELL)
    if kind == "W":
        return ring(PART, CELL)
    if kind == "M":
        return _over(rounded(PART, CELL), core(PART_CORE, CELL))
    return hatch(PART, CELL)


def _wall_extra(x: int, y: int, tick: int) -> list | None:
    if (x * 3 + y * 5) % 7:
        return None
    return fixture((WALL, WALL, FLOOR, WALL, WALL, WALL, FLOOR), tick,
                   (x + y) % 7, CELL)


def _paint(index: int, state: tuple, tick: int = 0,
           omit_crate: tuple | None = None, omit_player: bool = False) -> np.ndarray:
    lv = LEVELS[index]
    px, py, fx, fy, _hands, status, crates, opened, filled = state
    grid = np.full((N * CELL, N * CELL), FLOOR, dtype=np.int8)

    for y in range(N):
        for x in range(N):
            ch = lv["base"][y][x]
            if ch == "#":
                if (x, y) in opened:
                    continue
                grid[y * CELL:y * CELL + CELL, x * CELL:x * CELL + CELL] = WALL
                extra = _wall_extra(x, y, tick)
                if extra is not None:
                    _stamp(grid, x, y, extra)
            elif ch == "o":
                _stamp(grid, x, y, _deck_face() if (x, y) in filled else _pit_face())
            elif ch == "G":
                _stamp(grid, x, y, _goal_face())

    for i, (qx, qy, kind) in enumerate(lv["parts"]):
        if status[i] == 0:
            _stamp(grid, qx, qy, _part_face(kind))
    for cx, cy in crates:
        if (cx, cy) != omit_crate:
            _stamp(grid, cx, cy, _crate_face())
    if not omit_player:
        _stamp(grid, px, py, _player_face((fx, fy)))
    return grid


def _transit(before: tuple, after: tuple):
    moved_player = (before[0], before[1]) != (after[0], after[1])
    gone = set(before[6]) - set(after[6])
    came = set(after[6]) - set(before[6])
    dug = set(after[7]) - set(before[7])
    decked = set(after[8]) - set(before[8])

    if moved_player and not gone and not came and not dug and not decked:
        return "player", (before[0], before[1]), (after[0], after[1])
    if moved_player:
        return None
    if len(gone) == 1 and len(came) == 1 and not dug and not decked:
        return "crate", gone.pop(), came.pop()
    if len(gone) == 1 and not came and not dug and len(decked) == 1:
        return "crate", gone.pop(), decked.pop()
    if not gone and not came and len(dug) == 1 and not decked:
        return "break", dug.pop(), None
    if not gone and not came and not dug and len(decked) == 1:
        return "deck", decked.pop(), None
    return None


def _paint_flight(index: int, before: tuple, after: tuple, flight: tuple,
                  step: int, span: int, tick: int) -> np.ndarray:
    kind, src, dst = flight
    if kind == "crate":
        grid = _paint(index, before, tick, omit_crate=src)
        _stamp_px(grid, tween(src[0] * CELL, dst[0] * CELL, step, span),
                  tween(src[1] * CELL, dst[1] * CELL, step, span), _crate_face())
        return grid
    if kind == "player":
        grid = _paint(index, before, tick, omit_player=True)
        _stamp_px(grid, tween(src[0] * CELL, dst[0] * CELL, step, span),
                  tween(src[1] * CELL, dst[1] * CELL, step, span),
                  _player_face((before[2], before[3])))
        return grid
    grid = _paint(index, before, tick)
    half = step >= span // 2
    if kind == "break":
        _stamp(grid, src[0], src[1],
               weave(FLOOR, CELL) if half else hatch(FLOOR, CELL))
    else:
        _stamp(grid, src[0], src[1],
               _deck_face() if half else _over(_pit_face(), hatch(DECK, CELL)))
    return grid


def build_levels() -> list[Level]:
    levels = []
    for i in range(len(LEVELS)):
        canvas = Sprite(
            pixels=_paint(i, initial_state(i)), name="canvas",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=0,
        ).set_position(0, 0)
        levels.append(Level(sprites=[canvas], grid_size=(N * CELL, N * CELL)))
    return levels


RACK_X = N * CELL - CELL
RACK_TOP, RACK_BOTTOM = 18, 39
SLOT_Y = (22, 31)


class G015A(RenderableUserDisplay):

    def __init__(self, game: "G015") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        lv = LEVELS[self._game.level_index]
        hands = self._game.state[4]
        frame[RACK_TOP:RACK_BOTTOM, RACK_X:RACK_X + CELL] = WALL
        hairline(frame, (RACK_X + 1, RACK_TOP), (RACK_X + 1, RACK_BOTTOM - 1), SLOT_EMPTY)
        for slot, top in enumerate(SLOT_Y):
            face = (_part_face(lv["parts"][hands[slot]][2]) if slot < len(hands)
                    else ring(SLOT_EMPTY, CELL))
            _stamp_px(frame, RACK_X, top, face)
        return frame


class G015(ARCBaseGame):

    FIRE_FRAMES = 5

    def __init__(self) -> None:
        self.state = initial_state(0)
        self.tick = 0
        self._pending = None
        self._flight = None
        self._playing = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G015A(self)],
        )
        super().__init__(game_id="g015", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self.state = initial_state(self.level_index)
        self._pending = None
        self._flight = None
        self._playing = 0
        self._repaint()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _repaint(self) -> None:
        canvas = self.current_level.get_sprites_by_name("canvas")
        if canvas:
            canvas[0].pixels = _paint(self.level_index, self.state, self.tick)

    def _repaint_flight(self, step: int) -> None:
        canvas = self.current_level.get_sprites_by_name("canvas")
        if canvas:
            canvas[0].pixels = _paint_flight(
                self.level_index, self.state, self._pending, self._flight,
                step, self.FIRE_FRAMES, self.tick)

    def _settle(self) -> None:
        self.state = self._pending
        self._pending = None
        self._flight = None
        self._repaint()

    def step(self) -> None:
        if self._playing:
            self._playing -= 1
            if self._playing == 0:
                self._settle()
                if is_won(self.level_index, self.state):
                    self.next_level()
                self.complete_action()
                return
            self._repaint_flight(self.FIRE_FRAMES - self._playing)
            return

        action = {
            GameAction.ACTION1: "U",
            GameAction.ACTION2: "D",
            GameAction.ACTION3: "L",
            GameAction.ACTION4: "R",
            GameAction.ACTION5: "ACT",
            GameAction.ACTION6: "RET",
        }.get(self.action.id)

        self.tick += 1

        if action is not None:
            nxt = step_state(self.level_index, self.state, action)
            spent = sum(s == 2 for s in nxt[5]) > sum(s == 2 for s in self.state[5])
            flight = _transit(self.state, nxt) if spent else None
            if flight is not None:
                self._pending = nxt
                self._flight = flight
                self._playing = self.FIRE_FRAMES
                self._repaint_flight(0)
                return
            self.state = nxt
            self._repaint()
            if is_won(self.level_index, self.state):
                self.next_level()

        self.complete_action()
