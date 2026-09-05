# ARC-AGI-3 candidate task g032.

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

def core(colour: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(1, cell - 1):
        for x in range(1, cell - 1):
            px[y][x] = colour
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

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

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

def hairline(frame, a: tuple, b: tuple, colour: int, only_over=None):
    x0, y0 = a
    x1, y1 = b
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    h, w = frame.shape
    while True:
        if 0 <= x0 < w and 0 <= y0 < h:
            if only_over is None or int(frame[y0, x0]) in only_over:
                frame[y0, x0] = colour
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy
    return frame


WALL = 3
SOIL = 10
SPINE_COLOUR = 5
GOAL = SPINE_COLOUR
PLAYER = 15
PIP_ON = 11
PIP_OFF = PLAYER
AGE_COLOURS = (11, 8, 5)

N = 16
CELL = 4
SPINE = 7
DEAD_COL = 15

SPREAD_PERIOD = 3
LIFESPAN = 9

BLOOM_FRAMES = 6
WITHER_FRAMES = 6
THREAD_FRAMES = 3

FITTING_HOLD = 5
FITTINGS_PER_LEVEL = 3

LEDGER_LEFT = SPINE * CELL
LEDGER_TOP = 18
LEDGER_GAP = 9
LEDGER_MIN = 2

ROCK_CH = "#"
SOIL_CH = "."
GOAL_CH = "t"
START_CH = "P"
SOWABLE_CHARS = SOIL_CH + START_CH
GROWABLE_CHARS = SOIL_CH + START_CH + GOAL_CH

DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))

LEVELS_SPEC = [
    {"seeds": 1, "rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "#P...#####.t..##",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"seeds": 2, "rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "#P.....#t....t##",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"seeds": 1, "rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "#P.########t..##",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"seeds": 1, "rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "#P.#######t...##",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"seeds": 2, "rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "#.....###.....##",
        "#P#...###t..t.##",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"seeds": 2, "rows": [
        "################",
        "################",
        "################",
        "#P#########t..##",
        "#.###########.##",
        "#.###########.##",
        "#.###########.##",
        "#....#####t...##",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"seeds": 3, "rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "#.###########t##",
        "#.##############",
        "#P.########t..##",
        "#.##############",
        "#.##########t.##",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
]

for _spec in LEVELS_SPEC:
    assert len(_spec["rows"]) == N and all(len(r) == N for r in _spec["rows"])
    for _y, _row in enumerate(_spec["rows"]):
        assert _row[SPINE] == ROCK_CH and _row[DEAD_COL] == ROCK_CH
        assert GOAL_CH not in _row[:SPINE], "goals live only right of the spine"
        assert START_CH not in _row[SPINE:], "the player lives only left of the spine"


def mirror_x(x):
    return 2 * SPINE - x


def find_char(rows, ch):
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == ch:
                return x, y
    raise AssertionError(f"level has no {ch}")


def goals(rows):
    return frozenset((x, y) for y, r in enumerate(rows)
                     for x, c in enumerate(r) if c == GOAL_CH)


def start_state(spec):
    px, py = find_char(spec["rows"], START_CH)
    return (px, py, {}, spec["seeds"])


def can_walk(rows, x, y):
    if not (0 <= x < SPINE and 0 <= y < N):
        return False
    return rows[y][x] != ROCK_CH


def can_sow(rows, plants, seeds, x, y):
    if seeds <= 0 or not (0 <= x < SPINE and 0 <= y < N):
        return False
    return rows[y][x] in SOWABLE_CHARS and (x, y) not in plants


def sow(rows, plants, x, y):
    plants[(x, y)] = 0
    mx = mirror_x(x)
    if 0 <= mx < N and rows[y][mx] in GROWABLE_CHARS and (mx, y) not in plants:
        plants[(mx, y)] = 0


def world_tick(rows, plants):
    aged = {pos: age + 1 for pos, age in plants.items()}
    births = {}
    for (x, y), age in aged.items():
        if age % SPREAD_PERIOD or age >= LIFESPAN:
            continue
        for dx, dy in DIRS:
            nx, ny = x + dx, y + dy
            if not (0 <= nx < N and 0 <= ny < N):
                continue
            if rows[ny][nx] not in GROWABLE_CHARS:
                continue
            if (nx, ny) in aged or (nx, ny) in births:
                continue
            births[(nx, ny)] = 0
    survivors = {pos: age for pos, age in aged.items() if age < LIFESPAN}
    survivors.update(births)
    return survivors


def step_state(rows, state, action):
    px, py, plants, seeds = state
    plants = dict(plants)

    if action == "S":
        if can_sow(rows, plants, seeds, px, py):
            sow(rows, plants, px, py)
            seeds -= 1
    elif action in "UDLR":
        dx, dy = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0)}[action]
        nx, ny = px + dx, py + dy
        if can_walk(rows, nx, ny):
            if (nx, ny) in plants:
                del plants[(nx, ny)]
                plants.pop((mirror_x(nx), ny), None)
            px, py = nx, ny

    plants = world_tick(rows, plants)

    if goals(rows) <= set(plants):
        return (px, py, plants, seeds), "goal"
    if seeds <= 0 and not plants:
        return (px, py, plants, seeds), "stuck"
    return (px, py, plants, seeds), "ok"


