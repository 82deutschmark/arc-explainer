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
from sprite_book import hairline, weave

FLOOR = 3
WALL = 13
MESH = 13
SOCKET_EDGE = 1
OPTIC_FILL = 9

BEAM_CLEAR = 0
BEAM_ROSE = 8
BEAM_AMBER = 11
BEAM_VIOLET = 15

COLS = 15
BAND = 8
CELL = 8
HALF = 4
WIN_HOLD = 4

FACE_STEP = {
    0: {0: (1, 0), 1: (1, 0), 2: (-1, 0), 3: (-1, 0), 4: (0, 1), 5: (0, 1)},
    1: {0: (1, 0), 1: (0, -1), 2: (0, -1), 3: (-1, 0), 4: (-1, 0), 5: (1, 0)},
}
BACK = 3


def face_up(x, y):
    return (x + y) % 2 == 0


def step_of(x, y, heading):
    return FACE_STEP[(x + y) % 2][heading]

FACET_AXIS = {"x": 0, "y": 1, "z": 2}
PRISM_FAN = (1, -1)
WELD = {"=": "x", "/": "y", "\\": "z", "Y": "P"}
TINT_COLOUR = {"r": BEAM_ROSE, "a": BEAM_AMBER, "v": BEAM_VIOLET}
WELL_COLOUR = {"C": BEAM_CLEAR, "R": BEAM_ROSE, "A": BEAM_AMBER, "V": BEAM_VIOLET}
EMITTER_HEADING = {">": 0, ")": 1, "(": 2, "<": 3, "[": 4, "]": 5}
BIN_ORDER = ["x", "y", "z", "P", "r", "a", "v"]


def sockets_of(rows):
    return [(x, y) for y, row in enumerate(rows)
            for x, ch in enumerate(row) if ch == "o"]


def wells_of(rows):
    return [(x, y, ch) for y, row in enumerate(rows)
            for x, ch in enumerate(row) if ch in WELL_COLOUR]


def emitter_of(rows):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in EMITTER_HEADING:
                return x, y, EMITTER_HEADING[ch]
    raise AssertionError("board has no emitter")


def trace(rows, mounted):
    lit, crossed, ports = set(), set(), {}
    ex, ey, eh = emitter_of(rows)
    ports[(ex, ey, eh, "out")] = BEAM_CLEAR
    seen = set()
    stack = [(ex, ey, eh, BEAM_CLEAR)]
    while stack:
        x, y, heading, colour = stack.pop()
        sx, sy = step_of(x, y, heading)
        nx, ny = x + sx, y + sy
        if not (0 <= nx < COLS and 0 <= ny < BAND):
            continue
        state = (nx, ny, heading, colour)
        if state in seen:
            continue
        seen.add(state)
        ch = rows[ny][nx]
        if ch == "#":
            continue
        ports[(nx, ny, (heading + BACK) % 6, "in")] = colour
        if ch in WELL_COLOUR:
            if WELL_COLOUR[ch] == colour:
                lit.add((nx, ny))
            continue
        crossed.add((nx, ny))

        part = mounted.get((nx, ny)) if ch == "o" else WELD.get(ch)
        outs = []
        if part in FACET_AXIS:
            outs = [((2 * FACET_AXIS[part] - heading) % 6, colour)]
        elif part == "P":
            outs = [((heading + PRISM_FAN[0]) % 6, colour),
                    ((heading + PRISM_FAN[1]) % 6, colour)]
        elif part in TINT_COLOUR:
            tone = TINT_COLOUR[part]
            if colour in (BEAM_CLEAR, tone):
                outs = [(heading, tone)]
        else:
            outs = [(heading, colour)]
        for nh, ncolour in outs:
            ports[(nx, ny, nh, "out")] = ncolour
            stack.append((nx, ny, nh, ncolour))
    return lit, ports, crossed


def board_won(rows, mounted):
    lit, _, _ = trace(rows, mounted)
    return len(lit) == len(wells_of(rows)) and len(lit) > 0

