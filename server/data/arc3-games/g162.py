# ARC-AGI-3 candidate task g162.

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


def block(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour] * cell for _ in range(cell)]

def rounded(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for (y, x) in ((0, 0), (0, cell - 1), (cell - 1, 0), (cell - 1, cell - 1)):
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

def facing(body: int, visor: int, heading: tuple, cell: int = 4) -> list[list[int]]:
    px = rounded(body, cell)
    dx, dy = heading
    last = cell - 1
    if dy < 0:
        px[0][1] = px[0][cell - 2] = visor
    elif dy > 0:
        px[last][1] = px[last][cell - 2] = visor
    elif dx < 0:
        px[1][0] = px[cell - 2][0] = visor
    elif dx > 0:
        px[1][last] = px[cell - 2][last] = visor
    else:
        px[1][1] = visor
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


WALL = 10
QUIET = 13
LOUD = 6
PLAYER = 0
MARK = 11
PLAYER_CORE = QUIET
ASLEEP = 14
AWAKE = 11
HUNTER_EYES = QUIET
EXIT = 14

DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))
QUIET_LIMIT = 4

LEVELS_SPEC = [
    {"rows": [
        "################",
        "#..............#",
        "#..P...........#",
        "#..............#",
        "#####~##########",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.............H#",
        "#..............#",
        "#..............#",
        "#####.##########",
        "#....X.........#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..............#",
        "#..P...........#",
        "#.~............#",
        "#####~##########",
        "#..............#",
        "#....H.........#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#####.##########",
        "#....X.........#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#.~............#",
        "#..P...........#",
        "#..............#",
        "#.........H....#",
        "#..............#",
        "#....H.........#",
        "#####~##########",
        "#..............#",
        "#..............#",
        "#..............#",
        "#####.##########",
        "#....X.........#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#~.............#",
        "#~.............#",
        "#..P...........#",
        "#..............#",
        "#.........H....#",
        "#..............#",
        "#....H.........#",
        "#####~##########",
        "#..............#",
        "#..............#",
        "#####.##########",
        "#....X.........#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#~.............#",
        "#..............#",
        "#..P...........#",
        "#..............#",
        "#..............#",
        "#####~##########",
        "#....H.........#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#####.##########",
        "#....X.........#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..........~...#",
        "#..P...........#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#....H.........#",
        "#####~##########",
        "#####~##########",
        "#####~##########",
        "#####.##########",
        "#....X.........#",
        "#..............#",
        "#..............#",
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
    return None


def find_all(rows, ch):
    return tuple((x, y) for y, row in enumerate(rows)
                 for x, c in enumerate(row) if c == ch)


def passable(rows, x, y):
    return 0 <= x < N and 0 <= y < N and rows[y][x] != "#"


def is_loud(rows, x, y):
    return rows[y][x] == "~"


def hunter_step(rows, pos, mark):
    if mark is None or pos == mark:
        return pos
    dist = {mark: 0}
    q = deque([mark])
    while q:
        cx, cy = q.popleft()
        for dx, dy in DIRS:
            nx, ny = cx + dx, cy + dy
            if (nx, ny) not in dist and passable(rows, nx, ny):
                dist[(nx, ny)] = dist[(cx, cy)] + 1
                q.append((nx, ny))
    best = None
    for dx, dy in DIRS:
        nxt = (pos[0] + dx, pos[1] + dy)
        if nxt in dist and (best is None or dist[nxt] < dist[best]):
            best = nxt
    return best if best is not None else pos


def advance(rows, state, direction):
    (px, py), hunters, mark, quiet = state
    dx, dy = direction
    nx, ny = px + dx, py + dy
    if not passable(rows, nx, ny):
        return state, False
    awake = mark is not None
    if awake and (nx, ny) in hunters:
        return state, True

    if is_loud(rows, nx, ny):
        mark, quiet = (nx, ny), 0
    elif mark is not None:
        quiet += 1
        if quiet >= QUIET_LIMIT:
            mark, quiet = None, 0

    if mark is not None:
        moved = tuple(hunter_step(rows, h, mark) for h in hunters)
        if any(h == (nx, ny) for h in moved):
            return ((nx, ny), moved, mark, quiet), True
        hunters = moved
        if all(h == mark for h in hunters):
            mark, quiet = None, 0
    return ((nx, ny), hunters, mark, quiet), False


def start_state(rows):
    return (find_char(rows, "P"), find_all(rows, "H"), None, 0)


def _wall():
    return block(WALL, CELL)


def _loud(x, y):
    px = block(LOUD, CELL)
    for gy, row in enumerate(speckle(LOUD, x * 5 + y * 3, CELL)):
        for gx, v in enumerate(row):
            if v >= 0:
                px[gy][gx] = -1
    return px


def _exit():
    return door(EXIT, None, CELL)


def _sleeper():
    px = rounded(ASLEEP, CELL)
    px[0] = [-1] * CELL
    return px


def _hunter(heading):
    return facing(AWAKE, HUNTER_EYES, heading, CELL)


def _player(lit: bool = False):
    return figure(AWAKE if lit else PLAYER, PLAYER_CORE, CELL)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for y in range(N):
            for x in range(N):
                c = rows[y][x]
                if c == "#":
                    art = _wall()
                elif c == "~":
                    art = _loud(x, y)
                elif c == "X":
                    art = _exit()
                else:
                    continue
                sprites.append(Sprite(
                    pixels=art, name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0, collidable=False,
                ).set_position(x * CELL, y * CELL))
        for i, (hx, hy) in enumerate(find_all(rows, "H")):
            sprites.append(Sprite(
                pixels=_sleeper(), name=f"hunter_{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1, collidable=False,
            ).set_position(hx * CELL, hy * CELL))
        px, py = find_char(rows, "P")
        sprites.append(Sprite(
            pixels=_player(), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=2, collidable=False,
        ).set_position(px * CELL, py * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G162A(RenderableUserDisplay):

    GROUND = (QUIET, LOUD)

    def __init__(self, game: "G162") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        m = self._game.mark
        if m is None:
            return frame
        ox, oy = m[0] * CELL, m[1] * CELL
        for dy in range(CELL):
            for dx in range(CELL):
                if (dy in (0, CELL - 1)) != (dx in (0, CELL - 1)):
                    continue
                if int(frame[oy + dy, ox + dx]) in self.GROUND:
                    frame[oy + dy, ox + dx] = MARK
        return frame


class G162(ARCBaseGame):

    CAUGHT_FRAMES = 6

    def __init__(self) -> None:
        self._caught = 0
        rows = LEVELS_SPEC[0]["rows"]
        self.player = find_char(rows, "P")
        self.hunters = find_all(rows, "H")
        self.mark = None
        self.quiet = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=QUIET, letter_box=5,
            interfaces=[G162A(self)],
        )
        super().__init__(game_id="g162", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4])
        self.on_set_level(self.current_level)

    @property
    def rows(self):
        return LEVELS_SPEC[self.level_index]["rows"]

    def on_set_level(self, level: Level) -> None:
        self.player, self.hunters, self.mark, self.quiet = start_state(self.rows)
        self._caught = 0
        self._repaint()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _repaint(self) -> None:
        for i, (hx, hy) in enumerate(self.hunters):
            if self.mark is None:
                art = _sleeper()
            else:
                nx, ny = hunter_step(self.rows, (hx, hy), self.mark)
                art = _hunter((nx - hx, ny - hy))
            for s in self.current_level.get_sprites_by_name(f"hunter_{i}"):
                s.pixels = np.array(art)
                s.set_position(hx * CELL, hy * CELL)
        for s in self.current_level.get_sprites_by_name("player"):
            s.pixels = np.array(_player())
            s.set_position(self.player[0] * CELL, self.player[1] * CELL)

    def step(self) -> None:
        if self._caught:
            self._caught -= 1
            for s in self.current_level.get_sprites_by_name("player"):
                s.pixels = np.array(_player(self._caught % 2 == 0))
            if self._caught == 0:
                self.level_reset()
                self.complete_action()
            return

        direction = {GameAction.ACTION1: (0, -1), GameAction.ACTION2: (0, 1),
                     GameAction.ACTION3: (-1, 0), GameAction.ACTION4: (1, 0)}.get(
                         self.action.id)
        if direction is not None:
            state = (self.player, self.hunters, self.mark, self.quiet)
            (self.player, self.hunters, self.mark, self.quiet), dead = advance(
                self.rows, state, direction)
            self._repaint()
            if dead:
                self._caught = self.CAUGHT_FRAMES
                return
            if self.player == find_char(self.rows, "X"):
                self.next_level()
        self.complete_action()
