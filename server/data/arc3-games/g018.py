# ARC-AGI-3 candidate task g018.

import numpy as np

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)


def block(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour] * cell for _ in range(cell)]

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

def hatch(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 3 == 0 else -1 for x in range(cell)] for y in range(cell)]

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


N = 16
CELL = 4
WALL_H = -1

FLOOR = 13
RELIEF = 7
ROCK = 0
FLOOD = 10
DAMP_DRY = 10
DAMP_WET = 11
DAMP_SPENT = 10
GOAL = 14
SUMMIT_READY = 14
PLAYER = 14
PLAYER_MARK = 0

DROWNED = object()


B = [1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 1]

LEVELS_SPEC = [{'bands': [1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 1],
  'hills': [(8, 7, 5)],
  'walls': [],
  'damp': [(4, 1), (11, 14)],
  'flags': [(3, 3), (12, 12)],
  'summit': (8, 7),
  'start': (1, 7)},
 {'bands': [1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 1],
  'hills': [(8, 7, 5)],
  'walls': [],
  'damp': [(5, 2), (10, 2), (5, 13), (10, 13)],
  'flags': [(2, 1), (13, 14), (7, 4)],
  'summit': (8, 7),
  'start': (1, 7)},
 {'bands': [1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 1],
  'hills': [(8, 7, 5)],
  'walls': [(2, 3),
            (3, 3),
            (4, 3),
            (5, 3),
            (7, 3),
            (8, 3),
            (9, 3),
            (10, 3),
            (11, 3),
            (12, 3),
            (3, 11),
            (4, 11),
            (5, 11),
            (6, 11),
            (7, 11),
            (9, 11),
            (10, 11),
            (11, 11),
            (12, 11),
            (13, 11)],
  'damp': [(6, 3), (8, 11), (5, 1), (11, 14)],
  'flags': [(2, 1), (13, 14)],
  'summit': (8, 7),
  'start': (1, 7)},
 {'bands': [1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 1],
  'hills': [(11, 7, 5)],
  'walls': [(1, 4),
            (2, 4),
            (3, 4),
            (4, 4),
            (5, 4),
            (6, 4),
            (8, 4),
            (9, 4),
            (10, 4),
            (11, 4),
            (12, 4),
            (13, 4),
            (2, 10),
            (3, 10),
            (4, 10),
            (5, 10),
            (6, 10),
            (7, 10),
            (9, 10),
            (10, 10),
            (11, 10),
            (12, 10),
            (13, 10),
            (14, 10)],
  'damp': [(7, 4), (8, 10), (4, 1), (11, 14)],
  'flags': [(2, 1), (13, 14), (4, 7)],
  'summit': (11, 7),
  'start': (7, 7)},
 {'bands': [1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 1],
  'hills': [(14, 7, 5)],
  'walls': [(1, 4),
            (2, 4),
            (3, 4),
            (4, 4),
            (5, 4),
            (7, 4),
            (8, 4),
            (9, 4),
            (10, 4),
            (11, 4),
            (12, 4),
            (14, 4),
            (1, 10),
            (2, 10),
            (3, 10),
            (4, 10),
            (5, 10),
            (6, 10),
            (7, 10),
            (8, 10),
            (10, 10),
            (11, 10),
            (12, 10),
            (14, 10)],
  'damp': [(6, 4), (9, 10), (2, 2), (13, 13), (2, 13)],
  'flags': [(2, 1), (2, 14), (11, 7)],
  'summit': (14, 7),
  'start': (7, 7)},
 {'bands': [0, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 0],
  'hills': [(8, 7, 5)],
  'walls': [(1, 4),
            (2, 4),
            (3, 4),
            (4, 4),
            (5, 4),
            (7, 4),
            (8, 4),
            (9, 4),
            (10, 4),
            (11, 4),
            (12, 4),
            (13, 4),
            (1, 10),
            (3, 10),
            (4, 10),
            (5, 10),
            (6, 10),
            (7, 10),
            (8, 10),
            (10, 10),
            (11, 10),
            (12, 10),
            (13, 10),
            (14, 10)],
  'damp': [(6, 4), (9, 10), (4, 2), (12, 12), (1, 7)],
  'flags': [(3, 1), (12, 11), (13, 7)],
  'summit': (8, 7),
  'start': (7, 7)},
 {'bands': [1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1],
  'hills': [(8, 7, 4)],
  'walls': [(1, 4),
            (2, 4),
            (3, 4),
            (5, 4),
            (6, 4),
            (7, 4),
            (8, 4),
            (9, 4),
            (10, 4),
            (11, 4),
            (12, 4),
            (13, 4),
            (1, 10),
            (3, 10),
            (4, 10),
            (5, 10),
            (6, 10),
            (7, 10),
            (8, 10),
            (9, 10),
            (11, 10),
            (12, 10),
            (13, 10),
            (14, 10)],
  'damp': [(4, 4), (10, 10), (2, 2), (13, 13), (12, 1)],
  'flags': [(1, 1), (14, 14), (7, 3)],
  'summit': (8, 7),
  'start': (8, 6)},
 {'bands': [1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 1],
  'hills': [(8, 7, 5)],
  'walls': [(1, 4),
            (2, 4),
            (3, 4),
            (4, 4),
            (5, 4),
            (7, 4),
            (8, 4),
            (9, 4),
            (10, 4),
            (11, 4),
            (12, 4),
            (13, 4),
            (14, 4),
            (2, 10),
            (3, 10),
            (4, 10),
            (5, 10),
            (6, 10),
            (7, 10),
            (8, 10),
            (10, 10),
            (11, 10),
            (12, 10),
            (13, 10),
            (14, 10)],
  'damp': [(6, 4), (9, 10), (3, 1), (12, 14), (1, 7), (14, 7)],
  'flags': [(2, 1), (12, 11), (13, 7)],
  'summit': (8, 7),
  'start': (8, 12)},
 {'bands': [1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 1],
  'hills': [(13, 6, 5)],
  'walls': [(7, 1),
            (7, 2),
            (7, 3),
            (7, 4),
            (7, 5),
            (7, 7),
            (7, 8),
            (7, 9),
            (7, 10),
            (7, 11),
            (7, 12),
            (7, 13),
            (7, 14)],
  'damp': [],
  'flags': [],
  'summit': (13, 6),
  'start': (2, 5),
  'embroidery': {'patches': [{'rack': (2, 9),
                              'target': (4, 3),
                              'cells': [(0, 0, 1), (0, 1, 3), (1, 1, 2), (0, 2, 4)],
                              'turn': 0}],
                 'gates': [(7, 6)]}},
 {'bands': [1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 2, 2, 1, 1],
  'hills': [(13, 13, 5)],
  'walls': [(6, 1),
            (6, 2),
            (6, 3),
            (6, 4),
            (6, 5),
            (6, 7),
            (6, 8),
            (6, 9),
            (6, 10),
            (6, 11),
            (6, 12),
            (6, 13),
            (6, 14),
            (11, 1),
            (11, 2),
            (11, 3),
            (11, 4),
            (11, 5),
            (11, 7),
            (11, 8),
            (11, 9),
            (11, 10),
            (11, 11),
            (11, 12),
            (11, 13),
            (11, 14),
            (12, 8),
            (14, 8)],
  'damp': [],
  'flags': [],
  'summit': (13, 13),
  'start': (2, 6),
  'embroidery': {'patches': [{'rack': (2, 10),
                              'target': (2, 3),
                              'cells': [(0, 0, 1), (0, 1, 3), (1, 1, 2), (0, 2, 4)],
                              'turn': 2},
                             {'rack': (7, 10),
                              'target': (7, 3),
                              'cells': [(0, 0, 4), (0, 1, 1), (1, 1, 3), (0, 2, 2)],
                              'turn': 1},
                             {'rack': (12, 1),
                              'target': (12, 4),
                              'cells': [(0, 0, 3), (0, 1, 4), (1, 1, 2), (0, 2, 1)],
                              'turn': 3}],
                 'gates': [(6, 6), (11, 6), (13, 8)]}}]


