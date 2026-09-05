# ARC-AGI-3 candidate task g162.

from collections import deque

import numpy as np

from sprite_book import block, door, facing, figure, rounded, speckle

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

STONE_WALL = 2
STILL_TILE = 9
LOOSE_TILE = 10
WADER_AVATAR = 11
ECHO_MARK = 12
DOOR_EXIT = 3
WADER_CORE = STILL_TILE
ASLEEP = DOOR_EXIT
AWAKE = ECHO_MARK
SOUNDER_EYES = STILL_TILE

DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))
QUIET_LIMIT = 4

LEVELS_SPEC = [
    {"rows": [
        "############",
        "#P....#....#",
        "#.....#....#",
        "#.....#....#",
        "#.....#....#",
        "#.....~....#",
        "#.....#....#",
        "#.....#....#",
        "#.....#....#",
        "#.....#...H#",
        "#.....#.X..#",
        "############",
    ]},
    {"rows": [
        "############",
        "#P....#....#",
        "#.#.#.#....#",
        "#.#~#.#....#",
        "#.###.#....#",
        "#.....~....#",
        "#.....#H...#",
        "#.....#....#",
        "#.....#....#",
        "#.....#....#",
        "#.....#.X..#",
        "############",
    ]},
    {"rows": [
        "############",
        "#P.#...#..X#",
        "#..#...#...#",
        "#..#...#...#",
        "#..#...#...#",
        "#..~...~...#",
        "#..#.H.#...#",
        "#..#...#...#",
        "#~.#...#...#",
        "#..#...#...#",
        "#..#...#...#",
        "############",
    ]},
    {"rows": [
        "############",
        "#P........~#",
        "#..........#",
        "#..........#",
        "#..........#",
        "#####~######",
        "#..........#",
        "#...H......#",
        "#..........#",
        "#..........#",
        "#X.........#",
        "############",
    ]},
    {"rows": [
        "############",
        "#P........~#",
        "#..........#",
        "#..........#",
        "#..........#",
        "#####~######",
        "#..........#",
        "#...H...H..#",
        "#..........#",
        "#..........#",
        "#.........X#",
        "############",
    ]},
    {"rows": [
        "############",
        "#P.#...#..~#",
        "#..#...#...#",
        "#..#...#H..#",
        "#..#...#...#",
        "#..~...~...#",
        "#..#...#...#",
        "#..#.H.#...#",
        "#..#...#...#",
        "#..#...#...#",
        "#.~#...#..X#",
        "############",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 5
PAD = (64 - N * CELL) // 2


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


def sounder_step(rows, pos, echo):
    if echo is None or pos == echo:
        return pos
    dist = {echo: 0}
    q = deque([echo])
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
    (px, py), sounders, echo, quiet = state
    dx, dy = direction
    nx, ny = px + dx, py + dy
    if not passable(rows, nx, ny):
        return state, False
    awake = echo is not None
    if awake and (nx, ny) in sounders:
        return state, True

    if is_loud(rows, nx, ny):
        echo, quiet = (nx, ny), 0
    elif echo is not None:
        quiet += 1
        if quiet >= QUIET_LIMIT:
            echo, quiet = None, 0

    if echo is not None:
        moved = tuple(sounder_step(rows, h, echo) for h in sounders)
        if any(h == (nx, ny) for h in moved):
            return ((nx, ny), moved, echo, quiet), True
        sounders = moved
        if all(h == echo for h in sounders):
            echo, quiet = None, 0
    return ((nx, ny), sounders, echo, quiet), False


def start_state(rows):
    return (find_char(rows, "P"), find_all(rows, "H"), None, 0)


def _wall(x, y):
    px = block(STONE_WALL, CELL)
    for gy in range(CELL):
        if gy % 2 == 0:
            px[gy][(x * 2 + gy) % CELL] = DOOR_EXIT
        else:
            px[gy][(x * 2 + gy + 3) % CELL] = DOOR_EXIT
    px[0] = [DOOR_EXIT if (gx + y) % 3 == 0 else STONE_WALL for gx in range(CELL)]
    return px


def _still(x, y):
    px = [[-1] * CELL for _ in range(CELL)]
    px[(x + y) % CELL][(x * 3 + y) % CELL] = WADER_CORE
    px[(x * 2 + y) % CELL][(x + y * 3) % CELL] = WADER_CORE
    return px


def _loose(x, y):
    px = block(LOOSE_TILE, CELL)
    for gy, row in enumerate(speckle(LOOSE_TILE, x * 5 + y * 3, CELL)):
        for gx, v in enumerate(row):
            if v >= 0:
                px[gy][gx] = -1
    return px


def _exit():
    return door(DOOR_EXIT, None, CELL)


def _sleeper():
    px = rounded(ASLEEP, CELL)
    px[0] = [-1] * CELL
    px[1] = [-1 if gx in (0, CELL - 1) else ASLEEP for gx in range(CELL)]
    return px


def _sounder(heading):
    return facing(AWAKE, SOUNDER_EYES, heading, CELL)


def _wader(lit: bool = False):
    return figure(AWAKE if lit else WADER_AVATAR, WADER_CORE, CELL)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for y in range(N):
            for x in range(N):
                c = rows[y][x]
                if c == "#":
                    art = _wall(x, y)
                elif c == "~":
                    art = _loose(x, y)
                elif c == "X":
                    art = _exit()
                else:
                    art = _still(x, y)
                sprites.append(Sprite(
                    pixels=art, name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0, collidable=False,
                ).set_position(x * CELL, y * CELL))
        for i, (hx, hy) in enumerate(find_all(rows, "H")):
            sprites.append(Sprite(
                pixels=_sleeper(), name=f"sounder_{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1, collidable=False,
            ).set_position(hx * CELL, hy * CELL))
        px, py = find_char(rows, "P")
        sprites.append(Sprite(
            pixels=_wader(), name="wader",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=2, collidable=False,
        ).set_position(px * CELL, py * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G162A(RenderableUserDisplay):

    GROUND = (STILL_TILE, LOOSE_TILE, WADER_CORE)
    MID = CELL // 2

    def __init__(self, game: "G162") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        m = self._game.echo
        if m is None:
            return frame
        left = max(QUIET_LIMIT - self._game.quiet, 1)
        ox, oy = PAD + m[0] * CELL, PAD + m[1] * CELL
        corners = [(0, 0), (CELL - 1, 0), (0, CELL - 1), (CELL - 1, CELL - 1)][:left]
        for dx, dy in corners + [(self.MID, self.MID)]:
            if int(frame[oy + dy, ox + dx]) in self.GROUND:
                frame[oy + dy, ox + dx] = ECHO_MARK
        return frame


class G162(ARCBaseGame):

    CAUGHT_FRAMES = 6

    def __init__(self) -> None:
        self._caught = 0
        rows = LEVELS_SPEC[0]["rows"]
        self.wader = find_char(rows, "P")
        self.sounders = find_all(rows, "H")
        self.echo = None
        self.quiet = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=STILL_TILE, letter_box=STONE_WALL,
            interfaces=[G162A(self)],
        )
        super().__init__(game_id="g162", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4])
        self.on_set_level(self.current_level)

    @property
    def rows(self):
        return LEVELS_SPEC[self.level_index]["rows"]

    def on_set_level(self, level: Level) -> None:
        self.wader, self.sounders, self.echo, self.quiet = start_state(self.rows)
        self._caught = 0
        self._repaint()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _repaint(self) -> None:
        for i, (hx, hy) in enumerate(self.sounders):
            if self.echo is None:
                art = _sleeper()
            else:
                nx, ny = sounder_step(self.rows, (hx, hy), self.echo)
                art = _sounder((nx - hx, ny - hy))
            for s in self.current_level.get_sprites_by_name(f"sounder_{i}"):
                s.pixels = np.array(art)
                s.set_position(hx * CELL, hy * CELL)
        for s in self.current_level.get_sprites_by_name("wader"):
            s.pixels = np.array(_wader())
            s.set_position(self.wader[0] * CELL, self.wader[1] * CELL)

    def step(self) -> None:
        if self._caught:
            self._caught -= 1
            for s in self.current_level.get_sprites_by_name("wader"):
                s.pixels = np.array(_wader(self._caught % 2 == 0))
            if self._caught == 0:
                self.level_reset()
                self.complete_action()
            return

        direction = {GameAction.ACTION1: (0, -1), GameAction.ACTION2: (0, 1),
                     GameAction.ACTION3: (-1, 0), GameAction.ACTION4: (1, 0)}.get(
                         self.action.id)
        if direction is not None:
            state = (self.wader, self.sounders, self.echo, self.quiet)
            (self.wader, self.sounders, self.echo, self.quiet), dead = advance(
                self.rows, state, direction)
            self._repaint()
            if dead:
                self._caught = self.CAUGHT_FRAMES
                return
            if self.wader == find_char(self.rows, "X"):
                self.next_level()
        self.complete_action()
