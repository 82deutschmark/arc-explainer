# ARC-AGI-3 candidate task t715ea045.

from collections import deque

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
PIT = 15
EXIT = 14
PLAYER = 12
UNKNOWN = 5
PIP_ON = 11
PIP_OFF = 3

CELL = 4
PULSE_RADIUS = 6

OPEN_CHARS = ".PX"
DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))


def pulse_reveal(rows, sx, sy, radius=PULSE_RADIUS):
    learned = {(sx, sy)}
    seen = {(sx, sy)}
    queue = deque([(sx, sy, 0)])
    while queue:
        x, y, dist = queue.popleft()
        for dx, dy in DIRS:
            nx, ny = x + dx, y + dy
            if not (0 <= nx < len(rows[0]) and 0 <= ny < len(rows)):
                continue
            if rows[ny][nx] in OPEN_CHARS:
                if dist + 1 <= radius and (nx, ny) not in seen:
                    seen.add((nx, ny))
                    learned.add((nx, ny))
                    queue.append((nx, ny, dist + 1))
            else:
                learned.add((nx, ny))
    return learned


LEVELS_SPEC = [
    {"pulses": 2, "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..P...........#",
        "#..............#",
        "#......X.......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"pulses": 3, "rows": [
        "################",
        "#..............#",
        "#..P...........#",
        "#..............#",
        "#####.##########",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.........X....#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"pulses": 4, "rows": [
        "################",
        "#..............#",
        "#..P...........#",
        "#......o.......#",
        "#####.##########",
        "#..............#",
        "#...o.....o....#",
        "#..............#",
        "#.....o........#",
        "#..............#",
        "#.........X....#",
        "#..o......o....#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"pulses": 3, "rows": [
        "################",
        "#.####.........#",
        "#.#P#..........#",
        "#.#.#..........#",
        "#.#.#..........#",
        "#.#.#..........#",
        "#.#.#####.######",
        "#.#............#",
        "#.#....o.......#",
        "#.#............#",
        "#.#........X...#",
        "#.#....o.......#",
        "#.#............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"pulses": 3, "rows": [
        "################",
        "#..P...#.......#",
        "#......#.......#",
        "#......#.......#",
        "#..###.#.......#",
        "#....#.#...o...#",
        "####.#.#.......#",
        "#....#...#######",
        "#.####.........#",
        "#......o.......#",
        "#.####.........#",
        "#....#.....X...#",
        "#.o..#.........#",
        "#....#.........#",
        "#..............#",
        "################",
    ]},
    {"pulses": 3, "rows": [
        "################",
        "#..P..#........#",
        "#.....#........#",
        "#.....#....o...#",
        "#.###.#........#",
        "#...#.#........#",
        "##..#.####.#####",
        "#...#..........#",
        "#.###....o.....#",
        "#........#.....#",
        "#..o.....#..X..#",
        "#........#.....#",
        "#..#######.....#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"pulses": 5, "rows": [
        "################",
        "#....#.........#",
        "#..P.#.........#",
        "#....#....o....#",
        "#....#.........#",
        "#.##.#.........#",
        "#..#.#####.#####",
        "#..#.....#.....#",
        "#..#..o..#.....#",
        "#..#.....#..X..#",
        "#..#.....#.....#",
        "#..#####.#.....#",
        "#......o.#.....#",
        "#........#.....#",
        "#..............#",
        "################",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])


def _cell_block(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                px, py = x * CELL, y * CELL
                if char == "#":
                    sprites.append(Sprite(
                        pixels=_cell_block(WALL), name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif char == "o":
                    sprites.append(Sprite(
                        pixels=_cell_block(PIT), name=f"pit_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0, tags=["pit"],
                    ).set_position(px, py))
                elif char == "X":
                    sprites.append(Sprite(
                        pixels=_cell_block(EXIT), name="exit",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0, tags=["exit"],
                    ).set_position(px, py))
                elif char == "P":
                    sprites.append(Sprite(
                        pixels=_cell_block(PLAYER), name="player",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=1,
                    ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class Ge31d9375(RenderableUserDisplay):

    def __init__(self, game: "Ge05b1417") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        out = np.full_like(frame, UNKNOWN)
        for x, y in self._game.known:
            if 0 <= x < N and 0 <= y < N:
                out[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = \
                    frame[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL]
        px, py = self._game.player_cell()
        out[py * CELL:(py + 1) * CELL, px * CELL:(px + 1) * CELL] = PLAYER
        return out


class G31e5fe32(RenderableUserDisplay):

    def __init__(self, game: "Ge05b1417") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        total = self._game.level_pulses
        left = self._game.pulses
        for i in range(total):
            x = 1 + i * 3
            if x + 2 > frame.shape[1]:
                break
            frame[1:3, x:x + 2] = PIP_ON if i < left else PIP_OFF
        return frame


class Ge05b1417(ARCBaseGame):

    def __init__(self) -> None:
        self.pulses = LEVELS_SPEC[0]["pulses"]
        self.level_pulses = LEVELS_SPEC[0]["pulses"]
        self.known: set[tuple[int, int]] = set()
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=UNKNOWN,
            interfaces=[Ge31d9375(self), G31e5fe32(self)],
        )
        super().__init__(game_id="t715ea045", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    def player_cell(self) -> tuple[int, int]:
        player = self.current_level.get_sprites_by_name("player")
        if not player:
            return 0, 0
        return player[0].x // CELL, player[0].y // CELL

    def exit_cell(self) -> tuple[int, int]:
        rows = LEVELS_SPEC[self.level_index]["rows"]
        for y, row in enumerate(rows):
            x = row.find("X")
            if x >= 0:
                return x, y
        raise AssertionError("level has no exit")

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.pulses = spec["pulses"]
        self.level_pulses = spec["pulses"]
        self.known = set()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _emit(self) -> None:
        if self.pulses <= 0:
            return
        self.pulses -= 1
        rows = LEVELS_SPEC[self.level_index]["rows"]
        self.known |= pulse_reveal(rows, *self.player_cell())
        if self.pulses == 0 and self.exit_cell() not in self.known:
            self.level_reset()

    def step(self) -> None:
        if self.action.id == GameAction.ACTION5:
            self._emit()
            self.complete_action()
            return

        dx = dy = 0
        if self.action.id == GameAction.ACTION1:
            dy = -1
        elif self.action.id == GameAction.ACTION2:
            dy = 1
        elif self.action.id == GameAction.ACTION3:
            dx = -1
        elif self.action.id == GameAction.ACTION4:
            dx = 1
        else:
            self.complete_action()
            return

        hits = self.try_move("player", dx * CELL, dy * CELL)
        if any("pit" in s.tags for s in hits):
            self.level_reset()
        elif any("exit" in s.tags for s in hits):
            self.next_level()
        self.complete_action()
