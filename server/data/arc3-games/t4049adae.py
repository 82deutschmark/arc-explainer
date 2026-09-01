# ARC-AGI-3 candidate task t4049adae.

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

TONES = (0, 1, 2, 3)
WALL = 5
PLAYER = 12
EXIT = 14
SUN = 11

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


class G3a9ca831(RenderableUserDisplay):

    def __init__(self, game: "Ge45fd372") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game
        shade = shade_map(g.heights, SUNS[g.sun])
        for y in range(N):
            for x in range(N):
                px, py = x * CELL, y * CELL
                tone = WALL if shade[y][x] < 0 else TONES[shade[y][x]]
                frame[py:py + CELL, px:px + CELL] = tone

        ex, ey = LEVELS_SPEC[g.level_index]["exit"]
        frame[ey * CELL + 1:ey * CELL + 3, ex * CELL + 1:ex * CELL + 3] = EXIT
        frame[g.py * CELL + 1:g.py * CELL + 3, g.px * CELL + 1:g.px * CELL + 3] = PLAYER

        sx, sy = SUNS[g.sun]
        mid = (N // 2 - 1) * CELL
        if sy < 0:
            frame[0:CELL, mid:mid + 2 * CELL] = SUN
        elif sy > 0:
            frame[(N - 1) * CELL:N * CELL, mid:mid + 2 * CELL] = SUN
        elif sx > 0:
            frame[mid:mid + 2 * CELL, (N - 1) * CELL:N * CELL] = SUN
        else:
            frame[mid:mid + 2 * CELL, 0:CELL] = SUN
        return frame


class Ge45fd372(ARCBaseGame):

    def __init__(self) -> None:
        self.px, self.py = LEVELS_SPEC[0]["start"]
        self.heights = heights(LEVELS_SPEC[0]["rows"])
        self.sun = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=TONES[0], letter_box=WALL,
            interfaces=[G3a9ca831(self)],
        )
        super().__init__(game_id="t4049adae", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.px, self.py = spec["start"]
        self.heights = heights(spec["rows"])
        self.sun = 0
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
                    self.level_reset()
                    self.complete_action()
                    return
                if drop <= 1:
                    self.px, self.py = nx, ny
                    self._sync()
                    if (self.px, self.py) == LEVELS_SPEC[self.level_index]["exit"]:
                        self.next_level()
                        self.complete_action()
                        return

        self.sun = (self.sun + 1) % len(SUNS)
        self.complete_action()
