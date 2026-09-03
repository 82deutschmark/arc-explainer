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


def block(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour] * cell for _ in range(cell)]

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

def hatch(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 3 == 0 else -1 for x in range(cell)] for y in range(cell)]

def studs(frame, count: int, filled: int, on: int, off: int, side: str = "east",
          start: int = 8, gap: int = 6):
    h, w = frame.shape
    for i in range(count):
        top = start + i * gap
        if top + 2 > h:
            break
        colour = on if i < filled else off
        length = min(1 + i, w // 4)
        if side == "east":
            frame[top:top + 2, w - length:w] = colour
        else:
            frame[top:top + 2, 0:length] = colour
    return frame


FIELD = 1
DOT = 13
BLOOM = 11
SPENT = 4
DECOR = 12
DIM = 3
PIP_ON = BLOOM
PIP_OFF = SPENT

N = 32
CELL = 2
BLOOM_R = 5

FITTINGS = [(7, 3), (24, 3), (7, 29), (24, 29)]

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


def chain_waves(positions, start_index):
    seen = {start_index}
    waves = [[start_index]]
    while True:
        nxt = []
        for i in waves[-1]:
            xi, yi = positions[i][0], positions[i][1]
            for j, (xj, yj, _, _) in enumerate(positions):
                if j in seen:
                    continue
                dx = min(abs(xi - xj), N - abs(xi - xj))
                dy = min(abs(yi - yj), N - abs(yi - yj))
                if dx * dx + dy * dy <= BLOOM_R * BLOOM_R:
                    seen.add(j)
                    nxt.append(j)
        if not nxt:
            return waves
        waves.append(nxt)


def best_chain(spec, max_ticks=40):
    best = (0, 0, -1)
    for t in range(max_ticks):
        pos = drift(spec["dots"], t)
        for i in range(len(pos)):
            n = len(chain_from(pos, i))
            if n > best[0]:
                best = (n, t, i)
    return best


def _seed():
    return [[-1, DOT], [DOT, DOT]]


def _flare():
    return block(BLOOM, CELL)


def _husk():
    return weave(SPENT, CELL)


def _fitting(phase):
    return hatch(DECOR if phase % 7 < 3 else DIM, CELL)


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        sprites = [Sprite(
            pixels=_seed(), name=f"dot_{i}",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(x * CELL, y * CELL) for i, (x, y, _, _) in enumerate(spec["dots"])]
        sprites += [Sprite(
            pixels=_fitting(k), name=f"fitting_{k}",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=0,
        ).set_position(fx * CELL, fy * CELL) for k, (fx, fy) in enumerate(FITTINGS)]
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G006A(RenderableUserDisplay):

    def __init__(self, game: "G006") -> None:
        super().__init__()
        self._game = game

    @staticmethod
    def _wedge(frame, count, filled, side):
        if count <= 0:
            return
        gap = 6
        span = count * gap - (gap - 2)
        studs(frame, count, filled, PIP_ON, PIP_OFF, side=side,
              start=((frame.shape[0] - span) // 2) | 1, gap=gap)

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        target = LEVELS_SPEC[self._game.level_index]["target"]
        got = min(self._game.chain_size, self._game.shown)
        west = (target + 1) // 2
        self._wedge(frame, west, min(got, west), "west")
        self._wedge(frame, target - west, max(0, got - west), "east")
        return frame


class G006(ARCBaseGame):

    TAIL_FRAMES = 3

    def __init__(self) -> None:
        self.ticks = 0
        self.chain_size = 0
        self.shown = 0
        self.popped: set = set()
        self.pulse = 0
        self._waves: list = []
        self._lit: set = set()
        self._spent: set = set()
        self._flash = 0
        camera = Camera(width=N * CELL, height=N * CELL,
                        background=FIELD, letter_box=FIELD,
                        interfaces=[G006A(self)])
        super().__init__(game_id="g006", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self.ticks = 0
        self.chain_size = 0
        self.shown = 0
        self.popped = set()
        self._waves = []
        self._lit = set()
        self._spent = set()
        self._flash = 0

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
                if i in self._lit:
                    sprite.pixels = np.array(_flare())
                elif i in self._spent:
                    sprite.pixels = np.array(_husk())
                else:
                    sprite.pixels = np.array(_seed())
        for k in range(len(FITTINGS)):
            for sprite in self.current_level.get_sprites_by_name(f"fitting_{k}"):
                sprite.pixels = np.array(_fitting(self.pulse + k))

    def _detonate(self, cx: int, cy: int) -> bool:
        positions = self._positions()
        nearest, best = None, 9999
        for i, (x, y, _, _) in enumerate(positions):
            d = (x - cx) ** 2 + (y - cy) ** 2
            if d < best:
                nearest, best = i, d
        if nearest is None or best > 9:
            return False
        self.popped = chain_from(positions, nearest)
        self.chain_size = len(self.popped)
        waves = chain_waves(positions, nearest)
        stray = sorted(self.popped - {i for wave in waves for i in wave})
        if stray:
            waves[-1].extend(stray)
        self._waves = waves
        self._lit = set()
        self._spent = set()
        self.shown = 0
        self._flash = len(waves) + self.TAIL_FRAMES
        return True

    def _play_frame(self) -> None:
        stage = len(self._waves) + self.TAIL_FRAMES - 1 - self._flash
        self._spent |= self._lit
        self._lit = set(self._waves[stage]) if stage < len(self._waves) else set()
        self.shown = len(self._spent | self._lit)
        self._repaint()

    def _settle(self) -> None:
        if self.chain_size >= LEVELS_SPEC[self.level_index]["target"]:
            self.next_level()
        else:
            self.ticks = 0
            self.chain_size = 0
            self.shown = 0
            self.popped = set()
            self._lit = set()
            self._spent = set()
            self._repaint()

    def step(self) -> None:
        self.pulse += 1
        if not self._flash:
            if self.action.id == GameAction.ACTION5:
                self.ticks += 1
                self._repaint()
                self.complete_action()
                return
            if self.action.id == GameAction.ACTION6:
                x = int(self.action.data.get("x", -1)) // CELL
                y = int(self.action.data.get("y", -1)) // CELL
                self._detonate(x, y)
            if not self._flash:
                self._repaint()
                self.complete_action()
                return
        self._flash -= 1
        self._play_frame()
        if self._flash == 0:
            self._settle()
            self.complete_action()
