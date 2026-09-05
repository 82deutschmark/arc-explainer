# ARC-AGI-3 candidate task g019.

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

def ring(colour: int, cell: int = 4) -> list[list[int]]:
    px = block(colour, cell)
    for y in range(1, cell - 1):
        for x in range(1, cell - 1):
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

def fixture(colours: tuple, phase: int, seed: int = 0, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[1][1] = px[cell - 2][cell - 2] = colours[(phase + seed) % len(colours)]
    return px


FLOOR = 2
WALL = 5
TRACK = 5
BELL = 11
PLATE_OFF = 15
PLATE_ON = 11
GUARD = 6
GUARD_CORE = 5
PLAYER = 12
PLAYER_MARK = 5
EXIT_SHUT = 5
EXIT_BAR = 15
EXIT_OPEN = 11
PIP_ON = 11
PIP_OFF = 15
DECOR = 2

N = 16
CELL = 4

GAUGE_TOP = 12
GAUGE_GAP = 15
GAUGE_HEIGHT = 4
GAUGE_BASE = 3

LEVELS_SPEC = [
    ["################",
     "################",
     "##============##",
     "##=.....P....=##",
     "##=..........=##",
     "##=..........=##",
     "##=..........b##",
     "##=........X.=##",
     "##=..........=##",
     "##=..........=##",
     "##=..........=##",
     "##=..........=##",
     "##b..........=##",
     "##====G====p==##",
     "################",
     "################"],
    ["################",
     "################",
     "##============##",
     "##=..........=##",
     "##=..........=##",
     "##=..........=##",
     "##=..........=##",
     "##=......P...=##",
     "##G..........=##",
     "##b..........=##",
     "##=..........=##",
     "##b..........=##",
     "##=......X...=##",
     "##=====pb=====##",
     "################",
     "################"],
    ["################",
     "################",
     "##==p=========##",
     "##=..........G##",
     "##=..........=##",
     "##=..........=##",
     "##=..........=##",
     "##b..........=##",
     "##=..........b##",
     "##=........X.=##",
     "##p..........=##",
     "##=..........=##",
     "##=........P.=##",
     "##G===========##",
     "################",
     "################"],
    ["################",
     "################",
     "################",
     "###===G====#####",
     "###=......p#####",
     "###=......=#####",
     "###b......=#####",
     "###=....X.=#####",
     "###=......G#####",
     "###=......=#####",
     "###b......=#####",
     "###=...P..b#####",
     "###===p====#####",
     "################",
     "################",
     "################"],
    ["################",
     "################",
     "##=b==========##",
     "##=X.........=##",
     "##=..........=##",
     "##=..........=##",
     "##=...P......=##",
     "##=..........G##",
     "##=..........=##",
     "##=..........=##",
     "##p..........=##",
     "##p..........=##",
     "##G..........=##",
     "##==b=p=====G=##",
     "################",
     "################"],
    ["################",
     "################",
     "################",
     "###pb==p=p=#####",
     "###=......=#####",
     "###=......=#####",
     "###=......=#####",
     "###=.....X=#####",
     "###=..P...b#####",
     "###=......=#####",
     "###=......G#####",
     "###=......=#####",
     "###G====G==#####",
     "################",
     "################",
     "################"],
    ["################",
     "################",
     "################",
     "###=====G==#####",
     "###=......=#####",
     "###=......=#####",
     "###=....X.=#####",
     "###b......=#####",
     "###p.....P=#####",
     "###p......b#####",
     "###p......=#####",
     "###=......=#####",
     "###=b===GG=#####",
     "################",
     "################",
     "################"],
]

DIRS = ((0, -1), (1, 0), (0, 1), (-1, 0))


_MODELS: dict[int, dict] = {}


def model(index: int) -> dict:
    if index in _MODELS:
        return _MODELS[index]
    rows = LEVELS_SPEC[index]
    track, floor, bells, plates, posts = set(), set(), [], [], []
    start = exit_cell = None
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "#":
                continue
            if ch in "=bpG":
                track.add((x, y))
            else:
                floor.add((x, y))
            if ch == "b":
                bells.append((x, y))
            elif ch == "p":
                plates.append((x, y))
            elif ch == "G":
                posts.append((x, y))
            elif ch == "P":
                start = (x, y)
            elif ch == "X":
                exit_cell = (x, y)
    if start is None or exit_cell is None:
        raise ValueError(f"level {index + 1} is missing a start or an exit")

    dist = []
    for b in bells:
        d = {b: 0}
        q = deque([b])
        while q:
            cx, cy = q.popleft()
            for dx, dy in DIRS:
                nb = (cx + dx, cy + dy)
                if nb in track and nb not in d:
                    d[nb] = d[(cx, cy)] + 1
                    q.append(nb)
        dist.append(d)

    m = {"rows": rows, "track": frozenset(track), "walk": frozenset(track | floor),
         "bells": tuple(bells), "plates": tuple(plates), "posts": tuple(posts),
         "start": start, "exit": exit_cell, "dist": tuple(dist)}
    _MODELS[index] = m
    return m


def guard_step(m: dict, cell: tuple[int, int], target: int) -> tuple[int, int]:
    d = m["dist"][target]
    here = d.get(cell)
    if here is None or here == 0:
        return cell
    for dx, dy in DIRS:
        nb = (cell[0] + dx, cell[1] + dy)
        if d.get(nb, 1 << 30) == here - 1:
            return nb
    return cell


MOVES = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
    GameAction.ACTION5: (0, 0),
}


