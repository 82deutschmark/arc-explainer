# ARC-AGI-3 candidate task g031.

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
from sprite_book import door, fixture, rounded, speckle

FLOOR = 12
WALL = 5
MORTAR = 4
SOCKET_BG = 4
SOCKET_GLYPH = 10
STAMPED = 14
FLASH = 10
MIRROR_A = 10
MIRROR_B = 2
EXIT_FRAME_SHUT = 2
EXIT_BAR = 4
EXIT_FRAME_OPEN = 14
PLAYER = 14
PLAYER_BEAD = 5
PLAYER_TURNING = 5
PIP_ON = 10
PIP_OFF = 2
DECOR_FLECK = 2
DECOR_CYCLE = (10, 2, 4)
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


def _player_block(hand: int, rot: int, fg: int = PLAYER) -> list[list[int]]:
    block = [[BLANK for _ in range(CELL)] for _ in range(CELL)]
    for c, r in key_shape(hand, rot):
        block[r][c] = fg
    block[CELL - 1][CELL - 1] = PLAYER_BEAD
    return block


def _socket_block(hand: int, rot: int, plate: int, mark: int) -> list[list[int]]:
    block = rounded(plate, CELL)
    for c, r in key_shape(hand, rot):
        block[r][c] = mark
    return block


def _wall_block(y: int) -> list[list[int]]:
    block = [[WALL] * CELL for _ in range(CELL)]
    block[0] = [MORTAR] * CELL
    joint = 1 if y % 2 else 3
    for r in range(1, CELL):
        block[r][joint] = MORTAR
    return block


def _mirror_block() -> list[list[int]]:
    a, b, n = MIRROR_A, MIRROR_B, BLANK
    return [
        [a, n, n, b],
        [a, a, b, b],
        [a, a, b, b],
        [a, n, n, b],
    ]


def _exit_block(open_: bool) -> list[list[int]]:
    if open_:
        return door(EXIT_FRAME_OPEN, None, CELL)
    return door(EXIT_FRAME_SHUT, EXIT_BAR, CELL)


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
        "#..#..7....#...#",
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


def _quiet_floor(rows: list[str]) -> list[tuple[int, int]]:
    live = set("#Mg" + SOCKET_CHARS)
    out = []
    for y in range(1, N - 1):
        for x in range(1, N - 1):
            if rows[y][x] != ".":
                continue
            if any(rows[y + dy][x + dx] in live
                   for dy in (-1, 0, 1) for dx in (-1, 0, 1)):
                continue
            out.append((x, y))
    return out


def _pick(cells: list[tuple[int, int]], modulus: int, residue: int,
          limit: int) -> list[tuple[int, int]]:
    chosen = [(x, y) for x, y in cells if (x * 7 + y * 5) % modulus == residue]
    return chosen[:limit]


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        common = dict(
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE,
        )
        for y, row in enumerate(rows):
            for x, char in enumerate(row):
                px, py = x * CELL, y * CELL
                if char == "#":
                    sprites.append(Sprite(
                        pixels=_wall_block(y), name=f"wall_{x}_{y}", layer=-1, **common,
                    ).set_position(px, py))
                elif char in SOCKET_CHARS:
                    hand, rot = socket_demand(char)
                    sprites.append(Sprite(
                        pixels=_socket_block(hand, rot, SOCKET_BG, SOCKET_GLYPH),
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
                        pixels=_player_block(0, 0), name="player", layer=1, **common,
                    ).set_position(px, py))

        quiet = _quiet_floor(rows)
        for x, y in _pick(quiet, 11, 3, 5):
            sprites.append(Sprite(
                pixels=speckle(DECOR_FLECK, x + y, CELL), name=f"grit_{x}_{y}",
                layer=-1, tags=["decor"], **common,
            ).set_position(x * CELL, y * CELL))
        for x, y in _pick(quiet, 13, 5, 3):
            sprites.append(Sprite(
                pixels=fixture(DECOR_CYCLE, 0, x + y, CELL), name=f"fitting_{x}_{y}",
                layer=0, tags=["decor", "cycling"], **common,
            ).set_position(x * CELL, y * CELL))

        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G031A(RenderableUserDisplay):

    X0, X1 = 1, 4
    TOP, ROWS = 24, 16

    def __init__(self, game: "G031") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        span = self.X1 - self.X0
        frame[self.TOP - 1:self.TOP + self.ROWS + 1, self.X0:self.X1] = WALL
        flipped = self._game.hand == 1
        for i in range(self.ROWS):
            step = (self.ROWS - 1 - i) if flipped else i
            lit = 1 + (step * span) // self.ROWS
            y = self.TOP + i
            frame[y, self.X0:self.X0 + lit] = PIP_ON
            frame[y, self.X0 + lit:self.X1] = PIP_OFF
        return frame


