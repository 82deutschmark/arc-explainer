# ARC-AGI-3 candidate task g025.

import numpy as np

from sprite_book import (
    blink,
    core,
    dither,
    door,
    facing,
    fixture,
    key_shape,
    medallion,
    outline,
    ring,
    rounded,
    studs,
    weave,
)

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

FLOOR = 15
WALL = 2
GAP = 2
CRATE = 2
VINE = 14
ICE = 0
SHUTTER = 2
SHUTTER_BAR = 8
EXIT = 14
EXIT_FRAME = 0
PLAYER = 11
VISOR = 8
SPARK = 0
PIP_ON = 14
SOCKET = FLOOR
FITTING = (FLOOR, WALL, WALL, WALL, WALL)

MAGNET, ROD, LENS, TORCH, HOOK, BELL = range(6)
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
     "#..............#",
     "#.M..........L.#",
     "#..............#",
     "#P...........T.#",
     "#.R............#",
     "#______________#",
     "#..............#",
     "#..............#",
     "#.........C....#",
     "######V#########",
     "#..............#",
     "#......X.......#",
     "#..............#",
     "#..............#",
     "################"],
    ["################",
     "#..............#",
     "#.M..........R.#",
     "#P.............#",
     "#..............#",
     "#______________#",
     "#..............#",
     "#......C..B....#",
     "#..............#",
     "######H#########",
     "#..............#",
     "#......X.......#",
     "#..............#",
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


def tool_pixels(tid: int):
    if tid == MAGNET:
        return ring(8)
    if tid == ROD:
        return core(0)
    if tid == LENS:
        return ring(0)
    if tid == TORCH:
        return medallion(0, 8)
    if tid == HOOK:
        return key_shape(0)
    return ring(14)


HAND_ROWS = (5, 7)
BELL_TOP = 34
BELL_GAP = 7


def _fitting_cell(x: int, y: int) -> bool:
    return 0 < x < N - 1 and 0 < y < N - 1 and (x * 7 + y * 3) % 5 == 0


def _changed_cells(lv, before: tuple, after: tuple) -> tuple:
    if before == after:
        return ()
    cells = set(before[6]) ^ set(after[6])
    cells |= set(after[7]) - set(before[7])
    cells |= set(after[8]) - set(before[8])
    cells |= set(after[9]) - set(before[9])
    if (before[10] > 0) != (after[10] > 0):
        cells |= set(lv["shutters"])
    if (before[0], before[1]) != (after[0], after[1]):
        cells.add((before[0], before[1]))
        cells.add((after[0], after[1]))
    return tuple(sorted(cells))


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


class G025A(RenderableUserDisplay):

    def __init__(self, game: "G025") -> None:
        super().__init__()
        self._game = game

    def _stamp(self, frame, x, y, pixels, under=None) -> None:
        oy, ox = y * CELL, x * CELL
        if under is not None:
            for dy in range(1, CELL - 1):
                for dx in range(1, CELL - 1):
                    frame[oy + dy, ox + dx] = under
        for dy in range(CELL):
            for dx in range(CELL):
                v = pixels[dy][dx]
                if v >= 0:
                    frame[oy + dy, ox + dx] = v

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game
        lv = LEVELS[g.level_index]
        px, py, fx, fy, hands, floor, crates, burned, melted, filled, timer, _d = g.state

        for y in range(N):
            for x in range(N):
                ch = lv["base"][y][x]
                if ch == "#":
                    if _fitting_cell(x, y):
                        self._stamp(frame, x, y, fixture(FITTING, g.tick, x + y))
                elif ch == "_" and (x, y) not in filled:
                    self._stamp(frame, x, y, weave(GAP))
                elif ch == "V" and (x, y) not in burned:
                    self._stamp(frame, x, y, weave(VINE))
                elif ch == "I" and (x, y) not in melted:
                    self._stamp(frame, x, y, rounded(ICE))
                elif ch == "H":
                    if timer > 0:
                        frame[y * CELL, x * CELL:(x + 1) * CELL] = SHUTTER
                    else:
                        self._stamp(frame, x, y, door(SHUTTER, SHUTTER_BAR))
                elif ch == "X":
                    self._stamp(frame, x, y, door(EXIT_FRAME, EXIT))

        for cx, cy in crates:
            self._stamp(frame, cx, cy, rounded(CRATE))

        for tid, tx, ty in floor:
            self._stamp(frame, tx, ty, tool_pixels(tid))

        self._stamp(frame, px, py, facing(PLAYER, VISOR, (fx, fy)))

        if g.flash and blink(g.flash, 1):
            for cx, cy in g.marks:
                dither(frame, (cx * CELL, cy * CELL, (cx + 1) * CELL, (cy + 1) * CELL), SPARK)

        if g.arrive:
            ex, ey = lv["exit"]
            k = G025.ARRIVE_FRAMES - g.arrive
            outline(frame, (ex * CELL - k, ey * CELL - k,
                            (ex + 1) * CELL + k, (ey + 1) * CELL + k), SPARK)

        for slot in range(2):
            y = HAND_ROWS[slot]
            if slot < len(hands):
                self._stamp(frame, 0, y, tool_pixels(hands[slot]), under=SOCKET)
            else:
                self._stamp(frame, 0, y, core(SOCKET))
        studs(frame, RING_TURNS, timer, PIP_ON, SOCKET,
              side="east", start=BELL_TOP, gap=BELL_GAP)
        return frame


class G025(ARCBaseGame):

    FLASH_FRAMES = 4
    ARRIVE_FRAMES = 4

    def __init__(self) -> None:
        self.state = initial_state(0)
        self.tick = 0
        self.flash = 0
        self.arrive = 0
        self.marks: tuple = ()
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G025A(self)],
        )
        super().__init__(game_id="g025", levels=build_levels(), camera=camera)

    def _rearm(self) -> None:
        self.state = initial_state(self.level_index)
        self.flash = 0
        self.arrive = 0
        self.marks = ()

    def on_set_level(self, level: Level) -> None:
        self._rearm()

    def level_reset(self) -> None:
        super().level_reset()
        self._rearm()

    def full_reset(self) -> None:
        super().full_reset()
        self.tick = 0
        self._rearm()

    def _settle(self, action: str) -> None:
        self.state = step_state(self.level_index, self.state, action)
        self.tick += 1
        if is_won(self.state):
            self.arrive = self.ARRIVE_FRAMES
            return
        self.complete_action()

    def step(self) -> None:
        if self.arrive:
            self.arrive -= 1
            if self.arrive == 0:
                self.next_level()
                self.complete_action()
            return

        if self.flash:
            self.flash -= 1
            if self.flash == 0:
                self.marks = ()
                self._settle("F")
            return

        action = {
            GameAction.ACTION1: "U",
            GameAction.ACTION2: "D",
            GameAction.ACTION3: "L",
            GameAction.ACTION4: "R",
            GameAction.ACTION5: "F",
            GameAction.ACTION6: "Z",
        }.get(self.action.id)
        if action is None:
            self.complete_action()
            return

        if action == "F":
            bitten = _fire(LEVELS[self.level_index], self.state)
            marks = _changed_cells(LEVELS[self.level_index], self.state, bitten)
            if marks:
                self.marks = marks
                self.flash = self.FLASH_FRAMES
                return

        self._settle(action)
