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

def gauge(colour: int, value: int, cell: int = 6) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for k in range(min(value, cell - 2)):
        for x in range(1, cell - 1):
            px[cell - 2 - k][x] = colour
    return px

def pips(colour: int, count: int, cell: int = 6) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    if count <= 0:
        return px
    n = 0
    for y in range(cell - 2, 0, -1):
        for x in range(1, cell - 1):
            if n >= count:
                return px
            px[y][x] = colour
            n += 1
    return px


WALL = 4
FLOOR_HIGH = 10
FLOOR_LOW = 9
GUARD_BODY = 13
BALLAST_FILL = 8
LOAD_PIP = 8
PLATE_RIM = 7
BELL_GLYPH = 7
PLAYER = 0
EXIT_SHUT = 4
EXIT_LIVE = 0
SEEP_MARK = 8

COLS = 10
ROWS = 10
CELL = 6
OX = 2
OY = 1

MOVES = {GameAction.ACTION1: (0,-1), GameAction.ACTION2: (0,1), GameAction.ACTION3: (-1,0), GameAction.ACTION4: (1,0)}
NEIGHBOURS = ((0,-1),(1,0),(0,1),(-1,0))
HOLD = (0, 0)
WAIT_ACTIONS = frozenset({GameAction.ACTION6})


def to_axial(col, row):
    return col, row


def to_offset(q, r):
    return q, r


def grid_distance(a, b):
    return abs(a[0]-b[0]) + abs(a[1]-b[1])


SUMP_PLATES = "1234"
SHELF_PLATES = "pqrs"
GLYPH_HEIGHT = {".": 0, "-": 1, "=": 2, "b": 2, "G": 1, "P": 1, "X": 1,
                "1": 0, "2": 0, "3": 0, "4": 0,
                "p": 2, "q": 2, "r": 2, "s": 2}


def plate_load(ch: str) -> int:
    return (SUMP_PLATES.index(ch) if ch in SUMP_PLATES
            else SHELF_PLATES.index(ch)) + 1

LEVELS_SPEC = [{'ballast': [1],
  'rows': ['##########',
           '#-======-#',
           '#-=....=b#',
           '#-=....=-#',
           '#-G..1..b#',
           '#-=....=-#',
           '#-=....=X#',
           '#--P====-#',
           '#--------#',
           '##########']},
 {'ballast': [1, 1],
  'rows': ['##########',
           '#==G=====#',
           '#==G====X#',
           '#========#',
           '#-----Pb-#',
           '#.......2#',
           '#.......b#',
           '#.......b#',
           '#........#',
           '##########']},
 {'ballast': [2, 2, 1],
  'rows': ['##########',
           '#b======X#',
           '#-=G==G=-#',
           '#-======-#',
           '#--------#',
           '#-......-#',
           '#-..G.13b#',
           '#-......-#',
           '#b------P#',
           '##########']},
 {'ballast': [2, 2, 1],
  'rows': ['##########',
           '#b======-#',
           '#-=G==G=-#',
           '#-======-#',
           '#-----X--#',
           '#-......-#',
           '#-..G.13b#',
           '#-......P#',
           '#b-------#',
           '##########']},
 {'ballast': [2, 2, 1],
  'rows': ['##########',
           '#b======X#',
           '#-=G==G=-#',
           '#-======-#',
           '#--------#',
           '#-......P#',
           '#-..G.13b#',
           '#-......-#',
           '#b-------#',
           '##########']}]

SEEP_CYCLE = (0, 1, 1, 0, 2)


_MODELS: dict[int, dict] = {}


