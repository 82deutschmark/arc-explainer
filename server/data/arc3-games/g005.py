# ARC-AGI-3 candidate task g005.

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
from sprite_book import blink, block, door, facing, figure, hairline, medallion, weave

FLOOR = 0
WALL = 4
GATE_OFF = 6
GATE_ON = 11
WALKER = 15
TRIM = 7
BROKE = WALKER
LINK = WALL

N = 16
CELL = 4
PATH_X = 8

HALT_FRAMES = 4

LAMPS = ((14, 1), (30, 2), (49, 1), (20, 61), (43, 62))

LEVELS_SPEC = [
    {"gates": [4, 8, 12],            "start": [0, 0, 0], "required": [1, 0, 1], "links": {}},
    {"gates": [3, 6, 9, 12],         "start": [1, 0, 1, 0], "required": [0, 0, 1, 1], "links": {}},
    {"gates": [3, 6, 9, 12],         "start": [0, 0, 0, 0], "required": [1, 1, 0, 1],
     "links": {0: 2}},
    {"gates": [2, 5, 8, 11, 13],     "start": [1, 1, 0, 0, 1], "required": [0, 1, 1, 0, 0],
     "links": {1: 3}},
    {"gates": [2, 4, 6, 9, 11, 13],  "start": [0, 1, 0, 1, 0, 1],
     "required": [1, 1, 1, 0, 0, 1], "links": {0: 4, 2: 5}},
    {"gates": [2, 4, 6, 8, 10, 12],  "start": [1, 0, 1, 0, 1, 0],
     "required": [0, 0, 1, 1, 1, 1], "links": {1: 2, 3: 4}},
]


def toggle_matrix(spec):
    n = len(spec["gates"])
    rows = []
    for i in range(n):
        row = [0] * n
        row[i] = 1
        partner = spec["links"].get(i)
        if partner is not None:
            row[partner] ^= 1
        rows.append(row)
    return rows


def _gate_pixels(state):
    return medallion(WALL, GATE_ON if state else GATE_OFF, CELL)


def _walker_pixels(moving):
    if moving:
        return facing(WALKER, TRIM, (0, 1), CELL)
    return figure(WALKER, TRIM, CELL)


def _exit_pixels():
    px = door(TRIM, None, CELL)
    px[CELL - 1][1] = px[CELL - 1][CELL - 2] = WALL
    return px


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        sprites = []
        for y in range(N):
            for x in range(N):
                if x == 0 or y == 0 or x == N - 1 or y == N - 1:
                    sprites.append(Sprite(
                        pixels=block(WALL, CELL), name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(x * CELL, y * CELL))
        for i, gy in enumerate(spec["gates"]):
            sprites.append(Sprite(
                pixels=_gate_pixels(spec["start"][i]), name=f"gate_{i}",
                blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.TANGIBLE, layer=0, tags=["gate", f"idx_{i}"],
            ).set_position(PATH_X * CELL, gy * CELL))
            partner = spec["links"].get(i)
            if partner is not None:
                for end in (gy, spec["gates"][partner]):
                    sprites.append(Sprite(
                        pixels=weave(LINK, CELL), name=f"link_{i}_{end}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0,
                    ).set_position((PATH_X - 2) * CELL, end * CELL))
        sprites.append(Sprite(
            pixels=_exit_pixels(), name="exit", blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=0,
        ).set_position(PATH_X * CELL, (N - 2) * CELL))
        sprites.append(Sprite(
            pixels=_walker_pixels(moving=False), name="walker",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(PATH_X * CELL, 1 * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G005A(RenderableUserDisplay):

    def __init__(self, game: "G005") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        height, width = frame.shape

        rail = PATH_X * CELL + CELL // 2
        hairline(frame, (rail, CELL), (rail, (N - 1) * CELL - 1), TRIM, only_over={FLOOR})

        for i, (lx, ly) in enumerate(LAMPS):
            frame[ly, lx:lx + 2] = TRIM if blink(self._game.beat + i * 2, 5) else WALL

        row = self._game.broke_at_row
        if row is None:
            return frame
        top = row * CELL
        if not 0 <= top <= height - CELL:
            return frame
        mark = BROKE if self._game.halt % 2 == 0 else TRIM
        for offset, span in enumerate((1, 2, 2, 1)):
            frame[top + offset, 1:1 + span] = mark
            frame[top + offset, width - 1 - span:width - 1] = mark
        return frame


class G005(ARCBaseGame):

    def __init__(self) -> None:
        self.states = list(LEVELS_SPEC[0]["start"])
        self.broke_at_row = None
        self.beat = 0
        self.halt = 0
        self._stop_row = None
        self._at_row = 1
        self._broke = False
        camera = Camera(width=N * CELL, height=N * CELL,
                        background=FLOOR, letter_box=5,
                        interfaces=[G005A(self)])
        super().__init__(game_id="g005", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self.states = list(LEVELS_SPEC[self.level_index]["start"])
        self.broke_at_row = None
        self.beat = 0
        self.halt = 0
        self._stop_row = None
        self._at_row = 1
        self._broke = False

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _repaint(self) -> None:
        for i, state in enumerate(self.states):
            for sprite in self.current_level.get_sprites_by_name(f"gate_{i}"):
                sprite.pixels = np.array(_gate_pixels(state))

    def _place_walker(self, row: int, moving: bool) -> None:
        for sprite in self.current_level.get_sprites_by_name("walker"):
            sprite.pixels = np.array(_walker_pixels(moving))
            sprite.set_position(PATH_X * CELL, row * CELL)

    def _flip(self, index: int) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.states[index] ^= 1
        partner = spec["links"].get(index)
        if partner is not None:
            self.states[partner] ^= 1
        self._repaint()

    def _begin_run(self) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.broke_at_row = None
        self._stop_row, self._broke = N - 2, False
        for i, gy in enumerate(spec["gates"]):
            if self.states[i] != spec["required"][i]:
                self._stop_row, self._broke = gy, True
                break
        self._at_row = 1
        self.halt = 0
        self._place_walker(self._at_row, moving=True)

    def _advance_run(self) -> None:
        if self._at_row < self._stop_row:
            self._at_row += 1
            arrived = self._at_row == self._stop_row
            self._place_walker(self._at_row, moving=not arrived)
            if arrived:
                self.halt = HALT_FRAMES
                if self._broke:
                    self.broke_at_row = self._stop_row
            return
        self.halt -= 1
        if self.halt > 0:
            return
        self._stop_row = None
        if not self._broke:
            self.next_level()
        self.complete_action()

    def step(self) -> None:
        if self._stop_row is not None:
            self._advance_run()
            return

        if self.action.id == GameAction.ACTION6:
            self.beat += 1
            spec = LEVELS_SPEC[self.level_index]
            x = int(self.action.data.get("x", -1))
            y = int(self.action.data.get("y", -1))
            cx, cy = x // CELL, y // CELL
            if cx == PATH_X:
                for i, gy in enumerate(spec["gates"]):
                    if cy == gy:
                        self._flip(i)
                        break
            self.complete_action()
            return

        if self.action.id == GameAction.ACTION5:
            self.beat += 1
            self._begin_run()
            return

        self.complete_action()
