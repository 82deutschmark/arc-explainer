# ARC-AGI-3 candidate task g033.

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
from sprite_book import block, core, figure, fixture, ring, rounded

FLOOR = 1
WALL = 13
BED_EMPTY = 13
PLAYER = 12
STOP_SERVED = 1

CRATE_FACE = {
    1: (6, 6),
    2: (8, 8),
    3: (14, 14),
    4: (6, 13),
    5: (8, 13),
    6: (14, 13),
    7: (6, 14),
}

N = 16
CELL = 4
BED_X = 13

WALL_CH = "#"
FLOOR_CH = "."
BED_CH = "b"
START_CH = "P"

DIRS = {"U": (0, -1), "D": (0, 1), "L": (-1, 0), "R": (1, 0)}

DECOR_X = (3, 7, 11)
DECOR_CYCLE = (PLAYER, WALL, FLOOR)

LEVELS_SPEC = [
    {"stops": [1, 2, 3, 4], "rows": [
        "################",
        "#..............#",
        "#...1........b.#",
        "#............b.#",
        "#............b.#",
        "#............b.#",
        "#....2.........#",
        "#..............#",
        "#.......3......#",
        "#..............#",
        "#..............#",
        "#.......4......#",
        "#..............#",
        "#..............#",
        "#.P............#",
        "################",
    ]},
    {"stops": [1, 3, 2, 5, 4], "rows": [
        "################",
        "#..............#",
        "#..2.........b.#",
        "#............b.#",
        "#............b.#",
        "#........1...b.#",
        "#............b.#",
        "#..............#",
        "#..............#",
        "#.####.........#",
        "#.#54..........#",
        "#.####.........#",
        "#..........3...#",
        "#..............#",
        "#.P............#",
        "################",
    ]},
    {"stops": [1, 4, 2, 5, 3], "rows": [
        "################",
        "#..............#",
        "#..4.........b.#",
        "#............b.#",
        "#............b.#",
        "#............b.#",
        "#............b.#",
        "#..............#",
        "#.####.........#",
        "#.#1.#.........#",
        "#.#2.3.........#",
        "#.####.........#",
        "#..............#",
        "#........5.....#",
        "#.P............#",
        "################",
    ]},
    {"stops": [6, 3, 4, 5, 1, 7, 2], "rows": [
        "################",
        "#..............#",
        "#.####.......b.#",
        "#.#52........b.#",
        "#.####.......b.#",
        "#............b.#",
        "#..####......b.#",
        "#..#37.......b.#",
        "#..####......b.#",
        "#..............#",
        "#.....####.....#",
        "#.....#61......#",
        "#.....####.....#",
        "#..........4...#",
        "#.P............#",
        "################",
    ]},
    {"stops": [2, 7, 5, 6, 1, 4, 3], "rows": [
        "################",
        "#..............#",
        "#............b.#",
        "#.####.......b.#",
        "#.#1.#.......b.#",
        "#.#2.3.......b.#",
        "#.####.......b.#",
        "#............b.#",
        "#............b.#",
        "#.....####.....#",
        "#......45#.....#",
        "#.....####.....#",
        "#..6...........#",
        "#..........7...#",
        "#.P............#",
        "################",
    ]},
]


def stop_row(index: int) -> int:
    return 14 - 2 * index


def bed_cells(rows):
    return sorted(((x, y) for y, r in enumerate(rows)
                   for x, c in enumerate(r) if c == BED_CH), key=lambda p: p[1])


def push_cell(rows):
    cells = bed_cells(rows)
    mx, my = cells[-1]
    return mx, my + 1


def crates_of(rows):
    return {(x, y): int(c) for y, r in enumerate(rows)
            for x, c in enumerate(r) if c.isdigit()}


def find_start(rows):
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c == START_CH:
                return x, y
    raise AssertionError("level has no start")


def required_order(spec):
    return tuple(reversed(spec["stops"]))


def can_walk(rows, floor_crates, carried, x, y):
    if not (0 <= x < N and 0 <= y < N):
        return False
    ch = rows[y][x]
    if ch == WALL_CH or ch == BED_CH:
        return False
    if (x, y) in floor_crates:
        return carried is None
    return True


def start_state(spec):
    sx, sy = find_start(spec["rows"])
    return (sx, sy, None, (), 0, frozenset(crates_of(spec["rows"]).items()))


