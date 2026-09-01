# ARC-AGI-3 candidate task t61abcaed.

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
SOIL = 4
SPINE_COLOUR = 6
GOAL = 15
PLAYER = 9
PIP_ON = 10
PIP_OFF = 3
AGE_COLOURS = (14, 11, 12)

N = 16
CELL = 4
SPINE = 7
DEAD_COL = 15

SPREAD_PERIOD = 3
LIFESPAN = 9

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


def _cell_block(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _goal_block(colour):
    block = [[GOAL] * CELL for _ in range(CELL)]
    if colour is not None:
        for i in (1, 2):
            for j in (1, 2):
                block[i][j] = colour
    return block


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        sprites = []
        for y, row in enumerate(spec["rows"]):
            for x, ch in enumerate(row):
                if ch == ROCK_CH:
                    colour = SPINE_COLOUR if x == SPINE else WALL
                elif ch == GOAL_CH:
                    colour = GOAL
                else:
                    colour = SOIL
                sprites.append(Sprite(
                    pixels=_cell_block(colour), name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=-1,
                ).set_position(x * CELL, y * CELL))
        sx, sy = find_char(spec["rows"], START_CH)
        sprites.append(Sprite(
            pixels=_cell_block(PLAYER), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=1,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G849e9749(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        total = LEVELS_SPEC[self._game.level_index]["seeds"]
        left = self._game.seeds
        for i in range(total):
            x = 1 + i * 3
            if x + 2 > frame.shape[1]:
                break
            frame[1:3, x:x + 2] = PIP_ON if i < left else PIP_OFF
        return frame


class G002751ba(ARCBaseGame):

    def __init__(self):
        self.rows = LEVELS_SPEC[0]["rows"]
        self.px, self.py, self.plants, self.seeds = start_state(LEVELS_SPEC[0])
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=SOIL, letter_box=5,
            interfaces=[G849e9749(self)],
        )
        super().__init__(game_id="t61abcaed", levels=build_levels(), camera=camera)

    def on_set_level(self, level):
        spec = LEVELS_SPEC[self.level_index]
        self.rows = spec["rows"]
        self.px, self.py, self.plants, self.seeds = start_state(spec)
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

    def _repaint(self):
        level = self.current_level
        for y, row in enumerate(self.rows):
            for x, ch in enumerate(row):
                if ch == ROCK_CH:
                    continue
                found = level.get_sprites_by_name(f"cell_{x}_{y}")
                if not found:
                    continue
                age = self.plants.get((x, y))
                band = None if age is None else AGE_COLOURS[
                    min(age // SPREAD_PERIOD, len(AGE_COLOURS) - 1)]
                if ch == GOAL_CH:
                    block = _goal_block(band)
                else:
                    block = _cell_block(SOIL if band is None else band)
                found[0].pixels = np.array(block)
        player = level.get_sprites_by_name("player")
        if player:
            player[0].set_position(self.px * CELL, self.py * CELL)

    def step(self):
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
            self.complete_action()
            return

        state, outcome = step_state(self.rows, self.state_tuple, action)
        self.px, self.py, self.plants, self.seeds = state
        self._repaint()

        if outcome == "stuck":
            self.level_reset()
        elif outcome == "goal":
            self.next_level()

        self.complete_action()
