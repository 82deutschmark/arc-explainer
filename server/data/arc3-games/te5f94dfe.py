# ARC-AGI-3 candidate task te5f94dfe.

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

WALL = 1
FLOOR = 4
HOLE = 13
PLAYER = 10
EXIT = 14
DARK = 5

CLASSES = {"1": 8, "2": 9, "3": 11, "4": 12, "5": 15}

DOORS = {"a": "1", "b": "2", "c": "3", "d": "4", "e": "5"}

DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))

LEVELS_SPEC = [
    {"reveal": None, "rows": [
        "################",
        "#.........#....#",
        "#.........#....#",
        "#....1....#....#",
        "#.........#....#",
        "#..P......aX...#",
        "#.........#....#",
        "#....1....#....#",
        "#.........#....#",
        "#......1..#....#",
        "#.........#....#",
        "#..1......#....#",
        "#.........#....#",
        "#.........#....#",
        "#.........#....#",
        "################",
    ]},
    {"reveal": None, "rows": [
        "################",
        "#..............#",
        "#....1....1....#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
        "#P...1111.1.a.X#",
        "################",
        "#..............#",
        "#......1.......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"reveal": None, "rows": [
        "################",
        "#..............#",
        "#.....1........#",
        "#..............#",
        "################",
        "#P..1111..2..b.#",
        "#############.##",
        "#.......#....1.#",
        "#.......#......#",
        "#.......a......#",
        "#......X#......#",
        "#.......#......#",
        "#########......#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"reveal": 3, "rows": [
        "################",
        "#P.............#",
        "#..............#",
        "#####.##########",
        "#####3##########",
        "#####3##########",
        "#####3##########",
        "#..333333......#",
        "#########.######",
        "#########c######",
        "#..............#",
        "#..............#",
        "#.............X#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"reveal": 3, "rows": [
        "################",
        "#..............#",
        "#.....4........#",
        "#..............#",
        "################",
        "#P..4444.......#",
        "####d#########.#",
        "####.#########.#",
        "###...########.#",
        "###.4.########.#",
        "###...########.#",
        "##############.#",
        "#............5.#",
        "#########e######",
        "#########X######",
        "################",
    ]},
    {"reveal": 3, "rows": [
        "################",
        "#P.............#",
        "#..............#",
        "#####1##########",
        "#####1##########",
        "#..111111......#",
        "#########a######",
        "#.........2....#",
        "#..............#",
        "#####b###.######",
        "#.....#........#",
        "#.....#...3....#",
        "#..c..#........#",
        "#.....#........#",
        "#..X..#........#",
        "################",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 4


def find_char(rows, ch):
    for y, row in enumerate(rows):
        x = row.find(ch)
        if x >= 0:
            return x, y
    raise ValueError(f"no {ch!r} in board")


def eat_targets(rows, glyph):
    return {(x, y) for y, row in enumerate(rows)
            for x, c in enumerate(row) if c == glyph}


def passable(rows, eaten, holes, x, y):
    if not (0 <= x < N and 0 <= y < N):
        return False
    c = rows[y][x]
    if c == "#":
        return False
    if (x, y) in holes:
        return False
    if c in DOORS:
        return DOORS[c] in eaten
    return True


def _block(colour, core=None):
    px = [[colour] * CELL for _ in range(CELL)]
    if core is not None:
        px[1][1] = px[1][2] = px[2][1] = px[2][2] = core
    return px


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for y in range(N):
            for x in range(N):
                c = rows[y][x]
                if c == "#":
                    colour, core = WALL, None
                elif c in CLASSES:
                    colour, core = CLASSES[c], None
                elif c in DOORS:
                    colour, core = CLASSES[DOORS[c]], WALL
                elif c == "X":
                    colour, core = EXIT, None
                else:
                    continue
                sprites.append(Sprite(
                    pixels=_block(colour, core), name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0,
                    collidable=False,
                ).set_position(x * CELL, y * CELL))
        px, py = find_char(rows, "P")
        sprites.append(Sprite(
            pixels=_block(PLAYER), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=1, collidable=False,
        ).set_position(px * CELL, py * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G09b0414f(RenderableUserDisplay):

    def __init__(self, game: "Gfb536680") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        if self._game.reveal_radius is None:
            return frame
        out = np.full_like(frame, DARK)
        for x, y in self._game.revealed:
            out[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = \
                frame[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL]
        return out


class Gfb536680(ARCBaseGame):

    def __init__(self) -> None:
        self.eaten: set[str] = set()
        self.holes: set[tuple[int, int]] = set()
        self.pending: tuple[int, int] | None = None
        self.revealed: set[tuple[int, int]] = set()
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=DARK,
            interfaces=[G09b0414f(self)],
        )
        super().__init__(game_id="te5f94dfe", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])
        self.on_set_level(self.current_level)

    @property
    def rows(self):
        return LEVELS_SPEC[self.level_index]["rows"]

    @property
    def reveal_radius(self):
        return LEVELS_SPEC[self.level_index]["reveal"]

    def player_cell(self):
        p = self.current_level.get_sprites_by_name("player")
        if not p:
            return 0, 0
        return p[0].x // CELL, p[0].y // CELL

    def on_set_level(self, level: Level) -> None:
        self.eaten = set()
        self.holes = set()
        self.pending = None
        self.revealed = set()
        self._reveal(*find_char(self.rows, "P"))

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _reveal(self, x: int, y: int) -> None:
        r = self.reveal_radius
        if r is None:
            self.revealed = {(a, b) for a in range(N) for b in range(N)}
            return
        for b in range(y - r, y + r + 1):
            for a in range(x - r, x + r + 1):
                if 0 <= a < N and 0 <= b < N:
                    self.revealed.add((a, b))

    def _paint_hole(self, x: int, y: int) -> None:
        for s in self.current_level.get_sprites_by_name(f"cell_{x}_{y}"):
            s.pixels = np.array(_block(HOLE))

    def _bite(self) -> None:
        x, y = self.player_cell()
        glyph = self.rows[y][x]
        if glyph not in CLASSES or glyph in self.eaten:
            return
        self.eaten.add(glyph)
        for cell in eat_targets(self.rows, glyph):
            if cell == (x, y):
                self.pending = cell
            else:
                self.holes.add(cell)
                self._paint_hole(*cell)
        for c, g in DOORS.items():
            if g == glyph:
                for cx, cy in eat_targets(self.rows, c):
                    for s in self.current_level.get_sprites_by_name(f"cell_{cx}_{cy}"):
                        s.pixels = np.array(_block(FLOOR))

    def _stuck(self) -> bool:
        x, y = self.player_cell()
        return not any(passable(self.rows, self.eaten, self.holes, x + dx, y + dy)
                       for dx, dy in DIRS)

    def step(self) -> None:
        if self.action.id == GameAction.ACTION5:
            self._bite()
            if self._stuck():
                self.level_reset()
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

        if dx or dy:
            x, y = self.player_cell()
            nx, ny = x + dx, y + dy
            if passable(self.rows, self.eaten, self.holes, nx, ny):
                for s in self.current_level.get_sprites_by_name("player"):
                    s.set_position(nx * CELL, ny * CELL)
                if self.pending == (x, y):
                    self.holes.add(self.pending)
                    self._paint_hole(*self.pending)
                    self.pending = None
                self._reveal(nx, ny)
                if (nx, ny) == find_char(self.rows, "X"):
                    self.next_level()
                elif self._stuck():
                    self.level_reset()

        self.complete_action()
