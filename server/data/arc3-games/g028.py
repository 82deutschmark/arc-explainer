# ARC-AGI-3 candidate task g028.

import numpy as np

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

OUTSIDE = 5
FLOOR = 1
WALL = 3
KEY = 11
LOCK = 9
EXIT = 14
PLAYER = 12
PLAYER_ARMED = 8
CREASE = 6
PLY = 10

CELL = 4
SIDE = 64

LEVELS_SPEC = [
    ["................",
     "................",
     "..S.............",
     "................",
     "................",
     "................",
     "................",
     "...........###..",
     "k..........lX#..",
     "...........###..",
     "................",
     "................",
     "................",
     "................",
     "................",
     "................"],

    ["................",
     "................",
     "...S............",
     "................",
     "........k.......",
     "................",
     "................",
     "................",
     "................",
     "................",
     "................",
     ".......#l#......",
     ".......#X#......",
     ".......###......",
     "................",
     "................"],

    ["................",
     "................",
     "..S.............",
     "................",
     "................",
     "................",
     "...........#.#..",
     ".k.k.......#l#..",
     "...#.......#X#..",
     "...........###..",
     "................",
     "................",
     "................",
     "................",
     "................",
     "................"],

    ["................",
     ".S..............",
     "................",
     "..k.............",
     "................",
     "................",
     "................",
     "...........###..",
     "...........lX#..",
     "...........###..",
     "................",
     "................",
     "................",
     "................",
     "................",
     "................"],

    ["................",
     ".........#......",
     "..S......#......",
     ".........#......",
     ".........#......",
     ".........#......",
     ".........#......",
     "...........###..",
     "k..........lX#..",
     "...........###..",
     ".........#......",
     ".........#......",
     ".........#......",
     ".........#......",
     ".........#......",
     "................"],

    ["................",
     "................",
     "................",
     "................",
     "................",
     "................",
     "...........###..",
     "...........lX#..",
     "...........###..",
     "................",
     "................",
     "................",
     "..k.............",
     "................",
     ".S..............",
     "................"],

    ["......#.........",
     "......#.........",
     "..S...#.........",
     "......#.........",
     "......#.........",
     "......#.........",
     "......#....###..",
     "k.....#....lX#..",
     "......#....###..",
     "......#.........",
     "......#.........",
     "......#.........",
     "......#.........",
     "......#.........",
     "......#.........",
     "......#........."],

    ["......#.........",
     "......#.........",
     "..S...#.........",
     "......#.........",
     "......#.........",
     "......#.........",
     "......#....#.#..",
     ".k.k..#....#l#..",
     "...#..#....#X#..",
     "......#....###..",
     "......#.........",
     "......#.........",
     "......#.........",
     "......#.........",
     "......#.........",
     "......#........."],
]

N = 16
FOLD_KEYS = {"L": "V", "R": "V", "U": "H", "D": "H"}


def parse_level(rows: list[str]) -> tuple[list[list[str]], int, int]:
    board, px, py = [], 0, 0
    for y, row in enumerate(rows):
        line = []
        for x, ch in enumerate(row):
            if ch == "S":
                px, py = x, y
                line.append(".")
            else:
                line.append(ch)
        board.append(line)
    return board, px, py


def merge_cell(a: str, b: str) -> str:
    if a == "#" or b == "#":
        return "#"
    pair = {a, b}
    if "k" in pair and "l" in pair:
        return "."
    if "X" in pair:
        return "X"
    if "l" in pair:
        return "l"
    if "k" in pair:
        return "k"
    return "."


def fold_geometry(span: int, idx: int, pos: int) -> tuple[int, int, int]:
    if pos < idx:
        keep_lo, keep_hi = idx, span
    else:
        keep_lo, keep_hi = 0, idx
    return keep_lo, keep_hi, 2 * idx - 1 - pos - keep_lo


def fold_board(board, ply, px, py, orient, idx):
    h, w = len(board), len(board[0])
    span, pos = (w, px) if orient == "V" else (h, py)
    keep_lo, keep_hi, landed = fold_geometry(span, idx, pos)
    new_span = keep_hi - keep_lo

    def source(j: int) -> tuple[int, int | None]:
        base = keep_lo + j
        mirror = 2 * idx - 1 - base
        if keep_lo <= mirror < keep_hi or not (0 <= mirror < span):
            mirror = None
        return base, mirror

    if orient == "V":
        nb = [[None] * new_span for _ in range(h)]
        npl = [[0] * new_span for _ in range(h)]
        for y in range(h):
            for j in range(new_span):
                base, mirror = source(j)
                if mirror is None:
                    nb[y][j], npl[y][j] = board[y][base], ply[y][base]
                else:
                    nb[y][j] = merge_cell(board[y][base], board[y][mirror])
                    npl[y][j] = ply[y][base] + ply[y][mirror]
    else:
        nb = [[None] * w for _ in range(new_span)]
        npl = [[0] * w for _ in range(new_span)]
        for i in range(new_span):
            base, mirror = source(i)
            for x in range(w):
                if mirror is None:
                    nb[i][x], npl[i][x] = board[base][x], ply[base][x]
                else:
                    nb[i][x] = merge_cell(board[base][x], board[mirror][x])
                    npl[i][x] = ply[base][x] + ply[mirror][x]

    crushed = not (0 <= landed < new_span)
    if orient == "V":
        nx, ny = landed, py
    else:
        nx, ny = px, landed
    if not crushed and nb[ny][nx] != ".":
        crushed = True
    return nb, npl, nx, ny, crushed


