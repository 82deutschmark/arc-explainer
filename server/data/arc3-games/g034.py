# ARC-AGI-3 candidate task g034.

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


BLANK = 5
MATTE = 13
SPENT_C = MATTE

CHALK, COBALT, OCHRE, MOSS, PLUM, RUST = 0, 9, 11, 14, 15, 12

CELL = 4
CANVAS = 12
BIN_SLOT = 10

SHAPES = {
    "BAR2H": [(0, 0), (1, 0)],
    "BAR3H": [(0, 0), (1, 0), (2, 0)],
    "BAR3V": [(0, 0), (0, 1), (0, 2)],
    "SQ2":   [(0, 0), (1, 0), (0, 1), (1, 1)],
    "ELL":   [(0, 0), (0, 1), (1, 1)],
    "ELL4":  [(0, 0), (0, 1), (0, 2), (1, 2)],
    "TEE":   [(0, 0), (1, 0), (2, 0), (1, 1)],
    "CROSS": [(1, 0), (0, 1), (1, 1), (2, 1), (1, 2)],
    "ZED":   [(0, 0), (1, 0), (1, 1), (2, 1)],
}


def bbox(shape: str) -> tuple[int, int]:
    offs = SHAPES[shape]
    return max(x for x, _ in offs) + 1, max(y for _, y in offs) + 1


def cells(shape: str, ax: int, ay: int) -> list[tuple[int, int]]:
    return [(ax + dx, ay + dy) for dx, dy in SHAPES[shape]]


def fits(shape: str, ax: int, ay: int) -> bool:
    w, h = bbox(shape)
    return 0 <= ax and ax + w <= CANVAS and 0 <= ay and ay + h <= CANVAS


LEVELS_SPEC = [
    {"stamps": [("SQ2", COBALT), ("BAR3H", CHALK)],
     "solution": [(1, 2, 3), (0, 4, 3)]},

    {"stamps": [("BAR3H", OCHRE), ("SQ2", PLUM), ("BAR3V", MOSS)],
     "solution": [(2, 3, 2), (0, 2, 4), (1, 4, 4)]},

    {"stamps": [("BAR3V", CHALK), ("BAR3H", OCHRE), ("BAR3H", CHALK)],
     "solution": [(2, 2, 4), (0, 6, 2), (1, 4, 4)]},

    {"stamps": [("SQ2", COBALT), ("BAR3V", OCHRE), ("BAR3V", MOSS), ("TEE", CHALK)],
     "solution": [(2, 2, 2), (3, 2, 4), (0, 4, 4), (1, 5, 5)]},

    {"stamps": [("BAR3H", COBALT), ("CROSS", PLUM), ("BAR3V", MOSS), ("SQ2", OCHRE)],
     "solution": [(1, 3, 3), (3, 3, 3), (0, 4, 4), (2, 6, 4)]},

    {"stamps": [("TEE", MOSS), ("BAR3V", PLUM), ("ELL4", CHALK), ("SQ2", COBALT),
                ("BAR3H", OCHRE)],
     "solution": [(2, 2, 2), (0, 3, 4), (3, 4, 5), (4, 5, 6), (1, 7, 6)]},

    {"stamps": [("BAR3H", CHALK), ("CROSS", MOSS), ("CROSS", COBALT), ("SQ2", CHALK),
                ("BAR3V", OCHRE)],
     "solution": [(2, 2, 2), (3, 2, 2), (0, 4, 3), (4, 6, 3), (1, 5, 4)]},

    {"stamps": [("BAR3V", COBALT), ("TEE", MOSS), ("SQ2", PLUM), ("BAR3H", CHALK),
                ("CROSS", OCHRE), ("BAR3V", RUST)],
     "solution": [(2, 2, 2), (4, 2, 2), (0, 3, 2), (1, 3, 4), (3, 4, 4), (5, 6, 4)]},
]


def simulate(spec: dict, order) -> np.ndarray | None:
    grid = np.full((CANVAS, CANVAS), BLANK, dtype=np.int16)
    for idx, ax, ay in order:
        shape, colour = spec["stamps"][idx]
        if not fits(shape, ax, ay):
            return None
        for cx, cy in cells(shape, ax, ay):
            grid[cy, cx] = colour
    return grid


def target_of(spec: dict) -> np.ndarray:
    grid = simulate(spec, spec["solution"])
    if grid is None:
        raise ValueError("a level's own solution runs off the canvas")
    return grid


