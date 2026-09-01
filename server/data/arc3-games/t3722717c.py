# ARC-AGI-3 candidate task t3722717c.

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
BELT = 2
BRIDGE = 7
DISP = 9
DISP_LOADED = 10
DISP_SPENT = 5
RECV = 15
RECV_DONE = 14
RECV_DEAD = 8
RECV_MARK = 0
PACKET = 10
PLAYER = 12
EXIT_SEALED = 13
EXIT_OPEN = 14
PIP_ON = 11
PIP_OFF = 5
CLOCK = 0

W, H = 25, 16
CELL = 4
VIEW = 64
CAM_MAX_X = W * CELL - VIEW

AISLE_ROWS = (3, 5, 7, 9, 11)
BELT_ROWS = (4, 6, 8, 10)
RECV_X = 23
WALKABLE = ".+"

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


class Gcc63b04c:

    __slots__ = ("row", "dx", "label", "rem")

    def __init__(self, row: int, dx: int, label: int) -> None:
        self.row = row
        self.dx = dx
        self.label = label
        self.rem = RECV_X - (dx + 1)

    def __repr__(self) -> str:
        return f"Gcc63b04c(row={self.row}, dx={self.dx}, label={self.label}, rem={self.rem})"


def lanes_of(spec: dict) -> list[Gcc63b04c]:
    return [Gcc63b04c(r, dx, lb) for r, dx, lb in spec["lanes"]]


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


def _block(colour: int) -> list[list[int]]:
    return [[colour] * CELL for _ in range(CELL)]


def _disp_pixels(loaded: bool) -> list[list[int]]:
    px = _block(DISP)
    core = DISP_LOADED if loaded else DISP_SPENT
    for j in (1, 2):
        for i in (1, 2):
            px[j][i] = core
    return px


def _recv_pixels(label: int, frame: int) -> list[list[int]]:
    px = _block(frame)
    for i in range(min(label, 9)):
        px[1 + i // 3][1 + i % 3] = RECV_MARK
    return px


def _static_sprite(colour: int, x: int, y: int, name: str, layer: int,
                   blocking: bool) -> Sprite:
    return Sprite(
        pixels=_block(colour), name=name,
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
                    sprites.append(_static_sprite(WALL, x, y, f"wall_{x}_{y}", -1, True))
                elif ch == "-":
                    sprites.append(_static_sprite(BELT, x, y, f"belt_{x}_{y}", -1, False))
                elif ch == "+":
                    sprites.append(_static_sprite(BRIDGE, x, y, f"bridge_{x}_{y}", -1, False))
        for i, lane in enumerate(lanes):
            sprites.append(Sprite(
                pixels=_disp_pixels(True), name=f"disp_{i}",
                blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.TANGIBLE, layer=0,
            ).set_position(lane.dx * CELL, lane.row * CELL))
            sprites.append(Sprite(
                pixels=_recv_pixels(lane.label, RECV), name=f"recv_{i}",
                blocking=BlockingMode.BOUNDING_BOX,
                interaction=InteractionMode.TANGIBLE, layer=0,
            ).set_position(RECV_X * CELL, lane.row * CELL))
            sprites.append(Sprite(
                pixels=_block(PACKET), name=f"packet_{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.REMOVED, layer=1,
            ).set_position(lane.dx * CELL, lane.row * CELL))
        ex, ey = spec["exit"]
        sprites.append(Sprite(
            pixels=_block(EXIT_SEALED), name="exit",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=0,
        ).set_position(ex * CELL, ey * CELL))
        sx, sy = spec["start"]
        sprites.append(Sprite(
            pixels=_block(PLAYER), name="player",
            blocking=BlockingMode.BOUNDING_BOX,
            interaction=InteractionMode.TANGIBLE, layer=2,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(VIEW, VIEW)))
    return levels


class G6547c13a(RenderableUserDisplay):

    def __init__(self, game: "Gb64563e3") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        width = frame.shape[1]
        for i in range(len(self._game.lanes)):
            x = 2 + i * 4
            if x + 3 > width:
                break
            frame[0:3, x:x + 3] = PIP_ON if i < self._game.delivered else PIP_OFF
        left = max(0, self._game.turns_left)
        for i in range(left // 10):
            x = 2 + i * 6
            if x + 5 > width:
                break
            frame[4:7, x:x + 5] = CLOCK
        for i in range(left % 10):
            x = 2 + i * 2
            if x + 1 > width:
                break
            frame[8:10, x:x + 1] = CLOCK
        return frame


class Gb64563e3(ARCBaseGame):

    def __init__(self) -> None:
        self.lanes: list[Gcc63b04c] = lanes_of(LEVELS_SPEC[0])
        self.state: list[int] = [NOT_SENT] * len(self.lanes)
        self.delivered = 0
        self.turns_left = LEVELS_SPEC[0]["budget"]
        self._grid = build_grid(LEVELS_SPEC[0])
        self._px, self._py = LEVELS_SPEC[0]["start"]
        camera = Camera(
            width=VIEW, height=VIEW,
            background=FLOOR, letter_box=FLOOR,
            interfaces=[G6547c13a(self)],
        )
        super().__init__(game_id="t3722717c", levels=build_levels(), camera=camera)

    def on_set_level(self, level: Level) -> None:
        spec = LEVELS_SPEC[self.level_index]
        self.lanes = lanes_of(spec)
        self.state = [NOT_SENT] * len(self.lanes)
        self.delivered = 0
        self.turns_left = spec["budget"]
        self._grid = build_grid(spec)
        self._px, self._py = spec["start"]
        self._disp_at = {(lane.dx, lane.row): i for i, lane in enumerate(self.lanes)}
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
        player = self._sprite("player")
        if player is not None:
            player.set_position(self._px * CELL, self._py * CELL)
        for i, lane in enumerate(self.lanes):
            s = self.state[i]
            disp = self._sprite(f"disp_{i}")
            if disp is not None:
                disp.pixels = np.array(_disp_pixels(s == NOT_SENT), dtype=np.int8)
            recv = self._sprite(f"recv_{i}")
            if recv is not None:
                colour = (RECV_DONE if s == DELIVERED
                          else RECV_DEAD if s == DEAD else RECV)
                recv.pixels = np.array(_recv_pixels(lane.label, colour), dtype=np.int8)
            pkt = self._sprite(f"packet_{i}")
            if pkt is not None:
                if s > 0:
                    pkt.set_interaction(InteractionMode.INTANGIBLE)
                    pkt.set_position((RECV_X - s) * CELL, lane.row * CELL)
                else:
                    pkt.set_interaction(InteractionMode.REMOVED)
        ext = self._sprite("exit")
        if ext is not None:
            open_now = self.delivered == len(self.lanes)
            ext.pixels = np.array(_block(EXIT_OPEN if open_now else EXIT_SEALED),
                                  dtype=np.int8)
        self.camera.x = max(0, min(CAM_MAX_X, self._px * CELL + CELL // 2 - VIEW // 2))
        self.camera.y = 0

    def _tick(self, send: int | None) -> None:
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
        if send is not None:
            self.state[send] = self.lanes[send].rem

    def step(self) -> None:
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
        if self.turns_left <= 0:
            self.level_reset()
            self.complete_action()
            return
        self._refresh()
        self.complete_action()