LEVELS_SPEC = [
    {"bin": {"z": 1}, "rows": [
        "###############",
        "#####.....#####",
        "###.........###",
        "#>..o.o..o..o.#",
        "#.............#",
        "#.............#",
        "#..C..........#",
        "###############",
    ]},
    {"bin": {"x": 1, "y": 1}, "rows": [
        "###############",
        "#..........####",
        "#....o.....####",
        "#..oo......####",
        "#.....o....####",
        "#..C..oo...####",
        "#).........####",
        "###############",
    ]},
    {"bin": {"z": 1, "P": 1}, "rows": [
        "###############",
        "#######.......#",
        "######........#",
        "#>...o..o..o..#",
        "#.............#",
        "#C..o.........#",
        "#.....C.......#",
        "###############",
    ]},
    {"bin": {"z": 1, "P": 1, "r": 1}, "rows": [
        "###############",
        "#####.........#",
        "####..........#",
        "#>.o.o..o..o..#",
        "#...o.........#",
        "#Co.oo........#",
        "#.....R.......#",
        "###############",
    ]},
    {"bin": {"z": 1, "r": 1, "a": 1, "v": 1}, "rows": [
        "###############",
        "#......oR######",
        "#.....o.#######",
        "#>.o.Y.########",
        "#....o.########",
        "#.....Y..o.o.A#",
        "#....o.o.V....#",
        "###############",
    ]},
    {"bin": {"y": 1, "z": 1, "r": 1, "a": 1, "v": 1}, "rows": [
        "###############",
        "#...#######...#",
        "#.o..o.R......#",
        "#..o..A.o.o####",
        "#..Y..o.Yo.####",
        "#........o..###",
        "#)........V...#",
        "###############",
    ]},
]

def face_mask(up, cell=CELL):
    mask = []
    for j in range(cell):
        depth = j if up else (cell - 1 - j)
        mask.append([abs(i + 0.5 - cell / 2.0) <= depth / 2.0 for i in range(cell)])
    return mask


UP_MASK, DOWN_MASK = face_mask(True), face_mask(False)
MIDDLE = {0: (HALF, 5), 1: (HALF, 2)}
PORT = {
    0: {(-1, 0): (2, 4), (1, 0): (5, 4), (0, 1): (HALF, CELL - 1)},
    1: {(-1, 0): (2, 3), (1, 0): (5, 3), (0, -1): (HALF, 0)},
}


def mask_of(x, y):
    return UP_MASK if face_up(x, y) else DOWN_MASK


def port_pixel(x, y, heading):
    return PORT[(x + y) % 2][step_of(x, y, heading)]


def _blank():
    return [[-1] * CELL for _ in range(CELL)]


def _fill(up, colour):
    mask = UP_MASK if up else DOWN_MASK
    return [[colour if mask[j][i] else -1 for i in range(CELL)] for j in range(CELL)]


def _rim_cells(up, cell=CELL):
    mask = face_mask(up, cell)
    out = []
    for j in range(cell):
        for i in range(cell):
            if not mask[j][i]:
                continue
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a, b = i + di, j + dj
                if not (0 <= a < cell and 0 <= b < cell) or not mask[b][a]:
                    out.append((i, j))
                    break
    return out


def tri_ring(frame, x, y, grow, colour):
    cell = CELL + 2 * grow
    ox, oy = x * HALF - grow, y * CELL - grow
    tall, wide = frame.shape
    for i, j in _rim_cells(face_up(x, y), cell):
        px, py = ox + i, oy + j
        if 0 <= px < wide and 0 <= py < tall:
            frame[py, px] = colour
    return frame


def floor_face(up):
    px = _fill(up, FLOOR)
    mask = UP_MASK if up else DOWN_MASK
    for j in range(CELL):
        run = [i for i in range(CELL) if mask[j][i]]
        if run:
            px[j][run[0]] = MESH
    if up:
        for i in range(CELL):
            if mask[CELL - 1][i]:
                px[CELL - 1][i] = MESH
    return px


def wall_face(up, x, y):
    return _fill(up, WALL)


def socket_face(up):
    px = floor_face(up)
    cx, cy = MIDDLE[0 if up else 1]
    for j in range(cy - 1, cy + 2):
        for i in range(cx - 1, cx + 2):
            if (i, j) != (cx, cy) and 0 <= j < CELL and 0 <= i < CELL:
                px[j][i] = SOCKET_EDGE
    return px


def well_face(up, ch, on):
    colour = WELL_COLOUR[ch]
    if on:
        return _fill(up, colour)
    px = floor_face(up)
    for i, j in _rim_cells(up):
        px[j][i] = colour
    return px


