# ARC-AGI-3 candidate task g178.

import numpy as np

from sprite_book import blink, core, figure, medallion, ring, rounded, speckle, studs

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

FLOOR = 6
WALL = 2
WALL_FLECK = 5
WIRE = 9
JUNCTION = 5
MARKER = 11
PIP = 14
SINK_RIM = JUNCTION
SINK_FILL = 11
SINK_PART_FILL = 12
EMITTER = 11
EMITTER_CORE = 5
PULSE = 11
PLAYER = 14
PLAYER_MARK = 5
METER_ON = 11
METER_OFF = 5

DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))

CONDUCT = set("=JSTE")

LEVELS_SPEC = [
    {"pips": [0], "fires": 2, "rows": [
        "################",
        "################",
        "################",
        "################",
        "###..........###",
        "###....S.....###",
        "###....=.....###",
        "###..E=J.....###",
        "###....=.....###",
        "###....S.....###",
        "###..........###",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"pips": [1], "fires": 2, "rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "###......T...###",
        "###......=...###",
        "###......=...###",
        "###......=...###",
        "###.E====J...###",
        "###......=...###",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"pips": [1, 0], "fires": 3, "rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "##.....S......##",
        "##.....=......##",
        "##.E===J==J==S##",
        "##........=...##",
        "##........S...##",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"pips": [1, 0], "fires": 5, "rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "##....T....T..##",
        "##....=....=..##",
        "##....=....=..##",
        "##....=....=..##",
        "##....=....=..##",
        "##.E==J====J=S##",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"pips": [1, 2, 0], "fires": 7, "rows": [
        "################",
        "################",
        "################",
        "################",
        "#..........T..##",
        "#..........=..##",
        "#......S...=..##",
        "#......=...=..##",
        "#..T...=...=..##",
        "#..=...=...=..##",
        "#E=J===J===J=S##",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"pips": [1, 2, 2, 0], "fires": 11, "rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "#E=J==J==J==J=S#",
        "#..=..=..=..=..#",
        "#..=..=..=..=..#",
        "#..S..T..S..T..#",
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


def fire_pulse(rows, settings, trail=None):
    junctions = cells_of(rows, "J")
    settings = list(settings)
    cur = find_char(rows, "E")
    prev = None
    for _ in range(PULSE_LIMIT):
        if trail is not None:
            trail.append((cur, tuple(settings)))
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


def apply_fire(rows, state, trail=None):
    settings, hits, pips, fires = state
    if fires <= 0:
        return None
    sink, settings = fire_pulse(rows, settings, trail)
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


def _stamp(frame, px, x, y):
    for j, row in enumerate(px):
        for i, v in enumerate(row):
            if v >= 0:
                frame[y * CELL + j, x * CELL + i] = v
    return frame


def _wall_px(rows, x, y):
    px = [[WALL] * CELL for _ in range(CELL)]
    facing_room = any(0 <= x + dx < N and 0 <= y + dy < N and rows[y + dy][x + dx] != "#"
                      for dx, dy in DIRS)
    if facing_room:
        for j, row in enumerate(speckle(WALL_FLECK, (x * 5 + y * 3) % 7, CELL)):
            for i, v in enumerate(row):
                if v >= 0:
                    px[j][i] = v
    return px


def _wire_px(rows, x, y):
    px = [[-1] * CELL for _ in range(CELL)]
    if conducts(rows, x - 1, y) or conducts(rows, x + 1, y):
        for i in range(CELL):
            px[1][i] = px[2][i] = WIRE
    if conducts(rows, x, y - 1) or conducts(rows, x, y + 1):
        for j in range(CELL):
            px[j][1] = px[j][2] = WIRE
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
                    px = _wall_px(rows, x, y)
                elif c == "=":
                    px = _wire_px(rows, x, y)
                elif c == "E":
                    px = medallion(EMITTER, EMITTER_CORE, CELL)
                else:
                    continue
                sprites.append(Sprite(
                    pixels=[list(r) for r in px], name=f"cell_{x}_{y}",
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
        settings = g.shown_settings
        strobe = g.flash == 0 or blink(g.flash, 1)

        for i, (x, y) in enumerate(cells_of(rows, "ST")):
            need = NEED[rows[y][x]]
            done = g.hits[i] >= need
            if done and not (g.flash and g.flash_won and not strobe):
                _stamp(frame, ring(SINK_FILL, CELL), x, y)
                _stamp(frame, core(SINK_FILL, CELL), x, y)
            else:
                _stamp(frame, ring(SINK_RIM, CELL), x, y)
                if not done and g.hits[i] > 0:
                    frame[y * CELL + CELL - 2,
                          x * CELL + 1:x * CELL + CELL - 1] = SINK_PART_FILL

        for i, (x, y) in enumerate(cells_of(rows, "J")):
            _stamp(frame, rounded(JUNCTION, CELL), x, y)
            arms = junction_arms(rows, (x, y), g.entry_of(i))
            if len(arms) == 2:
                ax, ay = arms[settings[i] % 2]
                dx, dy = ax - x, ay - y
                sy = y * CELL + (0 if dy < 0 else CELL - 2 if dy > 0 else 1)
                sx = x * CELL + (0 if dx < 0 else CELL - 2 if dx > 0 else 1)
                frame[sy:sy + 2, sx:sx + 2] = MARKER

        if g.flash and not g.flash_won and not strobe:
            ex, ey = find_char(rows, "E")
            _stamp(frame, ring(SINK_RIM, CELL), ex, ey)
            _stamp(frame, core(SINK_RIM, CELL), ex, ey)

        head = g.pulse_head
        if head is not None:
            _stamp(frame, core(PULSE, CELL), head[0], head[1])

        px, py = g.player
        _stamp(frame, figure(PLAYER, PLAYER_MARK, CELL), px, py)

        for i, (x, y) in enumerate(cells_of(rows, "J")):
            for p in range(g.pips[i]):
                frame[y * CELL + (0 if p == 0 else CELL - 1), x * CELL] = PIP

        lit = 0 if (g.flash and not g.flash_won and not strobe) else g.fires
        budget = g.spec["fires"]
        gap = max(3, (N * CELL - 10) // max(budget, 1))
        studs(frame, budget, lit, METER_ON, METER_OFF, side="east", start=4, gap=gap)
        return frame


class G178(ARCBaseGame):

    SETTLE_FRAMES = 6

    def __init__(self) -> None:
        self.settings = ()
        self.hits = ()
        self.pips = ()
        self.fires = 0
        self.player = (0, 0)
        self._trail = ()
        self._pending = None
        self._step = 0
        self.flash = 0
        self.flash_won = False
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

    @property
    def shown_settings(self):
        if self._trail:
            return self._trail[min(self._step, len(self._trail) - 1)][1]
        return self.settings

    @property
    def pulse_head(self):
        if self._trail:
            return self._trail[min(self._step, len(self._trail) - 1)][0]
        return None

    def entry_of(self, idx):
        junctions = cells_of(self.rows, "J")
        x, y = junctions[idx]
        return (x - 1, y)

    def on_set_level(self, level: Level) -> None:
        (self.settings, self.hits, self.pips,
         self.fires) = start_state(self.rows, self.spec["pips"], self.spec["fires"])
        self.player = find_char(self.rows, "E")
        self._trail = ()
        self._pending = None
        self._step = 0
        self.flash = 0
        self.flash_won = False

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _resolve(self) -> None:
        if latched(self.rows, self.hits):
            self.flash, self.flash_won = self.SETTLE_FRAMES, True
        elif self.fires <= 0:
            self.flash, self.flash_won = self.SETTLE_FRAMES, False
        else:
            self.complete_action()

    def step(self) -> None:
        if self.flash:
            self.flash -= 1
            if self.flash == 0:
                won = self.flash_won
                if won:
                    self.next_level()
                else:
                    self.level_reset()
                self.complete_action()
            return

        if self._trail:
            self._step += 1
            if self._step < len(self._trail):
                return
            self.settings, self.hits, self.pips, self.fires = self._pending
            self._trail, self._pending, self._step = (), None, 0
            self._resolve()
            return

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
                trail = []
                nxt = apply_fire(self.rows, state, trail)
                if nxt is not None and trail:
                    self._pending, self._trail, self._step = nxt, tuple(trail), 0
                    return
            elif here == "J":
                idx = cells_of(self.rows, "J").index(self.player)
                nxt = apply_flip(self.rows, state, idx)
            if nxt is not None:
                self.settings, self.hits, self.pips, self.fires = nxt
            self._resolve()
            return
        self.complete_action()