def _paste(under, over):
    out = [row[:] for row in under]
    for y in range(CELL):
        for x in range(CELL):
            if over[y][x] >= 0:
                out[y][x] = over[y][x]
    return out


def _stone_face(x, y):
    px = [[WALL] * CELL for _ in range(CELL)]
    joint = (y % 2) * 2
    for j in range(CELL - 1):
        px[j][joint] = SPINE_COLOUR
    px[CELL - 1] = [SPINE_COLOUR] * CELL
    return px


def _spine_face(x, y):
    return [[SPINE_COLOUR] * CELL for _ in range(CELL)]


def _fitting_face(x, y, pulse):
    return _paste(_stone_face(x, y),
                  fixture((PIP_ON, AGE_COLOURS[1]), pulse // FITTING_HOLD, x + y))


def _floor_face(x, y):
    px = [[SOIL] * CELL for _ in range(CELL)]
    return _paste(px, speckle(WALL, x + y)) if (x * 2 + y) % 3 == 0 else px


def _plant_face(age):
    band = min(age // SPREAD_PERIOD, len(AGE_COLOURS) - 1)
    colour = AGE_COLOURS[band]
    if band == 0:
        return core(colour)
    if band == 1:
        return rounded(colour)
    return weave(colour)


def _goal_face(age, lit=False):
    px = ring(GOAL)
    for j, i in ((0, 0), (0, CELL - 1), (CELL - 1, 0), (CELL - 1, CELL - 1)):
        px[j][i] = -1
    if age is None:
        return px
    colour = AGE_COLOURS[min(age // SPREAD_PERIOD, len(AGE_COLOURS) - 1)]
    if lit:
        return [[colour] * CELL for _ in range(CELL)]
    return _paste(px, core(colour))


def _player_face(seeded, hollow=False):
    if hollow:
        return ring(PLAYER)
    return figure(PLAYER, PIP_ON if seeded else None)


def _fitting_cells(rows):
    facing_soil = [
        (x, y)
        for y in range(N) for x in range(1, DEAD_COL)
        if rows[y][x] == ROCK_CH and x != SPINE
        and any(0 <= x + dx < N and 0 <= y + dy < N and rows[y + dy][x + dx] != ROCK_CH
                for dx, dy in DIRS)
    ]
    if not facing_soil:
        return ()
    stride = max(1, len(facing_soil) // FITTINGS_PER_LEVEL)
    return tuple(facing_soil[::stride])[:FITTINGS_PER_LEVEL]


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                if ch == ROCK_CH:
                    face = _spine_face(x, y) if x == SPINE else _stone_face(x, y)
                elif ch == GOAL_CH:
                    face = _goal_face(None)
                else:
                    face = _floor_face(x, y)
                sprites.append(Sprite(
                    pixels=face, name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=-1,
                ).set_position(x * CELL, y * CELL))
        sx, sy = find_char(spec["rows"], START_CH)
        sprites.append(Sprite(
            pixels=_player_face(True), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=1,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G032A(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        total = LEVELS_SPEC[self._game.level_index]["seeds"]
        left = self._game.seeds
        for i in range(total):
            top = LEDGER_TOP + i * LEDGER_GAP
            length = min(LEDGER_MIN + i, CELL)
            if top + 2 > frame.shape[0] or LEDGER_LEFT + length > frame.shape[1]:
                break
            frame[top:top + 2, LEDGER_LEFT:LEDGER_LEFT + length] = (
                PIP_ON if i < left else PIP_OFF)

        pair = self._game.thread_pair
        if pair is not None:
            (ax, ay), (bx, by) = pair
            hairline(frame, (ax * CELL + CELL // 2, ay * CELL + CELL // 2),
                     (bx * CELL + CELL // 2, by * CELL + CELL // 2), PIP_ON,
                     only_over={SOIL, WALL, SPINE_COLOUR})
        return frame


class G032(ARCBaseGame):

    def __init__(self):
        self.rows = LEVELS_SPEC[0]["rows"]
        self.px, self.py, self.plants, self.seeds = start_state(LEVELS_SPEC[0])
        self._pulse = 0
        self._anim = 0
        self._pending = None
        self._thread = 0
        self._thread_pair = None
        self._cells = {}
        self._fittings = ()
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=SOIL, letter_box=SPINE_COLOUR,
            interfaces=[G032A(self)],
        )
        super().__init__(game_id="g032", levels=build_levels(), camera=camera)

    def on_set_level(self, level):
        spec = LEVELS_SPEC[self.level_index]
        self.rows = spec["rows"]
        self.px, self.py, self.plants, self.seeds = start_state(spec)
        self._anim = 0
        self._pending = None
        self._thread = 0
        self._thread_pair = None
        self._fittings = _fitting_cells(self.rows)
        self._cells = {}
        for sprite in level.get_sprites():
            if sprite.name.startswith("cell_"):
                _, sx, sy = sprite.name.split("_")
                self._cells[(int(sx), int(sy))] = sprite
        self._repaint()

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)

    @property
    def state_tuple(self):
        return (self.px, self.py, self.plants, self.seeds)

    @property
    def thread_pair(self):
        return self._thread_pair if self._thread else None

    def _repaint(self):
        lit = self._pending == "goal" and self._anim % 2 == 1
        for y, row in enumerate(self.rows):
            for x, ch in enumerate(row):
                sprite = self._cells.get((x, y))
                if sprite is None:
                    continue
                if ch == ROCK_CH:
                    if (x, y) in self._fittings:
                        sprite.pixels = np.array(_fitting_face(x, y, self._pulse))
                    continue
                age = self.plants.get((x, y))
                if ch == GOAL_CH:
                    face = _goal_face(age, lit)
                elif age is None:
                    face = _floor_face(x, y)
                else:
                    face = _plant_face(age)
                sprite.pixels = np.array(face)
        for player in self._current_players():
            player.pixels = np.array(_player_face(
                self.seeds > 0,
                hollow=self._pending == "stuck" and self._anim % 2 == 1))
            player.set_position(self.px * CELL, self.py * CELL)

    def _current_players(self):
        return self.current_level.get_sprites_by_name("player")

    def step(self):
        self._pulse += 1

        if self._anim:
            self._anim -= 1
            if self._thread:
                self._thread -= 1
            self._repaint()
            if self._anim == 0:
                pending, self._pending = self._pending, None
                if pending == "stuck":
                    self.level_reset()
                elif pending == "goal":
                    self.next_level()
                self.complete_action()
            return

        action = None
        if self.action.id == GameAction.ACTION1:
            action = "U"
        elif self.action.id == GameAction.ACTION2:
            action = "D"
        elif self.action.id == GameAction.ACTION3:
            action = "L"
        elif self.action.id == GameAction.ACTION4:
            action = "R"
        elif self.action.id == GameAction.ACTION5:
            action = "S"

        if action is None:
            self._repaint()
            self.complete_action()
            return

        had = self.seeds
        state, outcome = step_state(self.rows, self.state_tuple, action)
        self.px, self.py, self.plants, self.seeds = state
        if self.seeds < had:
            self._thread = THREAD_FRAMES
            self._thread_pair = ((self.px, self.py), (SPINE, self.py))
        self._repaint()

        if outcome == "stuck":
            self._pending, self._anim = "stuck", WITHER_FRAMES
            return
        if outcome == "goal":
            self._pending, self._anim = "goal", BLOOM_FRAMES
            return
        if self._thread:
            self._anim = THREAD_FRAMES
            return

        self.complete_action()
