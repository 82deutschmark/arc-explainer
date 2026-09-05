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

def hatch(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 3 == 0 else -1 for x in range(cell)] for y in range(cell)]

def studs(frame, count: int, filled: int, on: int, off: int, side: str = "east",
          start: int = 8, gap: int = 6):
    h, w = frame.shape
    for i in range(count):
        top = start + i * gap
        if top + 2 > h:
            break
        colour = on if i < filled else off
        length = min(1 + i, w // 4)
        if side == "east":
            frame[top:top + 2, w - length:w] = colour
        else:
            frame[top:top + 2, 0:length] = colour
    return frame


FLOOR = 3
WALL = 15
PLATE = 11
BUTTON = 14
EXIT = 0
PLAYER = 0
GHOST = 7

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


def wall_pixels(x, y):
    if x in (0, N - 1) or y in (0, N - 1):
        return block(WALL)
    return rounded(WALL)


def plate_pixels():
    return medallion(PLATE, FLOOR)


def button_pixels(latched):
    return medallion(BUTTON, BUTTON if latched else FLOOR)


def door_pixels(colour, is_open):
    return door(colour, None if is_open else colour)


def exit_pixels():
    return ring(EXIT)


def player_pixels(carrying):
    return figure(PLAYER, GHOST if carrying else None)


def build_levels():
    levels = []
    for rows in LEVELS_SPEC:
        sprites = []
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                px, py = x * CELL, y * CELL
                art = tags = None
                if ch == "#":
                    art, tags = wall_pixels(x, y), []
                elif ch == "p":
                    art, tags = plate_pixels(), ["plate"]
                elif ch == "D":
                    art, tags = door_pixels(PLATE, False), ["pdoor"]
                elif ch == "B":
                    art, tags = button_pixels(False), ["button"]
                elif ch == "E":
                    art, tags = door_pixels(BUTTON, False), ["bdoor"]
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
            pixels=player_pixels(True), name="player",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=2,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G030A(RenderableUserDisplay):

    SOCKET_TOP, SOCKET_BOTTOM = 10, 18
    TRACK_TOP, TRACK_BOTTOM = 22, 52
    FIRST_MARK, PITCH = 24, 6
    INSET = 6

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        used = self._game.state[7]
        held = len(self._game.state[2])
        frame[self.SOCKET_TOP:self.SOCKET_BOTTOM, 0:self.INSET] = FLOOR
        if not used:
            frame[self.SOCKET_TOP + 1:self.SOCKET_BOTTOM - 1, 1:self.INSET - 1] = GHOST
        frame[self.TRACK_TOP:self.TRACK_BOTTOM, 0:self.INSET] = FLOOR
        return studs(frame, MAX_TAPE, held, PLATE, WALL,
                     side="west", start=self.FIRST_MARK, gap=self.PITCH)


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
            background=FLOOR, letter_box=5,
            interfaces=[G030A(self)],
        )
        super().__init__(game_id="g030", levels=build_levels(), camera=camera)

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

        self._face("player", player_pixels(not used))
        player = level.get_sprites_by_name("player")
        if player:
            player[0].set_position(px * CELL, py * CELL)

        ghost = level.get_sprites_by_name("ghost")
        if gx >= 0:
            self._face("ghost", weave(GHOST))
            if ghost:
                ghost[0].set_position(gx * CELL, gy * CELL)
            else:
                level.add_sprite(Sprite(
                    pixels=weave(GHOST), name="ghost",
                    blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.TANGIBLE, layer=1,
                ).set_position(gx * CELL, gy * CELL))
        elif ghost:
            level.remove_sprite(ghost[0])

        held = _plate_held(rows, px, py, gx, gy)
        for sprite in level.get_sprites_by_tag("pdoor"):
            sprite.pixels = np.array(door_pixels(PLATE, held), dtype=np.int8)
        for sprite in level.get_sprites_by_tag("bdoor"):
            sprite.pixels = np.array(door_pixels(BUTTON, latched), dtype=np.int8)
        for sprite in level.get_sprites_by_tag("button"):
            sprite.pixels = np.array(button_pixels(latched), dtype=np.int8)

    def _mark_wake(self, x, y):
        self._wake = True
        self.current_level.add_sprite(Sprite(
            pixels=hatch(GHOST), name="wake",
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
            self._face("ghost", block(GHOST))
            self._face("player", player_pixels(True) if lit else weave(PLAYER))
        elif self._fx_kind == "fade":
            self._face("wake", weave(GHOST) if lit else hatch(GHOST))
        elif self._fx_kind == "clear":
            self._face("player", medallion(WALL, PLAYER) if lit else player_pixels(not used))

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
