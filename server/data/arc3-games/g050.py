# ARC-AGI-3 candidate task g050.

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

def rounded(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for (y, x) in ((0, 0), (0, cell - 1), (cell - 1, 0), (cell - 1, cell - 1)):
        px[y][x] = -1
    return px

def ring(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for y in range(1, cell - 1):
        for x in range(1, cell - 1):
            px[y][x] = -1
    return px

def figure(body: int, mark: int | None = None, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    mid = cell // 2
    for x in range(1, cell - 1):
        px[0][x] = body
    for y in range(1, cell - 1):
        for x in range(cell):
            px[y][x] = body
    px[cell - 1][0] = px[cell - 1][mid] = -1
    for x in range(cell):
        if px[cell - 1][x] != -1:
            px[cell - 1][x] = body
    px[cell - 1][1] = body
    px[cell - 1][cell - 1] = body
    if mark is not None and cell >= 4:
        px[mid][mid] = mark
    return px

def medallion(rim: int, centre: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    last = cell - 1
    for x in range(1, last):
        px[0][x] = px[last][x] = rim
    for y in range(1, last):
        px[y][0] = px[y][last] = rim
    for y in range(1, last):
        for x in range(1, last):
            px[y][x] = centre
    return px

def door(frame_colour: int, bar: int | None, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    last = cell - 1
    for y in range(cell):
        px[y][0] = px[y][last] = frame_colour
    for x in range(cell):
        px[0][x] = frame_colour
    if bar is not None:
        for y in range(1, cell):
            for x in range(1, last):
                px[y][x] = bar
    return px

def speckle(colour: int, seed: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(cell):
        for x in range(cell):
            if (x * 7 + y * 13 + seed * 31) % 5 == 0:
                px[y][x] = colour
    return px

def fixture(colours: tuple, phase: int, seed: int = 0, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[1][1] = px[cell - 2][cell - 2] = colours[(phase + seed) % len(colours)]
    return px


FLOOR = 10
WALL = 2
DARK = 5
ASH = 13
STONE = 6
EXIT = 14
PLAYER = 8
EMBER = PLAYER

DECOR_CYCLE = (ASH, WALL, WALL)

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


def _open(rows, x, y) -> bool:
    return 0 <= x < N and 0 <= y < N and rows[y][x] != "#"


def _wall_cell(rows, x, y):
    px = block(WALL, CELL)
    if (x + y) % 2:
        return px
    pits = speckle(1, (x * 3 + y * 5) % 7, CELL)
    keep = (_open(rows, x, y - 1), _open(rows, x, y + 1),
            _open(rows, x - 1, y), _open(rows, x + 1, y))
    for py in range(CELL):
        for pxx in range(CELL):
            if pits[py][pxx] < 0:
                continue
            if (py == 0 and keep[0]) or (py == CELL - 1 and keep[1]):
                continue
            if (pxx == 0 and keep[2]) or (pxx == CELL - 1 and keep[3]):
                continue
            px[py][pxx] = -1
    return px


def _wall_run_pixels(rows, x0, y, length):
    cells = [_wall_cell(rows, x0 + i, y) for i in range(length)]
    return [[cells[i][r][c] for i in range(length) for c in range(CELL)]
            for r in range(CELL)]


def decor_cells(rows):
    return [(x, y) for y in range(N) for x in range(N)
            if rows[y][x] == "#" and (x * 5 + y * 11) % 7 == 3
            and any(_open(rows, x + dx, y + dy) for dx, dy in DIRS)]


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
                pixels=_wall_run_pixels(rows, x0, y, length), name=f"wall_{x0}_{y}",
                blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.TANGIBLE, layer=-1,
            ).set_position(x0 * CELL, y * CELL))
        for x, y in decor_cells(rows):
            sprites.append(Sprite(
                pixels=fixture(DECOR_CYCLE, 0, (x + y) % 3, CELL),
                name=f"decor_{x}_{y}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0,
                tags=["decor"], collidable=False,
            ).set_position(x * CELL, y * CELL))
        for x, y in sorted(stone_cells(rows)):
            sprites.append(Sprite(
                pixels=ring(STONE, CELL), name=f"stone_{x}_{y}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0,
                tags=["stone"], collidable=False,
            ).set_position(x * CELL, y * CELL))
        ex, ey = find_char(rows, "X")
        sprites.append(Sprite(
            pixels=door(EXIT, None, CELL), name="exit",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=0,
            tags=["exit"], collidable=False,
        ).set_position(ex * CELL, ey * CELL))
        px, py = find_char(rows, "P")
        sprites.append(Sprite(
            pixels=figure(PLAYER, cell=CELL), name="player",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(px * CELL, py * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G050A(RenderableUserDisplay):

    def __init__(self, game: "G050") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        out = np.full_like(frame, DARK)
        for x, y in self._game.revealed:
            out[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = \
                frame[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL]
        return out


class G050(ARCBaseGame):

    BURN_FRAMES = 1
    DIE_FRAMES = 5
    WIN_FRAMES = 5

    def __init__(self) -> None:
        self.ash: set[tuple[int, int]] = set()
        self.revealed: set[tuple[int, int]] = set()
        self._fx: tuple[str, int] | None = None
        self._vacated: tuple[int, int] | None = None
        self._pending: str | None = None
        self._beat = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=DARK,
            interfaces=[G050A(self)],
        )
        super().__init__(game_id="g050", levels=build_levels(), camera=camera,
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
        self._fx = None
        self._vacated = None
        self._pending = None
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
            pixels=rounded(ASH, CELL), name=f"ash_{x}_{y}",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=0, tags=["ash"],
        ).set_position(x * CELL, y * CELL))

    def _stuck(self) -> bool:
        x, y = self.player_cell()
        return not any(self.passable(x + dx, y + dy) for dx, dy in DIRS)

    def _repaint(self, name: str, pixels) -> None:
        for sprite in self.current_level.get_sprites_by_name(name):
            sprite.pixels = np.array(pixels)

    def _paint_decor(self) -> None:
        for sprite in self.current_level.get_sprites_by_tag("decor"):
            seed = (sprite.x // CELL + sprite.y // CELL) % 3
            sprite.pixels = np.array(fixture(DECOR_CYCLE, self._beat, seed, CELL))

    def _paint_vacated(self, hot: bool) -> None:
        if self._vacated is None:
            return
        x, y = self._vacated
        if self.rows[y][x] == "S":
            self._repaint(f"stone_{x}_{y}",
                          medallion(STONE, EMBER, CELL) if hot else ring(STONE, CELL))
        else:
            self._repaint(f"ash_{x}_{y}",
                          block(EMBER, CELL) if hot else rounded(ASH, CELL))

    def _paint_fx(self, kind: str, left: int) -> None:
        if kind == "burn":
            self._paint_vacated(hot=left > 0)
            return
        lit = left % 2 == 1
        if kind == "die":
            self._repaint("player", figure(ASH if lit else PLAYER, cell=CELL))
            for sprite in self.current_level.get_sprites_by_tag("ash"):
                sprite.pixels = np.array(
                    block(EMBER, CELL) if lit else rounded(ASH, CELL))
        else:
            self._repaint("player", figure(EXIT if lit else PLAYER, cell=CELL))
            self._repaint("exit", door(PLAYER if lit else EXIT, None, CELL))

    def _resolve(self, kind: str) -> None:
        if kind == "burn":
            if self._pending == "win":
                self._fx = ("win", self.WIN_FRAMES)
                self._paint_fx("win", self.WIN_FRAMES)
                return
            if self._pending == "die":
                self._fx = ("die", self.DIE_FRAMES)
                self._paint_fx("die", self.DIE_FRAMES)
                return
        elif kind == "win":
            self.next_level()
        else:
            self.level_reset()
        self.complete_action()

    def step(self) -> None:
        self._beat += 1
        self._paint_decor()

        if self._fx is not None:
            kind, left = self._fx
            left -= 1
            self._fx = (kind, left) if left else None
            self._paint_fx(kind, left)
            if left == 0:
                self._resolve(kind)
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

        if dx or dy:
            before = self.player_cell()
            self.try_move("player", dx * CELL, dy * CELL)
            after = self.player_cell()
            if after != before:
                self._burn(*before)
                self._reveal(*after)
                self._vacated = before
                if after == find_char(self.rows, "X"):
                    self._pending = "win"
                elif self._stuck():
                    self._pending = "die"
                else:
                    self._pending = None
                self._fx = ("burn", self.BURN_FRAMES)
                self._paint_fx("burn", self.BURN_FRAMES)
                return

        self.complete_action()
