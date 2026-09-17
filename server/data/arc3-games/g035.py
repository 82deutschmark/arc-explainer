# ARC-AGI-3 candidate task g035.

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


FLOOR = 2
WALL = 5
PLAYER = 14
EXIT = 0

HAZARD_AMBER = 12
HAZARD_CYAN = 10
HAZARD_GOLD = 11
HAZARD_COLOUR = {"A": HAZARD_AMBER, "C": HAZARD_CYAN, "G": HAZARD_GOLD}

W = 19
H = 19
CELL = 3
SLOTS = 4


LEVELS_SPEC = [{'gear': {'a': (0, 'A')},
  'rows': ['###################',
           '#.....#.....#.....#',
           '#.P...#.....#.....#',
           '#...a.A..X..A.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###A#####A#####A###',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....A.....A.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###A#####A#####A###',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....A.....A.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###################']},
 {'gear': {'a': (0, 'A'), 'b': (2, 'A'), 'c': (1, 'C')},
  'rows': ['###################',
           '#....b#.....#.....#',
           '#.P...#.....#.....#',
           '#.....A.....C..X..#',
           '#.a...#..c..#.....#',
           '#.....#.....#.....#',
           '###A#####A#########',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###################',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###################']},
 {'gear': {'a': (0, 'A'), 'c': (1, 'C'), 'd': (0, 'C'), 'g': (0, 'G')},
  'rows': ['###################',
           '#P....#.....#.....#',
           '#.....#.....#.....#',
           '#.....A....cA.....#',
           '#...a.#.....#.....#',
           '#.g...#.....#.....#',
           '###G#####C#########',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#..d..C..X..#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###################',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###################']},
 {'gear': {'a': (0, 'A'), 'b': (0, 'C'), 'c': (1, 'C'), 'e': (3, 'C')},
  'rows': ['###################',
           '#.....#.....#.....#',
           '#.P..b#.....#.....#',
           '#.....A..e..A.....#',
           '#.a...#.....#.....#',
           '#.....#.....#....c#',
           '###A#####A#####C###',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#..X..#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###################',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###################']},
 {'gear': {'a': (0, 'A'), 'c': (1, 'C'), 'd': (3, 'A'), 'e': (2, 'A'), 'f': (3, 'A'), 'g': (3, 'G')},
  'rows': ['###################',
           '#.....#.....#.....#',
           '#.P...#.....#.....#',
           '#.....A..c..A.....#',
           '#.a...#.....#.....#',
           '#.....#....d#.....#',
           '#########C#########',
           '#.....#.....#.....#',
           '#.....#....f#.....#',
           '#.....#..e..#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#########A#########',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#..g..G..X..#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###################']},
 {'gear': {'a': (0, 'A'),
           'b': (2, 'A'),
           'c': (1, 'C'),
           'd': (3, 'C'),
           'e': (2, 'A'),
           'f': (3, 'C'),
           'h': (3, 'A')},
  'rows': ['###################',
           '#P...b#.....#e....#',
           '#.....#.....#.....#',
           '#.....A..c..C.....#',
           '#.....#.....#.....#',
           '#a....#....d#....h#',
           '###############A###',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#..f..#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###############C###',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#..X..#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###################']},
 {'gear': {'a': (0, 'A'),
           'b': (0, 'C'),
           'c': (1, 'C'),
           'd': (2, 'C'),
           'e': (2, 'G'),
           'f': (3, 'G'),
           'g': (3, 'A'),
           'h': (3, 'C')},
  'rows': ['###################',
           '#P...b#.....#.....#',
           '#.....#.....#.....#',
           '#.....A.....#.....#',
           '#.....#.....#.....#',
           '#....a#.....#.....#',
           '###A###############',
           '#....d#....e#.....#',
           '#.....#.....#.....#',
           '#.....C.....#.....#',
           '#.....#.....#.....#',
           '#c....#f....#.....#',
           '#########G#########',
           '#.....#....h#.....#',
           '#.....#.....#.....#',
           '#.....#.....A..X..#',
           '#.....#.....#.....#',
           '#.....#g....#.....#',
           '###################']},
 {'gear': {'a': (0, 'A'), 'b': (1, 'C'), 'c': (2, 'G')},
  'rows': ['###################',
           '#.c...#.....#.....#',
           '#.....#.....#.....#',
           '#.P.a.C.!...M...X.#',
           '#.....#.....#.....#',
           '#..b..#.....#.....#',
           '###################',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###################',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###################'],
  'patterns': {'M': [(0, 'A')]}},
 {'gear': {'a': (0, 'A'), 'b': (1, 'C'), 'c': (2, 'G'), 'd': (3, 'A'), 'e': (2, 'C')},
  'rows': ['###################',
           '#..b..#.....#.e...#',
           '#.....#.c...#.....#',
           '#.P...C.....G...!.#',
           '#.....#.....#.....#',
           '#...a.#.d...#.....#',
           '###############M###',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.X...N..!..#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###################',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '#.....#.....#.....#',
           '###################'],
  'patterns': {'M': [(0, 'A'), (1, 'C')], 'N': [(0, 'A')]}}]


def door_at(rows, x: int, y: int):
    ch = rows[y][x]
    return ch if ch in HAZARD_COLOUR or ch in "MN" else None


def is_plaster(rows, x: int, y: int) -> bool:
    return not (0 <= x < W and 0 <= y < H) or rows[y][x] == "#"


def gear_at(spec, x: int, y: int):
    ch = spec["rows"][y][x]
    return ch if ch in spec["gear"] else None


def worn_stack(spec, worn) -> list:
    return sorted((spec["gear"][k] for k in worn), key=lambda g: g[0])


def can_pull_on(spec, worn, key: str) -> bool:
    if key in worn:
        return False
    slot = spec["gear"][key][0]
    filled = {s for s, _ in worn_stack(spec, worn)}
    return all(s not in filled for s in range(slot, SLOTS))


def shielded(stack) -> frozenset:
    return frozenset(
        c for i, (_, c) in enumerate(stack)
        if all(outer == c for _, outer in stack[i + 1:])
    )


def entry_cell(rows):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "P":
                return x, y
    raise AssertionError("level has no start")


def way_out_cell(rows):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "X":
                return x, y
    raise AssertionError("level has no way out")


def passable(spec, worn, x: int, y: int) -> bool:
    ch=spec['rows'][y][x]
    if ch in spec.get('patterns',{}):
        return layer_pattern(worn_stack(spec,worn)) == layer_pattern(spec['patterns'][ch])
    return ch not in HAZARD_COLOUR or ch in shielded(worn_stack(spec,worn))


def layer_pattern(stack):
    pixels=[[-1]*3 for _ in range(3)]
    for slot,colour in sorted(stack):
        for y,x in GEAR_COVER[slot]: pixels[y][x]=HAZARD_COLOUR[colour]
    return tuple(tuple(row) for row in pixels)

def dress_action(spec,worn,x,y):
    if spec['rows'][y][x]=='!' and worn:
        outer=max(worn,key=lambda k:spec['gear'][k][0])
        return tuple(k for k in worn if k!=outer)
    key=gear_at(spec,x,y)
    if key is not None and can_pull_on(spec,worn,key):return tuple(sorted(worn+(key,)))
    return worn

def pattern_pixels(pattern):
    px=[[WALL]*5 for _ in range(5)]
    for y,row in enumerate(pattern):
        for x,c in enumerate(row):px[y+1][x+1]=FLOOR if c<0 else c
    px[0][0]=px[0][4]=px[4][0]=px[4][4]=0
    return px

GEAR_COVER = (
    ((0, 0), (0, 2), (2, 0), (2, 2)),
    ((0, 0), (0, 2), (2, 0), (2, 2), (1, 1)),
    ((0, 0), (0, 2), (2, 0), (2, 2), (1, 1), (1, 0), (1, 2)),
    ((0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2)),
)

FIGURE_CORE = ((0, 1), (1, 0), (1, 1), (1, 2), (2, 1))
FIGURE_SHOULDERS = ((0, 0), (0, 2), (2, 0), (2, 2))


def _solid(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _blank() -> list[list[int]]:
    return [[-1] * CELL for _ in range(CELL)]


def _doorway(colour: int, across: bool) -> list[list[int]]:
    block = _solid(WALL)
    for i in range(CELL):
        if across:
            block[CELL // 2][i] = colour
        else:
            block[i][CELL // 2] = colour
    return block


def _gear_pixels(slot: int, door: str) -> list[list[int]]:
    return pattern_pixels(layer_pattern([(slot,door)]))


def _figure(body: int, coat: int | None) -> list[list[int]]:
    px=[[-1,body,body,body,-1],[body,body,0,body,body],[body,body,body,body,body],[-1,body,body,body,-1],[-1,body,-1,body,-1]]
    if coat is not None:
        for y,x in ((1,0),(1,4),(2,0),(2,4)):px[y][x]=coat
    return px


def _walks_across(rows, x: int, y: int) -> bool:
    return is_plaster(rows, x, y - 1) and is_plaster(rows, x, y + 1)


def build_levels() -> list[Level]:
    levels=[]
    for spec in LEVELS_SPEC:
        sprites=[]
        for y,row in enumerate(spec['rows']):
            for x,ch in enumerate(row):
                pixels=None;layer=0;offset=0;name=f't_{x}_{y}'
                if ch=='#':pixels=_solid(WALL);layer=-1
                elif ch in HAZARD_COLOUR:pixels=_doorway(HAZARD_COLOUR[ch],_walks_across(spec['rows'],x,y));layer=-1
                elif ch in spec.get('patterns',{}):pixels=pattern_pixels(layer_pattern(spec['patterns'][ch]));offset=-1;layer=1
                elif ch=='!':pixels=[[0,-1,-1,-1,0],[-1,0,-1,0,-1],[-1,-1,0,-1,-1],[-1,0,-1,0,-1],[0,-1,-1,-1,0]];offset=-1
                elif ch=='X':pixels=[[EXIT,EXIT,EXIT],[EXIT,PLAYER,EXIT],[EXIT,EXIT,EXIT]];name='way_out'
                elif ch in spec['gear']:
                    pixels=_gear_pixels(*spec['gear'][ch]);name=f'gear_{ch}';offset=-1
                elif ch=='P':pixels=_figure(PLAYER,None);name='figure';offset=-1;layer=2
                if pixels is not None:
                    sprites.append(Sprite(pixels=pixels,name=name,blocking=BlockingMode.NOT_BLOCKED,interaction=InteractionMode.INTANGIBLE,layer=layer).set_position(x*CELL+offset,y*CELL+offset))
        levels.append(Level(sprites=sprites,grid_size=(W*CELL,H*CELL)))
    return levels


class SlotStrip(RenderableUserDisplay):

    LEFT = 21
    TOP = 61
    THICK = 3

    def __init__(self, game: "DressCode") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        filled = dict(worn_stack(LEVELS_SPEC[self._game.level_index], self._game.worn))
        x = self.LEFT
        for slot in range(SLOTS):
            width = slot + 3
            colour = HAZARD_COLOUR[filled[slot]] if slot in filled else WALL
            frame[self.TOP:self.TOP + self.THICK, x:x + width] = colour
            x += width + 1
        if LEVELS_SPEC[self._game.level_index].get('patterns'):
            px=pattern_pixels(layer_pattern(worn_stack(LEVELS_SPEC[self._game.level_index],self._game.worn)))
            frame[58:63,4:9]=np.array(px,dtype=np.int8)
        return frame


class DressCode(ARCBaseGame):

    FLASH_FRAMES = 4

    def __init__(self) -> None:
        self._flash = 0
        self.worn: tuple = ()
        self.px, self.py = entry_cell(LEVELS_SPEC[0]["rows"])
        camera = Camera(
            width=W * CELL, height=H * CELL,
            background=FLOOR, letter_box=FLOOR,
            interfaces=[SlotStrip(self)],
        )
        super().__init__(game_id="g035", levels=build_levels(), camera=camera, available_actions=[1,2,3,4,5])

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
        self._flash = 0
        self.worn = ()
        self.px, self.py = entry_cell(LEVELS_SPEC[self.level_index]["rows"])

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        clear_translation(self)
        super().full_reset()
        self.on_set_level(self.current_level)

    def _spec(self) -> dict:
        return LEVELS_SPEC[self.level_index]

    def _outermost(self) -> int | None:
        stack = worn_stack(self._spec(), self.worn)
        return HAZARD_COLOUR[stack[-1][1]] if stack else None

    def _place_figure(self) -> None:
        found = self.current_level.get_sprites_by_name("figure")
        if found:
            found[0].pixels = np.array(_figure(PLAYER, self._outermost()))
            found[0].set_position(self.px * CELL-1, self.py * CELL-1)

    def _pull_on_here(self) -> None:
        spec=self._spec();before=self.worn
        self.worn=dress_action(spec,self.worn,self.px,self.py)
        if before==self.worn:return
        for key in set(before)-set(self.worn):
            for y,row in enumerate(spec['rows']):
                if key in row:
                    x=row.index(key)
                    self.current_level.add_sprite(Sprite(pixels=_gear_pixels(*spec['gear'][key]),name=f'gear_{key}',blocking=BlockingMode.NOT_BLOCKED,interaction=InteractionMode.INTANGIBLE,layer=0).set_position(x*CELL-1,y*CELL-1))
        for key in set(self.worn)-set(before):
            for sprite in self.current_level.get_sprites_by_name(f'gear_{key}'):self.current_level.remove_sprite(sprite)
        self._place_figure()

    def step(self) -> None:
        if advance_translation(self):
            return
        begin_translation(self, ('figure',), limit=CELL)
        if self._flash:
            self._flash -= 1
            found = self.current_level.get_sprites_by_name("figure")
            if found:
                lit = self._flash % 2 == 0
                found[0].pixels = np.array(
                    _figure(PLAYER if lit else WALL, self._outermost() if lit else None))
            if self._flash == 0:
                self.level_reset()
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
        elif self.action.id == GameAction.ACTION5:
            self._pull_on_here()
            finish_translation(self)
            return

        if dx or dy:
            spec = self._spec()
            nx, ny = self.px + dx, self.py + dy
            if not is_plaster(spec["rows"], nx, ny):
                self.px, self.py = nx, ny
                self._place_figure()
                if (nx, ny) == way_out_cell(spec["rows"]):
                    self.next_level()
                    finish_translation(self)
                    return
                if not passable(spec, self.worn, nx, ny):
                    self._flash = self.FLASH_FRAMES
                    return

        finish_translation(self)
