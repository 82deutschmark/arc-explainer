# ARC-AGI-3 candidate task g030.

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
from sprite_book import block, door, hatch, medallion, ring, weave

VOID_BG = 4
ROCK_WALL = 8
PLATE_SEAM = 1
LATCH_GATE = 15
DIGGER_AVATAR = 6
TWIN_GHOST = 7

N = 20
CELL = 3
PAD = (64 - N * CELL) // 2
MAX_TAPE = 5

LEVELS_SPEC = [
    [
        "####################",
        "####################",
        "####################",
        "####################",
        "#########s##########",
        "#########.##########",
        "#########.##########",
        "#########p##########",
        "#########.##########",
        "#########.##########",
        "#########D##########",
        "#########g##########",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
    ],
    [
        "####################",
        "####################",
        "####################",
        "####################",
        "#######s############",
        "#######.############",
        "#######.############",
        "#######p############",
        "#######....Dg#######",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
    ],
    [
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "############p#######",
        "############.#######",
        "####s........#######",
        "############.#######",
        "############D#######",
        "############g#######",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
    ],
    [
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "############p#######",
        "############p#######",
        "############.#######",
        "####s........#######",
        "############.#######",
        "############D#######",
        "############D#######",
        "############g#######",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
    ],
    [
        "####################",
        "####################",
        "####################",
        "####################",
        "######B####p########",
        "######.####.########",
        "######.####.########",
        "###s........########",
        "###########D########",
        "###########E########",
        "###########g########",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
    ],
    [
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "#######B#####p######",
        "#######.#####.######",
        "#######.#####.######",
        "#######.#####.######",
        "####s.........######",
        "#############.######",
        "#############D######",
        "#############E######",
        "#############g######",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
    ],
    [
        "####################",
        "####################",
        "####################",
        "####################",
        "####################",
        "##############p#####",
        "######B#######p#####",
        "######.#######.#####",
        "######.#######.#####",
        "######.#######.#####",
        "###s...........#####",
        "##############.#####",
        "##############D#####",
        "##############D#####",
        "##############E#####",
        "##############g#####",
        "####################",
        "####################",
        "####################",
        "####################",
    ],
]

MOVES = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
}


def start_state(rows):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "s":
                return (x, y, (), -1, -1, (), False, False)
    raise AssertionError("level has no start cell")


def _plate_held(rows, px, py, gx, gy):
    if rows[py][px] == "p":
        return True
    return gx >= 0 and rows[gy][gx] == "p"


def _passable(rows, x, y, plate_held, latched):
    if not (0 <= x < N and 0 <= y < N):
        return False
    ch = rows[y][x]
    if ch == "#":
        return False
    if ch == "D":
        return plate_held
    if ch == "E":
        return latched
    return True


def advance(rows, state, action_id):
    px, py, tape, gx, gy, gprog, latched, used = state

    if gx >= 0:
        if not gprog:
            gx, gy = -1, -1
        else:
            dx, dy = gprog[0]
            nx, ny = gx + dx, gy + dy
            if _passable(rows, nx, ny, _plate_held(rows, px, py, gx, gy), latched):
                gx, gy, gprog = nx, ny, gprog[1:]
                if rows[gy][gx] == "B":
                    latched = True
            else:
                gx, gy, gprog = -1, -1, ()

    if action_id in MOVES:
        dx, dy = MOVES[action_id]
        nx, ny = px + dx, py + dy
        if _passable(rows, nx, ny, _plate_held(rows, px, py, gx, gy), latched):
            px, py = nx, ny
            if not used:
                tape = (tape + ((dx, dy),))[-MAX_TAPE:]
            if rows[py][px] == "B":
                latched = True
    elif action_id == GameAction.ACTION5 and not used and tape:
        gx, gy = px, py
        gprog = tuple((-dx, -dy) for dx, dy in reversed(tape))
        tape = ()
        used = True

    return (px, py, tape, gx, gy, gprog, latched, used)


def is_win(rows, state):
    return rows[state[1]][state[0]] == "g"


def rock_pixels(x, y):
    px = block(ROCK_WALL, CELL)
    if 0 < x < N - 1 and 0 < y < N - 1 and (x * 3 + y * 5) % 7 == 0:
        px[(x + y) % CELL][(x * 2 + y) % CELL] = VOID_BG
    return px


def plate_pixels():
    return medallion(PLATE_SEAM, VOID_BG, CELL)


def latch_pixels(latched):
    return medallion(LATCH_GATE, LATCH_GATE if latched else VOID_BG, CELL)


def door_pixels(colour, is_open):
    return door(colour, None if is_open else colour, CELL)


def exit_pixels():
    return ring(DIGGER_AVATAR, CELL)


def digger_pixels(carrying):
    core = TWIN_GHOST if carrying else DIGGER_AVATAR
    return [[-1, DIGGER_AVATAR, -1],
            [DIGGER_AVATAR, core, DIGGER_AVATAR],
            [DIGGER_AVATAR, -1, DIGGER_AVATAR]]


