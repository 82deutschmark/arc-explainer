# ARC-AGI-3 candidate task t643da6ee.

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
COIN = 11
FUSE_BG = 5
FUSE_PIP = 8
SEALED = 13
EXIT_LOCKED = 15
EXIT_OPEN = 14
PLAYER = 12
PIP_ON = 11
PIP_OFF = 3

N = 16
CELL = 4

MAX_FUSE = 12

LEVELS_SPEC = [
    {"fuse": 10, "greedy_dies": False, "rows": [
        "################",
        "#......#.......#",
        "#.P....#.......#",
        "#......#.......#",
        "#......#.......#",
        "#......#.......#",
        "#......#.......#",
        "#......c.......#",
        "#......#.......#",
        "#......#.......#",
        "#......#...X...#",
        "#......#.......#",
        "#......#.......#",
        "#......#.......#",
        "#......#.......#",
        "################",
    ]},
    {"fuse": 8, "greedy_dies": True, "rows": [
        "################",
        "#c......#......#",
        "#.......#......#",
        "#.......#..X...#",
        "#.......#......#",
        "#.......#......#",
        "#.......#......#",
        "#.......#......#",
        "#.......c......#",
        "#.......#......#",
        "#.......#......#",
        "#.......#......#",
        "#.......#......#",
        "#.....P.#......#",
        "#.......#.....c#",
        "################",
    ]},
    {"fuse": 8, "greedy_dies": True, "rows": [
        "################",
        "#....#....#....#",
        "#....#....#..X.#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#.c..c....c....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#..P.#....#",
        "#....#....#....#",
        "################",
    ]},
    {"fuse": 8, "greedy_dies": True, "rows": [
        "################",
        "#....#....#....#",
        "#....#....#....#",
        "#.c..c....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#...P#....#",
        "#....##c#.c..X.#",
        "#....#...#.....#",
        "#....#.c.#.....#",
        "################",
    ]},
    {"fuse": 7, "greedy_dies": True, "rows": [
        "################",
        "#....#....#....#",
        "#....#....#....#",
        "#.c..c....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "######..P.c..X.#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#.c..c....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "################",
    ]},
    {"fuse": 6, "greedy_dies": True, "rows": [
        "################",
        "#....#....#....#",
        "#....#....#....#",
        "#..c.c....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "######....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#....#....#....#",
        "#..c.c...Pc....#",
        "#....#....#....#",
        "#....#....#..X.#",
        "#....#....#....#",
        "################",
    ]},
    {"fuse": 6, "greedy_dies": False, "rows": [
        "################",
        "################",
        "##.....P......##",
        "##.##.#######.##",
        "##.##.#######.##",
        "##c##c#######.##",
        "##.##########.##",
        "##.##########.##",
        "##...X#######c##",
        "##.##########.##",
        "##.#######c##.##",
        "##.#######.##.##",
        "##.#######.##.##",
        "##............##",
        "################",
        "################",
    ]},
    {"fuse": 6, "greedy_dies": True, "rows": [
        "################",
        "################",
        "##............##",
        "##P##.#######.##",
        "##.##.#######.##",
        "##c##c#######.##",
        "##.##########.##",
        "##.##########.##",
        "##.c.X#######c##",
        "##.##########.##",
        "##.#######c##.##",
        "##.#######.##.##",
        "##.#######.##.##",
        "##............##",
        "################",
        "################",
    ]},
]


def find_char(rows, ch):
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == ch:
                return x, y
    raise AssertionError(f"level has no {ch!r}")