def build_model(spec: dict) -> dict:
    heights = [[WALL_H] * N for _ in range(N)]
    for y in range(1, N - 1):
        for x in range(1, N - 1):
            heights[y][x] = spec["bands"][y - 1]
    for x, y, h in spec["hills"]:
        heights[y][x] = h
    for x, y in spec["walls"]:
        heights[y][x] = WALL_H
    damp = list(spec["damp"])
    flags = list(spec["flags"])
    assert len(damp) <= 8, "damp count blows up the exhaustive search"
    assert len(flags) <= 4, "flag count blows up the exhaustive search"
    for pos in damp + flags + [spec["summit"], spec["start"]]:
        assert heights[pos[1]][pos[0]] >= 0, f"marked cell {pos} is rock"
    assert not (set(damp) & set(flags)), "a tile cannot be both damp and a flag"
    assert spec["summit"] not in flags and spec["summit"] not in damp
    return {
        "heights": heights,
        "damp": damp,
        "damp_index": {p: i for i, p in enumerate(damp)},
        "flags": flags,
        "flag_index": {p: i for i, p in enumerate(flags)},
        "all_flags": (1 << len(flags)) - 1,
        "summit": spec["summit"],
        "start": spec["start"], "embroidery": spec.get("embroidery"),
    }


MODELS = [build_model(s) for s in LEVELS_SPEC]


