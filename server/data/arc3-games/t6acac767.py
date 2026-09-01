# ARC-AGI-3 candidate task t6acac767.

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
WALL = 1
GAP = 5
CRATE = 2
VINE = 14
ICE = 7
SHUTTER = 13
EXIT = 6
PLAYER = 10
PIP_OFF = 9

MAGNET, ROD, LENS, TORCH, HOOK, BELL = range(6)
TOOL_COLOUR = {MAGNET: 8, ROD: 1, LENS: 10, TORCH: 12, HOOK: 15, BELL: 11}
TOOL_CHARS = {"M": MAGNET, "R": ROD, "L": LENS, "T": TORCH, "K": HOOK, "B": BELL}

PAIRS = {
    tuple(sorted((MAGNET, ROD))): "drag",
    tuple(sorted((LENS, TORCH))): "burn",
    tuple(sorted((HOOK, ROD))): "grapple",
    tuple(sorted((BELL, MAGNET))): "ring",
    tuple(sorted((TORCH, HOOK))): "melt",
}

RING_TURNS = 3
BURN_REACH = 3
GRAPPLE_SPAN = 2

N = 16
CELL = 4

DIRS = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0)}
ACTIONS = ("U", "D", "L", "R", "F", "Z")

LEVELS_SPEC = [
    ["################",
     "################",
     "################",
     "####.......#####",
     "####.L...T.#####",
     "####.......#####",
     "####.P.....#####",
     "#######V########",
     "####.......#####",
     "####...X...#####",
     "####.......#####",
     "####.......#####",
     "################",
     "################",
     "################",
     "################"],
    ["################",
     "#..............#",
     "#.K..........R.#",
     "#..............#",
     "#....######....#",
     "#....######....#",
     "#.P..######....#",
     "#....######....#",
     "#..............#",
     "#______________#",
     "#______________#",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "################"],
    ["################",
     "#P.............#",
     "#.L..........K.#",
     "#..............#",
     "#..............#",
     "#......T.......#",
     "#####V##########",
     "#..............#",
     "#..............#",
     "##########I#####",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "#..............#",
     "################"],
    ["################",
     "#......P.......#",
     "#.M..........R.#",
     "#..............#",
     "#....K.........#",
     "#______________#",
     "#______________#",
     "#______________#",
     "#......C.......#",
     "#..............#",
     "#..............#",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "################"],
    ["################",
     "#.B..........R.#",
     "#P.............#",
     "#......M.......#",
     "#..............#",
     "#______________#",
     "#......C.......#",
     "#..............#",
     "#..............#",
     "######H#########",
     "#..............#",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "################"],
    ["################",
     "#.T..........R.#",
     "#..............#",
     "#......K.......#",
     "#P.............#",
     "#####I##########",
     "#..............#",
     "#..............#",
     "#..............#",
     "#______________#",
     "#______________#",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "################"],
    ["################",
     "#.B..........L.#",
     "#..............#",
     "#P.............#",
     "#......M.......#",
     "#..........T...#",
     "#..............#",
     "####V###########",
     "#..............#",
     "#..............#",
     "##########H#####",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "################"],
    ["################",
     "#.L..........B.#",
     "#..............#",
     "#P.....M.......#",
     "#..............#",
     "#...........R..#",
     "#______________#",
     "#......C.......#",
     "#..............#",
     "###V######H#####",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "#..............#",
     "################"],
]


