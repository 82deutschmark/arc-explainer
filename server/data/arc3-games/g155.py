# ARC-AGI-3 candidate task g155.

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

def gauge(colour: int, value: int, cell: int = 6) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for k in range(min(value, cell - 2)):
        for x in range(1, cell - 1):
            px[cell - 2 - k][x] = colour
    return px

def speckle(colour: int, seed: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(cell):
        for x in range(cell):
            if (x * 7 + y * 13 + seed * 31) % 5 == 0:
                px[y][x] = colour
    return px

def blink(step: int, period: int = 3) -> bool:
    return (step // period) % 2 == 0

def begin_translation(game, names=(), position=None, repaint=None, limit=8):
    game._translation_path = None
    sprites = {s.name: (s.x, s.y) for s in game.current_level.get_sprites()
               if any(s.name == n or (n.endswith('*') and s.name.startswith(n[:-1]))
                      for n in names)}
    game._translation_capture = (game.current_level, sprites,
        (game.camera.x, game.camera.y), position, position() if position else None,
        repaint, limit)

def translation_position(game, position):
    return getattr(game, '_translation_point', None) or position

def advance_translation(game):
    motion = getattr(game, '_translation_motion', None)
    if motion is None:
        return False
    motion['frame'] += 1
    t = motion['frame'] / motion['count']
    def lerp(a, b):
        return tuple(round(x + (y - x) * t) for x, y in zip(a, b))
    for sprite, start, end in motion['sprites']:
        sprite.set_position(*(motion['path'][motion['frame']-1] if motion['path'] else lerp(start, end)))
    game.camera.x, game.camera.y = lerp(motion['camera'][0], motion['camera'][1])
    if motion['point'] is not None:
        game._translation_point = lerp(*motion['point'])
    if motion['repaint'] is not None:
        motion['repaint']()
    if motion['frame'] == motion['count']:
        game._translation_motion = None
        game._translation_point = None
        if motion['complete']:
            game.complete_action()
    return True

def finish_translation(game, complete=True):
    capture = getattr(game, '_translation_capture', None)
    game._translation_capture = None
    if capture is None or capture[0] is not game.current_level or game._next_level:
        if complete:
            game.complete_action()
        return
    level, previous, camera, position, point, repaint, limit = capture
    sprites = []
    distances = []
    path = getattr(game, "_translation_path", None)
    for sprite in level.get_sprites():
        if sprite.name not in previous:
            continue
        start, end = previous[sprite.name], (sprite.x, sprite.y)
        distance = max(abs(start[0] - end[0]), abs(start[1] - end[1]))
        if distance or path:
            sprites.append((sprite, start, end))
            distances.append(distance)
    points = (point, position()) if position else None
    if points:
        distances.append(max(abs(a-b) for a,b in zip(*points)))
    count = len(path) if path else max(distances, default=0)
    if count < 2 or (not path and count > limit):
        if complete:
            game.complete_action()
        return
    game._translation_motion = dict(frame=0, count=count, sprites=sprites,
        camera=(camera, (game.camera.x, game.camera.y)), point=points, repaint=repaint,
        complete=complete, path=path)
    advance_translation(game)

def clear_translation(game):
    game._translation_path = None
    game._translation_capture = None
    game._translation_motion = None
    game._translation_point = None


VOID_BG = 4
ROCK_WALL = 3
DARK_FILL = 5
WATER = 11
PLAYER = 0
EXIT_GATE = 9

CLASSES = {"1": 15, "2": 10, "3": 7}

GATES = {"a": "1", "b": "2", "c": "3"}

DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))

N = 8
CELL = 8
CAP = 6
WADE = 3

BEDROCK = "#"
BRIM = "~"
DRIP = ":"
START = "P"
EXIT = "X"

SOURCE = {BRIM: CAP, DRIP: 1}

LEVELS_SPEC = [
    {"reveal": None, "rows": [
        "~~#....#",
        "11#....#",
        "..#....#",
        "..#....#",
        "..#....#",
        "########",
        "P..1..aX",
        "########",
    ]},
    {"reveal": None, "rows": [
        "P.######",
        "#1######",
        "#.######",
        "#1######",
        "#..##.aX",
        "##~~~~##",
        "##1111##",
        "........",
    ]},
    {"reveal": None, "rows": [
        "P.#~####",
        "..#~####",
        "..#~####",
        "..#~####",
        "..#1####",
        "..#.#1aX",
        ".......#",
        "########",
    ]},
    {"reveal": 2, "rows": [
        "X#~~~#~#",
        "a#222#~#",
        ".#...#~#",
        ".##b##1#",
        ".##.##.#",
        "P.2.....",
        "######.#",
        "........",
    ]},
    {"reveal": 2, "rows": [
        "X#.~.#~#",
        "a#.1.#~#",
        ".#...#~#",
        ".#...#~#",
        ".#####1#",
        "P.......",
        "######2#",
        "........",
    ]},
    {"reveal": 2, "rows": [
        "#####X#~",
        "#####c#~",
        ".3333.#~",
        ".######~",
        "a######1",
        "P.......",
        "#######2",
        "........",
    ]},
]


