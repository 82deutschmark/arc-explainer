# ARC-AGI-3 candidate task g006.

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

FIELD = 5
DOT = 10
BLOOM = 6
POPPED = 3
PIP_ON = 11
PIP_OFF = 4

N = 32
CELL = 2
BLOOM_R = 5

LEVELS_SPEC = [
    {"target": 4, "dots": [
        (26, 16, -1, 0), (23, 23, -1, -1), (15, 26, 1, -1), (8, 22, 1, -1),
        (6, 15, 1, 1), (10, 8, 1, 1), (18, 6, -1, 1), (25, 11, -1, 1),
    ]},
    {"target": 7, "dots": [
        (26, 16, -1, 0), (23, 23, -1, -1), (15, 26, 1, -1), (8, 22, 1, -1),
        (6, 15, 1, 1), (10, 8, 1, 1), (18, 6, -1, 1), (25, 11, -1, 1),
        (26, 19, -1, -1), (21, 25, -1, -1),
    ]},
    {"target": 9, "dots": [
        (26, 16, -1, 0), (23, 23, -1, -1), (15, 26, 1, -1), (8, 22, 1, -1),
        (6, 15, 1, 1), (10, 8, 1, 1), (18, 6, -1, 1), (25, 11, -1, 1),
        (26, 19, -1, -1), (21, 25, -1, -1), (13, 25, 1, -1), (7, 20, 1, -1),
    ]},
    {"target": 10, "dots": [
        (28, 16, -1, 0), (22, 26, -1, -1), (10, 26, 1, -1), (4, 15, 1, 1),
        (11, 5, 1, 1), (23, 6, -1, 1), (28, 17, -1, -1), (21, 27, -1, -1),
        (9, 25, 1, -1), (4, 14, 1, 1), (12, 5, 1, 1), (24, 7, -1, 1),
    ]},
    {"target": 13, "dots": [
        (28, 16, -1, 0), (24, 25, -1, -1), (15, 28, 1, -1), (7, 24, 1, -1),
        (4, 14, 1, 1), (9, 6, 1, 1), (18, 4, -1, 1), (26, 10, -1, 1),
        (28, 19, -1, -1), (21, 27, -1, -1), (12, 27, 1, -1), (5, 21, 1, -1),
        (5, 11, 1, 1), (12, 5, 1, 1),
    ]},
    {"target": 14, "dots": [
        (28, 16, -1, 0), (26, 23, -1, -1), (19, 28, -1, -1), (12, 27, 1, -1),
        (6, 22, 1, -1), (4, 15, 1, 1), (7, 8, 1, 1), (14, 4, 1, 1),
        (21, 5, -1, 1), (27, 11, -1, 1), (28, 18, -1, -1), (24, 25, -1, -1),
        (17, 28, -1, -1), (10, 26, 1, -1),
    ]},
]


def drift(dots, ticks):
    out = []
    for (x, y, vx, vy) in dots:
        out.append(((x + vx * ticks) % N, (y + vy * ticks) % N, vx, vy))
    return out


def chain_from(positions, start_index):
    popped = {start_index}
    frontier = [start_index]
    while frontier:
        i = frontier.pop()
        xi, yi = positions[i][0], positions[i][1]
        for j, (xj, yj, _, _) in enumerate(positions):
            if j in popped:
                continue
            dx = min(abs(xi - xj), N - abs(xi - xj))
            dy = min(abs(yi - yj), N - abs(yi - yj))
            if dx * dx + dy * dy <= BLOOM_R * BLOOM_R:
                popped.add(j)
                frontier.append(j)
    return popped


def best_chain(spec, max_ticks=40):
    best = (0, 0, -1)
    for t in range(max_ticks):
        pos = drift(spec["dots"], t)
        for i in range(len(pos)):
            n = len(chain_from(pos, i))
            if n > best[0]:
                best = (n, t, i)
    return best


def _cell(colour):
    return [[colour] * CELL for _ in range(CELL)]


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        sprites = [Sprite(
            pixels=_cell(DOT), name=f"dot_{i}",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=0,
        ).set_position(x * CELL, y * CELL) for i, (x, y, _, _) in enumerate(spec["dots"])]
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G006A(RenderableUserDisplay):

    def __init__(self, game: "G006") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        target = LEVELS_SPEC[self._game.level_index]["target"]
        got = self._game.chain_size
        for i in range(target):
            x = 1 + i * 3
            if x + 2 > frame.shape[1]:
                break
            frame[1:3, x:x + 2] = PIP_ON if i < got else PIP_OFF
        return frame


class G006(ARCBaseGame):

    def __init__(self) -> None:
        self.ticks = 0
        self.chain_size = 0
        self.popped: set = set()
        self.blooms: list = []
        self.resolving = False
        camera = Camera(width=N * CELL, height=N * CELL,
                        background=FIELD, letter_box=5,
                        interfaces=[G006A(self)])
        super().__init__(game_id="g006", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self.ticks = 0
        self.chain_size = 0
        self.popped = set()
        self.blooms = []
        self.resolving = False

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _positions(self):
        return drift(LEVELS_SPEC[self.level_index]["dots"], self.ticks)

    def _repaint(self) -> None:
        for i, (x, y, _, _) in enumerate(self._positions()):
            for sprite in self.current_level.get_sprites_by_name(f"dot_{i}"):
                sprite.set_position(x * CELL, y * CELL)
                if i in self.popped:
                    sprite.pixels = np.array(_cell(POPPED))
                elif any(i == b[3] for b in self.blooms):
                    sprite.pixels = np.array(_cell(BLOOM))
                else:
                    sprite.pixels = np.array(_cell(DOT))

    def _detonate(self, cx: int, cy: int) -> None:
        positions = self._positions()
        nearest, best = None, 9999
        for i, (x, y, _, _) in enumerate(positions):
            d = (x - cx) ** 2 + (y - cy) ** 2
            if d < best:
                nearest, best = i, d
        if nearest is None or best > 9:
            return
        self.popped = chain_from(positions, nearest)
        self.chain_size = len(self.popped)
        self._repaint()

        if self.chain_size >= LEVELS_SPEC[self.level_index]["target"]:
            if self.is_last_level():
                self.next_level()
            else:
                self.next_level()
        else:
            self.ticks = 0
            self.chain_size = 0
            self.popped = set()
            self._repaint()

    def step(self) -> None:
        if self.action.id == GameAction.ACTION5:
            self.ticks += 1
            self._repaint()
        elif self.action.id == GameAction.ACTION6:
            x = int(self.action.data.get("x", -1)) // CELL
            y = int(self.action.data.get("y", -1)) // CELL
            self._detonate(x, y)
        self.complete_action()