def model(index: int) -> dict:
    if index in _MODELS:
        return _MODELS[index]
    spec = LEVELS_SPEC[index]
    rows = spec["rows"]
    floor, height, bells, plates, posts = set(), {}, [], [], []
    start = exit_cell = None
    seep = []
    for row, line in enumerate(rows):
        for col, ch in enumerate(line):
            if ch == "#":
                continue
            cell = to_axial(col, row)
            floor.add(cell)
            height[cell] = GLYPH_HEIGHT[ch]
            if ch == "b":
                bells.append(cell)
            elif ch in SUMP_PLATES or ch in SHELF_PLATES:
                plates.append((cell, plate_load(ch)))
            elif ch == "G":
                posts.append(cell)
            elif ch == "P":
                start = cell
            elif ch == "X":
                exit_cell = cell
            elif ch in ".-=":
                seep.append(cell)
    if start is None or exit_cell is None:
        raise ValueError(f"level {index + 1} is missing a start or an exit")
    if len(posts) != len(spec["ballast"]):
        raise ValueError(f"level {index + 1} has a ballast list of the wrong length")

    dist = []
    for b in bells:
        d = {b: 0}
        q = deque([b])
        while q:
            cur = q.popleft()
            for dq, dr in NEIGHBOURS:
                nb = (cur[0] + dq, cur[1] + dr)
                if nb in floor and nb not in d:
                    d[nb] = d[cur] + 1
                    q.append(nb)
        dist.append(d)

    marks = tuple(seep[len(seep) * k // 4] for k in (1, 2, 3)) if len(seep) >= 4 else ()

    m = {"rows": rows, "floor": frozenset(floor), "height": height,
         "bells": tuple(bells), "plates": tuple(plates), "posts": tuple(posts),
         "ballast": tuple(spec["ballast"]), "start": start, "exit": exit_cell,
         "dist": tuple(dist), "seep": marks}
    _MODELS[index] = m
    return m


def guard_step(m: dict, cell: tuple[int, int], target: int) -> tuple[int, int]:
    d = m["dist"][target]
    here = d.get(cell)
    if here is None or here == 0:
        return cell
    for dq, dr in NEIGHBOURS:
        nb = (cell[0] + dq, cell[1] + dr)
        if d.get(nb, 1 << 30) == here - 1:
            return nb
    return cell


def advance(m: dict, guards: tuple, target: int) -> tuple:
    want = [guard_step(m, g, target) for g in guards]
    cur = list(guards)
    occupied = set(cur)
    moving = True
    while moving:
        moving = False
        for i, dest in enumerate(want):
            if cur[i] == dest or dest in occupied:
                continue
            occupied.discard(cur[i])
            occupied.add(dest)
            cur[i] = dest
            moving = True
    return tuple(cur)


def settle(m: dict, guards: tuple, ballast: tuple) -> tuple:
    h = m["height"]
    out = list(ballast)
    for i, gi in enumerate(guards):
        for j, gj in enumerate(guards):
            if i == j or grid_distance(gi, gj) != 1 or out[i] < 1:
                continue
            if (out[i] + h[gi]) - (out[j] + h[gj]) >= 2:
                out[i] -= 1
                out[j] += 1
    return tuple(out)


def held(m: dict, guards: tuple, ballast: tuple) -> tuple:
    return tuple(
        any(g == cell and ballast[i] >= load for i, g in enumerate(guards))
        for cell, load in m["plates"]
    )


def resolve(index, player, guards, ballast, target, move, pour=True):
    m = model(index)
    nxt = (player[0] + move[0], player[1] + move[1])
    if nxt not in m["floor"]:
        nxt = player
    if nxt in m["bells"]:
        target = m["bells"].index(nxt)
    if target is not None:
        guards = advance(m, guards, target)
    if pour:
        ballast = settle(m, guards, ballast)
    dead = any(grid_distance(g, nxt) <= 1 for g in guards)
    won = (not dead) and nxt == m["exit"] and all(held(m, guards, ballast))
    return nxt, guards, ballast, target, dead, won


def _pixel(cell):
    return OX + cell[0] * CELL, OY + cell[1] * CELL


def _over(base, top):
    return [[top[y][x] if top[y][x] >= 0 else base[y][x] for x in range(CELL)]
            for y in range(CELL)]


def _ground_pixels(h: int) -> list[list[int]]:
    if h == 2:
        return block(FLOOR_HIGH, CELL)
    if h == 0:
        return block(FLOOR_LOW, CELL)
    return _over(block(FLOOR_HIGH, CELL), ring(FLOOR_LOW, CELL))


def _bell_pixels() -> list[list[int]]:
    return rounded(BELL_GLYPH, CELL)


def _plate_pixels(load: int, lit: bool) -> list[list[int]]:
    throat = block(BALLAST_FILL, CELL) if lit else gauge(LOAD_PIP, load, CELL)
    return _over(throat, ring(PLATE_RIM, CELL))


def _guard_pixels(load: int) -> list[list[int]]:
    return _over(block(GUARD_BODY, CELL), gauge(BALLAST_FILL, load, CELL))


def _player_pixels(carried: int) -> list[list[int]]:
    return _over(figure(PLAYER, None, CELL), pips(BALLAST_FILL, carried, CELL))


def _caught_pixels(lit: bool) -> list[list[int]]:
    return figure(GUARD_BODY if lit else PLAYER, None, CELL)


def _exit_pixels(live: bool) -> list[list[int]]:
    px = ring(EXIT_LIVE if live else EXIT_SHUT, CELL)
    if not live:
        for x in range(1, CELL - 1):
            px[CELL // 2][x] = EXIT_SHUT
    return px


def _seep_pixels(phase: int) -> list[list[int]]:
    step = SEEP_CYCLE[phase % len(SEEP_CYCLE)]
    if step == 0:
        return [[-1] * CELL for _ in range(CELL)]
    return pips(FLOOR_HIGH if step == 1 else SEEP_MARK, 2, CELL)


def _sprite(px, name, cell, layer, tags=()):
    x, y = _pixel(cell)
    return Sprite(pixels=[list(r) for r in px], name=name,
                  blocking=BlockingMode.NOT_BLOCKED,
                  interaction=InteractionMode.INTANGIBLE, layer=layer,
                  tags=list(tags)).set_position(x, y)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for index in range(len(LEVELS_SPEC)):
        m = model(index)
        sprites: list[Sprite] = []
        for cell in sorted(m["floor"]):
            sprites.append(_sprite(_ground_pixels(m["height"][cell]),
                                   f"ground_{cell[0]}_{cell[1]}", cell, -3))
        for i, cell in enumerate(m["seep"]):
            sprites.append(_sprite(_seep_pixels(i + 1), f"seep_{i}", cell, -2,
                                   tags=("seep",)))
        for cell in m["bells"]:
            sprites.append(_sprite(_bell_pixels(), f"bell_{cell[0]}_{cell[1]}", cell, -1))
        for cell, load in m["plates"]:
            sprites.append(_sprite(_plate_pixels(load, False),
                                   f"plate_{cell[0]}_{cell[1]}", cell, 0))
        sprites.append(_sprite(_exit_pixels(False), "exit", m["exit"], 0))
        for i, cell in enumerate(m["posts"]):
            sprites.append(_sprite(_guard_pixels(m["ballast"][i]), f"guard_{i}", cell, 2))
        sprites.append(_sprite(_player_pixels(0), "player", m["start"], 3))
        levels.append(Level(sprites=sprites, grid_size=(64, 64)))
    return levels


class BasinDisplay(RenderableUserDisplay):

    def __init__(self, game: "SlowBell") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        g = self._game
        m = model(g.level_index)
        live = all(held(m, g.guards, g.ballast))
        if not live and not g.ringing:
            return frame
        lit = EXIT_LIVE if (not g.ringing or g.ringing % 2 == 0) else PLATE_RIM
        frame[0, :] = lit
        frame[-1, :] = lit
        frame[:, 0] = lit
        frame[:, -1] = lit
        return frame


class SlowBell(ARCBaseGame):

    CAUGHT_FRAMES = 6
    RINGING_FRAMES = 5

    def __init__(self) -> None:
        m = model(0)
        self.pos = m["start"]
        self.guards = m["posts"]
        self.ballast = m["ballast"]
        self.target = None
        self.deaths = 0
        self.beat = 0
        self._caught = 0
        self.ringing = 0
        camera = Camera(
            width=64, height=64,
            background=WALL, letter_box=5,
            interfaces=[BasinDisplay(self)],
        )
        super().__init__(game_id="g019", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 6])

    def on_set_level(self, level: Level) -> None:
        m = model(self.level_index)
        self.pos = m["start"]
        self.guards = m["posts"]
        self.ballast = m["ballast"]
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
        for s in self.current_level.get_sprites_by_tag("seep"):
            s.pixels = np.array(_seep_pixels(self.beat + (s.x + s.y) // CELL))

    def _redraw(self) -> None:
        level = self.current_level
        m = model(self.level_index)
        flags = held(m, self.guards, self.ballast)
        for i, cell in enumerate(self.guards):
            px, py = _pixel(cell)
            for s in level.get_sprites_by_name(f"guard_{i}"):
                s.pixels = np.array(_guard_pixels(self.ballast[i]))
                s.set_position(px, py)
        for s in level.get_sprites_by_name("player"):
            s.pixels = np.array(_player_pixels(sum(flags)))
            s.set_position(*_pixel(self.pos))
        for (cell, load), lit in zip(m["plates"], flags):
            name = f"plate_{cell[0]}_{cell[1]}"
            for s in level.get_sprites_by_name(name):
                s.pixels = np.array(_plate_pixels(load, lit))
        for s in level.get_sprites_by_name("exit"):
            s.pixels = np.array(_exit_pixels(all(flags)))

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
            if self.ringing == 0:
                self.next_level()
                self.complete_action()
            return

        move = MOVES.get(self.action.id)
        if move is None:
            if self.action.id not in WAIT_ACTIONS:
                self.complete_action()
                return
            move = HOLD

        self.pos, self.guards, self.ballast, self.target, dead, won = resolve(
            self.level_index, self.pos, self.guards, self.ballast, self.target, move)

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
