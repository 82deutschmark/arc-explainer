# ARC-AGI-3 candidate task g016.

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

def speckle(colour: int, seed: int, cell: int = 4) -> list[list[int]]:
    px = [[-1] * cell for _ in range(cell)]
    for y in range(cell):
        for x in range(cell):
            if (x * 7 + y * 13 + seed * 31) % 5 == 0:
                px[y][x] = colour
    return px


FLOOR = 4
WALL = 6
BELT = 10
BRIDGE = 10
DISP = 14
DISP_FLASH = 14
RECV = 14
RECV_DONE = 14
RECV_DEAD = 6
RECV_FLASH = 11
RECV_MARK = 0
RECV_MARK_DONE = 4
PACKET = 11
PACKET_CORE = 0
PLAYER = 0
PLAYER_CHEST = 4
PLAYER_CHEST_OPEN = 14
EXIT_FRAME = 14
EXIT_SEAL = 6
PIP_ON = 14
PIP_OFF = 4
CLOCK = 11
CLOCK_OFF = 6

W, H = 25, 16
CELL = 4
VIEW = 64
CAM_MAX_X = W * CELL - VIEW

AISLE_ROWS = (3, 5, 7, 9, 11)
BELT_ROWS = (4, 6, 8, 10)
RECV_X = 23
WALKABLE = ".+"

BAND_TOP = 48
STAIR_BASE = 56
TENS_TOP = 58
UNITS_TOP = 61

NOT_SENT = -1
DELIVERED = -2
DEAD = -3

LEVELS_SPEC = [
    {
        "lanes": [(4, 4, 1), (6, 4, 2)],
        "bridges": [(6, 4), (6, 6), (20, 8), (20, 10)],
        "start": (4, 3), "exit": (23, 11), "budget": 40,
    },
    {
        "lanes": [(4, 4, 2), (6, 4, 1)],
        "bridges": [(6, 4), (6, 6), (20, 8), (20, 10)],
        "start": (4, 3), "exit": (23, 11), "budget": 44,
    },
    {
        "lanes": [(4, 4, 2), (6, 4, 1), (8, 4, 3)],
        "bridges": [(6, 4), (6, 6), (6, 8), (20, 10)],
        "start": (4, 5), "exit": (23, 11), "budget": 46,
    },
    {
        "lanes": [(4, 2, 1), (6, 8, 2), (8, 5, 3)],
        "bridges": [(4, 4), (10, 6), (10, 8), (20, 10)],
        "start": (2, 3), "exit": (23, 11), "budget": 52,
    },
    {
        "lanes": [(4, 6, 3), (6, 4, 2), (8, 2, 1)],
        "bridges": [(8, 4), (8, 6), (8, 8), (20, 10)],
        "start": (6, 3), "exit": (23, 11), "budget": 60,
    },
    {
        "lanes": [(4, 4, 1), (6, 4, 3), (8, 10, 2)],
        "bridges": [(6, 4), (6, 6), (12, 8), (20, 10)],
        "start": (4, 3), "exit": (23, 11), "budget": 50,
    },
    {
        "lanes": [(4, 6, 2), (6, 4, 4), (8, 8, 1), (10, 2, 3)],
        "bridges": [(10, 4), (10, 6), (10, 8), (10, 10), (20, 10)],
        "start": (8, 7), "exit": (23, 11), "budget": 73,
    },
]


class G016A:

    __slots__ = ("row", "dx", "label", "rem")

    def __init__(self, row: int, dx: int, label: int) -> None:
        self.row = row
        self.dx = dx
        self.label = label
        self.rem = RECV_X - (dx + 1)

    def __repr__(self) -> str:
        return f"G016A(row={self.row}, dx={self.dx}, label={self.label}, rem={self.rem})"


def lanes_of(spec: dict) -> list[G016A]:
    return [G016A(r, dx, lb) for r, dx, lb in spec["lanes"]]