def _parse(rows: list[str]) -> dict:
    base: list[list[str]] = []
    tools: dict[tuple[int, int], int] = {}
    crates: list[tuple[int, int]] = []
    start = exit_cell = None
    for y, row in enumerate(rows):
        line: list[str] = []
        for x, ch in enumerate(row):
            if ch in TOOL_CHARS:
                tools[(x, y)] = TOOL_CHARS[ch]
                line.append(".")
            elif ch == "C":
                crates.append((x, y))
                line.append(".")
            elif ch == "P":
                start = (x, y)
                line.append(".")
            else:
                if ch == "X":
                    exit_cell = (x, y)
                line.append(ch)
        base.append(line)
    assert start is not None and exit_cell is not None
    return {
        "rows": rows,
        "base": base,
        "start": start,
        "exit": exit_cell,
        "tools": tools,
        "racks": tuple(sorted(tools)),
        "crates": tuple(sorted(crates)),
        "vines": frozenset((x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "V"),
        "ice": frozenset((x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "I"),
        "gaps": frozenset((x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "_"),
        "shutters": frozenset((x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "H"),
    }


LEVELS = [_parse(rows) for rows in LEVELS_SPEC]
for _lv in LEVELS:
    assert len(_lv["rows"]) == N and all(len(r) == N for r in _lv["rows"])


def initial_state(index: int) -> tuple:
    lv = LEVELS[index]
    sx, sy = lv["start"]
    floor = tuple(sorted((tid, x, y) for (x, y), tid in lv["tools"].items()))
    return (sx, sy, 0, 1, (), floor, lv["crates"], (), (), (), 0, False)


def is_won(state: tuple) -> bool:
    return state[11]


def _in_bounds(x: int, y: int) -> bool:
    return 0 <= x < N and 0 <= y < N


def _blocker(lv, crates, burned, melted, filled, timer, x, y) -> str | None:
    if not _in_bounds(x, y):
        return "#"
    ch = lv["base"][y][x]
    if ch == "#":
        return "#"
    if (x, y) in crates:
        return "C"
    if ch == "V" and (x, y) not in burned:
        return "V"
    if ch == "I" and (x, y) not in melted:
        return "I"
    if ch == "H" and timer <= 0:
        return "H"
    if ch == "_" and (x, y) not in filled:
        return "_"
    return None


def _standable(lv, crates, burned, melted, filled, timer, x, y) -> bool:
    return _blocker(lv, crates, burned, melted, filled, timer, x, y) is None


def _enter(lv, hands, floor, done, x, y):
    taken = None
    if len(hands) < 2:
        for tid, tx, ty in floor:
            if (tx, ty) == (x, y):
                taken = (tid, tx, ty)
                break
    if taken is not None:
        hands = hands + (taken[0],)
        floor = tuple(t for t in floor if t != taken)
    if (x, y) == lv["exit"]:
        done = True
    return x, y, hands, floor, done


def held_pair(hands: tuple) -> str | None:
    if len(hands) != 2:
        return None
    return PAIRS.get(tuple(sorted(hands)))


def _fire(lv, state):
    px, py, fx, fy, hands, floor, crates, burned, melted, filled, timer, done = state
    effect = held_pair(hands)
    if effect is None:
        return state

    if effect == "drag":
        k = 1
        while True:
            cx, cy = px + fx * k, py + fy * k
            if not _in_bounds(cx, cy):
                return state
            b = _blocker(lv, crates, burned, melted, filled, timer, cx, cy)
            if b == "C":
                break
            if b is not None and b != "_":
                return state
            k += 1
        if k < 2:
            return state
        tx, ty = px + fx * (k - 1), py + fy * (k - 1)
        rest = tuple(c for c in crates if c != (cx, cy))
        if lv["base"][ty][tx] == "_" and (tx, ty) not in filled:
            return (px, py, fx, fy, hands, floor, tuple(sorted(rest)), burned, melted,
                    tuple(sorted(filled + ((tx, ty),))), timer, done)
        if (_standable(lv, rest, burned, melted, filled, timer, tx, ty)
                and (tx, ty) != lv["exit"]
                and not any((ox, oy) == (tx, ty) for _t, ox, oy in floor)):
            return (px, py, fx, fy, hands, floor, tuple(sorted(rest + ((tx, ty),))),
                    burned, melted, filled, timer, done)
        return state

    if effect == "burn":
        cleared = []
        for k in range(1, BURN_REACH + 1):
            cx, cy = px + fx * k, py + fy * k
            if not _in_bounds(cx, cy):
                break
            b = _blocker(lv, crates, burned, melted, filled, timer, cx, cy)
            if b == "V":
                cleared.append((cx, cy))
            elif b is not None and b != "_":
                break
        if not cleared:
            return state
        return (px, py, fx, fy, hands, floor, crates,
                tuple(sorted(burned + tuple(cleared))), melted, filled, timer, done)

    if effect == "grapple":
        span = 0
        while span < GRAPPLE_SPAN:
            cx, cy = px + fx * (span + 1), py + fy * (span + 1)
            if _blocker(lv, crates, burned, melted, filled, timer, cx, cy) != "_":
                break
            span += 1
        if span == 0:
            return state
        lx, ly = px + fx * (span + 1), py + fy * (span + 1)
        if not _standable(lv, crates, burned, melted, filled, timer, lx, ly):
            return state
        nx, ny, nh, nf, nd = _enter(lv, hands, floor, done, lx, ly)
        return (nx, ny, fx, fy, nh, nf, crates, burned, melted, filled, timer, nd)

    if effect == "melt":
        cx, cy = px + fx, py + fy
        if _blocker(lv, crates, burned, melted, filled, timer, cx, cy) != "I":
            return state
        return (px, py, fx, fy, hands, floor, crates, burned,
                tuple(sorted(melted + ((cx, cy),))), filled, timer, done)

    if effect == "ring":
        return (px, py, fx, fy, hands, floor, crates, burned, melted, filled,
                RING_TURNS, done)

    return state


def step_state(index: int, state: tuple, action: str) -> tuple:
    if is_won(state):
        return state
    lv = LEVELS[index]
    px, py, fx, fy, hands, floor, crates, burned, melted, filled, timer, done = state
    rang = False

    if action in DIRS:
        dx, dy = DIRS[action]
        fx, fy = dx, dy
        nx, ny = px + dx, py + dy
        if _standable(lv, crates, burned, melted, filled, timer, nx, ny):
            px, py, hands, floor, done = _enter(lv, hands, floor, done, nx, ny)
        new = (px, py, fx, fy, hands, floor, crates, burned, melted, filled, timer, done)

    elif action == "F":
        new = _fire(lv, state)
        rang = held_pair(hands) == "ring"

    elif action == "Z":
        if (hands and (px, py) != lv["exit"]
                and not any((ox, oy) == (px, py) for _t, ox, oy in floor)):
            tid = hands[-1]
            new = (px, py, fx, fy, hands[:-1],
                   tuple(sorted(floor + ((tid, px, py),))),
                   crates, burned, melted, filled, timer, done)
        else:
            new = state
    else:
        new = state

    if not rang and new[10] > 0:
        new = new[:10] + (new[10] - 1,) + new[11:]
    return new


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for lv in LEVELS:
        sprites: list[Sprite] = [
            Sprite(pixels=[[FLOOR] * (N * CELL) for _ in range(N * CELL)], name="pad",
                   blocking=BlockingMode.NOT_BLOCKED,
                   interaction=InteractionMode.INTANGIBLE, layer=-2,
                   tags=["sys_click", "sys_every_pixel"]).set_position(0, 0),
        ]
        for y in range(N):
            for x in range(N):
                if lv["base"][y][x] == "#":
                    sprites.append(Sprite(
                        pixels=[[WALL] * CELL for _ in range(CELL)], name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(x * CELL, y * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class Gbb19bafb(RenderableUserDisplay):

    def __init__(self, game: "Gec73c7e1") -> None:
        super().__init__()
        self._game = game

    def _cell(self, frame, x, y, colour):
        frame[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = colour

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game
        lv = LEVELS[g.level_index]
        px, py, fx, fy, hands, floor, crates, burned, melted, filled, timer, _d = g.state

        for y in range(N):
            for x in range(N):
                ch = lv["base"][y][x]
                if ch == "_" and (x, y) not in filled:
                    self._cell(frame, x, y, GAP)
                elif ch == "V" and (x, y) not in burned:
                    self._cell(frame, x, y, VINE)
                elif ch == "I" and (x, y) not in melted:
                    self._cell(frame, x, y, ICE)
                elif ch == "H":
                    if timer > 0:
                        frame[y * CELL, x * CELL:(x + 1) * CELL] = SHUTTER
                    else:
                        self._cell(frame, x, y, SHUTTER)
                elif ch == "X":
                    self._cell(frame, x, y, EXIT)

        for cx, cy in crates:
            self._cell(frame, cx, cy, CRATE)

        for tid, tx, ty in floor:
            self._cell(frame, tx, ty, TOOL_COLOUR[tid])
            frame[ty * CELL + 1:ty * CELL + 3, tx * CELL + 1:tx * CELL + 3] = FLOOR

        self._cell(frame, px, py, PLAYER)
        ox, oy = px * CELL, py * CELL
        if fy == -1:
            frame[oy, ox + 1:ox + 3] = GAP
        elif fy == 1:
            frame[oy + CELL - 1, ox + 1:ox + 3] = GAP
        elif fx == -1:
            frame[oy + 1:oy + 3, ox] = GAP
        else:
            frame[oy + 1:oy + 3, ox + CELL - 1] = GAP

        for slot in range(2):
            colour = TOOL_COLOUR[hands[slot]] if slot < len(hands) else PIP_OFF
            x0 = 1 + slot * 4
            frame[1:3, x0:x0 + 3] = colour
        for i in range(RING_TURNS):
            x0 = 55 + i * 3
            frame[1:3, x0:x0 + 2] = TOOL_COLOUR[BELL] if i < timer else PIP_OFF
        return frame


class Gec73c7e1(ARCBaseGame):

    def __init__(self) -> None:
        self.state = initial_state(0)
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[Gbb19bafb(self)],
        )
        super().__init__(game_id="t6acac767", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self.state = initial_state(self.level_index)

    def level_reset(self) -> None:
        super().level_reset()
        self.state = initial_state(self.level_index)

    def full_reset(self) -> None:
        super().full_reset()
        self.state = initial_state(self.level_index)

    def step(self) -> None:
        action = {
            GameAction.ACTION1: "U",
            GameAction.ACTION2: "D",
            GameAction.ACTION3: "L",
            GameAction.ACTION4: "R",
            GameAction.ACTION5: "F",
            GameAction.ACTION6: "Z",
        }.get(self.action.id)
        if action is not None:
            self.state = step_state(self.level_index, self.state, action)
            if is_won(self.state):
                self.next_level()
        self.complete_action()
