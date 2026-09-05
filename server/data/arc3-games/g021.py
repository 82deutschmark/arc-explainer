# ARC-AGI-3 candidate task g021.

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
from sprite_book import core, dither, figure, hairline, ring, rounded

BG = 0
CRATE = 9
CURSOR = 12
BEAM = 3
PILLAR = 3
PAN = 3
PLATE = 3
PIP = 14
LOCKED = 6

N = 16
CELL = 4

HOME_Y = 1
CURSOR_Y = 2

BEAM_LEFT = tuple(range(2, 8))
BEAM_RIGHT = tuple(range(8, 14))
BEAM_Y = 4

PILLAR_X = (7, 8)
PILLAR_Y = tuple(range(5, 10))

PAN_Y = 8
LEFT_PAN_X = (1, 2, 3, 4)
RIGHT_PAN_X = (11, 12, 13, 14)
PAN_ROWS = (7, 6)
LEFT_CORD_X = BEAM_LEFT[0]
RIGHT_CORD_X = BEAM_RIGHT[-1]

PLATE_X = tuple(range(1, 15))
PLATE_Y = tuple(range(10, 14))
PIP_X0, PIP_GROUP, PIP_PER_ROW = 2, 5, 10
PIP_Y0, PIP_ROWS = 11, 2
PIP_CAPACITY = PIP_PER_ROW * PIP_ROWS

ROW, LEFT, RIGHT = 0, 1, 2

LEVELS_SPEC = [
    {"weights": (2, 3, 1), "target": 3},
    {"weights": (3, 1, 4, 2), "target": 4},
    {"weights": (4, 2, 5, 1, 3), "target": 1},
    {"weights": (5, 2, 6, 1, 4, 3), "target": 9},
    {"weights": (3, 7, 1, 5, 2, 6, 4), "target": 2},
    {"weights": (6, 2, 8, 4, 1, 7, 3, 5), "target": 13},
    {"weights": (4, 8, 1, 6, 3, 7, 2, 5), "target": 1},
    {"weights": (5, 3, 7, 1, 8, 2, 6, 4), "target": 17},
]


def _tiled(cell_px: list[list[int]], w_cells: int, h_cells: int) -> list[list[int]]:
    rows: list[list[int]] = []
    for _ in range(h_cells):
        for row in cell_px:
            rows.append(list(row) * w_cells)
    return rows


def _placard(colour: int, w_cells: int, h_cells: int) -> list[list[int]]:
    px = [[-1] * (w_cells * CELL) for _ in range(h_cells * CELL)]
    h, w = len(px), len(px[0])
    for x in range(1, w - 1):
        px[1][x] = px[2][x] = px[h - 3][x] = px[h - 2][x] = colour
    for y in range(1, h - 1):
        px[y][1] = px[y][2] = px[y][w - 3] = px[y][w - 2] = colour
    return px


