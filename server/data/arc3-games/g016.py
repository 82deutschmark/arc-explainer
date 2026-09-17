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


def route_via(*points):
    route = [points[0]]
    for bx, by in points[1:]:
        x, y = route[-1]
        while (x, y) != (bx, by):
            if x != bx:
                x += (bx > x) - (bx < x)
            else:
                y += (by > y) - (by < y)
            route.append((x, y))
    return tuple(route)


LEVELS_SPEC[3]["speeds"] = (1, 2, 1)
LEVELS_SPEC[3]["budget"] = 49
LEVELS_SPEC.extend([
    dict(lanes=[(4, 2, 2), (6, 8, 1), (8, 5, 3)],
         bridges=[(4, 4), (10, 6), (10, 8), (20, 10)], start=(2, 3), exit=(23, 11), budget=60,
         speeds=(2, 1, 1), routes={
             0: route_via((3, 4), (12, 4), (12, 8), (17, 8), (17, 4), (23, 4)),
             2: route_via((6, 8), (10, 8), (10, 6), (19, 6), (19, 8), (23, 8))}),
    dict(lanes=[(4, 4, 3), (6, 4, 1), (8, 4, 2)],
         bridges=[(6, 4), (6, 6), (6, 8), (20, 10)], start=(4, 5), exit=(23, 11), budget=53,
         speeds=(2, 1, 2), routes={
             0: route_via((5, 4), (10, 4), (10, 8), (18, 8), (18, 4), (23, 4)),
             1: route_via((5, 6), (23, 6)),
             2: route_via((5, 8), (14, 8), (14, 4), (21, 4), (21, 8), (23, 8))}),
])


class Lane:
    def __init__(self, row, dx, label, speed=1, route=None):
        self.row, self.dx, self.label = row, dx, label
        self.speed = speed
        self.route = route or tuple((x, row) for x in range(dx + 1, RECV_X + 1))
        self.rem = len(self.route) - 1


def lanes_of(spec):
    return [Lane(r, dx, lb, spec.get("speeds", (1,) * len(spec["lanes"]))[i],
                 spec.get("routes", {}).get(i)) for i, (r, dx, lb) in enumerate(spec["lanes"])]


def advance_packets(packets, lanes, delivered):
    out = list(packets)
    collisions = set()
    for substep in range(max(lane.speed for lane in lanes)):
        before = {i: lanes[i].route[lanes[i].rem - rem] for i, rem in enumerate(out) if rem > 0}
        after = dict(before)
        for i in before:
            if substep < lanes[i].speed:
                out[i] -= 1
                after[i] = lanes[i].route[lanes[i].rem - out[i]]
        crashed = set()
        for i in before:
            for j in before:
                if i < j and (after[i] == after[j] or (after[i] == before[j] and after[j] == before[i])):
                    crashed.update((i, j))
                    collisions.update((after[i], after[j]))
        for i in crashed:
            out[i] = DEAD
        arrivals = [i for i in before if out[i] == 0]
        if len(arrivals) == 1 and lanes[arrivals[0]].label == delivered + 1:
            out[arrivals[0]] = DELIVERED
            delivered += 1
        else:
            for i in arrivals:
                out[i] = DEAD
    return tuple(out), delivered, collisions


def build_grid(spec: dict) -> list[str]:
    grid = [["#"] * W for _ in range(H)]
    for y in AISLE_ROWS:
        for x in range(1, W - 1):
            grid[y][x] = "."
    for lane in lanes_of(spec):
        for x, y in lane.route[:-1]:
            if grid[y][x] == "#":
                grid[y][x] = "-"
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
    return figure(PLAYER, PLAYER_CHEST)


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
            for a, b in zip(lane.route, lane.route[1:]):
                px = np.full((CELL, CELL), -1, dtype=np.int8)
                dx, dy = b[0] - a[0], b[1] - a[1]
                px[1:3, 1:3] = BELT
                if dx: px[1:3, 2:4 if dx > 0 else 2] = BELT
                if dx < 0: px[1:3, :2] = BELT
                if dy > 0: px[2:4, 1:3] = BELT
                if dy < 0: px[:2, 1:3] = BELT
                sprites.append(_static_sprite(px, a[0], a[1], f"track_{i}_{a[0]}_{a[1]}", -1, False))
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