def start_state(model: dict) -> tuple:
    sx, sy = model["start"]
    return (sx, sy, -1, 0, 0) if model.get("embroidery") else (sx, sy, 0, 0, 0)


def tally_of(state: tuple) -> int:
    return bin(state[2]).count("1") - state[4]


def is_flooded(model: dict, x: int, y: int, water: int) -> bool:
    h = model["heights"][y][x]
    return h >= 0 and h < water


def apply_move(model: dict, state: tuple, dx: int, dy: int):
    if model.get("embroidery"):
        return stitch_move(model,state,dx,dy)
    x, y, wet, taken, water = state
    nx, ny = x + dx, y + dy
    if not (0 <= nx < N and 0 <= ny < N):
        return state
    h = model["heights"][ny][nx]
    if h < 0 or h < water:
        return state
    if (nx, ny) in model["damp_index"]:
        wet |= 1 << model["damp_index"][(nx, ny)]
    fi = model["flag_index"].get((nx, ny))
    if fi is not None and not (taken & (1 << fi)):
        taken |= 1 << fi
        water += bin(wet).count("1") - water
        if h < water:
            return DROWNED
    return (nx, ny, wet, taken, water)


def is_win(model: dict, state: tuple) -> bool:
    if model.get("embroidery"):
        return state[:2] == model["summit"] and state[4] == (1 << len(model["embroidery"]["patches"]))-1
    return (state[0], state[1]) == model["summit"] and state[3] == model["all_flags"]


def rotated_patch(cells,turn):
    points=list(cells)
    for _ in range(turn%4):points=[(-y,x,ink) for x,y,ink in points]
    left=min(x for x,y,k in points);top=min(y for x,y,k in points)
    return tuple(sorted((x-left,y-top,k) for x,y,k in points))

def stitch_move(model,state,dx,dy):
    x,y,held,turn,opened=state;nx,ny=x+dx,y+dy
    if not (0<=nx<N and 0<=ny<N) or model['heights'][ny][nx]<0:return state
    for i,cell in enumerate(model['embroidery']['gates']):
        if (nx,ny)==tuple(cell) and not opened & (1<<i):return state
    return nx,ny,held,turn,opened

def stitch_use(model,state,cell):
    x,y,held,turn,opened=state;emb=model['embroidery']
    for i,p in enumerate(emb['patches']):
        rack=tuple(p['rack']);target=tuple(p['target'])
        if opened & (1<<i):continue
        if tuple(cell)==rack and abs(x-rack[0])+abs(y-rack[1])<=1:
            if held<0:return x,y,i,0,opened
            if held==i:return x,y,-1,0,opened
        if tuple(cell)==target and held>=0 and abs(x-target[0])+abs(y-target[1])<=1:
            carried=emb['patches'][held]
            if rotated_patch(carried['cells'],turn)==rotated_patch(p['cells'],p['turn']):
                return x,y,-1,0,opened | (1<<i)
    return state

def stitch_rotate(state):
    x,y,held,turn,opened=state
    return (x,y,held,(turn+1)%4,opened) if held>=0 else state

def stitch_choices(model,state):
    for act,(dx,dy) in enumerate(((0,-1),(0,1),(-1,0),(1,0)),1):
        yield act,None,stitch_move(model,state,dx,dy)
    yield 5,None,stitch_rotate(state)
    for p in model['embroidery']['patches']:
        for cell in (p['rack'],p['target']):yield 6,cell,stitch_use(model,state,cell)

BAYER = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))
RELIEF_STEPS = (0, 3, 6, 9, 12, 15)


def _over(base: list[list[int]], mark: list[list[int]]) -> list[list[int]]:
    return [[mark[y][x] if mark[y][x] >= 0 else base[y][x] for x in range(CELL)]
            for y in range(CELL)]


GROUND = tuple(
    [[RELIEF if BAYER[y][x] < n else FLOOR for x in range(CELL)] for y in range(CELL)]
    for n in RELIEF_STEPS
)
WATER_BLOCK = [[FLOOD] * CELL for _ in range(CELL)]
_ROCK_BLOCKS: dict = {}


