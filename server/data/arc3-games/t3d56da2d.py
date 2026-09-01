# ARC-AGI-3 candidate task t3d56da2d.

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

FLOOR = 4
WALL = 3
PIT = 5
FILLED = 2
GOAL = 14
CRATE = 13
PLAYER = 12
SLOT_EMPTY = 1

ROD, WHEEL, MOTOR, ROPE = 0, 9, 8, 11
PART_COLOUR = {"R": ROD, "W": WHEEL, "M": MOTOR, "O": ROPE}

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
            if ch in PART_COLOUR:
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


def _paint(index: int, state: tuple) -> np.ndarray:
    lv = LEVELS[index]
    px, py, _fx, _fy, _hands, status, crates, opened, filled = state
    grid = np.full((N * CELL, N * CELL), FLOOR, dtype=np.int8)

    def put(cx: int, cy: int, colour: int, inset: int = 0) -> None:
        x0, y0 = cx * CELL + inset, cy * CELL + inset
        grid[y0:cy * CELL + CELL - inset, x0:cx * CELL + CELL - inset] = colour

    for y in range(N):
        for x in range(N):
            ch = lv["base"][y][x]
            if ch == "#":
                put(x, y, FLOOR if (x, y) in opened else WALL)
            elif ch == "o":
                put(x, y, FILLED if (x, y) in filled else PIT)
            elif ch == "G":
                put(x, y, GOAL)
    for i, (qx, qy, kind) in enumerate(lv["parts"]):
        if status[i] == 0:
            put(qx, qy, PART_COLOUR[kind], inset=1)
    for cx, cy in crates:
        put(cx, cy, CRATE)
    put(px, py, PLAYER, inset=0)
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


class G88cd34da(RenderableUserDisplay):

    def __init__(self, game: "G8fbd710f") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        lv = LEVELS[self._game.level_index]
        hands = self._game.state[4]
        for slot in range(2):
            colour = SLOT_EMPTY
            if slot < len(hands):
                colour = PART_COLOUR[lv["parts"][hands[slot]][2]]
            x = 1 + slot * 3
            frame[1:3, x:x + 2] = colour
        return frame


class G8fbd710f(ARCBaseGame):

    def __init__(self) -> None:
        self.state = initial_state(0)
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G88cd34da(self)],
        )
        super().__init__(game_id="t3d56da2d", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self.state = initial_state(self.level_index)
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
            canvas[0].pixels = _paint(self.level_index, self.state)

    def step(self) -> None:
        action = {
            GameAction.ACTION1: "U",
            GameAction.ACTION2: "D",
            GameAction.ACTION3: "L",
            GameAction.ACTION4: "R",
            GameAction.ACTION5: "ACT",
            GameAction.ACTION6: "RET",
        }.get(self.action.id)

        if action is not None:
            self.state = step_state(self.level_index, self.state, action)
            self._repaint()
            if is_won(self.level_index, self.state):
                self.next_level()

        self.complete_action()