class G031(ARCBaseGame):

    STAMP_FRAMES = 4
    FLIP_FRAMES = 4
    CLEAR_FRAMES = 4

    def __init__(self) -> None:
        self.hand = 0
        self.rot = 0
        self._grid: list[list[str]] = []
        self._pos = (0, 0)
        self._tick = 0
        self._anim = 0
        self._anim_kind = ""
        self._stamped: tuple[int, int, int, int] | None = None
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G031A(self)],
        )
        super().__init__(game_id="g031", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        rows = LEVELS_SPEC[self.level_index]["rows"]
        self._grid = [list(r) for r in rows]
        self.hand = 0
        self.rot = 0
        self._tick = 0
        self._anim = 0
        self._anim_kind = ""
        self._stamped = None
        for y, row in enumerate(rows):
            for x, char in enumerate(row):
                if char == "s":
                    self._pos = (x, y)
                    self._grid[y][x] = "."
        self._redraw_player()
        self._redraw_decor()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _redraw_player(self, hand: int | None = None, colour: int = PLAYER) -> None:
        found = self.current_level.get_sprites_by_name("player")
        if not found:
            return
        sprite = found[0]
        shown = self.hand if hand is None else hand
        sprite.pixels = np.array(
            _player_block(shown, self.rot, colour), dtype=np.int8)
        sprite.set_position(self._pos[0] * CELL, self._pos[1] * CELL)

    def _redraw_decor(self) -> None:
        for sprite in self.current_level.get_sprites_by_tag("cycling"):
            seed = sprite.x // CELL + sprite.y // CELL
            sprite.pixels = np.array(
                fixture(DECOR_CYCLE, self._tick // 2, seed, CELL), dtype=np.int8)

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
                self._stamped = (nx, ny, self.hand, self.rot)
                self._paint_socket(*self._stamped, taking=False)
                self._open_exit_if_clear()
                self._begin("stamp", self.STAMP_FRAMES)
            return
        if char == "g":
            if self.sockets_left() == 0:
                self._begin("clear", self.CLEAR_FRAMES)
            return
        self._pos = (nx, ny)
        if char == "M":
            self.hand ^= 1
            self._redraw_player()
            self._begin("flip", self.FLIP_FRAMES)
            return
        self._redraw_player()

    def _begin(self, kind: str, frames: int) -> None:
        self._anim_kind = kind
        self._anim = frames

    def _play(self) -> None:
        lit = self._anim % 2 == 1
        if self._anim_kind == "stamp" and self._stamped:
            self._paint_socket(*self._stamped, taking=lit)
        elif self._anim_kind == "flip":
            self._redraw_player(hand=self.hand ^ int(lit),
                                colour=PLAYER_TURNING if lit else PLAYER)
        elif self._anim_kind == "clear":
            found = self.current_level.get_sprites_by_name("exit")
            if found:
                found[0].pixels = np.array(
                    door(FLASH if lit else EXIT_FRAME_OPEN, None, CELL), dtype=np.int8)

    def _settle(self) -> None:
        kind, self._anim_kind = self._anim_kind, ""
        if kind == "stamp" and self._stamped:
            self._paint_socket(*self._stamped, taking=False)
            self._stamped = None
        elif kind == "flip":
            self._redraw_player()
        elif kind == "clear" and self.sockets_left() == 0:
            self.next_level()

    def _paint_socket(self, x: int, y: int, hand: int, rot: int, taking: bool) -> None:
        found = self.current_level.get_sprites_by_name(f"socket_{x}_{y}")
        if found:
            plate, mark = (FLASH, STAMPED) if taking else (STAMPED, SOCKET_BG)
            found[0].pixels = np.array(_socket_block(hand, rot, plate, mark),
                                       dtype=np.int8)

    def step(self) -> None:
        if self._anim:
            self._anim -= 1
            self._play()
            if self._anim == 0:
                self._settle()
                self.complete_action()
            return

        self._tick += 1
        self._redraw_decor()
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

        if self._anim:
            return
        self.complete_action()
