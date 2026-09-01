# ARC-AGI-3 candidate task t89a4dc45.

import functools

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
PIT = 5
SOCKET = 14
RELAY = 9
PAYLOAD = 8
PLAYER = 12
NOTCH = 11
PIP_ON = 11
PIP_OFF = 2

WALL_C = "#"
PIT_C = "P"
SOCK_C = "T"
MAX_SPEED = 4

N = 16
CELL = 4

LEVELS_SPEC = [
    {"rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#....###########",
        "#.S......BO..T##",
        "#....###########",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..............#",
        "#..............#",
        "#....###########",
        "#.S.....BO.T.P##",
        "#....###########",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#.......S......#",
        "#......#.#.....#",
        "#......#.#.....#",
        "#......#.#.....#",
        "#......#.#.....#",
        "#......#.#.....#",
        "#......#.#.....#",
        "#......#B#.....#",
        "#......#O#.....#",
        "#......#.#.....#",
        "#......#.#.....#",
        "#......#T#.....#",
        "#......#P#.....#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "###########....#",
        "##T.OBB......S.#",
        "###########....#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..............#",
        "#.S............#",
        "#..............#",
        "#....###########",
        "#.......B..O.T##",
        "#....###########",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#....###########",
        "#.S.....BOBT.P##",
        "#....###########",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ]},
    {"rows": [
        "################",
        "#....###########",
        "#....###########",
        "#....###########",
        "#....###########",
        "#........BO..T##",
        "#....###########",
        "#....###########",
        "#.S..###########",
        "#....###########",
        "#....###########",
        "#.......BO.T####",
        "#....###########",
        "#....###########",
        "#....###########",
        "################",
    ]},
    {"rows": [
        "################",
        "#......#P#.....#",
        "#......#T#.....#",
        "#......#.#.....#",
        "#......#O#.....#",
        "#......#B#.....#",
        "#......#.#.....#",
        "#......#B#.....#",
        "#......#.#.....#",
        "#......#.#.....#",
        "#......#.#.....#",
        "#......#.#.....#",
        "#......#.#.....#",
        "#......#.#.....#",
        "#.......S......#",
        "################",
    ]},
]


DIR_UP = (0, -1)
DIR_DOWN = (0, 1)
DIR_LEFT = (-1, 0)
DIR_RIGHT = (1, 0)
DIRS = (DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT)

for _spec in LEVELS_SPEC:
    _spec["rows"] = tuple(_spec["rows"])


def cell_at(rows, x, y):
    if 0 <= y < len(rows) and 0 <= x < len(rows[0]):
        return rows[y][x]
    return WALL_C


@functools.lru_cache(maxsize=None)
def parse(rows):
    start = None
    positions = []
    kinds = []
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "S":
                start = (x, y)
            elif ch in ("B", "O"):
                positions.append((x, y))
                kinds.append(ch)
    if start is None:
        raise ValueError("level has no start")
    return start, tuple(positions), tuple(kinds)


def initial_state(rows):
    (sx, sy), positions, _ = parse(rows)
    return (sx, sy, 0, None, positions)


def _shove(rows, pos, occupied, index, direction, budget, avatar):
    dx, dy = direction
    x, y = pos[index]
    del occupied[(x, y)]
    remaining = budget
    while remaining > 0:
        nx, ny = x + dx, y + dy
        char = cell_at(rows, nx, ny)
        if char == WALL_C or (nx, ny) == avatar:
            break
        if (nx, ny) in occupied:
            struck = occupied[(nx, ny)]
            pos[index] = (x, y)
            occupied[(x, y)] = index
            if remaining - 1 > 0:
                _shove(rows, pos, occupied, struck, direction, remaining - 1, avatar)
            return
        x, y = nx, ny
        remaining -= 1
        if char == PIT_C:
            pos[index] = None
            return
    pos[index] = (x, y)
    occupied[(x, y)] = index


def press(rows, state, direction):
    px, py, speed, facing, blocks = state
    if direction is None:
        slower = max(0, speed - 1)
        return (px, py, slower, facing if slower else None, blocks), None

    pos = list(blocks)
    occupied = {p: i for i, p in enumerate(pos) if p is not None}
    _, _, kinds = parse(rows)

    launched = min(speed + 1, MAX_SPEED) if facing == direction else 1
    dx, dy = direction
    remaining = launched
    struck_kind = None
    while remaining > 0:
        nx, ny = px + dx, py + dy
        char = cell_at(rows, nx, ny)
        if char == WALL_C or char == PIT_C:
            launched = 0
            break
        if (nx, ny) in occupied:
            struck = occupied[(nx, ny)]
            struck_kind = kinds[struck]
            _shove(rows, pos, occupied, struck, direction, launched, (px, py))
            launched = 0
            break
        px, py = nx, ny
        remaining -= 1

    return (px, py, launched, direction if launched else None, tuple(pos)), struck_kind