def build_levels() -> list[Level]:
    blank = [[OUTSIDE] * SIDE for _ in range(SIDE)]
    return [
        Level(sprites=[Sprite(pixels=[row[:] for row in blank], name="sheet",
                              blocking=BlockingMode.NOT_BLOCKED,
                              interaction=InteractionMode.INTANGIBLE, layer=0)
                       .set_position(0, 0)],
              grid_size=(SIDE, SIDE))
        for _ in LEVELS_SPEC
    ]


COLOUR = {".": FLOOR, "#": WALL, "k": KEY, "l": LOCK, "X": EXIT}


class G028(ARCBaseGame):

    def __init__(self) -> None:
        self.board, self.px, self.py = parse_level(LEVELS_SPEC[0])
        self.ply = [[1] * N for _ in range(N)]
        self.armed = False
        self.orient = "V"
        self.crease = 1
        super().__init__(
            game_id="g028",
            levels=build_levels(),
            camera=Camera(width=SIDE, height=SIDE, background=OUTSIDE, letter_box=OUTSIDE),
        )
        self._paint()

    def on_set_level(self, level: Level) -> None:
        self.board, self.px, self.py = parse_level(LEVELS_SPEC[self.level_index])
        self.ply = [[1] * N for _ in range(N)]
        self.armed = False
        self.orient = "V"
        self.crease = 1
        self._paint()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _paint(self) -> None:
        sprites = self.current_level.get_sprites_by_name("sheet")
        if not sprites:
            return
        h, w = len(self.board), len(self.board[0])
        frame = np.full((SIDE, SIDE), OUTSIDE, dtype=np.int8)
        for y in range(h):
            for x in range(w):
                ch = self.board[y][x]
                block = COLOUR[ch]
                y0, x0 = y * CELL, x * CELL
                frame[y0:y0 + CELL, x0:x0 + CELL] = block
                if self.ply[y][x] > 1 and ch != "#":
                    for cy in (y0, y0 + CELL - 1):
                        for cx in (x0, x0 + CELL - 1):
                            frame[cy, cx] = PLY
        y0, x0 = self.py * CELL, self.px * CELL
        frame[y0 + 1:y0 + CELL - 1, x0 + 1:x0 + CELL - 1] = (
            PLAYER_ARMED if self.armed else PLAYER)
        if self.armed:
            if self.orient == "V":
                frame[0:h * CELL, self.crease * CELL] = CREASE
            else:
                frame[self.crease * CELL, 0:w * CELL] = CREASE
        sprites[0].pixels = frame

    def _walk(self, dx: int, dy: int) -> None:
        nx, ny = self.px + dx, self.py + dy
        if not (0 <= nx < len(self.board[0]) and 0 <= ny < len(self.board)):
            return
        cell = self.board[ny][nx]
        if cell in ("#", "k", "l"):
            return
        self.px, self.py = nx, ny
        if cell == "X":
            self.next_level()

    def _aim(self, key: str) -> None:
        h, w = len(self.board), len(self.board[0])
        want = FOLD_KEYS[key]
        limit = (w if want == "V" else h) - 1
        if limit < 1:
            return
        if self.orient != want:
            self.orient = want
            anchor = self.px if want == "V" else self.py
            self.crease = min(max(anchor, 1), limit)
            return
        self.crease = min(max(self.crease + (1 if key in ("R", "D") else -1), 1), limit)

    def _commit(self) -> None:
        board, ply, nx, ny, crushed = fold_board(
            self.board, self.ply, self.px, self.py, self.orient, self.crease)
        self.armed = False
        if crushed:
            self.level_reset()
            return
        self.board, self.ply, self.px, self.py = board, ply, nx, ny
        self.orient = "V"
        self.crease = 1

    def step(self) -> None:
        act = self.action.id
        if act == GameAction.ACTION7:
            self.armed = False
        elif act == GameAction.ACTION5:
            if self.armed:
                self._commit()
            else:
                self.armed = True
                self.orient = "V"
                self.crease = min(max(self.px, 1), len(self.board[0]) - 1)
        elif act in (GameAction.ACTION1, GameAction.ACTION2,
                     GameAction.ACTION3, GameAction.ACTION4):
            key = {GameAction.ACTION1: "U", GameAction.ACTION2: "D",
                   GameAction.ACTION3: "L", GameAction.ACTION4: "R"}[act]
            if self.armed:
                self._aim(key)
            else:
                self._walk({"L": -1, "R": 1}.get(key, 0), {"U": -1, "D": 1}.get(key, 0))
        self._paint()
        self.complete_action()