class ShiftDisplay(RenderableUserDisplay):

    def __init__(self, game: "SlowPost") -> None:
        super().__init__()
        self._game = game

    def render_interface(self, frame: np.ndarray) -> np.ndarray:
        game = self._game
        for x, y in getattr(game, "collisions", ()):
            sx, sy = x * CELL - game.camera.x, y * CELL
            if 0 <= sx <= 60:
                for k in range(CELL):
                    frame[sy+k, sx+k] = frame[sy+k, sx+CELL-1-k] = RECV_DEAD
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


class SlowPost(ARCBaseGame):

    LAUNCH_FRAMES = 4
    LAND_FRAMES = 4
    SHIFT_FRAMES = 6

    def __init__(self) -> None:
        self._flash = 0
        self._snap = False
        self._landed: list[int] = []
        self._sent: int | None = None
        self.lanes: list[Lane] = lanes_of(LEVELS_SPEC[0])
        self.state: list[int] = [NOT_SENT] * len(self.lanes)
        self.delivered = 0
        self.turns_left = LEVELS_SPEC[0]["budget"]
        self._grid = build_grid(LEVELS_SPEC[0])
        self._px, self._py = LEVELS_SPEC[0]["start"]
        camera = Camera(
            width=VIEW, height=VIEW,
            background=FLOOR, letter_box=FLOOR,
            interfaces=[ShiftDisplay(self)],
        )
        super().__init__(game_id="g016", levels=build_levels(), camera=camera, available_actions=[1, 2, 3, 4, 5])

    @property
    def shift_over(self) -> bool:
        return self._snap

    @property
    def flash_lit(self) -> bool:
        return self._flash % 2 == 1

    def on_set_level(self, level: Level) -> None:
        clear_translation(self)
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
        self.collisions = set()
        self._refresh()

    def level_reset(self) -> None:
        clear_translation(self)
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self) -> None:
        clear_translation(self)
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
                face = _disp_pixels(s == NOT_SENT)
                for k in range(lane.label):
                    face[0][k] = RECV_MARK
                if lane.speed > 1:
                    face[3][1] = face[3][2] = PACKET
                disp.pixels = np.array(face, dtype=np.int8)
            recv = self._sprite(f"recv_{i}")
            if recv is not None:
                recv.pixels = np.array(_recv_pixels(lane.label, s), dtype=np.int8)
            pkt = self._sprite(f"packet_{i}")
            if pkt is not None:
                if s > 0:
                    pkt.set_interaction(InteractionMode.INTANGIBLE)
                    x, y = lane.route[lane.rem - s]
                    pkt.set_position(x * CELL, y * CELL)
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
        old = self.state
        moved, self.delivered, hit = advance_packets(old, self.lanes, self.delivered)
        self.state = list(moved)
        self.collisions.update(hit)
        self._landed = [i for i, (a, b) in enumerate(zip(old, moved)) if a > 0 and b < 0]
        if send is not None:
            self.state[send] = self.lanes[send].rem

    def step(self) -> None:
        if advance_translation(self):
            return
        begin_translation(self, ('player', 'packet_*'), limit=CELL)
        if self._flash:
            self._flash -= 1
            self._paint_flash()
            if self._flash == 0:
                if self._snap:
                    self._snap = False
                    self.level_reset()
                else:
                    self._refresh()
                finish_translation(self)
            return
        if self.action.id == GameAction.RESET:
            self._refresh()
            finish_translation(self)
            return
        deltas = {
            GameAction.ACTION1: (0, -1),
            GameAction.ACTION2: (0, 1),
            GameAction.ACTION3: (-1, 0),
            GameAction.ACTION4: (1, 0),
        }
        delta = deltas.get(self.action.id)
        if delta is None and self.action.id != GameAction.ACTION5:
            finish_translation(self)
            return
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
                    finish_translation(self)
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
        finish_translation(self)