def is_won(rows, state):
    _, _, kinds = parse(rows)
    blocks = state[4]
    for i, kind in enumerate(kinds):
        if kind != "O":
            continue
        p = blocks[i]
        if p is None or cell_at(rows, p[0], p[1]) != SOCK_C:
            return False
    return True


def payload_lost(rows, state):
    _, _, kinds = parse(rows)
    return any(kinds[i] == "O" and p is None for i, p in enumerate(state[4]))


def _block(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _static_sprites(rows):
    sprites = []
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            px, py = x * CELL, y * CELL
            if ch == WALL_C:
                sprites.append(Sprite(
                    pixels=_block(WALL), name=f"wall_{x}_{y}",
                    blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.TANGIBLE, layer=-1,
                ).set_position(px, py))
            elif ch == PIT_C:
                sprites.append(Sprite(
                    pixels=_block(PIT), name=f"pit_{x}_{y}",
                    blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.TANGIBLE, layer=-1, tags=["pit"],
                ).set_position(px, py))
            elif ch == SOCK_C:
                sprites.append(Sprite(
                    pixels=_block(SOCKET), name=f"socket_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=-1, tags=["socket"],
                ).set_position(px, py))
    return sprites


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites = _static_sprites(rows)
        _, positions, kinds = parse(rows)
        for i, (x, y) in enumerate(positions):
            sprites.append(Sprite(
                pixels=_block(PAYLOAD if kinds[i] == "O" else RELAY),
                name=f"block_{i}", blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.TANGIBLE, layer=1,
                tags=["payload" if kinds[i] == "O" else "relay"],
            ).set_position(x * CELL, y * CELL))
        (sx, sy), _, _ = parse(rows)
        sprites.append(Sprite(
            pixels=_block(PLAYER), name="player",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=2,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


def _player_pixels(facing):
    px = _block(PLAYER)
    if facing == DIR_UP:
        px[0] = [NOTCH] * CELL
    elif facing == DIR_DOWN:
        px[CELL - 1] = [NOTCH] * CELL
    elif facing == DIR_LEFT:
        for r in range(CELL):
            px[r][0] = NOTCH
    elif facing == DIR_RIGHT:
        for r in range(CELL):
            px[r][CELL - 1] = NOTCH
    return px


class G2c2ddf44(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        for i in range(MAX_SPEED):
            x = 1 + i * 3
            if x + 2 > frame.shape[1]:
                break
            frame[1:3, x:x + 2] = PIP_ON if i < self._game.state[2] else PIP_OFF
        return frame


class Gcf5b4623(ARCBaseGame):

    def __init__(self) -> None:
        self.rows = LEVELS_SPEC[0]["rows"]
        self.state = initial_state(self.rows)
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G2c2ddf44(self)],
        )
        super().__init__(game_id="t89a4dc45", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    def on_set_level(self, level: Level) -> None:
        self.rows = LEVELS_SPEC[self.level_index]["rows"]
        self.state = initial_state(self.rows)
        self._sync()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _sync(self) -> None:
        level = self.current_level
        px, py, _, facing, blocks = self.state
        for i, p in enumerate(blocks):
            found = level.get_sprites_by_name(f"block_{i}")
            if not found:
                continue
            if p is None:
                level.remove_sprite(found[0])
            else:
                found[0].set_position(p[0] * CELL, p[1] * CELL)
        player = level.get_sprites_by_name("player")
        if player:
            player[0].pixels = np.array(_player_pixels(facing), dtype=np.int64)
            player[0].set_position(px * CELL, py * CELL)

    def step(self) -> None:
        direction = None
        acted = False
        if self.action.id == GameAction.ACTION1:
            direction, acted = DIR_UP, True
        elif self.action.id == GameAction.ACTION2:
            direction, acted = DIR_DOWN, True
        elif self.action.id == GameAction.ACTION3:
            direction, acted = DIR_LEFT, True
        elif self.action.id == GameAction.ACTION4:
            direction, acted = DIR_RIGHT, True
        elif self.action.id == GameAction.ACTION5:
            direction, acted = None, True

        if acted:
            self.state, _ = press(self.rows, self.state, direction)
            self._sync()
            if is_won(self.rows, self.state):
                self.next_level()
                self.complete_action()
                return
            if payload_lost(self.rows, self.state):
                self.level_reset()

        self.complete_action()
