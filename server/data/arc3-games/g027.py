# ARC-AGI-3 candidate task g027.

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

def facing(body: int, visor: int, heading: tuple, cell: int = 4) -> list[list[int]]:
    px = rounded(body, cell)
    dx, dy = heading
    last = cell - 1
    if dy < 0:
        px[0][1] = px[0][cell - 2] = visor
    elif dy > 0:
        px[last][1] = px[last][cell - 2] = visor
    elif dx < 0:
        px[1][0] = px[cell - 2][0] = visor
    elif dx > 0:
        px[1][last] = px[cell - 2][last] = visor
    else:
        px[1][1] = visor
    return px

def weave(colour: int, cell: int = 4) -> list[list[int]]:
    return [[colour if (x + y) % 2 == 0 else -1 for x in range(cell)] for y in range(cell)]

def fixture(colours: tuple, phase: int, seed: int = 0, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    px[1][1] = px[cell - 2][cell - 2] = colours[(phase + seed) % len(colours)]
    return px

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

def ease_out(t: float) -> float:
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return 1 - (1 - t) * (1 - t)

def tween(a: int, b: int, step: int, span: int) -> int:
    if span <= 0:
        return b
    return int(round(a + (b - a) * ease_out(step / span)))


FLOOR = 5
WALL = 1
PIT = 15
SOCKET = 8
RELAY = 10
PAYLOAD = 8
PLAYER = 12
NOTCH = 1
PIP_ON = 12
PIP_OFF = WALL

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


TRAVEL_FRAMES = 4
DOOM_FRAMES = 6
CHEER_FRAMES = 4

DECOR_X = (4, 11, 13)
DECOR_CYCLE = (WALL, WALL, WALL, WALL, WALL, WALL, FLOOR)


def _block(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _pit_pixels(lit=False):
    return rounded(PIT) if lit else weave(PIT)


def _payload_pixels(lit=False):
    return ring(PAYLOAD) if lit else rounded(PAYLOAD)


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
                    pixels=_pit_pixels(), name=f"pit_{x}_{y}",
                    blocking=BlockingMode.BOUNDING_BOX,
                    interaction=InteractionMode.TANGIBLE, layer=-1, tags=["pit"],
                ).set_position(px, py))
            elif ch == SOCK_C:
                sprites.append(Sprite(
                    pixels=ring(SOCKET), name=f"socket_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=-1, tags=["socket"],
                ).set_position(px, py))
    for i, x in enumerate(DECOR_X):
        sprites.append(Sprite(
            pixels=fixture(DECOR_CYCLE, 0, seed=2 * i), name=f"decor_{i}",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=0, tags=["decor"],
        ).set_position(x * CELL, (N - 1) * CELL))
    return sprites


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites = _static_sprites(rows)
        _, positions, kinds = parse(rows)
        for i, (x, y) in enumerate(positions):
            payload = kinds[i] == "O"
            sprites.append(Sprite(
                pixels=_payload_pixels() if payload else rounded(RELAY),
                name=f"block_{i}", blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.TANGIBLE, layer=1,
                tags=["payload" if payload else "relay"],
            ).set_position(x * CELL, y * CELL))
        (sx, sy), _, _ = parse(rows)
        sprites.append(Sprite(
            pixels=_player_pixels(None), name="player",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=2,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


def _player_pixels(heading):
    if heading is None:
        return rounded(PLAYER)
    return facing(PLAYER, NOTCH, heading)


class G027A(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        return studs(frame, MAX_SPEED, self._game.state[2], PIP_ON, PIP_OFF,
                     side="west", start=12, gap=8)


class G027(ARCBaseGame):

    def __init__(self) -> None:
        self.rows = LEVELS_SPEC[0]["rows"]
        self.state = initial_state(self.rows)
        self._travel = 0
        self._doom = 0
        self._cheer = 0
        self._beat = 0
        self._slides = ()
        self._doom_cells = ()
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G027A(self)],
        )
        super().__init__(game_id="g027", levels=build_levels(), camera=camera,
                         available_actions=[1, 2, 3, 4, 5])

    def on_set_level(self, level: Level) -> None:
        self.rows = LEVELS_SPEC[self.level_index]["rows"]
        self.state = initial_state(self.rows)
        self._travel = 0
        self._doom = 0
        self._cheer = 0
        self._slides = ()
        self._doom_cells = ()
        self._sync()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self._beat = 0
        self.on_set_level(self.current_level)

    def _sync(self) -> None:
        level = self.current_level
        px, py, _, heading, blocks = self.state
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
            player[0].pixels = np.array(_player_pixels(heading), dtype=np.int64)
            player[0].set_position(px * CELL, py * CELL)
        for i, s in enumerate(level.get_sprites_by_tag("decor")):
            s.pixels = np.array(fixture(DECOR_CYCLE, self._beat, seed=2 * i),
                                dtype=np.int64)

    def _fall_cell(self, start, direction):
        dx, dy = direction
        x, y = start
        for _ in range(MAX_SPEED):
            x, y = x + dx, y + dy
            char = cell_at(self.rows, x, y)
            if char == PIT_C:
                return (x, y)
            if char == WALL_C:
                break
        return start

    def _begin_travel(self, before, after, direction) -> None:
        _, _, kinds = parse(self.rows)
        doomed = []
        slides = []
        bx, by, _, _, bblocks = before
        ax, ay, _, _, ablocks = after
        if (bx, by) != (ax, ay):
            slides.append(("player", bx, by, ax, ay))
        for i, (was, now) in enumerate(zip(bblocks, ablocks)):
            if was is None:
                continue
            lands = now if now is not None else self._fall_cell(was, direction)
            if now is None and kinds[i] == "O":
                doomed.append(lands)
            if lands != was:
                slides.append((f"block_{i}", was[0], was[1], lands[0], lands[1]))
        self._doom_cells = tuple(doomed)
        self._slides = tuple(slides)
        self._travel = TRAVEL_FRAMES if slides else 0
        if slides:
            player = self.current_level.get_sprites_by_name("player")
            if player:
                player[0].pixels = np.array(_player_pixels(self.state[3]),
                                            dtype=np.int64)

    def _paint_travel(self, frame_no) -> None:
        level = self.current_level
        for name, x0, y0, x1, y1 in self._slides:
            for s in level.get_sprites_by_name(name):
                s.set_position(tween(x0 * CELL, x1 * CELL, frame_no, TRAVEL_FRAMES),
                               tween(y0 * CELL, y1 * CELL, frame_no, TRAVEL_FRAMES))

    def _advance_travel(self) -> None:
        self._travel -= 1
        self._paint_travel(TRAVEL_FRAMES - self._travel)
        if self._travel == 0:
            self._resolve()

    def _paint_decor(self) -> None:
        for i, s in enumerate(self.current_level.get_sprites_by_tag("decor")):
            s.pixels = np.array(fixture(DECOR_CYCLE, self._beat, seed=2 * i),
                                dtype=np.int64)

    def _paint_doom(self) -> None:
        for x, y in self._doom_cells:
            for s in self.current_level.get_sprites_by_name(f"pit_{x}_{y}"):
                s.pixels = np.array(_pit_pixels(lit=self._doom % 2 == 0), dtype=np.int64)

    def _paint_cheer(self) -> None:
        for s in self.current_level.get_sprites_by_tag("payload"):
            s.pixels = np.array(_payload_pixels(lit=self._cheer % 2 == 1),
                                dtype=np.int64)

    def _resolve(self) -> None:
        self._sync()
        if is_won(self.rows, self.state):
            self._cheer = CHEER_FRAMES
            return
        if payload_lost(self.rows, self.state):
            self._doom = DOOM_FRAMES
            return
        self.complete_action()

    def step(self) -> None:
        if self._travel:
            self._advance_travel()
            return

        if self._cheer:
            self._cheer -= 1
            self._paint_cheer()
            if self._cheer == 0:
                self.next_level()
                self.complete_action()
            return

        if self._doom:
            self._doom -= 1
            self._paint_doom()
            if self._doom == 0:
                self.level_reset()
                self.complete_action()
            return

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
            before = self.state
            self.state, _ = press(self.rows, self.state, direction)
            self._beat += 1
            self._paint_decor()
            if direction is not None:
                self._begin_travel(before, self.state, direction)
            if self._travel:
                self._advance_travel()
                return
            self._resolve()
            return

        self.complete_action()