_CORNERS = (
    (0, 0, (0, -1), (-1, 0)),
    (0, 1, (0, -1), (1, 0)),
    (1, 0, (0, 1), (-1, 0)),
    (1, 1, (0, 1), (1, 0)),
)


def coat_cell(colour: int, blob: set, cx: int, cy: int, hollow: bool = False):
    if hollow:
        return ring(colour, CELL)
    px = rounded(colour, CELL)
    last = CELL - 1
    for ny, nx, a, b in _CORNERS:
        if (cx + a[0], cy + a[1]) in blob or (cx + b[0], cy + b[1]) in blob:
            px[ny * last][nx * last] = colour
    return px


def blob_of(grid, colour: int) -> set:
    if hasattr(grid, "shape"):
        return {(x, y) for y in range(grid.shape[0]) for x in range(grid.shape[1])
                if int(grid[y, x]) == colour}
    return set(grid)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for _ in LEVELS_SPEC:
        pixels = np.full((CANVAS * CELL, CANVAS * CELL), BLANK, dtype=np.int8)
        canvas_sprite = Sprite(
            pixels=pixels, name="canvas",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=0,
        ).set_position(0, 0)
        levels.append(Level(sprites=[canvas_sprite], grid_size=(64, 64)))
    return levels


TARGET_PLATE = (49, 1, 63, 15)
HELD_PLATE = (49, 18, 63, 32)
BIN_PLATE = (0, 50, 6 * BIN_SLOT, 61)


class G034A(RenderableUserDisplay):

    def __init__(self, game: "G034") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game

        frame[0:64, CANVAS * CELL:64] = MATTE
        frame[CANVAS * CELL:64, 0:CANVAS * CELL] = MATTE

        x0, y0, x1, y1 = TARGET_PLATE
        frame[y0:y1, x0:x1] = BLANK
        frame[y0 + 1:y1 - 1, x0 + 1:x1 - 1] = g.target.astype(frame.dtype)

        x0, y0, x1, y1 = HELD_PLATE
        frame[y0:y1, x0:x1] = BLANK
        sel = g.selected_index()
        if sel is not None:
            shape, colour = g.stamps[sel]
            blob = blob_of(SHAPES[shape], colour)
            w, h = bbox(shape)
            ox = x0 + 1 + (12 - w * CELL) // 2
            oy = y0 + 1 + (12 - h * CELL) // 2
            for dx, dy in SHAPES[shape]:
                px = coat_cell(colour, blob, dx, dy)
                for py in range(CELL):
                    for qx in range(CELL):
                        if px[py][qx] >= 0:
                            frame[oy + dy * CELL + py, ox + dx * CELL + qx] = px[py][qx]

        bx0, by0, bx1, by1 = BIN_PLATE
        frame[by0:by1, bx0:bx1] = BLANK
        for i, (shape, colour) in enumerate(g.stamps):
            x0 = i * BIN_SLOT
            if x0 + BIN_SLOT > bx1:
                break
            shade = SPENT_C if g.spent[i] else colour
            w, h = bbox(shape)
            sx = x0 + 1 + (BIN_SLOT - 2 - w * 2) // 2
            sy = by0 + 1 + (by1 - by0 - 2 - h * 2) // 2
            for dx, dy in SHAPES[shape]:
                frame[sy + dy * 2:sy + 2 + dy * 2, sx + dx * 2:sx + 2 + dx * 2] = shade
            if (not g.spent[i]) and i == sel:
                outline(frame, (x0, by0, x0 + BIN_SLOT, by1), colour)

        return frame


