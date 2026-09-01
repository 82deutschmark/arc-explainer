# ARC-AGI-3 candidate task tb4f43900.

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
WALL = 2
DARK = 5
ASH = 13
STONE = 1
EXIT = 14
PLAYER = 12

LEVELS_SPEC = [
    {"rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "#####P......####",
        "###########.####",
        "###########.####",
        "#######X....####",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "################",
        "################",
        "######.#.#######",
        "###P..S.S.######",
        "########.#######",
        "########.#######",
        "########X#######",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "#####.#.#.######",
        "###P.S.S.S.#####",
        "#########.######",
        "#########.######",
        "####XS.S.S.#####",
        "#####.#.#.######",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "################",
        "###..........###",
        "###.########.###",
        "###.#X.....#.###",
        "###.######.#.###",
        "###.######.#.###",
        "###.######.#S.##",
        "###.######.#.###",
        "###........#.###",
        "############.###",
        "###....P.....###",
        "################",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "################",
        "###..........###",
        "###.########.###",
        "###.########.###",
        "###.#X######.###",
        "###.#.##.###.###",
        "##.S#.##.###.###",
        "###.#.##.###.###",
        "###.#........###",
        "###.############",
        "###......PS..###",
        "##########.#####",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "##............##",
        "##.######.###.##",
        "##.######.###.##",
        "##.######.###.##",
        "##X######.###.##",
        "#############.##",
        "#############.##",
        "#############.##",
        "#############.##",
        "#############.##",
        "######.######.##",
        "##..P.S.......##",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "##............##",
        "##.##########.##",
        "##.#........#.##",
        "##.#.##.###.#.##",
        "##.#.##.#X#.#.##",
        "##.#.##.#.#.#S.#",
        "##.#.####.#.#.##",
        "##.#......#.#.##",
        "##.########.#.##",
        "##..........#.##",
        "#############.##",
        "##....P.......##",
        "################",
        "################",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 4
DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))


def find_char(rows, char):
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == char:
                return x, y
    raise AssertionError(f"level has no {char!r}")


def stone_cells(rows):
    return {(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "S"}


def open_cells(rows):
    return {(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c != "#"}


def _block(colour, w=1, h=1):
    return [[colour] * (w * CELL) for _ in range(h * CELL)]


def _wall_runs(rows):
    runs = []
    for y, row in enumerate(rows):
        x = 0
        while x < len(row):
            if row[x] == "#":
                x0 = x
                while x < len(row) and row[x] == "#":
                    x += 1
                runs.append((x0, y, x - x0))
            else:
                x += 1
    return runs


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for x0, y, length in _wall_runs(rows):
            sprites.append(Sprite(
                pixels=_block(WALL, w=length), name=f"wall_{x0}_{y}",
                blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.TANGIBLE, layer=-1,
            ).set_position(x0 * CELL, y * CELL))
        for x, y in sorted(stone_cells(rows)):
            sprites.append(Sprite(
                pixels=_block(STONE), name=f"stone_{x}_{y}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0,
                tags=["stone"], collidable=False,
            ).set_position(x * CELL, y * CELL))
        ex, ey = find_char(rows, "X")
        sprites.append(Sprite(
            pixels=_block(EXIT), name="exit",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=0,
            tags=["exit"], collidable=False,
        ).set_position(ex * CELL, ey * CELL))
        px, py = find_char(rows, "P")
        sprites.append(Sprite(
            pixels=_block(PLAYER), name="player",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(px * CELL, py * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G09b0414f(RenderableUserDisplay):

    def __init__(self, game: "G7d033fb2") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        out = np.full_like(frame, DARK)
        for x, y in self._game.revealed:
            out[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = \
                frame[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL]
        return out


class G7d033fb2(ARCBaseGame):

    def __init__(self) -> None:
        self.ash: set[tuple[int, int]] = set()
        self.revealed: set[tuple[int, int]] = set()
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=DARK,
            interfaces=[G09b0414f(self)],
        )
        super().__init__(game_id="tb4f43900", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])
        self.on_set_level(self.current_level)

    @property
    def rows(self) -> list[str]:
        return LEVELS_SPEC[self.level_index]["rows"]

    def player_cell(self) -> tuple[int, int]:
        player = self.current_level.get_sprites_by_name("player")
        if not player:
            return 0, 0
        return player[0].x // CELL, player[0].y // CELL

    def on_set_level(self, level: Level) -> None:
        self.ash = set()
        self.revealed = set()
        self._reveal(*find_char(self.rows, "P"))

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _reveal(self, x: int, y: int) -> None:
        for dx, dy in ((0, 0), *DIRS):
            nx, ny = x + dx, y + dy
            if 0 <= nx < N and 0 <= ny < N:
                self.revealed.add((nx, ny))

    def passable(self, x: int, y: int) -> bool:
        if not (0 <= x < N and 0 <= y < N):
            return False
        return self.rows[y][x] != "#" and (x, y) not in self.ash

    def _burn(self, x: int, y: int) -> None:
        if self.rows[y][x] == "S":
            return
        self.ash.add((x, y))
        self.current_level.add_sprite(Sprite(
            pixels=_block(ASH), name=f"ash_{x}_{y}",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=0, tags=["ash"],
        ).set_position(x * CELL, y * CELL))

    def _stuck(self) -> bool:
        x, y = self.player_cell()
        return not any(self.passable(x + dx, y + dy) for dx, dy in DIRS)

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
            before = self.player_cell()
            self.try_move("player", dx * CELL, dy * CELL)
            after = self.player_cell()
            if after != before:
                self._burn(*before)
                self._reveal(*after)
                if after == find_char(self.rows, "X"):
                    self.next_level()
                elif self._stuck():
                    self.level_reset()

        self.complete_action()