def emitter_face(up, heading, x, y):
    px = _fill(up, WALL)
    cx, cy = MIDDLE[0 if up else 1]
    mx, my = PORT[(x + y) % 2][step_of(x, y, heading)]
    for j in range(min(cy, my), max(cy, my) + 1):
        for i in range(min(cx, mx), max(cx, mx) + 1):
            px[j][i] = BEAM_CLEAR
    return px


def draw_optic(frame, x, y, part):
    ox, oy = x * HALF, y * CELL
    cx, cy = MIDDLE[(x + y) % 2]
    if part in FACET_AXIS:
        axis = FACET_AXIS[part]
        for heading in (axis, (axis + BACK) % 6):
            px, py = port_pixel(x, y, heading)
            hairline(frame, (ox + cx, oy + cy), (ox + px, oy + py), OPTIC_FILL)
    elif part == "P":
        for j in range(cy - 1, cy + 1):
            for i in range(cx - 2, cx + 2):
                frame[oy + j, ox + i] = OPTIC_FILL
    elif part in TINT_COLOUR:
        for j in range(cy - 1, cy + 2):
            for i in range(cx - 1, cx + 2):
                frame[oy + j, ox + i] = OPTIC_FILL
        for i, j in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
            frame[oy + cy + j, ox + cx + i] = TINT_COLOUR[part]
    return frame


RAIL_TOP = (BAND - 1) * CELL + 2
RAIL_HIGH = (BAND - 1) * CELL
SLOT_W = 8
SLOT_PITCH = 9
SLOT_LEFT = 3


def rail_glyph(part):
    px = [[-1] * SLOT_W for _ in range(6)]

    def line(a, b):
        x0, y0 = a
        x1, y1 = b
        steps = max(abs(x1 - x0), abs(y1 - y0))
        for k in range(steps + 1):
            i = x0 + round((x1 - x0) * k / steps)
            j = y0 + round((y1 - y0) * k / steps)
            px[j][i] = OPTIC_FILL

    if part == "x":
        line((1, 3), (6, 3))
    elif part == "y":
        line((1, 5), (6, 0))
    elif part == "z":
        line((1, 0), (6, 5))
    elif part == "P":
        for j in range(2, 4):
            for i in range(2, 6):
                px[j][i] = OPTIC_FILL
    elif part in TINT_COLOUR:
        for j in range(1, 4):
            for i in range(2, 5):
                px[j][i] = OPTIC_FILL
        for i, j in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
            px[2 + j][3 + i] = TINT_COLOUR[part]
    return px

def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                up = face_up(x, y)
                if ch == "#":
                    pixels = wall_face(up, x, y)
                elif ch == "o":
                    pixels = socket_face(up)
                elif ch in EMITTER_HEADING:
                    pixels = emitter_face(up, EMITTER_HEADING[ch], x, y)
                elif ch in WELL_COLOUR:
                    pixels = well_face(up, ch, False)
                else:
                    pixels = floor_face(up)
                name = f"well_{x}_{y}" if ch in WELL_COLOUR else f"face_{x}_{y}"
                sprites.append(Sprite(
                    pixels=pixels, name=name,
                    blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.INTANGIBLE, layer=-1,
                ).set_position(x * HALF, y * CELL))
        levels.append(Level(sprites=sprites, grid_size=(COLS * HALF + HALF, BAND * CELL)))
    return levels


