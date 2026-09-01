# ARC-AGI-3 candidate task tf17bd2df.

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

WALL = 2
QUIET = 4
LOUD = 0
MARK = 12
PLAYER = 10
ASLEEP = 13
AWAKE = 8
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
                colour = {"#": WALL, "~": LOUD, "X": EXIT}.get(c)
                if colour is None:
                    continue
                sprites.append(Sprite(
                    pixels=_block(colour), name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0, collidable=False,
                ).set_position(x * CELL, y * CELL))
        for i, (hx, hy) in enumerate(find_all(rows, "H")):
            sprites.append(Sprite(
                pixels=_block(ASLEEP), name=f"hunter_{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=1, collidable=False,
            ).set_position(hx * CELL, hy * CELL))
        px, py = find_char(rows, "P")
        sprites.append(Sprite(
            pixels=_block(PLAYER), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=2, collidable=False,
        ).set_position(px * CELL, py * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G324a3788(RenderableUserDisplay):

    def __init__(self, game: "G57e0c0b7") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        m = self._game.mark
        if m is not None:
            x, y = m
            frame[y * CELL + 1:y * CELL + 3, x * CELL + 1:x * CELL + 3] = MARK
        return frame


class G57e0c0b7(ARCBaseGame):

    def __init__(self) -> None:
        rows = LEVELS_SPEC[0]["rows"]
        self.player = find_char(rows, "P")
        self.hunters = find_all(rows, "H")
        self.mark = None
        self.quiet = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=QUIET, letter_box=5,
            interfaces=[G324a3788(self)],
        )
        super().__init__(game_id="tf17bd2df", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4])
        self.on_set_level(self.current_level)

    @property
    def rows(self):
        return LEVELS_SPEC[self.level_index]["rows"]

    def on_set_level(self, level: Level) -> None:
        self.player, self.hunters, self.mark, self.quiet = start_state(self.rows)
        self._repaint()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _repaint(self) -> None:
        colour = AWAKE if self.mark is not None else ASLEEP
        for i, (hx, hy) in enumerate(self.hunters):
            for s in self.current_level.get_sprites_by_name(f"hunter_{i}"):
                s.pixels = np.array(_block(colour))
                s.set_position(hx * CELL, hy * CELL)
        for s in self.current_level.get_sprites_by_name("player"):
            s.set_position(self.player[0] * CELL, self.player[1] * CELL)

    def step(self) -> None:
        direction = {GameAction.ACTION1: (0, -1), GameAction.ACTION2: (0, 1),
                     GameAction.ACTION3: (-1, 0), GameAction.ACTION4: (1, 0)}.get(
                         self.action.id)
        if direction is not None:
            state = (self.player, self.hunters, self.mark, self.quiet)
            (self.player, self.hunters, self.mark, self.quiet), dead = advance(
                self.rows, state, direction)
            self._repaint()
            if dead:
                self.level_reset()
            elif self.player == find_char(self.rows, "X"):
                self.next_level()
        self.complete_action()