def build_grid(spec: dict) -> list[str]:
    grid = [["#"] * W for _ in range(H)]
    for y in AISLE_ROWS:
        for x in range(1, W - 1):
            grid[y][x] = "."
    for lane in lanes_of(spec):
        for x in range(lane.dx + 1, RECV_X):
            grid[lane.row][x] = "-"
        grid[lane.row][lane.dx] = "D"
        grid[lane.row][RECV_X] = str(lane.label)
    for x, y in spec["bridges"]:
        grid[y][x] = "+" if grid[y][x] == "-" else "."
    ex, ey = spec["exit"]
    grid[ey][ex] = "X"
    return ["".join(row) for row in grid]


_MARKS = ((1, 1), (1, 2), (2, 1), (2, 2))


def _paste(base: list[list[int]], over: list[list[int]]) -> list[list[int]]:
    for j, row in enumerate(over):
        for i, value in enumerate(row):
            if value != -1:
                base[j][i] = value
    return base


def _wall_pixels(x: int, y: int) -> list[list[int]]:
    px = block(WALL)
    if (x + y) % 2 == 0:
        for j, row in enumerate(speckle(WALL, (x * 5 + y * 3) % 7)):
            for i, value in enumerate(row):
                if value != -1:
                    px[j][i] = -1
    return px


def _belt_pixels() -> list[list[int]]:
    return weave(BELT)


def _bridge_pixels() -> list[list[int]]:
    return ring(BRIDGE)


def _disp_pixels(loaded: bool) -> list[list[int]]:
    px = ring(DISP)
    return _paste(px, core(PACKET)) if loaded else px


def _recv_pixels(label: int, state: int) -> list[list[int]]:
    if state == DELIVERED:
        px, mark = block(RECV_DONE), RECV_MARK_DONE
    elif state == DEAD:
        px, mark = ring(RECV_DEAD), RECV_MARK
    else:
        px, mark = ring(RECV), RECV_MARK
    for k in range(min(label, len(_MARKS))):
        j, i = _MARKS[k]
        px[j][i] = mark
    return px


def _packet_pixels() -> list[list[int]]:
    return medallion(PACKET, PACKET_CORE)


def _player_pixels(exit_open: bool) -> list[list[int]]:
    return figure(PLAYER, PLAYER_CHEST_OPEN if exit_open else PLAYER_CHEST)


def _exit_pixels(open_now: bool) -> list[list[int]]:
    return door(EXIT_FRAME, None if open_now else EXIT_SEAL)


def _static_sprite(pixels: list[list[int]], x: int, y: int, name: str, layer: int,
                   blocking: bool) -> Sprite:
    return Sprite(
        pixels=pixels, name=name,
        blocking=BlockingMode.BOUNDING_BOX if blocking else BlockingMode.NOT_BLOCKED,
        interaction=InteractionMode.TANGIBLE, layer=layer,
    ).set_position(x * CELL, y * CELL)


def build_levels() -> list[Level]:
    levels: list[Level] = []
    for spec in LEVELS_SPEC:
        grid = build_grid(spec)
        lanes = lanes_of(spec)
        sprites: list[Sprite] = []
        for y, row in enumerate(grid):
            for x, ch in enumerate(row):
                if ch == "#":
                    sprites.append(_static_sprite(_wall_pixels(x, y), x, y,
                                                  f"wall_{x}_{y}", -1, True))
                elif ch == "-":
                    sprites.append(_static_sprite(_belt_pixels(), x, y,
                                                  f"belt_{x}_{y}", -1, False))
                elif ch == "+":
                    sprites.append(_static_sprite(_bridge_pixels(), x, y,
                                                  f"bridge_{x}_{y}", -1, False))
        for i, lane in enumerate(lanes):
            sprites.append(Sprite(
                pixels=_disp_pixels(True), name=f"disp_{i}",
                blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.TANGIBLE, layer=0,
            ).set_position(lane.dx * CELL, lane.row * CELL))
            sprites.append(Sprite(
                pixels=_recv_pixels(lane.label, NOT_SENT), name=f"recv_{i}",
                blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.TANGIBLE, layer=0,
            ).set_position(RECV_X * CELL, lane.row * CELL))
            sprites.append(Sprite(
                pixels=_packet_pixels(), name=f"packet_{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.REMOVED, layer=1,
            ).set_position(lane.dx * CELL, lane.row * CELL))
        ex, ey = spec["exit"]
        sprites.append(Sprite(
            pixels=_exit_pixels(False), name="exit",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=0,
        ).set_position(ex * CELL, ey * CELL))
        sx, sy = spec["start"]
        sprites.append(Sprite(
            pixels=_player_pixels(False), name="player",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=2,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(VIEW, VIEW)))
    return levels


