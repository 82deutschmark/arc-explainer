# ARC-AGI-3 candidate task g044.

import numpy as np

from arcengine import (
    RenderableUserDisplay,
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)


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


VOID = 5
FLOOR = 0
WALL = 4
KEY = 12
EXIT = 14
PLAYER = 13

N = 16
S = 4
CELL = 7

DIRS = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
}


def _neg(v):
    return (-v[0], -v[1], -v[2])


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _scale(v, k):
    return (v[0] * k, v[1] * k, v[2] * k)


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def net_slots(rows: list[str]) -> list[tuple[int, int]]:
    out = []
    for fy in range(N // S):
        for fx in range(N // S):
            if any(rows[fy * S + j][fx * S + i] != " " for j in range(S) for i in range(S)):
                out.append((fx, fy))
    return out


def fold_faces(rows: list[str]) -> list[tuple[tuple[int, int], tuple, tuple, tuple]]:
    slots = set(net_slots(rows))
    start = sorted(slots, key=lambda s: (s[1], s[0]))[0]
    frames = {start: ((0, 0, 1), (1, 0, 0), (0, 1, 0))}
    stack = [start]
    while stack:
        slot = stack.pop()
        n, r, d = frames[slot]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nxt = (slot[0] + dx, slot[1] + dy)
            if nxt not in slots or nxt in frames:
                continue
            if dx == 1:
                frames[nxt] = (r, _neg(n), d)
            elif dx == -1:
                frames[nxt] = (_neg(r), n, d)
            elif dy == 1:
                frames[nxt] = (d, r, _neg(n))
            else:
                frames[nxt] = (_neg(d), r, n)
            stack.append(nxt)
    order = sorted(frames, key=lambda s: (s[1], s[0]))
    return [(s, frames[s][0], frames[s][1], frames[s][2]) for s in order]


def step_cell(faces, fi: int, u: int, v: int, du: int, dv: int):
    nu, nv = u + du, v + dv
    if 0 <= nu < S and 0 <= nv < S:
        return fi, nu, nv, du, dv
    _, n, r, d = faces[fi]
    if nu >= S:
        e = r
    elif nu < 0:
        e = _neg(r)
    elif nv >= S:
        e = d
    else:
        e = _neg(d)
    p = _add(_scale(n, S), _add(_scale(r, 2 * u - (S - 1)), _scale(d, 2 * v - (S - 1))))
    q = _add(_sub(p, n), e)
    ni = next(i for i, f in enumerate(faces) if f[1] == e)
    _, _, r2, d2 = faces[ni]
    heading = _neg(n)
    return (ni, (_dot(q, r2) + (S - 1)) // 2, (_dot(q, d2) + (S - 1)) // 2,
            _dot(heading, r2), _dot(heading, d2))


LIPS = {">": (1, 0), "<": (-1, 0), "v": (0, 1), "^": (0, -1)}


def attempt(rows: list[str], faces, fi: int, u: int, v: int, du: int, dv: int):
    nf, nu, nv, ndu, ndv = step_cell(faces, fi, u, v, du, dv)
    char = cell_char(rows, faces, nf, nu, nv)
    if char == "#":
        return None
    if char in LIPS and LIPS[char] != (ndu, ndv):
        return None
    return nf, nu, nv, char, ndu, ndv


def cell_char(rows: list[str], faces, fi: int, u: int, v: int) -> str:
    sx, sy = faces[fi][0]
    return rows[sy * S + v][sx * S + u]


def cell_screen(faces, fi: int, u: int, v: int) -> tuple[int, int]:
    sx, sy = faces[fi][0]
    return sx * S + u, sy * S + v


def find_chars(rows, faces, want: str) -> list[tuple[int, int, int]]:
    return [(fi, u, v) for fi in range(len(faces)) for u in range(S) for v in range(S)
            if cell_char(rows, faces, fi, u, v) == want]


LEVELS_SPEC = [
    {"rows": [
        "    .k..        ",
        "    ....        ",
        "    ....        ",
        "    ....        ",
        ".....P..........",
        ".k........k..k..",
        ".....k..........",
        "....####........",
        "    ....        ",
        "    .k..        ",
        "    ..X.        ",
        "    ....        ",
        "                ",
        "                ",
        "                ",
        "                ",
    ]},
    {"rows": [
        ".P..            ",
        "....            ",
        "..k.            ",
        "....            ",
        "#..#....        ",
        ".k....k.        ",
        ".......#        ",
        "........        ",
        "    #.....>.    ",
        "    .k....kv    ",
        "    ......##    ",
        "    ........    ",
        "        ....    ",
        "        ..k.    ",
        "        ..X.    ",
        "        ....    ",
    ]},
    {"rows": [
        "        .k..    ",
        "        ....    ",
        "        ####    ",
        "        ....    ",
        ".P......####....",
        "####.k....k.vk..",
        ".k^...#........^",
        "................",
        "####            ",
        "..k.            ",
        ".X..            ",
        "....            ",
        "                ",
        "                ",
        "                ",
        "                ",
    ]},
    {"rows": [
        "        .P......",
        "        .^....k.",
        "        .k....#.",
        "        v....>.v",
        "    ....####    ",
        "    .k....k.    ",
        "    #.......    ",
        "    .....>..    ",
        ".X......        ",
        "......k.        ",
        ".k..####        ",
        "........        ",
        "                ",
        "                ",
        "                ",
        "                ",
    ]},
    {"rows": [
        ".k..            ",
        "....            ",
        "####            ",
        "....            ",
        ".P....#.....vk.>",
        ".....k#.#k..####",
        ".k....#.........",
        ".....^..........",
        "            ....",
        "            ..kv",
        "            .X..",
        "            ...v",
        "                ",
        "                ",
        "                ",
        "                ",
    ]},
    {"rows": [
        "    #k#.        ",
        "    .>..        ",
        "    ####        ",
        "    ....        ",
        "...#.P#......#..",
        ".k.#.>#...k^.kv.",
        "..##.k#.#...>#..",
        "....########....",
        "    ####        ",
        "    .k..        ",
        "    ..X.        ",
        "    ....        ",
        "                ",
        "                ",
        "                ",
        "                ",
    ]},
    {"rows": [
        "    vk..        ",
        "    ####        ",
        "    ....        ",
        "    .vv.        ",
        "..#<vP..####    ",
        ".k..#####k..    ",
        "..#.<k...^..    ",
        "########....    ",
        "    ####        ",
        "    .k..        ",
        "    ####        ",
        "    ....        ",
        "    ....        ",
        "    ..k.        ",
        "    .X..        ",
        "    ....        ",
    ]},
]


def _block(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _rounded(colour):
    return [[colour if abs(x-3)+abs(y-3)<=2 else -1 for x in range(CELL)] for y in range(CELL)]


def _walker(colour, du=0, dv=1):
    block=[[-1]*CELL for _ in range(CELL)]
    for y in range(1,6):
        for x in range(1,6):
            if (x-3)**2+(y-3)**2<=7:block[y][x]=colour
    block[3+dv*2][3+du*2]=0
    block[3+dv][3+du]=0
    return block


def _lip(direction):
    out=[[-1]*CELL for _ in range(CELL)]
    dx,dy=direction
    for t in range(-2,3):out[3+dy*t][3+dx*t]=9
    for side in (-1,1):out[3+dy+dx*side][3+dx-dy*side]=9
    return out


def _face_block():
    return [[1 if x % CELL == 0 or y % CELL == 0 else FLOOR for x in range(S*CELL)] for y in range(S*CELL)]


def _exit_ring() -> list[list[int]]:
    block = _block(EXIT)
    for j in range(1, CELL - 1):
        for i in range(1, CELL - 1):
            block[j][i] = -1
    return block


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites: list[Sprite] = []
        for fx, fy in net_slots(rows):
            sprites.append(Sprite(
                pixels=_face_block(), name=f"face_{fx}_{fy}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.TANGIBLE, layer=-2,
            ).set_position(fx * S * CELL, fy * S * CELL))
        for y, row in enumerate(rows):
            for x, char in enumerate(row):
                if char in " .P":
                    continue
                if char == "#":
                    pixels, layer, name = _block(WALL), -1, f"w_{x}_{y}"
                elif char in LIPS:
                    pixels, layer, name = _lip(LIPS[char]), -1, f"l_{x}_{y}"
                elif char == "k":
                    pixels, layer, name = _rounded(KEY), 0, f"k_{x}_{y}"
                else:
                    pixels, layer, name = _exit_ring(), 0, "exit"
                sprites.append(Sprite(
                    pixels=pixels, name=name,
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.TANGIBLE, layer=layer,
                ).set_position(x * CELL, y * CELL))
        sprites.append(Sprite(
            pixels=_walker(PLAYER), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.TANGIBLE, layer=1,
        ).set_position(0, 0))
        levels.append(Level(sprites=sprites, grid_size=(64, 64)))
    return levels


EDGE_COLOURS = (6, 7, 8, 9, 10, 11, 12, 14, 15, 2, 3, 1)

class FoldDisplay(RenderableUserDisplay):
    def __init__(self,game):
        super().__init__()
        self.game=game

    def render_interface(self,frame):
        g=self.game
        seams={}
        for fi in range(6):
            for du,dv in ((0,-1),(0,1),(-1,0),(1,0)):
                u=0 if du<0 else S-1 if du>0 else 1
                v=0 if dv<0 else S-1 if dv>0 else 1
                nf,nu,nv,_,_=step_cell(g.faces,fi,u,v,du,dv)
                a=cell_screen(g.faces,fi,u,v);b=cell_screen(g.faces,nf,nu,nv)
                if (b[0]-a[0],b[1]-a[1])==(du,dv):continue
                key=tuple(sorted((fi,nf)))
                seams.setdefault(key,len(seams))
                col=EDGE_COLOURS[seams[key]]
                fx,fy=g.faces[fi][0]
                for t in range(S*CELL):
                    wx=fx*S*CELL + (0 if du<0 else S*CELL-1 if du>0 else t)
                    wy=fy*S*CELL + (0 if dv<0 else S*CELL-1 if dv>0 else t)
                    x,y=wx-g.camera.x,wy-g.camera.y
                    if 0<=x<64 and 0<=y<56:frame[y,x]=col
        frame[56:,:]=5
        for i in range(6):
            left=2+i*5;live=any(f==i for f,u,v in g.keys_left)
            frame[59:62,left:left+3]=KEY if live else 14
        for i,(slot,_,_,_) in enumerate(g.faces):
            x,y=50+slot[0]*3,56+slot[1]*2
            frame[y:y+2,x:x+3]=2
            frame[y,x+1]=14 if not any(f==i for f,u,v in g.keys_left) else KEY
            if i==g.face:frame[y:y+2,x:x+3]=0
        if g.crossing:
            sx,sy=cell_screen(g.faces,g.face,g.u,g.v)
            cx,cy=sx*CELL+3-g.camera.x,sy*CELL+3-g.camera.y
            radius=8-g.crossing
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,1),(1,-1),(-1,-1)):
                x,y=cx+dx*radius,cy+dy*radius
                if 0<=x<64 and 0<=y<56:frame[y,x]=10 if g.crossing%2 else 0
        return frame


class Rind(ARCBaseGame):

    def __init__(self) -> None:
        self.faces = fold_faces(LEVELS_SPEC[0]["rows"])
        self.face = self.u = self.v = 0
        self.heading = (0, 1)
        self.keys_left: set[tuple[int, int, int]] = set()
        self.crossing = 0
        self.cross_from = (0, 0)
        camera = Camera(
            width=64, height=64,
            background=VOID, letter_box=VOID, interfaces=[FoldDisplay(self)],
        )
        super().__init__(game_id="g044", levels=build_levels(), camera=camera, available_actions=[1,2,3,4])

    @property
    def rows(self) -> list[str]:
        return LEVELS_SPEC[self.level_index]["rows"]

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
        rows = self.rows
        self.faces = fold_faces(rows)
        self.face, self.u, self.v = find_chars(rows, self.faces, "P")[0]
        self.heading = (0, 1)
        self.crossing = 0
        self.keys_left = set(find_chars(rows, self.faces, "k"))
        self._sync()

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        clear_translation(self)
        super().full_reset()
        self.on_set_level(self.current_level)

    def _follow_camera(self):
        sx,sy=cell_screen(self.faces,self.face,self.u,self.v)
        self.camera.x=max(0,min(N*CELL-64,sx*CELL-28))
        self.camera.y=max(0,min(N*CELL-56,sy*CELL-25))

    def _sync(self) -> None:
        self._follow_camera()
        """Draw the model. The player is the only thing that moves; the exit fills in the
        moment the last key is off the board."""
        player = self.current_level.get_sprites_by_name("player")
        if player:
            sx, sy = cell_screen(self.faces, self.face, self.u, self.v)
            player[0].set_position(sx * CELL, sy * CELL)
            player[0].pixels[:, :] = _walker(PLAYER, *self.heading)
        exits = self.current_level.get_sprites_by_name("exit")
        if exits:
            fill = EXIT if not self.keys_left else FLOOR
            exits[0].pixels[1:CELL - 1, 1:CELL - 1] = fill

    def step(self) -> None:
        if advance_translation(self):
            return
        begin_translation(self, ('player',), limit=CELL)
        if self.crossing:
            self.crossing -= 1
            if not self.crossing:finish_translation(self)
            return
        before=cell_screen(self.faces,self.face,self.u,self.v)
        d = DIRS.get(self.action.id)
        if d is None:
            finish_translation(self)
            return

        landed = attempt(self.rows, self.faces, self.face, self.u, self.v, d[0], d[1])
        if landed is not None:
            nf, nu, nv, char, ndu, ndv = landed
            if char == "X":
                if not self.keys_left:
                    self.next_level()
                    finish_translation(self)
                    return
            else:
                self.face, self.u, self.v = nf, nu, nv
                self.heading = (ndu, ndv)
                if (nf, nu, nv) in self.keys_left:
                    self.keys_left.discard((nf, nu, nv))
                    sx, sy = cell_screen(self.faces, nf, nu, nv)
                    for sprite in self.current_level.get_sprites_by_name(f"k_{sx}_{sy}"):
                        self.current_level.remove_sprite(sprite)

        self._sync()
        after=cell_screen(self.faces,self.face,self.u,self.v)
        if after != before and (after[0]-before[0],after[1]-before[1]) != d:
            self.crossing=6
            self.cross_from=before
            return
        finish_translation(self)