def resolve(index, player, guards, target, move):
    m = model(index)
    nxt = (player[0] + move[0], player[1] + move[1])
    if nxt not in m["walk"]:
        nxt = player
    if nxt in m["bells"]:
        target = m["bells"].index(nxt)
    if target is not None:
        guards = tuple(guard_step(m, g, target) for g in guards)
    dead = any(abs(g[0] - nxt[0]) + abs(g[1] - nxt[1]) <= 1 for g in guards)
    on = set(guards)
    won = (not dead) and nxt == m["exit"] and all(p in on for p in m["plates"])
    return nxt, guards, target, dead, won


def _block(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _track_pixels() -> list[list[int]]:
    return weave(TRACK, CELL)


def _bell_pixels() -> list[list[int]]:
    return rounded(BELL, CELL)


def _plate_pixels(lit: bool) -> list[list[int]]:
    return ring(PLATE_ON if lit else PLATE_OFF, CELL)


def _guard_pixels() -> list[list[int]]:
    return medallion(GUARD, GUARD_CORE, CELL)


def _player_pixels() -> list[list[int]]:
    return figure(PLAYER, PLAYER_MARK, CELL)


def _caught_pixels(lit: bool) -> list[list[int]]:
    return figure(GUARD if lit else PLATE_OFF, PLAYER, CELL)


def _exit_pixels(live: bool) -> list[list[int]]:
    return door(EXIT_OPEN if live else EXIT_SHUT, None if live else EXIT_BAR, CELL)


def _ringing_pixels(lit: bool) -> list[list[int]]:
    return figure(EXIT_OPEN if lit else PLAYER, PLAYER_MARK, CELL)


DECOR_CYCLE = (WALL, DECOR, WALL, WALL, DECOR)
DECOR_CELLS = ((4, 0), (7, 1), (11, 0), (4, 15), (8, 14), (11, 15))


def _decor_pixels(phase: int, seed: int) -> list[list[int]]:
    return fixture(DECOR_CYCLE, phase, seed, CELL)


def _sprite(px, name, x, y, layer, tags=()):
    return Sprite(pixels=px, name=name, blocking=BlockingMode.NOT_BLOCKED,
                  interaction=InteractionMode.INTANGIBLE, layer=layer,
                  tags=list(tags)).set_position(x * CELL, y * CELL)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for index, rows in enumerate(LEVELS_SPEC):
        m = model(index)
        sprites: list[Sprite] = []
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == "#":
                    sprites.append(_sprite(_block(WALL), f"wall_{x}_{y}", x, y, -3))
                elif (x, y) in m["track"]:
                    sprites.append(_sprite(_track_pixels(), f"track_{x}_{y}", x, y, -2))
        for i, (x, y) in enumerate(DECOR_CELLS):
            sprites.append(_sprite(_decor_pixels(0, i), f"decor_{i}", x, y, -1,
                                   tags=("decor",)))
        for x, y in m["bells"]:
            sprites.append(_sprite(_bell_pixels(), f"bell_{x}_{y}", x, y, -1))
        for x, y in m["plates"]:
            sprites.append(_sprite(_plate_pixels(False), f"plate_{x}_{y}", x, y, 0))
        ex, ey = m["exit"]
        sprites.append(_sprite(_exit_pixels(False), "exit", ex, ey, 0))
        for i, (gx, gy) in enumerate(m["posts"]):
            sprites.append(_sprite(_guard_pixels(), f"guard_{i}", gx, gy, 2))
        sx, sy = m["start"]
        sprites.append(_sprite(_player_pixels(), "player", sx, sy, 3))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G019A(RenderableUserDisplay):

    def __init__(self, game: "G019") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        m = model(self._game.level_index)
        on = set(self._game.guards)
        beat = self._game.ringing and self._game.ringing % 2 == 0
        for i, plate in enumerate(m["plates"]):
            top = GAUGE_TOP + i * GAUGE_GAP
            length = GAUGE_BASE + 2 * i
            if top + GAUGE_HEIGHT > frame.shape[0] or length > frame.shape[1]:
                break
            lit = plate in on and not beat
            frame[top:top + GAUGE_HEIGHT, 0:length] = PIP_ON if lit else PIP_OFF
        return frame


class G019(ARCBaseGame):

    CAUGHT_FRAMES = 6
    RINGING_FRAMES = 5

    def __init__(self) -> None:
        m = model(0)
        self.pos = m["start"]
        self.guards = m["posts"]
        self.target = None
        self.deaths = 0
        self.beat = 0
        self._caught = 0
        self.ringing = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G019A(self)],
        )
        super().__init__(game_id="g019", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        m = model(self.level_index)
        self.pos = m["start"]
        self.guards = m["posts"]
        self.target = None
        self._caught = 0
        self.ringing = 0

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)
        self._redraw()

    def full_reset(self) -> None:
        super().full_reset()
        self.deaths = 0
        self.on_set_level(self.current_level)
        self._redraw()

    def _decorate(self) -> None:
        for s in self.current_level.get_sprites_by_tag("decor"):
            s.pixels = np.array(_decor_pixels(self.beat, (s.x + s.y) // CELL))

    def _redraw(self) -> None:
        level = self.current_level
        m = model(self.level_index)
        for i, (gx, gy) in enumerate(self.guards):
            for s in level.get_sprites_by_name(f"guard_{i}"):
                s.set_position(gx * CELL, gy * CELL)
        for s in level.get_sprites_by_name("player"):
            s.pixels = np.array(_player_pixels())
            s.set_position(self.pos[0] * CELL, self.pos[1] * CELL)
        on = set(self.guards)
        for px, py in m["plates"]:
            lit = (px, py) in on
            for s in level.get_sprites_by_name(f"plate_{px}_{py}"):
                level.remove_sprite(s)
            level.add_sprite(_sprite(_plate_pixels(lit), f"plate_{px}_{py}", px, py, 0))
        live = all(p in on for p in m["plates"])
        ex, ey = m["exit"]
        for s in level.get_sprites_by_name("exit"):
            level.remove_sprite(s)
        level.add_sprite(_sprite(_exit_pixels(live), "exit", ex, ey, 0))

    def step(self) -> None:
        self.beat += 1
        self._decorate()

        if self._caught:
            self._caught -= 1
            for s in self.current_level.get_sprites_by_name("player"):
                s.pixels = np.array(_caught_pixels(self._caught % 2 == 0))
            if self._caught == 0:
                self.level_reset()
                self.complete_action()
            return

        if self.ringing:
            self.ringing -= 1
            for s in self.current_level.get_sprites_by_name("player"):
                s.pixels = np.array(_ringing_pixels(self.ringing % 2 == 0))
            if self.ringing == 0:
                self.next_level()
                self.complete_action()
            return

        move = MOVES.get(self.action.id)
        if move is None:
            self.complete_action()
            return

        self.pos, self.guards, self.target, dead, won = resolve(
            self.level_index, self.pos, self.guards, self.target, move)

        if dead:
            self.deaths += 1
            self._redraw()
            self._caught = self.CAUGHT_FRAMES
            return

        self._redraw()
        if won:
            self.ringing = self.RINGING_FRAMES
            return
        self.complete_action()
