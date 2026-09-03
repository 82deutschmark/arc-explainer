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

FLOOR = 4
WALL = 1
PLATE = 9
BUTTON = 14
EXIT = 11
PLAYER = 12
GHOST = 15
PIP_OFF = 3

N = 16
CELL = 4
MAX_TAPE = 5

LEVELS_SPEC = [
    [
        "################",
        "################",
        "################",
        "################",
        "####.......#####",
        "####.s..p.Dg####",
        "####.......#####",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ],
    [
        "################",
        "################",
        "################",
        "################",
        "##.........#####",
        "##.s.p....Dg####",
        "##.........#####",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ],
    [
        "################",
        "################",
        "################",
        "################",
        "################",
        "####sp.....#####",
        "##########.#####",
        "##########.#####",
        "##########.#####",
        "##########D#####",
        "##########g#####",
        "################",
        "################",
        "################",
        "################",
        "################",
    ],
    [
        "################",
        "################",
        "################",
        "########B#######",
        "########.#######",
        "####sp....DEg###",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ],
    [
        "################",
        "################",
        "################",
        "################",
        "################",
        "#######p########",
        "###s.......Dg###",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ],
    [
        "################",
        "################",
        "################",
        "################",
        "######p#########",
        "######p#########",
        "###s.......DDg##",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
    ],
    [
        "################",
        "################",
        "################",
        "################",
        "####B##p########",
        "####.##p########",
        "##s........DDEg#",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
        "################",
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


def _solid(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _ring(colour):
    block = [[FLOOR] * CELL for _ in range(CELL)]
    for i in range(CELL):
        block[0][i] = block[CELL - 1][i] = colour
        block[i][0] = block[i][CELL - 1] = colour
    return block


def _corners(colour):
    block = [[FLOOR] * CELL for _ in range(CELL)]
    for y in (0, CELL - 1):
        for x in (0, CELL - 1):
            block[y][x] = colour
    return block


def build_levels():
    levels = []
    for rows in LEVELS_SPEC:
        sprites = []
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                art = tags = None
                if ch == "#":
                    art, tags = _solid(WALL), []
                elif ch == "p":
                    art, tags = _ring(PLATE), ["plate"]
                elif ch == "D":
                    art, tags = _solid(PLATE), ["pdoor"]
                elif ch == "B":
                    art, tags = _ring(BUTTON), ["button"]
                elif ch == "E":
                    art, tags = _solid(BUTTON), ["bdoor"]
                elif ch == "g":
                    art, tags = _solid(EXIT), ["exit"]
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
            pixels=_solid(PLAYER), name="player",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=2,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G030A(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        used = self._game.state[7]
        frame[1:3, 1:3] = PIP_OFF if used else GHOST
        held = len(self._game.state[2])
        for i in range(MAX_TAPE):
            x = 5 + i * 3
            frame[1:3, x:x + 2] = PLATE if i < held else PIP_OFF
        return frame


class G030(ARCBaseGame):

    def __init__(self):
        self.state = start_state(LEVELS_SPEC[0])
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G030A(self)],
        )
        super().__init__(game_id="g030", levels=build_levels(), camera=camera)

    @property
    def rows(self):
        return LEVELS_SPEC[self.level_index]

    def on_set_level(self, level):
        self.state = start_state(LEVELS_SPEC[self.level_index])
        self._sync()

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)

    def _sync(self):
        rows = self.rows
        level = self.current_level
        px, py, _, gx, gy, _, latched, _ = self.state

        player = level.get_sprites_by_name("player")
        if player:
            player[0].set_position(px * CELL, py * CELL)

        ghost = level.get_sprites_by_name("ghost")
        if gx >= 0:
            if ghost:
                ghost[0].set_position(gx * CELL, gy * CELL)
            else:
                level.add_sprite(Sprite(
                    pixels=_ring(GHOST), name="ghost",
                    blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.TANGIBLE, layer=1,
                ).set_position(gx * CELL, gy * CELL))
        elif ghost:
            level.remove_sprite(ghost[0])

        held = _plate_held(rows, px, py, gx, gy)
        for sprite in level.get_sprites_by_tag("pdoor"):
            art = _corners(PLATE) if held else _solid(PLATE)
            sprite.pixels = np.array(art, dtype=np.int8)
        for sprite in level.get_sprites_by_tag("bdoor"):
            art = _corners(BUTTON) if latched else _solid(BUTTON)
            sprite.pixels = np.array(art, dtype=np.int8)
        for sprite in level.get_sprites_by_tag("button"):
            art = _solid(BUTTON) if latched else _ring(BUTTON)
            sprite.pixels = np.array(art, dtype=np.int8)

    def step(self):
        rows = self.rows
        self.state = advance(rows, self.state, self.action.id)
        if is_win(rows, self.state):
            self.next_level()
        else:
            self._sync()
        self.complete_action()
