# ARC-AGI-3 candidate task g050.

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


FLOOR = 1
WALL = 4
DARK = 5
ASH = 13
STONE = 10
EXIT = 14
PLAYER = 11
EMBER = 12

DECOR_CYCLE = (ASH, WALL, WALL)

LEVELS_SPEC = [
    {"rows": [
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "#####P....######",
        "#########.######",
        "#########.######",
        "#########.######",
        "#######X..######",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "################",
        "################",
        "######.#.#######",
        "###P..S.S.######",
        "########.#######",
        "########.#######",
        "########X#######",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "#####.#.#.######",
        "###P.S.S.S.#####",
        "#########.######",
        "#########.######",
        "####XS.S.S.#####",
        "#####.#.#.######",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "################",
        "###..........###",
        "###.########.###",
        "###.#X.....#.###",
        "###.######.#.###",
        "###.######.#.###",
        "###.######.#S.##",
        "###.######.#.###",
        "###........#.###",
        "############.###",
        "###....P.....###",
        "################",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "################",
        "###..........###",
        "###.########.###",
        "###.########.###",
        "###.#X######.###",
        "###.#.##.###.###",
        "##.S#.##.###.###",
        "###.#.##.###.###",
        "###.#........###",
        "###.############",
        "###......PS..###",
        "##########.#####",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "##............##",
        "##.######.###.##",
        "##.######.###.##",
        "##.######.###.##",
        "##X######.###.##",
        "#############.##",
        "#############.##",
        "#############.##",
        "#############.##",
        "#############.##",
        "######.######.##",
        "##..P.S.......##",
        "################",
        "################",
    ]},
    {"rows": [
        "################",
        "################",
        "##............##",
        "##.##########.##",
        "##.#........#.##",
        "##.#.##.###.#.##",
        "##.#.##.#X#.#.##",
        "##.#.##.#.#.#S.#",
        "##.#.####.#.#.##",
        "##.#......#.#.##",
        "##.########.#.##",
        "##..........#.##",
        "#############.##",
        "##....P.......##",
        "################",
        "################",
    ]},
]

N = len(LEVELS_SPEC[0]["rows"])
CELL = 6
DIRS = ((0, -1), (0, 1), (-1, 0), (1, 0))


