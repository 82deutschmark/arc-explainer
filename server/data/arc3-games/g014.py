# ARC-AGI-3 candidate task g014.

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

def core(colour: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(1, cell - 1):
        for x in range(1, cell - 1):
            px[y][x] = colour
    return px

def speckle(colour: int, seed: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(cell):
        for x in range(cell):
            if (x * 7 + y * 13 + seed * 31) % 5 == 0:
                px[y][x] = colour
    return px

def fixture(colours: tuple, phase: int, seed: int = 0, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[1][1] = px[cell - 2][cell - 2] = colours[(phase + seed) % len(colours)]
    return px

def dither(frame, box: tuple, colour: int):
    x0, y0, x1, y1 = box
    h, w = frame.shape
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            if (x + y) % 2:
                frame[y, x] = colour
    return frame


TONES = (11, 2, 15, 4)
WALL = 13
WALL_GRAIN = 4
PLAYER = 9
EXIT = WALL
SUN = TONES[0]

CELL = 4
N = 16

SUNS = ((0, -1), (1, 0), (0, 1), (-1, 0))

LEVELS_SPEC = [
    {"start": (3, 2), "exit": (11, 13), "rows": [
        "################",
        "#00000000000000#",
        "#00000000000000#",
        "#00000000000000#",
        "#00000000000000#",
        "#33333313333333#",
        "#33333323333333#",
        "#33333333333333#",
        "#00000020000000#",
        "#00000010000000#",
        "#00000000000000#",
        "#00000000000000#",
        "#00000000000000#",
        "#00000000000000#",
        "#00000000000000#",
        "################",
    ]},
    {"start": (2, 7), "exit": (7, 7), "rows": [
        "################",
        "#00000000000000#",
        "#00000000000000#",
        "#00000111111110#",
        "#00000222222210#",
        "#00000333333210#",
        "#00000444443210#",
        "#00000555543210#",
        "#00000555543210#",
        "#00000444443210#",
        "#00000333333210#",
        "#00000222222210#",
        "#00000111111110#",
        "#00000000000000#",
        "#00000000000000#",
        "################",
    ]},
    {"start": (2, 1), "exit": (7, 14), "rows": [
        "################",
        "#33333333333333#",
        "#33333333333333#",
        "#33333333333333#",
        "#22222222222222#",
        "#22222222222222#",
        "#22222222222222#",
        "#33333333333333#",
        "#33333333333333#",
        "#00020000000200#",
        "#00020000000100#",
        "#00000000000200#",
        "#33333333333333#",
        "#33333333333333#",
        "#33333333333333#",
        "################",
    ]},
    {"start": (1, 1), "exit": (7, 7), "rows": [
        "################",
        "#00000000000000#",
        "#01111111111110#",
        "#01222222222210#",
        "#01233333333210#",
        "#01234000443210#",
        "#01234555543210#",
        "#01234566540000#",
        "#01234566543210#",
        "#01234555543210#",
        "#01234000443210#",
        "#01233333333210#",
        "#01222222222210#",
        "#01111111111110#",
        "#00000000000000#",
        "################",
    ]},
    {"start": (7, 2), "exit": (7, 13), "rows": [
        "################",
        "#55555555555555#",
        "#55555555555555#",
        "#55555555555555#",
        "#55555555555555#",
        "#55555555555555#",
        "#00040000004000#",
        "#00030000003000#",
        "#00000000002000#",
        "#00000000001000#",
        "#00000000000000#",
        "#00000000000000#",
        "#00000000000000#",
        "#00000000000000#",
        "#00000000000000#",
        "################",
    ]},
    {"start": (2, 1), "exit": (7, 14), "rows": [
        "################",
        "#22222222222222#",
        "#00000000000022#",
        "#22222222222222#",
        "#22000000000000#",
        "#22222222222222#",
        "#00000000000022#",
        "#22222222222222#",
        "#22000000000000#",
        "#22222222222222#",
        "#00000000000022#",
        "#22222222222222#",
        "#22000000000000#",
        "#22222222222222#",
        "#22222222222222#",
        "################",
    ]},
    {"start": (7, 13), "exit": (7, 1), "rows": [
        "################",
        "#00000000000000#",
        "#00000000000000#",
        "#00050000050000#",
        "#00000000000000#",
        "#01110000000000#",
        "#22222222222222#",
        "#00000011100000#",
        "#00000000000000#",
        "#00005000005000#",
        "#00000000000000#",
        "#00000000000000#",
        "#00000000000000#",
        "#00000000000000#",
        "#00000000000000#",
        "################",
    ]},
]


def heights(rows: list[str]) -> list[list[int]]:
    return [[-1 if c == "#" else int(c) for c in row] for row in rows]


def shade_map(h: list[list[int]], sun: tuple[int, int]) -> list[list[int]]:
    reach = max((v for row in h for v in row), default=0)
    out = [[0] * N for _ in range(N)]
    sx, sy = sun
    for y in range(N):
        for x in range(N):
            if h[y][x] < 0:
                out[y][x] = -1
                continue
            margin = 0
            for d in range(1, reach + 1):
                nx, ny = x + sx * d, y + sy * d
                if not (0 <= nx < N and 0 <= ny < N):
                    break
                if h[ny][nx] < 0:
                    continue
                margin = max(margin, h[ny][nx] - h[y][x] - d + 1)
            out[y][x] = min(max(margin, 0), len(TONES) - 1)
    return out


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                if char != "#":
                    continue
                sprites.append(Sprite(
                    pixels=[[WALL] * CELL for _ in range(CELL)], name=f"wall_{x}_{y}",
                    blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.TANGIBLE, layer=-1,
                ).set_position(x * CELL, y * CELL))
        bx, by = spec["start"]
        sprites.append(Sprite(
            pixels=[[PLAYER] * CELL for _ in range(CELL)], name="player",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(bx * CELL, by * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


def stamp(frame: np.ndarray, cx: int, cy: int, art: list[list[int]]) -> np.ndarray:
    for j, row in enumerate(art):
        for i, value in enumerate(row):
            if value >= 0:
                frame[cy * CELL + j, cx * CELL + i] = value
    return frame


WEDGE = (6, 4, 2, 1)

FALL_FRAMES = 5


class G014A(RenderableUserDisplay):

    def __init__(self, game: "G014") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game
        shade = shade_map(g.heights, SUNS[g.sun])
        for y in range(N):
            for x in range(N):
                px, py = x * CELL, y * CELL
                if shade[y][x] < 0:
                    frame[py:py + CELL, px:px + CELL] = WALL
                    stamp(frame, x, y, speckle(WALL_GRAIN, (x * 5 + y * 3) % 7))
                else:
                    frame[py:py + CELL, px:px + CELL] = TONES[shade[y][x]]

        ex, ey = LEVELS_SPEC[g.level_index]["exit"]
        stamp(frame, ex, ey, core(EXIT))
        if g.falling:
            self._paint_fall(frame, g)
        else:
            stamp(frame, g.px, g.py, core(PLAYER))

        self._paint_sun(frame, SUNS[g.sun])

        for seed, (cx, cy) in enumerate(((0, 0), (N - 1, 0), (0, N - 1), (N - 1, N - 1))):
            stamp(frame, cx, cy,
                  fixture((WALL_GRAIN, WALL, WALL_GRAIN), g.decor_phase, seed))
        return frame

    def _paint_fall(self, frame: np.ndarray, g: "G014") -> None:
        fx, fy = g.fall_to
        x0, y0 = fx * CELL, fy * CELL
        left = x0 + 1
        if g.falling == FALL_FRAMES:
            stamp(frame, fx, fy, rounded(PLAYER))
        elif g.falling == 4:
            frame[y0 + 2:y0 + 4, left:left + 2] = PLAYER
        elif g.falling == 3:
            dither(frame, (left, y0 + 2, left + 2, y0 + 4), PLAYER)
        elif g.falling == 2:
            dither(frame, (left, y0 + 3, left + 2, y0 + 4), PLAYER)

    def _paint_sun(self, frame: np.ndarray, sun: tuple[int, int]) -> None:
        sx, sy = sun
        mid = N * CELL // 2
        span = N * CELL
        for depth, half in enumerate(WEDGE):
            lo, hi = mid - half, mid + half
            if sy < 0:
                frame[depth, lo:hi] = SUN
            elif sy > 0:
                frame[span - 1 - depth, lo:hi] = SUN
            elif sx < 0:
                frame[lo:hi, depth] = SUN
            else:
                frame[lo:hi, span - 1 - depth] = SUN


class G014(ARCBaseGame):

    def __init__(self) -> None:
        self.px, self.py = LEVELS_SPEC[0]["start"]
        self.heights = heights(LEVELS_SPEC[0]["rows"])
        self.sun = 0
        self.falling = 0
        self.fall_to = LEVELS_SPEC[0]["start"]
        self.decor_phase = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=TONES[0], letter_box=WALL,
            interfaces=[G014A(self)],
        )
        super().__init__(game_id="g014", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.px, self.py = spec["start"]
        self.heights = heights(spec["rows"])
        self.sun = 0
        self.falling = 0
        self.fall_to = spec["start"]
        self._sync(level)

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _sync(self, level: Level | None = None) -> None:
        target = level if level is not None else self.current_level
        body = target.get_sprites_by_name("player")
        if body:
            body[0].set_position(self.px * CELL, self.py * CELL)

    def step(self) -> None:
        if self.falling:
            self.falling -= 1
            if self.falling == 0:
                self.level_reset()
                self.complete_action()
            return

        delta = {
            GameAction.ACTION1: (0, -1),
            GameAction.ACTION2: (0, 1),
            GameAction.ACTION3: (-1, 0),
            GameAction.ACTION4: (1, 0),
        }.get(self.action.id)

        if delta is not None:
            nx, ny = self.px + delta[0], self.py + delta[1]
            if 0 <= nx < N and 0 <= ny < N and self.heights[ny][nx] >= 0:
                drop = self.heights[ny][nx] - self.heights[self.py][self.px]
                if drop <= -2:
                    self.fall_to = (nx, ny)
                    self.falling = FALL_FRAMES
                    return
                if drop <= 1:
                    self.px, self.py = nx, ny
                    self._sync()
                    if (self.px, self.py) == LEVELS_SPEC[self.level_index]["exit"]:
                        self.next_level()
                        self.complete_action()
                        return

        self.sun = (self.sun + 1) % len(SUNS)
        self.decor_phase += 1
        self.complete_action()