def _rock(cx: int, cy: int, phase: int) -> list[list[int]]:
    key = (cx, cy, phase)
    got = _ROCK_BLOCKS.get(key)
    if got is None:
        got = [[ROCK] * CELL for _ in range(CELL)]
        got[(cx * 3 + cy * 2) % CELL][(cx + cy * 3) % CELL] = FLOOR
        if (cx * 5 + cy * 7) % 11 == 0:
            got = _over(got, fixture((ROCK, RELIEF, ROCK), phase, cx + cy, CELL))
        _ROCK_BLOCKS[key] = got
    return got


def _player_pixels(sunk: bool = False) -> list[list[int]]:
    if sunk:
        return figure(FLOOD, FLOOD, CELL)
    px = figure(PLAYER, PLAYER_MARK, CELL)
    px[1][1] = PLAYER_MARK
    return px


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for model in MODELS:
        board = Sprite(
            pixels=[[ROCK] * (N * CELL) for _ in range(N * CELL)], name="board",
            blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
            layer=-1, collidable=False,
        ).set_position(0, 0)
        sx, sy = model["start"]
        player = Sprite(
            pixels=_player_pixels(), name="player",
            blocking=BlockingMode.NOT_BLOCKED, interaction=InteractionMode.INTANGIBLE,
            layer=1, collidable=False,
        ).set_position(sx * CELL, sy * CELL)
        levels.append(Level(sprites=[board, player], grid_size=(N * CELL, N * CELL)))
    return levels