def coolant_cells(rows):
    return frozenset((x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c=='O')

def ash_step(rows,pos,ash,coolant,used,direction):
    dest=(pos[0]+direction[0],pos[1]+direction[1])
    x,y=dest
    if not (0<=x<N and 0<=y<N) or rows[y][x]=='#':return None
    ash=set(ash)
    if dest in ash:
        if coolant<=0:return None
        coolant-=1
        ash.remove(dest)
    if rows[pos[1]][pos[0]]!='S':ash.add(pos)
    if rows[y][x]=='O' and dest not in used:
        coolant+=1
        used=frozenset(used|{dest})
    return dest,frozenset(ash),coolant,used

def exit_open(rows,used):
    return coolant_cells(rows)<=used

def retrieval_board(two=False):
    a=[list('#'*N) for _ in range(N)]
    def line(start,end):
        x,y=start
        while (x,y)!=end:
            a[y][x]='.'
            x+=(end[0]>x)-(end[0]<x);y+=(end[1]>y)-(end[1]<y)
        a[y][x]='.'
    if not two:
        line((4,9),(10,9));line((10,4),(10,9));line((7,9),(7,12))
        for x in (5,6):a[9][x]='S'
        a[9][4]='O';a[9][7]='P';a[4][10]='X'
    else:
        line((3,8),(13,8));line((8,3),(8,12))
        for x in (4,5,6,7,9,10,11,12):a[8][x]='S'
        a[8][3]=a[8][13]='O';a[8][8]='P';a[3][8]='X'
    return {'rows':[''.join(r) for r in a]}

LEVELS_SPEC.extend([retrieval_board(),retrieval_board(True)])

def ash_art(hot=False):
    px=rounded(EMBER if hot else ASH,CELL)
    for k in range(CELL):px[k][(k*3+1)%CELL]=PLAYER if hot else 3
    return px

def find_char(rows, char):
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == char:
                return x, y
    raise AssertionError(f"level has no {char!r}")


def stone_cells(rows):
    return {(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c == "S"}


def open_cells(rows):
    return {(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c != "#"}


def _open(rows, x, y) -> bool:
    return 0 <= x < N and 0 <= y < N and rows[y][x] != "#"


def _wall_cell(rows, x, y):
    px = block(WALL, CELL)
    if (x + y) % 2:
        return px
    pits = speckle(1, (x * 3 + y * 5) % 7, CELL)
    keep = (_open(rows, x, y - 1), _open(rows, x, y + 1),
            _open(rows, x - 1, y), _open(rows, x + 1, y))
    for py in range(CELL):
        for pxx in range(CELL):
            if pits[py][pxx] < 0:
                continue
            if (py == 0 and keep[0]) or (py == CELL - 1 and keep[1]):
                continue
            if (pxx == 0 and keep[2]) or (pxx == CELL - 1 and keep[3]):
                continue
            px[py][pxx] = -1
    return px


def _wall_run_pixels(rows, x0, y, length):
    cells = [_wall_cell(rows, x0 + i, y) for i in range(length)]
    return [[cells[i][r][c] for i in range(length) for c in range(CELL)]
            for r in range(CELL)]


def decor_cells(rows):
    return [(x, y) for y in range(N) for x in range(N)
            if rows[y][x] == "#" and (x * 5 + y * 11) % 7 == 3
            and any(_open(rows, x + dx, y + dy) for dx, dy in DIRS)]


def _wall_runs(rows):
    runs = []
    for y, row in enumerate(rows):
        x = 0
        while x < len(row):
            if row[x] == "#":
                x0 = x
                while x < len(row) and row[x] == "#":
                    x += 1
                runs.append((x0, y, x - x0))
            else:
                x += 1
    return runs


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for x0, y, length in _wall_runs(rows):
            sprites.append(Sprite(
                pixels=_wall_run_pixels(rows, x0, y, length), name=f"wall_{x0}_{y}",
                blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.TANGIBLE, layer=-1,
            ).set_position(x0 * CELL, y * CELL))
        for x, y in decor_cells(rows):
            sprites.append(Sprite(
                pixels=fixture(DECOR_CYCLE, 0, (x + y) % 3, CELL),
                name=f"decor_{x}_{y}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0,
                tags=["decor"], collidable=False,
            ).set_position(x * CELL, y * CELL))
        for x, y in sorted(stone_cells(rows)):
            sprites.append(Sprite(
                pixels=ring(STONE, CELL), name=f"stone_{x}_{y}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0,
                tags=["stone"], collidable=False,
            ).set_position(x * CELL, y * CELL))
        for x,y in coolant_cells(rows):
            sprites.append(Sprite(pixels=medallion(10,0,CELL),name=f'coolant_{x}_{y}',
                blocking=BlockingMode.NOT_BLOCKED,interaction=InteractionMode.INTANGIBLE,
                layer=0,collidable=False).set_position(x*CELL,y*CELL))
        ex, ey = find_char(rows, "X")
        sprites.append(Sprite(
            pixels=door(EXIT, None, CELL), name="exit",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=0,
            tags=["exit"], collidable=False,
        ).set_position(ex * CELL, ey * CELL))
        px, py = find_char(rows, "P")
        sprites.append(Sprite(
            pixels=figure(PLAYER, cell=CELL), name="player",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(px * CELL, py * CELL))
        levels.append(Level(sprites=sprites, grid_size=(64, 64)))
    return levels


class Fog(RenderableUserDisplay):

    def __init__(self, game: "AshPath") -> None:
        super().__init__()
        self._game = game

    def render_interface(self,frame):
        g=self._game
        out=np.full_like(frame,DARK)
        for x,y in g.revealed:
            ox,oy=x*CELL-g.camera.x,y*CELL-g.camera.y
            x0,y0=max(0,ox),max(0,oy)
            x1,y1=min(64,ox+CELL),min(64,oy+CELL)
            if x1>x0 and y1>y0:out[y0:y1,x0:x1]=frame[y0:y1,x0:x1]
        if coolant_cells(g.rows):
            for k in range(len(coolant_cells(g.rows))):
                out[59:62,3+5*k:6+5*k]=10 if k<g.coolant else 3
                out[63,3+5*k:6+5*k]=14 if k<len(g.used_coolant) else 1
        return out


class AshPath(ARCBaseGame):

    BURN_FRAMES = 1
    DIE_FRAMES = 5
    WIN_FRAMES = 5

    def __init__(self) -> None:
        self.ash: set[tuple[int, int]] = set()
        self.revealed: set[tuple[int, int]] = set()
        self._fx: tuple[str, int] | None = None
        self._vacated: tuple[int, int] | None = None
        self._pending: str | None = None
        self._beat = 0
        camera = Camera(
            width=64, height=64,
            background=FLOOR, letter_box=DARK,
            interfaces=[Fog(self)],
        )
        super().__init__(game_id="g050", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4])
        self.on_set_level(self.current_level)

    @property
    def rows(self) -> list[str]:
        return LEVELS_SPEC[self.level_index]["rows"]

    def player_cell(self) -> tuple[int, int]:
        player = self.current_level.get_sprites_by_name("player")
        if not player:
            return 0, 0
        return player[0].x // CELL, player[0].y // CELL

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
        self.ash = set()
        self.coolant = 0
        self.used_coolant = frozenset()
        self.revealed = set()
        self._fx = None
        self._vacated = None
        self._pending = None
        self._reveal(*find_char(self.rows, "P"))

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        clear_translation(self)
        super().full_reset()
        self.on_set_level(self.current_level)

    def _reveal(self,x,y):
        for dy in range(-2,3):
            for dx in range(-2,3):
                nx,ny=x+dx,y+dy
                if dx*dx+dy*dy<=4 and 0<=nx<N and 0<=ny<N:
                    self.revealed.add((nx,ny))
        self.camera.x=max(0,min(N*CELL-64,x*CELL-32))
        self.camera.y=max(0,min(N*CELL-64,y*CELL-32))

    def passable(self, x: int, y: int) -> bool:
        if not (0 <= x < N and 0 <= y < N):
            return False
        return self.rows[y][x] != "#" and ((x, y) not in self.ash or self.coolant>0)

    def _burn(self, x: int, y: int) -> None:
        if self.rows[y][x] == "S":
            return
        self.ash.add((x, y))
        self.current_level.add_sprite(Sprite(
            pixels=ash_art(), name=f"ash_{x}_{y}",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=0, tags=["ash"],
        ).set_position(x * CELL, y * CELL))

    def _stuck(self) -> bool:
        x, y = self.player_cell()
        return not any(self.passable(x + dx, y + dy) for dx, dy in DIRS)

    def _repaint(self, name: str, pixels) -> None:
        for sprite in self.current_level.get_sprites_by_name(name):
            sprite.pixels = np.array(pixels)

    def _paint_decor(self) -> None:
        for sprite in self.current_level.get_sprites_by_tag("decor"):
            seed = (sprite.x // CELL + sprite.y // CELL) % 3
            sprite.pixels = np.array(fixture(DECOR_CYCLE, self._beat, seed, CELL))

    def _paint_vacated(self, hot: bool) -> None:
        if self._vacated is None:
            return
        x, y = self._vacated
        if self.rows[y][x] == "S":
            self._repaint(f"stone_{x}_{y}",
                          medallion(STONE, EMBER, CELL) if hot else ring(STONE, CELL))
        else:
            self._repaint(f"ash_{x}_{y}",
                          ash_art(hot))

    def _paint_fx(self, kind: str, left: int) -> None:
        if kind == "burn":
            self._paint_vacated(hot=left > 0)
            return
        lit = left % 2 == 1
        if kind == "die":
            self._repaint("player", figure(ASH if lit else PLAYER, cell=CELL))
            for sprite in self.current_level.get_sprites_by_tag("ash"):
                sprite.pixels = np.array(
                    ash_art(lit))
        else:
            self._repaint("player", figure(EXIT if lit else PLAYER, cell=CELL))
            self._repaint("exit", door(PLAYER if lit else EXIT, None, CELL))

    def _resolve(self, kind: str) -> None:
        if kind == "burn":
            if self._pending == "win":
                self._fx = ("win", self.WIN_FRAMES)
                self._paint_fx("win", self.WIN_FRAMES)
                return
            if self._pending == "die":
                self._fx = ("die", self.DIE_FRAMES)
                self._paint_fx("die", self.DIE_FRAMES)
                return
        elif kind == "win":
            self.next_level()
        else:
            self.level_reset()
        finish_translation(self)

    def step(self) -> None:
        if advance_translation(self):
            return
        begin_translation(self, ('player',), limit=CELL)
        self._beat += 1
        self._paint_decor()

        if self._fx is not None:
            kind, left = self._fx
            left -= 1
            self._fx = (kind, left) if left else None
            self._paint_fx(kind, left)
            if left == 0:
                self._resolve(kind)
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
            before = self.player_cell()
            result=ash_step(self.rows,before,self.ash,self.coolant,self.used_coolant,(dx,dy))
            if result is None:
                finish_translation(self)
                return
            after,new_ash,self.coolant,self.used_coolant=result
            for sprite in self.current_level.get_sprites_by_name('player'):
                sprite.set_position(after[0]*CELL,after[1]*CELL)
            if after != before:
                if after in self.ash:
                    for sprite in self.current_level.get_sprites_by_name(f'ash_{after[0]}_{after[1]}'):
                        self.current_level.remove_sprite(sprite)
                    self.ash.remove(after)
                self._burn(*before)
                self.ash=set(new_ash)
                if after in self.used_coolant:
                    self._repaint(f'coolant_{after[0]}_{after[1]}',ring(3,CELL))
                self._repaint('exit',door(EXIT if exit_open(self.rows,self.used_coolant) else 3,None,CELL))
                self._reveal(*after)
                self._vacated = before
                if after == find_char(self.rows, "X") and exit_open(self.rows,self.used_coolant):
                    self._pending = "win"
                elif self._stuck():
                    self._pending = "die"
                else:
                    self._pending = None
                self._fx = ("burn", self.BURN_FRAMES)
                self._paint_fx("burn", self.BURN_FRAMES)
                finish_translation(self, complete=False)
                return

        finish_translation(self)