class G016B(RenderableUserDisplay):

    def __init__(self, game: "G016") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self._game
        width = frame.shape[1]
        lanes = len(game.lanes)
        span = lanes * 5 - 2
        left = (width - span) // 2
        for i in range(lanes):
            x = left + i * 5
            tall = 2 + 2 * i
            if x < 0 or x + 3 > width or STAIR_BASE - tall < BAND_TOP:
                continue
            frame[STAIR_BASE - tall:STAIR_BASE, x:x + 3] = (
                PIP_ON if i < game.delivered else PIP_OFF)
        if game.shift_over:
            lit = CLOCK if game.flash_lit else CLOCK_OFF
            frame[TENS_TOP:TENS_TOP + 2, 4:width - 4] = lit
            frame[UNITS_TOP:UNITS_TOP + 2, 4:width - 4] = lit
            return frame
        turns = max(0, game.turns_left)
        for count, pitch, dash, top in ((turns // 10, 7, 6, TENS_TOP),
                                        (turns % 10, 5, 4, UNITS_TOP)):
            if count <= 0:
                continue
            x = (width - (count * pitch - (pitch - dash))) // 2
            for _ in range(count):
                if 0 <= x and x + dash <= width:
                    frame[top:top + 2, x:x + dash] = CLOCK
                x += pitch
        return frame


class G016(ARCBaseGame):

    LAUNCH_FRAMES = 4
    LAND_FRAMES = 4
    SHIFT_FRAMES = 6

    def __init__(self) -> None:
        self._flash = 0
        self._snap = False
        self._landed: list[int] = []
        self._sent: int | None = None
        self.lanes: list[G016A] = lanes_of(LEVELS_SPEC[0])
        self.state: list[int] = [NOT_SENT] * len(self.lanes)
        self.delivered = 0
        self.turns_left = LEVELS_SPEC[0]["budget"]
        self._grid = build_grid(LEVELS_SPEC[0])
        self._px, self._py = LEVELS_SPEC[0]["start"]
        camera = Camera(
            width=VIEW, height=VIEW,
            background=FLOOR, letter_box=FLOOR,
            interfaces=[G016B(self)],
        )
        super().__init__(game_id="g016", levels=build_levels(), camera=camera)

    @property
    def shift_over(self) -> bool:
        return self._snap

    @property
    def flash_lit(self) -> bool:
        return self._flash % 2 == 1

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.lanes = lanes_of(spec)
        self.state = [NOT_SENT] * len(self.lanes)
        self.delivered = 0
        self.turns_left = spec["budget"]
        self._grid = build_grid(spec)
        self._px, self._py = spec["start"]
        self._disp_at = {(lane.dx, lane.row): i for i, lane in enumerate(self.lanes)}
        self._flash = 0
        self._snap = False
        self._landed = []
        self._sent = None
        self._refresh()

    def level_reset(self) -> None:
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        super().full_reset()
        self.on_set_level(self.current_level)

    def _sprite(self, name: str) -> Sprite | None:
        found = self.current_level.get_sprites_by_name(name)
        return found[0] if found else None

    def _refresh(self) -> None:
        open_now = self.delivered == len(self.lanes)
        player = self._sprite("player")
        if player is not None:
            player.set_position(self._px * CELL, self._py * CELL)
            player.pixels = np.array(_player_pixels(open_now), dtype=np.int8)
        for i, lane in enumerate(self.lanes):
            s = self.state[i]
            disp = self._sprite(f"disp_{i}")
            if disp is not None:
                disp.pixels = np.array(_disp_pixels(s == NOT_SENT), dtype=np.int8)
            recv = self._sprite(f"recv_{i}")
            if recv is not None:
                recv.pixels = np.array(_recv_pixels(lane.label, s), dtype=np.int8)
            pkt = self._sprite(f"packet_{i}")
            if pkt is not None:
                if s > 0:
                    pkt.set_interaction(InteractionMode.INTANGIBLE)
                    pkt.set_position((RECV_X - s) * CELL, lane.row * CELL)
                else:
                    pkt.set_interaction(InteractionMode.REMOVED)
        ext = self._sprite("exit")
        if ext is not None:
            ext.pixels = np.array(_exit_pixels(open_now), dtype=np.int8)
        self.camera.x = max(0, min(CAM_MAX_X, self._px * CELL + CELL // 2 - VIEW // 2))
        self.camera.y = 0

    def _paint_flash(self) -> None:
        lit = self.flash_lit
        if self._snap:
            player = self._sprite("player")
            if player is not None:
                player.pixels = np.array(
                    _player_pixels(False) if lit else figure(WALL, WALL), dtype=np.int8)
            return
        for i in self._landed:
            recv = self._sprite(f"recv_{i}")
            if recv is not None:
                recv.pixels = np.array(
                    block(RECV_FLASH) if lit
                    else _recv_pixels(self.lanes[i].label, self.state[i]),
                    dtype=np.int8)
        if self._sent is not None:
            disp = self._sprite(f"disp_{self._sent}")
            if disp is not None:
                disp.pixels = np.array(
                    block(DISP_FLASH) if lit else _disp_pixels(False), dtype=np.int8)

    def _tick(self, send: int | None) -> None:
        self._landed = []
        for i, s in enumerate(self.state):
            if s <= 0:
                continue
            s -= 1
            if s > 0:
                self.state[i] = s
                continue
            if self.lanes[i].label == self.delivered + 1:
                self.delivered += 1
                self.state[i] = DELIVERED
            else:
                self.state[i] = DEAD
            self._landed.append(i)
        if send is not None:
            self.state[send] = self.lanes[send].rem

    def step(self) -> None:
        if self._flash:
            self._flash -= 1
            self._paint_flash()
            if self._flash == 0:
                if self._snap:
                    self._snap = False
                    self.level_reset()
                else:
                    self._refresh()
                self.complete_action()
            return
        if self.action.id == GameAction.RESET:
            self._refresh()
            self.complete_action()
            return
        deltas = {
            GameAction.ACTION1: (0, -1),
            GameAction.ACTION2: (0, 1),
            GameAction.ACTION3: (-1, 0),
            GameAction.ACTION4: (1, 0),
        }
        delta = deltas.get(self.action.id)
        send = None
        if delta is not None:
            nx, ny = self._px + delta[0], self._py + delta[1]
            ch = self._grid[ny][nx]
            if ch == "D":
                i = self._disp_at[(nx, ny)]
                if self.state[i] == NOT_SENT:
                    send = i
            elif ch == "X":
                if self.delivered == len(self.lanes):
                    self.next_level()
                    self.complete_action()
                    return
            elif ch in WALKABLE:
                self._px, self._py = nx, ny
        self._tick(send)
        self.turns_left -= 1
        self._sent = send
        self._refresh()
        if self.turns_left <= 0:
            self._snap = True
            self._flash = self.SHIFT_FRAMES
            return
        if self._landed:
            self._flash = self.LAND_FRAMES
            return
        if send is not None:
            self._flash = self.LAUNCH_FRAMES
            return
        self.complete_action()
