# ARC-AGI-3 candidate task t8dbff678.

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
DOOR = 6
DOOR_COST = 0
EXIT = 14
EXIT_COST = 5
PLAYER = 12
PIP_ON = 11
PIP_OFF = 3


LEVELS_SPEC = [
    {"charges": 4, "exit_cost": 3, "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..P.......X...#",
        "#..............#",
        "#..............#",
        "#####1##########",
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
    {"charges": 5, "exit_cost": 4, "rows": [
        "################",
        "#..............#",
        "#..P...........#",
        "#..............#",
        "#..####..####..#",
        "#..#..#..#..#..#",
        "#..#2#....#2#..#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.......X......#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"charges": 6, "exit_cost": 4, "rows": [
        "################",
        "#..............#",
        "#..P...........#",
        "#..............#",
        "#..####...####.#",
        "#..#..#...#..#.#",
        "#..#3#.....#1#.#",
        "#..............#",
        "######2#########",
        "#..............#",
        "#..............#",
        "#......X.......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"charges": 7, "exit_cost": 5, "rows": [
        "################",
        "#..P...........#",
        "#..............#",
        "#..###.####....#",
        "#..#.#.#..#....#",
        "#..#.#.#..#....#",
        "#..#1#.#2##....#",
        "#..............#",
        "####3#########.#",
        "#..............#",
        "#......X.......#",
        "#..............#",
        "########.#######",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"charges": 8, "exit_cost": 4, "rows": [
        "################",
        "#..P...........#",
        "#..............#",
        "#.###..........#",
        "#.#.#..........#",
        "#.#3#..........#",
        "#..............#",
        "#####2##########",
        "#..............#",
        "#..............#",
        "##########2#####",
        "#..............#",
        "#......X.......#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"charges": 9, "exit_cost": 5, "rows": [
        "################",
        "#..P...........#",
        "#..............#",
        "#..............#",
        "#2############5#",
        "#.############.#",
        "#.############.#",
        "#2############.#",
        "#.############.#",
        "#..............#",
        "#..............#",
        "#......X.......#",
        "#....#1#.......#",
        "#....#.#.......#",
        "#....###.......#",
        "################",
    ]},
    {"charges": 6, "exit_cost": 6, "rows": [
        "################",
        "#..P...........#",
        "#..............#",
        "#.#1#....#2#...#",
        "#.#.#....#.#...#",
        "#.###....###...#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#......X.......#",
        "#..............#",
        "#....#3#.......#",
        "#....#.#.......#",
        "#....###.......#",
        "#..............#",
        "################",
    ]},
    {"charges": 9, "exit_cost": 4, "rows": [
        "################",
        "#..P...........#",
        "#..............#",
        "#.#1#..........#",
        "#.#.#..........#",
        "#.###..........#",
        "######3#########",
        "#..............#",
        "#....#2#.......#",
        "#....#.#.......#",
        "#....###.......#",
        "###########2####",
        "#..............#",
        "#.....X........#",
        "#..............#",
        "################",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 4


def _door_cost_pixels(cost: int) -> list[list[int]]:
    block = [[DOOR for _ in range(CELL)] for _ in range(CELL)]
    for i in range(min(cost, 9)):
        block[1 + i // 3][1 + i % 3] = DOOR_COST
    return block


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
                elif char.isdigit():
                    sprites.append(Sprite(
                        pixels=_door_cost_pixels(int(char)), name=f"door_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0,
                        tags=["door", f"cost_{char}"],
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


class G3f7bc36d(RenderableUserDisplay):

    def __init__(self, game: "G6d6a125b") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        total = self._game.level_charges
        left = self._game.charges
        for i in range(total):
            x = 1 + i * 3
            if x + 2 > frame.shape[1]:
                break
            frame[1:3, x:x + 2] = PIP_ON if i < left else PIP_OFF
        return frame


class G6d6a125b(ARCBaseGame):

    def __init__(self) -> None:
        self.charges = LEVELS_SPEC[0]["charges"]
        self.level_charges = LEVELS_SPEC[0]["charges"]
        self._facing = (0, 1)
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G3f7bc36d(self)],
        )
        super().__init__(game_id="t8dbff678", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.charges = spec["charges"]
        self.level_charges = spec["charges"]
        self._facing = (0, 1)

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _facing_sprite(self) -> Sprite | None:
        player = self.current_level.get_sprites_by_name("player")
        if not player:
            return None
        px, py = player[0].x, player[0].y
        dx, dy = self._facing
        return self.current_level.get_sprite_at(px + dx * CELL, py + dy * CELL)

    def _spend(self, sprite: Sprite) -> bool:
        cost = next((int(t.split("_")[1]) for t in sprite.tags if t.startswith("cost_")), None)
        if cost is None or self.charges < cost:
            return False
        self.charges -= cost
        self.current_level.remove_sprite(sprite)
        return True

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
        elif self.action.id == GameAction.ACTION5:
            target = self._facing_sprite()
            if target is not None:
                if "exit" in target.tags:
                    if self.charges >= LEVELS_SPEC[self.level_index]["exit_cost"]:
                        self.charges -= LEVELS_SPEC[self.level_index]["exit_cost"]
                        if self.is_last_level():
                            self.next_level()
                        else:
                            self.next_level()
                elif "door" in target.tags:
                    self._spend(target)
            self.complete_action()
            return

        if dx or dy:
            self._facing = (dx, dy)
            self.try_move("player", dx * CELL, dy * CELL)

        self.complete_action()