class TideLedger(ARCBaseGame):

    RISE_HOLD = 2
    DROWN_FRAMES = 6

    def __init__(self) -> None:
        self.state = start_state(MODELS[0])
        self.cashed = 0
        self.tick = 0
        self.shown_water = None
        self.shown_at = None
        self._rise = 0
        self._drown = 0
        self._stitch_flash = 0
        super().__init__(game_id="g018", levels=build_levels(),
                         camera=Camera(width=N * CELL, height=N * CELL,
                                       background=ROCK, letter_box=ROCK),
                         available_actions=[1, 2, 3, 4, 5, 6])

    @property
    def model(self) -> dict:
        return MODELS[self.level_index]

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
        self.state = start_state(MODELS[self.level_index])
        self.cashed = 0
        self.tick = 0
        self.shown_water = None
        self.shown_at = None
        self._rise = 0
        self._drown = 0
        self._stitch_flash = 0
        self._repaint(level)

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        clear_translation(self)
        super().full_reset()
        self.on_set_level(self.current_level)

    def _repaint(self, level: Level) -> None:
        model = MODELS[self.level_index]
        if model.get("embroidery"):
            self._paint_embroidery(level)
            return
        found = level.get_sprites_by_name("board")
        if not found:
            return
        board = found[0]
        x, y, wet, taken, water = self.state
        if self.shown_water is not None:
            water = self.shown_water
        if self.shown_at is not None:
            x, y = self.shown_at
        pix = board.pixels
        for cy in range(N):
            for cx in range(N):
                h = model["heights"][cy][cx]
                if h < 0:
                    block = _rock(cx, cy, self.tick % 3)
                elif h < water:
                    block = WATER_BLOCK
                else:
                    block = GROUND[h]
                    di = model["damp_index"].get((cx, cy))
                    if di is not None:
                        if not (wet >> di) & 1:
                            block = _over(block, core(DAMP_DRY, CELL))
                        elif (self.cashed >> di) & 1:
                            block = _over(block, hatch(DAMP_SPENT, CELL))
                        else:
                            block = _over(block, core(DAMP_WET, CELL))
                    fi = model["flag_index"].get((cx, cy))
                    if fi is not None:
                        block = _over(block, door(
                            GOAL, FLOOD if (taken >> fi) & 1 else None, CELL))
                    if (cx, cy) == model["summit"]:
                        block = _over(block, ring(GOAL, CELL))
                        if taken == model["all_flags"]:
                            block = _over(block, core(SUMMIT_READY, CELL))
                pix[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL] = \
                    np.array(block, dtype=np.int8)

        players = level.get_sprites_by_name("player")
        if players:
            players[0].set_position(x * CELL, y * CELL)

    def _settle(self) -> None:
        if is_win(self.model, self.state):
            self.next_level()
        finish_translation(self)

    def step(self) -> None:
        if advance_translation(self):
            return
        begin_translation(self, ('player',), limit=CELL)
        self.tick += 1
        if self.model.get("embroidery"):
            self._stitch_action()
            return

        if self._drown:
            self._drown -= 1
            for sp in self.current_level.get_sprites_by_name("player"):
                sp.pixels = np.array(_player_pixels(self._drown % 2 == 0))
            self._repaint(self.current_level)
            if self._drown == 0:
                self.level_reset()
                finish_translation(self)
            return

        if self._rise:
            self._rise -= 1
            if self.shown_water is not None and self.shown_water < self.state[4]:
                self.shown_water += 1
            if self._rise == 0:
                self.shown_water = None
                self.cashed = self.state[2]
            self._repaint(self.current_level)
            if self._rise == 0:
                self._settle()
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
        else:
            finish_translation(self)
            return

        result = apply_move(self.model, self.state, dx, dy)
        if result is DROWNED:
            self.shown_at = (self.state[0] + dx, self.state[1] + dy)
            self.shown_water = self.state[4] + tally_of(self.state)
            self._drown = self.DROWN_FRAMES
            self._repaint(self.current_level)
            return

        rose = result[4] - self.state[4]
        self.state = result
        if rose > 0:
            self.shown_water = result[4] - rose
            self._rise = rose + self.RISE_HOLD
            self._repaint(self.current_level)
            return

        self._repaint(self.current_level)
        self._settle()

    def _paint_embroidery(self,level):
        model=self.model;emb=model['embroidery'];x,y,held,turn,opened=self.state
        pix=np.full((64,64),ROCK,dtype=np.int8)
        for cy in range(1,15):
            for cx in range(1,15):
                h=model['heights'][cy][cx]
                pix[cy*4:cy*4+4,cx*4:cx*4+4]=np.array(GROUND[h] if h>=0 else [[ROCK]*4]*4)
        def cloth(anchor,cells,rim):
            ax,ay=anchor
            for dx,dy,ink in cells:
                px,py=(ax+dx)*4,(ay+dy)*4
                if px<0 or py<0 or px+4>64 or py+4>64:continue
                block=np.array(GROUND[ink],dtype=np.int8)
                block[0,:]=rim;block[:,0]=rim
                pix[py:py+4,px:px+4]=block
        for i,p in enumerate(emb['patches']):
            installed=bool(opened & (1<<i))
            cloth(p['target'],rotated_patch(p['cells'],p['turn']),14 if installed else 10)
            tx,ty=p['target'];pix[ty*4,tx*4]=0
            if not installed and held!=i:cloth(p['rack'],rotated_patch(p['cells'],0),12)
            gx,gy=emb['gates'][i]
            pix[gy*4:gy*4+4,gx*4:gx*4+4]=14 if installed else 10
            if not installed:pix[gy*4+1:gy*4+3,gx*4+1:gx*4+3]=5
        ex,ey=model['summit'];pix[ey*4:ey*4+4,ex*4:ex*4+4]=np.array(ring(GOAL,CELL))
        if held>=0:
            pix[0:16,48:64]=5
            cloth((12,0),rotated_patch(emb['patches'][held]['cells'],turn),0)
        if self._stitch_flash:
            for i,(gx,gy) in enumerate(emb['gates']):
                if opened & (1<<i):pix[gy*4:gy*4+4,gx*4:gx*4+4]=0 if self._stitch_flash%2 else 14
        level.get_sprites_by_name('board')[0].pixels=pix
        level.get_sprites_by_name('player')[0].set_position(x*4,y*4)

    def _stitch_action(self):
        if self._stitch_flash:
            self._stitch_flash-=1;self._paint_embroidery(self.current_level)
            if not self._stitch_flash:self._settle()
            return
        old=self.state;act=self.action.id
        d={GameAction.ACTION1:(0,-1),GameAction.ACTION2:(0,1),GameAction.ACTION3:(-1,0),GameAction.ACTION4:(1,0)}.get(act)
        if d is not None:self.state=stitch_move(self.model,self.state,*d)
        elif act==GameAction.ACTION5:self.state=stitch_rotate(self.state)
        elif act==GameAction.ACTION6:
            cell=(self.action.data.get('x',-4)//4,self.action.data.get('y',-4)//4)
            for p in self.model['embroidery']['patches']:
                for key,angle in (('rack',0),('target',p['turn'])):
                    ax,ay=p[key]
                    if cell==(ax,ay) or any(cell==(ax+dx,ay+dy) for dx,dy,k in rotated_patch(p['cells'],angle)):
                        self.state=stitch_use(self.model,self.state,p[key])
        self._paint_embroidery(self.current_level)
        if self.state[4]!=old[4]:self._stitch_flash=6;return
        self._settle()
