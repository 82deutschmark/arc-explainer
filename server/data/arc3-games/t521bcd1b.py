# ARC-AGI-3 candidate task t521bcd1b.

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

FLOOR = 5
WALL = 3
PAD = 2
GLASS = 1
SPLIT_C = 10
FIXED_C = 15
PIP_ON = 11
PIP_OFF = 4
CURSOR = 0

WHITE, RED, GREEN, BLUE = 0, 8, 14, 9

N = 16
CELL = 4
HUD_ROWS = 2

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

        part = placed.get((nx, ny)) if ch == "o" else {"/": "F", "\\": "K", "+": "S"}.get(ch)
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


def _solid(colour):
    return [[colour] * CELL for _ in range(CELL)]


def part_glyph(part, colour=None):
    tint = colour if colour is not None else GLASS
    block = _solid(FLOOR)
    if part == "F":
        for i in range(CELL):
            block[CELL - 1 - i][i] = tint
    elif part == "K":
        for i in range(CELL):
            block[i][i] = tint
    elif part == "S":
        shade = colour if colour is not None else SPLIT_C
        for i in range(CELL):
            block[CELL - 1 - i][i] = shade
        block[0][0] = shade
        block[CELL - 1][CELL - 1] = shade
    elif part in FILTER_COLOUR:
        block = _solid(FILTER_COLOUR[part])
        block[0][0] = FLOOR
        block[CELL - 1][CELL - 1] = FLOOR
    return block


def _pad_block():
    block = _solid(FLOOR)
    for dy in (1, 2):
        for dx in (1, 2):
            block[dy][dx] = PAD
    return block


def _emitter_block(ch):
    block = _solid(WALL)
    dx, dy = EMITTER_DIR[ch]
    ox = 2 if dx > 0 else (0 if dx < 0 else 1)
    oy = 2 if dy > 0 else (0 if dy < 0 else 1)
    for j in range(2):
        for i in range(2):
            block[oy + j][ox + i] = CURSOR
    return block


def _sink_block(ch, on):
    block = _solid(SINK_COLOUR[ch] if ch != "W" else GLASS)
    core = CURSOR if on else FLOOR
    for dy in (1, 2):
        for dx in (1, 2):
            block[dy][dx] = core
    return block


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                pixels = None
                if ch == "#":
                    pixels = _solid(WALL)
                elif ch == "o":
                    pixels = _pad_block()
                elif ch in EMITTER_DIR:
                    pixels = _emitter_block(ch)
                elif ch in SINK_COLOUR:
                    pixels = _sink_block(ch, False)
                elif ch in ("/", "\\", "+"):
                    pixels = part_glyph({"/": "F", "\\": "K", "+": "S"}[ch], FIXED_C)
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


class Gea6f79c0(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        game = self._game
        for i, part in enumerate(game.bin_types):
            x0 = 2 + i * 10
            if x0 + 8 > frame.shape[1]:
                break
            glyph = np.array(part_glyph(part), dtype=frame.dtype)
            frame[1:1 + CELL, x0:x0 + CELL] = glyph
            total = LEVELS_SPEC[game.level_index]["bin"][part]
            left = game.stock[part]
            for p in range(total):
                px = x0 + p * 2
                if px < frame.shape[1]:
                    frame[6, px] = PIP_ON if p < left else PIP_OFF
            if i == game.sel:
                frame[5, x0:x0 + CELL] = CURSOR

        for (x, y), part in game.placed.items():
            frame[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = np.array(
                part_glyph(part), dtype=frame.dtype)

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
        return frame


class G4aa2c481(ARCBaseGame):

    def __init__(self):
        self.level_state(0)
        camera = Camera(width=N * CELL, height=N * CELL,
                        background=FLOOR, letter_box=WALL,
                        interfaces=[Gea6f79c0(self)])
        super().__init__(game_id="t521bcd1b", levels=build_levels(), camera=camera,
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
            if self.is_last_level():
                self.next_level()
            else:
                self.next_level()

    def step(self):
        action = self.action.id
        if action == GameAction.ACTION5:
            self._step_cursor()
        elif action == GameAction.ACTION6:
            data = self.action.data or {}
            self._click(int(data.get("x", -1)) // CELL, int(data.get("y", -1)) // CELL)
        self.complete_action()
