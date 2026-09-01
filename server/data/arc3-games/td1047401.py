# ARC-AGI-3 candidate task td1047401.

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
SOCKET_BG = 3
SOCKET_GLYPH = 9
STAMPED = 14
MIRROR_A = 15
MIRROR_B = 10
EXIT_LOCKED = 13
EXIT_OPEN = 11
PLAYER = 12
PIP_ON = 11
PIP_OFF = 3
BLANK = -1

N = 16
CELL = 4

BASE_R = frozenset({(0, 0), (1, 0), (2, 0), (0, 1)})


def mirror_shape(shape: frozenset) -> frozenset:
    return frozenset((2 - c, r) for c, r in shape)


def rotate_shape(shape: frozenset) -> frozenset:
    return frozenset((2 - r, c) for c, r in shape)


def key_shape(hand: int, rot: int) -> frozenset:
    shape = BASE_R if hand == 0 else mirror_shape(BASE_R)
    for _ in range(rot % 4):
        shape = rotate_shape(shape)
    return shape


def _glyph_block(hand: int, rot: int, fg: int, bg: int) -> list[list[int]]:
    block = [[bg for _ in range(CELL)] for _ in range(CELL)]
    for c, r in key_shape(hand, rot):
        block[r][c] = fg
    return block


def _solid(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _mirror_block() -> list[list[int]]:
    return [[MIRROR_A if c < 2 else MIRROR_B for c in range(CELL)] for _ in range(CELL)]


def _exit_block(open_: bool) -> list[list[int]]:
    if open_:
        return _solid(EXIT_OPEN)
    block = _solid(FLOOR)
    for i in range(CELL):
        block[0][i] = EXIT_LOCKED
        block[CELL - 1][i] = EXIT_LOCKED
        block[i][0] = EXIT_LOCKED
        block[i][CELL - 1] = EXIT_LOCKED
    return block


LEVELS_SPEC = [
    {"rows": [
        "################",
        "#..............#",
        "#..............#",
        "#....s.........#",
        "#..............#",
        "#..............#",
        "#.........2....#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#......g.......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..............#",
        "#..s...........#",
        "#..............#",
        "#....######....#",
        "#....#....#....#",
        "#....#..1.#....#",
        "#....#....#....#",
        "#....##.###....#",
        "#..........3...#",
        "#..............#",
        "#......g.......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..............#",
        "#..s...........#",
        "#..............#",
        "#....2.........#",
        "#..............#",
        "#######M########",
        "#..............#",
        "#..............#",
        "#.........6....#",
        "#..............#",
        "#..............#",
        "#......g.......#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..s...........#",
        "#..............#",
        "#....6.........#",
        "#..............#",
        "#..............#",
        "####M######M####",
        "#..............#",
        "#....1.........#",
        "#..............#",
        "#.........5....#",
        "#..............#",
        "#......g.......#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..s...........#",
        "#..............#",
        "#..............#",
        "#..#########...#",
        "#..#.......#...#",
        "#..#..3....#...#",
        "#..#.......#...#",
        "#..###M#####...#",
        "#..............#",
        "#....7.........#",
        "#..............#",
        "#.........1....#",
        "#......g.......#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..s...........#",
        "#....2.........#",
        "#..............#",
        "######M#########",
        "#..............#",
        "##############.#",
        "#..............#",
        "#.##############",
        "#....7.........#",
        "#..............#",
        "#..........g...#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..s...........#",
        "#..............#",
        "#....5.........#",
        "#..............#",
        "####M#####M#####",
        "#..............#",
        "#..#########...#",
        "#..#.......#...#",
        "#..#..0....#...#",
        "#..#.......#...#",
        "#..#####M###...#",
        "#..............#",
        "#....6....g....#",
        "#..............#",
        "################",
    ]},
]

SOCKET_CHARS = "01234567"


def socket_demand(char: str) -> tuple[int, int]:
    v = int(char)
    return (0, v) if v < 4 else (1, v - 4)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        sprites: list[Sprite] = []
        for y, row in enumerate(spec["rows"]):
            for x, char in enumerate(row):
                px, py = x * CELL, y * CELL
                common = dict(
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE,
                )
                if char == "#":
                    sprites.append(Sprite(
                        pixels=_solid(WALL), name=f"wall_{x}_{y}", layer=-1, **common,
                    ).set_position(px, py))
                elif char in SOCKET_CHARS:
                    hand, rot = socket_demand(char)
                    sprites.append(Sprite(
                        pixels=_glyph_block(hand, rot, SOCKET_GLYPH, SOCKET_BG),
                        name=f"socket_{x}_{y}", layer=0, tags=["socket"], **common,
                    ).set_position(px, py))
                elif char == "M":
                    sprites.append(Sprite(
                        pixels=_mirror_block(), name=f"mirror_{x}_{y}", layer=0,
                        tags=["mirror"], **common,
                    ).set_position(px, py))
                elif char == "g":
                    sprites.append(Sprite(
                        pixels=_exit_block(False), name="exit", layer=0, tags=["exit"],
                        **common,
                    ).set_position(px, py))
                elif char == "s":
                    sprites.append(Sprite(
                        pixels=_glyph_block(0, 0, PLAYER, BLANK), name="player", layer=1,
                        **common,
                    ).set_position(px, py))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G15ccd58d(RenderableUserDisplay):

    def __init__(self, game: "G1da7cbe5") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        flipped = self._game.hand == 1
        frame[1:3, 1:3] = PIP_OFF if flipped else PIP_ON
        frame[1:3, 4:6] = PIP_ON if flipped else PIP_OFF
        return frame


class G1da7cbe5(ARCBaseGame):

    def __init__(self) -> None:
        self.hand = 0
        self.rot = 0
        self._grid: list[list[str]] = []
        self._pos = (0, 0)
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G15ccd58d(self)],
        )
        super().__init__(game_id="td1047401", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        rows = LEVELS_SPEC[self.level_index]["rows"]
        self._grid = [list(r) for r in rows]
        self.hand = 0
        self.rot = 0
        for y, row in enumerate(rows):
            for x, char in enumerate(row):
                if char == "s":
                    self._pos = (x, y)
                    self._grid[y][x] = "."
        self._redraw_player()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _redraw_player(self) -> None:
        found = self.current_level.get_sprites_by_name("player")
        if not found:
            return
        sprite = found[0]
        sprite.pixels = np.array(
            _glyph_block(self.hand, self.rot, PLAYER, BLANK), dtype=np.int8)
        sprite.set_position(self._pos[0] * CELL, self._pos[1] * CELL)

    def _open_exit_if_clear(self) -> None:
        if self.sockets_left() > 0:
            return
        found = self.current_level.get_sprites_by_name("exit")
        if found:
            found[0].pixels = np.array(_exit_block(True), dtype=np.int8)

    def sockets_left(self) -> int:
        return sum(1 for row in self._grid for c in row if c in SOCKET_CHARS)

    def _try_step(self, dx: int, dy: int) -> None:
        x, y = self._pos
        nx, ny = x + dx, y + dy
        if not (0 <= nx < N and 0 <= ny < N):
            return
        char = self._grid[ny][nx]
        if char in ("#", "S"):
            return
        if char in SOCKET_CHARS:
            if socket_demand(char) == (self.hand, self.rot):
                self._grid[ny][nx] = "S"
                found = self.current_level.get_sprites_by_name(f"socket_{nx}_{ny}")
                if found:
                    found[0].pixels = np.array(_solid(STAMPED), dtype=np.int8)
                self._open_exit_if_clear()
            return
        if char == "g":
            if self.sockets_left() == 0:
                self.next_level()
            return
        self._pos = (nx, ny)
        if char == "M":
            self.hand ^= 1
        self._redraw_player()

    def step(self) -> None:
        action = self.action.id
        if action == GameAction.ACTION5:
            self.rot = (self.rot + 1) % 4
            self._redraw_player()
            self.complete_action()
            return

        dx = dy = 0
        if action == GameAction.ACTION1:
            dy = -1
        elif action == GameAction.ACTION2:
            dy = 1
        elif action == GameAction.ACTION3:
            dx = -1
        elif action == GameAction.ACTION4:
            dx = 1

        if dx or dy:
            if self.hand == 1:
                dx = -dx
            self._try_step(dx, dy)

        self.complete_action()
