# ARC-AGI-3 candidate task g178.

import numpy as np

from collections import deque


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

def speckle(colour: int, seed: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(cell):
        for x in range(cell):
            if (x * 7 + y * 13 + seed * 31) % 5 == 0:
                px[y][x] = colour
    return px

def studs(frame, count: int, filled: int, on: int, off: int, side: str = "east",
          start: int = 8, gap: int = 6):
    h, w = frame.shape
    for i in range(count):
        top = start + i * gap
        if top + 2 > h:
            break
        colour = on if i < filled else off
        length = min(1 + i, w // 4)
        if side == "east":
            frame[top:top + 2, w - length:w] = colour
        else:
            frame[top:top + 2, 0:length] = colour
    return frame

def blink(step: int, period: int = 3) -> bool:
    return (step // period) % 2 == 0


FLOOR = 5
WALL = 5
WALL_FLECK = 5
WIRE = 9
JUNCTION = 3
MARKER = 11
PIP = 14
SINK_RIM = 1
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

CONDUCT = set("=JSTUE")

LEVELS_SPEC = [{'pips': [0],
  'fires': 2,
  'rows': ['..........',
           '...S......',
           '...=......',
           '...=......',
           '...=......',
           'E==J......',
           '...=......',
           '...=......',
           '...=......',
           '...S......']},
 {'pips': [1],
  'fires': 2,
  'rows': ['...T......',
           '...=......',
           '...=......',
           '...=......',
           '...=......',
           'E==J......',
           '...=......',
           '...=......',
           '...=......',
           '...=......']},
 {'pips': [1, 0],
  'fires': 5,
  'rows': ['..S.......',
           '..=.......',
           '..=.......',
           '..=.......',
           'E=J===J==S',
           '......=...',
           '......=...',
           '......=...',
           '......T...',
           '..........']},
 {'pips': [1, 0],
  'fires': 5,
  'rows': ['..........',
           '..T.......',
           '..=.......',
           '..=...T...',
           '..=...=...',
           '..=...=...',
           '..=...=...',
           '..=...=...',
           'E=J===J==S',
           '..........']},
 {'pips': [2, 1, 0],
  'fires': 8,
  'rows': ['........T.',
           '........=.',
           '........=.',
           '.....T..=.',
           '.....=..=.',
           '..S..=..=.',
           '..=..=..=.',
           '..=..=..=.',
           'E=J==J==JS',
           '..........']},
 {'pips': [2, 2, 2, 0],
  'fires': 10,
  'rows': ['..........',
           'E=J=J=J=JS',
           '..=.=.=.=.',
           '..=.=.=.=.',
           '..=.=.=.=.',
           '..S.=.S.=.',
           '....=...=.',
           '....T...=.',
           '........=.',
           '........T.']},
 {'rows': ['..........',
           '..........',
           'U=J==U....',
           '..=...S...',
           '..=...=...',
           'E=J===J...',
           '......=...',
           '......=...',
           '...U==J==U',
           '..........'],
  'pips': [0, 2, 2, 0],
  'fires': 18}]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 6
NEED = {"S": 1, "T": 2, "U": 3}
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
            tuple(0 for _ in cells_of(rows, "STU")),
            tuple(pips), fires)


def latched(rows, hits):
    return all(h >= NEED[rows[c[1]][c[0]]]
               for c, h in zip(cells_of(rows, "STU"), hits))


def apply_fire(rows, state, trail=None):
    settings, hits, pips, fires = state
    if fires <= 0:
        return None
    sink, settings = fire_pulse(rows, settings, trail)
    hits = list(hits)
    if sink is not None:
        i = cells_of(rows, "STU").index(sink)
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


PAD = 2

def junction_entry(rows, cell):
    queue = deque([(find_char(rows, 'E'), None)])
    seen = set()
    while queue:
        cur, prev = queue.popleft()
        if cur == cell:
            return prev
        if cur in seen:
            continue
        seen.add(cur)
        queue.extend((n, cur) for n in neighbours(rows, cur) if n not in seen)
    return None

def ball(colour, center=None):
    px = rounded(colour, CELL)
    px[1][2] = 0
    px[4][2:4] = [3, 3]
    if center is not None:
        px[2][2:4] = [center, center]
        px[3][2:4] = [center, center]
    return px

def _stamp(frame, px, x, y):
    for j, row in enumerate(px):
        for i, v in enumerate(row):
            if v >= 0:
                frame[PAD + y * CELL + j, PAD + x * CELL + i] = v
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
    if conducts(rows, x-1, y) or conducts(rows, x+1, y):
        px[2] = [3]*CELL
        px[3] = [WIRE]*CELL
    if conducts(rows, x, y-1) or conducts(rows, x, y+1):
        for row in px:
            row[2], row[3] = 3, WIRE
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
                    px = ball(EMITTER, EMITTER_CORE)
                else:
                    continue
                sprites.append(Sprite(
                    pixels=[list(r) for r in px], name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0, collidable=False,
                ).set_position(x * CELL, y * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class Overlay(RenderableUserDisplay):

    def __init__(self, game: "Turnout") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        g = self._game
        for i, cell in enumerate(cells_of(g.rows, 'STU')):
            need = NEED[g.rows[cell[1]][cell[0]]]
            colour = SINK_FILL if g.hits[i] >= need else SINK_RIM
            _stamp(frame, ball(colour, 5), *cell)
            for k in range(need):
                frame[PAD + cell[1]*CELL+3, PAD + cell[0]*CELL+2+k] = SINK_FILL if g.hits[i]>k else 3
        for i, cell in enumerate(cells_of(g.rows, 'J')):
            x,y=cell
            _stamp(frame, ball(JUNCTION), x,y)
            arms = junction_arms(g.rows, cell, g.entry_of(i))
            ax,ay = arms[g.shown_settings[i] % 2]
            dx,dy=ax-x,ay-y
            for k in (1,2):
                frame[PAD+y*CELL+2+dy*k, PAD+x*CELL+2+dx*k] = MARKER
            for k in range(g.pips[i]):
                frame[PAD+y*CELL+5, PAD+x*CELL+1+k] = PIP
        if g.pulse_head is not None:
            _stamp(frame, ball(PULSE, 0), *g.pulse_head)
        for k in range(g.spec['fires']):
            x = 2 + 3*k
            frame[63, x:x+2] = METER_ON if k < g.fires else 3
        if g.flash and g.flash%2:
            frame[0, 2:62] = 14 if g.flash_won else 8
        return frame


class Turnout(ARCBaseGame):

    SETTLE_FRAMES = 6

    def __init__(self) -> None:
        self.settings = ()
        self.hits = ()
        self.pips = ()
        self.fires = 0

        self._trail = ()
        self._pending = None
        self._step = 0
        self.flash = 0
        self.flash_won = False
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[Overlay(self)],
        )
        super().__init__(game_id="g178", levels=build_levels(), camera=camera,
                         available_actions=[6])
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
        return junction_entry(self.rows, cells_of(self.rows, 'J')[idx])

    def on_set_level(self, level: Level) -> None:
        (self.settings, self.hits, self.pips,
         self.fires) = start_state(self.rows, self.spec["pips"], self.spec["fires"])

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

        if self.action.id == GameAction.ACTION6:
            point = self.camera.display_to_grid(self.action.data.get('x', -1), self.action.data.get('y', -1))
            if point is not None:
                x,y = point[0]//CELL, point[1]//CELL
                if 0 <= x < N and 0 <= y < N:
                    state = (self.settings, self.hits, self.pips, self.fires)
                    nxt = None
                    if self.rows[y][x] == 'E':
                        trail=[]
                        nxt=apply_fire(self.rows, state, trail)
                        if nxt is not None and trail:
                            self._pending,self._trail,self._step=nxt,tuple(trail),0
                            return
                    elif self.rows[y][x] == 'J':
                        nxt=apply_flip(self.rows, state, cells_of(self.rows,'J').index((x,y)))
                    if nxt is not None:
                        self.settings,self.hits,self.pips,self.fires=nxt
                        self._resolve()
                        return
        self.complete_action()