def pip_cell(k: int) -> tuple[int, int]:
    within = k % PIP_PER_ROW
    cx = PIP_X0 + within + (within // PIP_GROUP)
    cy = PIP_Y0 + k // PIP_PER_ROW
    return cx, cy


def _stamp(frame: np.ndarray, cx: int, cy: int, px: list[list[int]]) -> None:
    y0, x0 = cy * CELL, cx * CELL
    for dy, row in enumerate(px):
        for dx, value in enumerate(row):
            if value >= 0:
                frame[y0 + dy, x0 + dx] = value


def apply_move(placement: list[int], cursor: int, action: int) -> tuple[list[int], int]:
    placement = list(placement)
    if action == 1:
        placement[cursor] = ROW if placement[cursor] == LEFT else LEFT
    elif action == 2:
        placement[cursor] = ROW if placement[cursor] == RIGHT else RIGHT
    elif action == 3:
        cursor = max(0, cursor - 1)
    elif action == 4:
        cursor = min(len(placement) - 1, cursor + 1)
    return placement, cursor


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = [
            Sprite(
                pixels=_tiled(ring(PILLAR), len(PILLAR_X), len(PILLAR_Y)), name="pillar",
                blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
                layer=-1,
            ).set_position(PILLAR_X[0] * CELL, PILLAR_Y[0] * CELL),
            Sprite(
                pixels=_tiled(rounded(PAN), len(LEFT_PAN_X), 1), name="pan_left",
                blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
                layer=-1,
            ).set_position(LEFT_PAN_X[0] * CELL, PAN_Y * CELL),
            Sprite(
                pixels=_tiled(rounded(PAN), len(RIGHT_PAN_X), 1), name="pan_right",
                blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
                layer=-1,
            ).set_position(RIGHT_PAN_X[0] * CELL, PAN_Y * CELL),
            Sprite(
                pixels=_placard(PLATE, len(PLATE_X), len(PLATE_Y)), name="plate",
                blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
                layer=0,
            ).set_position(PLATE_X[0] * CELL, PLATE_Y[0] * CELL),
        ]
        target = spec["target"]
        if target > PIP_CAPACITY:
            raise ValueError(f"target {target} exceeds the {PIP_CAPACITY} pips the plate can draw")
        for k in range(target):
            cx, cy = pip_cell(k)
            sprites.append(Sprite(
                pixels=core(PIP), name=f"pip_{k}",
                blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
                layer=1,
            ).set_position(cx * CELL, cy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G021A(RenderableUserDisplay):

    def __init__(self, game: "G021") -> None:
        super().__init__()
        self._game = game

    def _beam_half(self, frame: np.ndarray, cells: tuple, cy: int) -> None:
        y = cy * CELL + 1
        x0 = cells[0] * CELL
        x1 = (cells[-1] + 1) * CELL - 1
        hairline(frame, (x0, y), (x1, y), BEAM)
        hairline(frame, (x0, y + 1), (x1, y + 1), BEAM)

    def _cord(self, frame: np.ndarray, cx: int, beam_cy: int) -> None:
        x = cx * CELL + 1
        hairline(frame, (x, beam_cy * CELL + 3), (x, PAN_Y * CELL), BEAM, only_over={BG})

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game

        tilt = g.tilt()
        left_y = BEAM_Y + (1 if tilt < 0 else -1 if tilt > 0 else 0)
        right_y = BEAM_Y + (1 if tilt > 0 else -1 if tilt < 0 else 0)
        self._beam_half(frame, BEAM_LEFT, left_y)
        self._beam_half(frame, BEAM_RIGHT, right_y)
        self._cord(frame, LEFT_CORD_X, left_y)
        self._cord(frame, RIGHT_CORD_X, right_y)

        crate = ring(CRATE)
        left_slot = right_slot = 0
        for i, place in enumerate(g.placement):
            if place == ROW:
                _stamp(frame, 2 * i, HOME_Y, crate)
            elif place == LEFT:
                _stamp(frame, LEFT_PAN_X[left_slot % 4], PAN_ROWS[left_slot // 4], crate)
                left_slot += 1
            else:
                _stamp(frame, RIGHT_PAN_X[right_slot % 4], PAN_ROWS[right_slot // 4], crate)
                right_slot += 1

        _stamp(frame, 2 * g.cursor, CURSOR_Y, figure(CURSOR))

        if g.locked:
            box = (PLATE_X[0] * CELL + 1, PLATE_Y[0] * CELL + 1,
                   (PLATE_X[-1] + 1) * CELL - 1, (PLATE_Y[-1] + 1) * CELL - 1)
            if g.flash % 2 == 0:
                frame[box[1]:box[3], box[0]:box[2]] = LOCKED
            else:
                dither(frame, box, LOCKED)
        return frame


class G021(ARCBaseGame):

    SPENT_FRAMES = 6

    def __init__(self) -> None:
        spec = LEVELS_SPEC[0]
        self.weights = spec["weights"]
        self.target = spec["target"]
        self.placement = [ROW] * len(self.weights)
        self.cursor = 0
        self.locked = False
        self.flash = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=BG, letter_box=BG,
            interfaces=[G021A(self)],
        )
        super().__init__(
            game_id="g021",
            levels=build_levels(),
            camera=camera,
            available_actions=[1, 2, 3, 4, 5],
        )

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.weights = spec["weights"]
        self.target = spec["target"]
        self.placement = [ROW] * len(self.weights)
        self.cursor = 0
        self.locked = False
        self.flash = 0

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def pan_total(self, side: int) -> int:
        return sum(w for w, p in zip(self.weights, self.placement) if p == side)

    def tilt(self) -> int:
        diff = self.pan_total(LEFT) - self.pan_total(RIGHT)
        return -1 if diff > 0 else 1 if diff < 0 else 0

    def step(self) -> None:
        if self.flash:
            self.flash -= 1
            if self.flash == 0:
                self.level_reset()
                self.complete_action()
            return

        if self.locked:
            self.complete_action()
            return

        action = self.action.id
        if action in (GameAction.ACTION1, GameAction.ACTION2,
                      GameAction.ACTION3, GameAction.ACTION4):
            code = {GameAction.ACTION1: 1, GameAction.ACTION2: 2,
                    GameAction.ACTION3: 3, GameAction.ACTION4: 4}[action]
            self.placement, self.cursor = apply_move(self.placement, self.cursor, code)
        elif action == GameAction.ACTION5:
            total = self.pan_total(LEFT)
            if total > 0:
                if total == self.target:
                    self.next_level()
                else:
                    self.locked = True
                    self.flash = self.SPENT_FRAMES
                    return
        self.complete_action()
