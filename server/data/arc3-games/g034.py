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

BLANK = 5
GROUND = 4
FRAME_C = 2
SPENT_C = 3
MARK_C = 0

RED, BLUE, YELLOW, GREEN, PURPLE, ORANGE = 8, 9, 11, 14, 15, 12

CELL = 4
CANVAS = 12
BIN_SLOT = 8

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
    {"stamps": [("SQ2", BLUE), ("BAR3H", RED)],
     "solution": [(1, 2, 3), (0, 4, 3)]},

    {"stamps": [("BAR3H", YELLOW), ("SQ2", PURPLE), ("BAR3V", GREEN)],
     "solution": [(2, 3, 2), (0, 2, 4), (1, 4, 4)]},

    {"stamps": [("BAR3V", RED), ("BAR3H", YELLOW), ("BAR3H", RED)],
     "solution": [(2, 2, 4), (0, 6, 2), (1, 4, 4)]},

    {"stamps": [("SQ2", BLUE), ("BAR3V", YELLOW), ("BAR3V", GREEN), ("TEE", RED)],
     "solution": [(2, 2, 2), (3, 2, 4), (0, 4, 4), (1, 5, 5)]},

    {"stamps": [("BAR3H", BLUE), ("CROSS", PURPLE), ("BAR3V", GREEN), ("SQ2", YELLOW)],
     "solution": [(1, 3, 3), (3, 3, 3), (0, 4, 4), (2, 6, 4)]},

    {"stamps": [("TEE", GREEN), ("BAR3V", PURPLE), ("ELL4", RED), ("SQ2", BLUE),
                ("BAR3H", YELLOW)],
     "solution": [(2, 2, 2), (0, 3, 4), (3, 4, 5), (4, 5, 6), (1, 7, 6)]},

    {"stamps": [("BAR3H", RED), ("CROSS", GREEN), ("CROSS", BLUE), ("SQ2", RED),
                ("BAR3V", YELLOW)],
     "solution": [(2, 2, 2), (3, 2, 2), (0, 4, 3), (4, 6, 3), (1, 5, 4)]},

    {"stamps": [("BAR3V", BLUE), ("TEE", GREEN), ("SQ2", PURPLE), ("BAR3H", RED),
                ("CROSS", YELLOW), ("BAR3V", ORANGE)],
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


class G034A(RenderableUserDisplay):

    def __init__(self, game: "G034") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game

        frame[0:64, CANVAS * CELL:64] = GROUND
        frame[CANVAS * CELL:64, 0:CANVAS * CELL] = GROUND

        frame[1:15, 49:63] = FRAME_C
        frame[2:14, 50:62] = g.target.astype(frame.dtype)

        frame[18:30, 50:62] = GROUND
        sel = g.selected_index()
        if sel is not None:
            shape, colour = g.stamps[sel]
            for dx, dy in SHAPES[shape]:
                frame[18 + dy * CELL:22 + dy * CELL, 50 + dx * CELL:54 + dx * CELL] = colour

        for i, (shape, colour) in enumerate(g.stamps):
            x0 = i * BIN_SLOT
            if x0 + BIN_SLOT > CANVAS * CELL:
                break
            shade = SPENT_C if g.spent[i] else colour
            for dx, dy in SHAPES[shape]:
                frame[49 + dy * 2:51 + dy * 2, x0 + 1 + dx * 2:x0 + 3 + dx * 2] = shade
            lit = (not g.spent[i]) and i == sel
            frame[57:59, x0 + 1:x0 + 7] = MARK_C if lit else GROUND

        return frame


class G034(ARCBaseGame):

    def __init__(self) -> None:
        self.stamps: list[tuple[str, int]] = list(LEVELS_SPEC[0]["stamps"])
        self.spent: list[bool] = [False] * len(self.stamps)
        self.canvas = np.full((CANVAS, CANVAS), BLANK, dtype=np.int16)
        self.target = target_of(LEVELS_SPEC[0])
        self.sel = 0
        self.history: list[tuple[int, np.ndarray]] = []
        camera = Camera(
            width=64, height=64,
            background=GROUND, letter_box=GROUND,
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
        self._paint()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _paint(self) -> None:
        sprites = self.current_level.get_sprites_by_name("canvas")
        if not sprites:
            return
        pixels = sprites[0].pixels
        for cy in range(CANVAS):
            for cx in range(CANVAS):
                pixels[cy * CELL:(cy + 1) * CELL,
                       cx * CELL:(cx + 1) * CELL] = self.canvas[cy, cx]

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

    def _place(self, cx: int, cy: int) -> None:
        if all(self.spent):
            return
        if not (0 <= cx < CANVAS and 0 <= cy < CANVAS):
            return
        idx = self.sel
        shape, colour = self.stamps[idx]
        if not fits(shape, cx, cy):
            return
        self.history.append((idx, self.canvas.copy()))
        for tx, ty in cells(shape, cx, cy):
            self.canvas[ty, tx] = colour
        self.spent[idx] = True
        self._cycle()
        self._paint()
        if all(self.spent) and np.array_equal(self.canvas, self.target):
            self.next_level()

    def _undo(self) -> None:
        if not self.history:
            return
        idx, snapshot = self.history.pop()
        self.canvas = snapshot
        self.spent[idx] = False
        self.sel = idx
        self._paint()

    def step(self) -> None:
        action = self.action.id
        if action == GameAction.ACTION5:
            self._cycle()
        elif action == GameAction.ACTION6:
            data = self.action.data or {}
            self._place(int(data.get("x", -1)) // CELL, int(data.get("y", -1)) // CELL)
        elif action == GameAction.ACTION7:
            self._undo()
        self.complete_action()
