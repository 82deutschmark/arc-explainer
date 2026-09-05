# ARC-AGI-3 candidate task g009.

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

def medallion(rim: int, centre: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    last = cell - 1
    for x in range(1, last):
        px[0][x] = px[last][x] = rim
    for y in range(1, last):
        px[y][0] = px[y][last] = rim
    for y in range(1, last):
        for x in range(1, last):
            px[y][x] = centre
    return px

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

def speckle(colour: int, seed: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(cell):
        for x in range(cell):
            if (x * 7 + y * 13 + seed * 31) % 5 == 0:
                px[y][x] = colour
    return px

def outline(frame, box: tuple, colour: int):
    x0, y0, x1, y1 = box
    h, w = frame.shape
    for x in range(max(0, x0), min(w, x1)):
        if 0 <= y0 < h:
            frame[y0, x] = colour
        if 0 <= y1 - 1 < h:
            frame[y1 - 1, x] = colour
    for y in range(max(0, y0), min(h, y1)):
        if 0 <= x0 < w:
            frame[y, x0] = colour
        if 0 <= x1 - 1 < w:
            frame[y, x1 - 1] = colour
    return frame


FLOOR = 10
HARD = 4
WALL = 5
PAD = HARD
GLASS = HARD

WHITE, RED, GREEN, BLUE = 5, 6, 7, 14

N = 16
CELL = 4
WIN_FLASH = 4

WELD = {"/": "F", "\\": "K", "+": "S"}
FILTER_COLOUR = {"r": RED, "g": GREEN, "b": BLUE}
SINK_COLOUR = {"W": WHITE, "R": RED, "G": GREEN, "B": BLUE}
EMITTER_DIR = {">": (1, 0), "<": (-1, 0), "^": (0, -1), "v": (0, 1)}
BIN_ORDER = ["F", "K", "S", "r", "g", "b"]

LEVELS_SPEC = [
    {"bin": {"F": 1}, "rows": [
        "################",
        "################",
        "#..............#",
        "#..............#",
        "#.....W........#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#>..o.o...o....#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"bin": {"F": 1, "K": 1}, "rows": [
        "################",
        "################",
        "#..............#",
        "#..W...o.......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#......o.......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#>..o..o..o....#",
        "#..............#",
        "################",
    ]},
    {"bin": {"F": 1, "K": 1, "S": 1}, "rows": [
        "################",
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.....o...o..o.#",
        "#..............#",
        "#..............#",
        "#>..o.o...o..W.#",
        "#..............#",
        "#..............#",
        "#.....o........#",
        "#.........W....#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"bin": {"F": 1, "K": 1, "S": 1, "r": 1}, "rows": [
        "################",
        "################",
        "#..............#",
        "#..............#",
        "#....o...o..W..#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#>...o...o..o..#",
        "#..............#",
        "#..............#",
        "#....o...o.....#",
        "#..............#",
        "#..............#",
        "#........R.....#",
        "################",
    ]},
    {"bin": {"F": 1, "K": 1, "S": 1, "r": 1, "b": 1}, "rows": [
        "################",
        "################",
        "#..............#",
        "#..............#",
        "#...o...o..o.B.#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#>..o...o..o...#",
        "#..............#",
        "#..............#",
        "#...o...o......#",
        "#..............#",
        "#..........R...#",
        "#..............#",
        "################",
    ]},
    {"bin": {"K": 1, "r": 1, "g": 1, "b": 1}, "rows": [
        "################",
        "################",
        "#........G.....#",
        "#..............#",
        "#.B.o..........#",
        "#........o.....#",
        "#...o..........#",
        "#..............#",
        "#>..+.o..+.o.oR#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"bin": {"F": 1, "K": 1, "r": 1, "g": 1, "b": 1}, "rows": [
        "################",
        "################",
        "#........G.....#",
        "#............B.#",
        "#........o.....#",
        "#..............#",
        "#........+.o.oo#",
        "#..............#",
        "#........o.....#",
        "#..............#",
        "#........+.o.o.#",
        "#..............#",
        "#..........o...#",
        "#..............#",
        "#........^.R...#",
        "################",
    ]},
]

def _reflect_f(d):
    return (-d[1], -d[0])


def _reflect_k(d):
    return (d[1], d[0])


def pads_of(rows):
    return [(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch == "o"]


def sinks_of(rows):
    return [(x, y, ch) for y, row in enumerate(rows)
            for x, ch in enumerate(row) if ch in SINK_COLOUR]


def emitter_of(rows):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in EMITTER_DIR:
                return x, y, EMITTER_DIR[ch]
    raise AssertionError("board has no emitter")


def trace(rows, placed):
    lit, crossed = set(), set()
    arms = {}
    ex, ey, ed = emitter_of(rows)
    ARM_IN = {(1, 0): "W", (-1, 0): "E", (0, 1): "N", (0, -1): "S"}
    ARM_OUT = {(1, 0): "E", (-1, 0): "W", (0, 1): "S", (0, -1): "N"}

    arms[(ex, ey, ARM_OUT[ed])] = WHITE
    seen = set()
    stack = [(ex, ey, ed, WHITE)]
    while stack:
        x, y, d, colour = stack.pop()
        nx, ny = x + d[0], y + d[1]
        if not (0 <= nx < N and 0 <= ny < N):
            continue
        state = (nx, ny, d, colour)
        if state in seen:
            continue
        seen.add(state)
        ch = rows[ny][nx]
        if ch == "#":
            continue
        if ch in SINK_COLOUR:
            arms[(nx, ny, ARM_IN[d])] = colour
            if SINK_COLOUR[ch] == colour:
                lit.add((nx, ny))
            continue
        crossed.add((nx, ny))
        arms[(nx, ny, ARM_IN[d])] = colour

        part = placed.get((nx, ny)) if ch == "o" else WELD.get(ch)
        outs = []
        if part == "F":
            outs = [(_reflect_f(d), colour)]
        elif part == "K":
            outs = [(_reflect_k(d), colour)]
        elif part == "S":
            outs = [(d, colour), (_reflect_f(d), colour)]
        elif part in FILTER_COLOUR:
            tint = FILTER_COLOUR[part]
            if colour in (WHITE, tint):
                outs = [(d, tint)]
        else:
            outs = [(d, colour)]
        for nd, ncolour in outs:
            arms[(nx, ny, ARM_OUT[nd])] = ncolour
            stack.append((nx, ny, nd, ncolour))
    return lit, arms, crossed


def board_won(rows, placed):
    lit, _, _ = trace(rows, placed)
    return len(lit) == len(sinks_of(rows)) and len(lit) > 0


def _mirror(main):
    px = [[-1] * CELL for _ in range(CELL)]
    for y in range(CELL):
        for x in range(CELL):
            run = (x - y) if main else (CELL - 1 - x - y)
            if 0 <= run <= 1:
                px[y][x] = GLASS
    return px


def part_glyph(part):
    if part == "F":
        return _mirror(False)
    if part == "K":
        return _mirror(True)
    if part == "S":
        px = _mirror(False)
        px[0][0] = px[CELL - 1][CELL - 1] = GLASS
        return px
    if part in FILTER_COLOUR:
        return medallion(FILTER_COLOUR[part], HARD)
    return [[-1] * CELL for _ in range(CELL)]


def _wall_block(x, y):
    px = [[WALL] * CELL for _ in range(CELL)]
    for j, row in enumerate(speckle(HARD, (x * 3 + y * 5) % 7)):
        for i, v in enumerate(row):
            if v >= 0:
                px[j][i] = v
    return px


def _pad_block():
    return ring(PAD)


def _emitter_block(ch):
    px = rounded(HARD)
    dx, dy = EMITTER_DIR[ch]
    ox = 2 if dx > 0 else (0 if dx < 0 else 1)
    oy = 2 if dy > 0 else (0 if dy < 0 else 1)
    for j in range(2):
        for i in range(2):
            px[oy + j][ox + i] = WHITE
    return px


def _sink_block(ch, on):
    colour = SINK_COLOUR[ch]
    px = ring(colour)
    if on:
        for y, row in enumerate(core(colour)):
            for x, v in enumerate(row):
                if v >= 0:
                    px[y][x] = v
    return px


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                pixels = None
                if ch == "#":
                    pixels = _wall_block(x, y)
                elif ch == "o":
                    pixels = _pad_block()
                elif ch in EMITTER_DIR:
                    pixels = _emitter_block(ch)
                elif ch in SINK_COLOUR:
                    pixels = _sink_block(ch, False)
                elif ch in WELD:
                    pixels = part_glyph(WELD[ch])
                if pixels is None:
                    continue
                name = f"sink_{x}_{y}" if ch in SINK_COLOUR else f"cell_{x}_{y}"
                sprites.append(Sprite(
                    pixels=pixels, name=name,
                    blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.INTANGIBLE, layer=-1,
                ).set_position(x * CELL, y * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


BIN_COL = (N - 1) * CELL
SLOT_TOP = 8
SLOT_GAP = 10
SLOT_PAD = 1
SLOT_GROW = 2
SLOT_GUTTER = 1


class G009A(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def _rail(self, frame):
        game = self._game
        tall = frame.shape[0]
        ghost = weave(0)
        for i, part in enumerate(game.bin_types):
            top = SLOT_TOP + i * SLOT_GAP
            if top + CELL > tall:
                break
            grow = SLOT_PAD + (SLOT_GROW if i == game.sel else 0)
            frame[max(0, top - grow):min(tall, top + CELL + grow),
                  BIN_COL + SLOT_GUTTER:BIN_COL + CELL] = FLOOR
            spent = game.stock[part] <= 0
            for y, row in enumerate(part_glyph(part)):
                for x, v in enumerate(row):
                    if v >= 0 and not (spent and ghost[y][x] < 0):
                        frame[top + y, BIN_COL + x] = v
        return frame

    def render_interface(self, frame):
        game = self._game
        parts = dict(game.placed)
        for y, row in enumerate(game.rows):
            for x, ch in enumerate(row):
                welded = WELD.get(ch)
                if welded:
                    parts[(x, y)] = welded

        for x, y in game.placed:
            frame[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = FLOOR

        for (x, y, side), colour in game.arms.items():
            cx, cy = x * CELL, y * CELL
            if side == "W":
                frame[cy + 1, cx:cx + 2] = colour
            elif side == "E":
                frame[cy + 1, cx + 2:cx + CELL] = colour
            elif side == "N":
                frame[cy:cy + 2, cx + 1] = colour
            elif side == "S":
                frame[cy + 2:cy + CELL, cx + 1] = colour

        for (x, y), part in parts.items():
            for j, row in enumerate(part_glyph(part)):
                for i, v in enumerate(row):
                    if v >= 0:
                        frame[y * CELL + j, x * CELL + i] = v

        for (x, y, side), colour in game.arms.items():
            cx, cy = x * CELL, y * CELL
            if side == "W":
                frame[cy + 1, cx] = colour
            elif side == "E":
                frame[cy + 1, cx + CELL - 1] = colour
            elif side == "N":
                frame[cy, cx + 1] = colour
            elif side == "S":
                frame[cy + CELL - 1, cx + 1] = colour

        for x, y, ch in sinks_of(game.rows):
            if (x, y) in game.lit:
                outline(frame, (x * CELL - 1, y * CELL - 1,
                                (x + 1) * CELL + 1, (y + 1) * CELL + 1), SINK_COLOUR[ch])

        if game.flash:
            r = 2 + (WIN_FLASH - game.flash)
            for x, y, ch in sinks_of(game.rows):
                outline(frame, (x * CELL - r, y * CELL - r,
                                (x + 1) * CELL + r, (y + 1) * CELL + r), SINK_COLOUR[ch])

        return self._rail(frame)


class G009(ARCBaseGame):

    def __init__(self):
        self.level_state(0)
        camera = Camera(width=N * CELL, height=N * CELL,
                        background=FLOOR, letter_box=WALL,
                        interfaces=[G009A(self)])
        super().__init__(game_id="g009", levels=build_levels(), camera=camera,
                         available_actions=[5, 6])

    def level_state(self, index):
        spec = LEVELS_SPEC[index]
        self.rows = list(spec["rows"])
        self.stock = dict(spec["bin"])
        self.bin_types = [p for p in BIN_ORDER if p in spec["bin"]]
        self.sel = 0
        self.placed = {}
        self.arms = {}
        self.lit = set()
        self.flash = 0
        self._recompute()

    def on_set_level(self, level):
        self.level_state(self.level_index)
        self._paint_sinks()

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)

    def _recompute(self):
        self.lit, self.arms, _ = trace(self.rows, self.placed)

    def _paint_sinks(self):
        for x, y, ch in sinks_of(self.rows):
            for sprite in self.current_level.get_sprites_by_name(f"sink_{x}_{y}"):
                sprite.pixels = np.array(_sink_block(ch, (x, y) in self.lit),
                                         dtype=sprite.pixels.dtype)

    def _step_cursor(self):
        if self.bin_types:
            self.sel = (self.sel + 1) % len(self.bin_types)

    def _click(self, x, y):
        if not (0 <= x < N and 0 <= y < N) or self.rows[y][x] != "o":
            return
        held = self.placed.get((x, y))
        if held is not None:
            del self.placed[(x, y)]
            self.stock[held] += 1
        else:
            if not self.bin_types:
                return
            part = self.bin_types[self.sel]
            if self.stock[part] <= 0:
                return
            self.stock[part] -= 1
            self.placed[(x, y)] = part
        self._recompute()
        self._paint_sinks()
        if len(self.lit) == len(sinks_of(self.rows)):
            self.flash = WIN_FLASH

    def step(self):
        if self.flash:
            self.flash -= 1
            if self.flash == 0:
                self.next_level()
                self.complete_action()
            return

        action = self.action.id
        if action == GameAction.ACTION5:
            self._step_cursor()
        elif action == GameAction.ACTION6:
            data = self.action.data or {}
            self._click(int(data.get("x", -1)) // CELL, int(data.get("y", -1)) // CELL)
        if self.flash:
            return
        self.complete_action()