CURRENTS = {'>':(1,0), '<':(-1,0), '^':(0,-1), 'v':(0,1)}
MAGMA = 'M'
HEAT_CLASS = '2'

LEVELS_SPEC.extend([
    {'reveal':2,'chapter_start':True,'rows':[
        '########','#P.2####','##.#####','##M#####',
        '##M.1###','####v###','#X.a<###','########']},
    {'reveal':2,'rows':[
        '########','#P..2..#','#.####.#','#..M...#',
        '###M##1#','#..M.v##','#X.a<<##','########']},
])

def walk_result(rows,eaten,fill,pos,direction):
    x,y=pos
    if rows[y][x] in CURRENTS and direction!=CURRENTS[rows[y][x]]:
        return pos
    dest=(x+direction[0],y+direction[1])
    if not passable(rows,eaten,fill,*dest):return pos
    seen=set()
    while rows[dest[1]][dest[0]] in CURRENTS:
        if dest in seen:return pos
        seen.add(dest)
        dx,dy=CURRENTS[rows[dest[1]][dest[0]]]
        nxt=(dest[0]+dx,dest[1]+dy)
        if not passable(rows,eaten,fill,*nxt):break
        dest=nxt
    return dest

def index(x: int, y: int) -> int:
    return y * N + x


def find_char(rows, ch):
    for y, row in enumerate(rows):
        x = row.find(ch)
        if x >= 0:
            return x, y
    raise ValueError(f"no {ch!r} in board")


def class_cells(rows, glyph):
    return {(x, y) for y, row in enumerate(rows)
            for x, c in enumerate(row) if c == glyph}


def initial_fill(rows):
    return tuple(SOURCE.get(rows[y][x], 0) for y in range(N) for x in range(N))


def terrain_open(rows, eaten, x, y):
    c = rows[y][x]
    if c == BEDROCK:
        return False
    if c in CLASSES:
        return c in eaten
    if c in GATES:
        return GATES[c] in eaten
    return True


def passable(rows, eaten, fill, x, y):
    if not (0 <= x < N and 0 <= y < N):
        return False
    c = rows[y][x]
    if c == BEDROCK or c == MAGMA and HEAT_CLASS not in eaten:
        return False
    if c in CLASSES and c in eaten:
        return False
    if c in GATES and GATES[c] not in eaten:
        return False
    return fill[index(x, y)] < WADE


def flow(rows, eaten, fill, limit=None, sweep=1):
    g = list(fill)
    xs = range(N) if sweep > 0 else range(N - 1, -1, -1)
    sides = (-1, 1) if sweep > 0 else (1, -1)
    passes = 0
    while limit is None or passes < limit:
        moved = False
        passes += 1
        for y in range(N - 1, -1, -1):
            for x in xs:
                here = index(x, y)
                if g[here] and y + 1 < N and terrain_open(rows, eaten, x, y + 1):
                    below = index(x, y + 1)
                    n = min(CAP - g[below], g[here])
                    if n > 0:
                        g[below] += n
                        g[here] -= n
                        moved = True
                for dx in sides:
                    nx = x + dx
                    if not (0 <= nx < N) or not terrain_open(rows, eaten, nx, y):
                        continue
                    beside = index(nx, y)
                    if g[beside] + 1 < g[here]:
                        g[beside] += 1
                        g[here] -= 1
                        moved = True
        if not moved:
            break
    return tuple(g)


def bite_result(rows, eaten, fill, glyph):
    spent = frozenset(eaten | {glyph})
    return spent, flow(rows, spent, fill)


def stranded(rows, eaten, fill, x, y):
    return not any(walk_result(rows,eaten,fill,(x,y),d)!=(x,y) for d in DIRS)


def drowned(fill, x, y):
    return fill[index(x, y)] >= WADE


def _rock(x, y):
    px = block(ROCK_WALL, CELL)
    for fy, row in enumerate(speckle(VOID_BG, x * 3 + y, CELL)):
        for fx, v in enumerate(row):
            if v >= 0:
                px[fy][fx] = v
    return px


def _shelf(glyph):
    return rounded(CLASSES[glyph], CELL)


