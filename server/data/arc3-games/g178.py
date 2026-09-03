# ARC-AGI-3 candidate task g178.

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
WIRE = 9
JUNCTION = 15
MARKER = 11
PIP = 0
SINK_DARK = 13
SINK_LIT = 14
EMITTER = 12
PLAYER = 10

DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))

CONDUCT = set("=JSTE")

LEVELS_SPEC = [
    {"pips": [0], "fires": 2, "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.....S........#",
        "#.....=........#",
        "#.....=........#",
        "#.E===J........#",
        "#.....=........#",
        "#.....=........#",
        "#.....S........#",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"pips": [1], "fires": 2, "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.....T........#",
        "#.....=........#",
        "#.....=........#",
        "#.E===J........#",
        "#.....=........#",
        "#.....=........#",
        "#.....=........#",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"pips": [1, 0], "fires": 3, "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.....S..S.....#",
        "#.....=..=.....#",
        "#.....=..=.....#",
        "#.E===J==J==S..#",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"pips": [1, 0], "fires": 5, "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.....T..T.....#",
        "#.....=..=.....#",
        "#.....=..=.....#",
        "#.E===J==J==S..#",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"pips": [2, 0, 0], "fires": 6, "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#....T..T..S...#",
        "#....=..=..=...#",
        "#....=..=..=...#",
        "#E===J==J==J==S#",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"pips": [0, 2, 0], "fires": 8, "rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#....T..S..T...#",
        "#....=..=..=...#",
        "#....=..=..=...#",
        "#E===J==J==J==S#",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 4
NEED = {"S": 1, "T": 2}
PULSE_LIMIT = N * N


def find_char(rows, ch):
    for y, row in enumerate(rows):
        x = row.find(ch)
        if x >= 0:
            return x, y
    return None


def cells_of(rows, chars):
    return [(x, y) for y in range(N) for x in range(N) if rows[y][x] in chars]


def conducts(rows, x, y):
    return 0 <= x < N and 0 <= y < N and rows[y][x] in CONDUCT


def neighbours(rows, cell):
    x, y = cell
    return [(x + dx, y + dy) for dx, dy in DIRS if conducts(rows, x + dx, y + dy)]


def junction_arms(rows, cell, came_from):
    return [n for n in neighbours(rows, cell) if n != came_from]


def fire_pulse(rows, settings):
    junctions = cells_of(rows, "J")
    settings = list(settings)
    cur = find_char(rows, "E")
    prev = None
    for _ in range(PULSE_LIMIT):
        glyph = rows[cur[1]][cur[0]]
        if glyph in NEED:
            return cur, tuple(settings)
        if glyph == "J":
            idx = junctions.index(cur)
            arms = junction_arms(rows, cur, prev)
            if len(arms) != 2:
                return None, tuple(settings)
            nxt = arms[settings[idx] % len(arms)]
            settings[idx] ^= 1
        else:
            onward = [n for n in neighbours(rows, cur) if n != prev]
            if len(onward) != 1:
                return None, tuple(settings)
            nxt = onward[0]
        prev, cur = cur, nxt
    return None, tuple(settings)


def start_state(rows, pips, fires):
    return (tuple(0 for _ in cells_of(rows, "J")),
            tuple(0 for _ in cells_of(rows, "ST")),
            tuple(pips), fires)


def latched(rows, hits):
    return all(h >= NEED[rows[c[1]][c[0]]]
               for c, h in zip(cells_of(rows, "ST"), hits))


def apply_fire(rows, state):
    settings, hits, pips, fires = state
    if fires <= 0:
        return None
    sink, settings = fire_pulse(rows, settings)
    hits = list(hits)
    if sink is not None:
        i = cells_of(rows, "ST").index(sink)
        hits[i] = min(hits[i] + 1, NEED[rows[sink[1]][sink[0]]])
    return (settings, tuple(hits), pips, fires - 1)


def apply_flip(rows, state, idx):
    settings, hits, pips, fires = state
    if pips[idx] <= 0:
        return None
    settings, pips = list(settings), list(pips)
    settings[idx] ^= 1
    pips[idx] -= 1
    return (tuple(settings), hits, tuple(pips), fires)


def _block(colour):
    return [[colour] * CELL for _ in range(CELL)]


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for y in range(N):
            for x in range(N):
                c = rows[y][x]
                colour = {"#": WALL, "=": WIRE, "E": EMITTER}.get(c)
                if colour is None:
                    continue
                sprites.append(Sprite(
                    pixels=_block(colour), name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0, collidable=False,
                ).set_position(x * CELL, y * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G178A(RenderableUserDisplay):

    def __init__(self, game: "G178") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game
        rows = g.rows

        for i, (x, y) in enumerate(cells_of(rows, "ST")):
            need = NEED[rows[y][x]]
            done = g.hits[i] >= need
            frame[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = \
                SINK_LIT if done else SINK_DARK
            if not done and g.hits[i] > 0:
                frame[y * CELL + 1:y * CELL + 3, x * CELL + 1:x * CELL + 3] = SINK_LIT

        for i, (x, y) in enumerate(cells_of(rows, "J")):
            frame[y * CELL:(y + 1) * CELL, x * CELL:(x + 1) * CELL] = JUNCTION
            arms = junction_arms(rows, (x, y), g.entry_of(i))
            if len(arms) == 2:
                ax, ay = arms[g.settings[i] % 2]
                dx, dy = ax - x, ay - y
                sy = y * CELL + (0 if dy < 0 else CELL - 2 if dy > 0 else 1)
                sx = x * CELL + (0 if dx < 0 else CELL - 2 if dx > 0 else 1)
                frame[sy:sy + 2, sx:sx + 2] = MARKER
            for p in range(g.pips[i]):
                frame[y * CELL + CELL - 1, x * CELL + p] = PIP

        for i in range(g.spec["fires"]):
            x = 1 + i % (N - 2)
            frame[1:3, x * CELL + 1:x * CELL + 3] = EMITTER if i < g.fires else WALL

        px, py = g.player
        frame[py * CELL + 1:py * CELL + 3, px * CELL + 1:px * CELL + 3] = PLAYER
        return frame


class G178(ARCBaseGame):

    def __init__(self) -> None:
        self.settings = ()
        self.hits = ()
        self.pips = ()
        self.fires = 0
        self.player = (0, 0)
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G178A(self)],
        )
        super().__init__(game_id="g178", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])
        self.on_set_level(self.current_level)

    @property
    def spec(self):
        return LEVELS_SPEC[self.level_index]

    @property
    def rows(self):
        return self.spec["rows"]

    def entry_of(self, idx):
        junctions = cells_of(self.rows, "J")
        x, y = junctions[idx]
        return (x - 1, y)

    def on_set_level(self, level: Level) -> None:
        (self.settings, self.hits, self.pips,
         self.fires) = start_state(self.rows, self.spec["pips"], self.spec["fires"])
        self.player = find_char(self.rows, "E")

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def step(self) -> None:
        move = {GameAction.ACTION1: (0, -1), GameAction.ACTION2: (0, 1),
                GameAction.ACTION3: (-1, 0), GameAction.ACTION4: (1, 0)}.get(
                    self.action.id)
        if move is not None:
            nx, ny = self.player[0] + move[0], self.player[1] + move[1]
            if 0 <= nx < N and 0 <= ny < N and self.rows[ny][nx] != "#":
                self.player = (nx, ny)
        elif self.action.id == GameAction.ACTION5:
            state = (self.settings, self.hits, self.pips, self.fires)
            here = self.rows[self.player[1]][self.player[0]]
            nxt = None
            if here == "E":
                nxt = apply_fire(self.rows, state)
            elif here == "J":
                idx = cells_of(self.rows, "J").index(self.player)
                nxt = apply_flip(self.rows, state, idx)
            if nxt is not None:
                self.settings, self.hits, self.pips, self.fires = nxt
            if not latched(self.rows, self.hits) and self.fires <= 0:
                self.level_reset()
            elif latched(self.rows, self.hits):
                self.next_level()
        self.complete_action()