class G009A(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def _beams(self, frame):
        game = self._game
        for (x, y, heading, _io), colour in game.ports.items():
            ox, oy = x * HALF, y * CELL
            cx, cy = MIDDLE[(x + y) % 2]
            px, py = port_pixel(x, y, heading)
            hairline(frame, (ox + px, oy + py), (ox + cx, oy + cy), colour)
        return frame

    def _socket_ring(self, frame, x, y):
        ox, oy = x * HALF, y * CELL
        cx, cy = MIDDLE[(x + y) % 2]
        for j in range(cy - 1, cy + 2):
            for i in range(cx - 1, cx + 2):
                if (i, j) != (cx, cy):
                    frame[oy + j, ox + i] = SOCKET_EDGE
        return frame

    def _ports(self, frame):
        game = self._game
        for (x, y, heading, _io), colour in game.ports.items():
            px, py = port_pixel(x, y, heading)
            frame[y * CELL + py, x * HALF + px] = colour
        return frame

    def _rail(self, frame):
        game = self._game
        ghost = weave(0, SLOT_W)
        for i, part in enumerate(game.bin_types):
            left = SLOT_LEFT + i * SLOT_PITCH
            if left + SLOT_W > frame.shape[1]:
                break
            top = RAIL_HIGH if i == game.sel else RAIL_TOP
            frame[top:BAND * CELL, left:left + SLOT_W] = FLOOR
            spent = game.stock[part] <= 0
            for j, row in enumerate(rail_glyph(part)):
                for k, v in enumerate(row):
                    if v >= 0 and not (spent and ghost[j][k] < 0):
                        frame[RAIL_TOP + j, left + k] = v
        return frame

    def render_interface(self, frame):
        game = self._game
        optics = dict(game.mounted)
        for y, row in enumerate(game.rows):
            for x, ch in enumerate(row):
                welded = WELD.get(ch)
                if welded:
                    optics[(x, y)] = welded

        self._beams(frame)
        for x, y in sockets_of(game.rows):
            if (x, y) not in game.mounted:
                self._socket_ring(frame, x, y)
        for (x, y), part in optics.items():
            draw_optic(frame, x, y, part)
        self._ports(frame)

        for x, y in game.lit:
            tri_ring(frame, x, y, 1, WELL_COLOUR[game.rows[y][x]])
        if game.hold:
            for x, y, ch in wells_of(game.rows):
                tri_ring(frame, x, y, 2 + (WIN_HOLD - game.hold), WELL_COLOUR[ch])
        return self._rail(frame)


class G009(ARCBaseGame):

    def __init__(self):
        self.level_state(0)
        camera = Camera(width=COLS * HALF + HALF, height=BAND * CELL,
                        background=WALL, letter_box=WALL,
                        interfaces=[G009A(self)])
        super().__init__(game_id="g009", levels=build_levels(), camera=camera,
                         available_actions=[5, 6])

    def level_state(self, index):
        spec = LEVELS_SPEC[index]
        self.rows = list(spec["rows"])
        self.stock = dict(spec["bin"])
        self.bin_types = [p for p in BIN_ORDER if p in spec["bin"]]
        self.sel = 0
        self.mounted = {}
        self.ports = {}
        self.lit = set()
        self.hold = 0
        self._recompute()

    def on_set_level(self, level):
        self.level_state(self.level_index)
        self._paint_wells()

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)

    def _recompute(self):
        self.lit, self.ports, _ = trace(self.rows, self.mounted)

    def _paint_wells(self):
        for x, y, ch in wells_of(self.rows):
            for sprite in self.current_level.get_sprites_by_name(f"well_{x}_{y}"):
                sprite.pixels = np.array(well_face(face_up(x, y), ch, (x, y) in self.lit),
                                         dtype=sprite.pixels.dtype)

    def _step_cursor(self):
        if self.bin_types:
            self.sel = (self.sel + 1) % len(self.bin_types)

    def _face_at(self, px, py):
        for x in range((px - CELL + 1) // HALF, px // HALF + 1):
            y = py // CELL
            if not (0 <= x < COLS and 0 <= y < BAND):
                continue
            i, j = px - x * HALF, py - y * CELL
            if 0 <= i < CELL and mask_of(x, y)[j][i]:
                return x, y
        return None, None

    def _click(self, px, py):
        x, y = self._face_at(px, py)
        if x is None or self.rows[y][x] != "o":
            return
        held = self.mounted.get((x, y))
        if held is not None:
            del self.mounted[(x, y)]
            self.stock[held] += 1
        else:
            if not self.bin_types:
                return
            part = self.bin_types[self.sel]
            if self.stock[part] <= 0:
                return
            self.stock[part] -= 1
            self.mounted[(x, y)] = part
        self._recompute()
        self._paint_wells()
        if len(self.lit) == len(wells_of(self.rows)):
            self.hold = WIN_HOLD

    def step(self):
        if self.hold:
            self.hold -= 1
            if self.hold == 0:
                self.next_level()
                self.complete_action()
            return

        action = self.action.id
        if action == GameAction.ACTION5:
            self._step_cursor()
        elif action == GameAction.ACTION6:
            data = self.action.data or {}
            self._click(int(data.get("x", -1)), int(data.get("y", -1)))
        if self.hold:
            return
        self.complete_action()