def _rubble(glyph=None):
    return weave(ROCK_WALL if glyph is None else CLASSES[glyph], CELL)


def _arch(frame_colour):
    px = [[-1] * CELL for _ in range(CELL)]
    for y in range(CELL):
        for x in (0, 1, CELL - 2, CELL - 1):
            px[y][x] = frame_colour
    for y in (0, 1):
        for x in range(CELL):
            px[y][x] = frame_colour
    return px


def _gate(glyph, bar=None, frame=None):
    px = _arch(ROCK_WALL if frame is None else frame)
    fill = CLASSES[glyph] if bar is None else bar
    for y in range(2, CELL):
        for x in range(2, CELL - 2):
            px[y][x] = fill if y % 2 == 0 else -1
    return px


def _open_gate():
    return _arch(ROCK_WALL)


def _exit(lit):
    px = ring(EXIT_GATE, CELL)
    if lit:
        for y, row in enumerate(core(PLAYER, CELL)):
            for x, v in enumerate(row):
                if v >= 0:
                    px[y][x] = v
    return px


def _fluid(depth):
    d = min(depth, CAP)
    px = gauge(WATER, d, CELL)
    for x in range(1, CELL - 1):
        px[CELL - 1][x] = WATER
    top = CELL - 1 - d
    for x in range(1, CELL - 1):
        if x % 2:
            px[top][x] = -1
    if depth >= WADE:
        for y in range(top, CELL):
            px[y][0] = px[y][CELL - 1] = WATER
    return px


def _player(wet):
    px = figure(PLAYER, None, CELL)
    for x in (0, CELL - 1):
        px[1][x] = -1
    for y in (CELL - 3, CELL - 2, CELL - 1):
        for x in range(CELL):
            px[y][x] = PLAYER if x in (1, 2, CELL - 3, CELL - 2) else -1
    return px