def coin_cells(rows):
    return [(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "c"]


def _solid(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _coin_pixels() -> list[list[int]]:
    return [
        [FLOOR, COIN, COIN, FLOOR],
        [COIN, COIN, COIN, COIN],
        [COIN, COIN, COIN, COIN],
        [FLOOR, COIN, COIN, FLOOR],
    ]


def _fuse_pixels(remaining: int) -> list[list[int]]:
    px = [[FUSE_BG] * CELL for _ in range(CELL)]
    for i in range(min(remaining, CELL * CELL)):
        px[i // CELL][i % CELL] = FUSE_PIP
    return px


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                px, py = x * CELL, y * CELL
                if char == "#":
                    sprites.append(Sprite(
                        pixels=_solid(WALL), name=f"wall_{x}_{y}",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=-1,
                    ).set_position(px, py))
                elif char == "c":
                    sprites.append(Sprite(
                        pixels=_coin_pixels(), name=f"coin_{x}_{y}",
                        blocking=BlockingMode.NOT_BLOCKED,
                        interaction=InteractionMode.TANGIBLE, layer=0,
                        tags=["coin"],
                    ).set_position(px, py))
                elif char == "X":
                    sprites.append(Sprite(
                        pixels=_solid(EXIT_LOCKED), name="exit",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=0, tags=["exit"],
                    ).set_position(px, py))
                elif char == "P":
                    sprites.append(Sprite(
                        pixels=_solid(PLAYER), name="player",
                        blocking=BlockingMode.BOUNDING_BOX,
                        interaction=InteractionMode.TANGIBLE, layer=1,
                    ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G49fbd3f6(RenderableUserDisplay):

    def __init__(self, game: "G8d6b057c") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        cells = self._game.coin_order
        for i, cell in enumerate(cells):
            x = 1 + i * 3
            if x + 2 > frame.shape[1]:
                break
            lit = self._game.status.get(cell, 0) == -1
            frame[1:3, x:x + 2] = PIP_ON if lit else PIP_OFF
        return frame


class G8d6b057c(ARCBaseGame):

    def __init__(self) -> None:
        self.status: dict[tuple[int, int], int] = {}
        self.coin_order: list[tuple[int, int]] = []
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G49fbd3f6(self)],
        )
        super().__init__(game_id="t643da6ee", levels=build_levels(), camera=camera)
        self.on_set_level(self.current_level)

    def on_set_level(self, level: Level) -> None:
        rows = LEVELS_SPEC[self.level_index]["rows"]
        self.coin_order = coin_cells(rows)
        self.status = {cell: -1 for cell in self.coin_order}
        self._sync_sprites()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _sprite(self, name: str) -> Sprite | None:
        found = self.current_level.get_sprites_by_name(name)
        return found[0] if found else None

    def _paint(self, sprite: Sprite, pixels: list[list[int]]) -> None:
        sprite.pixels[:, :] = np.array(pixels, dtype=np.int8)

    def _sync_sprites(self) -> None:
        for cell, st in self.status.items():
            sprite = self._sprite(f"coin_{cell[0]}_{cell[1]}")
            if sprite is None:
                continue
            if st == -1:
                self._paint(sprite, _coin_pixels())
                sprite.set_blocking(BlockingMode.NOT_BLOCKED)
            elif st > 0:
                self._paint(sprite, _fuse_pixels(st))
                sprite.set_blocking(BlockingMode.NOT_BLOCKED)
            else:
                self._paint(sprite, _solid(SEALED))
                sprite.set_blocking(BlockingMode.BOUNDING_BOX)
        exit_sprite = self._sprite("exit")
        if exit_sprite is not None:
            if self.all_collected():
                self._paint(exit_sprite, _solid(EXIT_OPEN))
                exit_sprite.set_blocking(BlockingMode.NOT_BLOCKED)
            else:
                self._paint(exit_sprite, _solid(EXIT_LOCKED))
                exit_sprite.set_blocking(BlockingMode.BOUNDING_BOX)

    def all_collected(self) -> bool:
        return all(st != -1 for st in self.status.values())

    def player_cell(self) -> tuple[int, int]:
        player = self._sprite("player")
        if player is None:
            return -1, -1
        return player.x // CELL, player.y // CELL

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
            self.try_move("player", dx * CELL, dy * CELL)

        cell = self.player_cell()
        fuse = LEVELS_SPEC[self.level_index]["fuse"]

        if self.status.get(cell, 0) == -1:
            self.status[cell] = min(fuse, MAX_FUSE) + 1

        for burning, st in list(self.status.items()):
            if st > 0:
                self.status[burning] = st - 1

        if self.status.get(cell, -1) == 0:
            self._sync_sprites()
            self.level_reset()
            self.complete_action()
            return

        self._sync_sprites()

        exit_sprite = self._sprite("exit")
        if exit_sprite is not None and self.all_collected():
            if (exit_sprite.x // CELL, exit_sprite.y // CELL) == cell:
                self.next_level()

        self.complete_action()
