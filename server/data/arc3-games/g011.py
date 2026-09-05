# ARC-AGI-3 candidate task g011.

import numpy as np

from sprite_book import block, core, door, figure, fixture, medallion, ring, rounded, weave

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

FLOOR = 0
WALL = 3
STONE = 3
PIT = 13
PLUG = 3
SWITCH = 15
GATE = 15
GATE_FILL = 3
GOAL = 10
PLAYER = 8
GRIT = 3

LEVELS_SPEC = [
    [
        "################",
        "#..............#",
        "#..............#",
        "#..P....#......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.....#X#......#",
        "#......#.......#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ],
    [
        "################",
        "#..............#",
        "#.P.....#......#",
        "#..............#",
        "#....^^^^^^....#",
        "#..............#",
        "#..............#",
        "#..........#...#",
        "#.........#X#..#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#...........#..#",
        "################",
    ],
    [
        "################",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.P......O.....#",
        "#..............#",
        "#..............#",
        "#..#........#..#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#........X.....#",
        "#........#.....#",
        "#..............#",
        "################",
    ],
    [
        "################",
        "#..............#",
        "#.P....#.......#",
        "#..............#",
        "#..............#",
        "#.....O........#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.....^........#",
        "#..............#",
        "#.......#......#",
        "#.....#X#......#",
        "#......#.......#",
        "#..............#",
        "################",
    ],
    [
        "################",
        "#..............#",
        "#.P........s...#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#....a..X#.....#",
        "##.............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ],
    [
        "################",
        "#..............#",
        "#.P...s....s...#",
        "#..............#",
        "#..............#",
        "#.....#........#",
        "#..............#",
        "#.....s........#",
        "#..............#",
        "#..........#...#",
        "#.........aX#..#",
        "##.........#...#",
        "#..............#",
        "#..............#",
        "#......#.......#",
        "################",
    ],
    [
        "################",
        "#.#..s.......P.#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#.ss.....Xb....#",
        "##.#...........#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "#..............#",
        "################",
    ],
]

N = 16
CELL = 4

DIRS = {
    GameAction.ACTION1: (0, -1),
    GameAction.ACTION2: (0, 1),
    GameAction.ACTION3: (-1, 0),
    GameAction.ACTION4: (1, 0),
}


def start_state(rows):
    player = None
    rocks = set()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "P":
                player = (x, y)
            elif ch == "O":
                rocks.add((x, y))
    if player is None:
        raise AssertionError("level has no start")
    return player, frozenset(rocks), frozenset(), 0


def _terrain(rows, x, y):
    ch = rows[y][x]
    return "." if ch in "PO" else ch


def _open_to_player(rows, pos, rocks, filled, parity):
    x, y = pos
    if not (0 <= x < N and 0 <= y < N):
        return False
    if pos in rocks:
        return False
    t = _terrain(rows, x, y)
    if t == "#":
        return False
    if t == "a":
        return parity % 2 == 1
    if t == "b":
        return parity % 2 == 0
    return True


def _open_to_rock(rows, pos, rocks, filled, parity):
    x, y = pos
    if not (0 <= x < N and 0 <= y < N):
        return False
    if pos in rocks:
        return False
    t = _terrain(rows, x, y)
    if t in ("#", "X"):
        return False
    if t == "a":
        return parity % 2 == 1
    if t == "b":
        return parity % 2 == 0
    return True


def resolve_slide(rows, player, rocks, filled, parity, d):
    dx, dy = d
    rocks = set(rocks)
    filled = set(filled)
    x, y = player
    while True:
        nxt = (x + dx, y + dy)
        if nxt in rocks:
            beyond = (nxt[0] + dx, nxt[1] + dy)
            if _open_to_rock(rows, beyond, rocks, filled, parity):
                rocks.discard(nxt)
                if _terrain(rows, beyond[0], beyond[1]) == "^" and beyond not in filled:
                    filled.add(beyond)
                else:
                    rocks.add(beyond)
                x, y = nxt
                if _terrain(rows, x, y) == "s":
                    parity += 1
            break
        if not _open_to_player(rows, nxt, rocks, filled, parity):
            break
        x, y = nxt
        t = _terrain(rows, x, y)
        if t == "^" and (x, y) not in filled:
            return (x, y), frozenset(rocks), frozenset(filled), parity, True
        if t == "s":
            parity += 1
    return (x, y), frozenset(rocks), frozenset(filled), parity, False


def slide_path(rows, player, rocks, filled, parity, d):
    dx, dy = d
    rocks = set(rocks)
    filled = set(filled)
    x, y = player
    path = []
    while True:
        nxt = (x + dx, y + dy)
        if nxt in rocks:
            beyond = (nxt[0] + dx, nxt[1] + dy)
            if _open_to_rock(rows, beyond, rocks, filled, parity):
                rocks.discard(nxt)
                if _terrain(rows, beyond[0], beyond[1]) == "^" and beyond not in filled:
                    filled.add(beyond)
                else:
                    rocks.add(beyond)
                x, y = nxt
                path.append((x, y))
                if _terrain(rows, x, y) == "s":
                    parity += 1
            break
        if not _open_to_player(rows, nxt, rocks, filled, parity):
            break
        x, y = nxt
        path.append((x, y))
        t = _terrain(rows, x, y)
        if t == "^" and (x, y) not in filled:
            break
        if t == "s":
            parity += 1
    return path


def goal_of(rows):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "X":
                return (x, y)
    raise AssertionError("level has no goal")


def _over(base, top):
    for y, row in enumerate(top):
        for x, v in enumerate(row):
            if v >= 0:
                base[y][x] = v
    return base


def _wall_px():
    return _over(block(WALL, CELL), fixture((FLOOR, FLOOR), 0, 0, CELL))


def _pit_px():
    return weave(PIT, CELL)


def _plug_px():
    return medallion(PIT, PLUG, CELL)


def _rock_px():
    return rounded(STONE, CELL)


def _switch_px():
    return medallion(SWITCH, FLOOR, CELL)


def _gate_px(shut):
    return door(GATE, GATE_FILL if shut else None, CELL)


def _socket_px():
    return ring(GOAL, CELL)


def _body_px(mode):
    if mode == "gone":
        return [[-1] * CELL for _ in range(CELL)]
    if mode == "run":
        return figure(PLAYER, None, CELL)
    return core(PLAYER, CELL)


def _grit_px(x, y, phase):
    return fixture((GRIT, FLOOR, FLOOR), phase, (x * 3 + y) % 3, CELL)


def _grit_cells(rows):
    return [(x, y) for y in range(N) for x in range(N)
            if _terrain(rows, x, y) == "." and (x * 7 + y * 5) % 17 == 0]


def _tile(pixels, name, layer):
    return Sprite(
        pixels=pixels, name=name, blocking=BlockingMode.NOT_BLOCKED,
        interaction=InteractionMode.TANGIBLE, layer=layer,
    )


class G011(ARCBaseGame):

    SINK_FRAMES = 6
    DOCK_FRAMES = 2

    def __init__(self):
        self.rows = LEVELS_SPEC[0]
        self.player, self.rocks, self.filled, self.parity = start_state(self.rows)
        self._undo = []
        self._anim = None
        self._outcome = None
        self._tick = 0
        self._grit = []
        camera = Camera(width=N * CELL, height=N * CELL,
                        background=FLOOR, letter_box=5)
        super().__init__(game_id="g011", levels=self._blank_levels(),
                         camera=camera, available_actions=[1, 2, 3, 4, 7])

    @staticmethod
    def _blank_levels():
        return [Level(sprites=[], grid_size=(N * CELL, N * CELL))
                for _ in LEVELS_SPEC]

    def on_set_level(self, level):
        self.rows = LEVELS_SPEC[self.level_index]
        self.player, self.rocks, self.filled, self.parity = start_state(self.rows)
        self._undo = []
        self._anim = None
        self._outcome = None
        self._redraw()

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)

    def _redraw(self):
        self._paint(self.player, self.rocks, self.filled, self.parity)

    def _paint(self, player, rocks, filled, parity, mode="run"):
        self._tick += 1
        level = self.current_level
        level.remove_all_sprites()
        self._grit = []
        for y in range(N):
            for x in range(N):
                t = _terrain(self.rows, x, y)
                px = None
                if t == "#":
                    px = _wall_px()
                elif t == "^":
                    px = _plug_px() if (x, y) in filled else _pit_px()
                elif t == "s":
                    px = _switch_px()
                elif t == "X":
                    px = _socket_px()
                elif t in ("a", "b"):
                    shut = (parity % 2 == 0) if t == "a" else (parity % 2 == 1)
                    px = _gate_px(shut)
                if px is not None:
                    level.add_sprite(_tile(px, f"t_{x}_{y}", -1)
                                     .set_position(x * CELL, y * CELL))
        for i, (x, y) in enumerate(_grit_cells(self.rows)):
            sp = _tile(_grit_px(x, y, self._tick), f"grit_{i}", -2)
            level.add_sprite(sp.set_position(x * CELL, y * CELL))
            self._grit.append((sp, x, y))
        for i, (x, y) in enumerate(sorted(rocks)):
            level.add_sprite(_tile(_rock_px(), f"rock_{i}", 1)
                             .set_position(x * CELL, y * CELL))
        px, py = player
        level.add_sprite(_tile(_body_px(mode), "player", 2)
                         .set_position(px * CELL, py * CELL))

    def _move_body(self, cell, mode):
        self._tick += 1
        for sp in self.current_level.get_sprites_by_name("player"):
            sp.pixels = np.array(_body_px(mode), dtype=np.int8)
            sp.set_position(cell[0] * CELL, cell[1] * CELL)
        for sp, x, y in self._grit:
            sp.pixels = np.array(_grit_px(x, y, self._tick), dtype=np.int8)

    def step(self):
        if self._anim is not None:
            if self._anim:
                self._move_body(*self._anim.pop(0))
                return
            outcome, self._anim, self._outcome = self._outcome, None, None
            if outcome is None:
                self.level_reset()
            else:
                self.player, self.rocks, self.filled, self.parity = outcome
                seated = self.player == goal_of(self.rows)
                self._paint(self.player, self.rocks, self.filled, self.parity,
                            "seated" if seated else "run")
                if seated:
                    self.next_level()
            self.complete_action()
            return

        act = self.action.id
        if act == GameAction.ACTION7:
            if self._undo:
                self.player, self.rocks, self.filled, self.parity = self._undo.pop()
                self._redraw()
            self.complete_action()
            return

        d = DIRS.get(act)
        if d is None:
            self.complete_action()
            return

        before = (self.player, self.rocks, self.filled, self.parity)
        player, rocks, filled, parity, dead = resolve_slide(
            self.rows, self.player, self.rocks, self.filled, self.parity, d)
        if not dead and (player, rocks, filled, parity) == before:
            self.complete_action()
            return

        frames = [(cell, "run") for cell in
                  slide_path(self.rows, self.player, self.rocks, self.filled,
                             self.parity, d)]
        if dead:
            for i in range(self.SINK_FRAMES):
                frames.append((player, "sunk" if i % 2 == 0 else "gone"))
            self._outcome = None
        else:
            self._undo.append(before)
            if player == goal_of(self.rows):
                frames.extend((player, "seated") for _ in range(self.DOCK_FRAMES))
            self._outcome = (player, rocks, filled, parity)
        self._anim = frames
        if self._anim:
            self._move_body(*self._anim.pop(0))
        return
