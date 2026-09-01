# ARC-AGI-3 candidate task tc6f8ee4c.

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

FLOOR = 4
WALL = 1
TRACK = 2
BELL = 11
PLATE_OFF = 9
PLATE_ON = 10
GUARD = 8
PLAYER = 12
EXIT_SHUT = 13
EXIT_OPEN = 14
PIP_ON = 14
PIP_OFF = 5

N = 16
CELL = 4

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


def _bell_pixels() -> list[list[int]]:
    px = _block(TRACK)
    px[1][1] = px[1][2] = px[2][1] = px[2][2] = BELL
    return px


def _plate_pixels(lit: bool) -> list[list[int]]:
    px = _block(PLATE_ON if lit else PLATE_OFF)
    px[0][0] = px[0][CELL - 1] = px[CELL - 1][0] = px[CELL - 1][CELL - 1] = TRACK
    return px


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
                    sprites.append(_sprite(_block(TRACK), f"track_{x}_{y}", x, y, -2))
        for x, y in m["bells"]:
            sprites.append(_sprite(_bell_pixels(), f"bell_{x}_{y}", x, y, -1))
        for x, y in m["plates"]:
            sprites.append(_sprite(_plate_pixels(False), f"plate_{x}_{y}", x, y, 0))
        ex, ey = m["exit"]
        sprites.append(_sprite(_block(EXIT_SHUT), "exit", ex, ey, 0))
        for i, (gx, gy) in enumerate(m["posts"]):
            sprites.append(_sprite(_block(GUARD), f"guard_{i}", gx, gy, 2))
        sx, sy = m["start"]
        sprites.append(_sprite(_block(PLAYER), "player", sx, sy, 3))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G1fa1389f(RenderableUserDisplay):

    def __init__(self, game: "G92073027") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        m = model(self._game.level_index)
        on = set(self._game.guards)
        for i, plate in enumerate(m["plates"]):
            x = 1 + i * 3
            if x + 2 > frame.shape[1]:
                break
            frame[1:3, x:x + 2] = PIP_ON if plate in on else PIP_OFF
        return frame


class G92073027(ARCBaseGame):

    def __init__(self) -> None:
        m = model(0)
        self.pos = m["start"]
        self.guards = m["posts"]
        self.target = None
        self.deaths = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G1fa1389f(self)],
        )
        super().__init__(game_id="tc6f8ee4c", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        m = model(self.level_index)
        self.pos = m["start"]
        self.guards = m["posts"]
        self.target = None

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)
        self._redraw()

    def full_reset(self) -> None:
        super().full_reset()
        self.deaths = 0
        self.on_set_level(self.current_level)
        self._redraw()

    def _redraw(self) -> None:
        level = self.current_level
        m = model(self.level_index)
        for i, (gx, gy) in enumerate(self.guards):
            for s in level.get_sprites_by_name(f"guard_{i}"):
                s.set_position(gx * CELL, gy * CELL)
        for s in level.get_sprites_by_name("player"):
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
        level.add_sprite(_sprite(_block(EXIT_OPEN if live else EXIT_SHUT),
                                 "exit", ex, ey, 0))

    def step(self) -> None:
        move = MOVES.get(self.action.id)
        if move is None:
            self.complete_action()
            return

        self.pos, self.guards, self.target, dead, won = resolve(
            self.level_index, self.pos, self.guards, self.target, move)

        if dead:
            self.deaths += 1
            self.level_reset()
            self.complete_action()
            return

        self._redraw()
        if won:
            self.next_level()
        self.complete_action()
