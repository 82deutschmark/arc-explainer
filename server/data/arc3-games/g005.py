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


def block(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour] * cell for _ in range(cell)]

def rounded(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for (y, x) in ((0, 0), (0, cell - 1), (cell - 1, 0), (cell - 1, cell - 1)):
        px[y][x] = -1
    return px

def figure(body: int, mark: int | None = None, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    mid = cell // 2
    for x in range(1, cell - 1):
        px[0][x] = body
    for y in range(1, cell - 1):
        for x in range(cell):
            px[y][x] = body
    px[cell - 1][0] = px[cell - 1][mid] = -1
    for x in range(cell):
        if px[cell - 1][x] != -1:
            px[cell - 1][x] = body
    px[cell - 1][1] = body
    px[cell - 1][cell - 1] = body
    if mark is not None and cell >= 4:
        px[mid][mid] = mark
    return px

def facing(body: int, visor: int, heading: tuple, cell: int = 4) -> list[list[int]]:
    px = rounded(body, cell)
    dx, dy = heading
    last = cell - 1
    if dy < 0:
        px[0][1] = px[0][cell - 2] = visor
    elif dy > 0:
        px[last][1] = px[last][cell - 2] = visor
    elif dx < 0:
        px[1][0] = px[cell - 2][0] = visor
    elif dx > 0:
        px[1][last] = px[cell - 2][last] = visor
    else:
        px[1][1] = visor
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

def door(frame_colour: int, bar: int | None, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    last = cell - 1
    for y in range(cell):
        px[y][0] = px[y][last] = frame_colour
    for x in range(cell):
        px[0][x] = frame_colour
    if bar is not None:
        for y in range(1, cell):
            for x in range(1, last):
                px[y][x] = bar
    return px

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

def hairline(frame, a: tuple, b: tuple, colour: int, only_over=None):
    x0, y0 = a
    x1, y1 = b
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    h, w = frame.shape
    while True:
        if 0 <= x0 < w and 0 <= y0 < h:
            if only_over is None or int(frame[y0, x0]) in only_over:
                frame[y0, x0] = colour
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy
    return frame

def blink(step: int, period: int = 3) -> bool:
    return (step // period) % 2 == 0


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