def step_state(spec, state, action):
    rows = spec["rows"]
    px, py, carried, bed, served, floor = state
    floor_map = dict(floor)
    total = len(spec["stops"])
    order = required_order(spec)
    pcell = push_cell(rows)

    if action in DIRS:
        dx, dy = DIRS[action]
        nx, ny = px + dx, py + dy
        if can_walk(rows, floor_map, carried, nx, ny):
            if (nx, ny) in floor_map:
                carried = floor_map.pop((nx, ny))
            px, py = nx, ny

    elif action == "S":
        if served == 0 and len(bed) < total:
            if carried is not None and (px, py) == pcell:
                bed = bed + (carried,)
                carried = None
        else:
            if served < total and (px, py) == (1, stop_row(served)):
                mouth = bed[-1]
                if mouth == spec["stops"][served]:
                    bed = bed[:-1]
                    served += 1
                    if served == total:
                        return (px, py, carried, bed, served,
                                frozenset(floor_map.items())), "won"
                else:
                    return (px, py, carried, bed, served,
                            frozenset(floor_map.items())), "fail"

    elif action == "Z":
        if served == 0 and len(bed) < total and carried is None and bed and (px, py) == pcell:
            carried = bed[-1]
            bed = bed[:-1]

    return (px, py, carried, bed, served, frozenset(floor_map.items())), "ok"


def _crate_face(crate):
    rim, centre = CRATE_FACE[crate]
    px = rounded(rim, CELL)
    heart = core(centre, CELL)
    for y in range(CELL):
        for x in range(CELL):
            if heart[y][x] >= 0:
                px[y][x] = heart[y][x]
    return px


def _socket_face():
    return ring(BED_EMPTY, CELL)


def _wall_face(x, y):
    px = block(WALL, CELL)
    px[1 + (x + y) % 2][(x * 2 + y) % CELL] = FLOOR
    return px


def _floor_face(x, y):
    px = [[-1] * CELL for _ in range(CELL)]
    if (x * 5 + y * 3) % 9 == 0:
        px[CELL - 1][0] = WALL
    return px


def _player_face(carried):
    if carried is None:
        return figure(PLAYER, WALL, CELL)
    px = _crate_face(carried)
    px[0][0] = px[0][CELL - 1] = PLAYER
    px[CELL - 1] = [PLAYER, PLAYER, -1, PLAYER]
    return px


def _stamp(frame, top, left, face):
    art = np.array(face, dtype=np.int8)
    region = frame[top:top + CELL, left:left + CELL]
    frame[top:top + CELL, left:left + CELL] = np.where(art >= 0, art, region)
    return frame


def build_levels():
    levels = []
    for spec in LEVELS_SPEC:
        rows = spec["rows"]
        sprites = []
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == WALL_CH:
                    face = _wall_face(x, y)
                elif ch == BED_CH:
                    face = _socket_face()
                else:
                    face = _floor_face(x, y)
                sprites.append(Sprite(
                    pixels=face, name=f"cell_{x}_{y}",
                    blocking=BlockingMode.NOT_BLOCKED,
                    interaction=InteractionMode.INTANGIBLE, layer=-1,
                ).set_position(x * CELL, y * CELL))
        for i, dx in enumerate(DECOR_X):
            sprites.append(Sprite(
                pixels=fixture(DECOR_CYCLE, 0, i, CELL), name=f"decor_{i}",
                blocking=BlockingMode.NOT_BLOCKED,
                interaction=InteractionMode.INTANGIBLE, layer=0,
            ).set_position(dx * CELL, 0))
        sx, sy = find_start(rows)
        sprites.append(Sprite(
            pixels=_player_face(None), name="player",
            blocking=BlockingMode.NOT_BLOCKED,
            interaction=InteractionMode.INTANGIBLE, layer=1,
        ).set_position(sx * CELL, sy * CELL))
        levels.append(Level(sprites=sprites, grid_size=(N * CELL, N * CELL)))
    return levels


class G033A(RenderableUserDisplay):

    def __init__(self, game):
        super().__init__()
        self._game = game

    def render_interface(self, frame):
        game = self._game
        spec = LEVELS_SPEC[game.level_index]
        for i, colour in enumerate(spec["stops"]):
            top = stop_row(i) * CELL
            frame[top:top + CELL, 0:CELL] = WALL
            if game.fail_frames and i == game.fail_stop and game.fail_frames % 2 == 1:
                _stamp(frame, top, 0, _crate_face(game.fail_offered))
            elif game.eject_frames and i == game.eject_stop and game.eject_frames % 2 == 0:
                _stamp(frame, top, 0, _crate_face(game.eject_crate))
            elif i < game.served:
                frame[top + 1:top + 3, 0:2] = STOP_SERVED
            else:
                _stamp(frame, top, 0, _crate_face(colour))
        return frame


