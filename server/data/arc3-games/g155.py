# ARC-AGI-3 candidate task g155.

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

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

def hatch(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 3 == 0 else -1 for x in range(cell)] for y in range(cell)]

def blink(step: int, period: int = 3) -> bool:
    return (step // period) % 2 == 0


FLOOR = 0
WALL = 4
HOLE = WALL
PLAYER = 9
EXIT_CORE = 11
DARK = WALL

CLASSES = {"1": 13, "2": 11, "3": 7, "4": 13, "5": 7}

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


def _wall():
    return block(WALL, CELL)


def _tile(glyph):
    return medallion(CLASSES[glyph], WALL, CELL)


def _crumb(glyph):
    return weave(CLASSES[glyph], CELL)


def _spent(glyph):
    return hatch(CLASSES[glyph], CELL)


def _hole(colour=HOLE):
    return weave(colour, CELL)


def _shut(glyph, bar=None, frame=None):
    return door(WALL if frame is None else frame,
                CLASSES[glyph] if bar is None else bar, CELL)


def _open():
    return door(WALL, None, CELL)


def _exit(lit):
    return medallion(PLAYER, EXIT_CORE if lit else WALL, CELL)


def _player(mark):
    return figure(PLAYER, mark, CELL)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for y in range(N):
            for x in range(N):
                c = rows[y][x]
                if c == "#":
                    pixels, name = _wall(), f"wall_{x}_{y}"
                elif c in CLASSES:
                    pixels, name = _tile(c), f"cell_{x}_{y}"
                elif c in DOORS:
                    pixels, name = _shut(DOORS[c]), f"cell_{x}_{y}"
                elif c == "X":
                    pixels, name = _exit(True), "exit"
                else:
                    continue
                sprites.append(Sprite(
                    pixels=pixels, name=name,
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0,
                    collidable=False,
                ).set_position(x * CELL, y * CELL))
        px, py = find_char(rows, "P")
        sprites.append(Sprite(
            pixels=_player(FLOOR), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=1, collidable=False,
        ).set_position(px * CELL, py * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G155A(RenderableUserDisplay):

    def __init__(self, game: "G155") -> None:
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


class G155(ARCBaseGame):

    BITE_FRAMES = 6
    DYING_FRAMES = 6

    def __init__(self) -> None:
        self.eaten: set[str] = set()
        self.holes: set[tuple[int, int]] = set()
        self.pending: tuple[int, int] | None = None
        self.revealed: set[tuple[int, int]] = set()
        self.tick = 0
        self._biting = 0
        self._dying = 0
        self._chewed: str | None = None
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=DARK,
            interfaces=[G155A(self)],
        )
        super().__init__(game_id="g155", levels=build_levels(), camera=camera,
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
        self._biting = 0
        self._dying = 0
        self._chewed = None
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

    def _paint(self, x: int, y: int, pixels) -> None:
        for s in self.current_level.get_sprites_by_name(f"cell_{x}_{y}"):
            s.pixels = np.array(pixels)

    def _paint_hole(self, x: int, y: int) -> None:
        self._paint(x, y, _hole())

    def _paint_player(self, standing: bool = True) -> None:
        x, y = self.player_cell()
        glyph = self.rows[y][x]
        mark = CLASSES[glyph] if glyph in CLASSES and glyph not in self.eaten else FLOOR
        px = _player(mark) if standing else _hole()
        for s in self.current_level.get_sprites_by_name("player"):
            s.pixels = np.array(px)

    def _paint_exit(self) -> None:
        for s in self.current_level.get_sprites_by_name("exit"):
            s.pixels = np.array(_exit(blink(self.tick, 3)))

    def _paint_bite(self, left: int) -> None:
        glyph = self._chewed
        if glyph is None:
            return
        if left >= 5:
            face, bar, frame = _crumb(glyph), None, None
        elif left >= 3:
            face, bar, frame = _spent(glyph), None, CLASSES[glyph]
        else:
            face, bar, frame = hatch(WALL, CELL), FLOOR, CLASSES[glyph]
        for cell in eat_targets(self.rows, glyph):
            if cell != self.pending:
                self._paint(cell[0], cell[1], face)
        for c, g in DOORS.items():
            if g == glyph:
                for cx, cy in eat_targets(self.rows, c):
                    self._paint(cx, cy, _shut(glyph, bar, frame))

    def _settle_bite(self) -> None:
        glyph = self._chewed
        self._chewed = None
        if glyph is None:
            return
        for cell in eat_targets(self.rows, glyph):
            if cell == self.pending:
                self._paint(cell[0], cell[1], _spent(glyph))
            else:
                self._paint_hole(*cell)
        for c, g in DOORS.items():
            if g == glyph:
                for cx, cy in eat_targets(self.rows, c):
                    self._paint(cx, cy, _open())
        self._paint_player()

    def _bite(self) -> bool:
        x, y = self.player_cell()
        glyph = self.rows[y][x]
        if glyph not in CLASSES or glyph in self.eaten:
            return False
        self.eaten.add(glyph)
        for cell in eat_targets(self.rows, glyph):
            if cell == (x, y):
                self.pending = cell
            else:
                self.holes.add(cell)
        self._chewed = glyph
        return True

    def _stuck(self) -> bool:
        x, y = self.player_cell()
        return not any(passable(self.rows, self.eaten, self.holes, x + dx, y + dy)
                       for dx, dy in DIRS)

    def _finish_or_die(self) -> None:
        if self._stuck():
            self._dying = self.DYING_FRAMES
            return
        self.complete_action()

    def step(self) -> None:
        if self._dying:
            self._dying -= 1
            self._paint_player(standing=self._dying % 2 == 0)
            if self._dying == 0:
                self.level_reset()
                self.complete_action()
            return

        if self._biting:
            self._biting -= 1
            if self._biting:
                self._paint_bite(self._biting)
                return
            self._settle_bite()
            self._finish_or_die()
            return

        self.tick += 1
        self._paint_exit()

        if self.action.id == GameAction.ACTION5:
            if self._bite():
                self._biting = self.BITE_FRAMES
                self._paint_bite(self._biting)
                return
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
                self._paint_player()
                if (nx, ny) == find_char(self.rows, "X"):
                    self.next_level()
                elif self._stuck():
                    self._dying = self.DYING_FRAMES
                    return

        self.complete_action()