class G034(ARCBaseGame):

    COAT_FRAMES = 5
    CURE_FRAMES = 4

    def __init__(self) -> None:
        self.stamps: list[tuple[str, int]] = list(LEVELS_SPEC[0]["stamps"])
        self.spent: list[bool] = [False] * len(self.stamps)
        self.canvas = np.full((CANVAS, CANVAS), BLANK, dtype=np.int16)
        self.target = target_of(LEVELS_SPEC[0])
        self.sel = 0
        self.history: list[tuple[int, np.ndarray]] = []
        self._fx = 0
        self._fx_kind = ""
        self._fx_cells: tuple = ()
        self._fx_box = (0, 0, 0, 0)
        self._fx_prev = None
        camera = Camera(
            width=64, height=64,
            background=BLANK, letter_box=BLANK,
            interfaces=[G034A(self)],
        )
        super().__init__(game_id="g034", levels=build_levels(), camera=camera,
                         available_actions=[5, 6, 7])

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.stamps = list(spec["stamps"])
        self.spent = [False] * len(self.stamps)
        self.canvas = np.full((CANVAS, CANVAS), BLANK, dtype=np.int16)
        self.target = target_of(spec)
        self.sel = 0
        self.history = []
        self._clear_fx()
        self._paint()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _clear_fx(self) -> None:
        self._fx = 0
        self._fx_kind = ""
        self._fx_cells = ()
        self._fx_prev = None

    def _wet_edge(self) -> int:
        ax, ay, w, h = self._fx_box
        span = (w if w >= h else h) * CELL
        done = self.COAT_FRAMES + 1 - self._fx
        return int(round(span * done / (self.COAT_FRAMES + 1)))

    def _paint(self) -> None:
        sprites = self.current_level.get_sprites_by_name("canvas")
        if not sprites:
            return
        pixels = sprites[0].pixels
        pixels[:, :] = BLANK

        wet = set(self._fx_cells)
        old = self._fx_prev
        ax, ay, w, h = self._fx_box
        across = w >= h
        edge = self._wet_edge() if wet else 0
        hollow = self._fx_kind == "cure" and self._fx % 2 == 1

        blobs: dict = {}

        def block_for(grid, tag, cx, cy):
            colour = int(grid[cy, cx])
            if colour == BLANK:
                return None
            key = (tag, colour)
            if key not in blobs:
                blobs[key] = blob_of(grid, colour)
            return coat_cell(colour, blobs[key], cx, cy, hollow)

        for cy in range(CANVAS):
            for cx in range(CANVAS):
                fresh = block_for(self.canvas, "now", cx, cy)
                under = None
                if (cx, cy) in wet and old is not None:
                    under = block_for(old, "was", cx, cy)
                for py in range(CELL):
                    for qx in range(CELL):
                        px = fresh
                        if (cx, cy) in wet:
                            along = ((cx - ax) * CELL + qx) if across \
                                else ((cy - ay) * CELL + py)
                            if along >= edge:
                                px = under
                        if px is not None and px[py][qx] >= 0:
                            pixels[cy * CELL + py, cx * CELL + qx] = px[py][qx]

    def selected_index(self) -> int | None:
        if all(self.spent):
            return None
        return self.sel

    def _cycle(self) -> None:
        if all(self.spent):
            return
        n = len(self.stamps)
        for step in range(1, n + 1):
            nxt = (self.sel + step) % n
            if not self.spent[nxt]:
                self.sel = nxt
                return

    def _place(self, cx: int, cy: int) -> bool:
        if all(self.spent):
            return False
        if not (0 <= cx < CANVAS and 0 <= cy < CANVAS):
            return False
        idx = self.sel
        shape, colour = self.stamps[idx]
        if not fits(shape, cx, cy):
            return False
        before = self.canvas.copy()
        self.history.append((idx, before))
        for tx, ty in cells(shape, cx, cy):
            self.canvas[ty, tx] = colour
        self.spent[idx] = True
        self._cycle()
        w, h = bbox(shape)
        self._fx_prev = before
        self._fx_cells = tuple(cells(shape, cx, cy))
        self._fx_box = (cx, cy, w, h)
        return True

    def _undo(self) -> None:
        if not self.history:
            return
        idx, snapshot = self.history.pop()
        self.canvas = snapshot
        self.spent[idx] = False
        self.sel = idx
        self._paint()

    def step(self) -> None:
        if self._fx:
            self._fx -= 1
            self._paint()
            if self._fx:
                return
            if self._fx_kind == "coat":
                self._clear_fx()
                self._paint()
                if all(self.spent) and np.array_equal(self.canvas, self.target):
                    self._fx_kind = "cure"
                    self._fx = self.CURE_FRAMES
                    return
            else:
                self._clear_fx()
                self._paint()
                self.next_level()
            self.complete_action()
            return

        action = self.action.id
        if action == GameAction.ACTION5:
            self._cycle()
        elif action == GameAction.ACTION6:
            data = self.action.data or {}
            if self._place(int(data.get("x", -1)) // CELL,
                           int(data.get("y", -1)) // CELL):
                self._fx_kind = "coat"
                self._fx = self.COAT_FRAMES
                self._paint()
                return
        elif action == GameAction.ACTION7:
            self._undo()
        self.complete_action()