def build_levels():
    levels = []
    for rows in LEVELS_SPEC:
        sprites = []
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                art = tags = None
                if ch == "#":
                    art, tags = rock_pixels(x, y), []
                elif ch == "p":
                    art, tags = plate_pixels(), ["plate"]
                elif ch == "D":
                    art, tags = door_pixels(PLATE_SEAM, False), ["pdoor"]
                elif ch == "B":
                    art, tags = latch_pixels(False), ["latch"]
                elif ch == "E":
                    art, tags = door_pixels(LATCH_GATE, False), ["bdoor"]
                elif ch == "g":
                    art, tags = exit_pixels(), ["exit"]
                if art is None:
                    continue
                sprites.append(Sprite(
                    pixels=art, name=f"{ch}_{x}_{y}",
                    blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.TANGIBLE,
                    layer=-1 if ch == "#" else 0, tags=tags,
                ).set_position(px, py))
        sx, sy = start_state(rows)[0], start_state(rows)[1]
        sprites.append(Sprite(
            pixels=digger_pixels(True), name="digger",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=2,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G030A(RenderableUserDisplay):

    CELL_X, CELL_Y = 4, 4
    CELL_H = 2

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        held = len(self._game.state[2])
        x0 = PAD + self.CELL_X * CELL
        y0 = PAD + self.CELL_Y * CELL
        rows = self.CELL_H * CELL
        frame[y0:y0 + rows, x0:x0 + CELL] = VOID_BG
        for i in range(min(held, rows)):
            width = min(i // 2 + 1, CELL)
            y = y0 + rows - 1 - i
            frame[y, x0:x0 + width] = PLATE_SEAM
        return frame


class G030(ARCBaseGame):

    RELEASE_FRAMES = 5
    FADE_FRAMES = 4
    CLEAR_FRAMES = 6

    def __init__(self):
        self.state = start_state(LEVELS_SPEC[0])
        self._fx = 0
        self._fx_kind = ""
        self._wake = False
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=VOID_BG, letter_box=ROCK_WALL,
            interfaces=[G030A(self)],
        )
        super().__init__(game_id="g030", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    @property
    def rows(self):
        return LEVELS_SPEC[self.level_index]

    def on_set_level(self, level):
        self.state = start_state(LEVELS_SPEC[self.level_index])
        self._fx = 0
        self._fx_kind = ""
        self._wake = False
        self._sync()

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)

    def _face(self, name, art):
        for sprite in self.current_level.get_sprites_by_name(name):
            sprite.pixels = np.array(art, dtype=np.int8)

    def _sync(self):
        rows = self.rows
        level = self.current_level
        px, py, _, gx, gy, _, latched, used = self.state

        self._face("digger", digger_pixels(not used))
        digger = level.get_sprites_by_name("digger")
        if digger:
            digger[0].set_position(px * CELL, py * CELL)

        twin = level.get_sprites_by_name("twin")
        if gx >= 0:
            self._face("twin", weave(TWIN_GHOST, CELL))
            if twin:
                twin[0].set_position(gx * CELL, gy * CELL)
            else:
                level.add_sprite(Sprite(
                    pixels=weave(TWIN_GHOST, CELL), name="twin",
                    blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.TANGIBLE, layer=1,
                ).set_position(gx * CELL, gy * CELL))
        elif twin:
            level.remove_sprite(twin[0])

        held = _plate_held(rows, px, py, gx, gy)
        for sprite in level.get_sprites_by_tag("pdoor"):
            sprite.pixels = np.array(door_pixels(PLATE_SEAM, held), dtype=np.int8)
        for sprite in level.get_sprites_by_tag("bdoor"):
            sprite.pixels = np.array(door_pixels(LATCH_GATE, latched), dtype=np.int8)
        for sprite in level.get_sprites_by_tag("latch"):
            sprite.pixels = np.array(latch_pixels(latched), dtype=np.int8)

    def _mark_wake(self, x, y):
        self._wake = True
        self.current_level.add_sprite(Sprite(
            pixels=hatch(TWIN_GHOST, CELL), name="wake",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=1,
        ).set_position(x * CELL, y * CELL))

    def _start_fx(self, kind, frames):
        self._fx_kind = kind
        self._fx = frames
        self._paint_fx()

    def _paint_fx(self):
        lit = self._fx % 2 == 0
        used = self.state[7]
        if self._fx_kind == "release":
            self._face("twin", block(TWIN_GHOST, CELL))
            self._face("digger",
                       digger_pixels(True) if lit else weave(DIGGER_AVATAR, CELL))
        elif self._fx_kind == "fade":
            self._face("wake",
                       weave(TWIN_GHOST, CELL) if lit else hatch(TWIN_GHOST, CELL))
        elif self._fx_kind == "clear":
            self._face("digger",
                       medallion(ROCK_WALL, DIGGER_AVATAR, CELL) if lit
                       else digger_pixels(not used))

    def _settle(self):
        kind, self._fx_kind = self._fx_kind, ""
        if self._wake:
            for sprite in self.current_level.get_sprites_by_name("wake"):
                self.current_level.remove_sprite(sprite)
            self._wake = False
        self._sync()
        if kind == "clear":
            self.next_level()
        self.complete_action()

    def step(self):
        if self._fx:
            self._fx -= 1
            if self._fx:
                self._paint_fx()
            else:
                self._settle()
            return

        rows = self.rows
        before = self.state
        self.state = advance(rows, before, self.action.id)
        self._sync()

        if is_win(rows, self.state):
            self._start_fx("clear", self.CLEAR_FRAMES)
        elif self.state[7] and not before[7]:
            self._start_fx("release", self.RELEASE_FRAMES)
        elif before[3] >= 0 and self.state[3] < 0:
            self._mark_wake(before[3], before[4])
            self._start_fx("fade", self.FADE_FRAMES)
        else:
            self.complete_action()