class G033(ARCBaseGame):

    EJECT_FRAMES = 4
    FAIL_FRAMES = 6

    def __init__(self):
        self.spec = LEVELS_SPEC[0]
        self.px, self.py, self.carried, self.bed, self.served, self.floor = \
            start_state(LEVELS_SPEC[0])
        self._clear_effects()
        self.phase = 0
        camera = Camera(
            width=N * CELL, height=N * CELL,
            background=FLOOR, letter_box=5,
            interfaces=[G033A(self)],
        )
        super().__init__(game_id="g033", levels=build_levels(), camera=camera)

    def _clear_effects(self):
        self.slide = None
        self.eject_frames = 0
        self.eject_cell = None
        self.eject_crate = None
        self.eject_stop = 0
        self.fail_frames = 0
        self.fail_cell = None
        self.fail_offered = None
        self.fail_stop = 0
        self.pending_win = False

    def on_set_level(self, level):
        self.spec = LEVELS_SPEC[self.level_index]
        self.px, self.py, self.carried, self.bed, self.served, self.floor = \
            start_state(self.spec)
        self._clear_effects()
        self._repaint()

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)

    @property
    def state_tuple(self):
        return (self.px, self.py, self.carried, self.bed, self.served, self.floor)

    def _bed_faces(self, cells):
        showing = {}
        for i, crate in enumerate(self.bed):
            showing[cells[i]] = crate
        if self.slide is not None:
            if not self.slide["to_hand"]:
                showing.pop(cells[len(self.bed) - 1], None)
            showing[self.slide["path"][0]] = self.slide["crate"]
        if self.eject_frames and self.eject_frames % 2 == 0:
            showing[self.eject_cell] = self.eject_crate
        if self.fail_frames and self.fail_frames % 2 == 1:
            showing.pop(self.fail_cell, None)
        return showing

    def _repaint(self):
        level = self.current_level
        rows = self.spec["rows"]
        floor_map = dict(self.floor)
        cells = bed_cells(rows)
        showing = self._bed_faces(cells)
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == WALL_CH:
                    continue
                found = level.get_sprites_by_name(f"cell_{x}_{y}")
                if not found:
                    continue
                if ch == BED_CH:
                    face = (_crate_face(showing[(x, y)]) if (x, y) in showing
                            else _socket_face())
                elif (x, y) in floor_map:
                    face = _crate_face(floor_map[(x, y)])
                else:
                    face = _floor_face(x, y)
                found[0].pixels = np.array(face, dtype=np.int8)
        in_hand = None if (self.slide is not None and self.slide["to_hand"]) else self.carried
        player = level.get_sprites_by_name("player")
        if player:
            player[0].pixels = np.array(_player_face(in_hand), dtype=np.int8)
            player[0].set_position(self.px * CELL, self.py * CELL)
        for i in range(len(DECOR_X)):
            for sprite in level.get_sprites_by_name(f"decor_{i}"):
                sprite.pixels = np.array(
                    fixture(DECOR_CYCLE, self.phase, i, CELL), dtype=np.int8)

    def _start_slide(self, crate, first, last, to_hand):
        cells = bed_cells(self.spec["rows"])
        step = 1 if last >= first else -1
        path = [cells[i] for i in range(first, last + step, step)]
        self.slide = {"crate": crate, "path": path, "to_hand": to_hand}

    def step(self):
        if self.fail_frames:
            self.fail_frames -= 1
            if self.fail_frames == 0:
                self.level_reset()
                self.complete_action()
            else:
                self._repaint()
            return

        if self.eject_frames:
            self.eject_frames -= 1
            self._repaint()
            if self.eject_frames == 0:
                self.eject_cell = None
                if self.pending_win:
                    self.pending_win = False
                    self.next_level()
                self.complete_action()
            return

        if self.slide is not None:
            self.slide["path"].pop(0)
            if not self.slide["path"]:
                self.slide = None
            self._repaint()
            if self.slide is None:
                self.complete_action()
            return

        self.phase += 1

        action = None
        if self.action.id == GameAction.ACTION1:
            action = "U"
        elif self.action.id == GameAction.ACTION2:
            action = "D"
        elif self.action.id == GameAction.ACTION3:
            action = "L"
        elif self.action.id == GameAction.ACTION4:
            action = "R"
        elif self.action.id == GameAction.ACTION5:
            action = "S"
        elif self.action.id == GameAction.ACTION7:
            action = "Z"

        if action is None:
            self.complete_action()
            return

        was_bed, was_served = self.bed, self.served
        state, outcome = step_state(self.spec, self.state_tuple, action)
        self.px, self.py, self.carried, self.bed, self.served, self.floor = state

        depth = len(bed_cells(self.spec["rows"]))
        if outcome == "fail":
            self.fail_frames = self.FAIL_FRAMES
            self.fail_offered = self.bed[-1]
            self.fail_cell = bed_cells(self.spec["rows"])[len(self.bed) - 1]
            self.fail_stop = self.served
        elif self.served > was_served:
            self.eject_frames = self.EJECT_FRAMES
            self.eject_crate = was_bed[-1]
            self.eject_cell = bed_cells(self.spec["rows"])[len(was_bed) - 1]
            self.eject_stop = was_served
            self.pending_win = outcome == "won"
        elif len(self.bed) > len(was_bed):
            self._start_slide(self.bed[-1], depth - 1, len(self.bed) - 1, False)
        elif len(self.bed) < len(was_bed):
            self._start_slide(was_bed[-1], len(was_bed) - 1, depth - 1, True)

        self._repaint()
        if self.fail_frames or self.eject_frames or self.slide is not None:
            return
        self.complete_action()
