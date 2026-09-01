# ARC-AGI-3 candidate task t2774d7a8.

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
HOT = 8
COLD = 9
NEUTRAL = 0
ORIGIN = 11

DELTAS = {
    ".": 0, "P": 0,
    "1": 1, "2": 2, "3": 3,
    "c": -1, "b": -2, "a": -3,
}
LIMIT = 12

LEVELS_SPEC = [
    {"target": 4, "rows": [
        "################",
        "#..............#",
        "#..PX..........#",
        "#..............#",
        "#....2.........#",
        "#..............#",
        "#..........2...#",
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
    {"target": 7, "rows": [
        "################",
        "#..............#",
        "#..PX..........#",
        "#..............#",
        "#......3.......#",
        "#..............#",
        "#..........2...#",
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
    {"target": 2, "rows": [
        "################",
        "#..P...........#",
        "#..............#",
        "#..........2...#",
        "#..............#",
        "#..........2...#",
        "#..............#",
        "#..........1...#",
        "#....######....#",
        "#....#....#....#",
        "#....a....#....#",
        "#....#.X..#....#",
        "#....#....#....#",
        "#....######....#",
        "#..............#",
        "################",
    ]},
    {"target": 6, "rows": [
        "################",
        "#..PX..........#",
        "#..............#",
        "#..333333333...#",
        "#..333333333...#",
        "#..333333333...#",
        "#..............#",
        "#..............#",
        "#....cccccc....#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"target": 1, "rows": [
        "################",
        "#..P...........#",
        "#..............#",
        "#.a............#",
        "#..............#",
        "#.a............#",
        "#..............#",
        "#.b............#",
        "#..............#",
        "#....###########",
        "#....333X#######",
        "#....###########",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"target": -5, "rows": [
        "################",
        "#..PX..........#",
        "#..............#",
        "#....b.........#",
        "#..............#",
        "#.........a....#",
        "#..............#",
        "#..............#",
        "#......2.......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"target": -2, "rows": [
        "################",
        "#..P...........#",
        "#..............#",
        "#.1............#",
        "#..............#",
        "#.1...........3#",
        "#..............#",
        "#.2............#",
        "#..............#",
        "#....###########",
        "#....aaX########",
        "#....###########",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"target": 8, "rows": [
        "################",
        "#..P...........#",
        "#........33333.#",
        "#........33333.#",
        "#........33333.#",
        "#..............#",
        "#.aaa..........#",
        "#..............#",
        "#....###########",
        "#....b3bX#######",
        "#....###########",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 4


def sum_colour(value: int) -> int:
    if value > 0:
        return HOT
    if value < 0:
        return COLD
    return NEUTRAL


def _solid(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _ring(colour: int) -> list[list[int]]:
    block = [[colour] * CELL for _ in range(CELL)]
    for y in range(1, CELL - 1):
        for x in range(1, CELL - 1):
            block[y][x] = FLOOR
    return block


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, glyph in enumerate(row):
                px, py = x * CELL, y * CELL
                if glyph == "#":
                    sprites.append(Sprite(
                        pixels=_solid(WALL), name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif glyph == "X":
                    sprites.append(Sprite(
                        pixels=_ring(sum_colour(spec["target"])), name="door",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0, tags=["door"],
                    ).set_position(px, py))
                elif glyph == "P":
                    sprites.append(Sprite(
                        pixels=_solid(NEUTRAL), name="player",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=1,
                    ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G29ca77d9(RenderableUserDisplay):

    def __init__(self, game: "G52163734") -> None:
        super().__init__()
        self._game = game

    def _row(self, frame: np.ndarray, top: int, value: int) -> None:
        colour = sum_colour(value)
        for i in range(min(abs(value), LIMIT)):
            x = 33 + 2 * i if value > 0 else 31 - 2 * i
            if 0 <= x < frame.shape[1]:
                frame[top:top + 2, x:x + 1] = colour

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        frame[0:4, 32:33] = ORIGIN
        self._row(frame, 0, self._game.heat)
        self._row(frame, 2, LEVELS_SPEC[self._game.level_index]["target"])
        return frame


class G52163734(ARCBaseGame):

    def __init__(self) -> None:
        self.heat = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G29ca77d9(self)],
        )
        super().__init__(game_id="t2774d7a8", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        self.heat = 0
        self._repaint()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _repaint(self) -> None:
        player = self.current_level.get_sprites_by_name("player")
        if player:
            player[0].pixels[:, :] = sum_colour(self.heat)

    def step(self) -> None:
        dx = dy = 0
        if self.action.id == GameAction.ACTION1:
            dy = -1
        elif self.action.id == GameAction.ACTION2:
            dy = 1
        elif self.action.id == GameAction.ACTION3:
            dx = -1
        elif self.action.id == GameAction.ACTION4:
            dx = 1

        if dx or dy:
            player = self.current_level.get_sprites_by_name("player")
            if player:
                self._enter(player[0], dx, dy)

        self.complete_action()

    def _enter(self, player: Sprite, dx: int, dy: int) -> None:
        rows = LEVELS_SPEC[self.level_index]["rows"]
        target = LEVELS_SPEC[self.level_index]["target"]
        cx = player.x // CELL + dx
        cy = player.y // CELL + dy
        if not (0 <= cx < N and 0 <= cy < N):
            return
        glyph = rows[cy][cx]

        if glyph == "#":
            return
        if glyph == "X":
            if self.heat == target:
                self.next_level()
            return

        player.set_position(cx * CELL, cy * CELL)
        self.heat += DELTAS[glyph]
        if abs(self.heat) > LIMIT:
            self.level_reset()
        else:
            self._repaint()
