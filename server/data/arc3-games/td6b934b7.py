# ARC-AGI-3 candidate task td6b934b7.

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

FLOOR = 4
WALL = 1
GATE_OFF = 9
GATE_ON = 11
WALKER = 12
EXIT = 14
BROKE = 8
LINK = 15

N = 16
CELL = 4
PATH_X = 8

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


def _cell(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _gate_pixels(state):
    colour = GATE_ON if state else GATE_OFF
    block = [[colour] * CELL for _ in range(CELL)]
    block[1][1] = block[1][2] = block[2][1] = block[2][2] = FLOOR
    return block


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        sprites = []
        for y in range(N):
            for x in range(N):
                if x == 0 or y == 0 or x == N - 1 or y == N - 1:
                    sprites.append(Sprite(
                        pixels=_cell(WALL), name=f"wall_{x}_{y}",
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
                        pixels=_cell(LINK), name=f"link_{i}_{end}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0,
                    ).set_position((PATH_X - 2) * CELL, end * CELL))
        sprites.append(Sprite(
            pixels=_cell(EXIT), name="exit", blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=0,
        ).set_position(PATH_X * CELL, (N - 2) * CELL))
        sprites.append(Sprite(
            pixels=_cell(WALKER), name="walker", blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(PATH_X * CELL, 1 * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G17e3b5bc(RenderableUserDisplay):

    def __init__(self, game: "Gdcc1e8e5") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        y = self._game.broke_at_row
        if y is not None and 0 <= y * CELL < frame.shape[0]:
            frame[y * CELL:y * CELL + CELL, 1:3] = BROKE
        return frame


class Gdcc1e8e5(ARCBaseGame):

    def __init__(self) -> None:
        self.states = list(LEVELS_SPEC[0]["start"])
        self.broke_at_row = None
        camera = Camera(width=N * CELL, height=N * CELL,
                        background=FLOOR, letter_box=5,
                        interfaces=[G17e3b5bc(self)])
        super().__init__(game_id="td6b934b7", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self.states = list(LEVELS_SPEC[self.level_index]["start"])
        self.broke_at_row = None

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

    def _flip(self, index: int) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.states[index] ^= 1
        partner = spec["links"].get(index)
        if partner is not None:
            self.states[partner] ^= 1
        self._repaint()

    def _release(self) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.broke_at_row = None
        for i, gy in enumerate(spec["gates"]):
            if self.states[i] != spec["required"][i]:
                self.broke_at_row = gy
                for sprite in self.current_level.get_sprites_by_name("walker"):
                    sprite.set_position(PATH_X * CELL, gy * CELL)
                return
        for sprite in self.current_level.get_sprites_by_name("walker"):
            sprite.set_position(PATH_X * CELL, (N - 2) * CELL)
        if self.is_last_level():
            self.next_level()
        else:
            self.next_level()

    def step(self) -> None:
        spec = LEVELS_SPEC[self.level_index]
        if self.action.id == GameAction.ACTION6:
            x = int(self.action.data.get("x", -1))
            y = int(self.action.data.get("y", -1))
            cx, cy = x // CELL, y // CELL
            if cx == PATH_X:
                for i, gy in enumerate(spec["gates"]):
                    if cy == gy:
                        self._flip(i)
                        break
        elif self.action.id == GameAction.ACTION5:
            self._release()
        elif self.action.id in (GameAction.ACTION1, GameAction.ACTION2):
            pass
        self.complete_action()
