# ARC-AGI-3 candidate task t33bdec30.

import numpy as np

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

FLOOR = 10
WALL = 2
PIT = 5
FILLED = 1
ROCK = 13
SWITCH = 15
GATE_SHUT = 8
GATE_OPEN = 7
GOAL = 14
PLAYER = 12

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


def _solid(colour):
    return [[colour] * CELL for _ in range(CELL)]


def _framed(edge, inner):
    px = [[inner] * CELL for _ in range(CELL)]
    for i in range(CELL):
        px[0][i] = px[CELL - 1][i] = edge
        px[i][0] = px[i][CELL - 1] = edge
    return px


def _dot(colour, ground):
    px = [[ground] * CELL for _ in range(CELL)]
    px[1][1] = px[1][2] = px[2][1] = px[2][2] = colour
    return px


def _tile(pixels, name, layer):
    return Sprite(
        pixels=pixels, name=name, blocking=BlockingMode.NOT_BLOCKED,
        interaction=InteractionMode.TANGIBLE, layer=layer,
    )


class Gb939dee5(ARCBaseGame):

    def __init__(self):
        self.rows = LEVELS_SPEC[0]
        self.player, self.rocks, self.filled, self.parity = start_state(self.rows)
        self._undo = []
        camera = Camera(width=N * CELL, height=N * CELL,
                        background=FLOOR, letter_box=5)
        super().__init__(game_id="t33bdec30", levels=self._blank_levels(),
                         camera=camera, available_actions=[1, 2, 3, 4, 7])

    @staticmethod
    def _blank_levels():
        return [Level(sprites=[], grid_size=(N * CELL, N * CELL))
                for _ in LEVELS_SPEC]

    def on_set_level(self, level):
        self.rows = LEVELS_SPEC[self.level_index]
        self.player, self.rocks, self.filled, self.parity = start_state(self.rows)
        self._undo = []
        self._redraw()

    def level_reset(self):
        super().level_reset()
        self.on_set_level(self.current_level)

    def full_reset(self):
        super().full_reset()
        self.on_set_level(self.current_level)

    def _redraw(self):
        level = self.current_level
        level.remove_all_sprites()
        for y in range(N):
            for x in range(N):
                t = _terrain(self.rows, x, y)
                px = None
                if t == "#":
                    px = _solid(WALL)
                elif t == "^":
                    px = _solid(FILLED) if (x, y) in self.filled else _solid(PIT)
                elif t == "s":
                    px = _dot(SWITCH, FLOOR)
                elif t == "X":
                    px = _framed(GOAL, FLOOR)
                elif t in ("a", "b"):
                    shut = (self.parity % 2 == 0) if t == "a" else (self.parity % 2 == 1)
                    px = _solid(GATE_SHUT) if shut else _framed(GATE_OPEN, FLOOR)
                if px is not None:
                    level.add_sprite(_tile(px, f"t_{x}_{y}", -1)
                                     .set_position(x * CELL, y * CELL))
        for i, (x, y) in enumerate(sorted(self.rocks)):
            level.add_sprite(_tile(_solid(ROCK), f"rock_{i}", 1)
                             .set_position(x * CELL, y * CELL))
        px, py = self.player
        level.add_sprite(_tile(_framed(PLAYER, FLOOR), "player", 2)
                         .set_position(px * CELL, py * CELL))

    def step(self):
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
        if dead:
            self.level_reset()
            self.complete_action()
            return
        if (player, rocks, filled, parity) == before:
            self.complete_action()
            return

        self._undo.append(before)
        self.player, self.rocks, self.filled, self.parity = player, rocks, filled, parity
        self._redraw()
        if self.player == goal_of(self.rows):
            self.next_level()
        self.complete_action()
