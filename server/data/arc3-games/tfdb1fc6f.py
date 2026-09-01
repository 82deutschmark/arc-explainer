# ARC-AGI-3 candidate task tfdb1fc6f.

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

BG = 4
CRATE = 10
CURSOR = 12
BEAM = 1
PILLAR = 2
PAN = 2
PLATE = 3
PIP = 11
LOCKED = 8

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

PLATE_X = tuple(range(1, 15))
PLATE_Y = tuple(range(10, 14))
PIP_X0, PIP_COLS = 2, 12
PIP_Y0, PIP_ROWS = 11, 2
PIP_CAPACITY = PIP_COLS * PIP_ROWS

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


def _cells(colour: int, w_cells: int, h_cells: int) -> list[list[int]]:
    return [[colour] * (w_cells * CELL) for _ in range(h_cells * CELL)]


def _paint(frame: np.ndarray, cx: int, cy: int, colour: int) -> None:
    frame[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL] = colour


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
                pixels=_cells(PILLAR, len(PILLAR_X), len(PILLAR_Y)), name="pillar",
                blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
                layer=-1,
            ).set_position(PILLAR_X[0] * CELL, PILLAR_Y[0] * CELL),
            Sprite(
                pixels=_cells(PAN, len(LEFT_PAN_X), 1), name="pan_left",
                blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
                layer=-1,
            ).set_position(LEFT_PAN_X[0] * CELL, PAN_Y * CELL),
            Sprite(
                pixels=_cells(PAN, len(RIGHT_PAN_X), 1), name="pan_right",
                blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
                layer=-1,
            ).set_position(RIGHT_PAN_X[0] * CELL, PAN_Y * CELL),
            Sprite(
                pixels=_cells(PLATE, len(PLATE_X), len(PLATE_Y)), name="plate",
                blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
                layer=0,
            ).set_position(PLATE_X[0] * CELL, PLATE_Y[0] * CELL),
        ]
        target = spec["target"]
        if target > PIP_CAPACITY:
            raise ValueError(f"target {target} exceeds the {PIP_CAPACITY} pips the plate can draw")
        for k in range(target):
            cx = PIP_X0 + (k % PIP_COLS)
            cy = PIP_Y0 + (k // PIP_COLS)
            sprites.append(Sprite(
                pixels=_cells(PIP, 1, 1), name=f"pip_{k}",
                blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
                layer=1,
            ).set_position(cx * CELL, cy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G61e1bb4c(RenderableUserDisplay):

    def __init__(self, game: "G1d41b049") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game

        tilt = g.tilt()
        left_y = BEAM_Y + (1 if tilt < 0 else -1 if tilt > 0 else 0)
        right_y = BEAM_Y + (1 if tilt > 0 else -1 if tilt < 0 else 0)
        for cx in BEAM_LEFT:
            _paint(frame, cx, left_y, BEAM)
        for cx in BEAM_RIGHT:
            _paint(frame, cx, right_y, BEAM)

        left_slot = right_slot = 0
        for i, place in enumerate(g.placement):
            if place == ROW:
                _paint(frame, 2 * i, HOME_Y, CRATE)
            elif place == LEFT:
                _paint(frame, LEFT_PAN_X[left_slot % 4], PAN_ROWS[left_slot // 4], CRATE)
                left_slot += 1
            else:
                _paint(frame, RIGHT_PAN_X[right_slot % 4], PAN_ROWS[right_slot // 4], CRATE)
                right_slot += 1

        _paint(frame, 2 * g.cursor, CURSOR_Y, CURSOR)

        if g.locked:
            for cy in PLATE_Y:
                for cx in PLATE_X:
                    _paint(frame, cx, cy, LOCKED)
        return frame


class G1d41b049(ARCBaseGame):

    def __init__(self) -> None:
        spec = LEVELS_SPEC[0]
        self.weights = spec["weights"]
        self.target = spec["target"]
        self.placement = [ROW] * len(self.weights)
        self.cursor = 0
        self.locked = False
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=BG, letter_box=BG,
            interfaces=[G61e1bb4c(self)],
        )
        super().__init__(
            game_id="tfdb1fc6f",
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
                    self.level_reset()
        self.complete_action()