def _layer(base, over):
    for y in range(CELL):
        for x in range(CELL):
            if over[y][x] >= 0:
                base[y][x] = over[y][x]
    return base


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for y in range(N):
            for x in range(N):
                sprites.append(Sprite(
                    pixels=[[-1] * CELL for _ in range(CELL)], name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=0,
                    collidable=False,
                ).set_position(x * CELL, y * CELL))
        px, py = find_char(rows, START)
        sprites.append(Sprite(
            pixels=_player(False), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=1, collidable=False,
        ).set_position(px * CELL, py * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class Fog(RenderableUserDisplay):

    def __init__(self, game: "OneBite") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        g=self._game
        if g.reveal_radius is None:return frame
        out=np.full_like(frame,DARK_FILL)
        for x,y in g.lit_pixels:out[y,x]=frame[y,x]
        return out


class OneBite(ARCBaseGame):

    POUR_CAP = 9
    DYING_FRAMES = 6

    def __init__(self) -> None:
        self.eaten: frozenset = frozenset()
        self.fill: tuple = ()
        self.revealed: set[tuple[int, int]] = set()
        self.tick = 0
        self._pour = 0
        self._pour_span = 0
        self._pour_before: tuple = ()
        self._dying = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=VOID_BG, letter_box=VOID_BG,
            interfaces=[Fog(self)],
        )
        super().__init__(game_id="g155", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])
        self.on_set_level(self.current_level)

    @property
    def rows(self):
        return LEVELS_SPEC[self.level_index]["rows"]

    @property
    def reveal_radius(self):
        return LEVELS_SPEC[self.level_index]["reveal"]

    def player_cell(self):
        p = self.current_level.get_sprites_by_name("player")
        if not p:
            return 0, 0
        return p[0].x // CELL, p[0].y // CELL

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
        self.eaten = frozenset()
        self.fill = flow(self.rows, self.eaten, initial_fill(self.rows))
        self.revealed = set()
        self.lit_pixels = set()
        self._pour = 0
        self._pour_span = 0
        self._pour_before = self.fill
        self._dying = 0
        self._reveal(*find_char(self.rows, START))
        self._repaint(self.fill)

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        clear_translation(self)
        super().full_reset()
        self.on_set_level(self.current_level)

    def _reveal(self,x,y):
        r=self.reveal_radius
        if r is None:
            self.revealed={(a,b) for a in range(N) for b in range(N)}
            self.lit_pixels={(a,b) for a in range(64) for b in range(64)}
            return
        cx,cy=x*CELL+CELL//2,y*CELL+CELL//2
        radius=r*CELL+CELL//2
        for b in range(max(0,cy-radius),min(64,cy+radius+1)):
            for a in range(max(0,cx-radius),min(64,cx+radius+1)):
                if (a-cx)**2+(b-cy)**2<=radius**2:
                    self.lit_pixels.add((a,b))
                    self.revealed.add((a//CELL,b//CELL))

    def _face(self, x, y, field):
        c = self.rows[y][x]
        if c == BEDROCK:
            base = _rock(x, y)
        elif c in CLASSES:
            base = _shelf(c) if c not in self.eaten else _rubble()
        elif c in GATES:
            base = _open_gate() if GATES[c] in self.eaten else _gate(GATES[c])
        elif c == MAGMA:
            cooled = HEAT_CLASS in self.eaten
            base=block(3 if cooled else 13,CELL)
            for a in range(CELL):
                base[(a*3+self.tick)%CELL][a]=CLASSES[HEAT_CLASS] if cooled else 12
                base[(a*3+self.tick+1)%CELL][a]=3 if cooled else 8
        elif c in CURRENTS:
            base=block(9,CELL)
            dx,dy=CURRENTS[c]
            for k in range(-2,3):base[3+dy*k][3+dx*k]=10
            for side in (-1,1):base[3+dy-dx*side][3+dx+dy*side]=0
        elif c == EXIT:
            base = _exit(blink(self.tick, 3))
        else:
            base = block(VOID_BG,CELL)
            base[CELL-1]=[3]*CELL
            base[(x+2*y)%6][(x*3+y)%6]=3
        depth = field[index(x, y)]
        return _layer(base, _fluid(depth)) if depth else base

    def _repaint(self, field) -> None:
        for y in range(N):
            for x in range(N):
                for s in self.current_level.get_sprites_by_name(f"cell_{x}_{y}"):
                    s.pixels = np.array(self._face(x, y, field))
        self._paint_player(field)

    def _paint_player(self, field, standing: bool = True) -> None:
        x, y = self.player_cell()
        wet = field[index(x, y)] > 0
        px = _player(wet) if standing else _rubble()
        if HEAT_CLASS in self.eaten and any(MAGMA in row for row in self.rows):
            px[1][2:6]=[CLASSES[HEAT_CLASS]]*4
        for s in self.current_level.get_sprites_by_name("player"):
            s.pixels = np.array(px)

    def _bite(self) -> bool:
        x, y = self.player_cell()
        glyph = self.rows[y][x]
        if glyph not in CLASSES or glyph in self.eaten:
            return False
        before = self.fill
        self.eaten, self.fill = bite_result(self.rows, self.eaten, before, glyph)
        span = 1
        while span < self.POUR_CAP and \
                flow(self.rows, self.eaten, before, limit=span) != self.fill:
            span += 1
        self._pour_span = span
        self._pour = span
        return True

    def _pour_frame(self) -> None:
        done = self._pour_span - self._pour + 1
        self._repaint(flow(self.rows, self.eaten, self._pour_before, limit=done))

    def _finish_or_die(self) -> None:
        x, y = self.player_cell()
        if drowned(self.fill, x, y) or stranded(self.rows, self.eaten, self.fill, x, y):
            self._dying = self.DYING_FRAMES
            return
        finish_translation(self)

    def step(self) -> None:
        if advance_translation(self):
            return
        begin_translation(self, ('player',), limit=CELL)
        if self._dying:
            self._dying -= 1
            self._paint_player(self.fill, standing=self._dying % 2 == 0)
            if self._dying == 0:
                self.level_reset()
                finish_translation(self)
            return

        if self._pour:
            self._pour -= 1
            if self._pour:
                self._pour_frame()
                return
            self._repaint(self.fill)
            self._finish_or_die()
            return

        self.tick += 1

        if self.action.id == GameAction.ACTION5:
            self._pour_before = self.fill
            if self._bite():
                self._pour_frame()
                return
            self._repaint(self.fill)
            finish_translation(self)
            return

        dx = dy = 0
        if self.action.id == GameAction.ACTION1:
            dy = -1
        elif self.action.id == GameAction.ACTION2:
            dy = 1
        elif self.action.id == GameAction.ACTION3:
            dx = -1
        elif self.action.id == GameAction.ACTION4:
            dx = 1

        if dx or dy:
            x, y = self.player_cell()
            nx,ny=walk_result(self.rows,self.eaten,self.fill,(x,y),(dx,dy))
            if (nx,ny)!=(x,y):
                for s in self.current_level.get_sprites_by_name("player"):
                    s.set_position(nx * CELL, ny * CELL)
                self._reveal(nx, ny)
                self._repaint(self.fill)
                if (nx, ny) == find_char(self.rows, EXIT):
                    self.next_level()
                elif stranded(self.rows, self.eaten, self.fill, nx, ny):
                    self._dying = self.DYING_FRAMES
                    return
        else:
            self._repaint(self.fill)

        finish_translation(self)
